-- Accurate driver accounting, loyalty repair, and notification read state.
-- A settlement is allocated only up to its approved amount; it never clears
-- a driver's entire balance unless that amount actually covers it.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS driver_settled_iqd bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_distance_km double precision NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.driver_location_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS driver_location_points_driver_time_idx
  ON public.driver_location_points(driver_id, recorded_at DESC);
GRANT SELECT, INSERT ON public.driver_location_points TO authenticated;
GRANT ALL ON public.driver_location_points TO service_role;
ALTER TABLE public.driver_location_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers add their route points" ON public.driver_location_points
  FOR INSERT TO authenticated WITH CHECK (driver_id = auth.uid());
CREATE POLICY "drivers read their route points" ON public.driver_location_points
  FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "owners read tenant route points" ON public.driver_location_points
  FOR SELECT TO authenticated USING (tenant_id = public.owner_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

ALTER TABLE public.notification_queue ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE INDEX IF NOT EXISTS notification_queue_user_unread_idx
  ON public.notification_queue(user_id, created_at DESC) WHERE read_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_delivery_distance_on_delivered()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_lat double precision;
  v_lng double precision;
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered'
     AND NEW.delivery_lat IS NOT NULL AND NEW.delivery_lng IS NOT NULL
     AND NEW.branch_id IS NOT NULL THEN
    SELECT latitude, longitude INTO v_lat, v_lng
      FROM public.branches WHERE id = NEW.branch_id;
    IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
      NEW.delivery_distance_km := 6371 * acos(least(1.0, greatest(-1.0,
        cos(radians(v_lat)) * cos(radians(NEW.delivery_lat)) *
        cos(radians(NEW.delivery_lng) - radians(v_lng)) +
        sin(radians(v_lat)) * sin(radians(NEW.delivery_lat))
      )));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_delivery_distance_on_delivered ON public.orders;
CREATE TRIGGER trg_set_delivery_distance_on_delivered
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_delivery_distance_on_delivered();

CREATE OR REPLACE FUNCTION public.driver_delivery_summary(_tenant_id uuid)
RETURNS TABLE(
  delivered_orders bigint,
  delivery_distance_km double precision,
  cash_due_iqd bigint,
  delivery_earnings_iqd bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'driver' AND tenant_id = _tenant_id
  ) THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    COALESCE((
      SELECT SUM(
        CASE WHEN p.previous_lat IS NULL
                    OR p.recorded_at - p.previous_at > interval '15 minutes' THEN 0
             ELSE 6371 * acos(least(1.0, greatest(-1.0,
               cos(radians(p.previous_lat)) * cos(radians(p.lat)) *
               cos(radians(p.lng) - radians(p.previous_lng)) +
               sin(radians(p.previous_lat)) * sin(radians(p.lat))
             )))
        END
      )
      FROM (
        SELECT lat, lng, recorded_at,
          lag(lat) OVER (ORDER BY recorded_at) AS previous_lat,
          lag(lng) OVER (ORDER BY recorded_at) AS previous_lng,
          lag(recorded_at) OVER (ORDER BY recorded_at) AS previous_at
        FROM public.driver_location_points
        WHERE driver_id = auth.uid() AND tenant_id = _tenant_id
      ) p
    ), 0)::double precision,
    COALESCE(SUM(
      CASE WHEN o.payment_collected THEN 0
      ELSE GREATEST(0, (o.total_iqd - COALESCE(o.wallet_applied_iqd, 0) - o.delivery_fee_iqd) - o.driver_settled_iqd)
      END
    ), 0)::bigint,
    COALESCE(SUM(o.delivery_fee_iqd), 0)::bigint
  FROM public.orders o
  WHERE o.tenant_id = _tenant_id
    AND o.driver_id = auth.uid()
    AND o.status = 'delivered';
END;
$$;
GRANT EXECUTE ON FUNCTION public.driver_delivery_summary(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.driver_request_settlement(
  _tenant_id uuid, _amount_iqd int, _note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_due bigint;
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

  SELECT cash_due_iqd INTO v_due FROM public.driver_delivery_summary(_tenant_id);
  IF _amount_iqd > COALESCE(v_due, 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'المبلغ أكبر من ذمتك الحالية');
  END IF;

  INSERT INTO public.driver_settlements (tenant_id, driver_id, amount_iqd, status, driver_note)
  VALUES (_tenant_id, auth.uid(), _amount_iqd, 'pending_approval', _note)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.driver_request_settlement(uuid, int, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_approve_settlement(
  _settlement_id uuid, _approve boolean, _note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid; v_status settlement_status; v_driver uuid; v_remaining bigint;
  v_order record; v_due bigint; v_apply bigint;
BEGIN
  SELECT tenant_id, status, driver_id, amount_iqd
    INTO v_tenant, v_status, v_driver, v_remaining
    FROM public.driver_settlements WHERE id = _settlement_id FOR UPDATE;
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

  IF _approve THEN
    FOR v_order IN
      SELECT id, total_iqd, delivery_fee_iqd, wallet_applied_iqd, driver_settled_iqd
      FROM public.orders
      WHERE tenant_id = v_tenant AND driver_id = v_driver AND status = 'delivered'
        AND payment_collected = false
      ORDER BY delivered_at NULLS LAST, created_at, id
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_due := GREATEST(0, v_order.total_iqd - COALESCE(v_order.wallet_applied_iqd, 0)
        - v_order.delivery_fee_iqd - v_order.driver_settled_iqd);
      IF v_due <= 0 THEN CONTINUE; END IF;
      v_apply := LEAST(v_due, v_remaining);
      UPDATE public.orders
        SET driver_settled_iqd = driver_settled_iqd + v_apply,
            payment_collected = (driver_settled_iqd + v_apply >=
              GREATEST(0, total_iqd - COALESCE(wallet_applied_iqd, 0) - delivery_fee_iqd))
        WHERE id = v_order.id;
      v_remaining := v_remaining - v_apply;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('ok', true, 'unallocated_iqd', GREATEST(v_remaining, 0));
END;
$$;
GRANT EXECUTE ON FUNCTION public.owner_approve_settlement(uuid, boolean, text) TO authenticated;

-- The old first version referenced customer_user_id. Orders use customer_id.
CREATE OR REPLACE FUNCTION public.award_loyalty_on_delivered()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_enabled boolean; v_target int; v_reward_type text; v_reward_value int;
  v_delivered_count int; v_last_milestone int; v_new_milestone int; v_coupon_id uuid; v_code text;
BEGIN
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' OR NEW.customer_id IS NULL THEN RETURN NEW; END IF;
  SELECT loyalty_enabled, loyalty_target_orders, loyalty_reward_type, loyalty_reward_value_iqd
    INTO v_enabled, v_target, v_reward_type, v_reward_value FROM public.tenants WHERE id = NEW.tenant_id;
  IF NOT COALESCE(v_enabled, false) OR COALESCE(v_target, 0) <= 0 THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_delivered_count FROM public.orders
    WHERE tenant_id = NEW.tenant_id AND customer_id = NEW.customer_id AND status = 'delivered';
  v_new_milestone := v_delivered_count / v_target;
  SELECT COALESCE(MAX(milestone_number), 0) INTO v_last_milestone FROM public.loyalty_redemptions
    WHERE tenant_id = NEW.tenant_id AND user_id = NEW.customer_id;
  IF v_new_milestone <= v_last_milestone THEN RETURN NEW; END IF;
  IF v_reward_type = 'wallet_credit' THEN
    INSERT INTO public.wallet_transactions (user_id, tenant_id, amount_iqd, type, note)
    VALUES (NEW.customer_id, NEW.tenant_id, v_reward_value, 'credit', 'مكافأة ولاء');
  ELSIF v_reward_type IN ('discount','free_item') THEN
    v_code := 'LOYAL-' || substr(replace(NEW.customer_id::text,'-',''),1,6) || '-' || v_new_milestone::text;
    INSERT INTO public.coupons (tenant_id, code, discount_type, discount_value, min_order_iqd, usage_limit, used_count, is_active, assigned_user_id, is_loyalty_reward)
    VALUES (NEW.tenant_id, v_code, 'amount', v_reward_value, 0, 1, 0, true, NEW.customer_id, true)
    RETURNING id INTO v_coupon_id;
  END IF;
  INSERT INTO public.loyalty_redemptions (tenant_id, user_id, order_id, reward_type, reward_value_iqd, coupon_id, milestone_number)
  VALUES (NEW.tenant_id, NEW.customer_id, NEW.id, v_reward_type, v_reward_value, v_coupon_id, v_new_milestone);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_award_loyalty ON public.orders;
CREATE TRIGGER trg_award_loyalty AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.award_loyalty_on_delivered();
