-- Keep a safe, admin-visible email for each profile and restaurant owner.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS is_admin_provisioned boolean NOT NULL DEFAULT false;

-- Backfill emails from the protected auth schema. This runs as part of the migration only.
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id AND p.email IS NULL;

UPDATE public.tenants t
SET owner_email = au.email
FROM public.user_roles ur
JOIN auth.users au ON au.id = ur.user_id
WHERE ur.tenant_id = t.id
  AND ur.role = 'owner'
  AND t.owner_email IS NULL;

-- Restaurants created before this workflow are retained unless they match the legacy
-- auto-generated name pattern. Legacy records are disabled and hidden from administration.
UPDATE public.tenants
SET is_admin_provisioned = true
WHERE name !~ ' - مطعم$';

-- Convert every legacy auto-created owner back into a normal customer account.
WITH legacy_owners AS (
  SELECT DISTINCT ur.user_id, ur.tenant_id
  FROM public.user_roles ur
  JOIN public.tenants t ON t.id = ur.tenant_id
  WHERE ur.role = 'owner' AND t.name ~ ' - مطعم$'
)
UPDATE public.profiles p
SET tenant_id = NULL
FROM legacy_owners lo
WHERE p.id = lo.user_id AND p.tenant_id = lo.tenant_id;

DELETE FROM public.user_roles ur
USING public.tenants t
WHERE ur.tenant_id = t.id
  AND ur.role = 'owner'
  AND t.name ~ ' - مطعم$';

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'customer'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.id AND ur.role = 'customer'
);

UPDATE public.tenants
SET is_active = false
WHERE name ~ ' - مطعم$' AND is_admin_provisioned = false;

-- New public accounts are customers only, and their email remains visible to the super admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NEW.phone,
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
