import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, formatIQD } from "@/lib/useMe";
import { DashboardShell, EmptyState, PageHeader } from "@/components/DashboardShell";
import { Bike, Phone, MapPin, LayoutDashboard, ShoppingBag, AlertCircle, Volume2, MessageCircle, Navigation, LifeBuoy, Wallet, History, Download, WifiOff, Route as RouteIcon, Banknote, BadgeDollarSign } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { alertBeep, beep, installAudioUnlocker, isAudioUnlocked, requestNotificationPermission, showNotification, unlockAudio } from "@/lib/sound";
import { OrderChat } from "@/components/OrderChat";
import { SupportTicketDialog } from "@/components/SupportTicketDialog";
import { useDriverLocationTracker } from "@/lib/useDriverLocation";
import { useInstallPrompt } from "@/lib/pwa-install";
import { saveActiveOrders, loadActiveOrders, addPending, getPending, removePending } from "@/lib/offlineOrders";



export const Route = createFileRoute("/_authenticated/driver")({
  head: () => ({
    meta: [
      { title: "بوابة المندوب — تمراد" },
      { name: "theme-color", content: "#1f5f3f" },
    ],
    links: [
      { rel: "manifest", href: "/driver-manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  component: DriverPage,
});

const NAV = [
  { label: "الطلبات", to: "/driver", icon: LayoutDashboard },
  { label: "لوحة الزبون", to: "/", icon: ShoppingBag },
];

type OrderStatus = "pending" | "accepted" | "preparing" | "on_the_way" | "delivered" | "cancelled" | "rejected";

type Order = {
  id: string;
  order_number: string;
  status: OrderStatus;
  total_iqd: number;
  delivery_fee_iqd: number;
  customer_phone: string | null;
  customer_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  driver_id: string | null;
  created_at: string;
};

function DriverPage() {
  const qc = useQueryClient();
  const { data: me, isLoading } = useMe();
  const knownIds = useRef<Set<string>>(new Set());
  const [audioReady, setAudioReady] = useState(false);
  const [chatFor, setChatFor] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [cachedOrders, setCachedOrders] = useState<Order[] | null>(null);
  const install = useInstallPrompt();

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    loadActiveOrders().then((rows) => setCachedOrders(rows as Order[]));
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);


  useEffect(() => {
    installAudioUnlocker();
    requestNotificationPermission();
    const t = window.setInterval(() => setAudioReady(isAudioUnlocked()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const { data: orders } = useQuery({
    queryKey: ["driver-orders", me?.tenantId, me?.user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, total_iqd, delivery_fee_iqd, customer_phone, customer_address, delivery_lat, delivery_lng, driver_id, created_at")
        .eq("driver_id", me!.user.id)
        .in("status", ["on_the_way"])
        .order("created_at", { ascending: false });
      return (data ?? []) as Order[];
    },
    enabled: !!me?.tenantId && me?.isDriver,
    refetchInterval: 8000,
  });

  // Route points are stored only while the driver has a delivery in progress.
  const locTracker = useDriverLocationTracker({
    driverId: me?.user.id,
    tenantId: me?.tenantId,
    enabled: !!me?.isDriver && ((orders?.length ?? cachedOrders?.length ?? 0) > 0),
  });

  // Realtime + alert on new assignments
  useEffect(() => {
    if (!me?.user.id) return;
    const ch = supabase.channel(`driver-${me.user.id}`).on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "orders", filter: `driver_id=eq.${me.user.id}` },
      (payload) => {
        const row = payload.new as { id: string; status: string; order_number: string };
        if (row.status === "on_the_way" && !knownIds.current.has(row.id)) {
          knownIds.current.add(row.id);
          alertBeep();
          toast.success(`طلب جديد #${row.order_number}`);
          showNotification("طلب توصيل جديد", `#${row.order_number}`);
        }
        qc.invalidateQueries({ queryKey: ["driver-orders"] });
      },
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me?.user.id, qc]);

  // Seed known ids so we don't alert on initial load; also cache to IDB
  useEffect(() => {
    if (!orders) return;
    if (knownIds.current.size === 0) orders.forEach((o) => knownIds.current.add(o.id));
    saveActiveOrders(orders);
    setCachedOrders(orders);
  }, [orders]);

  // Drain any pending offline actions when connection returns
  useEffect(() => {
    if (!isOnline) return;
    const pending = getPending();
    if (pending.length === 0) return;
    (async () => {
      for (const p of pending) {
        try {
          const { error } = await supabase.from("orders").update({ status: p.status as any }).eq("id", p.orderId);
          if (!error) removePending(p.id);
        } catch { /* keep queued */ }
      }
      qc.invalidateQueries({ queryKey: ["driver-orders"] });
      toast.success("تمت مزامنة التحديثات المؤجّلة");
    })();
  }, [isOnline, qc]);

  const deliver = useMutation({
    mutationFn: async (orderId: string) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        addPending({ orderId, status: "delivered" });
        throw new Error("__OFFLINE_QUEUED__");
      }
      const { error } = await supabase
        .from("orders")
        .update({ status: "delivered" })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver-orders"] });
      toast.success("تم تسليم الطلب!");
    },
    onError: (e: Error) => {
      if (e.message === "__OFFLINE_QUEUED__") {
        toast.info("تم حفظ التسليم — سيُرسل عند رجوع الاتصال");
      } else {
        toast.error(e.message);
      }
    },
  });


  if (isLoading) return null;

  const user = { name: me?.profile?.full_name, email: me?.user.email };

  if (!me?.isDriver || !me?.tenantId) {
    return (
      <DashboardShell title="لوحة المندوب" subtitle="مندوب" nav={NAV} user={user}>
        <div className="mx-auto max-w-xl rounded-2xl border border-primary/30 bg-lime/20 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h2 className="text-xl font-black">حسابك غير مفعّل كمندوب</h2>
          <p className="mt-2 text-sm text-foreground/70">
            اطلب من إدارة المطعم منحك صلاحية "مندوب" وربطك بالمطعم.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const mine = orders ?? cachedOrders ?? [];

  return (
    <DashboardShell title="لوحة المندوب" subtitle="مندوب" nav={NAV} user={user}>
      <PageHeader title="طلبات التوصيل" subtitle="الطلبات المُسندة إليك من المطعم." action={
        <button
          onClick={() => setSupportOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold hover:bg-muted"
        ><LifeBuoy className="h-3.5 w-3.5" /> إبلاغ</button>
      } />

      <div className={`mb-4 flex items-center justify-between gap-2 rounded-2xl border p-3 text-xs ${
        locTracker.status === "watching" ? "border-primary/30 bg-primary/5 text-primary"
        : locTracker.status === "denied" ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-border bg-muted/40 text-muted-foreground"
      }`}>
        <div className="flex items-center gap-2 font-bold">
          <Navigation className="h-3.5 w-3.5" />
          {locTracker.status === "watching" ? "موقعك يُشارَك مع المطعم والزبون" :
           locTracker.status === "denied" ? "لم يتم منح إذن الموقع — لن يشوفك الزبون" :
           locTracker.status === "unsupported" ? "متصفحك لا يدعم الموقع" :
           "جاري تهيئة تتبّع الموقع..."}
        </div>
        {locTracker.lastUpdate && <span className="opacity-70">آخر تحديث: {locTracker.lastUpdate.toLocaleTimeString("ar-IQ")}</span>}
      </div>

      {!isOnline && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-50 p-3 text-xs font-bold text-amber-900">
          <WifiOff className="h-4 w-4" />
          أنت غير متصل — يتم عرض آخر الطلبات المحفوظة، وأي تحديث سيُرسل تلقائياً عند رجوع الإنترنت.
        </div>
      )}

      {install.canInstall && !install.installed && (
        <button
          onClick={install.install}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/5 py-3 text-sm font-bold text-primary hover:bg-primary/10"
        >
          <Download className="h-4 w-4" /> ثبّت تطبيق المندوب على جهازك — إشعارات فورية وطلبات أوفلاين
        </button>
      )}


      {!audioReady && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <button
            onClick={() => { unlockAudio(); beep(900, 200); setAudioReady(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600"
          ><Volume2 className="h-4 w-4" /> تفعيل التنبيهات</button>
          <span>اضغط مرة واحدة لتشغيل صوت التنبيه عند وصول طلب جديد.</span>
        </div>
      )}

      {mine.length === 0 ? (
        <EmptyState icon={Bike} title="لا طلبات نشطة الآن" hint="سيصلك تنبيه فور إسناد طلب لك من المطعم." />
      ) : (
        <div className="grid gap-3">
          {mine.map((o) => (
            <div key={o.id}>
              <OrderCard
                o={o}
                actionLabel="تم التسليم"
                onAction={() => deliver.mutate(o.id)}
                onChat={() => setChatFor(chatFor === o.id ? null : o.id)}
                chatOpen={chatFor === o.id}
                highlight
              />
              {chatFor === o.id && me?.tenantId && (
                <div className="mt-2">
                  <OrderChat orderId={o.id} tenantId={me.tenantId} myRole="driver" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {me?.tenantId && <DriverStatsPanel tenantId={me.tenantId} />}
      {me?.tenantId && <DriverCashPanel tenantId={me.tenantId} />}
      {me?.tenantId && <DriverHistoryPanel />}

      <SupportTicketDialog
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        tenantId={me?.tenantId ?? null}
        defaultTarget="tenant"
      />
    </DashboardShell>
  );
}

function DriverStatsPanel({ tenantId }: { tenantId: string }) {
  const { data: summary } = useQuery({
    queryKey: ["driver-delivery-summary", tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("driver_delivery_summary", { _tenant_id: tenantId });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as {
        delivered_orders: number; delivery_distance_km: number; cash_due_iqd: number; delivery_earnings_iqd: number;
      } | null;
    },
    refetchInterval: 15000,
  });
  const cards = [
    { label: "طلبات تم توصيلها", value: new Intl.NumberFormat("ar-IQ").format(summary?.delivered_orders ?? 0), Icon: Bike },
    { label: "المسافة المقطوعة", value: `${(summary?.delivery_distance_km ?? 0).toFixed(1)} كم`, Icon: RouteIcon },
    { label: "ذمة النقد الحالية", value: formatIQD(summary?.cash_due_iqd ?? 0), Icon: Banknote },
    { label: "صافي ربح التوصيل", value: formatIQD(summary?.delivery_earnings_iqd ?? 0), Icon: BadgeDollarSign },
  ];
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, Icon }) => (
        <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
          <Icon className="mb-2 h-5 w-5 text-primary" />
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-xl font-black text-primary">{value}</div>
        </div>
      ))}
    </div>
  );
}

function DriverCashPanel({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const { data: owed } = useQuery({
    queryKey: ["driver-owed", tenantId],
    queryFn: async () => {
      const [{ data: summary, error }, { count }] = await Promise.all([
        (supabase.rpc as any)("driver_delivery_summary", { _tenant_id: tenantId }),
        (supabase.from("driver_orders_history_view") as any)
          .select("id", { count: "exact", head: true }).eq("status", "delivered").eq("payment_collected", false),
      ]);
      if (error) throw error;
      const row = Array.isArray(summary) ? summary[0] : summary;
      return { count: count ?? 0, amount: row?.cash_due_iqd ?? 0 };
    },
    refetchInterval: 15000,
  });

  const { data: mine } = useQuery({
    queryKey: ["driver-my-settlements"],
    queryFn: async () => {
      const { data } = await (supabase.from("driver_settlements") as any)
        .select("id, amount_iqd, status, driver_note, owner_note, created_at")
        .order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const request = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)("driver_request_settlement", {
        _tenant_id: tenantId, _amount_iqd: parseInt(amount) || 0, _note: note || null,
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver-my-settlements"] });
      qc.invalidateQueries({ queryKey: ["driver-owed"] });
      qc.invalidateQueries({ queryKey: ["driver-delivery-summary"] });
      setAmount(""); setNote("");
      toast.success("تم إرسال طلب التسديد للمطعم للموافقة");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-3 flex items-center gap-2 text-lg font-black">
        <Wallet className="h-5 w-5 text-primary" /> ذمة النقد
      </h3>
      {owed && owed.count > 0 && (
        <div className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          عليك <b>{new Intl.NumberFormat("ar-IQ").format(owed.amount)} د.ع</b> من <b>{owed.count}</b> طلب. التسديد الجزئي يُخصم فقط من المبلغ الذي دفعته.
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="المبلغ (د.ع)"
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" dir="ltr"
        />
        <input
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="ملاحظة (اختياري)"
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => request.mutate()}
          disabled={!amount || request.isPending}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >طلب تسديد</button>
      </div>
      {mine && mine.length > 0 && (
        <div className="mt-3 space-y-1.5 text-xs">
          {mine.slice(0, 5).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-1.5">
              <span className={`rounded-full px-2 py-0.5 font-bold ${
                s.status === "approved" || s.status === "paid" ? "bg-emerald-100 text-emerald-800" :
                s.status === "rejected" ? "bg-destructive/10 text-destructive" :
                "bg-amber-100 text-amber-800"
              }`}>
                {s.status === "approved" || s.status === "paid" ? "مقبول" :
                 s.status === "rejected" ? "مرفوض" : "بانتظار المطعم"}
              </span>
              <span className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString("ar-IQ")}</span>
              <span className="font-bold">{new Intl.NumberFormat("ar-IQ").format(s.amount_iqd)} د.ع</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DriverHistoryPanel() {
  const { data: history } = useQuery({
    queryKey: ["driver-history-view"],
    queryFn: async () => {
      const { data } = await (supabase.from("driver_orders_history_view") as any)
        .select("id, order_number, total_iqd, status, delivered_at, customer_address, pii_masked")
        .in("status", ["delivered", "cancelled"])
        .order("delivered_at", { ascending: false, nullsFirst: false })
        .limit(15);
      return data ?? [];
    },
  });
  if (!history || history.length === 0) return null;
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-3 flex items-center gap-2 text-lg font-black">
        <History className="h-5 w-5 text-primary" /> سجل طلباتي
      </h3>
      <div className="space-y-1.5 text-sm">
        {history.map((o: any) => (
          <div key={o.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {o.delivered_at ? new Date(o.delivered_at).toLocaleDateString("ar-IQ") : "—"}
            </span>
            <span className="truncate max-w-[50%] text-xs">
              {o.pii_masked ? <span className="italic text-muted-foreground">— بيانات مخفية —</span> : (o.customer_address ?? "—")}
            </span>
            <span className="font-mono font-bold text-primary">#{o.order_number}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">
        بيانات الزبون تُخفى تلقائياً بعد 12 ساعة من التوصيل حفاظاً على الخصوصية.
      </p>
    </div>
  );
}


function OrderCard({
  o, actionLabel, onAction, onChat, chatOpen, highlight,
}: {
  o: Order; actionLabel: string; onAction: () => void; onChat: () => void; chatOpen: boolean; highlight?: boolean;
}) {
  const destinationUrl = Number.isFinite(o.delivery_lat) && Number.isFinite(o.delivery_lng)
    ? `https://www.google.com/maps/dir/?api=1&destination=${o.delivery_lat},${o.delivery_lng}`
    : null;

  return (
    <div className={`rounded-2xl border p-5 shadow-[var(--shadow-soft)] ${
      highlight ? "border-primary bg-primary/5" : "border-border bg-card"
    }`}>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">#{o.order_number}</div>
          <div className="mt-1 text-lg font-black text-primary">{formatIQD(o.total_iqd)}</div>
          {o.delivery_fee_iqd > 0 && (
            <div className="text-xs text-muted-foreground">
              أجرة التوصيل: {formatIQD(o.delivery_fee_iqd)}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-1 text-sm text-muted-foreground">
        {o.customer_address && (destinationUrl ? (
          <a
            href={destinationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="فتح وجهة الزبون على الخريطة"
          >
            <MapPin className="h-3.5 w-3.5" />
            <span className="break-words">{o.customer_address}</span>
          </a>
        ) : <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="break-words">{o.customer_address}</span></div>)}
        {destinationUrl && (
          <a href={destinationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Navigation className="h-3.5 w-3.5" /> ابدأ الملاحة إلى الزبون ←
          </a>
        )}
        {o.customer_phone && (
          <a href={`tel:${o.customer_phone}`} className="flex items-center gap-2 text-primary hover:underline">
            <Phone className="h-3.5 w-3.5" />
            <span dir="ltr">{o.customer_phone}</span>
          </a>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={onChat}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold ${
            chatOpen ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"
          }`}
        ><MessageCircle className="h-3.5 w-3.5" /> {chatOpen ? "إخفاء الشات" : "شات الزبون"}</button>
        <button
          onClick={onAction}
          className="flex-1 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          {actionLabel} ←
        </button>
      </div>
    </div>
  );
}
