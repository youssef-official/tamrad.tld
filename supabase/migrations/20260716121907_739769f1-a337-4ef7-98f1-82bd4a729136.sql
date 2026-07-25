-- Subscription fields on tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS monthly_fee_iqd bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_notes text;

-- Allow super admin to read every profile (for admin users management page)
DROP POLICY IF EXISTS "Super admin view all profiles" ON public.profiles;
CREATE POLICY "Super admin view all profiles" ON public.profiles
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Allow super admin to see inactive branches too
DROP POLICY IF EXISTS "Super admin view all branches" ON public.branches;
CREATE POLICY "Super admin view all branches" ON public.branches
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));
