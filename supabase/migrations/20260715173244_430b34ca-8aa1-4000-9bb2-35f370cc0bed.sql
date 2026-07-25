
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
