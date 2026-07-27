import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, formatIQD } from "@/lib/useMe";
import { EmptyState, PageHeader } from "@/components/DashboardShell";
import { Wallet, Check, X, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard/settlements")({
  component: SettlementsPage,
});

type Settlement = {
  id: string;
  driver_id: string;
  order_id: string | null;
  amount_iqd: number;
  status: "pending" | "paid" | "pending_approval" | "approved" | "rejected";
  driver_note: string | null;
  owner_note: string | null;
  note: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  settled_at: string | null;
};

function SettlementsPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const tenantId = me?.tenantId;

  const { data: rows } = useQuery({
    queryKey: ["settlements-v2", tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("driver_settlements") as any)
        .select("*").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Settlement[];
    },
    enabled: !!tenantId,
    refetchInterval: 15000,
  });

  const { data: drivers } = useQuery({
    queryKey: ["settle-drivers", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("driver_credentials")
        .select("user_id, driver_name").eq("tenant_id", tenantId!);
      return (data ?? []) as { user_id: string; driver_name: string }[];
    },
  });

  const [noteFor, setNoteFor] = useState<{ id: string; approve: boolean } | null>(null);
  const [ownerNote, setOwnerNote] = useState("");

  const approve = useMutation({
    mutationFn: async (v: { id: string; approve: boolean; note: string }) => {
      const { data, error } = await (supabase.rpc as any)("owner_approve_settlement", {
        _settlement_id: v.id, _approve: v.approve, _note: v.note || null,
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settlements-v2"] });
      qc.invalidateQueries({ queryKey: ["driver-owed"] });
      qc.invalidateQueries({ queryKey: ["driver-delivery-summary"] });
      toast.success("تم تحديث الطلب");
      setNoteFor(null); setOwnerNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rowsAll = rows ?? [];
  const pending = rowsAll.filter((r) => r.status === "pending_approval");
  const totalPendingAmt = pending.reduce((s, r) => s + r.amount_iqd, 0);

  function driverName(id: string) {
    return drivers?.find((d) => d.user_id === id)?.driver_name ?? id.slice(0, 8);
  }

  return (
    <>
      <PageHeader title="تسويات المناديب" subtitle="طلبات التسديد من المناديب تنتظر موافقتك." />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-primary/30 bg-lime/10 p-5">
          <div className="text-sm text-muted-foreground">بانتظار موافقتك</div>
          <div className="mt-1 text-3xl font-black text-primary">{formatIQD(totalPendingAmt)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{pending.length} طلب</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">إجمالي السجلات</div>
          <div className="mt-1 text-3xl font-black">{rowsAll.length}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-sm text-muted-foreground">مقبولة</div>
          <div className="mt-1 text-3xl font-black text-emerald-600">
            {rowsAll.filter((r) => r.status === "approved" || r.status === "paid").length}
          </div>
        </div>
      </div>

      {rowsAll.length === 0 ? (
        <EmptyState icon={Wallet} title="لا تسويات بعد" hint="عندما يطلب المندوب تسديد، يظهر الطلب هنا للموافقة." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs">
              <tr>
                <th className="p-3 text-right">التاريخ</th>
                <th className="p-3 text-right">المندوب</th>
                <th className="p-3 text-right">المبلغ</th>
                <th className="p-3 text-right">ملاحظة المندوب</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3 text-right">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {rowsAll.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 text-xs">{new Date(r.created_at).toLocaleString("ar-IQ")}</td>
                  <td className="p-3 font-bold">{driverName(r.driver_id)}</td>
                  <td className="p-3 font-black text-primary">{formatIQD(r.amount_iqd)}</td>
                  <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">{r.driver_note ?? r.note ?? "—"}</td>
                  <td className="p-3">
                    <StatusPill status={r.status} />
                    {r.owner_note && <div className="mt-1 text-[10px] text-muted-foreground">ملاحظتك: {r.owner_note}</div>}
                  </td>
                  <td className="p-3">
                    {r.status === "pending_approval" ? (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => { setNoteFor({ id: r.id, approve: true }); setOwnerNote(""); }}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-600"
                        ><Check className="h-3 w-3" /> موافقة</button>
                        <button
                          onClick={() => { setNoteFor({ id: r.id, approve: false }); setOwnerNote(""); }}
                          className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground hover:bg-destructive/90"
                        ><X className="h-3 w-3" /> رفض</button>
                      </div>
                    ) : r.status === "pending" ? (
                      // Legacy manual entries: just mark paid via direct update
                      <span className="text-xs text-muted-foreground">— يدوي —</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {r.approved_at && new Date(r.approved_at).toLocaleDateString("ar-IQ")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {noteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setNoteFor(null)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-black">
              {noteFor.approve ? "قبول التسديد" : "رفض التسديد"}
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              {noteFor.approve
                ? "يُخصم مبلغ هذا الطلب فقط من ذمة المندوب؛ لا تُصفّى الذمة كاملة إلا إذا غطّى المبلغ كل المستحق."
                : "اكتب سبب الرفض ليصل للمندوب."}
            </p>
            <textarea
              value={ownerNote}
              onChange={(e) => setOwnerNote(e.target.value)}
              rows={3}
              placeholder={noteFor.approve ? "ملاحظة (اختياري)" : "سبب الرفض"}
              className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary"
            />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setNoteFor(null)} className="flex-1 rounded-xl border py-2 text-sm font-bold">إلغاء</button>
              <button
                disabled={!noteFor.approve && !ownerNote.trim() || approve.isPending}
                onClick={() => approve.mutate({ id: noteFor.id, approve: noteFor.approve, note: ownerNote.trim() })}
                className={`flex-1 rounded-xl py-2 text-sm font-bold text-white disabled:opacity-60 ${
                  noteFor.approve ? "bg-emerald-500 hover:bg-emerald-600" : "bg-destructive hover:bg-destructive/90"
                }`}
              >تأكيد</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatusPill({ status }: { status: Settlement["status"] }) {
  const cfg: Record<Settlement["status"], { label: string; cls: string; Icon: any }> = {
    pending: { label: "معلّق", cls: "bg-amber-100 text-amber-800", Icon: Clock },
    pending_approval: { label: "بانتظار موافقتك", cls: "bg-amber-100 text-amber-800", Icon: Clock },
    approved: { label: "مقبول ومُسدَّد", cls: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 },
    paid: { label: "مسدَّد", cls: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 },
    rejected: { label: "مرفوض", cls: "bg-destructive/10 text-destructive", Icon: XCircle },
  };
  const c = cfg[status];
  const Icon = c.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${c.cls}`}>
      <Icon className="h-3 w-3" /> {c.label}
    </span>
  );
}
