
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
