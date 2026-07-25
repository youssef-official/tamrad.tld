import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, formatIQD } from "@/lib/useMe";
import { sumWalletBalanceFromTxns } from "@/lib/walletBalance";
import { useMemo } from "react";
import { DashboardShell, EmptyState, PageHeader } from "@/components/DashboardShell";
import { Wallet, Star, ShoppingBag, LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

const NAV = [
  { label: "طلباتي", to: "/my-orders", icon: ShoppingBag },
  { label: "المحفظة والنقاط", to: "/wallet", icon: Wallet },
  { label: "لوحة تحكم المطعم", to: "/dashboard", icon: LayoutDashboard },
];

function WalletPage() {
  const { data: me } = useMe();

  const { data: loyalty } = useQuery({
    queryKey: ["my-loyalty", me?.user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_points")
        .select("points, tenant_id, tenants(name)")
        .eq("user_id", me!.user.id);
      return data ?? [];
    },
    enabled: !!me?.user.id,
  });

  const { data: txs } = useQuery({
    queryKey: ["my-wallet", me?.user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallet_transactions")
        .select("*, tenants(name)")
        .eq("user_id", me!.user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!me?.user.id,
  });

  const totalPoints = (loyalty ?? []).reduce((s, r: { points: number }) => s + (r.points || 0), 0);

  const balancesByTenant = useMemo(() => {
    const map = new Map<string, { name: string; balance: number }>();
    for (const t of txs ?? []) {
      const row = t as {
        tenant_id: string;
        amount_iqd: number;
        type: string;
        tenants: { name: string } | null;
      };
      const prev = map.get(row.tenant_id)?.balance ?? 0;
      const delta = row.type === "credit" ? row.amount_iqd : -row.amount_iqd;
      map.set(row.tenant_id, {
        name: row.tenants?.name || "مطعم",
        balance: prev + delta,
      });
    }
    return [...map.entries()]
      .map(([tenantId, v]) => ({ tenantId, ...v }))
      .filter((x) => x.balance !== 0);
  }, [txs]);

  const balance = sumWalletBalanceFromTxns(
    (txs ?? []) as { amount_iqd: number; type: string }[],
  );

  return (
    <DashboardShell
      title="محفظتي"
      subtitle="زبون"
      nav={NAV}
      user={{ name: me?.profile?.full_name, email: me?.user.email }}
    >
      <PageHeader title="المحفظة والنقاط" subtitle="رصيدك ونقاط ولائك عند كل مطعم تطلب منه." />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-primary/5 p-6 shadow-[var(--shadow-soft)]">
          <Wallet className="mb-2 h-8 w-8 text-primary" />
          <div className="text-sm text-muted-foreground">إجمالي الرصيد (كل المطاعم)</div>
          <div className="mt-1 text-3xl font-black text-primary">{formatIQD(balance)}</div>
          <p className="mt-2 text-xs text-muted-foreground">
            عند الطلب يُستخدم رصيد المطعم الذي تطلب منه فقط — وليس المجموع الكلي.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-6 shadow-[var(--shadow-soft)]">
          <Star className="mb-2 h-8 w-8 text-amber-500" />
          <div className="text-sm text-muted-foreground">إجمالي نقاط الولاء</div>
          <div className="mt-1 text-3xl font-black text-amber-600">{totalPoints}</div>
        </div>
      </div>

      {balancesByTenant.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h2 className="mb-4 text-lg font-black">رصيدك عند كل مطعم (يُستخدم عند الطلب)</h2>
          <div className="grid gap-2">
            {balancesByTenant.map((b) => (
              <div
                key={b.tenantId}
                className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3"
              >
                <span className="font-black text-primary">{formatIQD(b.balance)}</span>
                <span className="font-bold">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <h2 className="mb-4 text-lg font-black">نقاطي عند المطاعم</h2>
        {loyalty && loyalty.length > 0 ? (
          <div className="grid gap-2">
            {loyalty.map((l: { tenant_id: string; points: number; tenants: { name: string } | null }) => (
              <div key={l.tenant_id} className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
                <span className="font-black text-amber-600">{l.points} نقطة</span>
                <span className="font-bold">{l.tenants?.name || "مطعم"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">لا نقاط بعد. اطلب من مطعم لتربح نقاطك الأولى!</p>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <h2 className="mb-4 text-lg font-black">حركات المحفظة</h2>
        {txs && txs.length > 0 ? (
          <div className="divide-y divide-border">
            {txs.map((t: { id: string; type: string; amount_iqd: number; note: string | null; created_at: string; tenants: { name: string } | null }) => (
              <div key={t.id} className="flex items-center justify-between py-3">
                <span className={`font-black ${t.type === "credit" ? "text-primary" : "text-destructive"}`}>
                  {t.type === "credit" ? "+" : "-"} {formatIQD(t.amount_iqd)}
                </span>
                <div className="text-right">
                  <div className="text-sm font-bold">{t.note || (t.type === "credit" ? "إضافة رصيد" : "خصم")}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.tenants?.name || ""} • {new Date(t.created_at).toLocaleDateString("ar-IQ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Wallet} title="لا حركات بعد" hint="ستظهر هنا أي إضافة أو خصم على محفظتك." />
        )}
      </div>
    </DashboardShell>
  );
}
