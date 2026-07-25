DROP POLICY IF EXISTS "Owners manage own branches" ON public.branches;
CREATE POLICY "Owners manage own branches" ON public.branches
  FOR ALL TO authenticated
  USING (tenant_id = public.owner_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.owner_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Backfill profile tenant_id from user_roles for owners missing it
UPDATE public.profiles p
SET tenant_id = ur.tenant_id
FROM public.user_roles ur
WHERE ur.user_id = p.id AND ur.role = 'owner' AND p.tenant_id IS NULL;