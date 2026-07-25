import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, formatIQD } from "@/lib/useMe";
import { useCurrentBranch } from "@/lib/useBranch";
import { PageHeader } from "@/components/DashboardShell";
import { TrendingUp, ShoppingBag, DollarSign, Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { data: me } = useMe();
  const tenantId = me?.tenantId;
  const { current: branch, branchId } = useCurrentBranch();

  const { data } = useQuery({
    queryKey: ["reports", tenantId, branchId],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
      const base = () => {
        let q: any = supabase.from("orders").select("id, total_iqd, status, items, created_at").eq("tenant_id", tenantId!);
        if (branchId) q = q.eq("branch_id", branchId);
        return q;
      };
      const baseAll = () => {
        let q: any = supabase.from("orders").select("id, total_iqd, status").eq("tenant_id", tenantId!);
        if (branchId) q = q.eq("branch_id", branchId);
        return q;
      };
      const [{ data: orders }, { data: allOrders }] = await Promise.all([
        base().gte("created_at", since),
        baseAll(),
      ]);
      return { orders: orders ?? [], allOrders: allOrders ?? [] };
    },
    enabled: !!tenantId,
  });


  if (!data) return <div className="p-6 text-muted-foreground">جاري التحميل...</div>;

  const delivered = data.orders.filter((o: any) => o.status === "delivered");
  const revenue30 = delivered.reduce((s: number, o: any) => s + (o.total_iqd || 0), 0);
  const totalDelivered = data.allOrders.filter((o: any) => o.status === "delivered");
  const totalRevenue = totalDelivered.reduce((s: number, o: any) => s + (o.total_iqd || 0), 0);
  const avgOrder = delivered.length ? Math.round(revenue30 / delivered.length) : 0;

  // Daily buckets (last 14 days)
  const days: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400 * 1000).toISOString().slice(0, 10);
    days[d] = 0;
  }
  delivered.forEach((o: any) => {
    const d = new Date(o.created_at).toISOString().slice(0, 10);
    if (d in days) days[d] += o.total_iqd;
  });
  const maxDay = Math.max(1, ...Object.values(days));

  // Top items
  const itemMap: Record<string, { name: string; qty: number; revenue: number }> = {};
  delivered.forEach((o: any) => {
    if (Array.isArray(o.items)) {
      o.items.forEach((it: any) => {
        const k = it.name;
        if (!itemMap[k]) itemMap[k] = { name: it.name, qty: 0, revenue: 0 };
        itemMap[k].qty += it.qty || 0;
        itemMap[k].revenue += (it.qty || 0) * (it.price || 0);
      });
    }
  });
  const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 5);

  // Status breakdown
  const statusCounts = data.orders.reduce((acc: any, o: any) => {
    acc[o.status] = (acc[o.status] || 0) + 1; return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <PageHeader title="التقارير" subtitle={branch ? `آخر 30 يوماً — فرع ${branch.name}.` : "آخر 30 يوماً — كل الفروع."} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={DollarSign} label="إيرادات 30 يوم" value={formatIQD(revenue30)} />
        <Kpi icon={TrendingUp} label="إيرادات إجمالية" value={formatIQD(totalRevenue)} />
        <Kpi icon={ShoppingBag} label="طلبات مُسلَّمة (30 يوم)" value={String(delivered.length)} />
        <Kpi icon={Award} label="متوسط قيمة الطلب" value={formatIQD(avgOrder)} />
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <h3 className="mb-4 text-lg font-black">الإيرادات اليومية (آخر 14 يوم)</h3>
        <div className="flex h-40 items-end gap-1">
          {Object.entries(days).map(([d, v]) => (
            <div key={d} className="group relative flex flex-1 flex-col items-center">
              <div className="w-full rounded-t-md bg-primary/70 transition-all hover:bg-primary"
                   style={{ height: `${(v / maxDay) * 100}%`, minHeight: v > 0 ? "4px" : "0" }} />
              <span className="mt-1 text-[10px] text-muted-foreground">{d.slice(8)}</span>
              <span className="absolute -top-8 hidden rounded bg-foreground px-2 py-0.5 text-[10px] text-background group-hover:block">
                {formatIQD(v)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h3 className="mb-4 text-lg font-black">الأكثر طلباً</h3>
          {topItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا بيانات كافية بعد.</p>
          ) : (
            <ul className="space-y-2">
              {topItems.map((it, i) => (
                <li key={it.name} className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">{i + 1}</span>
                    <div>
                      <div className="font-bold">{it.name}</div>
                      <div className="text-xs text-muted-foreground">{it.qty} طلب · {formatIQD(it.revenue)}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <h3 className="mb-4 text-lg font-black">حالة الطلبات (30 يوم)</h3>
          <ul className="space-y-2 text-sm">
            {Object.entries({
              pending: "جديد", accepted: "مقبول", preparing: "يُحضّر",
              on_the_way: "في الطريق", delivered: "تم التسليم",
              rejected: "مرفوض", cancelled: "ملغي",
            }).map(([k, label]) => (
              <li key={k} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <span>{label}</span>
                <span className="font-black">{statusCounts[k] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="text-2xl font-black text-primary">{value}</div>
    </div>
  );
}
