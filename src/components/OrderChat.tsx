import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useMe";
import { MessageCircle, Send, MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";

type Message = {
  id: string;
  order_id: string;
  sender_id: string;
  sender_role: "customer" | "driver" | "owner";
  content: string;
  created_at: string;
};

const ROLE_LABEL: Record<Message["sender_role"], string> = {
  customer: "الزبون",
  driver: "المندوب",
  owner: "المطعم",
};

export function OrderChat({
  orderId,
  tenantId,
  myRole,
  disabled,
}: {
  orderId: string;
  tenantId: string;
  myRole: "customer" | "driver" | "owner";
  disabled?: boolean;
}) {
  const { data: me } = useMe();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase.from("order_messages") as any)
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (!cancelled) setMessages((data ?? []) as Message[]);
    })();

    const ch = supabase
      .channel(`chat-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          setMessages((prev) => {
            const m = payload.new as Message;
            if (prev.some((p) => p.id === m.id)) return prev;
            return [...prev, m];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [orderId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function sendRaw(content: string) {
    if (!me?.user.id) return;
    const { error } = await (supabase.from("order_messages") as any).insert({
      order_id: orderId,
      tenant_id: tenantId,
      sender_id: me.user.id,
      sender_role: myRole,
      content,
    });
    if (error) throw error;
  }

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await sendRaw(content);
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر إرسال الرسالة");
    } finally {
      setSending(false);
    }
  }

  async function shareLocation() {
    if (sending) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("جهازك لا يدعم مشاركة الموقع");
      return;
    }
    setSending(true);
    const toastId = toast.loading("جاري تحديد موقعك...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await sendRaw(`📍LOC:${pos.coords.latitude},${pos.coords.longitude}`);
          toast.success("تم مشاركة موقعك مع المندوب", { id: toastId });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "تعذر مشاركة الموقع", { id: toastId });
        } finally {
          setSending(false);
        }
      },
      () => {
        toast.error("لم نتمكن من الوصول لموقعك — تأكد من السماح للتطبيق بالموقع", { id: toastId });
        setSending(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageCircle className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold">محادثة الطلب</span>
        <span className="mr-auto text-[10px] text-muted-foreground">تُحذف تلقائياً عند تسليم الطلب</span>
      </div>
      <div ref={scrollRef} className="max-h-64 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">لا رسائل بعد — ابدأ المحادثة.</div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === me?.user.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {!mine && (
                    <div className="mb-0.5 text-[10px] font-bold opacity-70">{ROLE_LABEL[m.sender_role]}</div>
                  )}
                  <MessageBody content={m.content} mine={mine} />
                  <div className={`mt-1 text-[9px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {!disabled && (
        <div className="flex gap-2 border-t border-border p-2">
          {myRole === "customer" && (
            <button
              onClick={shareLocation}
              disabled={sending}
              title="مشاركة موقعي مع المندوب"
              className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-primary transition hover:bg-primary/20 disabled:opacity-50"
            >
              <MapPin className="h-4 w-4" />
            </button>
          )}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="اكتب رسالة..."
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="rounded-xl bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function MessageBody({ content, mine }: { content: string; mine: boolean }) {
  const loc = content.match(/^📍LOC:(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
  if (loc) {
    const url = `https://www.google.com/maps?q=${loc[1]},${loc[2]}`;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-0.5 inline-flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-bold ${
          mine ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary/10 text-primary"
        }`}
      >
        <Navigation className="h-3.5 w-3.5" />
        فتح الموقع المشارك على الخريطة ←
      </a>
    );
  }
  return <div className="whitespace-pre-wrap break-words">{content}</div>;
}
