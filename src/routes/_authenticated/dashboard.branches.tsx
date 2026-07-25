import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useMe";
import { toast } from "sonner";
import { Store, Plus, MapPin, Phone, Trash2, Power, PowerOff, Link as LinkIcon, Copy } from "lucide-react";

import { getTenantStorefrontUrl } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/dashboard/branches")({
  component: BranchesPage,
});

type Branch = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  city: string | null;
  is_active: boolean;
};

function BranchesPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const tenantId = me?.tenantId;
  const [showForm, setShowForm] = useState(false);

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("slug, name, custom_domain").eq("id", tenantId!).maybeSingle();
      return data;
    },
  });

  const storefrontUrl = tenant?.slug ? getTenantStorefrontUrl(tenant.slug, (tenant as any).custom_domain) : "";

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("branches" as any) as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Branch[];
    },
  });

  const toggle = useMutation({
    mutationFn: async (b: Branch) => {
      const { error } = await (supabase.from("branches" as any) as any)
        .update({ is_active: !b.is_active })
        .eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches", tenantId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("branches" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الفرع");
      qc.invalidateQueries({ queryKey: ["branches", tenantId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">إدارة الفروع</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            أضف فروع مطعمك المختلفة. كل فرع له رابط خاص ويظهر ضمن رابط المطعم الموحّد.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-primary to-accent px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25"
        >
          <Plus className="h-4 w-4" /> إضافة فرع
        </button>
      </header>

      {tenant?.slug && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <div className="flex items-center gap-3 text-sm">
            <LinkIcon className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">الرابط الموحّد لكل الفروع:</span>
            <code dir="ltr" className="rounded-md bg-background px-2 py-1 text-xs font-medium">
              {storefrontUrl}
            </code>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(storefrontUrl);
              toast.success("تم نسخ الرابط");
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Copy className="h-3.5 w-3.5" /> نسخ
          </button>
        </div>
      )}

      {showForm && (
        <BranchForm
          tenantId={tenantId!}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["branches", tenantId] });
          }}
        />
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-10 text-center text-muted-foreground">
          جاري التحميل...
        </div>
      ) : branches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-10 text-center">
          <Store className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد فروع بعد</h3>
          <p className="mt-1 text-sm text-muted-foreground">ابدأ بإضافة أول فرع لمطعمك.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((b) => (
            <article
              key={b.id}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{b.name}</h3>
                    <p className="text-xs text-muted-foreground" dir="ltr">/{b.slug}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    b.is_active
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {b.is_active ? "فعّال" : "متوقف"}
                </span>
              </div>

              <div className="space-y-1.5 text-sm text-muted-foreground">
                {b.address && (
                  <p className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" /> {b.address}
                  </p>
                )}
                {b.phone && (
                  <p className="flex items-center gap-2" dir="ltr">
                    <Phone className="h-3.5 w-3.5" /> {b.phone}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
                <button
                  onClick={() => toggle.mutate(b)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
                >
                  {b.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                  {b.is_active ? "إيقاف" : "تفعيل"}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`حذف الفرع "${b.name}"؟`)) remove.mutate(b.id);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> حذف
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function BranchForm({
  tenantId,
  onClose,
  onSaved,
}: {
  tenantId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error("المتصفح لا يدعم تحديد الموقع");
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setGeoBusy(false);
        toast.success("تم تحديد الموقع");
      },
      (err) => {
        setGeoBusy(false);
        toast.error(err.message || "تعذّر تحديد الموقع");
      },
      { timeout: 8000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error("الاسم والمعرّف مطلوبان");
      return;
    }
    setSaving(true);
    const latNum = lat.trim() ? parseFloat(lat) : null;
    const lngNum = lng.trim() ? parseFloat(lng) : null;
    const { error } = await (supabase.from("branches" as any) as any).insert({
      tenant_id: tenantId,
      name: name.trim(),
      slug: slug.trim().toLowerCase().replace(/\s+/g, "-"),
      address: address.trim() || null,
      phone: phone.trim() || null,
      city: city.trim() || null,
      latitude: latNum,
      longitude: lngNum,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("unique") ? "المعرّف مستخدم بالفعل" : error.message);
      return;
    }
    toast.success("تم إنشاء الفرع");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-6 shadow-2xl"
      >
        <h2 className="text-xl font-bold">إضافة فرع جديد</h2>
        <p className="mt-1 text-sm text-muted-foreground">املأ بيانات الفرع لإتاحته للزبائن.</p>

        <div className="mt-5 space-y-3">
          <Input label="اسم الفرع" value={name} onChange={setName} placeholder="مثال: فرع المنصور" />
          <Input
            label="المعرّف (slug)"
            value={slug}
            onChange={setSlug}
            placeholder="mansour"
            dir="ltr"
            hint="سيظهر في رابط الفرع، حروف إنجليزية فقط."
          />
          <Input label="المدينة" value={city} onChange={setCity} placeholder="بغداد" />
          <Input label="العنوان" value={address} onChange={setAddress} placeholder="حي / شارع" />
          <Input label="الهاتف" value={phone} onChange={setPhone} placeholder="07XX XXX XXXX" dir="ltr" />

          <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold">موقع الفرع (لتوجيه أقرب زبون)</span>
              <button
                type="button"
                onClick={useMyLocation}
                disabled={geoBusy}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold hover:bg-muted disabled:opacity-60"
              >
                {geoBusy ? "…" : "📍 استخدم موقعي"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Latitude" value={lat} onChange={setLat} placeholder="33.3152" dir="ltr" />
              <Input label="Longitude" value={lng} onChange={setLng} placeholder="44.3661" dir="ltr" />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              اختياري — لو تركته فارغ لن يُقارَن هذا الفرع في اختيار الأقرب.
            </p>
          </div>
        </div>


        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gradient-to-l from-primary to-accent px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ الفرع"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  dir,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dir?: "ltr" | "rtl";
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
