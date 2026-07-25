/* Customer-facing service worker: minimal offline shell.
   Guarded — only registers in the published app (see src/lib/pwa-register.ts). */
const CACHE_NAME = "tamrad-customer-v1";
const CORE = ["/", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(CORE)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// NetworkFirst for HTML navigations, CacheFirst for static assets.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // On localhost (dev) stay transparent: the fetch handler only exists so the
  // PWA stays installable — never cache dev chunks.
  if (self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API / auth / supabase / OAuth
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/~oauth")) return;

  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/"))),
    );
    return;
  }

  if (/\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        });
      }),
    );
  }
});
