-- ============================================================
-- TAMRAD - إعداد قاعدة البيانات الكامل
-- الصق هذا الملف كاملاً في Supabase SQL Editor ثم Run
-- (مدمج من كل الـ migrations بترتيبها الزمني)
-- ============================================================


-- ============================================================
-- Migration: 20260715173244_430b34ca-8aa1-4000-9bb2-35f370cc0bed.sql
-- ============================================================

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'owner', 'driver', 'customer');
CREATE TYPE public.order_status AS ENUM ('pending','accepted','preparing','on_the_way','delivered','cancelled','rejected');
CREATE TYPE public.payment_method AS ENUM ('cash','credit','wallet');
CREATE TYPE public.settlement_status AS ENUM ('pending','paid');

-- ============ TENANTS (Restaurants) ============
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  logo_url text,
  phone text,
  address text,
  custom_domain text,
  theme_config jsonb NOT NULL DEFAULT '{"primary":"#1f5f3f","accent":"#c8f571"}'::jsonb,
  features_enabled jsonb NOT NULL DEFAULT '{"loyalty":false,"wallet":false,"credit":false}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tenants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  full_name text,
  phone text,
  avatar_url text,
  gender text,
  language text DEFAULT 'ar',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, tenant_id)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.user_tenant_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- ============ MENU ITEMS ============
CREATE TABLE public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_categories TO authenticated;
GRANT ALL ON public.menu_categories TO service_role;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price_iqd bigint NOT NULL CHECK (price_iqd >= 0),
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  total_iqd bigint NOT NULL DEFAULT 0 CHECK (total_iqd >= 0),
  delivery_fee_iqd bigint NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  customer_address text,
  customer_phone text,
  notes text,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, order_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============
-- tenants
CREATE POLICY "Anyone can view active tenants" ON public.tenants FOR SELECT USING (is_active = true OR public.is_super_admin(auth.uid()));
CREATE POLICY "Super admins manage tenants" ON public.tenants FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Owners update their tenant" ON public.tenants FOR UPDATE TO authenticated USING (id = public.user_tenant_id(auth.uid()) AND public.has_role(auth.uid(),'owner'));

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- user_roles
CREATE POLICY "Users read their own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- menu_categories
CREATE POLICY "Public read categories of active tenants" ON public.menu_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Owners manage categories" ON public.menu_categories FOR ALL TO authenticated USING (tenant_id = public.user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.user_tenant_id(auth.uid()));
CREATE POLICY "Super admins manage categories" ON public.menu_categories FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- menu_items
CREATE POLICY "Public read active menu items" ON public.menu_items FOR SELECT USING (is_active = true);
CREATE POLICY "Owners manage menu items" ON public.menu_items FOR ALL TO authenticated USING (tenant_id = public.user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.user_tenant_id(auth.uid()));
CREATE POLICY "Super admins manage menu items" ON public.menu_items FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- orders
CREATE POLICY "Customer sees own orders" ON public.orders FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Driver sees assigned orders" ON public.orders FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "Tenant staff sees own tenant orders" ON public.orders FOR SELECT TO authenticated USING (tenant_id = public.user_tenant_id(auth.uid()));
CREATE POLICY "Super admins see all orders" ON public.orders FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Customer creates own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Tenant staff update own tenant orders" ON public.orders FOR UPDATE TO authenticated USING (tenant_id = public.user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.user_tenant_id(auth.uid()));
CREATE POLICY "Driver updates assigned orders" ON public.orders FOR UPDATE TO authenticated USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_menu_items_updated BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + default customer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.phone)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- Migration: 20260715173313_141dafbc-5679-451a-a220-f73926116d8f.sql
-- ============================================================

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


-- ============================================================
-- Migration: 20260715173404_b2698e50-83c0-4b1e-bc6a-7b221eb95e78.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
      AND (_user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.user_roles ur2 WHERE ur2.user_id = auth.uid() AND ur2.role = 'super_admin'
      ))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'
      AND (_user_id = auth.uid() OR _user_id IS NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_tenant_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.profiles
  WHERE id = _user_id AND (_user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'
  )) LIMIT 1;
$$;


-- ============================================================
-- Migration: 20260715174629_7c8f62c4-9980-48dc-ad70-879770641edc.sql
-- ============================================================

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


-- ============================================================
-- Migration: 20260715180308_582e7d99-fb73-48b2-81c2-75e09efc4366.sql
-- ============================================================
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

-- ============================================================
-- Migration: 20260715181023_becb5a74-fabf-467c-814c-0cf4ebede9d6.sql
-- ============================================================

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


-- ============================================================
-- Migration: 20260715182129_3dfbf9c9-fe5d-4562-90fa-bff6a65da419.sql
-- ============================================================

-- ============== Enums ==============
DO $$ BEGIN CREATE TYPE public.discount_type AS ENUM ('percent','fixed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.settlement_status AS ENUM ('pending','paid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.wallet_txn_type AS ENUM ('credit','debit'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============== Tenants: accepting_orders (panic button) ==============
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS accepting_orders boolean NOT NULL DEFAULT true;

-- ============== Orders: extra columns ==============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS discount_iqd integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee_iqd integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS zone_id uuid;

-- ============== Coupons ==============
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type public.discount_type NOT NULL DEFAULT 'percent',
  discount_value integer NOT NULL,
  min_order_iqd integer NOT NULL DEFAULT 0,
  usage_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT SELECT ON public.coupons TO anon;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage tenant coupons" ON public.coupons FOR ALL TO authenticated
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Public reads active coupons" ON public.coupons FOR SELECT TO anon
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));
CREATE TRIGGER trg_coupons_updated BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== Delivery zones ==============
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  fee_iqd integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_zones TO authenticated;
GRANT SELECT ON public.delivery_zones TO anon;
GRANT ALL ON public.delivery_zones TO service_role;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage tenant zones" ON public.delivery_zones FOR ALL TO authenticated
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Public reads active zones" ON public.delivery_zones FOR SELECT TO anon
  USING (is_active = true);
CREATE TRIGGER trg_zones_updated BEFORE UPDATE ON public.delivery_zones FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.orders
  ADD CONSTRAINT orders_zone_fkey FOREIGN KEY (zone_id) REFERENCES public.delivery_zones(id) ON DELETE SET NULL;

-- ============== Ratings ==============
CREATE TABLE IF NOT EXISTS public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  driver_id uuid,
  restaurant_rating smallint CHECK (restaurant_rating BETWEEN 1 AND 5),
  food_rating smallint CHECK (food_rating BETWEEN 1 AND 5),
  driver_rating smallint CHECK (driver_rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);
GRANT SELECT, INSERT, UPDATE ON public.ratings TO authenticated;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customer inserts own rating" ON public.ratings FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Customer views own rating" ON public.ratings FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR tenant_id = public.user_tenant_id(auth.uid()) OR driver_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- ============== Driver settlements ==============
CREATE TABLE IF NOT EXISTS public.driver_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount_iqd integer NOT NULL,
  status public.settlement_status NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_settlements TO authenticated;
GRANT ALL ON public.driver_settlements TO service_role;
ALTER TABLE public.driver_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage settlements" ON public.driver_settlements FOR ALL TO authenticated
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Drivers view own settlements" ON public.driver_settlements FOR SELECT TO authenticated
  USING (driver_id = auth.uid());
CREATE TRIGGER trg_settlements_updated BEFORE UPDATE ON public.driver_settlements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== Wallet ==============
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount_iqd integer NOT NULL,
  type public.wallet_txn_type NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User sees own wallet" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Owners insert tenant wallet" ON public.wallet_transactions FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));

-- ============== Loyalty points ==============
CREATE TABLE IF NOT EXISTS public.loyalty_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);
GRANT SELECT, INSERT, UPDATE ON public.loyalty_points TO authenticated;
GRANT ALL ON public.loyalty_points TO service_role;
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User sees own points" ON public.loyalty_points FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Owners manage tenant points" ON public.loyalty_points FOR ALL TO authenticated
  USING (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.user_tenant_id(auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_loyalty_updated BEFORE UPDATE ON public.loyalty_points FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== Realtime ==============
ALTER TABLE public.orders REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- Migration: 20260715182940_dbdd6525-3db0-4509-9617-ce90d1b892ea.sql
-- ============================================================

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


-- ============================================================
-- Migration: 20260715183407_898e6ab4-461e-47e8-815a-ca0b95ccc6fb.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.driver_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  driver_name text NOT NULL,
  driver_phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_credentials TO authenticated;
GRANT ALL ON public.driver_credentials TO service_role;

ALTER TABLE public.driver_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their tenant drivers creds"
  ON public.driver_credentials
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'owner'))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'owner'));

CREATE POLICY "Drivers view own creds"
  ON public.driver_credentials
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER set_driver_creds_updated_at
  BEFORE UPDATE ON public.driver_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- Migration: 20260715183809_33f4bd81-aa6e-4dc1-bf15-df75215dd2ed.sql
-- ============================================================

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


-- ============================================================
-- Migration: 20260715184949_b2fa86c1-c389-477d-8776-3ec0b9621feb.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.award_loyalty_on_delivered()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status <> 'delivered' AND NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.loyalty_points (user_id, tenant_id, points)
    VALUES (NEW.customer_id, NEW.tenant_id, GREATEST(1, (NEW.total_iqd / 1000)::int))
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET
      points = public.loyalty_points.points + EXCLUDED.points,
      updated_at = now();
  END IF;
  RETURN NEW;
END; $$;


-- ============================================================
-- Migration: 20260716104427_6f365055-9b05-4f2a-82f0-9594aeb69768.sql
-- ============================================================

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


-- ============================================================
-- Migration: 20260716105903_a4b9d1af-4cab-4b2d-8aa3-ae8630ca9609.sql
-- ============================================================
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- ============================================================
-- Migration: 20260716120123_a159981b-cbc1-43c4-9b40-ecfc765a712c.sql
-- ============================================================

-- 0) delivered_at column + auto-fill
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.set_delivered_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM NEW.status) AND NEW.delivered_at IS NULL THEN
    NEW.delivered_at = now();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_delivered_at ON public.orders;
CREATE TRIGGER trg_set_delivered_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_delivered_at();

-- 1) Order chat messages
CREATE TABLE public.order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer','driver','owner')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.order_messages(order_id, created_at);

GRANT SELECT, INSERT ON public.order_messages TO authenticated;
GRANT ALL ON public.order_messages TO service_role;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat participants can read"
ON public.order_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND (
        o.customer_id = auth.uid()
        OR o.driver_id = auth.uid()
        OR public.owner_tenant_id(auth.uid()) = o.tenant_id
        OR public.is_super_admin(auth.uid())
      )
  )
);

CREATE POLICY "chat participants can send"
ON public.order_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND o.tenant_id = order_messages.tenant_id
      AND (
        o.customer_id = auth.uid()
        OR o.driver_id = auth.uid()
        OR public.owner_tenant_id(auth.uid()) = o.tenant_id
      )
  )
);

-- 2) Driver live locations
CREATE TABLE public.driver_locations (
  driver_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_locations TO authenticated;
GRANT ALL ON public.driver_locations TO service_role;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver upserts own location"
ON public.driver_locations FOR ALL TO authenticated
USING (driver_id = auth.uid())
WITH CHECK (driver_id = auth.uid());

CREATE POLICY "owner reads tenant drivers"
ON public.driver_locations FOR SELECT TO authenticated
USING (
  public.owner_tenant_id(auth.uid()) = tenant_id
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "customer reads their active order driver"
ON public.driver_locations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.driver_id = driver_locations.driver_id
      AND o.customer_id = auth.uid()
      AND o.status IN ('accepted','preparing','on_the_way')
  )
);

-- 3) Support tickets
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL,
  reporter_role TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  target TEXT NOT NULL CHECK (target IN ('platform','tenant')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.support_tickets(tenant_id, status);
CREATE INDEX ON public.support_tickets(reporter_id);

GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reporter reads own tickets"
ON public.support_tickets FOR SELECT TO authenticated
USING (
  reporter_id = auth.uid()
  OR (target = 'tenant' AND public.owner_tenant_id(auth.uid()) = tenant_id)
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "anyone auth creates ticket"
ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "owner/admin updates ticket"
ON public.support_tickets FOR UPDATE TO authenticated
USING (
  (target = 'tenant' AND public.owner_tenant_id(auth.uid()) = tenant_id)
  OR public.is_super_admin(auth.uid())
);

CREATE TRIGGER trg_support_tickets_updated
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Realtime
ALTER TABLE public.order_messages REPLICA IDENTITY FULL;
ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Auto-purge chat on order close
CREATE OR REPLACE FUNCTION public.purge_order_chat_on_close()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('delivered','cancelled','rejected') AND OLD.status IS DISTINCT FROM NEW.status THEN
    DELETE FROM public.order_messages WHERE order_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_purge_order_chat ON public.orders;
CREATE TRIGGER trg_purge_order_chat
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.purge_order_chat_on_close();

-- 6) Driver view that hides PII after 12h
CREATE OR REPLACE VIEW public.driver_orders_view
WITH (security_invoker = true) AS
SELECT
  o.id, o.order_number, o.tenant_id, o.branch_id, o.driver_id, o.status,
  o.total_iqd, o.delivery_fee_iqd, o.payment_method, o.items, o.notes,
  o.created_at, o.updated_at, o.delivered_at,
  CASE WHEN o.delivered_at IS NOT NULL AND o.delivered_at < now() - INTERVAL '12 hours'
       THEN NULL ELSE o.customer_id END AS customer_id,
  CASE WHEN o.delivered_at IS NOT NULL AND o.delivered_at < now() - INTERVAL '12 hours'
       THEN NULL ELSE o.customer_phone END AS customer_phone,
  CASE WHEN o.delivered_at IS NOT NULL AND o.delivered_at < now() - INTERVAL '12 hours'
       THEN NULL ELSE o.customer_address END AS customer_address
FROM public.orders o;

GRANT SELECT ON public.driver_orders_view TO authenticated;


-- ============================================================
-- Migration: 20260716121907_739769f1-a337-4ef7-98f1-82bd4a729136.sql
-- ============================================================
-- Subscription fields on tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS subscription_plan text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS monthly_fee_iqd bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_notes text;

-- Allow super admin to read every profile (for admin users management page)
DROP POLICY IF EXISTS "Super admin view all profiles" ON public.profiles;
CREATE POLICY "Super admin view all profiles" ON public.profiles
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Allow super admin to see inactive branches too
DROP POLICY IF EXISTS "Super admin view all branches" ON public.branches;
CREATE POLICY "Super admin view all branches" ON public.branches
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));


-- ============================================================
-- Migration: 20260716122406_66a6fc62-3278-4e7f-9c2a-89d65e6440b8.sql
-- ============================================================

ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS center_lat double precision,
  ADD COLUMN IF NOT EXISTS center_lng double precision,
  ADD COLUMN IF NOT EXISTS radius_km double precision;


-- ============================================================
-- Migration: 20260716130026_bfeec9ca-961b-4e4a-b9fc-9cc5060c36da.sql
-- ============================================================

-- 1. Add loyalty settings to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS loyalty_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loyalty_target_orders int NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS loyalty_reward_type text NOT NULL DEFAULT 'wallet_credit',
  ADD COLUMN IF NOT EXISTS loyalty_reward_value_iqd int NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS loyalty_reward_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_loyalty_reward_type_chk
  CHECK (loyalty_reward_type IN ('wallet_credit','discount','free_item'));

-- 2. Coupons: allow assigning to a specific customer
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_loyalty_reward boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS coupons_assigned_user_idx ON public.coupons(assigned_user_id) WHERE assigned_user_id IS NOT NULL;

-- 3. Loyalty redemptions log
CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  reward_type text NOT NULL,
  reward_value_iqd int NOT NULL DEFAULT 0,
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  milestone_number int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.loyalty_redemptions TO authenticated;
GRANT ALL ON public.loyalty_redemptions TO service_role;

ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own loyalty rewards"
  ON public.loyalty_redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Tenant owners read their loyalty rewards"
  ON public.loyalty_redemptions FOR SELECT TO authenticated
  USING (tenant_id = public.owner_tenant_id(auth.uid()));

CREATE POLICY "Super admins read all loyalty rewards"
  ON public.loyalty_redemptions FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 4. Replace loyalty trigger with milestone-based reward
CREATE OR REPLACE FUNCTION public.award_loyalty_on_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled boolean;
  v_target int;
  v_reward_type text;
  v_reward_value int;
  v_delivered_count int;
  v_last_milestone int;
  v_new_milestone int;
  v_coupon_id uuid;
  v_code text;
BEGIN
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' OR NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT loyalty_enabled, loyalty_target_orders, loyalty_reward_type, loyalty_reward_value_iqd
    INTO v_enabled, v_target, v_reward_type, v_reward_value
    FROM public.tenants WHERE id = NEW.tenant_id;

  IF NOT v_enabled OR v_target <= 0 THEN
    RETURN NEW;
  END IF;

  -- Count delivered orders for this customer in this tenant (including this one)
  SELECT COUNT(*) INTO v_delivered_count
    FROM public.orders
    WHERE tenant_id = NEW.tenant_id
      AND customer_id = NEW.customer_id
      AND status = 'delivered';

  v_new_milestone := v_delivered_count / v_target;

  SELECT COALESCE(MAX(milestone_number), 0) INTO v_last_milestone
    FROM public.loyalty_redemptions
    WHERE tenant_id = NEW.tenant_id AND user_id = NEW.customer_id;

  IF v_new_milestone <= v_last_milestone THEN
    RETURN NEW;
  END IF;

  -- Award based on reward type
  IF v_reward_type = 'wallet_credit' THEN
    INSERT INTO public.wallet_transactions (user_id, tenant_id, amount_iqd, type, note)
    VALUES (NEW.customer_id, NEW.tenant_id, v_reward_value, 'credit', 'مكافأة ولاء');

  ELSIF v_reward_type IN ('discount','free_item') THEN
    v_code := 'LOYAL-' || substr(replace(NEW.customer_id::text,'-',''),1,6) || '-' || v_new_milestone::text;
    INSERT INTO public.coupons (
      tenant_id, code, discount_type, discount_value, min_order_iqd,
      usage_limit, used_count, is_active, assigned_user_id, is_loyalty_reward
    )
    VALUES (
      NEW.tenant_id, v_code, 'amount', v_reward_value, 0,
      1, 0, true, NEW.customer_id, true
    )
    RETURNING id INTO v_coupon_id;
  END IF;

  INSERT INTO public.loyalty_redemptions (
    tenant_id, user_id, order_id, reward_type, reward_value_iqd, coupon_id, milestone_number
  )
  VALUES (
    NEW.tenant_id, NEW.customer_id, NEW.id, v_reward_type, v_reward_value, v_coupon_id, v_new_milestone
  );

  RETURN NEW;
END;
$$;

-- Helper: get loyalty progress for a user in a tenant (delivered count, target, remaining)
CREATE OR REPLACE FUNCTION public.get_loyalty_progress(_tenant_id uuid, _user_id uuid)
RETURNS TABLE(
  enabled boolean,
  target_orders int,
  reward_type text,
  reward_value_iqd int,
  reward_item_id uuid,
  delivered_count int,
  last_milestone int,
  progress_in_cycle int,
  remaining_to_next int
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_delivered int;
  v_last int;
BEGIN
  SELECT t.loyalty_enabled, t.loyalty_target_orders, t.loyalty_reward_type,
         t.loyalty_reward_value_iqd, t.loyalty_reward_item_id
    INTO enabled, target_orders, reward_type, reward_value_iqd, reward_item_id
    FROM public.tenants t WHERE t.id = _tenant_id;

  SELECT COUNT(*) INTO v_delivered
    FROM public.orders
    WHERE tenant_id = _tenant_id AND customer_id = _user_id AND status = 'delivered';

  SELECT COALESCE(MAX(milestone_number), 0) INTO v_last
    FROM public.loyalty_redemptions
    WHERE tenant_id = _tenant_id AND user_id = _user_id;

  delivered_count := COALESCE(v_delivered, 0);
  last_milestone := COALESCE(v_last, 0);
  IF target_orders IS NULL OR target_orders <= 0 THEN
    progress_in_cycle := 0;
    remaining_to_next := 0;
  ELSE
    progress_in_cycle := delivered_count - (last_milestone * target_orders);
    remaining_to_next := GREATEST(target_orders - progress_in_cycle, 0);
  END IF;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_loyalty_progress(uuid, uuid) TO authenticated, anon;

-- Update coupons RLS: assigned coupons visible to the assigned user
DROP POLICY IF EXISTS "Assigned coupon visible to assignee" ON public.coupons;
CREATE POLICY "Assigned coupon visible to assignee"
  ON public.coupons FOR SELECT TO authenticated
  USING (assigned_user_id = auth.uid());


-- ============================================================
-- Migration: 20260716132552_dcd333a9-27e9-4ed0-9488-ca1d27706520.sql
-- ============================================================

-- 1) device_tokens
CREATE TABLE public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'web',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX device_tokens_user_id_idx ON public.device_tokens(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own tokens select" ON public.device_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own tokens insert" ON public.device_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tokens update" ON public.device_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tokens delete" ON public.device_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER device_tokens_set_updated_at
  BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) notification_queue
CREATE TABLE public.notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending|sent|failed
  error text,
  attempts int NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_queue_status_created_idx
  ON public.notification_queue(status, created_at) WHERE status = 'pending';
CREATE INDEX notification_queue_tenant_idx ON public.notification_queue(tenant_id);

GRANT SELECT ON public.notification_queue TO authenticated;
GRANT ALL ON public.notification_queue TO service_role;

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user sees own notifications" ON public.notification_queue
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tenant owner sees tenant notifications" ON public.notification_queue
  FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id = public.owner_tenant_id(auth.uid()));

-- 3) trigger على orders — ينشئ إشعارات عند تغيّر الحالة
CREATE OR REPLACE FUNCTION public.enqueue_order_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body text;
  v_customer_title text;
  v_customer_body text;
BEGIN
  -- New order → notify tenant owner(s)
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notification_queue (user_id, tenant_id, order_id, title, body, data)
    SELECT ur.user_id, NEW.tenant_id, NEW.id,
           'طلب جديد #' || NEW.order_number,
           'وصلك طلب جديد بقيمة ' || COALESCE(NEW.total_iqd,0)::text || ' د.ع',
           jsonb_build_object('type','new_order','order_id', NEW.id, 'url', '/dashboard/orders')
      FROM public.user_roles ur
     WHERE ur.tenant_id = NEW.tenant_id AND ur.role = 'owner';
    RETURN NEW;
  END IF;

  -- Status change → notify customer
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.customer_id IS NOT NULL THEN
    v_customer_title := NULL;
    IF NEW.status = 'confirmed' THEN
      v_customer_title := 'تم تأكيد طلبك ✅';
      v_customer_body := 'المطعم أكّد طلب #' || NEW.order_number || ' وبدأ التحضير.';
    ELSIF NEW.status = 'out_for_delivery' THEN
      v_customer_title := 'المندوب في الطريق 🛵';
      v_customer_body := 'المندوب خرج بطلب #' || NEW.order_number || '.';
    ELSIF NEW.status = 'delivered' THEN
      v_customer_title := 'تم توصيل طلبك 🎉';
      v_customer_body := 'شكراً لطلبك #' || NEW.order_number || '!';
    ELSIF NEW.status = 'cancelled' OR NEW.status = 'rejected' THEN
      v_customer_title := 'تم إلغاء طلبك';
      v_customer_body := 'الطلب #' || NEW.order_number || ' تم إلغاؤه.';
    END IF;

    IF v_customer_title IS NOT NULL THEN
      INSERT INTO public.notification_queue (user_id, tenant_id, order_id, title, body, data)
      VALUES (NEW.customer_id, NEW.tenant_id, NEW.id, v_customer_title, v_customer_body,
              jsonb_build_object('type','order_status','status',NEW.status,'order_id',NEW.id,'url','/orders/'||NEW.id));
    END IF;

    -- Notify driver when assigned
    IF NEW.driver_id IS NOT NULL AND (OLD.driver_id IS DISTINCT FROM NEW.driver_id) THEN
      INSERT INTO public.notification_queue (user_id, tenant_id, order_id, title, body, data)
      VALUES (NEW.driver_id, NEW.tenant_id, NEW.id,
              'طلب توصيل جديد',
              'تم تعيينك للطلب #' || NEW.order_number,
              jsonb_build_object('type','driver_assigned','order_id',NEW.id,'url','/driver'));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_enqueue_notifications_ins ON public.orders;
CREATE TRIGGER orders_enqueue_notifications_ins
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_order_notifications();

DROP TRIGGER IF EXISTS orders_enqueue_notifications_upd ON public.orders;
CREATE TRIGGER orders_enqueue_notifications_upd
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_order_notifications();


-- ============================================================
-- Migration: 20260716134153_189075f2-43f0-41d4-8485-9fd9088a0b83.sql
-- ============================================================

-- Fix trigger: use correct order_status enum values
CREATE OR REPLACE FUNCTION public.enqueue_order_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_title text;
  v_customer_body text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notification_queue (user_id, tenant_id, order_id, title, body, data)
    SELECT ur.user_id, NEW.tenant_id, NEW.id,
           'طلب جديد #' || NEW.order_number,
           'وصلك طلب جديد بقيمة ' || COALESCE(NEW.total_iqd,0)::text || ' د.ع',
           jsonb_build_object('type','new_order','order_id', NEW.id, 'url', '/dashboard/orders')
      FROM public.user_roles ur
     WHERE ur.tenant_id = NEW.tenant_id AND ur.role = 'owner';
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.customer_id IS NOT NULL THEN
    v_customer_title := NULL;
    IF NEW.status = 'accepted' THEN
      v_customer_title := 'تم تأكيد طلبك ✅';
      v_customer_body := 'المطعم أكّد طلب #' || NEW.order_number || ' وبدأ التحضير.';
    ELSIF NEW.status = 'preparing' THEN
      v_customer_title := 'جاري تحضير طلبك 👨‍🍳';
      v_customer_body := 'المطعم بدأ تحضير طلب #' || NEW.order_number || '.';
    ELSIF NEW.status = 'on_the_way' THEN
      v_customer_title := 'المندوب في الطريق 🛵';
      v_customer_body := 'المندوب خرج بطلب #' || NEW.order_number || '.';
    ELSIF NEW.status = 'delivered' THEN
      v_customer_title := 'تم توصيل طلبك 🎉';
      v_customer_body := 'شكراً لطلبك #' || NEW.order_number || '!';
    ELSIF NEW.status IN ('cancelled','rejected') THEN
      v_customer_title := 'تم إلغاء طلبك';
      v_customer_body := 'الطلب #' || NEW.order_number || ' تم إلغاؤه.';
    END IF;

    IF v_customer_title IS NOT NULL THEN
      INSERT INTO public.notification_queue (user_id, tenant_id, order_id, title, body, data)
      VALUES (NEW.customer_id, NEW.tenant_id, NEW.id, v_customer_title, v_customer_body,
              jsonb_build_object('type','order_status','status',NEW.status,'order_id',NEW.id,'url','/orders/'||NEW.id));
    END IF;

    IF NEW.driver_id IS NOT NULL AND (OLD.driver_id IS DISTINCT FROM NEW.driver_id) THEN
      INSERT INTO public.notification_queue (user_id, tenant_id, order_id, title, body, data)
      VALUES (NEW.driver_id, NEW.tenant_id, NEW.id,
              'طلب توصيل جديد',
              'تم تعيينك للطلب #' || NEW.order_number,
              jsonb_build_object('type','driver_assigned','order_id',NEW.id,'url','/driver'));
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Fix device_tokens: allow reassigning a token to a different user (e.g. shared browser)
-- Drop old restrictive insert/update policies and add a merged policy that also permits
-- claiming an existing token (by conflict target) as the new owner.
DROP POLICY IF EXISTS "own tokens insert" ON public.device_tokens;
DROP POLICY IF EXISTS "own tokens update" ON public.device_tokens;

CREATE POLICY "insert own token"
  ON public.device_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update own token"
  ON public.device_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- Migration: 20260716134717_ee29d376-2d28-48eb-ad7c-b55136f5978f.sql
-- ============================================================

ALTER TYPE settlement_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE settlement_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE settlement_status ADD VALUE IF NOT EXISTS 'rejected';


-- ============================================================
-- Migration: 20260716134903_8753a6be-31fe-4028-a3ef-ab5d0e13f8a0.sql
-- ============================================================

-- 1) MENU MODIFIERS
CREATE TABLE public.menu_modifier_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  min_select int NOT NULL DEFAULT 0,
  max_select int NOT NULL DEFAULT 1,
  is_required boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.menu_modifier_groups(menu_item_id);
GRANT SELECT ON public.menu_modifier_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_modifier_groups TO authenticated;
GRANT ALL ON public.menu_modifier_groups TO service_role;
ALTER TABLE public.menu_modifier_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads modifier groups" ON public.menu_modifier_groups FOR SELECT USING (true);
CREATE POLICY "owners manage modifier groups" ON public.menu_modifier_groups FOR ALL TO authenticated
  USING (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE TRIGGER trg_mmg_updated BEFORE UPDATE ON public.menu_modifier_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.menu_modifier_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.menu_modifier_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  extra_price_iqd int NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.menu_modifier_options(group_id);
GRANT SELECT ON public.menu_modifier_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_modifier_options TO authenticated;
GRANT ALL ON public.menu_modifier_options TO service_role;
ALTER TABLE public.menu_modifier_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads modifier options" ON public.menu_modifier_options FOR SELECT USING (true);
CREATE POLICY "owners manage modifier options" ON public.menu_modifier_options FOR ALL TO authenticated
  USING (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));
CREATE TRIGGER trg_mmo_updated BEFORE UPDATE ON public.menu_modifier_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) PANIC BUTTON
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS accepting_orders boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.reject_if_branch_paused()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_ok boolean;
BEGIN
  IF NEW.branch_id IS NULL THEN RETURN NEW; END IF;
  SELECT accepting_orders INTO v_ok FROM public.branches WHERE id = NEW.branch_id;
  IF v_ok = false THEN
    RAISE EXCEPTION 'BRANCH_PAUSED' USING HINT = 'المطعم أوقف استقبال الطلبات مؤقتاً، حاول لاحقاً.';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_reject_if_paused ON public.orders;
CREATE TRIGGER trg_reject_if_paused BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.reject_if_branch_paused();

-- 3) ORDER DRIVER TRANSFER
CREATE TABLE public.order_driver_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.order_driver_history(order_id);
GRANT SELECT, INSERT ON public.order_driver_history TO authenticated;
GRANT ALL ON public.order_driver_history TO service_role;
ALTER TABLE public.order_driver_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner and drivers read history" ON public.order_driver_history FOR SELECT TO authenticated
  USING (
    tenant_id = user_tenant_id(auth.uid())
    OR auth.uid() = from_driver_id
    OR auth.uid() = to_driver_id
    OR is_super_admin(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.transfer_order_driver(
  _order_id uuid, _new_driver_id uuid, _reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; v_old uuid; v_status order_status; v_owner_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_owner_tenant FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'owner' LIMIT 1;
  IF v_owner_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ليس لديك صلاحية');
  END IF;
  SELECT tenant_id, driver_id, status INTO v_tenant, v_old, v_status
    FROM public.orders WHERE id = _order_id;
  IF v_tenant IS NULL OR v_tenant <> v_owner_tenant THEN
    RETURN jsonb_build_object('ok', false, 'error', 'الطلب غير موجود أو ليس لمطعمك');
  END IF;
  IF v_status IN ('delivered','cancelled','rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'لا يمكن التحويل بعد إغلاق الطلب');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _new_driver_id AND role = 'driver' AND tenant_id = v_tenant
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'المندوب لا ينتمي لمطعمك');
  END IF;
  UPDATE public.orders SET driver_id = _new_driver_id, updated_at = now() WHERE id = _order_id;
  INSERT INTO public.order_driver_history (order_id, tenant_id, from_driver_id, to_driver_id, reason, changed_by)
    VALUES (_order_id, v_tenant, v_old, _new_driver_id, _reason, auth.uid());
  RETURN jsonb_build_object('ok', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.transfer_order_driver(uuid, uuid, text) TO authenticated;

-- 4) SETTLEMENTS
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_collected boolean NOT NULL DEFAULT false;
ALTER TABLE public.driver_settlements
  ADD COLUMN IF NOT EXISTS driver_note text,
  ADD COLUMN IF NOT EXISTS owner_note text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

DROP POLICY IF EXISTS "drivers create settlement request" ON public.driver_settlements;
CREATE POLICY "drivers create settlement request" ON public.driver_settlements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id AND status = 'pending_approval');

CREATE OR REPLACE FUNCTION public.driver_request_settlement(
  _tenant_id uuid, _amount_iqd int, _note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'driver' AND tenant_id = _tenant_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'لست مندوباً في هذا المطعم');
  END IF;
  IF _amount_iqd <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'المبلغ غير صحيح');
  END IF;
  INSERT INTO public.driver_settlements (tenant_id, driver_id, amount_iqd, status, driver_note)
    VALUES (_tenant_id, auth.uid(), _amount_iqd, 'pending_approval', _note)
    RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.driver_request_settlement(uuid, int, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_approve_settlement(
  _settlement_id uuid, _approve boolean, _note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; v_status settlement_status;
BEGIN
  SELECT tenant_id, status INTO v_tenant, v_status
    FROM public.driver_settlements WHERE id = _settlement_id;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'الطلب غير موجود');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'owner' AND tenant_id = v_tenant
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ليس لديك صلاحية');
  END IF;
  IF v_status <> 'pending_approval' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'هذا الطلب تم التعامل معه مسبقاً');
  END IF;
  UPDATE public.driver_settlements
    SET status = CASE WHEN _approve THEN 'approved'::settlement_status ELSE 'rejected'::settlement_status END,
        owner_note = _note, approved_by = auth.uid(), approved_at = now(),
        settled_at = CASE WHEN _approve THEN now() ELSE NULL END
    WHERE id = _settlement_id;
  RETURN jsonb_build_object('ok', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.owner_approve_settlement(uuid, boolean, text) TO authenticated;

-- 5) DRIVER HISTORY VIEW
CREATE OR REPLACE VIEW public.driver_orders_history_view
WITH (security_invoker = on) AS
SELECT
  o.id, o.order_number, o.tenant_id, o.branch_id, o.driver_id,
  o.status, o.total_iqd, o.delivery_fee_iqd, o.payment_method, o.payment_collected,
  o.created_at, o.delivered_at, o.updated_at,
  CASE WHEN o.delivered_at IS NOT NULL AND o.delivered_at < now() - interval '12 hours'
       THEN NULL ELSE o.customer_phone END AS customer_phone,
  CASE WHEN o.delivered_at IS NOT NULL AND o.delivered_at < now() - interval '12 hours'
       THEN NULL ELSE o.customer_address END AS customer_address,
  CASE WHEN o.delivered_at IS NOT NULL AND o.delivered_at < now() - interval '12 hours'
       THEN true ELSE false END AS pii_masked
FROM public.orders o
WHERE o.driver_id = auth.uid();
GRANT SELECT ON public.driver_orders_history_view TO authenticated;

-- 6) REALTIME (publication already includes orders; ensure full replica)
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- 7) REORDER
CREATE OR REPLACE FUNCTION public.reorder_from(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_items jsonb; v_tenant uuid; v_branch uuid; v_owner uuid;
BEGIN
  SELECT items, tenant_id, branch_id, customer_id INTO v_items, v_tenant, v_branch, v_owner
    FROM public.orders WHERE id = _order_id;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'هذا الطلب ليس لك');
  END IF;
  RETURN jsonb_build_object('ok', true, 'items', v_items, 'tenant_id', v_tenant, 'branch_id', v_branch);
END; $$;
GRANT EXECUTE ON FUNCTION public.reorder_from(uuid) TO authenticated;


-- ============================================================
-- Migration: 20260716134945_ce059c1e-e846-4108-9b54-fa205ca5a991.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.reject_if_branch_paused()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_branch_ok boolean; v_tenant_ok boolean;
BEGIN
  SELECT accepting_orders INTO v_tenant_ok FROM public.tenants WHERE id = NEW.tenant_id;
  IF v_tenant_ok = false THEN
    RAISE EXCEPTION 'TENANT_PAUSED' USING HINT = 'المطعم أوقف استقبال الطلبات مؤقتاً.';
  END IF;
  IF NEW.branch_id IS NOT NULL THEN
    SELECT accepting_orders INTO v_branch_ok FROM public.branches WHERE id = NEW.branch_id;
    IF v_branch_ok = false THEN
      RAISE EXCEPTION 'BRANCH_PAUSED' USING HINT = 'هذا الفرع أوقف الاستقبال مؤقتاً.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;


-- ============================================================
-- Migration: 20260724222851_6a9dda10-fa48-449e-bcb3-8b363112990b.sql
-- ============================================================

CREATE TABLE public.customer_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'المنزل',
  full_address TEXT NOT NULL,
  city TEXT,
  notes TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX customer_addresses_user_idx ON public.customer_addresses(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own addresses select" ON public.customer_addresses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own addresses insert" ON public.customer_addresses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own addresses update" ON public.customer_addresses
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own addresses delete" ON public.customer_addresses
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER customer_addresses_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ensure only one default address per user
CREATE OR REPLACE FUNCTION public.enforce_single_default_address()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.customer_addresses
       SET is_default = false
     WHERE user_id = NEW.user_id AND id <> NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER customer_addresses_single_default
  AFTER INSERT OR UPDATE OF is_default ON public.customer_addresses
  FOR EACH ROW WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.enforce_single_default_address();


-- ============================================================
-- Migration: 20260724224040_766033dd-43d6-40ed-ac7c-3bcc9f33fc0e.sql
-- ============================================================
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

-- ============================================================
-- Migration: 20260724224504_475ee948-9081-4b99-8ccc-a7aac5e5bf51.sql
-- ============================================================
GRANT SELECT ON public.branches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;

-- ============================================================
-- Migration: 20260724224729_e5752334-ad2c-4095-93b3-0569994ada73.sql
-- ============================================================
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

-- ============================================================
-- Migration: 20260724224826_01abfbf2-3c59-4fce-9a96-623917a97b68.sql
-- ============================================================
REVOKE INSERT, UPDATE, DELETE ON public.branches FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_owner_restaurant() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_owner_restaurant() FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_owner_restaurant() TO authenticated;

-- ============================================================
-- Migration: 20260725023000_7f2a1c9e-4b5d-4e8a-9c1f-2d6a8b3e5f01.sql
-- ============================================================
-- Fix: approving a driver settlement must zero the driver's cash debt.
-- Marks all uncollected delivered cash orders of that driver (same tenant)
-- as payment_collected = true when the owner approves the settlement.
CREATE OR REPLACE FUNCTION public.owner_approve_settlement(
  _settlement_id uuid, _approve boolean, _note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid; v_status settlement_status; v_driver uuid;
BEGIN
  SELECT tenant_id, status, driver_id INTO v_tenant, v_status, v_driver
    FROM public.driver_settlements WHERE id = _settlement_id;
  IF v_tenant IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'الطلب غير موجود');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'owner' AND tenant_id = v_tenant
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ليس لديك صلاحية');
  END IF;
  IF v_status <> 'pending_approval' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'هذا الطلب تم التعامل معه مسبقاً');
  END IF;

  UPDATE public.driver_settlements
    SET status = CASE WHEN _approve THEN 'approved'::settlement_status ELSE 'rejected'::settlement_status END,
        owner_note = _note, approved_by = auth.uid(), approved_at = now(),
        settled_at = CASE WHEN _approve THEN now() ELSE NULL END
    WHERE id = _settlement_id;

  -- Zero the driver's cash debt for this tenant once the payment is approved
  IF _approve THEN
    UPDATE public.orders
      SET payment_collected = true
      WHERE tenant_id = v_tenant
        AND driver_id = v_driver
        AND status = 'delivered'
        AND payment_method = 'cash'
        AND payment_collected = false;
  END IF;

  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.owner_approve_settlement(uuid, boolean, text) TO authenticated;


-- ============================================================
-- Migration: 20260725031500_8e3b2d1a-5c6f-4a9b-bd2e-3f7c9a4e6b12.sql
-- ============================================================
-- Per-tenant customer membership.
-- A user who signs up / orders from restaurant A's storefront is registered
-- as a customer OF THAT TENANT (user_roles row with role='customer' + tenant_id).
-- Visiting restaurant B later auto-registers a separate membership there,
-- so each restaurant has its own isolated customer base (loyalty/wallet/orders
-- are already tenant-scoped).
CREATE OR REPLACE FUNCTION public.ensure_customer_membership(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'تسجيل الدخول مطلوب');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id AND is_active) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'المطعم غير متاح');
  END IF;

  -- NOTE: intentionally NOT touching profiles.tenant_id — RLS helper
  -- user_tenant_id() reads it, and setting it for a customer would grant
  -- owner-level access to this tenant's data.
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (auth.uid(), 'customer', _tenant_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_customer_membership(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_customer_membership(uuid) TO authenticated;


-- ============================================================
-- Migration: 20260725034000_9d4c3e2b-6a7f-4b0c-ce3f-4e8d0b5f7c23.sql
-- ============================================================
-- Let the CUSTOMER see who delivers their order (name only, privacy-safe)
-- plus whether the order was transferred from another driver.
-- SECURITY DEFINER so RLS on profiles/history stays intact for everything else.
CREATE OR REPLACE FUNCTION public.get_order_driver_info(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order RECORD;
  v_driver_name text;
  v_transfer RECORD;
BEGIN
  SELECT id, customer_id, driver_id INTO v_order
  FROM public.orders WHERE id = _order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'الطلب غير موجود');
  END IF;

  -- Only the customer who owns this order may read the driver info
  IF v_order.customer_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'غير مصرح');
  END IF;

  IF v_order.driver_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'driver_name', null, 'transferred', false);
  END IF;

  SELECT full_name INTO v_driver_name FROM public.profiles WHERE id = v_order.driver_id;

  SELECT p.full_name AS to_name, h.created_at
    INTO v_transfer
  FROM public.order_driver_history h
  LEFT JOIN public.profiles p ON p.id = h.to_driver_id
  WHERE h.order_id = _order_id
  ORDER BY h.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'driver_name', COALESCE(NULLIF(v_driver_name, ''), 'المندوب'),
    'transferred', v_transfer.to_name IS NOT NULL,
    'transferred_at', v_transfer.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_driver_info(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_driver_info(uuid) TO authenticated;


-- ============================================================
-- Migration: 20260725164155_a1b2c3d4-e5f6-7890-abcd-ef1234567890.sql
-- ============================================================
-- Wallet payment at checkout: balance RPC, atomic debit RPC, refund-on-cancel trigger, index.

CREATE INDEX IF NOT EXISTS wallet_txn_user_tenant_idx
  ON public.wallet_transactions (user_id, tenant_id, type);

-- Authoritative per-tenant balance for a customer (credits - debits)
CREATE OR REPLACE FUNCTION public.get_wallet_balance(_tenant_id uuid, _user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT SUM(amount_iqd) FROM public.wallet_transactions
       WHERE tenant_id = _tenant_id AND user_id = _user_id AND type = 'credit')
    -
    (SELECT SUM(amount_iqd) FROM public.wallet_transactions
       WHERE tenant_id = _tenant_id AND user_id = _user_id AND type = 'debit'),
    0)::integer;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_balance(uuid, uuid) TO authenticated, anon;

-- Atomically debit the order total from the customer's wallet. Idempotent.
CREATE OR REPLACE FUNCTION public.pay_order_with_wallet(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id uuid;
  v_tenant_id   uuid;
  v_total       bigint;
  v_paymethod   public.payment_method;
  v_balance     integer;
  v_debited     boolean;
BEGIN
  SELECT customer_id, tenant_id, total_iqd, payment_method
    INTO v_customer_id, v_tenant_id, v_total, v_paymethod
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF v_paymethod <> 'wallet' THEN
    RETURN 'not_wallet';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.wallet_transactions
      WHERE order_id = p_order_id AND type = 'debit'
  ) INTO v_debited;

  IF v_debited THEN
    RETURN 'already_paid';
  END IF;

  PERFORM 1 FROM public.wallet_transactions
    WHERE tenant_id = v_tenant_id AND user_id = v_customer_id
    FOR UPDATE;

  v_balance := public.get_wallet_balance(v_tenant_id, v_customer_id);

  IF v_balance < v_total THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: available %, required %', v_balance, v_total;
  END IF;

  INSERT INTO public.wallet_transactions (user_id, tenant_id, amount_iqd, type, order_id, note)
    VALUES (v_customer_id, v_tenant_id, v_total, 'debit', p_order_id,
            'دفع طلب #' || (SELECT order_number FROM public.orders WHERE id = p_order_id));

  UPDATE public.orders SET payment_collected = true WHERE id = p_order_id;

  RETURN 'paid';
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_order_with_wallet(uuid) TO authenticated;

-- Refund the wallet when an order transitions to cancelled/rejected
CREATE OR REPLACE FUNCTION public.refund_wallet_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_debit_amount integer;
  v_customer_id  uuid;
  v_tenant_id    uuid;
  v_already_refunded boolean;
BEGIN
  IF NEW.status NOT IN ('cancelled','rejected') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('cancelled','rejected') THEN
    RETURN NEW;
  END IF;
  IF NEW.payment_method <> 'wallet' THEN
    RETURN NEW;
  END IF;

  SELECT amount_iqd, user_id, tenant_id
    INTO v_debit_amount, v_customer_id, v_tenant_id
    FROM public.wallet_transactions
    WHERE order_id = NEW.id AND type = 'debit'
    LIMIT 1;

  IF v_debit_amount IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.wallet_transactions
      WHERE order_id = NEW.id AND type = 'credit'
        AND note ILIKE 'استرجاع%'
  ) INTO v_already_refunded;

  IF v_already_refunded THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.wallet_transactions (user_id, tenant_id, amount_iqd, type, order_id, note)
    VALUES (v_customer_id, v_tenant_id, v_debit_amount, 'credit', NEW.id,
            'استرجاع طلب #' || NEW.order_number);

  UPDATE public.orders SET payment_collected = false WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refund_wallet_on_cancel ON public.orders;
CREATE TRIGGER trg_refund_wallet_on_cancel
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.refund_wallet_on_cancel();


-- ============================================================
-- Migration: 20260725190000_a5433825-9c2c-4b3e-a724-b9274400d7fe.sql
-- ============================================================
-- Wallet partial payment: a customer can apply ANY available wallet
-- balance to an order and pay the remainder in cash on delivery.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS wallet_applied_iqd bigint NOT NULL DEFAULT 0
  CHECK (wallet_applied_iqd >= 0);

-- Partial-aware wallet debit: LEAST(balance, total). Fails only when balance is 0.
CREATE OR REPLACE FUNCTION public.pay_order_with_wallet(p_order_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id uuid;
  v_tenant_id   uuid;
  v_total       bigint;
  v_paymethod   public.payment_method;
  v_balance     integer;
  v_debited     boolean;
  v_apply       bigint;
BEGIN
  SELECT customer_id, tenant_id, total_iqd, payment_method
    INTO v_customer_id, v_tenant_id, v_total, v_paymethod
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;

  IF v_paymethod <> 'wallet' THEN
    RETURN 'not_wallet';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.wallet_transactions
      WHERE order_id = p_order_id AND type = 'debit'
  ) INTO v_debited;

  IF v_debited THEN
    RETURN 'already_paid';
  END IF;

  PERFORM 1 FROM public.wallet_transactions
    WHERE tenant_id = v_tenant_id AND user_id = v_customer_id
    FOR UPDATE;

  v_balance := public.get_wallet_balance(v_tenant_id, v_customer_id);
  v_apply   := LEAST(v_balance, v_total);

  IF v_apply <= 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: available %, required %', v_balance, v_total;
  END IF;

  INSERT INTO public.wallet_transactions (user_id, tenant_id, amount_iqd, type, order_id, note)
    VALUES (v_customer_id, v_tenant_id, v_apply, 'debit', p_order_id,
            'دفع طلب #' || (SELECT order_number FROM public.orders WHERE id = p_order_id));

  UPDATE public.orders
    SET wallet_applied_iqd = v_apply,
        payment_collected  = (v_apply >= v_total)
    WHERE id = p_order_id;

  RETURN CASE WHEN v_apply >= v_total THEN 'paid' ELSE 'paid_partial' END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_order_with_wallet(uuid) TO authenticated;

-- Refund the actual debit (full or partial) and reset wallet_applied_iqd.
CREATE OR REPLACE FUNCTION public.refund_wallet_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_debit_amount integer;
  v_customer_id  uuid;
  v_tenant_id    uuid;
  v_already_refunded boolean;
BEGIN
  IF NEW.status NOT IN ('cancelled','rejected') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('cancelled','rejected') THEN
    RETURN NEW;
  END IF;
  IF NEW.payment_method <> 'wallet' THEN
    RETURN NEW;
  END IF;

  SELECT amount_iqd, user_id, tenant_id
    INTO v_debit_amount, v_customer_id, v_tenant_id
    FROM public.wallet_transactions
    WHERE order_id = NEW.id AND type = 'debit'
    LIMIT 1;

  IF v_debit_amount IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.wallet_transactions
      WHERE order_id = NEW.id AND type = 'credit'
        AND note ILIKE 'استرجاع%'
  ) INTO v_already_refunded;

  IF v_already_refunded THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.wallet_transactions (user_id, tenant_id, amount_iqd, type, order_id, note)
    VALUES (v_customer_id, v_tenant_id, v_debit_amount, 'credit', NEW.id,
            'استرجاع طلب #' || NEW.order_number);

  UPDATE public.orders
    SET payment_collected = false, wallet_applied_iqd = 0
    WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Driver history view exposes the wallet-applied amount for cash-debt calc.
CREATE OR REPLACE VIEW public.driver_orders_history_view
WITH (security_invoker = on) AS
SELECT
  o.id, o.order_number, o.tenant_id, o.branch_id, o.driver_id,
  o.status, o.total_iqd, o.delivery_fee_iqd, o.payment_method, o.payment_collected,
  o.created_at, o.delivered_at, o.updated_at,
  CASE WHEN o.delivered_at IS NOT NULL AND o.delivered_at < now() - interval '12 hours'
       THEN NULL ELSE o.customer_phone END AS customer_phone,
  CASE WHEN o.delivered_at IS NOT NULL AND o.delivered_at < now() - interval '12 hours'
       THEN NULL ELSE o.customer_address END AS customer_address,
  CASE WHEN o.delivered_at IS NOT NULL AND o.delivered_at < now() - interval '12 hours'
       THEN true ELSE false END AS pii_masked,
  o.wallet_applied_iqd
FROM public.orders o
WHERE o.driver_id = auth.uid();

GRANT SELECT ON public.driver_orders_history_view TO authenticated;

