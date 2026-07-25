
-- Fix admin chat monitor: archive order chat on close instead of hard-deleting it,
-- so the super admin can review conversations for dispute resolution.
-- Participants (customer/driver/owner) still lose access on order close — privacy
-- behavior is unchanged — but the platform admin keeps an audit trail.

-- 1) Archive table (no FK to orders: must survive even if the order row is deleted)
CREATE TABLE IF NOT EXISTS public.order_messages_archive (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_messages_archive_order_idx
  ON public.order_messages_archive(order_id, created_at);
CREATE INDEX IF NOT EXISTS order_messages_archive_tenant_idx
  ON public.order_messages_archive(tenant_id, created_at);

GRANT SELECT ON public.order_messages_archive TO authenticated;
GRANT ALL ON public.order_messages_archive TO service_role;
ALTER TABLE public.order_messages_archive ENABLE ROW LEVEL SECURITY;

-- Only the platform super admin can read archived chat
DROP POLICY IF EXISTS "super admins read archived chat" ON public.order_messages_archive;
CREATE POLICY "super admins read archived chat"
ON public.order_messages_archive FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

-- 2) Archive-then-delete instead of delete on order close
CREATE OR REPLACE FUNCTION public.purge_order_chat_on_close()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('delivered','cancelled','rejected') AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_messages_archive (id, order_id, tenant_id, sender_id, sender_role, content, created_at)
    SELECT id, order_id, tenant_id, sender_id, sender_role, content, created_at
    FROM public.order_messages
    WHERE order_id = NEW.id
    ON CONFLICT (id) DO NOTHING;
    DELETE FROM public.order_messages WHERE order_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

-- 3) Super admin can list drivers of any tenant (monitor driver filter was always empty)
DROP POLICY IF EXISTS "Super admins view all driver creds" ON public.driver_credentials;
CREATE POLICY "Super admins view all driver creds"
  ON public.driver_credentials
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
