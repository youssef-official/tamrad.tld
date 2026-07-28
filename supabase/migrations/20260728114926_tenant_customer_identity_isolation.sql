-- A single secure Auth account may join any number of storefronts, while each
-- restaurant owns a separate customer record, contact details and addresses.
CREATE TABLE IF NOT EXISTS public.tenant_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS tenant_customers_tenant_user_idx ON public.tenant_customers (tenant_id, user_id);
ALTER TABLE public.tenant_customers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.tenant_customers TO authenticated;

DROP POLICY IF EXISTS "Customers manage their own tenant profile" ON public.tenant_customers;
DROP POLICY IF EXISTS "Owners read their tenant customers" ON public.tenant_customers;
CREATE POLICY "Customers manage their own tenant profile"
  ON public.tenant_customers FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners read their tenant customers"
  ON public.tenant_customers FOR SELECT TO authenticated
  USING (tenant_id = public.owner_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
DROP TRIGGER IF EXISTS tenant_customers_set_updated_at ON public.tenant_customers;
CREATE TRIGGER tenant_customers_set_updated_at
  BEFORE UPDATE ON public.tenant_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.tenant_customers (tenant_id, user_id, full_name, phone, email)
SELECT DISTINCT ON (o.tenant_id, o.customer_id)
  o.tenant_id,
  o.customer_id,
  p.full_name,
  COALESCE(o.customer_phone, p.phone),
  p.email
FROM public.orders o
LEFT JOIN public.profiles p ON p.id = o.customer_id
WHERE o.customer_id IS NOT NULL
ORDER BY o.tenant_id, o.customer_id, o.created_at DESC
ON CONFLICT (tenant_id, user_id) DO NOTHING;

ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS customer_addresses_tenant_user_idx
  ON public.customer_addresses (tenant_id, user_id, is_default DESC, created_at);

CREATE OR REPLACE FUNCTION public.enforce_single_default_address()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.customer_addresses
       SET is_default = false
     WHERE user_id = NEW.user_id
       AND tenant_id IS NOT DISTINCT FROM NEW.tenant_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.ensure_customer_membership(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_name text;
  v_phone text;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'تسجيل الدخول مطلوب');
  END IF;
  IF NOT public.is_tenant_publicly_available(_tenant_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'المطعم غير متاح');
  END IF;

  SELECT full_name, phone, email INTO v_name, v_phone, v_email
  FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (auth.uid(), 'customer', _tenant_id)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.tenant_customers (tenant_id, user_id, full_name, phone, email)
  VALUES (_tenant_id, auth.uid(), v_name, v_phone, v_email)
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_customer_membership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_customer_membership(uuid) TO authenticated;
