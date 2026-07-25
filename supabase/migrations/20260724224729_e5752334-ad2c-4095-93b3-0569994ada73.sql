CREATE OR REPLACE FUNCTION public.ensure_owner_restaurant()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_tenant_slug text;
  v_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'تسجيل الدخول مطلوب');
  END IF;

  SELECT tenant_id INTO v_tenant_id
  FROM public.user_roles
  WHERE user_id = v_user_id AND role = 'owner' AND tenant_id IS NOT NULL
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    SELECT tenant_id INTO v_tenant_id
    FROM public.profiles
    WHERE id = v_user_id AND tenant_id IS NOT NULL
    LIMIT 1;
  END IF;

  IF v_tenant_id IS NULL THEN
    SELECT COALESCE(NULLIF(full_name, ''), 'مطعمي') INTO v_name
    FROM public.profiles
    WHERE id = v_user_id;

    v_name := COALESCE(v_name, 'مطعمي');
    v_tenant_slug := 'r-' || substr(replace(v_user_id::text, '-', ''), 1, 10);

    INSERT INTO public.tenants (name, slug)
    VALUES (v_name || ' - مطعم', v_tenant_slug)
    ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
    RETURNING id INTO v_tenant_id;
  END IF;

  INSERT INTO public.profiles (id, tenant_id, full_name)
  VALUES (v_user_id, v_tenant_id, 'صاحب المطعم')
  ON CONFLICT (id) DO UPDATE
  SET tenant_id = COALESCE(public.profiles.tenant_id, EXCLUDED.tenant_id),
      updated_at = now();

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (v_user_id, 'owner', v_tenant_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.branches (tenant_id, name, slug, is_active)
  VALUES (v_tenant_id, 'الفرع الرئيسي', 'main', true)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'tenant_id', v_tenant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_owner_restaurant() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_owner_restaurant() TO authenticated;