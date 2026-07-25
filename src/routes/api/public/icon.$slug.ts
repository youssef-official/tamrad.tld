// Redirects to the tenant's logo so iOS apple-touch-icon (and any other
// static icon consumer) shows the restaurant's own logo.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/icon/$slug")({
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
          .select("logo_url")
          .or(`slug.eq.${params.slug},custom_domain.eq.${params.slug}`)
          .eq("is_active", true)
          .maybeSingle();

        return new Response(null, {
          status: 302,
          headers: {
            Location: data?.logo_url || "/favicon.png",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
