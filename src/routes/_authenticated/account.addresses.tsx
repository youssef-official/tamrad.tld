import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useAddresses, useAddressMutations, type CustomerAddress } from "@/lib/useAddresses";
import { AddressFormDialog } from "@/components/AddressFormDialog";
import { CustomerBottomNav } from "@/components/CustomerBottomNav";

export const Route = createFileRoute("/_authenticated/account/addresses")({
  head: () => ({
    meta: [
      { title: "عناوين التوصيل — تمراد" },
      { name: "description", content: "أضف وأدر عناوين التوصيل الخاصة بك." },
      { property: "og:title", content: "عناوين التوصيل — تمراد" },
      { property: "og:description", content: "أدر عناوين التوصيل الخاصة بك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AddressesPage,
});

function AddressesPage() {
  const { data: addresses = [], isLoading } = useAddresses();
  const { create, update, remove, setDefault } = useAddressMutations();
  const [editing, setEditing] = useState<CustomerAddress | null>(null);
  const [open, setOpen] = useState(false);

  const saving = create.isPending || update.isPending;

  async function handleSubmit(input: any) {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...input });
        toast.success("تم حفظ العنوان");
      } else {
        await create.mutateAsync(input);
        toast.success("تم إضافة العنوان");
      }
      setOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-4">
        <Link to="/account" className="p-1">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-black">
          <MapPin className="h-5 w-5 text-primary" /> عناوين التوصيل
        </h1>
      </header>

      <main className="mx-auto max-w-md space-y-3 p-4">
        <button
          onClick={() => { setEditing(null); setOpen(true); }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 py-3 text-sm font-bold text-primary hover:border-primary"
        >
          <Plus className="h-4 w-4" /> إضافة عنوان جديد
        </button>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">جاري التحميل…</div>
        ) : addresses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            لا توجد عناوين محفوظة بعد. أضف عنوانك الأول للطلب بسهولة.
          </div>
        ) : (
          addresses.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-black">{a.label}</span>
                  {a.is_default && (
                    <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      <Star className="h-3 w-3" /> افتراضي
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!a.is_default && (
                    <button
                      onClick={async () => {
                        try { await setDefault.mutateAsync(a.id); toast.success("تم تعيينه افتراضياً"); }
                        catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
                      }}
                      className="rounded-lg px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/10"
                    >
                      تعيين افتراضي
                    </button>
                  )}
                  <button
                    onClick={() => { setEditing(a); setOpen(true); }}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                    aria-label="تعديل"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("حذف هذا العنوان؟")) return;
                      try { await remove.mutateAsync(a.id); toast.success("تم الحذف"); }
                      catch (e) { toast.error(e instanceof Error ? e.message : "خطأ"); }
                    }}
                    className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                    aria-label="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="text-sm">{a.full_address}</div>
              {a.city && <div className="mt-0.5 text-xs text-muted-foreground">{a.city}</div>}
              {a.notes && <div className="mt-0.5 text-[11px] text-muted-foreground">{a.notes}</div>}
            </div>
          ))
        )}
      </main>

      <AddressFormDialog
        open={open}
        onClose={() => { setOpen(false); setEditing(null); }}
        initial={editing}
        onSubmit={handleSubmit}
        saving={saving}
      />

      <CustomerBottomNav />
    </div>
  );
}
