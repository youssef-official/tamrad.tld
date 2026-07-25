import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useMe";
import { EmptyState, PageHeader } from "@/components/DashboardShell";
import { Bike, Trash2, UserPlus, Copy, KeyRound, X, BarChart3, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createDriverAccount, deleteDriverAccount } from "@/lib/drivers.functions";
import { formatIQD } from "@/lib/useMe";


export const Route = createFileRoute("/_authenticated/dashboard/drivers")({
  component: DriversPage,
});

type DriverRow = {
  id: string;
  user_id: string;
  code: string;
  driver_name: string;
  driver_phone: string | null;
  is_active: boolean;
  created_at: string;
};

function DriversPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const tenantId = me?.tenantId;
  const [showAdd, setShowAdd] = useState(false);
  const [creds, setCreds] = useState<{ code: string; password: string; driver_name: string } | null>(null);
  const [detailsFor, setDetailsFor] = useState<DriverRow | null>(null);

  const createFn = useServerFn(createDriverAccount);
  const deleteFn = useServerFn(deleteDriverAccount);


  const { data: drivers } = useQuery({
    queryKey: ["tenant-drivers", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_credentials")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return (data ?? []) as DriverRow[];
    },
    enabled: !!tenantId,
  });

  const addDriver = useMutation({
    mutationFn: async (payload: { name: string; phone?: string }) =>
      createFn({ data: payload }),
    onSuccess: (res) => {
      setCreds(res);
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["tenant-drivers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });




  const removeDriver = useMutation({
    mutationFn: async (uid: string) => deleteFn({ data: { driver_user_id: uid } }),
    onSuccess: () => {
      toast.success("تم حذف السائق");
      qc.invalidateQueries({ queryKey: ["tenant-drivers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="إدارة المناديب"
        subtitle="أنشئ لكل سائق رمز دخول خاص. لا يحتاج بريدًا ولا كلمة سر — يدخل من صفحة المندوب برمزه فقط."
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            <UserPlus className="h-4 w-4" />
            إضافة مندوب
          </button>
        }
      />

      <div className="mb-4 rounded-xl border border-primary/30 bg-lime/20 p-4 text-sm">
        رابط دخول المناديب:{" "}
        <a href="/driver-auth" className="font-black text-primary underline">
          {typeof window !== "undefined" ? window.location.origin : ""}/driver-auth
        </a>
      </div>

      {drivers && drivers.length > 0 ? (
        <div className="grid gap-3">
          {drivers.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]"
            >
              <div className="text-right">
                <div className="flex items-center justify-start gap-2">
                  <span className="font-bold">{d.driver_name}</span>
                  <span className="rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-sm font-black text-primary">
                    {d.code}
                  </span>
                </div>
                {d.driver_phone && (
                  <div className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
                    {d.driver_phone}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDetailsFor(d)}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
                  title="تفاصيل الأداء"
                >
                  <BarChart3 className="h-4 w-4" />
                  التفاصيل
                </button>
                <button
                  onClick={() => setCreds({ code: d.code, password: "", driver_name: d.driver_name })}
                  className="rounded-lg p-2 hover:bg-muted"
                  title="عرض الرمز ورابط الدخول"
                >
                  <KeyRound className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm("حذف السائق نهائياً؟")) removeDriver.mutate(d.user_id);
                  }}
                  className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                  title="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Bike} title="لا مناديب بعد" hint="أنشئ حساباً لأول مندوب في مطعمك." />
      )}

      {showAdd && <AddDriverModal onClose={() => setShowAdd(false)} onSubmit={(p) => addDriver.mutate(p)} loading={addDriver.isPending} />}
      {creds && <CredsModal creds={creds} onClose={() => setCreds(null)} />}
      {detailsFor && tenantId && (
        <DriverDetailsModal driver={detailsFor} tenantId={tenantId} onClose={() => setDetailsFor(null)} />
      )}
    </>
  );
}

function AddDriverModal({ onClose, onSubmit, loading }: { onClose: () => void; onSubmit: (p: { name: string; phone?: string }) => void; loading: boolean }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-[var(--shadow-elegant)]">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onClose}><X className="h-5 w-5" /></button>
          <h2 className="text-lg font-black">إضافة مندوب</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onSubmit({ name: name.trim(), phone: phone.trim() || undefined });
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">اسم السائق</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">رقم الهاتف (اختياري)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr"
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" />
          </label>
          <button type="submit" disabled={loading}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
            {loading ? "..." : "إنشاء الحساب"}
          </button>
        </form>
      </div>
    </div>
  );
}

function CredsModal({ creds, onClose }: { creds: { code: string; password: string; driver_name: string }; onClose: () => void }) {
  function copy(v: string) {
    navigator.clipboard.writeText(v);
    toast.success("تم النسخ");
  }
  const link = typeof window !== "undefined" ? `${window.location.origin}/driver-auth` : "/driver-auth";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-[var(--shadow-elegant)]">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onClose}><X className="h-5 w-5" /></button>
          <h2 className="flex items-center gap-2 text-lg font-black">
            <KeyRound className="h-5 w-5 text-primary" />
            بيانات دخول {creds.driver_name}
          </h2>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
          أعط السائق الرمز ورابط الدخول. يسجّل دخوله بالرمز فقط — لا كلمة سر.
        </div>
        <div className="mt-4 space-y-3">
          <Field label="رابط الدخول" value={link} onCopy={() => copy(link)} />
          <Field label="رمز السائق" value={creds.code} onCopy={() => copy(creds.code)} mono />
        </div>
        <button onClick={onClose} className="mt-5 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">
          تم
        </button>
      </div>
    </div>
  );
}


function Field({ label, value, onCopy, mono }: { label: string; value: string; onCopy: () => void; mono?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-xs font-bold text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2">
        <button onClick={onCopy} className="rounded-lg p-1 hover:bg-muted"><Copy className="h-4 w-4" /></button>
        <div className={`flex-1 truncate text-sm ${mono ? "font-mono font-black" : ""}`} dir="ltr">{value}</div>
      </div>
    </div>
  );
}

type DriverOrder = {
  id: string;
  order_number: string;
  status: string;
  total_iqd: number;
  delivery_fee_iqd: number | null;
  created_at: string;
  customer_address: string | null;
};

function DriverDetailsModal({ driver, tenantId, onClose }: { driver: DriverRow; tenantId: string; onClose: () => void }) {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["driver-orders", tenantId, driver.user_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders")
        .select("id, order_number, status, total_iqd, delivery_fee_iqd, created_at, customer_address")
        .eq("tenant_id", tenantId)
        .eq("driver_id", driver.user_id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as DriverOrder[];
    },
  });

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const dayStart = startOfToday.getTime();
  const weekStart = now - 7 * DAY;
  const monthStart = now - 30 * DAY;

  const delivered = (orders ?? []).filter((o) => o.status === "delivered");
  function bucket(sinceMs: number) {
    const arr = delivered.filter((o) => new Date(o.created_at).getTime() >= sinceMs);
    const total = arr.reduce((s, o) => s + (o.total_iqd || 0), 0);
    const fees = arr.reduce((s, o) => s + (o.delivery_fee_iqd || 0), 0);
    return { count: arr.length, total, fees };
  }
  const today = bucket(dayStart);
  const week = bucket(weekStart);
  const month = bucket(monthStart);
  const active = (orders ?? []).filter((o) => o.status === "on_the_way").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onClose}><X className="h-5 w-5" /></button>
          <h2 className="flex items-center gap-2 text-lg font-black">
            <BarChart3 className="h-5 w-5 text-primary" />
            تفاصيل المندوب — {driver.driver_name}
          </h2>
        </div>

        <div className="mb-4 rounded-xl bg-muted/40 p-3 text-right text-sm">
          <div><span className="font-bold">الرمز:</span> <span className="font-mono">{driver.code}</span></div>
          {driver.driver_phone && <div dir="ltr" className="text-muted-foreground">{driver.driver_phone}</div>}
          <div className="mt-1 text-xs text-muted-foreground">
            الحالة: {driver.is_active ? "نشط" : "معطّل"} · طلبات جارية الآن: {active}
          </div>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2">
          <StatCard label="اليوم" count={today.count} total={today.total} fees={today.fees} />
          <StatCard label="آخر 7 أيام" count={week.count} total={week.total} fees={week.fees} />
          <StatCard label="آخر 30 يوم" count={month.count} total={month.total} fees={month.fees} />
        </div>

        <h3 className="mb-2 text-right text-sm font-black">كل الطلبات ({orders?.length ?? 0})</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !orders || orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
            لا توجد طلبات مسندة لهذا المندوب بعد.
          </div>
        ) : (
          <div className="grid gap-2">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-border bg-background p-3 text-sm">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                  o.status === "delivered" ? "bg-primary/10 text-primary"
                  : o.status === "on_the_way" ? "bg-amber-100 text-amber-800"
                  : "bg-muted text-muted-foreground"
                }`}>
                  {o.status === "delivered" ? "تم التسليم" : o.status === "on_the_way" ? "في الطريق" : o.status}
                </span>
                <div className="min-w-0 flex-1 px-3 text-right">
                  <div className="truncate font-bold">#{o.order_number} — {formatIQD(o.total_iqd)}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("ar-IQ")}
                    {o.customer_address ? ` · ${o.customer_address}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, count, total, fees }: { label: string; count: number; total: number; fees: number }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3 text-right">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-black text-primary">{count}</div>
      <div className="mt-1 text-xs">إجمالي: <span className="font-bold">{formatIQD(total)}</span></div>
      <div className="text-xs text-muted-foreground">توصيل: {formatIQD(fees)}</div>
    </div>
  );
}
