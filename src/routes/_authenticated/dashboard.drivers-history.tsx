import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, formatIQD } from "@/lib/useMe";
import { EmptyState, PageHeader } from "@/components/DashboardShell";
import { History, ArrowRightLeft } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard/drivers-history")({
  component: DriversHistoryPage,
});

type Transfer = {
  id: string;
  order_id: string;
  from_driver_id: string | null;
  to_driver_id: string | null;
  reason: string | null;
  created_at: string;
};
type DriverName = { user_id: string; driver_name: string };

function DriversHistoryPage() {
  const { data: me } = useMe();
  const tenantId = me?.tenantId;
  const [selectedDriver, setSelectedDriver] = useState<string>("");

  const { data: drivers } = useQuery({
    queryKey: ["dh-drivers", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("driver_credentials")
        .select("user_id, driver_name").eq("tenant_id", tenantId!).order("driver_name");
      return (data ?? []) as DriverName[];
    },
  });

  const { data: transfers } = useQuery({
    queryKey: ["order-transfers", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await (supabase.from("order_driver_history") as any)
        .select("*").eq("tenant_id", tenantId!).order("created_at", { ascending: false }).limit(200);
      return (data ?? []) as Transfer[];
    },
  });

  const filtered = selectedDriver
    ? (transfers ?? []).filter((t) => t.from_driver_id === selectedDriver || t.to_driver_id === selectedDriver)
    : (transfers ?? []);

  function driverName(id: string | null) {
    if (!id) return "—";
    return drivers?.find((d) => d.user_id === id)?.driver_name ?? id.slice(0, 8);
  }

  return (
    <>
      <PageHeader title="سجل تحويل الطلبات" subtitle="تتبّع كل مرة نُقل فيها طلب من مندوب لآخر." />

      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-bold">فلترة بمندوب:</label>
        <select
          value={selectedDriver}
          onChange={(e) => setSelectedDriver(e.target.value)}
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">الكل</option>
          {(drivers ?? []).map((d) => (
            <option key={d.user_id} value={d.user_id}>{d.driver_name}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={History} title="لا تحويلات بعد" hint="ستظهر هنا كل مرة تنقل فيها طلباً من مندوب لآخر." />
      ) : (
        <div className="grid gap-2">
          {filtered.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 text-sm">
              <span className="text-xs text-muted-foreground">
                {new Date(t.created_at).toLocaleString("ar-IQ")}
              </span>
              <div className="flex items-center gap-3">
                <span className="font-bold text-primary">{driverName(t.to_driver_id)}</span>
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{driverName(t.from_driver_id)}</span>
              </div>
              {t.reason && <div className="text-xs text-muted-foreground truncate max-w-xs">{t.reason}</div>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
void formatIQD;
