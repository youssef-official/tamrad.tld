-- ============================================================
-- Wallet partial payment
-- A customer can now apply ANY available wallet balance to an
-- order (previously all-or-nothing) and pay the remainder in
-- cash on delivery.
-- Adds: orders.wallet_applied_iqd, partial-aware debit RPC,
-- refund resets the applied amount, driver view exposes it.
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS wallet_applied_iqd bigint NOT NULL DEFAULT 0
  CHECK (wallet_applied_iqd >= 0);

-- ============================================================
-- 1) pay_order_with_wallet(p_order_id) — partial-aware
--    Debits LEAST(balance, total). Only fails when balance is 0.
--    payment_collected = true only when the wallet covers the
--    full total; otherwise the cash remainder is collected on
--    delivery (tracked via payment_collected = false).
-- ============================================================
CREATE OR REPLACE FUNCTION public.pay_order_with_wallet(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id uuid;
  v_tenant_id   uuid;
  v_total       bigint;
  v_paymethod   public.payment_method;
  v_balance     integer;
  v_debited     boolean;
  v_apply       bigint;
BEGIN
  -- Lock the order row to serialize concurrent payments for the same order
  SELECT customer_id, tenant_id, total_iqd, payment_method
    INTO v_customer_id, v_tenant_id, v_total, v_paymethod
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF v_paymethod <> 'wallet' THEN
    RETURN 'not_wallet';
  END IF;

  -- Already debited for this order? -> idempotent success
  SELECT EXISTS (
    SELECT 1 FROM public.wallet_transactions
      WHERE order_id = p_order_id AND type = 'debit'
  ) INTO v_debited;

  IF v_debited THEN
    RETURN 'already_paid';
  END IF;

  -- Lock this customer's wallet rows to prevent concurrent double-spend
  PERFORM 1 FROM public.wallet_transactions
    WHERE tenant_id = v_tenant_id AND user_id = v_customer_id
    FOR UPDATE;

  v_balance := public.get_wallet_balance(v_tenant_id, v_customer_id);
  v_apply   := LEAST(v_balance, v_total);

  IF v_apply <= 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: available %, required %', v_balance, v_total;
  END IF;

  INSERT INTO public.wallet_transactions (user_id, tenant_id, amount_iqd, type, order_id, note)
    VALUES (v_customer_id, v_tenant_id, v_apply, 'debit', p_order_id,
            'دفع طلب #' || (SELECT order_number FROM public.orders WHERE id = p_order_id));

  UPDATE public.orders
    SET wallet_applied_iqd = v_apply,
        payment_collected  = (v_apply >= v_total)
    WHERE id = p_order_id;

  RETURN CASE WHEN v_apply >= v_total THEN 'paid' ELSE 'paid_partial' END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_order_with_wallet(uuid) TO authenticated;

-- ============================================================
-- 2) refund_wallet_on_cancel() — refund the actual debit (full
--    or partial) and reset wallet_applied_iqd / payment_collected.
-- ============================================================
CREATE OR REPLACE FUNCTION public.refund_wallet_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_debit_amount integer;
  v_customer_id  uuid;
  v_tenant_id    uuid;
  v_already_refunded boolean;
BEGIN
  -- Only on transition INTO cancelled/rejected
  IF NEW.status NOT IN ('cancelled','rejected') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('cancelled','rejected') THEN
    RETURN NEW;  -- was already in a terminal-bad state
  END IF;
  IF NEW.payment_method <> 'wallet' THEN
    RETURN NEW;
  END IF;

  -- Find the original debit
  SELECT amount_iqd, user_id, tenant_id
    INTO v_debit_amount, v_customer_id, v_tenant_id
    FROM public.wallet_transactions
    WHERE order_id = NEW.id AND type = 'debit'
    LIMIT 1;

  IF v_debit_amount IS NULL THEN
    RETURN NEW;  -- never actually debited (e.g. order cancelled before payment)
  END IF;

  -- Guard against double refund
  SELECT EXISTS (
    SELECT 1 FROM public.wallet_transactions
      WHERE order_id = NEW.id AND type = 'credit'
        AND note ILIKE 'استرجاع%'
  ) INTO v_already_refunded;

  IF v_already_refunded THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.wallet_transactions (user_id, tenant_id, amount_iqd, type, order_id, note)
    VALUES (v_customer_id, v_tenant_id, v_debit_amount, 'credit', NEW.id,
            'استرجاع طلب #' || NEW.order_number);

  UPDATE public.orders
    SET payment_collected = false, wallet_applied_iqd = 0
    WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3) driver_orders_history_view — expose wallet_applied_iqd so the
--    driver's cash-debt panel can subtract the prepaid wallet part.
-- ============================================================
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
       THEN true ELSE false END AS pii_masked,
  o.wallet_applied_iqd
FROM public.orders o
WHERE o.driver_id = auth.uid();

GRANT SELECT ON public.driver_orders_history_view TO authenticated;
