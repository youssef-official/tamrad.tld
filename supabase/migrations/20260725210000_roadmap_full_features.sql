-- Migration for Roadmap Complete Features (Fixed app_role enum cast)
-- 1) Add features_enabled JSONB column to public.tenants if not present
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS features_enabled jsonb DEFAULT '{"loyalty": true, "wallet": true, "credit": true, "cancellation": true}'::jsonb;

-- 2) Create broadcast_notifications table for restaurant customer announcements
CREATE TABLE IF NOT EXISTS public.broadcast_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id),
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for fast tenant lookup
CREATE INDEX IF NOT EXISTS broadcast_notifications_tenant_idx ON public.broadcast_notifications(tenant_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.broadcast_notifications ENABLE ROW LEVEL SECURITY;

-- Drop previous policies if exist
DROP POLICY IF EXISTS "Tenant owners manage broadcasts" ON public.broadcast_notifications;
DROP POLICY IF EXISTS "Authenticated users view tenant broadcasts" ON public.broadcast_notifications;

-- Correct RLS Policy matching valid app_role enum values ('owner', 'super_admin')
CREATE POLICY "Tenant owners manage broadcasts" ON public.broadcast_notifications
  FOR ALL TO authenticated
  USING (
    tenant_id = public.user_tenant_id(auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.tenant_id = broadcast_notifications.tenant_id 
        AND ur.user_id = auth.uid() 
        AND ur.role::text IN ('owner', 'super_admin')
    )
    OR
    public.is_super_admin(auth.uid())
  );

CREATE POLICY "Authenticated users view tenant broadcasts" ON public.broadcast_notifications
  FOR SELECT TO authenticated
  USING (true);

GRANT ALL ON public.broadcast_notifications TO authenticated, service_role;
