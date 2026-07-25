// Customer-side dialog to pick modifiers before adding an item to the cart.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatIQD } from "@/lib/useMe";
import { X, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

export type PickedModifier = {
  group_id: string; group_name: string;
  option_id: string; option_name: string; extra_price_iqd: number;
};

type Group = {
  id: string; name: string; min_select: number; max_select: number; is_required: boolean; sort_order: number;
};
type Option = {
  id: string; group_id: string; name: string; extra_price_iqd: number; is_default: boolean; is_active: boolean;
};

export function ModifierPicker({
  itemId, itemName, basePrice, onCancel, onConfirm, primary,
}: {
  itemId: string; itemName: string; basePrice: number;
  onCancel: () => void;
  onConfirm: (picks: PickedModifier[], finalPrice: number) => void;
  primary: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["mods-public", itemId],
    queryFn: async () => {
      const { data: groups } = await (supabase.from("menu_modifier_groups") as any)
        .select("*").eq("menu_item_id", itemId).order("sort_order");
      const gs = (groups ?? []) as Group[];
      if (gs.length === 0) return { groups: [] as Group[], options: [] as Option[] };
      const { data: options } = await (supabase.from("menu_modifier_options") as any)
        .select("*").in("group_id", gs.map((g) => g.id)).eq("is_active", true).order("sort_order");
      return { groups: gs, options: (options ?? []) as Option[] };
    },
  });

  // Map<group_id, Set<option_id>>
  const [picks, setPicks] = useState<Record<string, string[]>>({});

  // Seed defaults on first data load
  useMemo(() => {
    if (!data) return;
    const seeded: Record<string, string[]> = {};
    for (const g of data.groups) {
      const defaults = data.options.filter((o) => o.group_id === g.id && o.is_default).slice(0, g.max_select);
      if (defaults.length > 0) seeded[g.id] = defaults.map((d) => d.id);
    }
    setPicks((prev) => Object.keys(prev).length === 0 ? seeded : prev);
  }, [data]);

  const groups = data?.groups ?? [];
  const options = data?.options ?? [];

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    for (const g of groups) {
      const n = (picks[g.id] ?? []).length;
      if (g.is_required && n < g.min_select) e[g.id] = `يجب اختيار ${g.min_select} على الأقل`;
      else if (n < g.min_select) e[g.id] = `يجب اختيار ${g.min_select} على الأقل`;
    }
    return e;
  }, [groups, picks]);

  const finalPrice = useMemo(() => {
    let extra = 0;
    for (const g of groups) {
      for (const oid of picks[g.id] ?? []) {
        const o = options.find((x) => x.id === oid);
        if (o) extra += o.extra_price_iqd;
      }
    }
    return basePrice + extra;
  }, [basePrice, groups, options, picks]);

  function toggle(g: Group, o: Option) {
    setPicks((cur) => {
      const chosen = cur[g.id] ?? [];
      const isSel = chosen.includes(o.id);
      if (g.max_select === 1) return { ...cur, [g.id]: isSel ? [] : [o.id] };
      if (isSel) return { ...cur, [g.id]: chosen.filter((x) => x !== o.id) };
      if (chosen.length >= g.max_select) return cur;
      return { ...cur, [g.id]: [...chosen, o.id] };
    });
  }

  function confirm() {
    const flat: PickedModifier[] = [];
    for (const g of groups) {
      for (const oid of picks[g.id] ?? []) {
        const o = options.find((x) => x.id === oid);
        if (o) flat.push({
          group_id: g.id, group_name: g.name,
          option_id: o.id, option_name: o.name, extra_price_iqd: o.extra_price_iqd,
        });
      }
    }
    onConfirm(flat, finalPrice);
  }

  const canConfirm = Object.keys(errors).length === 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onCancel}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onCancel}><X className="h-5 w-5" /></button>
          <h3 className="text-lg font-black">{itemName}</h3>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" style={{ color: primary }} /></div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl bg-neutral-50 p-4 text-center text-sm text-neutral-600">
            لا إضافات متاحة لهذا الصنف. اضغط "إضافة للسلة".
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => {
              const opts = options.filter((o) => o.group_id === g.id);
              const chosen = picks[g.id] ?? [];
              return (
                <div key={g.id} className="rounded-2xl border border-neutral-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-neutral-500">
                      {g.max_select === 1 ? "اختر واحد" : `اختر حتى ${g.max_select}`}
                      {g.is_required && <span className="text-red-500"> *</span>}
                    </span>
                    <h4 className="font-bold">{g.name}</h4>
                  </div>
                  <div className="space-y-1.5">
                    {opts.map((o) => {
                      const isSel = chosen.includes(o.id);
                      return (
                        <label
                          key={o.id}
                          className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-3 text-sm transition ${
                            isSel ? "border-transparent" : "border-neutral-200 hover:bg-neutral-50"
                          }`}
                          style={isSel ? { background: primary, color: "white" } : undefined}
                        >
                          <input
                            type={g.max_select === 1 ? "radio" : "checkbox"}
                            name={g.id}
                            checked={isSel}
                            onChange={() => toggle(g, o)}
                            className="sr-only"
                          />
                          <span className="text-xs font-mono">
                            {o.extra_price_iqd > 0 ? `+ ${formatIQD(o.extra_price_iqd)}` : "مجاناً"}
                          </span>
                          <span className="flex-1 text-right font-bold">{o.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  {errors[g.id] && <div className="mt-1 text-xs text-red-600">{errors[g.id]}</div>}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
          <button onClick={onCancel} className="rounded-xl border px-4 py-2 text-sm font-bold">إلغاء</button>
          <button
            onClick={confirm}
            disabled={!canConfirm}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: primary }}
          >
            إضافة · {formatIQD(finalPrice)}
          </button>
        </div>
      </div>
    </div>
  );
}
