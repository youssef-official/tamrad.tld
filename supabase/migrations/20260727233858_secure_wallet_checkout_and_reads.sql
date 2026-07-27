-- Wallet balances are isolated by restaurant and visible only to their owner.
CREATE OR REPLACE FUNCTION public.get_wallet_balance(_tenant_id uuid, _user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'غير مصرح بقراءة رصيد هذه المحفظة';
  END IF;

  RETURN COALESCE((
    SELECT SUM(CASE WHEN type = 'credit' THEN amount_iqd ELSE -amount_iqd END)
    FROM public.wallet_transactions
    WHERE tenant_id = _tenant_id AND user_id = _user_id
  ), 0)::integer;
END;
$$;

REVOKE ALL ON FUNCTION public.get_wallet_balance(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_wallet_balance(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_wallet_balance(uuid, uuid) TO authenticated;

-- Debit is atomic: the order and this restaurant's wallet balance are locked
-- before a transaction is created. A customer can pay only their own order.
CREATE OR REPLACE FUNCTION public.pay_order_with_wallet(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id uuid;
  v_tenant_id uuid;
  v_total bigint;
  v_payment_method public.payment_method;
  v_balance integer;
  v_apply bigint;
BEGIN
  SELECT customer_id, tenant_id, total_iqd, payment_method
  INTO v_customer_id, v_tenant_id, v_total, v_payment_method
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;
  IF v_customer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'غير مصرح بدفع هذا الطلب';
  END IF;
  IF v_payment_method <> 'wallet' THEN
    RETURN 'not_wallet';
  END IF;
  IF EXISTS (SELECT 1 FROM public.wallet_transactions WHERE order_id = p_order_id AND type = 'debit') THEN
    RETURN 'already_paid';
  END IF;

  PERFORM 1 FROM public.wallet_transactions
  WHERE tenant_id = v_tenant_id AND user_id = v_customer_id
  FOR UPDATE;

  v_balance := public.get_wallet_balance(v_tenant_id, v_customer_id);
  v_apply := LEAST(v_balance, v_total);
  IF v_apply <= 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: الرصيد المتاح % د.ع', v_balance;
  END IF;

  INSERT INTO public.wallet_transactions (user_id, tenant_id, amount_iqd, type, order_id, note)
  VALUES (v_customer_id, v_tenant_id, v_apply, 'debit', p_order_id,
          'دفع طلب #' || (SELECT order_number FROM public.orders WHERE id = p_order_id));

  UPDATE public.orders
  SET wallet_applied_iqd = v_apply,
      payment_collected = (v_apply >= v_total)
  WHERE id = p_order_id;

  RETURN CASE WHEN v_apply >= v_total THEN 'paid' ELSE 'paid_partial' END;
END;
$$;

REVOKE ALL ON FUNCTION public.pay_order_with_wallet(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pay_order_with_wallet(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.pay_order_with_wallet(uuid) TO authenticated;
