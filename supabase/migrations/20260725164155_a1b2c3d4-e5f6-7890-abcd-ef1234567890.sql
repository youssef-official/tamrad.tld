-- ============================================================
-- Wallet payment at checkout
-- Adds: atomic debit RPC, refund-on-cancel trigger, balance RPC, index
-- ============================================================

-- Index to make per-tenant balance computation fast as data grows
CREATE INDEX IF NOT EXISTS wallet_txn_user_tenant_idx
  ON public.wallet_transactions (user_id, tenant_id, type);

-- ============================================================
-- 1) get_wallet_balance(_tenant_id, _user_id)
--    Authoritative per-tenant balance for a customer:
--      SUM(credits) - SUM(debits)  (>= 0 logically, but returns negatives if data drift exists)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_wallet_balance(_tenant_id uuid, _user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT SUM(amount_iqd) FROM public.wallet_transactions
       WHERE tenant_id = _tenant_id AND user_id = _user_id AND type = 'credit')
    -
    (SELECT SUM(amount_iqd) FROM public.wallet_transactions
       WHERE tenant_id = _tenant_id AND user_id = _user_id AND type = 'debit'),
    0)::integer;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_balance(uuid, uuid) TO authenticated, anon;

-- ============================================================
-- 2) pay_order_with_wallet(p_order_id)
--    Atomically debits the order total from the customer's wallet balance.
--    Idempotent: safe to call twice (second call is a no-op).
--    Returns a JSON-ish text status for easy client handling.
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

  IF v_balance < v_total THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: available %, required %', v_balance, v_total;
  END IF;

  INSERT INTO public.wallet_transactions (user_id, tenant_id, amount_iqd, type, order_id, note)
    VALUES (v_customer_id, v_tenant_id, v_total, 'debit', p_order_id,
            'دفع طلب #' || (SELECT order_number FROM public.orders WHERE id = p_order_id));

  UPDATE public.orders SET payment_collected = true WHERE id = p_order_id;

  RETURN 'paid';
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_order_with_wallet(uuid) TO authenticated;

-- ============================================================
-- 3) refund_wallet_on_cancel() — trigger AFTER UPDATE on orders
--    When an order's status becomes 'cancelled' or 'rejected',
--    and it was paid via wallet (a debit exists), refund once.
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

  UPDATE public.orders SET payment_collected = false WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refund_wallet_on_cancel ON public.orders;
CREATE TRIGGER trg_refund_wallet_on_cancel
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.refund_wallet_on_cancel();
