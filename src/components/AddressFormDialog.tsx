import { useEffect, useState } from "react";
import { X, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CustomerAddress, AddressInput } from "@/lib/useAddresses";

export function AddressFormDialog({
  open,
  onClose,
  initial,
  onSubmit,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  initial?: CustomerAddress | null;
  onSubmit: (input: AddressInput) => Promise<void> | void;
  saving?: boolean;
}) {
  const [label, setLabel] = useState("المنزل");
  const [fullAddress, setFullAddress] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel(initial?.label ?? "المنزل");
    setFullAddress(initial?.full_address ?? "");
    setCity(initial?.city ?? "");
    setNotes(initial?.notes ?? "");
    setLat(initial?.latitude ?? null);
    setLng(initial?.longitude ?? null);
    setIsDefault(initial?.is_default ?? false);
  }, [open, initial]);

  if (!open) return null;

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocating(false);
        toast.success("تم تحديد موقعك");
      },
      () => {
        setLocating(false);
        toast.error("تعذر تحديد موقعك");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullAddress.trim()) return;
    await onSubmit({
      label: label.trim() || "المنزل",
      full_address: fullAddress.trim(),
      city: city.trim() || null,
      notes: notes.trim() || null,
      latitude: lat,
      longitude: lng,
      is_default: isDefault,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-6 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
          <h3 className="text-lg font-black">
            {initial ? "تعديل العنوان" : "إضافة عنوان جديد"}
          </h3>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold">الاسم (بيت، عمل…)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold">العنوان الكامل *</span>
            <textarea
              required
              value={fullAddress}
              onChange={(e) => setFullAddress(e.target.value)}
              rows={2}
              placeholder="الشارع، الحي، أقرب معلم…"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold">المدينة</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold">ملاحظات (اختياري)</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: الطابق الثاني، بجانب الصيدلية"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input py-2.5 text-sm font-bold text-primary hover:border-primary disabled:opacity-60"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            {lat != null && lng != null ? "تحديث موقعي الحالي" : "استخدم موقعي الحالي"}
          </button>
          {lat != null && lng != null && (
            <div className="text-center text-[11px] text-muted-foreground" dir="ltr">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </div>
          )}

          <label className="flex items-center gap-2 rounded-xl border border-input p-2.5">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-bold">تعيينه كعنوان افتراضي</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving || !fullAddress.trim()}
          className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {saving ? "جاري الحفظ…" : initial ? "حفظ التعديلات" : "إضافة العنوان"}
        </button>
      </form>
    </div>
  );
}
