import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Save } from "lucide-react";
import { PageHeader } from "@/components/DashboardShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/platform")({
  component: PlatformSettingsPage,
});

function PlatformSettingsPage() {
  const queryClient = useQueryClient();
  const [restaurantCount, setRestaurantCount] = useState("120");
  const [saving, setSaving] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("platform_settings") as any)
        .select("restaurant_count, updated_at")
        .eq("singleton", true)
        .single();
      if (error) throw error;
      return data as { restaurant_count: number; updated_at: string };
    },
  });

  useEffect(() => {
    if (data) setRestaurantCount(String(data.restaurant_count));
  }, [data]);

  const save = async () => {
    const value = Number(restaurantCount);
    if (!Number.isInteger(value) || value < 0 || value > 1_000_000) {
      toast.error("أدخل عدداً صحيحاً من 0 إلى 1,000,000.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase.from("platform_settings") as any)
      .update({ restaurant_count: value })
      .eq("singleton", true);
    setSaving(false);
    if (error) {
      toast.error("تعذر حفظ العدد: " + error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
    toast.success("تم تحديث عدد المطاعم في الصفحة الرئيسية.");
  };

  return (
    <>
      <PageHeader title="إعدادات المنصة" subtitle="تحكم في البيانات العامة التي تظهر في صفحة تمراد الرئيسية." />
      <section className="max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-lime text-lime-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black">عدد المطاعم المعروض</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              يظهر في الشريط التعريفي وفي دعوة الانضمام بالصفحة الرئيسية. لا يغيّر عدد المطاعم الفعلي في النظام.
            </p>
          </div>
        </div>
        <label className="mt-8 block">
          <span className="mb-2 block text-sm font-bold">عدد المطاعم</span>
          <input
            value={restaurantCount}
            onChange={(event) => setRestaurantCount(event.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            disabled={isLoading || saving}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-lg font-black outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="عدد المطاعم المعروض في الصفحة الرئيسية"
          />
        </label>
        <div className="mt-3 text-xs text-muted-foreground">
          القيمة الحالية: +{data?.restaurant_count?.toLocaleString("en-US") ?? "…"} مطعماً
        </div>
        <button
          onClick={save}
          disabled={saving || isLoading}
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "جارٍ الحفظ…" : "حفظ التعديل"}
        </button>
      </section>
    </>
  );
}
