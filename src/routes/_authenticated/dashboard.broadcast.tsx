import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useMe";
import { PageHeader, EmptyState } from "@/components/DashboardShell";
import { Bell, Send, Users, CheckCircle2, History, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/broadcast")({
  component: BroadcastPage,
});

type Broadcast = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

function BroadcastPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const tenantId = me?.tenantId;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // Fetch previous broadcasts
  const { data: broadcasts = [], isLoading } = useQuery({
    queryKey: ["dashboard-broadcasts", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("broadcast_notifications") as any)
        .select("id, title, body, created_at")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Broadcast[];
    },
  });

  // Fetch total unique customers for this tenant
  const { data: customerCount = 0 } = useQuery({
    queryKey: ["tenant-customer-count", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("customer_phone")
        .eq("tenant_id", tenantId!);
      const set = new Set((data ?? []).map((o) => o.customer_phone).filter(Boolean));
      return set.size;
    },
  });

  // Send broadcast mutation
  const sendBroadcast = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !body.trim()) {
        throw new Error("يرجى كتابة عنوان ورسالة الإشعار");
      }
      const { error } = await (supabase.from("broadcast_notifications") as any).insert({
        tenant_id: tenantId!,
        sender_id: me?.user.id,
        title: title.trim(),
        body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إرسال الإشعار لجميع الزبائن بنجاح!");
      setTitle("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["dashboard-broadcasts"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="إرسال الإشعارات الجماعية"
        subtitle="أرسل تنبيهات وعروضاً مباشرة لجميع زبائن مطعمك على هواتفهم."
      />

      {/* Stats banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-primary">{customerCount} زبون</div>
            <div className="text-xs text-muted-foreground">إجمالي الزبائن المسجلين في هذا المطعم</div>
          </div>
        </div>
        <div className="rounded-xl border border-primary/20 bg-background px-4 py-2 text-xs font-bold text-primary">
          إشعارات غير محدودة • مجاناً
        </div>
      </div>

      {/* Compose Form */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
          <Send className="h-5 w-5 text-primary" /> إنشاء إشعار جديد
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendBroadcast.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1.5 block text-sm font-bold">عنوان الإشعار *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: 💥 خصم 20% على جميع الوجبات اليوم فقط!"
              required
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold">محتوى الرسالة *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="اكتب تفاصيل العرض أو الرسالة التي ترغب بإرسالها للزبائن..."
              rows={4}
              required
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              * سيظهر هذا الإشعار للزبائن في تطبيق المطعم وفي شاشة التنبيهات.
            </p>
            <button
              type="submit"
              disabled={sendBroadcast.isPending || !title.trim() || !body.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sendBroadcast.isPending ? "جاري الإرسال..." : "إرسال الإشعار الآن"}
            </button>
          </div>
        </form>
      </div>

      {/* History */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
          <History className="h-5 w-5 text-primary" /> سجل الإشعارات المرسلة سابقاً
        </h2>

        {broadcasts.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="لم تقم بإرسال أي إشعارات بعد"
            hint="استخدم النموذج أعلاه لتواصل فورياً مع جميع زبائن مطعمك."
          />
        ) : (
          <div className="divide-y divide-border">
            {broadcasts.map((b) => (
              <div key={b.id} className="py-4 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-black text-foreground">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    {b.title}
                  </div>
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {new Date(b.created_at).toLocaleString("ar-IQ")}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {b.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
