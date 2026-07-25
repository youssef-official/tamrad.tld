-- Per-tenant customer membership.
-- A user who signs up / orders from restaurant A's storefront is registered
-- as a customer OF THAT TENANT (user_roles row with role='customer' + tenant_id).
-- Visiting restaurant B later auto-registers a separate membership there,
-- so each restaurant has its own isolated customer base (loyalty/wallet/orders
-- are already tenant-scoped).
CREATE OR REPLACE FUNCTION public.ensure_customer_membership(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'تسجيل الدخول مطلوب');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id AND is_active) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'المطعم غير متاح');
  END IF;

  -- NOTE: intentionally NOT touching profiles.tenant_id — RLS helper
  -- user_tenant_id() reads it, and setting it for a customer would grant
  -- owner-level access to this tenant's data.
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (auth.uid(), 'customer', _tenant_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_customer_membership(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_customer_membership(uuid) TO authenticated;
