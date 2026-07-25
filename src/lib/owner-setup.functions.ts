import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ensureOwnerRestaurant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("ensure_owner_restaurant" as never);
    if (error) throw new Error(error.message);
    return data as { ok: boolean; tenant_id?: string; error?: string };
  });