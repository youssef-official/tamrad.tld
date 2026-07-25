
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
