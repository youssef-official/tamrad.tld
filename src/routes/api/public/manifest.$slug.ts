// Dynamic per-tenant PWA manifest. Called by <link rel="manifest">.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/manifest/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const url = process.env.SUPABASE_URL!;
        const supabase = createClient<Database>(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const { data } = await supabase
          .from("tenants")
          .select("name, logo_url, theme_config, slug")
          .or(`slug.eq.${params.slug},custom_domain.eq.${params.slug}`)
          .eq("is_active", true)
          .maybeSingle();

        const tenantSlug = data?.slug || params.slug;
        const name = data?.name || "المطعم";
        const theme = (data?.theme_config as { primary?: string } | null) ?? {};
        const primary = theme.primary || "#ed6c35";
        const icon = data?.logo_url || "/favicon.png";

        const manifest = {
          id: `/tenant-${tenantSlug}`,
          name,
          short_name: name.slice(0, 12),
          start_url: `/?src=pwa`,
          scope: "/",
          display: "standalone",
          orientation: "portrait",
          background_color: "#ffffff",
          theme_color: primary,
          lang: "ar",
          dir: "rtl",
          icons: [
            { src: icon, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: icon, sizes: "512x512", type: "image/png", purpose: "any" },
            { src: icon, sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        };

        return new Response(JSON.stringify(manifest), {
          headers: {
            "Content-Type": "application/manifest+json; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
