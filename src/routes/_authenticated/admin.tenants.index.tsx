import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader } from "@/components/DashboardShell";
import { Plus, Search, Store, X, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/tenants/")({
  component: TenantsPage,
});

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  description: string | null;
  is_active: boolean;
  logo_url: string | null;
  custom_domain: string | null;
  theme_config: any;
  features_enabled: any;
  subscription_plan: string;
  subscription_status: string;
  monthly_fee_iqd: number;
};

function TenantsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<TenantRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: tenants } = useQuery({
    queryKey: ["tenants-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, slug, phone, address, description, is_active, logo_url, custom_domain, theme_config, features_enabled, subscription_plan, subscription_status, monthly_fee_iqd")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TenantRow[];
    },
  });


  const toggleActive = useMutation({
    mutationFn: async (t: TenantRow) => {
      const { error } = await supabase
        .from("tenants")
        .update({ is_active: !t.is_active })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants-full"] });
      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("تم تحديث الحالة");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (tenants ?? []).filter(
    (t) => t.name.includes(q) || t.slug.includes(q),
  );

  return (
    <>
      <PageHeader
        title="المطاعم"
        subtitle="إدارة جميع المطاعم على منصة تمراد."
        action={
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            إضافة مطعم
          </button>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن مطعم..."
            className="w-full rounded-xl border border-input bg-background py-2.5 pl-4 pr-10 text-sm outline-none focus:border-primary"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Store}
            title="لا توجد مطاعم بعد"
            hint="ابدأ بإضافة أول مطعم على منصتك."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-right text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-bold">المطعم</th>
                  <th className="px-4 py-3 font-bold">المسار</th>
                  <th className="px-4 py-3 font-bold">الهاتف</th>
                  <th className="px-4 py-3 font-bold">الحالة</th>
                  <th className="px-4 py-3 font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-bold">{t.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      /r/{t.slug}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                          t.is_active
                            ? "bg-lime text-lime-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t.is_active ? "نشط" : "معطل"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to="/admin/tenants/$id"
                          params={{ id: t.id }}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                        >
                          <Settings className="h-3 w-3" /> إدارة
                        </Link>
                        <button
                          onClick={() => {
                            setEditing(t);
                            setShowForm(true);
                          }}
                          className="rounded-lg border border-border px-3 py-1 text-xs font-bold hover:bg-muted"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => toggleActive.mutate(t)}
                          className="rounded-lg border border-border px-3 py-1 text-xs font-bold hover:bg-muted"
                        >
                          {t.is_active ? "تعطيل" : "تفعيل"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <TenantForm
          tenant={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["tenants-full"] });
            qc.invalidateQueries({ queryKey: ["tenants"] });
            setShowForm(false);
          }}
        />
      )}
    </>
  );
}

function TenantForm({
  tenant,
  onClose,
  onSaved,
}: {
  tenant: TenantRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(tenant?.name ?? "");
  const [slug, setSlug] = useState(tenant?.slug ?? "");
  const [phone, setPhone] = useState(tenant?.phone ?? "");
  const [address, setAddress] = useState(tenant?.address ?? "");
  const [description, setDescription] = useState(tenant?.description ?? "");
  const [logoUrl, setLogoUrl] = useState(tenant?.logo_url ?? "");
  const [customDomain, setCustomDomain] = useState(tenant?.custom_domain ?? "");
  const theme = (tenant?.theme_config as any) ?? {};
  const [primary, setPrimary] = useState<string>(theme.primary ?? "#1f5f3f");
  const [accent, setAccent] = useState<string>(theme.accent ?? "#c8f571");
  const features = (tenant?.features_enabled as any) ?? {};
  const [loyalty, setLoyalty] = useState<boolean>(!!features.loyalty);
  const [wallet, setWallet] = useState<boolean>(!!features.wallet);
  const [credit, setCredit] = useState<boolean>(!!features.credit);
  const [plan, setPlan] = useState<string>(tenant?.subscription_plan ?? "trial");
  const [status, setStatus] = useState<string>(tenant?.subscription_status ?? "active");
  const [monthlyFee, setMonthlyFee] = useState<number>(tenant?.monthly_fee_iqd ?? 0);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = {
        name,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        phone: phone || null,
        address: address || null,
        description: description || null,
        logo_url: logoUrl || null,
        custom_domain: customDomain || null,
        theme_config: { ...theme, primary, accent },
        features_enabled: { loyalty, wallet, credit },
        subscription_plan: plan,
        subscription_status: status,
        monthly_fee_iqd: Math.max(0, Math.floor(monthlyFee)),
      };
      const { error } = tenant
        ? await supabase.from("tenants").update(payload).eq("id", tenant.id)
        : await supabase.from("tenants").insert(payload);
      if (error) throw error;
      toast.success(tenant ? "تم التحديث" : "تم إضافة المطعم");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6 shadow-[var(--shadow-elegant)]">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onClose}><X className="h-5 w-5" /></button>
          <h2 className="text-xl font-black">{tenant ? "تعديل مطعم" : "إضافة مطعم جديد"}</h2>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <Section title="الهوية">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="اسم المطعم" value={name} onChange={setName} required />
              <Field label="الشعار (رابط)" value={logoUrl} onChange={setLogoUrl} dir="ltr" hint="URL كامل لصورة الشعار" />
            </div>
            {logoUrl && (
              <img src={logoUrl} alt="logo" className="mt-2 h-16 w-16 rounded-xl border border-border object-cover" />
            )}
            <Field label="وصف مختصر / شعار المطعم" value={description} onChange={setDescription} multiline />
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField label="اللون الأساسي" value={primary} onChange={setPrimary} />
              <ColorField label="اللون الثانوي" value={accent} onChange={setAccent} />
            </div>
          </Section>

          <Section title="البيانات الأساسية">
            <Field label="رقم الهاتف" value={phone} onChange={setPhone} dir="ltr" />
            <Field label="العنوان" value={address} onChange={setAddress} />
          </Section>

          <Section title="الإعدادات التقنية">
            <Field
              label="Subdomain (المسار)"
              value={slug}
              onChange={setSlug}
              required
              dir="ltr"
              hint={`الرابط العام سيصبح: ${slug || "your-slug"}.tamrad.shop  ·  أو  tamrad.shop/r/${slug || "your-slug"}`}
            />
            <Field label="الدومين الخاص (اختياري)" value={customDomain} onChange={setCustomDomain} dir="ltr" hint="مثال: burgerking.com" />
          </Section>

          <Section title="المميزات المفعّلة">
            <div className="grid gap-2 sm:grid-cols-3">
              <ToggleField label="نظام الولاء" checked={loyalty} onChange={setLoyalty} />
              <ToggleField label="المحفظة" checked={wallet} onChange={setWallet} />
              <ToggleField label="الدفع الآجل" checked={credit} onChange={setCredit} />
            </div>
          </Section>

          <Section title="الاشتراك">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold">الخطة</span>
                <select value={plan} onChange={(e) => setPlan(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm">
                  <option value="trial">تجريبي</option>
                  <option value="basic">أساسي</option>
                  <option value="pro">احترافي</option>
                  <option value="enterprise">مؤسسات</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold">الحالة</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm">
                  <option value="active">نشط</option>
                  <option value="pending">قيد الدفع</option>
                  <option value="suspended">موقوف</option>
                  <option value="cancelled">ملغى</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold">الرسوم الشهرية (د.ع)</span>
                <input type="number" min={0} value={monthlyFee}
                  onChange={(e) => setMonthlyFee(Number(e.target.value))}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm" />
              </label>
            </div>
          </Section>

          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-bold">إلغاء</button>
            <button type="submit" disabled={loading || !name || !slug}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {loading ? "..." : tenant ? "حفظ التعديلات" : "إضافة المطعم"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-border p-4">
      <legend className="px-2 text-sm font-black text-primary">{title}</legend>
      {children}
    </fieldset>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-lg border border-input bg-background" />
        <input dir="ltr" value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-xl border border-input bg-background px-3 py-2 font-mono text-xs" />
      </div>
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-3 text-sm font-bold transition ${checked ? "border-primary bg-primary/10" : "border-border"}`}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  dir,
  hint,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  dir?: "ltr" | "rtl";
  hint?: string;
  multiline?: boolean;
}) {
  const Cmp = multiline ? "textarea" : "input";
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold">{label}</span>
      <Cmp
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)}
        required={required}
        dir={dir}
        rows={multiline ? 3 : undefined}
        className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
      />
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

