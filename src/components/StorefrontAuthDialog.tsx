import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, Store, User, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called after a successful sign-in / confirmed sign-up. */
  onSuccess?: () => void;
  name: string;
  logoUrl?: string | null;
  primary: string;
  tenantId: string;
};

/**
 * In-storefront auth: lets a customer sign in / create an account without
 * ever leaving the restaurant page (modal instead of redirecting to /auth).
 */
export function StorefrontAuthDialog({ open, onClose, onSuccess, name, logoUrl, primary, tenantId }: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  if (!open) return null;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= 6;

  async function afterAuth() {
    const { error: membershipError } = await (supabase.rpc as any)("ensure_customer_membership", {
      _tenant_id: tenantId,
    });
    if (membershipError) throw membershipError;
    await qc.invalidateQueries({ queryKey: ["me"] });
    await qc.invalidateQueries({ queryKey: ["addresses"] });
    onSuccess?.();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && !fullName.trim()) return setError("أدخل اسمك الكامل.");
    if (!emailValid) return setError("أدخل بريداً إلكترونياً صحيحاً.");
    if (!passwordValid) return setError("كلمة المرور 6 أحرف على الأقل.");
    setLoading(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setLoading(false);
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("rate limit") || msg.includes("too many"))
          return setError("محاولات كثيرة متتالية — انتظر دقيقة ثم جرب مرة أخرى.");
        if (msg.includes("invalid")) return setError("بيانات الدخول غير صحيحة.");
        if (msg.includes("confirm")) return setError("لم يتم تفعيل الحساب بعد. تحقق من بريدك.");
        return setError(error.message);
      }
      try {
        await afterAuth();
      } catch (membershipError: any) {
        setLoading(false);
        return setError(membershipError?.message ?? "تعذر فتح حسابك في هذا المطعم.");
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      setLoading(false);
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("rate limit") || msg.includes("too many"))
          return setError("محاولات كثيرة متتالية — انتظر دقيقة ثم جرب مرة أخرى.");
        if (msg.includes("registered") || msg.includes("exists")) {
          setMode("signin");
          return setError("استخدم كلمة مرور هذا البريد للدخول والانضمام إلى هذا المطعم.");
        }
        return setError(error.message);
      }
      if (data.session) {
        try {
          await afterAuth();
        } catch (membershipError: any) {
          return setError(membershipError?.message ?? "تعذر فتح حسابك في هذا المطعم.");
        }
      } else {
        setConfirmEmail(email.trim());
      }
    }
  }

  const inputCls =
    "w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-current";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {confirmEmail ? (
          <div className="py-4 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full" style={{ background: primary + "18", color: primary }}>
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-xl font-black">تم إنشاء حسابك</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              أرسلنا رابط التفعيل إلى <b dir="ltr">{confirmEmail}</b>.
              <br />
              فعّل حسابك ثم عد هنا لتسجيل الدخول وإكمال طلبك.
            </p>
            <button
              onClick={() => { setConfirmEmail(null); setMode("signin"); }}
              className="mt-5 w-full rounded-xl py-3 text-sm font-bold text-white"
              style={{ background: primary }}
            >
              تسجيل الدخول
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-5 flex items-start justify-between">
              <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-700">
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <h3 className="text-lg font-black leading-tight">
                    {mode === "signin" ? "سجل الدخول للطلب" : "أنشئ حسابك للطلب"}
                  </h3>
                  <p className="mt-0.5 text-xs text-neutral-500">من {name} — مرة واحدة فقط</p>
                </div>
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 bg-white"
                  style={{ borderColor: primary + "35" }}
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-6 w-6" style={{ color: primary }} />
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(null); }}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                    mode === m ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
                  }`}
                >
                  {m === "signin" ? "دخول" : "حساب جديد"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "signup" && (
                <div className="relative">
                  <User className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="الاسم الكامل"
                    autoComplete="name"
                    className={`${inputCls} pr-10`}
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="البريد الإلكتروني"
                  autoComplete="email"
                  dir="ltr"
                  className={`${inputCls} pr-10 text-left`}
                />
              </div>

              <div className="relative">
                <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="كلمة المرور (6 أحرف فأكثر)"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  dir="ltr"
                  className={`${inputCls} px-10 text-left`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                  aria-label={showPassword ? "إخفاء" : "إظهار"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-black text-white shadow-lg transition active:scale-[0.99] disabled:opacity-60"
                style={{ background: primary, boxShadow: `0 10px 24px -8px ${primary}70` }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "دخول وإكمال الطلب" : "إنشاء الحساب وإكمال الطلب"}
              </button>
            </form>

            <p className="mt-4 text-center text-[11px] leading-relaxed text-neutral-400">
              حسابك في {name} مستقل — نقاط الولاء وعناوينك وطلباتك تخص هذا المطعم.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
