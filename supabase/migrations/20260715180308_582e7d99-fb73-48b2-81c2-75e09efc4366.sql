-- 1) branches table
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  address text,
  phone text,
  city text,
  latitude double precision,
  longitude double precision,
  manager_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT SELECT ON public.branches TO anon;
GRANT ALL ON public.branches TO service_role;

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Public can view active branches (for customer app)
CREATE POLICY "Public reads active branches"
ON public.branches FOR SELECT
USING (is_active = true);

-- Tenant owners manage their branches
CREATE POLICY "Owners manage own branches"
ON public.branches FOR ALL
TO authenticated
USING (
  tenant_id = public.user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  tenant_id = public.user_tenant_id(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE TRIGGER set_branches_updated_at
BEFORE UPDATE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX branches_tenant_idx ON public.branches(tenant_id);

-- 2) Link menu_items and orders to branches (optional)
ALTER TABLE public.menu_items ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX menu_items_branch_idx ON public.menu_items(branch_id);

ALTER TABLE public.orders ADD COLUMN branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
CREATE INDEX orders_branch_idx ON public.orders(branch_id);