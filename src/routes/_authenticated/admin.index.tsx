import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, formatIQD } from "@/lib/useMe";
import { PageHeader } from "@/components/DashboardShell";
import {
  Store,
  ShoppingBag,
  TrendingUp,
  Users,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Bike,
  ChefHat,
  Crown,
  Building2,
  ArrowLeft,
} from "lucide-react";
import { getTenantStorefrontUrl } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  trial: { label: "تجريبي", color: "bg-neutral-200 text-neutral-800" },
  basic: { label: "أساسي", color: "bg-blue-100 text-blue-800" },
  pro: { label: "احترافي", color: "bg-purple-100 text-purple-800" },
  enterprise: { label: "مؤسسي", color: "bg-amber-100 text-amber-900" },
};

function AdminHome() {
  const { data: me } = useMe();

  const { data: tenants } = useQuery({
    queryKey: ["admin-tenants-overview"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("tenants") as any)
        .select(
          "id, name, slug, is_active, accepting_orders, subscription_plan, subscription_status, subscription_expires_at, monthly_fee_iqd, created_at",
        )
        .eq("is_admin_provisioned", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        name: string;
        slug: string;
        is_active: boolean;
        accepting_orders: boolean;
        subscription_plan: string;
        subscription_status: string;
        subscription_expires_at: string | null;
        monthly_fee_iqd: number;
        created_at: string;
      }>;
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["admin-branches-count"],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("id, tenant_id, is_active");
      return data ?? [];
    },
  });

  const { data: orderStats } = useQuery({
    queryKey: ["admin-order-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("total_iqd, status, created_at, tenant_id");
      const rows = data ?? [];
      const revenue = rows.reduce((s, o) => s + (o.total_iqd ?? 0), 0);
      const active = rows.filter((o) =>
        ["pending", "accepted", "preparing", "on_the_way"].includes(o.status),
      ).length;
      const delivered = rows.filter((o) => o.status === "delivered").length;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayRevenue = rows
        .filter((o) => new Date(o.created_at) >= today && o.status === "delivered")
        .reduce((s, o) => s + (o.total_iqd ?? 0), 0);
      // per tenant
      const perTenant = new Map<string, { count: number; revenue: number }>();
      rows.forEach((o) => {
        const cur = perTenant.get(o.tenant_id) ?? { count: 0, revenue: 0 };
        cur.count += 1;
        if (o.status === "delivered") cur.revenue += o.total_iqd ?? 0;
        perTenant.set(o.tenant_id, cur);
      });
      return {
        total: rows.length,
        active,
        delivered,
        revenue,
        todayRevenue,
        perTenant,
      };
    },
  });

  const { data: usersCount } = useQuery({
    queryKey: ["admin-users-count"],
    queryFn: async () => {
      const [{ count: customers }, { count: drivers }, { count: owners }] = await Promise.all([
        supabase
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "customer"),
        supabase
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "driver"),
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "owner"),
      ]);
      return { customers: customers ?? 0, drivers: drivers ?? 0, owners: owners ?? 0 };
    },
  });

  const activeTenants = (tenants ?? []).filter((t) => t.is_active).length;
  const suspendedTenants = (tenants ?? []).filter((t) => t.subscription_status !== "active").length;
  const monthlyRecurring = (tenants ?? [])
    .filter((t) => t.subscription_status === "active" && t.is_active)
    .reduce((s, t) => s + (t.monthly_fee_iqd ?? 0), 0);

  const branchesByTenant = new Map<string, number>();
  (branches ?? []).forEach((b) => {
    branchesByTenant.set(b.tenant_id, (branchesByTenant.get(b.tenant_id) ?? 0) + 1);
  });

  const stats = [
    {
      label: "المطاعم النشطة",
      value: activeTenants,
      hint: `${tenants?.length ?? 0} إجمالاً • ${branches?.length ?? 0} فرع`,
      icon: Store,
      color: "bg-lime/40 text-primary",
    },
    {
      label: "الإيرادات الشهرية المتكررة",
      value: formatIQD(monthlyRecurring),
      hint: "من الاشتراكات النشطة",
      icon: Crown,
      color: "bg-amber-100 text-amber-800",
    },
    {
      label: "طلبات نشطة الآن",
      value: orderStats?.active ?? 0,
      hint: `${orderStats?.delivered ?? 0} طلب مكتمل`,
      icon: ShoppingBag,
      color: "bg-blue-100 text-blue-800",
    },
    {
      label: "إيرادات اليوم",
      value: formatIQD(orderStats?.todayRevenue ?? 0),
      hint: `${formatIQD(orderStats?.revenue ?? 0)} إجمالي`,
      icon: TrendingUp,
      color: "bg-emerald-100 text-emerald-800",
    },
    {
      label: "المستخدمون",
      value: (usersCount?.customers ?? 0) + (usersCount?.drivers ?? 0) + (usersCount?.owners ?? 0),
      hint: `${usersCount?.customers ?? 0} زبون • ${usersCount?.drivers ?? 0} مندوب`,
      icon: Users,
      color: "bg-purple-100 text-purple-800",
    },
    {
      label: "اشتراكات تحتاج انتباه",
      value: suspendedTenants,
      hint: "منتهية أو موقوفة",
      icon: AlertTriangle,
      color: suspendedTenants > 0 ? "bg-red-100 text-red-800" : "bg-muted text-foreground",
    },
  ];

  return (
    <>
      <PageHeader
        title={`أهلاً، ${me?.profile?.full_name?.split(" ")[0] ?? "أدمن"}`}
        subtitle="مركز التحكم الشامل لمنصة تمراد."
        action={
          <Link
            to="/admin/tenants"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            إضافة مطعم
          </Link>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, hint, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {hint}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-3xl font-black">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex items-center justify-between">
          <Link
            to="/admin/tenants"
            className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
          >
            إدارة كل المطاعم <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <h2 className="text-xl font-black">نظرة على المطاعم</h2>
        </div>

        {tenants && tenants.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-right text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-bold">المطعم</th>
                  <th className="px-4 py-3 font-bold">الفروع</th>
                  <th className="px-4 py-3 font-bold">الطلبات</th>
                  <th className="px-4 py-3 font-bold">الإيرادات</th>
                  <th className="px-4 py-3 font-bold">الاشتراك</th>
                  <th className="px-4 py-3 font-bold">الحالة</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tenants.map((t) => {
                  const st = orderStats?.perTenant.get(t.id);
                  const plan = PLAN_LABELS[t.subscription_plan] ?? PLAN_LABELS.trial;
                  const expired =
                    t.subscription_expires_at && new Date(t.subscription_expires_at) < new Date();
                  return (
                    <tr key={t.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-bold">{t.name}</div>
                        <a
                          href={getTenantStorefrontUrl(t.slug)}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[10px] text-muted-foreground hover:text-primary"
                        >
                          {t.slug}.mrt.llc
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs">
                          <Building2 className="h-3 w-3" />
                          {branchesByTenant.get(t.id) ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{st?.count ?? 0}</td>
                      <td className="px-4 py-3 text-xs font-bold text-emerald-700">
                        {formatIQD(st?.revenue ?? 0)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${plan.color}`}
                        >
                          {plan.label}
                        </span>
                        {expired && (
                          <div className="mt-1 text-[10px] font-bold text-red-600">منتهي</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!t.is_active ? (
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-700">
                            معطّل
                          </span>
                        ) : !t.accepting_orders ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">
                            <ChefHat className="h-3 w-3" /> متوقف
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-lime px-2.5 py-1 text-[10px] font-bold text-lime-foreground">
                            <CheckCircle2 className="h-3 w-3" /> نشط
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to="/admin/tenants/$id"
                          params={{ id: t.id }}
                          className="rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/20"
                        >
                          إدارة ←
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Store className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">لم يتم إضافة مطاعم بعد.</p>
            <Link
              to="/admin/tenants"
              className="mt-3 inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              إضافة أول مطعم
            </Link>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <QuickCard
          title="المناديب النشطون"
          value={usersCount?.drivers ?? 0}
          icon={Bike}
          hint="جميع المناديب على المنصة"
        />
        <QuickCard
          title="أصحاب المطاعم"
          value={usersCount?.owners ?? 0}
          icon={Crown}
          hint="حسابات ملاّك مسجّلين"
        />
      </div>
    </>
  );
}

function QuickCard({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
      <div>
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="mt-1 text-2xl font-black">{value}</div>
        <div className="mt-1 text-[10px] text-muted-foreground">{hint}</div>
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}
