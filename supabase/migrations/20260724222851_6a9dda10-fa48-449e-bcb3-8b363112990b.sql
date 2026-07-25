
CREATE TABLE public.customer_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'المنزل',
  full_address TEXT NOT NULL,
  city TEXT,
  notes TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX customer_addresses_user_idx ON public.customer_addresses(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own addresses select" ON public.customer_addresses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own addresses insert" ON public.customer_addresses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own addresses update" ON public.customer_addresses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own addresses delete" ON public.customer_addresses
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER customer_addresses_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ensure only one default address per user
CREATE OR REPLACE FUNCTION public.enforce_single_default_address()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.customer_addresses
       SET is_default = false
     WHERE user_id = NEW.user_id AND id <> NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER customer_addresses_single_default
  AFTER INSERT OR UPDATE OF is_default ON public.customer_addresses
  FOR EACH ROW WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.enforce_single_default_address();
