import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import logo from "@/assets/tamrad-logo.png";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — تمراد" },
      {
        name: "description",
        content: "سجل دخولك أو أنشئ حساباً جديداً في منصة تمراد لإدارة مطعمك وطلباتك بأمان.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accessDeniedEmail, setAccessDeniedEmail] = useState<string | null>(null);
  const [brand, setBrand] = useState<{
    name: string;
    logo_url: string | null;
    primary: string;
  } | null>(null);

  function getRedirect(): string {
    if (typeof window === "undefined") return "/dashboard";
    const p = new URLSearchParams(window.location.search).get("redirect");
    // Only allow same-origin paths starting with "/"
    if (p && p.startsWith("/") && !p.startsWith("//")) return p;
    return "/dashboard";
  }

  async function hasOwnerAccess(userId: string) {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["owner", "super_admin"]);
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      if (await hasOwnerAccess(data.session.user.id)) {
        navigate({ to: getRedirect(), replace: true });
      } else {
        setAccessDeniedEmail(data.session.user.email ?? "البريد المستخدم");
      }
    });
  }, [navigate]);

  // When arriving from a restaurant storefront (/r/:slug), brand this screen
  // with that restaurant's identity so each tenant's PWA feels like its own app.
  useEffect(() => {
    const redirect = getRedirect();
    const m = redirect.match(/^\/r\/([^/?#]+)/);
    if (!m) return;
    const slug = m[1];
    supabase
      .from("tenants")
      .select("name, logo_url, theme_config")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const theme = (data.theme_config as { primary?: string } | null) ?? {};
        setBrand({ name: data.name, logo_url: data.logo_url, primary: theme.primary ?? "#1f5f3f" });
      });
  }, []);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= 6;

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!emailValid) return setError("أدخل بريداً إلكترونياً صحيحاً.");
    if (!passwordValid) return setError("كلمة المرور 6 أحرف على الأقل.");
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("rate limit") || msg.includes("too many"))
        return setError("محاولات كثيرة متتالية — انتظر دقيقة ثم جرب مرة أخرى.");
      if (msg.includes("invalid")) return setError("بيانات الدخول غير صحيحة.");
      if (msg.includes("not confirmed") || msg.includes("confirm"))
        return setError("لم يتم تفعيل الحساب بعد. تحقق من بريدك.");
      return setError(error.message);
    }
    if (!data.user || !(await hasOwnerAccess(data.user.id))) {
      setAccessDeniedEmail(data.user?.email ?? email.trim());
      return;
    }
    navigate({ to: getRedirect(), replace: true });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) return setError("أدخل اسمك الكامل.");
    if (!emailValid) return setError("أدخل بريداً إلكترونياً صحيحاً.");
    if (!passwordValid) return setError("كلمة المرور 6 أحرف على الأقل.");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: fullName.trim() },
      },
    });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("rate limit") || msg.includes("too many"))
        return setError("محاولات كثيرة متتالية — انتظر دقيقة ثم جرب مرة أخرى.");
      if (msg.includes("registered") || msg.includes("exists"))
        return setError("هذا البريد مسجل بالفعل. سجل الدخول بدلاً من ذلك.");
      return setError(error.message);
    }
    setAccessDeniedEmail(email.trim());
  }

  async function handleGoogle() {
    setError(null);
    try {
      await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
    } catch (e: any) {
      setError(e?.message ?? "تعذر تسجيل الدخول عبر Google.");
    }
  }

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full bg-primary/25 blur-[140px]" />
        <div className="absolute -bottom-40 -left-32 h-[520px] w-[520px] rounded-full bg-accent/25 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_40%,hsl(var(--background))_75%)]" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-sm text-muted-foreground backdrop-blur transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> العودة للرئيسية
        </Link>
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="تمراد" className="h-9 w-9 rounded-lg" />
          <span className="text-lg font-bold tracking-tight">تمراد</span>
        </Link>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        {/* Marketing side */}
        <section className="hidden lg:block">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> منصة تمراد للتوصيل الذاتي
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.15] tracking-tight lg:text-5xl">
            استقلال كامل لمطعمك.
            <br />
            <span className="text-primary">بدون عمولات، بهويتك أنت.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
            سجل دخولك لإدارة منيو مطعمك، متابعة الطلبات لحظياً، وتخصيص تطبيق الزبون بألوانك وهويتك —
            كل هذا من لوحة واحدة أنيقة.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              "لوحة تحكم متكاملة للمطعم والمناديب.",
              "تطبيق زبون بهوية بصرية خاصة بك.",
              "تقارير وإحصائيات لحظية لكل طلب.",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3 text-sm text-foreground/90">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </section>

        {/* Auth card */}
        <section className="relative">
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/95 p-8 shadow-2xl shadow-primary/5 backdrop-blur">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-primary via-accent to-primary" />

            {accessDeniedEmail ? (
              <AccessDenied
                email={accessDeniedEmail}
                onBack={() => {
                  setAccessDeniedEmail(null);
                  setMode("signin");
                  setPassword("");
                }}
              />
            ) : (
              <>
                <div className="mb-6 text-center">
                  {brand?.logo_url ? (
                    <img
                      src={brand.logo_url}
                      alt={brand.name}
                      className="mx-auto h-16 w-16 rounded-2xl border-2 object-cover shadow-lg"
                      style={{ borderColor: brand.primary + "40" }}
                    />
                  ) : (
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                  )}
                  {brand && (
                    <div className="mt-3 text-sm font-bold" style={{ color: brand.primary }}>
                      {brand.name}
                    </div>
                  )}
                  <h2 className="mt-2 text-2xl font-bold tracking-tight">
                    {mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
                  </h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {brand
                      ? mode === "signin"
                        ? "سجل دخولك للطلب من هذا المطعم."
                        : "أنشئ حسابك للطلب من هذا المطعم."
                      : mode === "signin"
                        ? "أدخل بريدك وكلمة المرور للمتابعة."
                        : "أنشئ حسابك للبدء في إدارة مطعمك."}
                  </p>
                </div>

                {/* Tabs */}
                <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
                  {(["signin", "signup"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMode(m);
                        setError(null);
                      }}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                        mode === m
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m === "signin" ? "دخول" : "إنشاء حساب"}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={mode === "signin" ? handleSignIn : handleSignUp}
                  className="space-y-4"
                >
                  {mode === "signup" && (
                    <Field
                      icon={<User className="h-4 w-4" />}
                      label="الاسم الكامل"
                      type="text"
                      value={fullName}
                      onChange={setFullName}
                      placeholder="مثال: أحمد محمد"
                      autoComplete="name"
                    />
                  )}

                  <Field
                    icon={<Mail className="h-4 w-4" />}
                    label="البريد الإلكتروني"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@example.com"
                    autoComplete="email"
                    dir="ltr"
                  />

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      كلمة المرور
                    </label>
                    <div className="group relative flex items-center rounded-xl border border-border bg-background/60 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                      <span className="pr-3 text-muted-foreground">
                        <Lock className="h-4 w-4" />
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete={mode === "signin" ? "current-password" : "new-password"}
                        dir="ltr"
                        className="w-full bg-transparent px-2 py-3 text-sm outline-none placeholder:text-muted-foreground/60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="px-3 text-muted-foreground transition hover:text-foreground"
                        aria-label={showPassword ? "إخفاء" : "إظهار"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {mode === "signup" && (
                      <p className="mt-1.5 text-xs text-muted-foreground">6 أحرف على الأقل.</p>
                    )}
                  </div>

                  {error && <ErrorBox message={error} />}

                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-primary to-accent px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:shadow-primary/40 disabled:opacity-70"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : mode === "signin" ? (
                      "تسجيل الدخول"
                    ) : (
                      "إنشاء الحساب"
                    )}
                  </button>
                </form>

                <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  <span>أو</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogle}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm font-medium transition hover:bg-background"
                >
                  <GoogleIcon />
                  المتابعة عبر Google
                </button>

                <p className="mt-6 text-center text-xs text-muted-foreground">
                  بالمتابعة فأنت توافق على{" "}
                  <a href="#" className="text-foreground underline underline-offset-2">
                    شروط الاستخدام
                  </a>{" "}
                  و{" "}
                  <a href="#" className="text-foreground underline underline-offset-2">
                    سياسة الخصوصية
                  </a>
                  .
                </p>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function AccessDenied({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="py-4 text-center">
      <div className="relative mx-auto grid h-20 w-20 place-items-center">
        <span className="absolute inset-0 rounded-full bg-destructive/10" />
        <span className="relative grid h-20 w-20 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-lg shadow-destructive/25">
          <ShieldCheck className="h-10 w-10" />
        </span>
      </div>
      <h2 className="mt-6 text-2xl font-bold tracking-tight">وصول غير مسموح</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        هذا الحساب لا يملك دور صاحب مطعم، لذلك لا يمكنه الدخول إلى لوحة المطعم.
      </p>
      <div
        className="mx-auto mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-sm font-medium"
        dir="ltr"
      >
        <Mail className="h-4 w-4 text-primary" /> {email}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        إذا كان هذا البريد تابعاً لمطعم، تواصل مع إدارة تمراد ليتم إنشاء حساب المالك وربطه بالمطعم.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-l from-primary to-accent px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:shadow-primary/40"
      >
        العودة إلى تسجيل الدخول
      </button>
    </div>
  );
}

function Field(props: {
  icon: React.ReactNode;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{props.label}</label>
      <div className="group flex items-center rounded-xl border border-border bg-background/60 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <span className="pr-3 text-muted-foreground">{props.icon}</span>
        <input
          type={props.type}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          autoComplete={props.autoComplete}
          dir={props.dir}
          className="w-full bg-transparent px-2 py-3 text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
      {message}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.3-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.9 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 16.4 4.5 9.8 8.8 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5 0 9.5-1.9 12.9-5l-6-4.9c-2 1.5-4.5 2.4-6.9 2.4-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.7 39.2 16.3 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-4 5.3l6 4.9c-.4.4 6.7-4.9 6.7-14.2 0-1.2-.1-2.4-.3-3.5z"
      />
    </svg>
  );
}
