import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Me = {
  user: { id: string; email: string | null };
  profile: {
    id: string;
    full_name: string | null;
    tenant_id: string | null;
    phone: string | null;
  } | null;
  roles: string[];
  isSuperAdmin: boolean;
  isOwner: boolean;
  isDriver: boolean;
  isCustomer: boolean;
  tenantId: string | null;
};

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, tenant_id, phone")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const roleList = (roles ?? []).map((r) => r.role as string);
      return {
        user: { id: user.id, email: user.email ?? null },
        profile: profile ?? null,
        roles: roleList,
        isSuperAdmin: roleList.includes("super_admin"),
        isOwner: roleList.includes("owner"),
        isDriver: roleList.includes("driver"),
        isCustomer: roleList.includes("customer"),
        tenantId: profile?.tenant_id ?? null,
      };
    },
  });
}

export function formatIQD(amount: number): string {
  return new Intl.NumberFormat("ar-IQ").format(amount) + " د.ع";
}
