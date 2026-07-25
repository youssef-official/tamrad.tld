// Guarded service worker registration for the customer PWA.
// Refuses to register in Lovable preview/dev/iframe or when ?sw=off is set.

function isPreviewOrDev(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  const url = new URL(window.location.href);
  if (url.searchParams.get("sw") === "off") return true;
  if (window.self !== window.top) return true; // iframe
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  // Localhost is allowed so the install flow can be tested in dev.
  if (import.meta.env.DEV && h !== "localhost" && h !== "127.0.0.1") return true;
  return false;
}

export async function registerCustomerSW(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (isPreviewOrDev()) {
    // Unregister any stale customer worker that may still be installed
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        if (r.active?.scriptURL?.endsWith("/sw-customer.js")) await r.unregister();
      }
    } catch { /* ignore */ }
    return;
  }
  try {
    await navigator.serviceWorker.register("/sw-customer.js", { scope: "/" });
  } catch (e) {
    console.warn("[PWA] SW register failed", e);
  }
}
