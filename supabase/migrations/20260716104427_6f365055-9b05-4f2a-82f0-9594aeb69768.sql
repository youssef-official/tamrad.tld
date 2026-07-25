
-- 1) Backfill: ensure every existing auth user is an owner with a tenant + profile
DO $$
DECLARE u RECORD; v_name text; v_slug text; v_tenant uuid;
BEGIN
  FOR u IN SELECT id, email, phone, raw_user_meta_data FROM auth.users LOOP
    -- Skip if user already has a tenant via profile
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = u.id AND tenant_id IS NOT NULL) THEN
      -- ensure owner role
      SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = u.id;
      INSERT INTO public.user_roles (user_id, role, tenant_id)
      VALUES (u.id, 'owner', v_tenant)
      ON CONFLICT DO NOTHING;
      CONTINUE;
    END IF;

    v_name := COALESCE(NULLIF(u.raw_user_meta_data->>'full_name',''), split_part(u.email,'@',1), 'مطعمي');
    v_slug := regexp_replace(lower(coalesce(split_part(u.email,'@',1),'r')), '[^a-z0-9]+','-','g');
    v_slug := trim(both '-' from v_slug);
    IF v_slug = '' OR v_slug IS NULL THEN v_slug := 'r'; END IF;
    v_slug := v_slug || '-' || substr(replace(u.id::text,'-',''),1,6);

    INSERT INTO public.tenants (name, slug)
    VALUES (v_name || ' - مطعم', v_slug)
    RETURNING id INTO v_tenant;

    INSERT INTO public.profiles (id, full_name, phone, tenant_id)
    VALUES (u.id, v_name, u.phone, v_tenant)
    ON CONFLICT (id) DO UPDATE SET tenant_id = COALESCE(public.profiles.tenant_id, EXCLUDED.tenant_id);

    INSERT INTO public.user_roles (user_id, role, tenant_id)
    VALUES (u.id, 'owner', v_tenant)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 2) Add theme + media columns to branches
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS description text;

-- 3) Add branch_id to scoped tables (nullable = tenant-wide fallback)
ALTER TABLE public.orders           ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.menu_items       ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.menu_categories  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.coupons          ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.delivery_zones   ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.driver_settlements ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_branch          ON public.orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_branch      ON public.menu_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_branch ON public.menu_categories(branch_id);

-- 4) Auto-create a default "الفرع الرئيسي" for every tenant that has no branches yet
DO $$
DECLARE t RECORD; v_branch uuid;
BEGIN
  FOR t IN SELECT id, slug FROM public.tenants LOOP
    IF NOT EXISTS (SELECT 1 FROM public.branches WHERE tenant_id = t.id) THEN
      INSERT INTO public.branches (tenant_id, name, slug, is_active)
      VALUES (t.id, 'الفرع الرئيسي', 'main', true)
      RETURNING id INTO v_branch;
    END IF;
  END LOOP;
END $$;

-- 5) Backfill branch_id on existing rows: assign to first branch of that tenant
UPDATE public.orders o SET branch_id = b.id
  FROM public.branches b WHERE b.tenant_id = o.tenant_id AND o.branch_id IS NULL
  AND b.id = (SELECT id FROM public.branches WHERE tenant_id = o.tenant_id ORDER BY created_at LIMIT 1);

UPDATE public.menu_items o SET branch_id = b.id
  FROM public.branches b WHERE b.tenant_id = o.tenant_id AND o.branch_id IS NULL
  AND b.id = (SELECT id FROM public.branches WHERE tenant_id = o.tenant_id ORDER BY created_at LIMIT 1);

UPDATE public.menu_categories o SET branch_id = b.id
  FROM public.branches b WHERE b.tenant_id = o.tenant_id AND o.branch_id IS NULL
  AND b.id = (SELECT id FROM public.branches WHERE tenant_id = o.tenant_id ORDER BY created_at LIMIT 1);

-- 6) Update handle_new_user trigger: also create default branch
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_slug text; v_tenant uuid;
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

  INSERT INTO public.branches (tenant_id, name, slug, is_active)
  VALUES (v_tenant, 'الفرع الرئيسي', 'main', true);

  RETURN NEW;
END; $$;
