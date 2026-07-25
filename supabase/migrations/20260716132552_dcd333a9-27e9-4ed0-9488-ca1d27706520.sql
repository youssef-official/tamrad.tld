
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
