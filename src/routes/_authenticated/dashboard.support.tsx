import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useMe";
import { PageHeader, EmptyState } from "@/components/DashboardShell";
import { LifeBuoy, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard/support")({
  component: SupportPage,
});

type Ticket = {
  id: string;
  reporter_id: string;
  reporter_role: string;
  order_id: string | null;
  subject: string;
  body: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  resolution_note: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<Ticket["status"], string> = {
  open: "جديد",
  in_progress: "قيد المعالجة",
  resolved: "تم الحل",
  closed: "مغلق",
};

function SupportPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const tenantId = me?.tenantId;
  const [filter, setFilter] = useState<"all" | Ticket["status"]>("all");

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support-tickets", tenantId, filter],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = (supabase.from("support_tickets") as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data } = await q;
      return (data ?? []) as Ticket[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: Ticket["status"]; note?: string }) => {
      const patch: any = { status };
      if (note !== undefined) patch.resolution_note = note;
      const { error } = await (supabase.from("support_tickets") as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success("تم تحديث البلاغ");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = {
    open: (tickets ?? []).filter((t) => t.status === "open").length,
    in_progress: (tickets ?? []).filter((t) => t.status === "in_progress").length,
    resolved: (tickets ?? []).filter((t) => t.status === "resolved").length,
  };

  return (
    <>
      <PageHeader title="البلاغات والدعم الفني" subtitle="بلاغات الزبائن والمناديب المتعلقة بمطعمك." />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FilterCard active={filter === "all"} onClick={() => setFilter("all")} label="الكل" count={tickets?.length ?? 0} />
        <FilterCard active={filter === "open"} onClick={() => setFilter("open")} label="جديد" count={counts.open} accent="destructive" />
        <FilterCard active={filter === "in_progress"} onClick={() => setFilter("in_progress")} label="قيد المعالجة" count={counts.in_progress} accent="amber" />
        <FilterCard active={filter === "resolved"} onClick={() => setFilter("resolved")} label="تم الحل" count={counts.resolved} accent="primary" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !tickets || tickets.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="لا بلاغات" hint="يظهر هنا أي بلاغ من الزبائن أو المناديب." />
      ) : (
        <div className="grid gap-3">
          {tickets.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">
                    من {t.reporter_role === "customer" ? "زبون" : t.reporter_role === "driver" ? "مندوب" : "مستخدم"}
                    {" • "}
                    {new Date(t.created_at).toLocaleString("ar-IQ")}
                  </div>
                  <h3 className="mt-1 text-lg font-black">{t.subject}</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                  t.status === "open" ? "bg-destructive/10 text-destructive"
                  : t.status === "in_progress" ? "bg-amber-500/15 text-amber-600"
                  : "bg-primary/10 text-primary"
                }`}>{STATUS_LABEL[t.status]}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground/80">{t.body}</p>
              {t.resolution_note && (
                <div className="mt-2 rounded-lg bg-lime/10 p-2 text-xs text-primary">
                  ردّك: {t.resolution_note}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {t.status === "open" && (
                  <button
                    onClick={() => updateStatus.mutate({ id: t.id, status: "in_progress" })}
                    className="rounded-xl border border-amber-500 px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-500/10"
                  >
                    <Clock className="ml-1 inline h-3.5 w-3.5" /> بدء المعالجة
                  </button>
                )}
                {t.status !== "resolved" && t.status !== "closed" && (
                  <button
                    onClick={() => {
                      const note = window.prompt("ملاحظة الحل (اختياري):") ?? undefined;
                      updateStatus.mutate({ id: t.id, status: "resolved", note });
                    }}
                    className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                  >
                    <CheckCircle2 className="ml-1 inline h-3.5 w-3.5" /> تم الحل
                  </button>
                )}
                {t.status === "resolved" && (
                  <button
                    onClick={() => updateStatus.mutate({ id: t.id, status: "closed" })}
                    className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold"
                  >إغلاق</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function FilterCard({ active, onClick, label, count, accent }: {
  active: boolean; onClick: () => void; label: string; count: number; accent?: "destructive" | "amber" | "primary";
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-3 text-right transition-all ${
        active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-card hover:bg-muted"
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-black ${
        accent === "destructive" ? "text-destructive"
        : accent === "amber" ? "text-amber-600"
        : accent === "primary" ? "text-primary"
        : ""
      }`}>{count}</div>
    </button>
  );
}
