-- Automatically deliver every queued notification to the Web Push Edge Function.
-- The endpoint and shared webhook secret are kept in Supabase Vault, not in Git.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.dispatch_web_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, vault, net
AS $$
DECLARE
  v_endpoint text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_endpoint
  FROM vault.decrypted_secrets WHERE name = 'web_push_function_url';
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'web_push_webhook_secret';

  IF v_endpoint IS NULL OR v_secret IS NULL THEN
    RAISE WARNING 'Web Push dispatch is not configured in Vault';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_endpoint,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notification_queue',
      'schema', 'public',
      'record', to_jsonb(NEW),
      'old_record', NULL
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_web_push_notification() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_web_push_notification() FROM anon;
REVOKE ALL ON FUNCTION public.dispatch_web_push_notification() FROM authenticated;

DROP TRIGGER IF EXISTS notification_queue_dispatch_web_push ON public.notification_queue;
CREATE TRIGGER notification_queue_dispatch_web_push
  AFTER INSERT ON public.notification_queue
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_web_push_notification();
