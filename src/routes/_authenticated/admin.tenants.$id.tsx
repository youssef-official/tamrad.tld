import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatIQD } from "@/lib/useMe";
import { PageHeader } from "@/components/DashboardShell";
import {
  ArrowRight,
  Building2,
  Crown,
  Store,
  ShoppingBag,
  Users,
  Bike,
  MapPin,
  Phone,
  ExternalLink,
  Save,
  Power,
  Trash2,
  Star,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getTenantStorefrontUrl } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/admin/tenants/$id")({
  component: TenantDetailPage,
});

const PLANS = [
  { value: "trial", label: "تجريبي", fee: 0 },
  { value: "basic", label: "أساسي", fee: 50000 },
  { value: "pro", label: "احترافي", fee: 150000 },
  { value: "enterprise", label: "مؤسسي", fee: 500000 },
];

const STATUS = [
  { value: "active", label: "نشط" },
  { value: "suspended", label: "موقوف" },
  { value: "expired", label: "منتهي" },
  { value: "cancelled", label: "ملغى" },
];

function TenantDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["admin-tenant", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("tenants") as any)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["admin-tenant-branches", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("branches")
        .select("*")
        .eq("tenant_id", id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["admin-tenant-orders", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, total_iqd, created_at, branch_id, customer_phone")
        .eq("tenant_id", id)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: staff } = useQuery({
    queryKey: ["admin-tenant-staff", id],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("tenant_id", id);
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", ids);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (roles ?? []).map((r) => ({
        ...r,
        profile: byId.get(r.user_id),
      }));
    },
  });

  const { data: ratings } = useQuery({
    queryKey: ["admin-tenant-ratings", id],
    queryFn: async () => {
      const { data } = await (supabase.from("ratings") as any)
        .select("restaurant_rating, food_rating, driver_rating")
        .eq("tenant_id", id);
      return data ?? [];
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;
  }

  if (!tenant) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">لم يتم العثور على هذا المطعم.</p>
        <Link
          to="/admin/tenants"
          className="mt-4 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← العودة للقائمة
        </Link>
      </div>
    );
  }

  const deliveredOrders = (orders ?? []).filter((o) => o.status === "delivered");
  const totalRevenue = deliveredOrders.reduce((s, o) => s + (o.total_iqd ?? 0), 0);
  const activeOrders = (orders ?? []).filter((o) =>
    ["pending", "accepted", "preparing", "on_the_way"].includes(o.status),
  ).length;
  const avgRestaurant = avgOf(ratings ?? [], "restaurant_rating");
  const avgFood = avgOf(ratings ?? [], "food_rating");
  const avgDriver = avgOf(ratings ?? [], "driver_rating");

  const branchStats = (branches ?? []).map((b) => {
    const bOrders = (orders ?? []).filter((o) => o.branch_id === b.id);
    const bRevenue = bOrders
      .filter((o) => o.status === "delivered")
      .reduce((s, o) => s + (o.total_iqd ?? 0), 0);
    return { branch: b, orders: bOrders.length, revenue: bRevenue };
  });

  return (
    <>
      <div className="mb-4">
        <Link
          to="/admin/tenants"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <ArrowRight className="h-3 w-3" /> كل المطاعم
        </Link>
      </div>

      <PageHeader
        title={tenant.name}
        subtitle={`${tenant.slug}.mrt.llc • انضم في ${new Date(tenant.created_at).toLocaleDateString("ar-IQ")}`}
        action={
          <div className="flex gap-2">
            <a
              href={getTenantStorefrontUrl(tenant.slug, tenant.custom_domain)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" /> فتح
            </a>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ShoppingBag} label="طلبات نشطة" value={activeOrders} tone="blue" />
        <StatCard
          icon={TrendingUp}
          label="إجمالي الإيرادات"
          value={formatIQD(totalRevenue)}
          tone="green"
        />
        <StatCard icon={Building2} label="الفروع" value={branches?.length ?? 0} tone="purple" />
        <StatCard
          icon={Star}
          label="متوسط التقييم"
          value={avgRestaurant ? avgRestaurant.toFixed(1) : "—"}
          tone="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SubdomainCard
            tenant={tenant}
            onSaved={() => qc.invalidateQueries({ queryKey: ["admin-tenant", id] })}
          />
          <SubscriptionCard
            tenant={tenant}
            onSaved={() => qc.invalidateQueries({ queryKey: ["admin-tenant", id] })}
          />
          <FeaturesCard
            tenant={tenant}
            onSaved={() => qc.invalidateQueries({ queryKey: ["admin-tenant", id] })}
          />

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {branchStats.length} فرع • {deliveredOrders.length} طلب مكتمل
              </span>
              <h2 className="flex items-center gap-2 text-lg font-black">
                <Building2 className="h-5 w-5 text-primary" /> الفروع وأداؤها
              </h2>
            </div>
            {branchStats.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">لا فروع.</p>
            ) : (
              <div className="space-y-2">
                {branchStats.map(({ branch, orders: bo, revenue }) => (
                  <div
                    key={branch.id}
                    className="flex items-center justify-between rounded-xl border border-border p-3"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-lg bg-muted px-2 py-0.5 font-bold">{bo}</span>
                      <span className="text-emerald-700 font-bold">{formatIQD(revenue)}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{branch.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {branch.city ?? "—"} • {branch.is_active ? "نشط" : "معطّل"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">آخر 15 طلب</span>
              <h2 className="flex items-center gap-2 text-lg font-black">
                <ShoppingBag className="h-5 w-5 text-primary" /> آخر الطلبات
              </h2>
            </div>
            {orders && orders.length > 0 ? (
              <div className="space-y-1.5">
                {orders.slice(0, 15).map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
                  >
                    <span className={statusClass(o.status)}>{statusLabel(o.status)}</span>
                    <div className="text-right">
                      <div className="font-bold">{formatIQD(o.total_iqd)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        #{o.order_number} •{" "}
                        {new Date(o.created_at).toLocaleString("ar-IQ", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">لا طلبات بعد.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-black">
              <Store className="h-5 w-5 text-primary" /> بيانات المطعم
            </h2>
            <div className="space-y-2 text-sm">
              <InfoRow icon={Phone} value={tenant.phone ?? "—"} dir="ltr" />
              <InfoRow icon={MapPin} value={tenant.address ?? "—"} />
              <InfoRow
                icon={Calendar}
                value={`منذ ${new Date(tenant.created_at).toLocaleDateString("ar-IQ")}`}
              />
            </div>
            {tenant.description && (
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {tenant.description}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-black">
              <Star className="h-5 w-5 text-amber-500" /> التقييمات
            </h2>
            <div className="space-y-2 text-sm">
              <RatingRow label="المطعم" value={avgRestaurant} />
              <RatingRow label="الوجبات" value={avgFood} />
              <RatingRow label="المناديب" value={avgDriver} />
              <div className="mt-2 text-[10px] text-muted-foreground">
                عدد التقييمات: {ratings?.length ?? 0}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-black">
              <Users className="h-5 w-5 text-primary" /> الفريق
            </h2>
            {staff && staff.length > 0 ? (
              <div className="space-y-2 text-sm">
                {staff.map((s) => (
                  <div
                    key={`${s.user_id}-${s.role}`}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {roleLabel(s.role)}
                    </span>
                    <div className="text-right">
                      <div className="text-xs font-bold">{s.profile?.full_name ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {s.profile?.phone ?? "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">لا فريق مرتبط.</p>
            )}
          </div>

          <DangerZone tenant={tenant} onDeleted={() => navigate({ to: "/admin/tenants" })} />
        </div>
      </div>
    </>
  );
}

function SubdomainCard({ tenant, onSaved }: { tenant: any; onSaved: () => void }) {
  const [slug, setSlug] = useState<string>(tenant.slug);

  const save = useMutation({
    mutationFn: async () => {
      const nextSlug = slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      if (nextSlug.length < 2) throw new Error("اكتب Subdomain صالحاً من حرفين على الأقل");
      const { error } = await (supabase.from("tenants") as any)
        .update({ slug: nextSlug })
        .eq("id", tenant.id);
      if (error) {
        if (error.code === "23505") throw new Error("هذا الـ Subdomain مستخدم بالفعل لمطعم آخر");
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم تحديث الـ Subdomain");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasChanged = slug.trim().toLowerCase() !== tenant.slug;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black">رابط المطعم</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            يمكن للمشرف تغييره في أي وقت. الرابط السابق سيتوقف بعد الحفظ.
          </p>
        </div>
        <a
          href={getTenantStorefrontUrl(tenant.slug, tenant.custom_domain)}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-xs font-bold text-primary hover:underline"
        >
          فتح الرابط
        </a>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold">Subdomain</span>
        <div dir="ltr" className="flex items-center gap-2">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="restaurant-name"
            className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <span className="shrink-0 text-xs text-muted-foreground">.mrt.llc</span>
        </div>
      </label>
      <button
        onClick={() => save.mutate()}
        disabled={!hasChanged || save.isPending}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Save className="h-4 w-4" /> حفظ الـ Subdomain
      </button>
    </div>
  );
}

function SubscriptionCard({ tenant, onSaved }: { tenant: any; onSaved: () => void }) {
  const [plan, setPlan] = useState<string>(tenant.subscription_plan);
  const [status, setStatus] = useState<string>(tenant.subscription_status);
  const [fee, setFee] = useState<number>(tenant.monthly_fee_iqd ?? 0);
  const [expiresAt, setExpiresAt] = useState<string>(
    tenant.subscription_expires_at ? tenant.subscription_expires_at.slice(0, 10) : "",
  );
  const [notes, setNotes] = useState<string>(tenant.subscription_notes ?? "");

  useEffect(() => {
    const preset = PLANS.find((p) => p.value === plan);
    if (preset && plan !== tenant.subscription_plan) setFee(preset.fee);
  }, [plan]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("tenants") as any)
        .update({
          subscription_plan: plan,
          subscription_status: status,
          monthly_fee_iqd: fee,
          subscription_expires_at: expiresAt || null,
          subscription_notes: notes.trim() || null,
        })
        .eq("id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الاشتراك");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function extend(days: number) {
    const base = expiresAt ? new Date(expiresAt) : new Date();
    base.setDate(base.getDate() + days);
    setExpiresAt(base.toISOString().slice(0, 10));
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
        <Crown className="h-5 w-5 text-amber-500" /> الاشتراك
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold">الخطة</span>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            {PLANS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold">الحالة</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            {STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold">الرسوم الشهرية (د.ع)</span>
          <input
            type="number"
            value={fee}
            onChange={(e) => setFee(Number(e.target.value))}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            dir="ltr"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold">ينتهي في</span>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            dir="ltr"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => extend(30)}
          className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/20"
        >
          + شهر
        </button>
        <button
          onClick={() => extend(90)}
          className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/20"
        >
          + ٣ أشهر
        </button>
        <button
          onClick={() => extend(365)}
          className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/20"
        >
          + سنة
        </button>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-bold">ملاحظات</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="اختياري..."
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        <Save className="h-4 w-4" /> حفظ الاشتراك
      </button>
    </div>
  );
}

function FeaturesCard({ tenant, onSaved }: { tenant: any; onSaved: () => void }) {
  const [features, setFeatures] = useState<Record<string, boolean>>(tenant.features_enabled ?? {});
  const [accepting, setAccepting] = useState<boolean>(tenant.accepting_orders);
  const [isActive, setIsActive] = useState<boolean>(tenant.is_active);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("tenants") as any)
        .update({
          features_enabled: features,
          accepting_orders: accepting,
          is_active: isActive,
        })
        .eq("id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث الإعدادات");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const FEATURE_KEYS = [
    { key: "wallet", label: "المحفظة" },
    { key: "loyalty", label: "نظام الولاء" },
    { key: "credit", label: "الأجل" },
    { key: "coupons", label: "أكواد الخصم" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black">
        <Power className="h-5 w-5 text-primary" /> المميزات والتحكم
      </h2>

      <div className="space-y-2">
        <ToggleRow
          label="المطعم نشط على المنصة"
          value={isActive}
          onChange={setIsActive}
          hint="لو معطّل، صفحة المطعم مش هتظهر للزبائن"
        />
        <ToggleRow
          label="يستقبل طلبات جديدة"
          value={accepting}
          onChange={setAccepting}
          hint="إيقاف مؤقت في أوقات الضغط"
        />
        <div className="my-3 border-t border-border" />
        {FEATURE_KEYS.map((f) => (
          <ToggleRow
            key={f.key}
            label={f.label}
            value={!!features[f.key]}
            onChange={(v) => setFeatures({ ...features, [f.key]: v })}
          />
        ))}
      </div>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        <Save className="h-4 w-4" /> حفظ
      </button>
    </div>
  );
}

function DangerZone({ tenant, onDeleted }: { tenant: any; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tenants").delete().eq("id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف المطعم");
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-black text-red-800">
        <Trash2 className="h-4 w-4" /> منطقة خطر
      </h2>
      <p className="mb-3 text-xs text-red-700">
        حذف المطعم يحذف كل بياناته (فروع، منيو، طلبات، فريق) نهائياً.
      </p>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
        >
          حذف المطعم
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => del.mutate()}
            disabled={del.isPending}
            className="flex-1 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
          >
            نعم، احذف نهائياً
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="flex-1 rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700"
          >
            تراجع
          </button>
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-right transition ${
        value ? "border-primary/40 bg-primary/5" : "border-border bg-background hover:bg-muted/30"
      }`}
    >
      <div
        className={`h-6 w-11 rounded-full transition ${value ? "bg-primary" : "bg-muted"} relative`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            value ? "right-0.5" : "right-[calc(100%-1.375rem)]"
          }`}
        />
      </div>
      <div className="flex-1 pr-3">
        <div className="text-sm font-bold">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </div>
    </button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone: "blue" | "green" | "purple" | "amber";
}) {
  const tones = {
    blue: "bg-blue-100 text-blue-800",
    green: "bg-emerald-100 text-emerald-800",
    purple: "bg-purple-100 text-purple-800",
    amber: "bg-amber-100 text-amber-800",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div
        className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xl font-black">{value}</div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  value,
  dir,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span dir={dir}>{value}</span>
    </div>
  );
}

function RatingRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`h-3.5 w-3.5 ${value && n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-neutral-300"}`}
          />
        ))}
        <span className="mr-1 text-xs font-bold">{value ? value.toFixed(1) : "—"}</span>
      </div>
      <span className="text-xs">{label}</span>
    </div>
  );
}

function avgOf(rows: any[], key: string): number | null {
  const nums = rows.map((r) => r[key]).filter((v) => typeof v === "number");
  if (nums.length === 0) return null;
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

function statusLabel(s: string): string {
  return (
    (
      {
        pending: "بانتظار",
        accepted: "مقبول",
        preparing: "قيد التحضير",
        on_the_way: "في الطريق",
        delivered: "تم التسليم",
        cancelled: "ملغى",
        rejected: "مرفوض",
      } as Record<string, string>
    )[s] ?? s
  );
}

function statusClass(s: string): string {
  const map: Record<string, string> = {
    delivered: "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800",
    cancelled: "rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800",
    rejected: "rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800",
    on_the_way: "rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800",
  };
  return map[s] ?? "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800";
}

function roleLabel(r: string): string {
  return (
    (
      { owner: "مالك", driver: "مندوب", customer: "زبون", super_admin: "أدمن" } as Record<
        string,
        string
      >
    )[r] ?? r
  );
}
