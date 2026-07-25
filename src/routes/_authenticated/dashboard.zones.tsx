import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, formatIQD } from "@/lib/useMe";
import { useCurrentBranch } from "@/lib/useBranch";
import { EmptyState, PageHeader } from "@/components/DashboardShell";
import { Map, Plus, Trash2, MapPin, Pencil, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/zones")({
  component: ZonesPage,
});

type Zone = {
  id: string;
  name: string;
  fee_iqd: number;
  is_active: boolean;
  sort_order: number;
  branch_id: string | null;
  center_lat: number | null;
  center_lng: number | null;
  radius_km: number | null;
};

function ZonesPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const tenantId = me?.tenantId;
  const { current: branch, branchId } = useCurrentBranch();
  const [editing, setEditing] = useState<Zone | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: zones } = useQuery({
    queryKey: ["zones", tenantId, branchId],
    queryFn: async () => {
      let q: any = (supabase.from("delivery_zones") as any)
        .select("*").eq("tenant_id", tenantId!);
      if (branchId) q = q.or(`branch_id.eq.${branchId},branch_id.is.null`);
      const { data, error } = await q.order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []) as Zone[];
    },
    enabled: !!tenantId,
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase.from("delivery_zones") as any).update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["zones"] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("delivery_zones") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["zones"] }),
  });

  return (
    <>
      <PageHeader
        title="مناطق التوصيل"
        subtitle={branch ? `مناطق فرع ${branch.name} + المناطق العامة.` : "حدّد المناطق التي يخدمها مطعمك."}
        action={
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> إضافة منطقة
          </button>
        }
      />

      {!zones || zones.length === 0 ? (
        <EmptyState icon={Map} title="لا مناطق بعد" hint="أضف المناطق التي يصلها مطعمك — الطلبات من خارجها سيتم رفضها تلقائياً." />
      ) : (
        <div className="grid gap-2">
          {zones.map((z) => (
            <div key={z.id} className={`flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 ${!z.is_active ? "opacity-60" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-bold">
                  {z.name}
                  {!z.branch_id && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">عام</span>}
                  {z.center_lat != null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      <MapPin className="h-3 w-3" /> Geo-fence · {z.radius_km ?? 3}كم
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  رسوم التوصيل: {z.fee_iqd === 0 ? "مجاني" : formatIQD(z.fee_iqd)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={z.is_active} onChange={(e) => toggle.mutate({ id: z.id, is_active: e.target.checked })} />
                  {z.is_active ? "فعّالة" : "موقوفة"}
                </label>
                <button onClick={() => { setEditing(z); setShowForm(true); }} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => confirm("حذف المنطقة؟") && remove.mutate(z.id)}
                  className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && tenantId && (
        <ZoneForm
          zone={editing}
          tenantId={tenantId}
          branchId={branchId}
          onClose={() => setShowForm(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["zones"] }); setShowForm(false); }}
        />
      )}
    </>
  );
}

function ZoneForm({
  zone, tenantId, branchId, onClose, onSaved,
}: {
  zone: Zone | null;
  tenantId: string;
  branchId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(zone?.name ?? "");
  const [fee, setFee] = useState(zone?.fee_iqd ?? 2000);
  const [useGeo, setUseGeo] = useState(zone?.center_lat != null);
  const [lat, setLat] = useState<string>(zone?.center_lat?.toString() ?? "");
  const [lng, setLng] = useState<string>(zone?.center_lng?.toString() ?? "");
  const [radius, setRadius] = useState<number>(zone?.radius_km ?? 3);
  const [loading, setLoading] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

  function fillFromLocation() {
    if (!navigator.geolocation) { toast.error("متصفحك لا يدعم تحديد الموقع"); return; }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setGeoBusy(false);
        toast.success("تم تحديد الموقع");
      },
      (err) => { setGeoBusy(false); toast.error(err.message); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = {
        tenant_id: tenantId,
        name: name.trim(),
        fee_iqd: Math.max(0, Math.floor(fee)),
        branch_id: branchId,
        center_lat: useGeo && lat ? Number(lat) : null,
        center_lng: useGeo && lng ? Number(lng) : null,
        radius_km: useGeo ? Math.max(0.1, radius) : null,
      };
      const { error } = zone
        ? await (supabase.from("delivery_zones") as any).update(payload).eq("id", zone.id)
        : await (supabase.from("delivery_zones") as any).insert(payload);
      if (error) throw error;
      toast.success(zone ? "تم التحديث" : "تمت الإضافة");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-[var(--shadow-elegant)]">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onClose}><X className="h-5 w-5" /></button>
          <h2 className="text-xl font-black">{zone ? "تعديل منطقة" : "منطقة جديدة"}</h2>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">اسم المنطقة</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="مثال: حي الجامعة"
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">رسوم التوصيل (د.ع) — 0 = مجاني</span>
            <input type="number" min={0} value={fee} onChange={(e) => setFee(Number(e.target.value))}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" />
          </label>

          <div className="rounded-xl border border-border p-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={useGeo} onChange={(e) => setUseGeo(e.target.checked)} />
              <MapPin className="h-4 w-4 text-primary" />
              تفعيل التحقق الجغرافي (Geo-fence)
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              يرفض النظام أي طلب من خارج نطاق هذه المنطقة تلقائياً بناءً على موقع الزبون.
            </p>

            {useGeo && (
              <div className="mt-3 space-y-3">
                <button type="button" onClick={fillFromLocation} disabled={geoBusy}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20">
                  <MapPin className="h-3.5 w-3.5" />
                  {geoBusy ? "جاري التحديد..." : "استخدم موقعي الحالي كمركز"}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-muted-foreground">خط العرض (lat)</span>
                    <input dir="ltr" value={lat} onChange={(e) => setLat(e.target.value)}
                      placeholder="33.312" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-muted-foreground">خط الطول (lng)</span>
                    <input dir="ltr" value={lng} onChange={(e) => setLng(e.target.value)}
                      placeholder="44.361" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">نصف القطر (كم): {radius.toFixed(1)}</span>
                  <input type="range" min={0.5} max={20} step={0.5} value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
                </label>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-bold">إلغاء</button>
            <button type="submit" disabled={loading || !name.trim()}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {loading ? "..." : "حفظ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
