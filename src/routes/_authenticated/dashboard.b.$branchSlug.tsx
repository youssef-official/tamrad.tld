import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { setSelectedBranch } from "@/lib/useBranch";

// Deep-link route: /dashboard/b/<branch-slug> — sets the active branch then redirects to /dashboard
export const Route = createFileRoute("/_authenticated/dashboard/b/$branchSlug")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) throw redirect({ to: "/auth" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .maybeSingle();
    const tenantId = profile?.tenant_id;
    if (!tenantId) throw redirect({ to: "/dashboard" });

    const { data: branch } = await (supabase.from("branches" as any) as any)
      .select("id, slug")
      .eq("tenant_id", tenantId)
      .eq("slug", params.branchSlug)
      .maybeSingle();

    if (branch?.id) setSelectedBranch(tenantId, branch.id);
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});
