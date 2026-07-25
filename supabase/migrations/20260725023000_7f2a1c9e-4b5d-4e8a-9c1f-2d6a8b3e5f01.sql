-- Fix: approving a driver settlement must zero the driver's cash debt.
-- Marks all uncollected delivered cash orders of that driver (same tenant)
-- as payment_collected = true when the owner approves the settlement.
CREATE OR REPLACE FUNCTION public.owner_approve_settlement(
  _settlement_id uuid, _approve boolean, _note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid; v_status settlement_status; v_driver uuid;
BEGIN
  SELECT tenant_id, status, driver_id INTO v_tenant, v_status, v_driver
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

  -- Zero the driver's cash debt for this tenant once the payment is approved
  IF _approve THEN
    UPDATE public.orders
      SET payment_collected = true
      WHERE tenant_id = v_tenant
        AND driver_id = v_driver
        AND status = 'delivered'
        AND payment_method = 'cash'
        AND payment_collected = false;
  END IF;

  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.owner_approve_settlement(uuid, boolean, text) TO authenticated;
