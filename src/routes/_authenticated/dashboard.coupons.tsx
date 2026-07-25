import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, formatIQD } from "@/lib/useMe";
import { useCurrentBranch } from "@/lib/useBranch";
import { EmptyState, PageHeader } from "@/components/DashboardShell";
import { Tag, Plus, Trash2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/coupons")({
  component: CouponsPage,
});

type Coupon = {
  id: string; code: string; discount_type: "percent" | "fixed";
  discount_value: number; min_order_iqd: number; usage_limit: number | null;
  used_count: number; expires_at: string | null; is_active: boolean;
};

function CouponsPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const tenantId = me?.tenantId;
  const { current: branch, branchId } = useCurrentBranch();
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: coupons } = useQuery({
    queryKey: ["coupons", tenantId, branchId],
    queryFn: async () => {
      let q: any = (supabase.from("coupons") as any)
        .select("*").eq("tenant_id", tenantId!);
      if (branchId) q = q.or(`branch_id.eq.${branchId},branch_id.is.null`);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Coupon[];
    },
    enabled: !!tenantId,
  });


  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase.from("coupons") as any).update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons"] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("coupons") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["coupons"] }); toast.success("تم الحذف"); },
  });

  function copy(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <>
      <PageHeader title="الكوبونات والخصومات" subtitle={branch ? `كوبونات فرع ${branch.name} + الكوبونات العامة.` : "أنشئ أكواد خصم يستخدمها الزبائن."} action={
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> كوبون جديد
        </button>
      } />

      {!coupons || coupons.length === 0 ? (

        <EmptyState icon={Tag} title="لا كوبونات بعد" hint="أنشئ أول كوبون لجذب مزيد من الطلبات." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {coupons.map((c) => {
            const expired = c.expires_at && new Date(c.expires_at) < new Date();
            const fullyUsed = c.usage_limit && c.used_count >= c.usage_limit;
            return (
              <div key={c.id} className={`rounded-2xl border p-5 shadow-[var(--shadow-soft)] ${!c.is_active || expired || fullyUsed ? "opacity-60" : ""} border-border bg-card`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <button onClick={() => copy(c.code)}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 font-mono text-lg font-black text-primary hover:bg-primary/20">
                      {c.code}
                      {copied === c.code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <div className="mt-2 text-xl font-black">
                      {c.discount_type === "percent" ? `${c.discount_value}%` : formatIQD(c.discount_value)}
                      <span className="mr-1 text-sm text-muted-foreground">خصم</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={c.is_active} onChange={(e) => toggle.mutate({ id: c.id, is_active: e.target.checked })} />
                      <span>{c.is_active ? "فعّال" : "موقوف"}</span>
                    </label>
                    <button onClick={() => confirm("حذف هذا الكوبون؟") && remove.mutate(c.id)}
                      className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {c.min_order_iqd > 0 && <div>• حد أدنى: {formatIQD(c.min_order_iqd)}</div>}
                  {c.usage_limit && <div>• الاستخدام: {c.used_count} / {c.usage_limit}</div>}
                  {c.expires_at && <div>• ينتهي: {new Date(c.expires_at).toLocaleDateString("ar-IQ")}</div>}
                  {expired && <div className="font-bold text-destructive">منتهي الصلاحية</div>}
                  {fullyUsed && <div className="font-bold text-destructive">تم استنفاذ الاستخدام</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && tenantId && <CouponForm tenantId={tenantId} branchId={branchId} branchName={branch?.name} onClose={() => setShowForm(false)} onSaved={() => qc.invalidateQueries({ queryKey: ["coupons"] })} />}
    </>
  );
}

function CouponForm({ tenantId, branchId, branchName, onClose, onSaved }: { tenantId: string; branchId: string | null; branchName?: string; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState(10);
  const [minOrder, setMinOrder] = useState(0);
  const [limit, setLimit] = useState("");
  const [expires, setExpires] = useState("");
  const [scopeBranch, setScopeBranch] = useState(!!branchId);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        tenant_id: tenantId, code: code.toUpperCase().trim(),
        discount_type: type, discount_value: value, min_order_iqd: minOrder,
        usage_limit: limit ? Number(limit) : null,
        expires_at: expires ? new Date(expires).toISOString() : null,
        branch_id: scopeBranch && branchId ? branchId : null,
      };
      const { error } = await (supabase.from("coupons") as any).insert(payload);
      if (error) throw error;
      toast.success("تم إنشاء الكوبون");
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-black">كوبون جديد</h3>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">الكود</span>
            <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="WELCOME10"
              className="w-full rounded-xl border border-input bg-background px-4 py-2 font-mono uppercase" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">النوع</span>
              <select value={type} onChange={(e) => setType(e.target.value as any)}
                className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm">
                <option value="percent">نسبة %</option>
                <option value="fixed">مبلغ ثابت</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">القيمة</span>
              <input type="number" min={1} required value={value} onChange={(e) => setValue(Number(e.target.value))}
                className="w-full rounded-xl border border-input bg-background px-4 py-2" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">حد أدنى للطلب (اختياري)</span>
            <input type="number" min={0} value={minOrder} onChange={(e) => setMinOrder(Number(e.target.value))}
              className="w-full rounded-xl border border-input bg-background px-4 py-2" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">حد الاستخدام</span>
              <input type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="بلا حد"
                className="w-full rounded-xl border border-input bg-background px-4 py-2" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">تاريخ الانتهاء</span>
              <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-4 py-2" />
            </label>
          </div>
          {branchId && (
            <label className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm">
              <input type="checkbox" checked={scopeBranch} onChange={(e) => setScopeBranch(e.target.checked)} />
              <span>خاص بفرع <b>{branchName}</b> فقط (لو ألغيته يشمل كل الفروع)</span>
            </label>
          )}
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border py-2 font-bold">إلغاء</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-primary py-2 font-bold text-primary-foreground disabled:opacity-60">
            {saving ? "..." : "حفظ"}
          </button>
        </div>
      </form>
    </div>
  );
}
