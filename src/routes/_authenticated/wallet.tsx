import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, formatIQD } from "@/lib/useMe";
import { fetchTenantWalletBalance } from "@/lib/walletBalance";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/DashboardShell";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { data: me } = useMe();
  const [tenant, setTenant] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const queryTenant = new URLSearchParams(window.location.search).get("tenant");
    try {
      const saved = JSON.parse(localStorage.getItem("tamrad:last-wallet-tenant") ?? "null");
      if (queryTenant && saved?.id === queryTenant) {
        setTenant({ id: saved.id, name: saved.name });
      } else if (!queryTenant && saved?.id && saved?.name) {
        setTenant({ id: saved.id, name: saved.name });
      }
    } catch {
      setTenant(null);
    }
  }, []);

  const { data: resolvedTenant } = useQuery({
    queryKey: ["wallet-tenant", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, name").eq("id", tenant!.id).maybeSingle();
      return data;
    },
    enabled: !!tenant?.id,
  });

  const { data: txs } = useQuery({
    queryKey: ["my-wallet", tenant?.id, me?.user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallet_transactions")
        .select("id, type, amount_iqd, note, created_at")
        .eq("user_id", me!.user.id)
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!me?.user.id && !!tenant?.id,
  });

  const { data: balance = 0, isLoading: balanceLoading } = useQuery({
    queryKey: ["wallet-balance", tenant?.id, me?.user.id],
    queryFn: () => fetchTenantWalletBalance(supabase, tenant!.id, me!.user.id),
    enabled: !!tenant?.id && !!me?.user.id,
  });

  return (
    <main dir="rtl" className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-lg">
        {!tenant ? (
          <EmptyState icon={Wallet} title="افتح محفظة مطعم من صفحته" hint="ادخل إلى المطعم أولاً، ثم افتح حسابي ← محفظتي." />
        ) : <>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <Wallet className="mb-3 h-8 w-8 text-primary" />
          <div className="text-sm text-muted-foreground">رصيدك لدى {resolvedTenant?.name ?? tenant.name}</div>
          <div className="mt-1 text-3xl font-black text-primary">{balanceLoading ? "..." : formatIQD(balance)}</div>
          <p className="mt-2 text-xs text-muted-foreground">يُستخدم هذا الرصيد في طلبات هذا المطعم فقط.</p>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <h2 className="mb-4 text-lg font-black">حركات المحفظة</h2>
            {txs && txs.length > 0 ? (
              <div className="divide-y divide-border">
                {txs.map((t: { id: string; type: string; amount_iqd: number; note: string | null; created_at: string }) => (
                  <div key={t.id} className="flex items-center justify-between py-3">
                    <span className={`font-black ${t.type === "credit" ? "text-primary" : "text-destructive"}`}>
                      {t.type === "credit" ? "+" : "-"} {formatIQD(t.amount_iqd)}
                    </span>
                    <div className="text-right">
                      <div className="text-sm font-bold">{t.note || (t.type === "credit" ? "إضافة رصيد" : "دفع من المحفظة")}</div>
                      <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString("ar-IQ")}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={Wallet} title="لا حركات في هذه المحفظة" hint="ستظهر هنا عمليات إضافة الرصيد والدفع لهذا المطعم." />}
          </div>
        </>}
      </div>
    </main>
  );
}
