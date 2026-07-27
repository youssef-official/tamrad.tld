import { supabase } from "@/integrations/supabase/client";

function base64UrlToUint8Array(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = window.atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function subscribeToWebPush(userId: string): Promise<{ ok: boolean; message: string }> {
  let publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim();
  if (!publicKey) {
    const { data, error } = await supabase.functions.invoke("send-web-push", { method: "GET" });
    if (!error && typeof data?.publicKey === "string") publicKey = data.publicKey;
  }
  if (!publicKey) return { ok: false, message: "الإشعارات الخارجية لم تُفعّل على الخادم بعد." };
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { ok: false, message: "هذا المتصفح لا يدعم الإشعارات الخارجية." };
  }

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, message: "يلزم السماح بالإشعارات من المتصفح." };

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey),
    });
    const data = subscription.toJSON();
    const { error } = await (supabase.from("web_push_subscriptions") as any).upsert({
      endpoint: subscription.endpoint,
      user_id: userId,
      p256dh: data.keys?.p256dh,
      auth: data.keys?.auth,
      expiration_time: subscription.expirationTime,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (error) throw error;
    return { ok: true, message: "تم تفعيل الإشعارات الخارجية لهذا الجهاز." };
  } catch {
    return { ok: false, message: "تعذّر تسجيل هذا الجهاز للإشعارات الخارجية." };
  }
}
