
CREATE OR REPLACE FUNCTION public.owner_tenant_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.user_roles
  WHERE user_id = _user_id AND role = 'owner' LIMIT 1;
$$;

DROP POLICY IF EXISTS "Owners view tenant drivers roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users read their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;

CREATE POLICY "Users read own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "Owners view tenant drivers roles" ON public.user_roles
FOR SELECT TO authenticated
USING (role = 'driver'::app_role AND tenant_id = public.owner_tenant_id(auth.uid()));
