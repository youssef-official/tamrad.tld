import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, formatIQD } from "@/lib/useMe";
import { useCurrentBranch } from "@/lib/useBranch";
import { EmptyState, PageHeader } from "@/components/DashboardShell";
import { ShoppingBag, Phone, MapPin, Clock, Volume2, VolumeX, Pause, Play, X, Bike, CheckCircle2, Loader2, ArrowRightLeft, Banknote } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { alertBeep, beep, installAudioUnlocker, isAudioUnlocked, requestNotificationPermission, showNotification, unlockAudio } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/dashboard/orders")({
  component: OrdersPage,
});

type OrderStatus = "pending" | "accepted" | "preparing" | "on_the_way" | "delivered" | "cancelled" | "rejected";

type Order = {
  id: string;
  order_number: string;
  status: OrderStatus;
  total_iqd: number;
  discount_iqd: number | null;
  delivery_fee_iqd: number | null;
  customer_phone: string | null;
  customer_address: string | null;
  notes: string | null;
  rejection_reason: string | null;
  items: unknown;
  driver_id: string | null;
  payment_collected: boolean | null;
  payment_method: string | null;
  wallet_applied_iqd?: number | null;
  created_at: string;
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "جديد", accepted: "مقبول", preparing: "يُحضّر",
  on_the_way: "في الطريق", delivered: "تم التسليم",
  cancelled: "ملغي", rejected: "مرفوض",
};
// preparing → assign driver (separate flow), not auto-advance
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "accepted", accepted: "preparing", on_the_way: "delivered",
};
const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: "قبول الطلب", accepted: "بدء التحضير", on_the_way: "تم التسليم",
};

function OrdersPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const tenantId = me?.tenantId;
  const { branchId } = useCurrentBranch();
  const [soundOn, setSoundOn] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [rejectFor, setRejectFor] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [assignFor, setAssignFor] = useState<Order | null>(null);
  const [transferFor, setTransferFor] = useState<Order | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const alertingRef = useRef<number | null>(null);

  useEffect(() => {
    installAudioUnlocker();
    requestNotificationPermission();
    const check = window.setInterval(() => setAudioReady(isAudioUnlocked()), 1000);
    return () => window.clearInterval(check);
  }, []);

  const { data: tenant } = useQuery({
    queryKey: ["tenant-status", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, name, accepting_orders").eq("id", tenantId!).maybeSingle();
      return data as { id: string; name: string; accepting_orders: boolean } | null;
    },
    enabled: !!tenantId,
  });

  const togglePanic = useMutation({
    mutationFn: async (accepting: boolean) => {
      const { error } = await supabase.from("tenants").update({ accepting_orders: accepting }).eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenant-status"] }); toast.success("تم تحديث حالة الاستقبال"); },
  });

  const { data: orders } = useQuery({
    queryKey: ["orders", tenantId, branchId],
    queryFn: async () => {
      let q = supabase.from("orders").select("*").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Order[];
    },
    enabled: !!tenantId,
  });

  // Realtime
  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase
      .channel(`orders-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `tenant_id=eq.${tenantId}` },
        () => { qc.invalidateQueries({ queryKey: ["orders", tenantId] }); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, qc]);

  // Beep loop on new pending
  useEffect(() => {
    if (!orders) return;
    const pending = orders.filter((o) => o.status === "pending");
    // First load: seed only NON-pending ids so any waiting pending order
    // still rings until someone takes action on it.
    if (knownIds.current.size === 0) {
      orders.forEach((o) => { if (o.status !== "pending") knownIds.current.add(o.id); });
    }
    const newPending = pending.filter((o) => !knownIds.current.has(o.id));
    orders.forEach((o) => knownIds.current.add(o.id));
    if (newPending.length > 0 && soundOn) {
      if (alertingRef.current) window.clearInterval(alertingRef.current);
      alertBeep();
      alertingRef.current = window.setInterval(alertBeep, 2000);
      toast.info(`طلب جديد #${newPending[0].order_number}`);
      showNotification("طلب جديد", `#${newPending[0].order_number}`);
    }
    if (pending.length === 0 && alertingRef.current) {
      window.clearInterval(alertingRef.current); alertingRef.current = null;
    }
  }, [orders, soundOn]);

  useEffect(() => () => {
    if (alertingRef.current) window.clearInterval(alertingRef.current);
  }, []);

  function stopAlarm() {
    if (alertingRef.current) { window.clearInterval(alertingRef.current); alertingRef.current = null; }
  }

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: OrderStatus; reason?: string }) => {
      const patch = reason ? { status, rejection_reason: reason } : { status };
      const { error } = await supabase.from("orders").update(patch).eq("id", id);
      if (error) throw error;
    },

    onSuccess: () => { qc.invalidateQueries({ queryKey: ["orders"] }); stopAlarm(); toast.success("تم تحديث الطلب"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleCash = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await (supabase.from("orders") as any).update({ payment_collected: val }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["orders"] }); toast.success("تم تحديث حالة النقد"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const accepting = tenant?.accepting_orders ?? true;

  return (
    <>
      <PageHeader title="الطلبات" subtitle="تحديث لحظي — تنبيه صوتي عند كل طلب جديد." action={
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              unlockAudio();
              setSoundOn((s) => !s);
              stopAlarm();
              beep(700, 120);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-bold hover:bg-muted"
            title={soundOn ? "إيقاف الصوت" : "تشغيل الصوت"}
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
            {soundOn ? "الصوت فعّال" : "الصوت مُطفأ"}
          </button>
          <button
            onClick={() => togglePanic.mutate(!accepting)}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${
              accepting ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {accepting ? <><Pause className="h-4 w-4" /> إيقاف الطلبات مؤقتاً</> : <><Play className="h-4 w-4" /> استئناف الطلبات</>}
          </button>
        </div>
      } />

      {soundOn && !audioReady && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <button
            onClick={() => { unlockAudio(); beep(900, 200); setAudioReady(true); }}
            className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600"
          >تفعيل الصوت</button>
          <span>المتصفح يمنع الصوت حتى تضغط زر التفعيل — اضغط مرة واحدة لتشغيل التنبيهات.</span>
        </div>
      )}

      {!accepting && (
        <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-bold text-destructive">
          الطلبات موقوفة حالياً — لن يتمكّن الزبائن من إرسال طلبات جديدة.
        </div>
      )}

      {!orders || orders.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="لا طلبات بعد" hint="ستظهر هنا فور استلامها." />
      ) : (
        <div className="grid gap-3">
          {orders.map((o) => (
            <div key={o.id} className={`rounded-2xl border p-5 shadow-[var(--shadow-soft)] transition-all ${
              o.status === "pending" ? "border-primary bg-lime/10 ring-2 ring-primary/30" : "border-border bg-card"
            }`}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">#{o.order_number}</div>
                  <div className="mt-1 text-xl font-black text-primary">{formatIQD(o.total_iqd)}</div>
                  {(o.discount_iqd ?? 0) > 0 && (
                    <div className="text-xs text-green-600">خصم: {formatIQD(o.discount_iqd!)}</div>
                  )}
                  {(o.delivery_fee_iqd ?? 0) > 0 && (
                    <div className="text-xs text-muted-foreground">توصيل: {formatIQD(o.delivery_fee_iqd!)}</div>
                  )}
                  {(o.wallet_applied_iqd ?? 0) > 0 && (
                    <div className="text-xs font-bold text-primary">
                      {o.payment_collected ? "مدفوع بالمحفظة بالكامل" : `مدفوع من المحفظة: ${formatIQD(o.wallet_applied_iqd!)}`}
                    </div>
                  )}
                  {(o.wallet_applied_iqd ?? 0) > 0 && o.wallet_applied_iqd! < o.total_iqd && !o.payment_collected && (
                    <div className="text-xs font-bold text-amber-600">
                      المتبقي نقداً عند التسليم: {formatIQD(o.total_iqd - o.wallet_applied_iqd!)}
                    </div>
                  )}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  o.status === "pending" ? "bg-lime text-lime-foreground"
                  : o.status === "delivered" ? "bg-primary text-primary-foreground"
                  : o.status === "cancelled" || o.status === "rejected" ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
                }`}>{STATUS_LABEL[o.status]}</span>
              </div>

              <ItemsList items={o.items} />

              <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                {o.customer_phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /><span dir="ltr">{o.customer_phone}</span></div>}
                {o.customer_address && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /><span>{o.customer_address}</span></div>}
                <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /><span>{new Date(o.created_at).toLocaleString("ar-IQ")}</span></div>
              </div>

              {o.notes && <div className="mt-2 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">ملاحظات: {o.notes}</div>}
              {o.rejection_reason && <div className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">سبب الرفض: {o.rejection_reason}</div>}

              <div className="mt-4 flex flex-wrap gap-2">
                {o.status === "pending" && (
                  <button
                    onClick={() => { setRejectFor(o); setRejectReason(""); }}
                    className="rounded-xl border border-destructive px-4 py-2 text-sm font-bold text-destructive hover:bg-destructive/10"
                  >رفض</button>
                )}
                {NEXT[o.status] && (
                  <button
                    onClick={() => updateStatus.mutate({ id: o.id, status: NEXT[o.status]! })}
                    className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                  >{NEXT_LABEL[o.status]} ←</button>
                )}
                {o.status === "preparing" && (
                  <button
                    onClick={() => setAssignFor(o)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                  >
                    <Bike className="h-4 w-4" />
                    اختيار مندوب للتوصيل ←
                  </button>
                )}
                {o.driver_id && (o.status === "on_the_way" || o.status === "preparing") && (
                  <button
                    onClick={() => setTransferFor(o)}
                    className="inline-flex items-center gap-1 rounded-xl border border-amber-500 px-3 py-2 text-xs font-bold text-amber-600 hover:bg-amber-50"
                    title="نقل الطلب لمندوب آخر"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" /> تحويل
                  </button>
                )}
                {o.status === "delivered" &&
                  (o.payment_method === "cash" ||
                    (o.payment_method === "wallet" && !o.payment_collected)) && (
                  <button
                    onClick={() => toggleCash.mutate({ id: o.id, val: !o.payment_collected })}
                    className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold ${
                      o.payment_collected
                        ? "bg-emerald-500 text-white hover:bg-emerald-600"
                        : "border border-amber-500 text-amber-700 hover:bg-amber-50"
                    }`}
                    title={o.payment_collected ? "تم التحصيل من المندوب" : "لم يتم التحصيل — على المندوب أجل"}
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    {o.payment_collected ? "نقد مُستلم" : "أجل على المندوب"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRejectFor(null)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black">رفض الطلب #{rejectFor.order_number}</h3>
              <button onClick={() => setRejectFor(null)}><X className="h-5 w-5" /></button>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">اذكر السبب بوضوح — سيصل للزبون.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="مثال: عذراً، الصنف غير متوفر حالياً."
              className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary"
            />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setRejectFor(null)} className="flex-1 rounded-xl border py-2 text-sm font-bold">إلغاء</button>
              <button
                disabled={!rejectReason.trim()}
                onClick={() => {
                  updateStatus.mutate({ id: rejectFor.id, status: "rejected", reason: rejectReason.trim() });
                  setRejectFor(null);
                }}
                className="flex-1 rounded-xl bg-destructive py-2 text-sm font-bold text-destructive-foreground disabled:opacity-60"
              >تأكيد الرفض</button>
            </div>
          </div>
        </div>
      )}

      {assignFor && tenantId && (
        <AssignDriverDialog
          order={assignFor}
          tenantId={tenantId}
          onClose={() => setAssignFor(null)}
          onAssigned={() => {
            setAssignFor(null);
            qc.invalidateQueries({ queryKey: ["orders"] });
            toast.success("تم إسناد الطلب للمندوب");
          }}
        />
      )}

      {transferFor && tenantId && (
        <TransferDialog
          order={transferFor}
          tenantId={tenantId}
          onClose={() => setTransferFor(null)}
          onDone={() => {
            setTransferFor(null);
            qc.invalidateQueries({ queryKey: ["orders"] });
            toast.success("تم تحويل الطلب للمندوب الجديد");
          }}
        />
      )}
    </>
  );
}

type DriverRow = { user_id: string; code: string; driver_name: string; is_active: boolean };
type ActiveOrder = { driver_id: string; status: OrderStatus };

function AssignDriverDialog({
  order, tenantId, onClose, onAssigned,
}: {
  order: Order; tenantId: string; onClose: () => void; onAssigned: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(order.driver_id);
  const [saving, setSaving] = useState(false);

  const { data: drivers, isLoading } = useQuery({
    queryKey: ["assign-drivers", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("driver_credentials")
        .select("user_id, code, driver_name, is_active")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("driver_name");
      return (data ?? []) as DriverRow[];
    },
  });

  const { data: activeOrders } = useQuery({
    queryKey: ["driver-activity", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("orders")
        .select("driver_id, status")
        .eq("tenant_id", tenantId)
        .in("status", ["on_the_way"])
        .not("driver_id", "is", null);
      return (data ?? []) as ActiveOrder[];
    },
  });

  function busyCount(uid: string) {
    return (activeOrders ?? []).filter((o) => o.driver_id === uid).length;
  }

  async function assign() {
    if (!selected) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("orders")
        .update({ driver_id: selected, status: "on_the_way" })
        .eq("id", order.id);
      if (error) throw error;
      onAssigned();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الإسناد");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onClose}><X className="h-5 w-5" /></button>
          <h3 className="flex items-center gap-2 text-lg font-black">
            <Bike className="h-5 w-5 text-primary" />
            إسناد الطلب #{order.order_number}
          </h3>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">اختر المندوب — سيصله الطلب فوراً مع تنبيه صوتي.</p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !drivers || drivers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
            لا يوجد مناديب مسجّلون. أضف مناديبك من صفحة "المناديب" أولاً.
          </div>
        ) : (
          <div className="grid max-h-80 gap-2 overflow-y-auto">
            {drivers.map((d) => {
              const busy = busyCount(d.user_id);
              const isSel = selected === d.user_id;
              return (
                <button
                  key={d.user_id}
                  onClick={() => setSelected(d.user_id)}
                  className={`flex items-center justify-between rounded-xl border p-3 text-right transition-all ${
                    isSel ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border hover:bg-muted"
                  }`}
                >
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                    busy === 0 ? "bg-lime/40 text-primary" : "bg-amber-100 text-amber-800"
                  }`}>
                    {busy === 0 ? "متاح" : `مشغول (${busy})`}
                  </span>
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-bold">{d.driver_name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{d.code}</div>
                    </div>
                    {isSel && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm font-bold">إلغاء</button>
          <button
            onClick={assign}
            disabled={!selected || saving}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "..." : "إرسال للمندوب"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemsList({ items }: { items: unknown }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <ul className="space-y-1 rounded-xl bg-muted/30 p-3 text-sm">
      {(items as Array<{ name: string; qty: number; price: number }>).map((it, i) => (
        <li key={i} className="flex items-center justify-between">
          <span>{formatIQD(it.qty * it.price)}</span>
          <span>{it.qty} × {it.name}</span>
        </li>
      ))}
    </ul>
  );
}

function TransferDialog({
  order, tenantId, onClose, onDone,
}: { order: Order; tenantId: string; onClose: () => void; onDone: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: drivers } = useQuery({
    queryKey: ["transfer-drivers", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("driver_credentials")
        .select("user_id, code, driver_name, is_active")
        .eq("tenant_id", tenantId).eq("is_active", true).order("driver_name");
      return (data ?? []) as DriverRow[];
    },
  });

  async function submit() {
    if (!selected) return;
    setSaving(true);
    try {
      const { data, error } = await (supabase.rpc as any)("transfer_order_driver", {
        _order_id: order.id, _new_driver_id: selected, _reason: reason || null,
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر التحويل");
    } finally { setSaving(false); }
  }

  const available = (drivers ?? []).filter((d) => d.user_id !== order.driver_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onClose}><X className="h-5 w-5" /></button>
          <h3 className="flex items-center gap-2 text-lg font-black">
            <ArrowRightLeft className="h-5 w-5 text-amber-500" />
            تحويل الطلب #{order.order_number}
          </h3>
        </div>
        {available.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            لا يوجد مندوب آخر متاح للتحويل.
          </div>
        ) : (
          <div className="grid max-h-60 gap-2 overflow-y-auto">
            {available.map((d) => (
              <button
                key={d.user_id}
                onClick={() => setSelected(d.user_id)}
                className={`flex items-center justify-between rounded-xl border p-3 text-right ${
                  selected === d.user_id ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border hover:bg-muted"
                }`}
              >
                {selected === d.user_id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                <div>
                  <div className="font-bold">{d.driver_name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{d.code}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        <textarea
          value={reason} onChange={(e) => setReason(e.target.value)}
          rows={2} placeholder="سبب التحويل (اختياري)"
          className="mt-3 w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary"
        />
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm font-bold">إلغاء</button>
          <button
            onClick={submit} disabled={!selected || saving}
            className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60"
          >{saving ? "..." : "تأكيد التحويل"}</button>
        </div>
      </div>
    </div>
  );
}
