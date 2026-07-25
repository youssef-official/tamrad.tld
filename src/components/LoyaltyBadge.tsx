import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Gift } from "lucide-react";
import { useEffect, useState } from "react";

type Props = { tenantId: string; primary: string };

type Progress = {
  enabled: boolean;
  target_orders: number;
  reward_type: "wallet_credit" | "discount" | "free_item";
  reward_value_iqd: number;
  delivered_count: number;
  last_milestone: number;
  progress_in_cycle: number;
  remaining_to_next: number;
};

export function LoyaltyBadge({ tenantId, primary }: Props) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserId(s?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: progress } = useQuery({
    queryKey: ["loyalty-progress", tenantId, userId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_loyalty_progress", {
        _tenant_id: tenantId, _user_id: userId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as Progress | null;
    },
    enabled: !!tenantId && !!userId,
  });

  if (!progress?.enabled || !userId) return null;

  const pct = progress.target_orders > 0
    ? Math.min(100, Math.round((progress.progress_in_cycle / progress.target_orders) * 100))
    : 0;

  const rewardLabel =
    progress.reward_type === "wallet_credit" ? `رصيد ${progress.reward_value_iqd.toLocaleString("ar-IQ")} د.ع`
    : progress.reward_type === "discount" ? `خصم ${progress.reward_value_iqd.toLocaleString("ar-IQ")} د.ع`
    : "وجبة مجانية";

  return (
    <div
      className="rounded-2xl border bg-white/70 p-3 text-xs shadow-sm"
      style={{ borderColor: primary + "40" }}
    >
      <div className="mb-1 flex items-center gap-1.5 font-black" style={{ color: primary }}>
        <Gift className="h-3.5 w-3.5" /> نظام الولاء
      </div>
      {progress.remaining_to_next === 0 ? (
        <div className="text-[11px] font-bold text-emerald-600">
          🎉 استلمت جائزتك! ابدأ دورة جديدة.
        </div>
      ) : (
        <>
          <div className="mb-1.5 text-[11px] leading-relaxed text-neutral-700">
            بقي لك <span className="font-black" style={{ color: primary }}>{progress.remaining_to_next}</span> طلبات
            <br />للحصول على <span className="font-bold">{rewardLabel}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: primary }} />
          </div>
          <div className="mt-1 text-[10px] text-neutral-500">
            {progress.progress_in_cycle} / {progress.target_orders}
          </div>
        </>
      )}
    </div>
  );
}
