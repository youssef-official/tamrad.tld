import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, formatIQD } from "@/lib/useMe";
import { useCurrentBranch } from "@/lib/useBranch";
import { PageHeader } from "@/components/DashboardShell";
import { TrendingUp, ShoppingBag, DollarSign, Award, Download, Users, MapPin, Phone } from "lucide-react";

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

  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ["tenant-customer-statistics", tenantId, branchId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_tenant_customer_statistics", {
        _tenant_id: tenantId,
        _branch_id: branchId ?? null,
      });
      if (error) throw error;
      return (data ?? []) as CustomerStat[];
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
  const mealStats = Object.values(itemMap).sort((a, b) => b.qty - a.qty);
  const topItems = mealStats.slice(0, 5);

  // Status breakdown
  const statusCounts = data.orders.reduce((acc: any, o: any) => {
    acc[o.status] = (acc[o.status] || 0) + 1; return acc;
  }, {} as Record<string, number>);

  const downloadReport = () => {
    const csvCell = (value: string | number | null | undefined) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["تقرير المبيعات", branch ? `فرع ${branch.name}` : "كل الفروع", "آخر 30 يوماً"],
      ["إيرادات 30 يوم", revenue30],
      ["إيرادات إجمالية", totalRevenue],
      ["الطلبات المسلمة 30 يوم", delivered.length],
      [],
      ["مبيعات الوجبات"],
      ["الوجبة", "عدد مرات البيع", "إجمالي المبيعات"],
      ...mealStats.map((item) => [item.name, item.qty, item.revenue]),
      [],
      ["العملاء (طلبات مسلمة)"],
      ["الاسم", "رقم الهاتف", "آخر عنوان", "عدد الطلبات", "إجمالي المدفوع", "آخر طلب"],
      ...customers.map((customer) => [
        customer.full_name, customer.phone, customer.last_address, customer.orders_count,
        customer.paid_iqd, customer.last_order_at ? new Date(customer.last_order_at).toLocaleString("ar-IQ") : "",
      ]),
    ];
    const file = new Blob(["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `statistics-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="الإحصائيات"
        subtitle={branch ? `آخر 30 يوماً — فرع ${branch.name}.` : "آخر 30 يوماً — كل الفروع."}
        action={<button onClick={downloadReport} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"><Download className="h-4 w-4" /> تنزيل تقرير CSV</button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={DollarSign} label="إيرادات 30 يوم" value={formatIQD(revenue30)} />
        <Kpi icon={TrendingUp} label="إيرادات إجمالية" value={formatIQD(totalRevenue)} />
        <Kpi icon={ShoppingBag} label="طلبات مُسلَّمة (30 يوم)" value={String(delivered.length)} />
        <Kpi icon={Award} label="متوسط قيمة الطلب" value={formatIQD(avgOrder)} />
        <Kpi icon={Users} label="العملاء" value={customersLoading ? "..." : String(customers.length)} />
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

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <h3 className="mb-1 text-lg font-black">مبيعات الوجبات</h3>
        <p className="mb-4 text-xs text-muted-foreground">عدد مرات البيع وإجمالي كل وجبة خلال آخر 30 يوماً.</p>
        {mealStats.length === 0 ? <p className="text-sm text-muted-foreground">لا مبيعات مسلّمة بعد.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b border-border text-right text-xs text-muted-foreground"><tr><th className="pb-2">الوجبة</th><th className="pb-2">مرات البيع</th><th className="pb-2">الإجمالي</th></tr></thead>
              <tbody>{mealStats.map((item) => <tr key={item.name} className="border-b border-border/70"><td className="py-3 font-bold">{item.name}</td><td className="py-3">{item.qty}</td><td className="py-3 font-black text-primary">{formatIQD(item.revenue)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <h3 className="mb-1 text-lg font-black">عملاء المطعم</h3>
        <p className="mb-4 text-xs text-muted-foreground">بيانات العملاء الذين لديهم طلبات مسلّمة في هذا المطعم فقط.</p>
        {customersLoading ? <p className="text-sm text-muted-foreground">جاري تحميل العملاء...</p> : customers.length === 0 ? <p className="text-sm text-muted-foreground">لا عملاء لديهم طلبات مسلّمة بعد.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border text-right text-xs text-muted-foreground"><tr><th className="pb-2">العميل</th><th className="pb-2">الهاتف</th><th className="pb-2">آخر عنوان</th><th className="pb-2">الطلبات</th><th className="pb-2">إجمالي المدفوع</th></tr></thead>
              <tbody>{customers.map((customer) => <tr key={customer.customer_id} className="border-b border-border/70 align-top"><td className="py-3 font-bold">{customer.full_name}</td><td className="py-3">{customer.phone ? <a dir="ltr" href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="h-3.5 w-3.5" />{customer.phone}</a> : "—"}</td><td className="max-w-64 py-3 text-muted-foreground"><span className="inline-flex items-start gap-1"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{customer.last_address ?? "—"}</span></td><td className="py-3">{customer.orders_count}</td><td className="py-3 font-black text-primary">{formatIQD(customer.paid_iqd)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

type CustomerStat = {
  customer_id: string;
  full_name: string;
  phone: string | null;
  last_address: string | null;
  orders_count: number;
  paid_iqd: number;
  last_order_at: string | null;
};

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
