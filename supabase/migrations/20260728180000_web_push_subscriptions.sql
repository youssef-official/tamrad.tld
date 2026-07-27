-- Browser push subscriptions. The private VAPID key lives only in the Edge Function.
CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  expiration_time timestamptz,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS web_push_subscriptions_user_idx ON public.web_push_subscriptions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_push_subscriptions TO authenticated;
GRANT ALL ON public.web_push_subscriptions TO service_role;
ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage their web push subscriptions" ON public.web_push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP TRIGGER IF EXISTS web_push_subscriptions_set_updated_at ON public.web_push_subscriptions;
CREATE TRIGGER web_push_subscriptions_set_updated_at
  BEFORE UPDATE ON public.web_push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
