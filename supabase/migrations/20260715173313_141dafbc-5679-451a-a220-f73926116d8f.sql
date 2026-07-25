
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_tenant_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_tenant_id(uuid) TO authenticated;

-- The tenant SELECT policy for anon needs is_super_admin() — rewrite to avoid that call for anon.
DROP POLICY IF EXISTS "Anyone can view active tenants" ON public.tenants;
CREATE POLICY "Public reads active tenants" ON public.tenants FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "Authenticated read tenants" ON public.tenants FOR SELECT TO authenticated USING (is_active = true OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Public read categories of active tenants" ON public.menu_categories;
CREATE POLICY "Public read categories" ON public.menu_categories FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "Auth read categories" ON public.menu_categories FOR SELECT TO authenticated USING (is_active = true OR tenant_id = public.user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Public read active menu items" ON public.menu_items;
CREATE POLICY "Public read items" ON public.menu_items FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "Auth read items" ON public.menu_items FOR SELECT TO authenticated USING (is_active = true OR tenant_id = public.user_tenant_id(auth.uid()));
