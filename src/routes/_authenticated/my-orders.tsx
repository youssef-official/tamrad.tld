import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, formatIQD } from "@/lib/useMe";
import { CustomerBottomNav } from "@/components/CustomerBottomNav";
import { ChevronLeft, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-orders")({
  head: () => ({
    meta: [
      { title: "طلباتي — تمراد" },
      { name: "description", content: "متابعة كل طلباتك وإعادة الطلب بضغطة زر." },
      { property: "og:title", content: "طلباتي — تمراد" },
      { property: "og:description", content: "كل طلباتك السابقة في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyOrdersPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "قيد المراجعة",
  accepted: "تم القبول",
  preparing: "قيد التحضير",
  on_the_way: "في الطريق",
  delivered: "تم التوصيل",
  cancelled: "ملغى",
  rejected: "مرفوض",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-blue-100 text-blue-700",
  preparing: "bg-indigo-100 text-indigo-700",
  on_the_way: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  rejected: "bg-red-100 text-red-700",
};

function MyOrdersPage() {
  const { data: me } = useMe();
  const userId = me?.user.id ?? null;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, total_iqd, created_at, tenant_id, items")
        .eq("customer_id", userId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <h1 className="flex items-center gap-2 text-xl font-black">
          <ShoppingBag className="h-5 w-5 text-primary" /> طلباتي
        </h1>
      </header>

      <main className="mx-auto max-w-md space-y-3 p-4">
        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            لا توجد طلبات سابقة بعد.
          </div>
        ) : (
          orders.map((o: any) => {
            const itemsCount = Array.isArray(o.items) ? o.items.reduce((s: number, it: any) => s + (it.qty ?? 1), 0) : 0;
            return (
              <Link
                key={o.id}
                to="/orders/$id"
                params={{ id: o.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black">#{o.order_number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[o.status] ?? "bg-muted"}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {itemsCount} صنف · {new Date(o.created_at).toLocaleDateString("ar-IQ")}
                  </div>
                  <div className="mt-1 text-sm font-bold text-primary">{formatIQD(o.total_iqd ?? 0)}</div>
                </div>
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })
        )}
      </main>

      <CustomerBottomNav />
    </div>
  );
}
