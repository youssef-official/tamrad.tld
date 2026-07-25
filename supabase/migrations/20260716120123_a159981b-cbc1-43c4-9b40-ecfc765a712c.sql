
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
