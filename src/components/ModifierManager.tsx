// Owner-side manager for a menu item's modifier groups and options.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatIQD } from "@/lib/useMe";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Group = {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  is_required: boolean;
  sort_order: number;
};
type Option = {
  id: string;
  group_id: string;
  name: string;
  extra_price_iqd: number;
  is_default: boolean;
  is_active: boolean;
};

export function ModifierManager({
  itemId, itemName, tenantId, onClose,
}: {
  itemId: string; itemName: string; tenantId: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [newGroupName, setNewGroupName] = useState("");

  const { data: groups, isLoading } = useQuery({
    queryKey: ["mod-groups", itemId],
    queryFn: async () => {
      const { data } = await (supabase.from("menu_modifier_groups") as any)
        .select("*").eq("menu_item_id", itemId).order("sort_order");
      return (data ?? []) as Group[];
    },
  });

  const { data: options } = useQuery({
    queryKey: ["mod-options", itemId],
    queryFn: async () => {
      const ids = (groups ?? []).map((g) => g.id);
      if (ids.length === 0) return [];
      const { data } = await (supabase.from("menu_modifier_options") as any)
        .select("*").in("group_id", ids).order("sort_order");
      return (data ?? []) as Option[];
    },
    enabled: !!groups && groups.length > 0,
  });

  const addGroup = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await (supabase.from("menu_modifier_groups") as any).insert({
        tenant_id: tenantId, menu_item_id: itemId, name,
        min_select: 0, max_select: 1, is_required: false,
        sort_order: (groups?.length ?? 0),
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mod-groups", itemId] }); setNewGroupName(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateGroup = useMutation({
    mutationFn: async (g: Partial<Group> & { id: string }) => {
      const { error } = await (supabase.from("menu_modifier_groups") as any)
        .update(g).eq("id", g.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mod-groups", itemId] }),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("menu_modifier_groups") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mod-groups", itemId] });
      qc.invalidateQueries({ queryKey: ["mod-options", itemId] });
    },
  });

  const addOption = useMutation({
    mutationFn: async (v: { group_id: string; name: string; extra_price_iqd: number }) => {
      const { error } = await (supabase.from("menu_modifier_options") as any).insert({
        tenant_id: tenantId, group_id: v.group_id, name: v.name,
        extra_price_iqd: v.extra_price_iqd, is_default: false, is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mod-options", itemId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteOption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("menu_modifier_options") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mod-options", itemId] }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onClose}><X className="h-5 w-5" /></button>
          <h2 className="text-xl font-black">إضافات: {itemName}</h2>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          أنشئ مجموعات مثل "الصوصات" أو "المشروبات" ثم أضف خياراتها. الزبون يختار قبل إضافة الصنف للسلة.
        </p>

        <div className="mb-4 flex gap-2">
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="اسم المجموعة (مثال: الصوصات)"
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => newGroupName.trim() && addGroup.mutate(newGroupName.trim())}
            className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> إضافة مجموعة
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !groups || groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
            لا مجموعات بعد. أضف مجموعتك الأولى للأعلى.
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <GroupCard
                key={g.id}
                group={g}
                options={(options ?? []).filter((o) => o.group_id === g.id)}
                onUpdate={(p) => updateGroup.mutate({ id: g.id, ...p })}
                onDelete={() => deleteGroup.mutate(g.id)}
                onAddOption={(name, price) => addOption.mutate({ group_id: g.id, name, extra_price_iqd: price })}
                onDeleteOption={(id) => deleteOption.mutate(id)}
              />
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
        >تم</button>
      </div>
    </div>
  );
}

function GroupCard({
  group, options, onUpdate, onDelete, onAddOption, onDeleteOption,
}: {
  group: Group;
  options: Option[];
  onUpdate: (p: Partial<Group>) => void;
  onDelete: () => void;
  onAddOption: (name: string, price: number) => void;
  onDeleteOption: (id: string) => void;
}) {
  const [optName, setOptName] = useState("");
  const [optPrice, setOptPrice] = useState("0");

  return (
    <div className="rounded-2xl border border-border bg-background/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex-1">
          <input
            defaultValue={group.name}
            onBlur={(e) => e.target.value !== group.name && onUpdate({ name: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-bold outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={() => { if (confirm("حذف المجموعة وكل خياراتها؟")) onDelete(); }}
          className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
        ><Trash2 className="h-4 w-4" /></button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
        <label className="flex flex-col gap-1">
          <span className="font-bold">حد أدنى</span>
          <input
            type="number" min={0} defaultValue={group.min_select}
            onBlur={(e) => onUpdate({ min_select: parseInt(e.target.value) || 0 })}
            className="rounded-lg border border-input bg-background px-2 py-1 outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold">حد أعلى</span>
          <input
            type="number" min={1} defaultValue={group.max_select}
            onBlur={(e) => onUpdate({ max_select: Math.max(1, parseInt(e.target.value) || 1) })}
            className="rounded-lg border border-input bg-background px-2 py-1 outline-none focus:border-primary"
          />
        </label>
        <label className="flex items-end gap-1.5">
          <input
            type="checkbox" defaultChecked={group.is_required}
            onChange={(e) => onUpdate({ is_required: e.target.checked })}
          />
          <span className="font-bold">إجباري</span>
        </label>
      </div>

      <div className="space-y-1.5">
        {options.length === 0 && (
          <div className="text-xs text-muted-foreground">لا خيارات — أضف أول خيار للأسفل.</div>
        )}
        {options.map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded-lg border border-input bg-card px-3 py-1.5 text-sm">
            <button onClick={() => onDeleteOption(o.id)} className="text-destructive hover:bg-destructive/10 rounded p-1">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-mono">
              {o.extra_price_iqd > 0 ? `+ ${formatIQD(o.extra_price_iqd)}` : "مجاناً"}
            </span>
            <span className="flex-1 text-right font-bold">{o.name}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={optName} onChange={(e) => setOptName(e.target.value)}
          placeholder="اسم الخيار (كاتشب، بيبسي...)"
          className="flex-1 rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
        />
        <input
          type="number" min={0} value={optPrice} onChange={(e) => setOptPrice(e.target.value)}
          className="w-24 rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
          dir="ltr" placeholder="0"
        />
        <button
          onClick={() => {
            if (!optName.trim()) return;
            onAddOption(optName.trim(), parseInt(optPrice) || 0);
            setOptName(""); setOptPrice("0");
          }}
          className="rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground"
        >إضافة</button>
      </div>
    </div>
  );
}
