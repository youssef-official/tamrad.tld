REVOKE INSERT, UPDATE, DELETE ON public.branches FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_owner_restaurant() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_owner_restaurant() FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_owner_restaurant() TO authenticated;