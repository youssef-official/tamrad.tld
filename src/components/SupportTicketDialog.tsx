import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useMe";
import { X, LifeBuoy } from "lucide-react";
import { toast } from "sonner";

export function SupportTicketDialog({
  open,
  onClose,
  tenantId,
  orderId,
  defaultTarget = "tenant",
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string | null;
  orderId?: string | null;
  defaultTarget?: "tenant" | "platform";
}) {
  const { data: me } = useMe();
  const [target, setTarget] = useState<"tenant" | "platform">(defaultTarget);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function submit() {
    if (!me?.user.id || !subject.trim() || !body.trim() || saving) return;
    setSaving(true);
    try {
      const role = me.isDriver ? "driver" : me.isOwner ? "owner" : "customer";
      const { error } = await (supabase.from("support_tickets") as any).insert({
        reporter_id: me.user.id,
        reporter_role: role,
        tenant_id: target === "tenant" ? tenantId : null,
        order_id: orderId ?? null,
        target,
        subject: subject.trim(),
        body: body.trim(),
      });
      if (error) throw error;
      toast.success("تم إرسال بلاغك — سنرد عليك قريباً.");
      setSubject(""); setBody("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الإرسال");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-black">
            <LifeBuoy className="h-5 w-5 text-primary" /> إبلاغ عن مشكلة
          </h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-bold">نوع البلاغ</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTarget("tenant")}
              className={`rounded-xl border p-2 text-xs font-bold ${
                target === "tenant" ? "border-primary bg-primary/5 text-primary" : "border-border"
              }`}
            >مشكلة في المطعم</button>
            <button
              type="button"
              onClick={() => setTarget("platform")}
              className={`rounded-xl border p-2 text-xs font-bold ${
                target === "platform" ? "border-primary bg-primary/5 text-primary" : "border-border"
              }`}
            >مشكلة في المنصة</button>
          </div>
        </div>

        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="عنوان البلاغ"
          className="mb-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="اشرح المشكلة بالتفصيل..."
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />

        <button
          onClick={submit}
          disabled={!subject.trim() || !body.trim() || saving}
          className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "جاري الإرسال..." : "إرسال البلاغ"}
        </button>
      </div>
    </div>
  );
}
