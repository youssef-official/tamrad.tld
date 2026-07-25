import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, formatIQD } from "@/lib/useMe";
import { useCurrentBranch } from "@/lib/useBranch";
import { EmptyState, PageHeader } from "@/components/DashboardShell";
import { Plus, Trash2, UtensilsCrossed, X, Edit3, Upload, Loader2, Layers } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { uploadTenantImage } from "@/lib/uploadImage";
import { ModifierManager } from "@/components/ModifierManager";

export const Route = createFileRoute("/_authenticated/dashboard/menu")({
  component: MenuPage,
});

type Category = { id: string; name: string; sort_order: number; is_active: boolean };
type Item = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_iqd: number;
  image_url: string | null;
  is_active: boolean;
};

function MenuPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const tenantId = me?.tenantId;
  const { branchId } = useCurrentBranch();

  const [showItem, setShowItem] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [modsFor, setModsFor] = useState<Item | null>(null);
  const [newCategory, setNewCategory] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["categories", tenantId, branchId],
    queryFn: async () => {
      let q = supabase.from("menu_categories").select("*").eq("tenant_id", tenantId!).order("sort_order");
      if (branchId) q = q.or(`branch_id.eq.${branchId},branch_id.is.null`);
      const { data } = await q;
      return (data ?? []) as Category[];
    },
    enabled: !!tenantId,
  });

  const { data: items } = useQuery({
    queryKey: ["items", tenantId, branchId],
    queryFn: async () => {
      let q = supabase.from("menu_items").select("*").eq("tenant_id", tenantId!).order("created_at");
      if (branchId) q = q.or(`branch_id.eq.${branchId},branch_id.is.null`);
      const { data } = await q;
      return (data ?? []) as Item[];
    },
    enabled: !!tenantId,
  });

  const addCategory = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("menu_categories")
        .insert({ tenant_id: tenantId!, branch_id: branchId ?? null, name, sort_order: (categories?.length ?? 0) } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setNewCategory("");
      toast.success("تمت الإضافة");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  const toggleItem = useMutation({
    mutationFn: async (it: Item) => {
      const { error } = await supabase
        .from("menu_items")
        .update({ is_active: !it.is_active })
        .eq("id", it.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });

  const delItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });

  return (
    <>
      <PageHeader
        title="المنيو"
        subtitle="نظّم فئات المنيو والأصناف المتاحة للزبائن."
        action={
          <button
            onClick={() => {
              setEditingItem(null);
              setShowItem(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            إضافة صنف
          </button>
        }
      />


      {/* Categories */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <h2 className="mb-4 text-lg font-black">فئات المنيو</h2>
        <div className="mb-4 flex gap-2">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="اسم الفئة (مثال: بيتزا)"
            className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => newCategory && addCategory.mutate(newCategory)}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            إضافة
          </button>
        </div>
        {categories && categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-2 rounded-full bg-lime/40 px-3 py-1.5 text-sm font-bold text-primary"
              >
                {c.name}
                <button onClick={() => delCategory.mutate(c.id)} className="text-primary/60 hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">لا فئات بعد. أضف فئة أولاً ثم أضف الأصناف.</p>
        )}
      </div>

      {/* Items */}
      {items && items.length > 0 ? (
        <div className="grid gap-3">
          {items.map((it) => (
            <div key={it.id} className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 text-right">
                  <div className="flex items-baseline justify-start gap-3">
                    <h3 className="text-lg font-bold">{it.name}</h3>
                    <span className="font-black text-primary">{formatIQD(it.price_iqd)}</span>
                  </div>
                  {it.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{it.description}</p>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {categories?.find((c) => c.id === it.category_id)?.name ?? "بدون فئة"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleItem.mutate(it)}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      it.is_active
                        ? "bg-lime text-lime-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {it.is_active ? "معروض" : "مخفي"}
                  </button>
                  <button
                    onClick={() => setModsFor(it)}
                    title="إدارة الإضافات"
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/5"
                  >
                    <Layers className="h-3.5 w-3.5" /> إضافات
                  </button>
                  <button
                    onClick={() => {
                      setEditingItem(it);
                      setShowItem(true);
                    }}
                    className="rounded-lg p-2 hover:bg-muted"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => delItem.mutate(it.id)}
                    className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={UtensilsCrossed}
          title="لا أصناف بعد"
          hint="أضف فئة ثم أضف أصنافك لتظهر للزبائن."
        />
      )}

      {showItem && tenantId && (
        <ItemForm
          tenantId={tenantId}
          branchId={branchId}
          item={editingItem}
          categories={categories ?? []}
          onClose={() => setShowItem(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["items"] });
            setShowItem(false);
          }}
        />
      )}

      {modsFor && tenantId && (
        <ModifierManager
          itemId={modsFor.id}
          itemName={modsFor.name}
          tenantId={tenantId}
          onClose={() => setModsFor(null)}
        />
      )}
    </>
  );
}

function ItemForm({
  tenantId,
  branchId,
  item,
  categories,
  onClose,
  onSaved,
}: {
  tenantId: string;
  branchId: string | null;
  item: Item | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item?.price_iqd?.toString() ?? "");
  const [categoryId, setCategoryId] = useState(item?.category_id ?? categories[0]?.id ?? "");
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? "");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadTenantImage(tenantId, file, "menu");
      setImageUrl(url);
      toast.success("تم رفع الصورة");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ في الرفع");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = {
        tenant_id: tenantId,
        branch_id: branchId ?? null,
        name,
        description: description || null,
        price_iqd: parseInt(price) || 0,
        category_id: categoryId || null,
        image_url: imageUrl || null,
      };
      const { error } = item
        ? await supabase.from("menu_items").update(payload).eq("id", item.id)
        : await supabase.from("menu_items").insert(payload);
      if (error) throw error;
      toast.success(item ? "تم التحديث" : "تمت الإضافة");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-[var(--shadow-elegant)]">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onClose}><X className="h-5 w-5" /></button>
          <h2 className="text-xl font-black">{item ? "تعديل صنف" : "إضافة صنف"}</h2>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">اسم الصنف</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">الوصف</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold">السعر (د.ع)</span>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required min="0" dir="ltr"
                className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold">الفئة</span>
              {categories.length > 0 ? (
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary">
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <QuickCategoryCreator tenantId={tenantId} onCreated={setCategoryId} />
              )}
            </label>

          </div>
          <div>
            <span className="mb-1.5 block text-sm font-bold">صورة الصنف</span>
            {imageUrl && (
              <img src={imageUrl} alt="" className="mb-2 h-32 w-full rounded-xl object-cover" />
            )}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input px-4 py-3 text-sm font-bold hover:border-primary">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "جاري الرفع..." : imageUrl ? "تغيير الصورة" : "رفع صورة"}
              <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="hidden" />
            </label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} dir="ltr"
              placeholder="أو الصق رابطاً"
              className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-2 text-xs outline-none focus:border-primary" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-bold">إلغاء</button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
              {loading ? "..." : "حفظ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuickCategoryCreator({ tenantId, onCreated }: { tenantId: string; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from("menu_categories")
        .insert({ tenant_id: tenantId, name: name.trim(), sort_order: 0 })
        .select("id").single();
      if (error) throw error;
      onCreated(data.id);
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("تم إنشاء الفئة");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally { setSaving(false); }
  }
  return (
    <div className="flex gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم فئة جديدة"
        className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
      <button type="button" onClick={add} disabled={saving}
        className="rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60">
        {saving ? "..." : "إنشاء"}
      </button>
    </div>
  );
}

