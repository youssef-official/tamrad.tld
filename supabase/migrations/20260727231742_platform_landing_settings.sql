-- One public, singleton setting powers the social-proof count on the landing page.
CREATE TABLE IF NOT EXISTS public.platform_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  restaurant_count integer NOT NULL DEFAULT 120 CHECK (restaurant_count >= 0 AND restaurant_count <= 1000000),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Super admins update platform settings"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING ((select public.is_super_admin(auth.uid())))
  WITH CHECK ((select public.is_super_admin(auth.uid())));

INSERT INTO public.platform_settings (singleton, restaurant_count)
VALUES (true, 120)
ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_platform_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_platform_settings_updated_at ON public.platform_settings;
CREATE TRIGGER set_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_platform_settings_updated_at();
