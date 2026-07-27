import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader } from "@/components/DashboardShell";
import { Search, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

const ROLES = ["super_admin", "driver", "customer"] as const;
type Role = (typeof ROLES)[number];
const ROLE_LABEL: Record<Role, string> = {
  super_admin: "سوبر أدمن",
  driver: "مندوب",
  customer: "زبون",
};

type UserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  tenant_id: string | null;
  roles: Role[];
};

function UsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: users } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: allRoles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, phone, tenant_id"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const byUser = new Map<string, Role[]>();
      (allRoles ?? []).forEach((r) => {
        const arr = byUser.get(r.user_id) ?? [];
        arr.push(r.role as Role);
        byUser.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: byUser.get(p.id) ?? [],
      })) as UserRow[];
    },
  });

  const { data: tenants } = useQuery({
    queryKey: ["tenants-picker"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, name").order("name");
      return data ?? [];
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, role, add }: { userId: string; role: Role; add: boolean }) => {
      if (add) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-users"] });
      toast.success("تم تحديث الصلاحيات");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (users ?? []).filter(
    (u) => (u.full_name ?? "").includes(q) || (u.phone ?? "").includes(q),
  );

  return (
    <>
      <PageHeader
        title="المستخدمون"
        subtitle="العملاء يسجلون بأنفسهم، أما حسابات ملاك المطاعم فتُنشأ من صفحة المطاعم فقط."
      />

      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم أو الهاتف..."
            className="w-full rounded-xl border border-input bg-background py-2.5 pl-4 pr-10 text-sm outline-none focus:border-primary"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="لا يوجد مستخدمون" />
        ) : (
          <div className="space-y-3">
            {filtered.map((u) => (
              <div key={u.id} className="rounded-xl border border-border p-4">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-bold">{u.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.phone ?? u.id.slice(0, 8)}
                    </div>
                  </div>
                  <span className="rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                    {u.tenant_id
                      ? (tenants?.find((t) => t.id === u.tenant_id)?.name ?? "مرتبط بمطعم")
                      : "حساب عميل"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => {
                    const has = u.roles.includes(r);
                    return (
                      <button
                        key={r}
                        onClick={() => updateRole.mutate({ userId: u.id, role: r, add: !has })}
                        className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                          has
                            ? "bg-primary text-primary-foreground"
                            : "border border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {ROLE_LABEL[r]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
