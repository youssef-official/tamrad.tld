-- Let the CUSTOMER see who delivers their order (name only, privacy-safe)
-- plus whether the order was transferred from another driver.
-- SECURITY DEFINER so RLS on profiles/history stays intact for everything else.
CREATE OR REPLACE FUNCTION public.get_order_driver_info(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_driver_name text;
  v_transfer RECORD;
BEGIN
  SELECT id, customer_id, driver_id INTO v_order
  FROM public.orders WHERE id = _order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'الطلب غير موجود');
  END IF;

  -- Only the customer who owns this order may read the driver info
  IF v_order.customer_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'غير مصرح');
  END IF;

  IF v_order.driver_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'driver_name', null, 'transferred', false);
  END IF;

  SELECT full_name INTO v_driver_name FROM public.profiles WHERE id = v_order.driver_id;

  SELECT p.full_name AS to_name, h.created_at
    INTO v_transfer
  FROM public.order_driver_history h
  LEFT JOIN public.profiles p ON p.id = h.to_driver_id
  WHERE h.order_id = _order_id
  ORDER BY h.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'driver_name', COALESCE(NULLIF(v_driver_name, ''), 'المندوب'),
    'transferred', v_transfer.to_name IS NOT NULL,
    'transferred_at', v_transfer.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_driver_info(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_driver_info(uuid) TO authenticated;
