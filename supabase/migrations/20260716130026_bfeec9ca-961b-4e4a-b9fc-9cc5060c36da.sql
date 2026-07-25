
-- 1. Add loyalty settings to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS loyalty_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loyalty_target_orders int NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS loyalty_reward_type text NOT NULL DEFAULT 'wallet_credit',
  ADD COLUMN IF NOT EXISTS loyalty_reward_value_iqd int NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS loyalty_reward_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_loyalty_reward_type_chk
  CHECK (loyalty_reward_type IN ('wallet_credit','discount','free_item'));

-- 2. Coupons: allow assigning to a specific customer
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_loyalty_reward boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS coupons_assigned_user_idx ON public.coupons(assigned_user_id) WHERE assigned_user_id IS NOT NULL;

-- 3. Loyalty redemptions log
CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  reward_type text NOT NULL,
  reward_value_iqd int NOT NULL DEFAULT 0,
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  milestone_number int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loyalty_redemptions TO authenticated;
GRANT ALL ON public.loyalty_redemptions TO service_role;

ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own loyalty rewards"
  ON public.loyalty_redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Tenant owners read their loyalty rewards"
  ON public.loyalty_redemptions FOR SELECT TO authenticated
  USING (tenant_id = public.owner_tenant_id(auth.uid()));

CREATE POLICY "Super admins read all loyalty rewards"
  ON public.loyalty_redemptions FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 4. Replace loyalty trigger with milestone-based reward
CREATE OR REPLACE FUNCTION public.award_loyalty_on_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled boolean;
  v_target int;
  v_reward_type text;
  v_reward_value int;
  v_delivered_count int;
  v_last_milestone int;
  v_new_milestone int;
  v_coupon_id uuid;
  v_code text;
BEGIN
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' OR NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT loyalty_enabled, loyalty_target_orders, loyalty_reward_type, loyalty_reward_value_iqd
    INTO v_enabled, v_target, v_reward_type, v_reward_value
    FROM public.tenants WHERE id = NEW.tenant_id;

  IF NOT v_enabled OR v_target <= 0 THEN
    RETURN NEW;
  END IF;

  -- Count delivered orders for this customer in this tenant (including this one)
  SELECT COUNT(*) INTO v_delivered_count
    FROM public.orders
    WHERE tenant_id = NEW.tenant_id
      AND customer_id = NEW.customer_id
      AND status = 'delivered';

  v_new_milestone := v_delivered_count / v_target;

  SELECT COALESCE(MAX(milestone_number), 0) INTO v_last_milestone
    FROM public.loyalty_redemptions
    WHERE tenant_id = NEW.tenant_id AND user_id = NEW.customer_id;

  IF v_new_milestone <= v_last_milestone THEN
    RETURN NEW;
  END IF;

  -- Award based on reward type
  IF v_reward_type = 'wallet_credit' THEN
    INSERT INTO public.wallet_transactions (user_id, tenant_id, amount_iqd, type, note)
    VALUES (NEW.customer_id, NEW.tenant_id, v_reward_value, 'credit', 'مكافأة ولاء');

  ELSIF v_reward_type IN ('discount','free_item') THEN
    v_code := 'LOYAL-' || substr(replace(NEW.customer_id::text,'-',''),1,6) || '-' || v_new_milestone::text;
    INSERT INTO public.coupons (
      tenant_id, code, discount_type, discount_value, min_order_iqd,
      usage_limit, used_count, is_active, assigned_user_id, is_loyalty_reward
    )
    VALUES (
      NEW.tenant_id, v_code, 'amount', v_reward_value, 0,
      1, 0, true, NEW.customer_id, true
    )
    RETURNING id INTO v_coupon_id;
  END IF;

  INSERT INTO public.loyalty_redemptions (
    tenant_id, user_id, order_id, reward_type, reward_value_iqd, coupon_id, milestone_number
  )
  VALUES (
    NEW.tenant_id, NEW.customer_id, NEW.id, v_reward_type, v_reward_value, v_coupon_id, v_new_milestone
  );

  RETURN NEW;
END;
$$;

-- Helper: get loyalty progress for a user in a tenant (delivered count, target, remaining)
CREATE OR REPLACE FUNCTION public.get_loyalty_progress(_tenant_id uuid, _user_id uuid)
RETURNS TABLE(
  enabled boolean,
  target_orders int,
  reward_type text,
  reward_value_iqd int,
  reward_item_id uuid,
  delivered_count int,
  last_milestone int,
  progress_in_cycle int,
  remaining_to_next int
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_delivered int;
  v_last int;
BEGIN
  SELECT t.loyalty_enabled, t.loyalty_target_orders, t.loyalty_reward_type,
         t.loyalty_reward_value_iqd, t.loyalty_reward_item_id
    INTO enabled, target_orders, reward_type, reward_value_iqd, reward_item_id
    FROM public.tenants t WHERE t.id = _tenant_id;

  SELECT COUNT(*) INTO v_delivered
    FROM public.orders
    WHERE tenant_id = _tenant_id AND customer_id = _user_id AND status = 'delivered';

  SELECT COALESCE(MAX(milestone_number), 0) INTO v_last
    FROM public.loyalty_redemptions
    WHERE tenant_id = _tenant_id AND user_id = _user_id;

  delivered_count := COALESCE(v_delivered, 0);
  last_milestone := COALESCE(v_last, 0);
  IF target_orders IS NULL OR target_orders <= 0 THEN
    progress_in_cycle := 0;
    remaining_to_next := 0;
  ELSE
    progress_in_cycle := delivered_count - (last_milestone * target_orders);
    remaining_to_next := GREATEST(target_orders - progress_in_cycle, 0);
  END IF;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_loyalty_progress(uuid, uuid) TO authenticated, anon;

-- Update coupons RLS: assigned coupons visible to the assigned user
DROP POLICY IF EXISTS "Assigned coupon visible to assignee" ON public.coupons;
CREATE POLICY "Assigned coupon visible to assignee"
  ON public.coupons FOR SELECT TO authenticated
  USING (assigned_user_id = auth.uid());
