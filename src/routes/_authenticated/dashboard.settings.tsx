import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useMe";
import { PageHeader } from "@/components/DashboardShell";
import { Save, Upload, Loader2, Palette } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { uploadTenantImage } from "@/lib/uploadImage";

import { getTenantStorefrontUrl } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const tenantId = me?.tenantId;

  const { data: tenant } = useQuery({
    queryKey: ["tenant-settings", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("*").eq("id", tenantId!).maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    if (!tenant) return;
    setName(tenant.name ?? "");
    setDescription(tenant.description ?? "");
    setPhone(tenant.phone ?? "");
    setAddress(tenant.address ?? "");
    setLogoUrl(tenant.logo_url ?? "");
  }, [tenant]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tenants")
        .update({
          name, description: description || null, phone: phone || null,
          address: address || null, logo_url: logoUrl || null,
        })
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-settings"] });
      qc.invalidateQueries({ queryKey: ["tenant-theme"] });
      qc.invalidateQueries({ queryKey: ["tenant-public"] });
      toast.success("تم حفظ الإعدادات");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const storefrontUrl = tenant?.slug ? getTenantStorefrontUrl(tenant.slug, tenant.custom_domain) : "";

  return (
    <>
      <PageHeader title="الإعدادات والتخصيص" subtitle="اضبط هوية مطعمك وشكل صفحته للزبائن." />

      <div className="grid gap-6">
        {/* Subdomain link box */}
        {storefrontUrl && (
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 shadow-[var(--shadow-soft)]">
            <h2 className="mb-2 text-xs font-bold text-muted-foreground">رابط متجرك المباشر (النطاق الفرعي):</h2>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <code dir="ltr" className="rounded-xl border border-primary/20 bg-background px-4 py-2 font-mono text-sm font-bold text-primary">
                {storefrontUrl}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(storefrontUrl);
                  toast.success("تم نسخ رابط المتجر");
                }}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
              >
                نسخ الرابط
              </button>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h2 className="mb-4 text-lg font-black">معلومات المطعم</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <F label="اسم المطعم" value={name} onChange={setName} />
            <F label="رقم الهاتف" value={phone} onChange={setPhone} dir="ltr" />
            <F label="العنوان" value={address} onChange={setAddress} />
            <F label="وصف مختصر" value={description} onChange={setDescription} multiline />
            <div className="md:col-span-2">
              <span className="mb-1.5 block text-sm font-bold">شعار المطعم</span>
              <div className="flex items-center gap-3">
                {logoUrl && <img src={logoUrl} alt="شعار" className="h-20 w-20 rounded-xl border border-border object-cover" />}
                <LogoUpload tenantId={tenantId!} onUploaded={setLogoUrl} hasLogo={!!logoUrl} />
              </div>
              <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} dir="ltr"
                placeholder="أو الصق رابطاً"
                className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-2 text-xs outline-none focus:border-primary" />
            </div>
          </div>
        </div>

        {/* Theme link */}
        <Link
          to="/dashboard/theme"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-colors hover:border-primary"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-black">ثيم المطعم والقوالب</div>
              <div className="text-xs text-muted-foreground">اختيار قالب موحّد، ألوان، شعار وصورة غلاف — يُطبَّق على كل الفروع.</div>
            </div>
          </div>
          <span className="text-xs font-bold text-primary">فتح →</span>
        </Link>
      </div>


      <div className="mt-6 flex justify-end">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {save.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>
    </>
  );
}

function F({
  label, value, onChange, multiline, dir,
}: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; dir?: "ltr" | "rtl";
}) {
  const Cmp = multiline ? "textarea" : "input";
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold">{label}</span>
      <Cmp
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)}
        rows={multiline ? 3 : undefined}
        dir={dir}
        className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function LogoUpload({ tenantId, onUploaded, hasLogo }: { tenantId: string; onUploaded: (u: string) => void; hasLogo: boolean }) {
  const [uploading, setUploading] = useState(false);
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadTenantImage(tenantId, file, "logo");
      onUploaded(url);
      toast.success("تم رفع الشعار");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setUploading(false);
    }
  }
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-input px-4 py-3 text-sm font-bold hover:border-primary">
      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      {uploading ? "جاري الرفع..." : hasLogo ? "تغيير الشعار" : "رفع شعار"}
      <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="hidden" />
    </label>
  );
}
