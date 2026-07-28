-- الاشتراكات شهرية فقط وتُفعَّل من لوحة السوبر أدمن مع الاحتفاظ بوصل التحويل.
CREATE TABLE IF NOT EXISTS public.subscription_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  duration_months smallint NOT NULL DEFAULT 1 CHECK (duration_months = 1),
  receipt_path text NOT NULL,
  paid_amount_iqd integer CHECK (paid_amount_iqd IS NULL OR paid_amount_iqd >= 0),
  note text,
  previous_expires_at timestamptz,
  new_expires_at timestamptz NOT NULL,
  activated_by uuid NOT NULL REFERENCES auth.users(id),
  activated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_renewals_tenant_activated_idx
  ON public.subscription_renewals (tenant_id, activated_at DESC);

ALTER TABLE public.subscription_renewals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.subscription_renewals TO authenticated;

DROP POLICY IF EXISTS "Super admins read subscription renewals" ON public.subscription_renewals;
CREATE POLICY "Super admins read subscription renewals"
  ON public.subscription_renewals
  FOR SELECT TO authenticated
  USING ((SELECT public.is_super_admin(auth.uid())));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'subscription-receipts',
  'subscription-receipts',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Super admins upload subscription receipts" ON storage.objects;
CREATE POLICY "Super admins upload subscription receipts"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'subscription-receipts'
    AND (SELECT public.is_super_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Super admins read subscription receipts" ON storage.objects;
CREATE POLICY "Super admins read subscription receipts"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'subscription-receipts'
    AND (SELECT public.is_super_admin(auth.uid()))
  );

CREATE OR REPLACE FUNCTION public.activate_monthly_subscription(
  _tenant_id uuid,
  _receipt_path text,
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'المطعم غير موجود';
  END IF;

  v_new_expires_at := GREATEST(COALESCE(v_previous_expires_at, now()), now()) + interval '1 month';

  UPDATE public.tenants
  SET subscription_plan = 'monthly',
      subscription_status = 'active',
      subscription_started_at = now(),
      subscription_expires_at = v_new_expires_at,
      subscription_notes = NULLIF(trim(_note), '')
  WHERE id = _tenant_id;

  INSERT INTO public.subscription_renewals (
    tenant_id, receipt_path, paid_amount_iqd, note,
    previous_expires_at, new_expires_at, activated_by
  ) VALUES (
    _tenant_id, _receipt_path, _paid_amount_iqd, NULLIF(trim(_note), ''),
    v_previous_expires_at, v_new_expires_at, auth.uid()
  );

  INSERT INTO public.notification_queue (user_id, tenant_id, title, body, data)
  SELECT ur.user_id,
         _tenant_id,
         'تم تجديد اشتراك مطعمك ✅',
         'اشتراك «' || v_tenant_name || '» فعّال حتى ' || to_char(v_new_expires_at, 'YYYY-MM-DD') || '.',
         jsonb_build_object('type', 'subscription_renewed', 'url', '/dashboard')
  FROM public.user_roles ur
  WHERE ur.tenant_id = _tenant_id AND ur.role = 'owner';

  RETURN jsonb_build_object('ok', true, 'expires_at', v_new_expires_at, 'duration_months', 1);
END;
$$;

REVOKE ALL ON FUNCTION public.activate_monthly_subscription(uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_monthly_subscription(uuid, text, integer, text) TO authenticated;
