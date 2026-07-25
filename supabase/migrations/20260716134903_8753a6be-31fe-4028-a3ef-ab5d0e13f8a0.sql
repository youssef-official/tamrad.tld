
-- 1) MENU MODIFIERS
CREATE TABLE public.menu_modifier_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  min_select int NOT NULL DEFAULT 0,
  max_select int NOT NULL DEFAULT 1,
  is_required boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.menu_modifier_groups(menu_item_id);
GRANT SELECT ON public.menu_modifier_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_modifier_groups TO authenticated;
GRANT ALL ON public.menu_modifier_groups TO service_role;
ALTER TABLE public.menu_modifier_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads modifier groups" ON public.menu_modifier_groups FOR SELECT USING (true);
CREATE POLICY "owners manage modifier groups" ON public.menu_modifier_groups FOR ALL TO authenticated
  USING (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE TRIGGER trg_mmg_updated BEFORE UPDATE ON public.menu_modifier_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.menu_modifier_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.menu_modifier_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  extra_price_iqd int NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.menu_modifier_options(group_id);
GRANT SELECT ON public.menu_modifier_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_modifier_options TO authenticated;
GRANT ALL ON public.menu_modifier_options TO service_role;
ALTER TABLE public.menu_modifier_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads modifier options" ON public.menu_modifier_options FOR SELECT USING (true);
CREATE POLICY "owners manage modifier options" ON public.menu_modifier_options FOR ALL TO authenticated
  USING (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE TRIGGER trg_mmo_updated BEFORE UPDATE ON public.menu_modifier_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) PANIC BUTTON
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS accepting_orders boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.reject_if_branch_paused()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_ok boolean;
BEGIN
  IF NEW.branch_id IS NULL THEN RETURN NEW; END IF;
  SELECT accepting_orders INTO v_ok FROM public.branches WHERE id = NEW.branch_id;
  IF v_ok = false THEN
    RAISE EXCEPTION 'BRANCH_PAUSED' USING HINT = 'المطعم أوقف استقبال الطلبات مؤقتاً، حاول لاحقاً.';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reject_if_paused ON public.orders;
CREATE TRIGGER trg_reject_if_paused BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.reject_if_branch_paused();

-- 3) ORDER DRIVER TRANSFER
CREATE TABLE public.order_driver_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.order_driver_history(order_id);
GRANT SELECT, INSERT ON public.order_driver_history TO authenticated;
GRANT ALL ON public.order_driver_history TO service_role;
ALTER TABLE public.order_driver_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner and drivers read history" ON public.order_driver_history FOR SELECT TO authenticated
  USING (
    tenant_id = user_tenant_id(auth.uid())
    OR auth.uid() = from_driver_id
    OR auth.uid() = to_driver_id
    OR is_super_admin(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.transfer_order_driver(
  _order_id uuid, _new_driver_id uuid, _reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; v_old uuid; v_status order_status; v_owner_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_owner_tenant FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'owner' LIMIT 1;
  IF v_owner_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ليس لديك صلاحية');
  END IF;
  SELECT tenant_id, driver_id, status INTO v_tenant, v_old, v_status
    FROM public.orders WHERE id = _order_id;
  IF v_tenant IS NULL OR v_tenant <> v_owner_tenant THEN
    RETURN jsonb_build_object('ok', false, 'error', 'الطلب غير موجود أو ليس لمطعمك');
  END IF;
  IF v_status IN ('delivered','cancelled','rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'لا يمكن التحويل بعد إغلاق الطلب');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _new_driver_id AND role = 'driver' AND tenant_id = v_tenant
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'المندوب لا ينتمي لمطعمك');
  END IF;
  UPDATE public.orders SET driver_id = _new_driver_id, updated_at = now() WHERE id = _order_id;
  INSERT INTO public.order_driver_history (order_id, tenant_id, from_driver_id, to_driver_id, reason, changed_by)
    VALUES (_order_id, v_tenant, v_old, _new_driver_id, _reason, auth.uid());
  RETURN jsonb_build_object('ok', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.transfer_order_driver(uuid, uuid, text) TO authenticated;

-- 4) SETTLEMENTS
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_collected boolean NOT NULL DEFAULT false;
ALTER TABLE public.driver_settlements
  ADD COLUMN IF NOT EXISTS driver_note text,
  ADD COLUMN IF NOT EXISTS owner_note text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

DROP POLICY IF EXISTS "drivers create settlement request" ON public.driver_settlements;
CREATE POLICY "drivers create settlement request" ON public.driver_settlements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id AND status = 'pending_approval');

CREATE OR REPLACE FUNCTION public.driver_request_settlement(
  _tenant_id uuid, _amount_iqd int, _note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'driver' AND tenant_id = _tenant_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'لست مندوباً في هذا المطعم');
  END IF;
  IF _amount_iqd <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'المبلغ غير صحيح');
  END IF;
  INSERT INTO public.driver_settlements (tenant_id, driver_id, amount_iqd, status, driver_note)
    VALUES (_tenant_id, auth.uid(), _amount_iqd, 'pending_approval', _note)
    RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.driver_request_settlement(uuid, int, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_approve_settlement(
  _settlement_id uuid, _approve boolean, _note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; v_status settlement_status;
BEGIN
  SELECT tenant_id, status INTO v_tenant, v_status
    FROM public.driver_settlements WHERE id = _settlement_id;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'الطلب غير موجود');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'owner' AND tenant_id = v_tenant
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ليس لديك صلاحية');
  END IF;
  IF v_status <> 'pending_approval' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'هذا الطلب تم التعامل معه مسبقاً');
  END IF;
  UPDATE public.driver_settlements
    SET status = CASE WHEN _approve THEN 'approved'::settlement_status ELSE 'rejected'::settlement_status END,
        owner_note = _note, approved_by = auth.uid(), approved_at = now(),
        settled_at = CASE WHEN _approve THEN now() ELSE NULL END
    WHERE id = _settlement_id;
  RETURN jsonb_build_object('ok', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.owner_approve_settlement(uuid, boolean, text) TO authenticated;

-- 5) DRIVER HISTORY VIEW
CREATE OR REPLACE VIEW public.driver_orders_history_view
WITH (security_invoker = on) AS
SELECT
  o.id, o.order_number, o.tenant_id, o.branch_id, o.driver_id,
  o.status, o.total_iqd, o.delivery_fee_iqd, o.payment_method, o.payment_collected,
  o.created_at, o.delivered_at, o.updated_at,
  CASE WHEN o.delivered_at IS NOT NULL AND o.delivered_at < now() - interval '12 hours'
       THEN NULL ELSE o.customer_phone END AS customer_phone,
  CASE WHEN o.delivered_at IS NOT NULL AND o.delivered_at < now() - interval '12 hours'
       THEN NULL ELSE o.customer_address END AS customer_address,
  CASE WHEN o.delivered_at IS NOT NULL AND o.delivered_at < now() - interval '12 hours'
       THEN true ELSE false END AS pii_masked
FROM public.orders o
WHERE o.driver_id = auth.uid();
GRANT SELECT ON public.driver_orders_history_view TO authenticated;

-- 6) REALTIME (publication already includes orders; ensure full replica)
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- 7) REORDER
CREATE OR REPLACE FUNCTION public.reorder_from(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_items jsonb; v_tenant uuid; v_branch uuid; v_owner uuid;
BEGIN
  SELECT items, tenant_id, branch_id, customer_id INTO v_items, v_tenant, v_branch, v_owner
    FROM public.orders WHERE id = _order_id;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'هذا الطلب ليس لك');
  END IF;
  RETURN jsonb_build_object('ok', true, 'items', v_items, 'tenant_id', v_tenant, 'branch_id', v_branch);
END; $$;
GRANT EXECUTE ON FUNCTION public.reorder_from(uuid) TO authenticated;
