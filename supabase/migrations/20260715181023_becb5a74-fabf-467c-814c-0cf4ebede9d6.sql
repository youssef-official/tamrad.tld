
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_slug text;
  v_tenant uuid;
BEGIN
  v_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), split_part(NEW.email,'@',1), 'مطعمي');
  v_slug := regexp_replace(lower(coalesce(split_part(NEW.email,'@',1),'r')), '[^a-z0-9]+','-','g');
  v_slug := trim(both '-' from v_slug);
  IF v_slug = '' THEN v_slug := 'r'; END IF;
  v_slug := v_slug || '-' || substr(replace(NEW.id::text,'-',''),1,6);

  INSERT INTO public.tenants (name, slug)
  VALUES (v_name || ' - مطعم', v_slug)
  RETURNING id INTO v_tenant;

  INSERT INTO public.profiles (id, full_name, phone, tenant_id)
  VALUES (NEW.id, v_name, NEW.phone, v_tenant)
  ON CONFLICT (id) DO UPDATE SET tenant_id = COALESCE(public.profiles.tenant_id, EXCLUDED.tenant_id);

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (NEW.id, 'owner', v_tenant)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: any user without a tenant gets one + owner role
DO $$
DECLARE
  u record;
  v_slug text;
  v_tenant uuid;
  v_name text;
BEGIN
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data, au.phone
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE p.tenant_id IS NULL
  LOOP
    v_name := COALESCE(NULLIF(u.raw_user_meta_data->>'full_name',''), split_part(u.email,'@',1), 'مطعمي');
    v_slug := regexp_replace(lower(coalesce(split_part(u.email,'@',1),'r')), '[^a-z0-9]+','-','g');
    v_slug := trim(both '-' from v_slug);
    IF v_slug = '' THEN v_slug := 'r'; END IF;
    v_slug := v_slug || '-' || substr(replace(u.id::text,'-',''),1,6);

    INSERT INTO public.tenants (name, slug) VALUES (v_name || ' - مطعم', v_slug)
    RETURNING id INTO v_tenant;

    INSERT INTO public.profiles (id, full_name, phone, tenant_id)
    VALUES (u.id, v_name, u.phone, v_tenant)
    ON CONFLICT (id) DO UPDATE SET tenant_id = v_tenant;

    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (u.id, 'owner', v_tenant)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
