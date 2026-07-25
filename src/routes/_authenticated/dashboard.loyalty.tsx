import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, formatIQD } from "@/lib/useMe";
import { PageHeader } from "@/components/DashboardShell";
import { Gift, Save, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/loyalty")({
  component: LoyaltyPage,
});

type Tenant = {
  loyalty_enabled: boolean;
  loyalty_target_orders: number;
  loyalty_reward_type: "wallet_credit" | "discount" | "free_item";
  loyalty_reward_value_iqd: number;
  loyalty_reward_item_id: string | null;
};

type MenuItem = { id: string; name: string; price_iqd: number };

function LoyaltyPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const tenantId = me?.tenantId;

  const { data: tenant } = useQuery({
    queryKey: ["tenant-loyalty", tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("tenants") as any)
        .select("loyalty_enabled,loyalty_target_orders,loyalty_reward_type,loyalty_reward_value_iqd,loyalty_reward_item_id")
        .eq("id", tenantId!).maybeSingle();
      if (error) throw error;
      return data as Tenant | null;
    },
    enabled: !!tenantId,
  });

  const { data: items } = useQuery({
    queryKey: ["menu-items-loyalty", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_items")
        .select("id,name,price_iqd").eq("tenant_id", tenantId!).order("name");
      if (error) throw error;
      return (data ?? []) as MenuItem[];
    },
    enabled: !!tenantId,
  });

  const { data: recentRedemptions } = useQuery({
    queryKey: ["loyalty-redemptions", tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("loyalty_redemptions") as any)
        .select("id,reward_type,reward_value_iqd,milestone_number,created_at,user_id")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; reward_type: string; reward_value_iqd: number;
        milestone_number: number; created_at: string; user_id: string;
      }>;
    },
    enabled: !!tenantId,
  });

  const [enabled, setEnabled] = useState(false);
  const [target, setTarget] = useState(10);
  const [rewardType, setRewardType] = useState<"wallet_credit" | "discount" | "free_item">("wallet_credit");
  const [rewardValue, setRewardValue] = useState(5000);
  const [rewardItemId, setRewardItemId] = useState<string>("");

  useEffect(() => {
    if (!tenant) return;
    setEnabled(tenant.loyalty_enabled);
    setTarget(tenant.loyalty_target_orders);
    setRewardType(tenant.loyalty_reward_type);
    setRewardValue(tenant.loyalty_reward_value_iqd);
    setRewardItemId(tenant.loyalty_reward_item_id ?? "");
  }, [tenant]);

  const save = useMutation({
    mutationFn: async () => {
      if (target < 1) throw new Error("الهدف يجب أن يكون طلب واحد على الأقل");
      if (rewardType !== "free_item" && rewardValue < 1) throw new Error("قيمة الجائزة مطلوبة");
      if (rewardType === "free_item" && !rewardItemId) throw new Error("اختر الوجبة المجانية");
      const payload: any = {
        loyalty_enabled: enabled,
        loyalty_target_orders: target,
        loyalty_reward_type: rewardType,
        loyalty_reward_value_iqd: rewardType === "free_item" ? 0 : rewardValue,
        loyalty_reward_item_id: rewardType === "free_item" ? rewardItemId : null,
      };
      const { error } = await (supabase.from("tenants") as any).update(payload).eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["tenant-loyalty"] }); },
    onError: (e: any) => toast.error(e.message ?? "فشل الحفظ"),
  });

  return (
    <>
      <PageHeader
        title="نظام الولاء"
        subtitle="كافئ زبائنك المتكررين تلقائياً بعد عدد محدد من الطلبات."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Settings */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">إعدادات الولاء</h2>
            <label className="inline-flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="h-5 w-5" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              مفعّل
            </label>
          </div>

          <div className={enabled ? "" : "pointer-events-none opacity-50"}>
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-bold">
                عدد الطلبات المطلوبة للحصول على الجائزة
              </label>
              <input
                type="number" min={1} max={100} value={target}
                onChange={(e) => setTarget(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">مثال: 10 = بعد كل 10 طلبات مكتملة يحصل الزبون على الجائزة.</p>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-bold">نوع الجائزة</label>
              <div className="grid gap-2 sm:grid-cols-3">
                <RewardOption
                  active={rewardType === "wallet_credit"}
                  onClick={() => setRewardType("wallet_credit")}
                  title="رصيد محفظة"
                  hint="يُضاف للمحفظة تلقائياً"
                />
                <RewardOption
                  active={rewardType === "discount"}
                  onClick={() => setRewardType("discount")}
                  title="كوبون خصم"
                  hint="مبلغ ثابت يُخصم من الطلب"
                />
                <RewardOption
                  active={rewardType === "free_item"}
                  onClick={() => setRewardType("free_item")}
                  title="وجبة مجانية"
                  hint="كوبون بقيمة الوجبة"
                />
              </div>
            </div>

            {rewardType !== "free_item" ? (
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-bold">قيمة الجائزة (دينار عراقي)</label>
                <input
                  type="number" min={0} step={500} value={rewardValue}
                  onChange={(e) => setRewardValue(Number(e.target.value) || 0)}
                  dir="ltr"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>
            ) : (
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-bold">الوجبة المجانية</label>
                <select
                  value={rewardItemId}
                  onChange={(e) => {
                    setRewardItemId(e.target.value);
                    const it = items?.find((i) => i.id === e.target.value);
                    if (it) setRewardValue(it.price_iqd);
                  }}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
                >
                  <option value="">— اختر —</option>
                  {items?.map((it) => (
                    <option key={it.id} value={it.id}>{it.name} — {formatIQD(it.price_iqd)}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">سيصدر كوبون بقيمة الوجبة عند وصول الزبون للهدف.</p>
              </div>
            )}
          </div>

          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {save.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </button>
        </div>

        {/* Explainer */}
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6">
          <div className="mb-3 flex items-center gap-2 font-black text-primary">
            <Gift className="h-5 w-5" /> كيف يعمل؟
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• كل طلب مكتمل (Delivered) يُحتسب للزبون.</li>
            <li>• لما يوصل عدد طلباته للهدف، يستلم الجائزة تلقائياً.</li>
            <li>• رصيد المحفظة يُضاف مباشرة، والخصم/الوجبة يصدر ككوبون باسمه.</li>
            <li>• العدّاد يستمر: كل دورة جديدة = جائزة جديدة.</li>
          </ul>
        </div>
      </div>

      {/* Recent redemptions */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-black">آخر الجوائز الممنوحة</h2>
        </div>
        {recentRedemptions && recentRedemptions.length > 0 ? (
          <div className="grid gap-2">
            {recentRedemptions.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-background p-3 text-sm">
                <div className="text-right">
                  <div className="font-bold">
                    {r.reward_type === "wallet_credit" ? "رصيد محفظة" : r.reward_type === "discount" ? "كوبون خصم" : "وجبة مجانية"}
                    {r.reward_value_iqd > 0 && <span className="mr-2 text-primary">{formatIQD(r.reward_value_iqd)}</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">دورة #{r.milestone_number} — زبون: {r.user_id.slice(0, 8)}…</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("ar-IQ")}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> لم يستلم أي زبون جائزة بعد.
          </div>
        )}
      </div>
    </>
  );
}

function RewardOption({ active, onClick, title, hint }: { active: boolean; onClick: () => void; title: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-right transition ${active ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40"}`}
    >
      <div className={`font-bold ${active ? "text-primary" : ""}`}>{title}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
    </button>
  );
}
