
CREATE TABLE IF NOT EXISTS public.driver_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  driver_name text NOT NULL,
  driver_phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_credentials TO authenticated;
GRANT ALL ON public.driver_credentials TO service_role;

ALTER TABLE public.driver_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their tenant drivers creds"
  ON public.driver_credentials
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'owner'))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'owner'));

CREATE POLICY "Drivers view own creds"
  ON public.driver_credentials
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER set_driver_creds_updated_at
  BEFORE UPDATE ON public.driver_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
