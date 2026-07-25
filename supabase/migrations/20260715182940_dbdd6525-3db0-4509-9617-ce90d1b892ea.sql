
DROP POLICY IF EXISTS "Public read restaurant images" ON storage.objects;
CREATE POLICY "Public read restaurant images" ON storage.objects
  FOR SELECT USING (bucket_id = 'restaurant-images');

DROP POLICY IF EXISTS "Tenant members upload images" ON storage.objects;
CREATE POLICY "Tenant members upload images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-images'
    AND (storage.foldername(name))[1] = (SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Tenant members update images" ON storage.objects;
CREATE POLICY "Tenant members update images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'restaurant-images'
    AND (storage.foldername(name))[1] = (SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Tenant members delete images" ON storage.objects;
CREATE POLICY "Tenant members delete images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'restaurant-images'
    AND (storage.foldername(name))[1] = (SELECT tenant_id::text FROM public.profiles WHERE id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.add_driver_to_tenant(_phone text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tenant uuid; v_user uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'owner' LIMIT 1;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ليس لديك صلاحية');
  END IF;
  SELECT id INTO v_user FROM auth.users WHERE phone = _phone LIMIT 1;
  IF v_user IS NULL THEN
    SELECT p.id INTO v_user FROM public.profiles p WHERE p.phone = _phone LIMIT 1;
  END IF;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'لا يوجد مستخدم بهذا الرقم. اطلب منه إنشاء حساب أولاً.');
  END IF;
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (v_user, 'driver', v_tenant)
  ON CONFLICT DO NOTHING;
  UPDATE public.profiles SET tenant_id = COALESCE(tenant_id, v_tenant) WHERE id = v_user;
  RETURN jsonb_build_object('ok', true, 'user_id', v_user);
END; $$;

GRANT EXECUTE ON FUNCTION public.add_driver_to_tenant(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_driver_from_tenant(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'owner' LIMIT 1;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ليس لديك صلاحية');
  END IF;
  DELETE FROM public.user_roles
    WHERE user_id = _user_id AND role = 'driver' AND tenant_id = v_tenant;
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.remove_driver_from_tenant(uuid) TO authenticated;

DROP POLICY IF EXISTS "Owners view tenant drivers roles" ON public.user_roles;
CREATE POLICY "Owners view tenant drivers roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    role = 'driver' AND tenant_id IN (
      SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

DROP POLICY IF EXISTS "Owners view tenant driver profiles" ON public.profiles;
CREATE POLICY "Owners view tenant driver profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT ur.user_id FROM public.user_roles ur
      WHERE ur.role = 'driver' AND ur.tenant_id IN (
        SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'owner'
      )
    )
  );

CREATE OR REPLACE FUNCTION public.award_loyalty_on_delivered()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status <> 'delivered' AND NEW.customer_user_id IS NOT NULL THEN
    INSERT INTO public.loyalty_points (user_id, tenant_id, points)
    VALUES (NEW.customer_user_id, NEW.tenant_id, GREATEST(1, (NEW.total_iqd / 1000)::int))
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET
      points = public.loyalty_points.points + EXCLUDED.points,
      updated_at = now();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_award_loyalty ON public.orders;
CREATE TRIGGER trg_award_loyalty
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.award_loyalty_on_delivered();
