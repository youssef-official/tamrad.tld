import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, formatIQD } from "@/lib/useMe";
import { useBranches, useCurrentBranch, setSelectedBranch } from "@/lib/useBranch";
import { PageHeader } from "@/components/DashboardShell";
import { Store, ShoppingBag, TrendingUp, MapPin, Plus, ArrowLeft } from "lucide-react";

import { getTenantStorefrontUrl } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { data: me } = useMe();
  const tenantId = me?.tenantId;
  const { branches } = useBranches();

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: allOrders } = useQuery({
    queryKey: ["all-orders-summary", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("branch_id, total_iqd, status, created_at")
        .eq("tenant_id", tenantId!);
      return data ?? [];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const tenantTotal = (allOrders ?? []).reduce((s, o: any) => s + (o.total_iqd ?? 0), 0);
  const tenantToday = (allOrders ?? [])
    .filter((o: any) => o.created_at.startsWith(today))
    .reduce((s, o: any) => s + (o.total_iqd ?? 0), 0);

  const storefrontUrl = tenant?.slug ? getTenantStorefrontUrl(tenant.slug, (tenant as any).custom_domain) : "";

  return (
    <>
      <PageHeader
        title={tenant?.name ?? "لوحة المطعم"}
        subtitle="اختر فرعاً لإدارته، أو تابع أداء كل الفروع من هنا."
        action={
          storefrontUrl ? (
            <a
              href={storefrontUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-primary bg-primary/5 px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary hover:text-primary-foreground"
            >
              معاينة صفحة المطعم ←
            </a>
          ) : null
        }
      />

      {/* Tenant-wide stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="عدد الفروع" value={branches.length} icon={Store} />
        <StatCard label="إيرادات اليوم (كل الفروع)" value={formatIQD(tenantToday)} icon={TrendingUp} />
        <StatCard label="إجمالي الإيرادات" value={formatIQD(tenantTotal)} icon={ShoppingBag} />
      </div>

      {/* Branches grid */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-black">فروعك</h2>
        <Link
          to="/dashboard/branches"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> إضافة فرع
        </Link>
      </div>

      {branches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <Store className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-bold">لا يوجد فروع بعد</h3>
          <p className="mt-1 text-sm text-muted-foreground">أنشئ أول فرع لتبدأ استقبال الطلبات.</p>
          <Link
            to="/dashboard/branches"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> إضافة فرع
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((b) => (
            <BranchCard
              key={b.id}
              branch={b}
              orders={(allOrders ?? []).filter((o: any) => o.branch_id === b.id)}
              tenantId={tenantId!}
            />
          ))}
        </div>
      )}
    </>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-right shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}

function BranchCard({ branch, orders, tenantId }: { branch: any; orders: any[]; tenantId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = orders.filter((o) => o.created_at.startsWith(today)).length;
  const todayRev = orders.filter((o) => o.created_at.startsWith(today)).reduce((s, o) => s + (o.total_iqd ?? 0), 0);
  const pending = orders.filter((o) => o.status === "pending").length;
  const { current } = useCurrentBranch();
  const isActive = current?.id === branch.id;

  function openBranch() {
    setSelectedBranch(tenantId, branch.id);
  }

  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)] transition hover:border-primary hover:shadow-[var(--shadow-elegant)]">
      <div className="h-24 bg-gradient-to-br from-primary/20 to-accent/20 relative">
        {branch.cover_url && (
          <img src={branch.cover_url} alt="" className="h-full w-full object-cover" />
        )}
        {isActive && (
          <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
            نشط
          </span>
        )}
      </div>
      <div className="p-5">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-black">{branch.name}</h3>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {branch.city || branch.address || "بدون عنوان"}
            </div>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              branch.is_active
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {branch.is_active ? "فعّال" : "متوقف"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
          <div>
            <div className="text-lg font-black text-primary">{pending}</div>
            <div className="text-[10px] text-muted-foreground">جديدة</div>
          </div>
          <div>
            <div className="text-lg font-black">{todayCount}</div>
            <div className="text-[10px] text-muted-foreground">طلبات اليوم</div>
          </div>
          <div>
            <div className="text-sm font-black text-emerald-600">{formatIQD(todayRev)}</div>
            <div className="text-[10px] text-muted-foreground">إيراد اليوم</div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Link
            to="/dashboard/orders"
            onClick={openBranch}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> فتح لوحة الفرع
          </Link>
          <Link
            to="/dashboard/b/$branchSlug"
            params={{ branchSlug: branch.slug }}
            className="rounded-xl border border-border px-3 py-2 text-[10px] text-muted-foreground hover:bg-muted"
            title={`رابط ثابت: /dashboard/b/${branch.slug}`}
            dir="ltr"
          >
            /b/{branch.slug}
          </Link>
        </div>
      </div>
    </article>
  );
}
