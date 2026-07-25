
-- Add items detail to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Super admin can manage user_roles
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin manages roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Super admin can update profiles (to assign tenant)
CREATE POLICY "Super admin updates profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Drivers can see unassigned pending orders in their tenant
CREATE POLICY "Drivers see available orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    driver_id IS NULL
    AND status IN ('pending','accepted','preparing')
    AND public.has_role(auth.uid(), 'driver')
    AND tenant_id = public.user_tenant_id(auth.uid())
  );

-- Drivers can claim an unassigned order (assign themselves)
CREATE POLICY "Drivers claim orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    driver_id IS NULL
    AND public.has_role(auth.uid(), 'driver')
    AND tenant_id = public.user_tenant_id(auth.uid())
  )
  WITH CHECK (driver_id = auth.uid());
