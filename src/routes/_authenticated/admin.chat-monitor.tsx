import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Store, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/chat-monitor")({
  component: ChatMonitorPage,
});

function ChatMonitorPage() {
  const [tenantId, setTenantId] = useState<string>("");
  const [driverId, setDriverId] = useState<string>("");
  const [orderId, setOrderId] = useState<string>("");

  const { data: tenants = [] } = useQuery({
    queryKey: ["admin", "tenants-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["admin", "chat-drivers", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("driver_credentials")
        .select("user_id, driver_name")
        .eq("tenant_id", tenantId)
        .order("driver_name");
      return data ?? [];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["admin", "chat-orders", tenantId, driverId],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, order_number, status, created_at, customer_id, driver_id, customer_phone")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (driverId) {
        q = q.eq("driver_id", driverId);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["admin", "chat-messages", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      // Live chat (active orders) + archived chat (closed orders are
      // archive-purged from participants' view but kept for admins).
      const [liveRes, archivedRes] = await Promise.all([
        supabase
          .from("order_messages")
          .select("*")
          .eq("order_id", orderId)
          .order("created_at", { ascending: true }),
        (supabase.from("order_messages_archive" as any) as any)
          .select("*")
          .eq("order_id", orderId)
          .order("created_at", { ascending: true }),
      ]);
      const seen = new Set<string>();
      return [...(liveRes.data ?? []), ...((archivedRes.data ?? []) as any[])]
        .filter((m: any) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        })
        .sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
    },
  });

  const orderInfo = useMemo(() => orders.find((o: any) => o.id === orderId), [orders, orderId]);
  const orderClosed =
    !!orderInfo && ["delivered", "cancelled", "rejected"].includes((orderInfo as any).status);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-black text-foreground">
          <MessageSquare className="h-6 w-6 text-primary" />
          مراقبة المحادثات
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          نظام رقابي شامل لضمان جودة الخدمة وحل النزاعات (المطعم ← المندوب ← الزبون).
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-bold">1. المطعم</span>
          <select
            value={tenantId}
            onChange={(e) => {
              setTenantId(e.target.value);
              setDriverId("");
              setOrderId("");
            }}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
          >
            <option value="">— اختر مطعم —</option>
            {tenants.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-bold">2. المندوب (اختياري)</span>
          <select
            value={driverId}
            onChange={(e) => {
              setDriverId(e.target.value);
              setOrderId("");
            }}
            disabled={!tenantId}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm disabled:opacity-50"
          >
            <option value="">— جميع المناديب —</option>
            {drivers.map((d: any) => (
              <option key={d.user_id} value={d.user_id}>
                {d.driver_name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-bold">3. الزبون / الطلب</span>
          <select
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            disabled={!tenantId}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm disabled:opacity-50"
          >
            <option value="">— اختر طلب —</option>
            {orders.map((o: any) => (
              <option key={o.id} value={o.id}>
                #{o.order_number} · {o.customer_phone ?? "زبون"} · {o.status}
              </option>
            ))}
          </select>
        </label>
      </div>

      {orderInfo && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              طلب #{(orderInfo as any).order_number}
              {orderClosed && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  محادثة مؤرشفة (الطلب مغلق)
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{messages.length} رسالة</div>
          </div>

          {messages.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              لا توجد رسائل في هذا الطلب
            </div>
          ) : (
            <ul className="space-y-2">
              {messages.map((m: any) => {
                const isDriver = m.sender_role === "driver";
                const isCustomer = m.sender_role === "customer";
                return (
                  <li
                    key={m.id}
                    className={`flex gap-2 rounded-xl border border-border p-3 ${
                      isDriver ? "bg-primary/5" : "bg-muted/30"
                    }`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background">
                      {isDriver ? <Store className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-bold">
                          {isDriver ? "السائق" : isCustomer ? "الزبون" : m.sender_role}
                        </span>
                        <span dir="ltr">{new Date(m.created_at).toLocaleString("ar-IQ")}</span>
                      </div>
                      <div className="whitespace-pre-wrap text-sm text-foreground">
                        {m.content ?? "—"}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
