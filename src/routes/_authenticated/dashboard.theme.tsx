import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useMe";
import { PageHeader } from "@/components/DashboardShell";
import {
  Palette, Save, Image as ImageIcon, LayoutTemplate, Check, ExternalLink,
  Upload, Loader2, Type, Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TEMPLATES, TemplateThumb } from "@/lib/restaurantTemplates";
import { uploadTenantImage } from "@/lib/uploadImage";
import {
  CONTENT_DEFAULTS, TEMPLATE_FIELDS, FIELD_LABELS,
  type TemplateContent,
} from "@/lib/templateContent";

import { getTenantStorefrontUrl } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/dashboard/theme")({
  component: BrandThemePage,
});

type Theme = {
  primary?: string;
  accent?: string;
  template?: string;
  cover_url?: string;
  content?: TemplateContent;
};

type TabId = "template" | "colors" | "content" | "images";

function BrandThemePage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const tenantId = me?.tenantId;

  const { data: tenant } = useQuery({
    queryKey: ["tenant-theme", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id, name, slug, description, logo_url, theme_config, custom_domain")
        .eq("id", tenantId!)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  const storefrontUrl = tenant?.slug ? getTenantStorefrontUrl(tenant.slug, (tenant as any).custom_domain) : "";

  const [tab, setTab] = useState<TabId>("template");
  const [template, setTemplate] = useState<string>("store");
  const [primary, setPrimary] = useState("#ed6c35");
  const [accent, setAccent] = useState("#dce6d5");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState<TemplateContent>({});
  // Gradient builder
  const [gradFrom, setGradFrom] = useState("#ed6c35");
  const [gradTo, setGradTo] = useState("#dce6d5");
  const [gradAngle, setGradAngle] = useState(135);

  useEffect(() => {
    if (!tenant) return;
    const t = (tenant.theme_config as Theme | null) ?? {};
    setTemplate(t.template ?? "store");
    setPrimary(t.primary ?? "#ed6c35");
    setAccent(t.accent ?? "#dce6d5");
    setCoverUrl(t.cover_url ?? "");
    setLogoUrl(tenant.logo_url ?? "");
    setDescription(tenant.description ?? "");
    setContent(t.content ?? {});
    setGradFrom(t.primary ?? "#ed6c35");
    setGradTo(t.accent ?? "#dce6d5");
  }, [tenant]);

  const defaults = CONTENT_DEFAULTS[template] ?? CONTENT_DEFAULTS.store;
  const fields = TEMPLATE_FIELDS[template] ?? [];
  const gradientString = useMemo(
    () => `linear-gradient(${gradAngle}deg, ${gradFrom}, ${gradTo})`,
    [gradAngle, gradFrom, gradTo],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      // Prune empty overrides so defaults apply when field is blank
      const cleanContent: TemplateContent = {};
      (Object.keys(content) as (keyof TemplateContent)[]).forEach(k => {
        const v = content[k];
        if (v !== undefined && v !== null && String(v).trim() !== "") {
          (cleanContent as any)[k] = String(v).trim();
        }
      });
      const { error } = await supabase
        .from("tenants")
        .update({
          logo_url: logoUrl.trim() || null,
          description: description.trim() || null,
          theme_config: {
            template,
            primary,
            accent,
            cover_url: coverUrl.trim() || null,
            content: cleanContent,
          },
        })
        .eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ الثيم");
      qc.invalidateQueries({ queryKey: ["tenant-theme", tenantId] });
      qc.invalidateQueries({ queryKey: ["tenant-public"] });
      qc.invalidateQueries({ queryKey: ["tenant-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function applyPreset(id: string) {
    const t = TEMPLATES.find(x => x.id === id);
    if (!t) return;
    setTemplate(id);
    setPrimary(t.palette.primary);
    setAccent(t.palette.accent);
    // reset overrides so defaults of the new template show up
    setContent({});
  }

  function setField(k: keyof TemplateContent, v: string) {
    setContent(prev => ({ ...prev, [k]: v }));
  }

  function applyGradientToCover() {
    setContent(prev => ({ ...prev, hero_gradient: gradientString }));
    toast.success("تم تطبيق التدرج على الخلفية");
  }

  function clearGradient() {
    setContent(prev => ({ ...prev, hero_gradient: "" }));
    toast("تمت إزالة التدرج — سيتم استخدام الصورة/اللون الافتراضي");
  }

  return (
    <>
      <PageHeader
        title="ثيم المطعم"
        subtitle="اختر قالباً، عدّل النصوص والألوان والصور — الكل يُطبَّق على صفحة الطلب."
        action={
          <div className="flex items-center gap-2">
            {storefrontUrl && (
              <a
                href={storefrontUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-muted"
              >
                معاينة <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> {save.isPending ? "جارٍ الحفظ…" : "حفظ"}
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {([
          { id: "template", label: "القالب", icon: LayoutTemplate },
          { id: "content",  label: "المحتوى والنصوص", icon: Type },
          { id: "images",   label: "الصور والخلفية", icon: ImageIcon },
          { id: "colors",   label: "الألوان", icon: Palette },
        ] as const).map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
              }`}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {tab === "template" && (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="mb-4 flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-black">اختر قالب المطعم</h2>
                <span className="mr-auto text-xs text-muted-foreground">يُطبَّق على كل الفروع</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
                {TEMPLATES.map(t => {
                  const active = template === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => applyPreset(t.id)}
                      className={`group relative overflow-hidden rounded-2xl border-2 text-right transition-all ${
                        active ? "border-primary shadow-lg ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                      }`}
                    >
                      {active && (
                        <div className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div className="aspect-[4/3]">
                        <TemplateThumb id={t.id} primary={t.palette.primary} accent={t.palette.accent} />
                      </div>
                      <div className="border-t border-border bg-card p-3">
                        <div className="text-sm font-black">{t.name}</div>
                        <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{t.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {tab === "content" && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Type className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-black">نصوص القالب</h2>
                <span className="mr-auto text-xs text-muted-foreground">
                  اترك الحقل فارغاً لاستخدام النص الافتراضي للقالب
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {fields.map(f => {
                  const val = (content as any)[f] ?? "";
                  const placeholder = (defaults as any)[f] ?? "";
                  const long = f === "hero_subtitle";
                  return (
                    <label key={f} className={long ? "sm:col-span-2" : ""}>
                      <span className="mb-1 block text-xs font-bold">{FIELD_LABELS[f]}</span>
                      {long ? (
                        <textarea
                          rows={2}
                          value={val}
                          onChange={e => setField(f, e.target.value)}
                          placeholder={placeholder || "افتراضي: وصف المطعم"}
                          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      ) : (
                        <input
                          value={val}
                          onChange={e => setField(f, e.target.value)}
                          placeholder={placeholder ? `افتراضي: ${placeholder}` : "—"}
                          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              <p className="mt-3 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                💡 كل قالب بيستخدم حقول مختلفة — الحقول اللي هنا هي اللي بتظهر في القالب المختار.
              </p>
            </section>
          )}

          {tab === "images" && (
            <>
              <section className="rounded-2xl border border-border bg-card p-5">
                <h3 className="mb-4 flex items-center gap-2 text-base font-black">
                  <ImageIcon className="h-4 w-4 text-primary" /> شعار وصورة المطعم
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-bold">شعار المطعم (Logo)</label>
                    <p className="mb-2 text-[11px] text-muted-foreground">يظهر في شريط الترويسة أعلى صفحة الطلب</p>
                    <div className="flex items-center gap-3">
                      {logoUrl && <img src={logoUrl} alt="logo" className="h-16 w-16 rounded-xl border border-border object-cover" />}
                      {tenantId && <ImageUpload tenantId={tenantId} kind="logo" onUploaded={setLogoUrl} hasImage={!!logoUrl} label="شعار" />}
                    </div>
                    <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} dir="ltr" placeholder="أو الصق رابط الشعار"
                           className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary" />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-bold">صورة الغلاف (Hero)</label>
                    <p className="mb-2 text-[11px] text-muted-foreground">تُستخدم كخلفية للـ hero في القوالب. لو مضبوط تدرج لوني — التدرج يعلوها.</p>
                    <div className="flex items-center gap-3">
                      {coverUrl && <img src={coverUrl} alt="cover" className="h-16 w-24 rounded-xl border border-border object-cover" />}
                      {tenantId && <ImageUpload tenantId={tenantId} kind="cover" onUploaded={setCoverUrl} hasImage={!!coverUrl} label="غلاف" />}
                    </div>
                    <input value={coverUrl} onChange={e => setCoverUrl(e.target.value)} dir="ltr" placeholder="أو الصق رابط صورة الغلاف"
                           className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary" />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-bold">وصف المطعم</label>
                    <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
                              placeholder="مثال: أطيب الأكلات الشرقية بمكونات طازة كل يوم."
                              className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm outline-none focus:border-primary" />
                  </div>
                </div>
              </section>

              {/* Gradient builder */}
              <section className="rounded-2xl border border-border bg-card p-5">
                <h3 className="mb-1 flex items-center gap-2 text-base font-black">
                  <Sparkles className="h-4 w-4 text-primary" /> مولّد الخلفية بتدرج لوني
                </h3>
                <p className="mb-4 text-xs text-muted-foreground">
                  اصنع خلفية احترافية بدون صورة — اختار لونين وزاوية. يُطبَّق على خلفية الـ hero في القالب.
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold">لون البداية</label>
                    <div className="flex items-center gap-2 rounded-xl border border-input bg-background p-2">
                      <input type="color" value={gradFrom} onChange={e => setGradFrom(e.target.value)}
                             className="h-9 w-12 cursor-pointer rounded-md border border-border" />
                      <input type="text" value={gradFrom} onChange={e => setGradFrom(e.target.value)} dir="ltr"
                             className="flex-1 bg-transparent px-2 font-mono text-xs outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold">لون النهاية</label>
                    <div className="flex items-center gap-2 rounded-xl border border-input bg-background p-2">
                      <input type="color" value={gradTo} onChange={e => setGradTo(e.target.value)}
                             className="h-9 w-12 cursor-pointer rounded-md border border-border" />
                      <input type="text" value={gradTo} onChange={e => setGradTo(e.target.value)} dir="ltr"
                             className="flex-1 bg-transparent px-2 font-mono text-xs outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold">الزاوية ({gradAngle}°)</label>
                    <input type="range" min={0} max={360} value={gradAngle}
                           onChange={e => setGradAngle(parseInt(e.target.value))}
                           className="mt-3 w-full" />
                  </div>
                </div>

                <div className="mt-4 h-24 rounded-2xl border border-border" style={{ background: gradientString }} />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={applyGradientToCover}
                          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
                    تطبيق التدرج على الخلفية
                  </button>
                  <button type="button" onClick={clearGradient}
                          className="rounded-xl border border-border px-4 py-2 text-xs font-bold hover:bg-muted">
                    إزالة التدرج
                  </button>
                  {content.hero_gradient && (
                    <span className="inline-flex items-center gap-1 rounded-xl bg-lime/30 px-3 py-2 text-[11px] font-bold text-primary">
                      <Check className="h-3 w-3" /> تدرج مُفعّل حالياً
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {[
                    ["#ed6c35","#dce6d5"], ["#0f172a","#3b82f6"], ["#7c3aed","#ec4899"],
                    ["#0d7a5f","#c9a84c"], ["#dc2626","#fbbf24"], ["#1e40af","#06b6d4"],
                  ].map(([a, b]) => (
                    <button key={a+b} type="button"
                            onClick={() => { setGradFrom(a); setGradTo(b); }}
                            className="h-10 rounded-lg border border-border"
                            style={{ background: `linear-gradient(135deg,${a},${b})` }} />
                  ))}
                </div>
              </section>
            </>
          )}

          {tab === "colors" && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-4 flex items-center gap-2 text-base font-black">
                <Palette className="h-4 w-4 text-primary" /> ألوان الثيم
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField label="اللون الرئيسي" value={primary} onChange={setPrimary} />
                <ColorField label="اللون المميّز" value={accent} onChange={setAccent} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                اختيار قالب يضبط الألوان الافتراضية له، وتقدر تعدّلها بعد كده.
              </p>
            </section>
          )}
        </div>

        {/* Live preview thumbnail */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>معاينة سريعة</span>
            {storefrontUrl && (
              <a href={storefrontUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                فتح الصفحة كاملة
              </a>
            )}
          </div>
          <div className="overflow-hidden rounded-2xl border border-border shadow-lg">
            <div
              className="relative flex h-40 items-end p-4"
              style={{
                background: content.hero_gradient
                  ? content.hero_gradient
                  : coverUrl
                    ? `url(${coverUrl}) center/cover`
                    : `linear-gradient(135deg, ${primary}, ${accent})`,
              }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-14 w-14 rounded-2xl border-2 border-white bg-white object-cover shadow" />
              ) : (
                <div className="grid h-14 w-14 place-items-center rounded-2xl border-2 border-white text-2xl font-black shadow"
                     style={{ background: accent, color: primary }}>
                  {tenant?.name?.charAt(0) ?? "م"}
                </div>
              )}
            </div>
            <div className="bg-card p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                {TEMPLATES.find(t => t.id === template)?.name}
              </div>
              <h4 className="mt-1 text-lg font-black" style={{ color: primary }}>
                {tenant?.name || "اسم المطعم"}
              </h4>
              {description && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{description}</p>}
              <button type="button" className="mt-4 w-full rounded-xl py-2.5 text-sm font-bold text-white" style={{ background: primary }}>
                {content.hero_cta || defaults.hero_cta || "اطلب الآن"}
              </button>
            </div>
            <div className="border-t border-border">
              <div className="h-24">
                <TemplateThumb id={template} primary={primary} accent={accent} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-bold">{label}</label>
      <div className="flex items-center gap-2 rounded-xl border border-input bg-background p-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
               className="h-9 w-12 cursor-pointer rounded-md border border-border" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)} dir="ltr"
               className="flex-1 bg-transparent px-2 font-mono text-sm outline-none" />
      </div>
    </div>
  );
}

function ImageUpload({
  tenantId, kind, onUploaded, hasImage, label,
}: { tenantId: string; kind: "logo" | "cover"; onUploaded: (u: string) => void; hasImage: boolean; label: string }) {
  const [busy, setBusy] = useState(false);
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadTenantImage(tenantId, file, kind);
      onUploaded(url);
      toast.success(`تم رفع ${label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally { setBusy(false); }
  }
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-input px-4 py-3 text-sm font-bold hover:border-primary">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      {busy ? "جاري الرفع..." : hasImage ? `تغيير ${label}` : `رفع ${label}`}
      <input type="file" accept="image/*" onChange={handleFile} disabled={busy} className="hidden" />
    </label>
  );
}
