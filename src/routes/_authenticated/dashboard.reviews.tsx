import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useMe";
import { useCurrentBranch } from "@/lib/useBranch";
import { PageHeader } from "@/components/DashboardShell";
import { Star, MessageSquare, Utensils, Store, Bike, TrendingUp } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/dashboard/reviews")({
  component: ReviewsPage,
});

type RatingRow = {
  id: string;
  order_id: string;
  tenant_id: string;
  customer_id: string;
  driver_id: string | null;
  restaurant_rating: number | null;
  food_rating: number | null;
  driver_rating: number | null;
  comment: string | null;
  created_at: string;
};

function ReviewsPage() {
  const { data: me } = useMe();
  const tenantId = me?.tenantId;
  const { branchId } = useCurrentBranch();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["reviews", tenantId, branchId],
    enabled: !!tenantId,
    queryFn: async () => {
      // fetch ratings; join order to filter by branch
      const { data } = await (supabase.from("ratings") as any)
        .select("*, orders!inner(id, order_number, branch_id, driver_id, tenant_id)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(500);
      const list = (data ?? []) as (RatingRow & { orders: any })[];
      return branchId ? list.filter(r => r.orders?.branch_id === branchId) : list;
    },
  });

  const stats = useMemo(() => {
    const avg = (key: keyof RatingRow) => {
      const vals = rows.map((r) => r[key] as number | null).filter((v): v is number => typeof v === "number");
      if (!vals.length) return { avg: 0, count: 0 };
      return { avg: vals.reduce((s, x) => s + x, 0) / vals.length, count: vals.length };
    };
    return {
      restaurant: avg("restaurant_rating"),
      food: avg("food_rating"),
      driver: avg("driver_rating"),
      total: rows.length,
      withComment: rows.filter(r => r.comment && r.comment.trim()).length,
    };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="تقييمات العملاء"
        subtitle="آراء الزبائن في المطعم، الوجبات، والمناديب"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Store}   label="تقييم المطعم"  {...stats.restaurant} accent="text-primary" />
        <StatCard icon={Utensils}label="تقييم الوجبات" {...stats.food}       accent="text-orange-500" />
        <StatCard icon={Bike}    label="تقييم المناديب"{...stats.driver}     accent="text-blue-500" />
        <StatCard icon={MessageSquare} label="إجمالي المراجعات" avg={stats.total} count={stats.withComment} suffix="مراجعة" secondaryLabel="مع تعليق" accent="text-emerald-500" isCount />
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-black">آخر المراجعات</h2>
          <span className="mr-auto text-xs text-muted-foreground">
            {branchId ? "مفلترة على الفرع النشط" : "من كل الفروع"}
          </span>
        </div>

        {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">جاري التحميل…</p>}
        {!isLoading && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            لا توجد تقييمات بعد — تظهر هنا بعد ما الزبون يقيّم طلب مُسلَّم.
          </p>
        )}

        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-border p-4">
              <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="font-mono font-bold text-foreground">
                  #{(r as any).orders?.order_number ?? r.order_id.slice(0, 6)}
                </span>
                <span>·</span>
                <span>{new Date(r.created_at).toLocaleString("ar-IQ")}</span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <RatingPill label="مطعم"  value={r.restaurant_rating} />
                <RatingPill label="وجبة"  value={r.food_rating} />
                <RatingPill label="مندوب" value={r.driver_rating} />
              </div>
              {r.comment && (
                <p className="mt-3 rounded-xl bg-muted/40 p-3 text-sm leading-relaxed">"{r.comment}"</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function StatCard({
  icon: Icon, label, avg, count, accent, suffix = "من 5", secondaryLabel = "تقييم", isCount = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; avg: number; count: number; accent: string;
  suffix?: string; secondaryLabel?: string; isCount?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${accent}`} />
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black">{isCount ? avg : avg.toFixed(1)}</span>
        {!isCount && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        {!isCount && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />}
        <span>{count} {secondaryLabel}</span>
      </div>
    </div>
  );
}

function RatingPill({ label, value }: { label: string; value: number | null }) {
  if (value == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
        {label} — لم يقيّم
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2.5 py-1 text-[11px] font-bold">
      {label}
      <span className="flex">
        {[1, 2, 3, 4, 5].map(n => (
          <Star key={n} className={`h-3 w-3 ${n <= value ? "fill-yellow-500 text-yellow-500" : "text-neutral-300"}`} />
        ))}
      </span>
    </span>
  );
}
