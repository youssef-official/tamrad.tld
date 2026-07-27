import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type NotificationRecord = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

const corsHeaders = { "Content-Type": "application/json" };

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (request.headers.get("x-webhook-secret") !== Deno.env.get("WEB_PUSH_WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:notifications@tamrad.app";
  if (!publicKey || !privateKey) return Response.json({ error: "VAPID is not configured" }, { status: 500, headers: corsHeaders });

  const body = await request.json();
  const notification = (body.record ?? body) as NotificationRecord;
  if (!notification?.id || !notification.user_id || !notification.title) {
    return Response.json({ error: "Invalid notification payload" }, { status: 400, headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const { data: subscriptions, error } = await admin
    .from("web_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", notification.user_id);
  if (error) return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    data: notification.data ?? {},
  });
  let sent = 0;
  for (const subscription of subscriptions ?? []) {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, payload, { TTL: 60 * 60 });
      sent += 1;
    } catch (pushError: any) {
      if (pushError?.statusCode === 404 || pushError?.statusCode === 410) {
        await admin.from("web_push_subscriptions").delete().eq("id", subscription.id);
      }
    }
  }
  await admin.from("notification_queue").update({
    status: sent > 0 ? "sent" : "failed",
    sent_at: sent > 0 ? new Date().toISOString() : null,
    attempts: 1,
    error: sent > 0 ? null : "No active push subscription",
  }).eq("id", notification.id);
  return Response.json({ ok: true, sent }, { headers: corsHeaders });
});
