import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, formatIQD } from "@/lib/useMe";
import { CustomerBottomNav } from "@/components/CustomerBottomNav";
import { Copy, Gift, Ticket } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/my-coupons")({
  head: () => ({
    meta: [
      { title: "أكوادي وجوائزي — تمراد" },
      { name: "description", content: "أكواد الخصم الخاصة بك وجوائز برنامج الولاء." },
      { property: "og:title", content: "أكوادي وجوائزي — تمراد" },
      { property: "og:description", content: "أكواد الخصم وجوائز الولاء الخاصة بك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyCouponsPage,
});

function MyCouponsPage() {
  const { data: me } = useMe();
  const userId = me?.user.id ?? null;

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["my-coupons", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("coupons") as any)
        .select("id, code, discount_type, discount_value, min_order_iqd, usage_limit, used_count, is_active, is_loyalty_reward, tenant_id")
        .eq("assigned_user_id", userId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const active = coupons.filter((c: any) => (c.usage_limit ?? 0) === 0 || (c.used_count ?? 0) < c.usage_limit);

  function copy(code: string) {
    navigator.clipboard.writeText(code).then(
      () => toast.success("تم نسخ الكود"),
      () => toast.error("تعذر النسخ"),
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <h1 className="flex items-center gap-2 text-xl font-black">
          <Ticket className="h-5 w-5 text-primary" /> أكوادي وجوائزي
        </h1>
      </header>

      <main className="mx-auto max-w-md space-y-3 p-4">
        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</div>
        ) : active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            لا أكواد متاحة حالياً. اطلب أكثر لتحصل على جوائز الولاء!
          </div>
        ) : (
          active.map((c: any) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                {c.is_loyalty_reward ? (
                  <Gift className="h-5 w-5 text-primary" />
                ) : (
                  <Ticket className="h-5 w-5 text-primary" />
                )}
                <span className="text-xs font-bold text-muted-foreground">
                  {c.is_loyalty_reward ? "جائزة ولاء" : "كود خصم"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-lg font-black tracking-wider">{c.code}</div>
                <button
                  onClick={() => copy(c.code)}
                  className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"
                >
                  <Copy className="h-3.5 w-3.5" /> نسخ
                </button>
              </div>
              <div className="mt-2 text-sm">
                {c.discount_type === "percent"
                  ? `خصم ${c.discount_value}%`
                  : `خصم ${formatIQD(c.discount_value)}`}
                {c.min_order_iqd > 0 && (
                  <span className="text-muted-foreground"> · حد أدنى {formatIQD(c.min_order_iqd)}</span>
                )}
              </div>
            </div>
          ))
        )}
      </main>

      <CustomerBottomNav />
    </div>
  );
}
