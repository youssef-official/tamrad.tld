import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatIQD, useMe } from "@/lib/useMe";
import { CheckCircle2, Clock, Bike, ChefHat, Package, XCircle, Star, LifeBuoy, Navigation, RotateCcw, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { OrderChat } from "@/components/OrderChat";
import { SupportTicketDialog } from "@/components/SupportTicketDialog";
import { useDriverLocation } from "@/lib/useDriverLocation";

export const Route = createFileRoute("/_authenticated/orders/$id")({
  component: OrderTracking,
});

type OrderStatus = "pending" | "accepted" | "preparing" | "on_the_way" | "delivered" | "cancelled" | "rejected";

const STEPS: { key: OrderStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "pending", label: "استلام الطلب", icon: Clock },
  { key: "accepted", label: "قبول المطعم", icon: CheckCircle2 },
  { key: "preparing", label: "قيد التحضير", icon: ChefHat },
  { key: "on_the_way", label: "في الطريق", icon: Bike },
  { key: "delivered", label: "تم التسليم", icon: Package },
];

function customerNavigationUrl(latitude: number | null, longitude: number | null) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

function telUrl(phone: string | null) {
  const normalized = phone?.replace(/[^\d+]/g, "") ?? "";
  return normalized ? `tel:${normalized}` : null;
}

function OrderTracking() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [supportOpen, setSupportOpen] = useState(false);

  const { data: order } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  // Realtime updates instead of polling
  useEffect(() => {
    const ch = supabase.channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["order", id] });
          qc.invalidateQueries({ queryKey: ["order-driver-info", id] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  if (!order) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">جاري التحميل...</div>;
  }

  const status = order.status as OrderStatus;
  const cancelled = status === "cancelled" || status === "rejected";
  const currentIdx = STEPS.findIndex((s) => s.key === status);
  const destinationUrl = customerNavigationUrl(order.delivery_lat, order.delivery_lng);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-lg">
        <Link to="/my-orders" className="mb-6 block text-sm text-muted-foreground hover:text-primary">← طلباتي</Link>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
          <div className="mb-6 text-center">
            <div className="text-xs text-muted-foreground">رقم الطلب</div>
            <div className="mt-1 font-mono text-2xl font-black">#{order.order_number}</div>
            <div className="mt-2 text-3xl font-black text-primary">{formatIQD(order.total_iqd)}</div>
          </div>

          {cancelled ? (
            <div className="rounded-2xl bg-destructive/10 p-6 text-center">
              <XCircle className="mx-auto mb-2 h-12 w-12 text-destructive" />
              <div className="text-lg font-black text-destructive">
                {status === "cancelled" ? "تم إلغاء الطلب" : "تم رفض الطلب"}
              </div>
              {order.rejection_reason && (
                <p className="mt-2 text-sm text-muted-foreground">{order.rejection_reason}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {STEPS.map((s, i) => {
                const done = i <= currentIdx;
                const active = i === currentIdx;
                const Icon = s.icon;
                return (
                  <div key={s.key} className="flex items-center gap-4">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
                        done
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      } ${active ? "shadow-[var(--shadow-glow)] ring-4 ring-lime" : ""}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className={`font-bold ${done ? "text-foreground" : "text-muted-foreground"}`}>
                        {s.label}
                      </div>
                      {active && <div className="text-xs text-primary">جاري الآن...</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 rounded-2xl bg-muted/40 p-4 text-sm">
            <div className="mb-2 font-bold">تفاصيل التوصيل</div>
            {order.customer_address && (
              destinationUrl ? (
                <a
                  href={destinationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 text-muted-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="فتح عنوان التوصيل في الخريطة"
                >
                  <Navigation className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="break-words underline decoration-primary/40 underline-offset-4">{order.customer_address}</span>
                </a>
              ) : <p className="break-words text-muted-foreground">{order.customer_address}</p>
            )}
            {order.customer_phone && <p dir="ltr" className="text-muted-foreground">{order.customer_phone}</p>}
            {destinationUrl && (
              <a
                href={destinationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Navigation className="h-3.5 w-3.5" /> افتح وجهة الزبون على الخريطة ←
              </a>
            )}
          </div>

          {order.driver_id && !cancelled && (
            <DriverCard orderId={order.id} driverId={order.driver_id} />
          )}

          {order.driver_id && status === "on_the_way" && (
            <DriverLiveLocation driverId={order.driver_id} />
          )}

          {!cancelled && status !== "delivered" && me?.user.id === order.customer_id && (
            <div className="mt-6">
              <OrderChat orderId={order.id} tenantId={order.tenant_id} myRole="customer" />
            </div>
          )}

          {status === "delivered" && order.customer_id && <RatingBlock orderId={order.id} tenantId={order.tenant_id} customerId={order.customer_id} driverId={order.driver_id} />}

          {(status === "delivered" || cancelled) && (
            <ReorderButton tenantId={order.tenant_id} items={order.items} />
          )}


          <button
            onClick={() => setSupportOpen(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
          >
            <LifeBuoy className="h-3.5 w-3.5" /> إبلاغ عن مشكلة في هذا الطلب
          </button>
        </div>
      </div>

      <SupportTicketDialog
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        tenantId={order.tenant_id}
        orderId={order.id}
      />
    </div>
  );
}

function DriverCard({ orderId, driverId }: { orderId: string; driverId: string }) {
  const { data: info } = useQuery({
    queryKey: ["order-driver-info", orderId],
    queryFn: async () => {
      const { data } = await (supabase.rpc as any)("get_order_driver_info", { _order_id: orderId });
      return data?.ok ? (data as { driver_name: string | null; driver_phone: string | null; transferred: boolean; transferred_at: string | null }) : null;
    },
  });

  if (!info?.driver_name) return null;

  const driverTel = telUrl(info.driver_phone);

  return (
    <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Bike className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-muted-foreground">المندوب المسؤول عن طلبك</div>
          {driverTel ? (
            <a
              href={driverTel}
              className="inline-flex max-w-full items-center gap-1.5 text-base font-black text-primary underline decoration-primary/40 underline-offset-4 transition hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`اتصل بالمندوب ${info.driver_name}`}
            >
              <span className="truncate">{info.driver_name}</span>
              <Phone className="h-3.5 w-3.5 shrink-0" />
            </a>
          ) : <div className="truncate text-base font-black">{info.driver_name}</div>}
          {driverTel && <div className="mt-0.5 text-[10px] text-muted-foreground">اضغط على الاسم للاتصال</div>}
        </div>
      </div>
      {info.transferred && (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
          <RotateCcw className="h-3 w-3" />
          تم نقل طلبك إلى هذا المندوب
          {info.transferred_at && ` — ${new Date(info.transferred_at).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}`}
        </div>
      )}
    </div>
  );
}

function DriverLiveLocation({ driverId }: { driverId: string }) {
  const loc = useDriverLocation(driverId);
  if (!loc) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
        <Navigation className="mx-auto mb-1 h-4 w-4" />
        لم يبدأ المندوب مشاركة موقعه بعد.
      </div>
    );
  }
  const url = `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-6 flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm transition hover:bg-primary/10"
    >
      <div>
        <div className="flex items-center gap-2 font-bold text-primary">
          <Navigation className="h-4 w-4" /> موقع المندوب الحالي
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          آخر تحديث: {new Date(loc.updated_at).toLocaleTimeString("ar-IQ")}
        </div>
      </div>
      <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">فتح الخريطة ←</span>
    </a>
  );
}

function RatingBlock({ orderId, tenantId, customerId, driverId }: {
  orderId: string; tenantId: string; customerId: string; driverId: string | null;
}) {
  const qc = useQueryClient();
  const { data: existing } = useQuery({
    queryKey: ["rating", orderId],
    queryFn: async () => {
      const { data } = await (supabase.from("ratings") as any).select("*").eq("order_id", orderId).maybeSingle();
      return data;
    },
  });
  const [restaurant, setRestaurant] = useState(0);
  const [food, setFood] = useState(0);
  const [driver, setDriver] = useState(0);
  const [comment, setComment] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("يجب تسجيل الدخول للتقييم");
      const { error } = await (supabase.from("ratings") as any).insert({
        order_id: orderId, tenant_id: tenantId, customer_id: uid, driver_id: driverId,
        restaurant_rating: restaurant || null, food_rating: food || null,
        driver_rating: driverId ? (driver || null) : null,
        comment: comment.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("شكراً لتقييمك!"); qc.invalidateQueries({ queryKey: ["rating", orderId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  void customerId;

  if (existing) {
    return (
      <div className="mt-6 rounded-2xl border border-primary/30 bg-lime/10 p-4 text-center">
        <div className="text-sm font-bold text-primary">✓ تم تقييم هذا الطلب</div>
        {existing.comment && <p className="mt-1 text-xs text-muted-foreground">{existing.comment}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-border p-4">
      <h3 className="mb-3 flex items-center gap-2 font-black"><Star className="h-4 w-4 text-yellow-500" /> قيّم تجربتك</h3>
      <div className="space-y-3">
        <Stars label="المطعم" value={restaurant} onChange={setRestaurant} />
        <Stars label="الوجبة" value={food} onChange={setFood} />
        {driverId ? (
          <Stars label="المندوب" value={driver} onChange={setDriver} />
        ) : (
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            تقييم المندوب يظهر فقط للطلبات اللي تم تعيين مندوب لها.
          </div>
        )}
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
          placeholder="ملاحظاتك (اختياري)"
          className="w-full rounded-xl border border-input bg-background p-2 text-sm outline-none focus:border-primary" />
        <button
          disabled={!restaurant || !food || submit.isPending}
          onClick={() => submit.mutate()}
          className="w-full rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
          إرسال التقييم
        </button>
      </div>
    </div>
  );
}

function Stars({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-bold">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`transition-transform hover:scale-110 ${n <= value ? "text-yellow-500" : "text-neutral-300"}`}>
            <Star className={`h-6 w-6 ${n <= value ? "fill-current" : ""}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ReorderButton({ tenantId, items }: { tenantId: string; items: unknown }) {
  const navigate = useNavigate();
  const { data: slug } = useQuery({
    queryKey: ["tenant-slug", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("slug").eq("id", tenantId).maybeSingle();
      return data?.slug ?? null;
    },
  });
  function reorder() {
    if (!slug) { toast.error("تعذر تحديد المطعم"); return; }
    if (!Array.isArray(items) || items.length === 0) {
      toast.error("لا أصناف لإعادة طلبها"); return;
    }
    try {
      sessionStorage.setItem(`tamrad:reorder:${tenantId}`, JSON.stringify(items));
    } catch { /* ignore */ }
    toast.success("تمت إضافة أصناف الطلب السابق للسلة");
    navigate({ to: "/r/$slug", params: { slug } });
  }
  return (
    <button
      onClick={reorder}
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 py-2.5 text-sm font-bold text-primary hover:bg-primary/20"
    >
      <RotateCcw className="h-4 w-4" /> إعادة الطلب بنفس الأصناف
    </button>
  );
}
