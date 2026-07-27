import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getTenantIdentifierFromHost } from "@/lib/domain";
import { supabase } from "@/integrations/supabase/client";
import { RestaurantPage } from "./r.$slug";
import logo from "@/assets/tamrad-logo.png";
import {
  ArrowLeft,
  Store,
  Bike,
  Smartphone,
  ShieldCheck,
  Wallet,
  Gift,
  BarChart3,
  MapPin,
  Bell,
  TrendingUp,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const [subdomainSlug, setSubdomainSlug] = useState<string | null>(null);
  const [checkedDomain, setCheckedDomain] = useState(false);

  useEffect(() => {
    const match = getTenantIdentifierFromHost();
    if (match.type !== "main" && match.identifier) {
      setSubdomainSlug(match.identifier);
    }
    setCheckedDomain(true);
  }, []);

  if (!checkedDomain) {
    return null;
  }

  if (subdomainSlug) {
    return <RestaurantPage slugProp={subdomainSlug} />;
  }

  return <LandingPage />;
}

function LandingPage() {
  const [restaurantCount, setRestaurantCount] = useState(120);

  useEffect(() => {
    let active = true;
    (supabase.from("platform_settings") as any)
      .select("restaurant_count")
      .eq("singleton", true)
      .maybeSingle()
      .then(({ data }: { data: { restaurant_count?: number } | null }) => {
        if (active && Number.isInteger(data?.restaurant_count)) setRestaurantCount(data.restaurant_count!);
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Nav />
      <Hero />
      <TrustBar restaurantCount={restaurantCount} />
      <Features />
      <HowItWorks />
      <Platforms />
      <WhyTamrad />
      <CTA restaurantCount={restaurantCount} />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <a href="#" className="flex items-center gap-2">
          <img src={logo} alt="تمراد" className="h-10 w-10" />
          <span className="text-2xl font-black tracking-tight">تمراد</span>
        </a>

        <nav className="hidden items-center gap-10 text-sm font-medium text-foreground/80 md:flex">
          <a href="#why" className="transition-colors hover:text-primary">لماذا تمراد؟</a>
          <a href="#how" className="transition-colors hover:text-primary">كيف تعمل؟</a>
          <a href="#features" className="transition-colors hover:text-primary">المميزات</a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/auth"
            className="hidden rounded-lg border border-primary/30 bg-background px-4 py-2 text-sm font-bold text-primary transition-all hover:bg-primary/5 sm:inline-flex"
          >
            تسجيل الدخول
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition-all hover:bg-primary/90 hover:shadow-[var(--shadow-elegant)]"
          >
            ابدأ الآن
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div
        className="absolute -left-32 top-40 -z-10 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{ background: "var(--gradient-lime)" }}
      />

      <div className="mx-auto grid max-w-7xl gap-16 px-6 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
        {/* Text */}
        <div className="order-2 lg:order-1">
          <div className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-primary">
            <span className="h-2 w-2 rounded-full bg-primary" />
            منصة التوصيل المستقلة للمطاعم
          </div>

          <h1 className="text-5xl font-black leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
            مطعمك يستحق
            <br />
            <span className="text-primary">منصة تحمل</span>
            <br />
            اسمه.
          </h1>

          <p className="mt-8 max-w-lg text-lg leading-relaxed text-muted-foreground">
            امتلك تجربة الطلب والتوصيل بالكامل. تطبيق خاص بك، بياناتك لك،
            ولا عمولات على كل طلب.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-6">
            <a
              href="#start"
              className="group inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-4 text-base font-bold text-primary-foreground shadow-[var(--shadow-elegant)] transition-all hover:bg-primary/90 hover:-translate-y-0.5"
            >
              ابدأ بناء مطعمك
              <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
            </a>
            <a
              href="#demo"
              className="border-b-2 border-primary pb-1 text-base font-bold text-primary transition-opacity hover:opacity-70"
            >
              شاهد تجربة الزبون
            </a>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="relative order-2 mx-auto hidden w-full max-w-md px-4 sm:px-8 lg:order-2 lg:mx-0 lg:block lg:max-w-none lg:px-0">
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}

function DashboardMockup() {
  return (
    <div className="relative">
      {/* Decorative circle — hidden on mobile to avoid overflow */}
      <div className="pointer-events-none absolute -right-8 top-1/2 hidden h-[420px] w-[420px] -translate-y-1/2 rounded-full border border-primary/10 lg:block" />

      {/* Floating badge — distance (below header on mobile so it doesn't overlap) */}
      <div className="absolute -left-1 top-24 z-20 flex items-center gap-2 rounded-2xl bg-card px-2.5 py-1.5 shadow-[var(--shadow-elegant)] sm:-left-4 sm:top-16 sm:px-4 sm:py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lime/30 sm:h-8 sm:w-8">
          <MapPin className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
        </div>
        <div className="text-right">
          <div className="text-xs font-black leading-tight sm:text-sm">3.2 كم</div>
          <div className="text-[9px] text-muted-foreground sm:text-[10px]">المندوب في الطريق</div>
        </div>
      </div>


      {/* Main dashboard card */}
      <div className="relative z-10 rounded-3xl border border-border/60 bg-card p-4 shadow-[var(--shadow-elegant)] sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-2 sm:mb-6">
          <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-primary sm:text-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            مباشر
          </div>
          <div className="flex min-w-0 items-center gap-2 text-xs font-bold sm:text-sm">
            <span className="truncate">لوحة مطعمك</span>
            <img src={logo} alt="" className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" />
          </div>
        </div>

        <div className="mb-5 text-right sm:mb-6">
          <h3 className="text-lg font-black sm:text-xl">صباح الخير، برغر تاون 👋</h3>
          <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
            هذه نظرة سريعة على أداء مطعمك اليوم
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 sm:mb-6 sm:gap-3">
          <StatCard label="الطلبات" value="32" trend="8.2%" />
          <StatCard label="مبيعات اليوم" value="486,500 د.ع" trend="12.4%" />
        </div>


        <div className="mb-3 text-right text-xs font-bold text-muted-foreground">
          المبيعات خلال الأسبوع
        </div>
        <div className="flex h-32 items-end justify-between gap-2">
          {[65, 88, 52, 74, 46, 82, 38].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-lg transition-all"
              style={{
                height: `${h}%`,
                background:
                  i % 2 === 0 ? "var(--color-primary)" : "var(--color-lime)",
              }}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-border/60 pt-4 sm:mt-6">
          <span className="shrink-0 rounded-full bg-lime px-3 py-1 text-[11px] font-bold text-lime-foreground sm:text-xs">
            قبول
          </span>
          <div className="min-w-0 text-right">
            <div className="truncate text-[11px] font-bold sm:text-xs">طلب جديد #TM-2048</div>
            <div className="truncate text-[9px] text-muted-foreground sm:text-[10px]">
              برغر تاون كلاسيك · 48,000 د.ع
            </div>
          </div>
        </div>
      </div>

      {/* Floating badge — 0% commission */}
      <div className="absolute -bottom-4 left-2 z-20 flex items-center gap-2 rounded-2xl bg-card px-3 py-2 shadow-[var(--shadow-elegant)] sm:-bottom-6 sm:left-8 sm:px-4 sm:py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-4 w-4 text-primary" />
        </div>
        <div className="text-right">
          <div className="text-sm font-black leading-tight text-primary">0% عمولة</div>
          <div className="text-[10px] text-muted-foreground">كل طلب لك</div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, trend }: { label: string; value: string; trend: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-muted/60 p-3 text-right sm:p-4">
      <div className="truncate text-[10px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-base font-black sm:text-xl">{value}</div>
      <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-primary">
        <TrendingUp className="h-3 w-3" />
        {trend}
      </div>
    </div>
  );
}

function TrustBar({ restaurantCount }: { restaurantCount: number }) {
  return (
    <section className="border-y border-border/40 bg-card/40">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-6 py-6">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2 -space-x-reverse">
            {["#F4B942", "#E56B4E", "#6BA368", "#D4E157"].map((c, i) => (
              <div
                key={i}
                className="h-9 w-9 rounded-full border-2 border-background"
                style={{ background: c }}
              />
            ))}
          </div>
          <div>
            <div className="text-lg font-black">+{restaurantCount.toLocaleString("en-US")} مطعماً</div>
            <div className="text-xs text-muted-foreground">
              يستقلون عن المنصات الكبرى
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-10 gap-y-2 text-sm font-bold text-muted-foreground">
          <span>· بدون عمولات</span>
          <span>· تطبيق باسم مطعمك</span>
          <span>· بياناتك ملكك</span>
          <span>· دعم عربي</span>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: Store,
      title: "هويتك البصرية الكاملة",
      body: "شعارك، ألوانك، اسم مطعمك — كل شيء على تطبيقك الخاص وعلى نطاق باسمك.",
    },
    {
      icon: Wallet,
      title: "محفظة ونظام ولاء",
      body: "احتفظ بزبائنك: نقاط ولاء، خصومات، وأكواد ترويجية تدير بنفسك.",
    },
    {
      icon: Bike,
      title: "إدارة المناديب",
      body: "حدد المناطق، احسب الذمم، وتابع كل طلب لحظياً على الخريطة.",
    },
    {
      icon: BarChart3,
      title: "تقارير احترافية",
      body: "إحصائيات دقيقة عن المبيعات، المناطق، والزبائن — قرارات مبنية على بيانات.",
    },
    {
      icon: Bell,
      title: "إشعارات فورية",
      body: "تنبيه صوتي لكل طلب جديد + إشعارات دفع للزبون في كل مرحلة.",
    },
    {
      icon: ShieldCheck,
      title: "خصوصية وأمان",
      body: "بيانات الزبون تُخفى تلقائياً بعد 12 ساعة من المندوب. حماية ذكية بالتصميم.",
    },
  ];

  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-24">
      <div className="mb-16 max-w-2xl text-right">
        <div className="mb-4 text-sm font-bold text-primary">المميزات</div>
        <h2 className="text-4xl font-black leading-tight sm:text-5xl">
          كل ما يحتاجه مطعمك
          <br />
          <span className="text-primary">في منصة واحدة.</span>
        </h2>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="group rounded-3xl border border-border/60 bg-card p-8 text-right transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-[var(--shadow-elegant)]"
          >
            <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-lime/30 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-xl font-black">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "سجّل مطعمك",
      body: "أنشئ حساب مطعمك وارفع شعارك واختر ألوانك — نظامك جاهز خلال دقائق.",
    },
    {
      num: "02",
      title: "أطلق تطبيقك",
      body: "نطاق باسم مطعمك (name.mrt.llc) أو نطاقك الخاص. جاهز للزبائن مباشرة.",
    },
    {
      num: "03",
      title: "استقبل الطلبات",
      body: "الزبون يطلب، النظام يرسل لمندوبك، ويصلك المبلغ بالكامل بدون أي عمولة.",
    },
  ];

  return (
    <section id="how" className="bg-card/40 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 max-w-2xl text-right">
          <div className="mb-4 text-sm font-bold text-primary">كيف تعمل؟</div>
          <h2 className="text-4xl font-black leading-tight sm:text-5xl">
            ثلاث خطوات فقط
            <br />
            <span className="text-primary">لتصبح مستقلاً.</span>
          </h2>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.num} className="relative">
              <div className="rounded-3xl border border-border/60 bg-background p-8 text-right">
                <div className="mb-6 text-6xl font-black text-primary/10">{s.num}</div>
                <h3 className="mb-3 text-2xl font-black">{s.title}</h3>
                <p className="leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="pointer-events-none absolute -left-4 top-1/2 hidden -translate-y-1/2 text-primary/30 md:block">
                  <ArrowLeft className="h-8 w-8" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Platforms() {
  const platforms = [
    {
      icon: Store,
      color: "primary",
      title: "لوحة المطعم",
      body: "استقبل الطلبات، أدر المنيو، وتحكم بمناديبك من مكان واحد.",
    },
    {
      icon: Smartphone,
      color: "lime",
      title: "تطبيق الزبون",
      body: "PWA سريع باسم مطعمك — يعمل كتطبيق حقيقي على شاشة الزبون.",
    },
    {
      icon: Bike,
      color: "primary",
      title: "بوابة المندوب",
      body: "استلام فوري، تتبع مباشر، وتسوية ذمم شفافة — يعمل حتى دون إنترنت.",
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="mb-16 text-right">
        <div className="mb-4 text-sm font-bold text-primary">المنظومة</div>
        <h2 className="text-4xl font-black leading-tight sm:text-5xl">
          ثلاث منصات <span className="text-primary">متكاملة</span>
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {platforms.map(({ icon: Icon, color, title, body }) => (
          <div
            key={title}
            className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-8 text-right"
          >
            <div
              className="absolute -left-16 -top-16 h-40 w-40 rounded-full opacity-20"
              style={{
                background:
                  color === "lime" ? "var(--gradient-lime)" : "var(--gradient-primary)",
              }}
            />
            <div
              className="relative mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                background:
                  color === "lime" ? "var(--color-lime)" : "var(--color-primary)",
                color:
                  color === "lime"
                    ? "var(--color-lime-foreground)"
                    : "var(--color-primary-foreground)",
              }}
            >
              <Icon className="h-7 w-7" />
            </div>
            <h3 className="mb-3 text-2xl font-black">{title}</h3>
            <p className="leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhyTamrad() {
  const points = [
    "لا عمولات — كل دينار يذهب لمطعمك",
    "بياناتك ملكك، لا تُشارك مع منافسين",
    "هوية بصرية كاملة باسم مطعمك",
    "نظام ولاء ومحفظة يعيدون الزبون",
    "دعم فني عربي على مدار الساعة",
    "تعمل بكفاءة حتى مع ضعف الإنترنت",
  ];

  return (
    <section id="why" className="mx-auto max-w-7xl px-6 py-24">
      <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
        <div className="text-right">
          <div className="mb-4 text-sm font-bold text-primary">لماذا تمراد؟</div>
          <h2 className="text-4xl font-black leading-tight sm:text-5xl">
            استقلاليتك
            <br />
            <span className="text-primary">لا تُقدَّر بثمن.</span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            المنصات الكبرى تأخذ حتى 30% من كل طلب، وتحتفظ بزبائنك.
            تمراد يقلب المعادلة: أنت المالك، الزبون زبونك، والربح كامل لك.
          </p>
        </div>

        <div className="grid gap-3">
          {points.map((p) => (
            <div
              key={p}
              className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 text-right"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-lime">
                <Check className="h-5 w-5 text-lime-foreground" strokeWidth={3} />
              </div>
              <span className="flex-1 font-bold">{p}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA({ restaurantCount }: { restaurantCount: number }) {
  return (
    <section id="start" className="mx-auto max-w-7xl px-6 pb-24">
      <div
        className="relative overflow-hidden rounded-[2rem] p-12 text-right sm:p-16 lg:p-20"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div
          className="absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--color-lime)" }}
        />
        <div className="relative max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-lime/20 px-4 py-1.5 text-xs font-bold text-lime">
            <Gift className="h-3.5 w-3.5" />
            إعداد مجاني للمطاعم الجديدة
          </div>
          <h2 className="text-4xl font-black leading-tight text-primary-foreground sm:text-5xl lg:text-6xl">
            جاهز تمتلك
            <br />
            منصتك؟
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-primary-foreground/80">
            انضم لأكثر من {restaurantCount.toLocaleString("en-US")} مطعماً استعادوا استقلاليتهم مع تمراد.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#register"
              className="inline-flex items-center gap-2 rounded-xl bg-lime px-7 py-4 text-base font-bold text-lime-foreground shadow-[var(--shadow-glow)] transition-all hover:-translate-y-0.5"
            >
              ابدأ الآن — مجاناً
              <ArrowLeft className="h-5 w-5" />
            </a>
            <a
              href="#contact"
              className="inline-flex items-center rounded-xl border-2 border-primary-foreground/20 px-7 py-4 text-base font-bold text-primary-foreground transition-all hover:bg-primary-foreground/10"
            >
              تحدث مع فريق المبيعات
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/40">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-10 md:flex-row">
        <div className="flex items-center gap-2">
          <img src={logo} alt="تمراد" className="h-8 w-8" />
          <span className="text-lg font-black">تمراد</span>
        </div>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} تمراد. جميع الحقوق محفوظة.
        </p>
        <div className="flex gap-6 text-sm font-medium text-muted-foreground">
          <a href="#" className="hover:text-primary">الخصوصية</a>
          <a href="#" className="hover:text-primary">الشروط</a>
          <a href="#" className="hover:text-primary">اتصل بنا</a>
        </div>
      </div>
    </footer>
  );
}
