-- منصة تمراد لديها باقة شهرية واحدة؛ يظل السعر قابلاً للتخصيص أو الخصم لكل مطعم.
ALTER TABLE public.tenants
  ALTER COLUMN subscription_plan SET DEFAULT 'monthly',
  ALTER COLUMN monthly_fee_iqd SET DEFAULT 400000;

UPDATE public.tenants
SET subscription_plan = 'monthly'
WHERE subscription_plan IS DISTINCT FROM 'monthly';

UPDATE public.tenants
SET monthly_fee_iqd = 400000
WHERE monthly_fee_iqd = 0;

ALTER TABLE public.subscription_renewals
  DROP CONSTRAINT IF EXISTS subscription_renewals_duration_months_check;
ALTER TABLE public.subscription_renewals
  ADD CONSTRAINT subscription_renewals_duration_months_check
  CHECK (duration_months BETWEEN 1 AND 12);

CREATE OR REPLACE FUNCTION public.is_tenant_publicly_available(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = _tenant_id
      AND t.is_active
      AND t.subscription_status = 'active'
      AND (
        t.subscription_expires_at IS NULL
        OR t.subscription_expires_at >= now() - interval '7 days'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_tenant_publicly_available(uuid) FROM PUBLIC, anon, authenticated;

-- Remove the old generic policy so an expired restaurant cannot stay visible through it.
DROP POLICY IF EXISTS "Anyone can view active tenants" ON public.tenants;
DROP POLICY IF EXISTS "Authenticated read tenants" ON public.tenants;
DROP POLICY IF EXISTS "Public reads subscription eligible tenants" ON public.tenants;
DROP POLICY IF EXISTS "Authenticated reads available or managed tenants" ON public.tenants;
CREATE POLICY "Public reads subscription eligible tenants"
  ON public.tenants FOR SELECT TO anon
  USING (
    is_active
    AND subscription_status = 'active'
    AND (subscription_expires_at IS NULL OR subscription_expires_at >= now() - interval '7 days')
  );
CREATE POLICY "Authenticated reads available or managed tenants"
  ON public.tenants FOR SELECT TO authenticated
  USING (
    (
      is_active
      AND subscription_status = 'active'
      AND (subscription_expires_at IS NULL OR subscription_expires_at >= now() - interval '7 days')
    )
    OR id = public.owner_tenant_id(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.reject_orders_from_locked_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_tenant_publicly_available(NEW.tenant_id) THEN
    RAISE EXCEPTION 'اشتراك المطعم متوقف أو انتهت مهلة التجديد';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_orders_from_locked_subscription() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reject_orders_from_locked_subscription ON public.orders;
CREATE TRIGGER trg_reject_orders_from_locked_subscription
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.reject_orders_from_locked_subscription();

CREATE OR REPLACE FUNCTION public.activate_subscription(
  _tenant_id uuid,
  _receipt_path text,
  _months integer,
  _paid_amount_iqd integer DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_previous_expires_at timestamptz;
  v_new_expires_at timestamptz;
  v_tenant_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'غير مسموح بتفعيل الاشتراك';
  END IF;
  IF _months NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'مدة التجديد يجب أن تكون من شهر إلى 12 شهراً';
  END IF;
  IF _receipt_path IS NULL OR _receipt_path !~ ('^' || _tenant_id::text || '/') THEN
    RAISE EXCEPTION 'مسار وصل التحويل غير صالح';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'subscription-receipts' AND name = _receipt_path
  ) THEN
    RAISE EXCEPTION 'ارفق وصل التحويل أولاً';
  END IF;

  SELECT subscription_expires_at, name
    INTO v_previous_expires_at, v_tenant_name
  FROM public.tenants
  WHERE id = _tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المطعم غير موجود'; END IF;

  v_new_expires_at := GREATEST(COALESCE(v_previous_expires_at, now()), now())
    + make_interval(months => _months);

  UPDATE public.tenants
  SET subscription_plan = 'monthly',
      subscription_status = 'active',
      is_active = true,
      subscription_started_at = now(),
      subscription_expires_at = v_new_expires_at,
      subscription_notes = NULLIF(trim(_note), '')
  WHERE id = _tenant_id;

  INSERT INTO public.subscription_renewals (
    tenant_id, duration_months, receipt_path, paid_amount_iqd, note,
    previous_expires_at, new_expires_at, activated_by
  ) VALUES (
    _tenant_id, _months, _receipt_path, _paid_amount_iqd, NULLIF(trim(_note), ''),
    v_previous_expires_at, v_new_expires_at, auth.uid()
  );

  INSERT INTO public.notification_queue (user_id, tenant_id, title, body, data)
  SELECT ur.user_id, _tenant_id,
         'تم تفعيل اشتراك المطعم',
         'اشتراك «' || v_tenant_name || '» فعّال حتى ' || to_char(v_new_expires_at, 'YYYY-MM-DD') || '.',
         jsonb_build_object('type', 'subscription_renewed', 'url', '/dashboard')
  FROM public.user_roles ur
  WHERE ur.tenant_id = _tenant_id AND ur.role = 'owner';

  RETURN jsonb_build_object('ok', true, 'expires_at', v_new_expires_at, 'months', _months);
END;
$$;
REVOKE ALL ON FUNCTION public.activate_subscription(uuid, text, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_subscription(uuid, text, integer, integer, text) TO authenticated;
