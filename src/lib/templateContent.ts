// Editable per-tenant overrides for restaurant templates.
// Stored in tenants.theme_config.content (jsonb — no migration needed).

export type TemplateContent = {
  top_banner?: string;              // شريط أعلى الصفحة
  hero_badge?: string;              // الجملة الصغيرة فوق العنوان
  hero_title?: string;              // العنوان الرئيسي (يدعم \n)
  hero_highlight?: string;          // كلمة مميّزة داخل العنوان (تظهر بلون الـ accent)
  hero_subtitle?: string;           // الوصف تحت العنوان
  hero_cta?: string;                // نص زر الطلب
  categories_title?: string;        // عنوان قسم "الأصناف"
  menu_title?: string;              // عنوان قسم المنيو
  menu_kicker?: string;             // نص صغير فوق عنوان المنيو
  hero_gradient?: string;           // CSS gradient string (اختياري)
  build_title?: string;             // عنوان قسم "اصنع طبقك" (Fresh)
  build_subtitle?: string;          // شرح قسم "اصنع طبقك" (Fresh)
  subscription_title?: string;      // عنوان بانر الاشتراك (Fresh)
  subscription_subtitle?: string;   // شرح بانر الاشتراك (Fresh)
};

// Defaults per template — تُستخدم عندما لا يُعرَّف حقل من الـ tenant
export const CONTENT_DEFAULTS: Record<string, TemplateContent> = {
  store: {
    top_banner: "توصيل مجاني على الطلبات فوق ٥٠ ألف د.ع",
    hero_badge: "نكهات صنعت بحب، ووصلت طازة",
    hero_cta: "اطلب الآن",
    categories_title: "إيه نفسك فيه النهارده؟",
    menu_title: "اختياراتنا المفضلة",
    menu_kicker: "القائمة",
  },
  fast: {
    top_banner: "⚡ توصيل سريع لأول طلب",
    hero_badge: "👋 أهلاً بيك",
    hero_title: "جوعان؟",
    hero_highlight: "نظبط مزاجك.",
    hero_cta: "شوف المنيو",
    menu_title: "اختار لقمتك 😋",
    menu_kicker: "أشهر اختياراتنا",
  },
  luxe: {
    top_banner: "تجربة طعام راقية · حجوزات يومياً",
    hero_badge: "مطبخنا المميز",
    hero_cta: "اكتشف القائمة",
    menu_title: "أطباق من توقيعنا",
    menu_kicker: "مختارات الشيف",
  },
  bowl: {
    top_banner: "أكل يفيدك، بمكونات موسمية طازة",
    hero_title: "اطلب طبقك",
    hero_highlight: "الصحي",
    hero_cta: "ابدأ طلبك",
  },
  cafe: {
    hero_badge: "ESTABLISHED",
    hero_title: "قهوة",
    hero_highlight: "وحكايات",
    hero_cta: "تصفح المنيو",
  },
  seafood: {
    top_banner: "وصلنا لباب البيت — سخن وطازة",
    hero_badge: "بحر على سفرتك",
    hero_title: "أطيب الأطباق",
    hero_highlight: "الطازجة",
    hero_cta: "اطلب الآن",
  },
  fresh: {
    top_banner: "وجبتك الأولى علينا — استخدم كود FRESH20 وخد خصم ٢٠٪",
    hero_badge: "طازة كل يوم، ليك أنت",
    hero_title: "أكل",
    hero_highlight: "يفيدك",
    hero_subtitle: "وجبات كاملة، مكونات حقيقية، وطعم يخلّي الاختيار الصحي أسهل حاجة في يومك.",
    hero_cta: "اطلب وجبتك",
    menu_kicker: "مفضلات المجتمع",
    menu_title: "جاهزين على طول",
    build_title: "طبقك، قوانينك.",
    build_subtitle: "رز أو خس؟ فراخ أو فلافل؟ صوص حار أو ليمون؟ كل شيء عندنا معمول عشان يناسب يومك أنت.",
    subscription_title: "خلي الصحّي عادة.",
    subscription_subtitle: "اشترك واحصل على وجباتك المفضلة كل أسبوع بخصم دائم.",
  },
};

export function mergeContent(templateId: string, override?: TemplateContent | null): Required<TemplateContent> {
  const base = CONTENT_DEFAULTS[templateId] ?? CONTENT_DEFAULTS.store;
  const merged = { ...base, ...(override ?? {}) };
  return {
    top_banner: merged.top_banner ?? "",
    hero_badge: merged.hero_badge ?? "",
    hero_title: merged.hero_title ?? "",
    hero_highlight: merged.hero_highlight ?? "",
    hero_subtitle: merged.hero_subtitle ?? "",
    hero_cta: merged.hero_cta ?? "اطلب الآن",
    categories_title: merged.categories_title ?? "الأصناف",
    menu_title: merged.menu_title ?? "القائمة",
    menu_kicker: merged.menu_kicker ?? "",
    hero_gradient: merged.hero_gradient ?? "",
    build_title: merged.build_title ?? "",
    build_subtitle: merged.build_subtitle ?? "",
    subscription_title: merged.subscription_title ?? "",
    subscription_subtitle: merged.subscription_subtitle ?? "",
  };
}

// الحقول اللي كل قالب فعلاً بيستخدمها — يقود المحرر لإظهار ذات الصلة فقط
export const TEMPLATE_FIELDS: Record<string, (keyof TemplateContent)[]> = {
  store:   ["top_banner", "hero_badge", "hero_subtitle", "hero_cta", "categories_title", "menu_title", "menu_kicker"],
  fast:    ["top_banner", "hero_badge", "hero_title", "hero_highlight", "hero_subtitle", "hero_cta", "menu_title", "menu_kicker"],
  luxe:    ["top_banner", "hero_badge", "hero_subtitle", "hero_cta", "menu_title", "menu_kicker"],
  bowl:    ["top_banner", "hero_title", "hero_highlight", "hero_subtitle", "hero_cta"],
  cafe:    ["hero_badge", "hero_title", "hero_highlight", "hero_subtitle", "hero_cta"],
  seafood: ["top_banner", "hero_badge", "hero_title", "hero_highlight", "hero_subtitle", "hero_cta"],
  fresh:   ["top_banner", "hero_badge", "hero_title", "hero_highlight", "hero_subtitle", "hero_cta", "menu_kicker", "menu_title", "build_title", "build_subtitle", "subscription_title", "subscription_subtitle"],
};

export const FIELD_LABELS: Record<keyof TemplateContent, string> = {
  top_banner: "شريط علوي (إعلان)",
  hero_badge: "جملة صغيرة فوق العنوان",
  hero_title: "العنوان الرئيسي",
  hero_highlight: "كلمة مميّزة (بلون مختلف)",
  hero_subtitle: "الوصف تحت العنوان",
  hero_cta: "نص زر الطلب",
  categories_title: "عنوان قسم الأصناف",
  menu_title: "عنوان قسم المنيو",
  menu_kicker: "نص صغير فوق عنوان المنيو",
  hero_gradient: "خلفية تدرج CSS",
  build_title: "عنوان قسم اصنع طبقك",
  build_subtitle: "شرح قسم اصنع طبقك",
  subscription_title: "عنوان بانر الاشتراك",
  subscription_subtitle: "شرح بانر الاشتراك",
};
