import { Minus, Phone, Plus, MapPin, Search, Star, Clock, ChefHat, Heart, Flame } from "lucide-react";
import { useState, useMemo } from "react";
import { formatIQD } from "@/lib/useMe";
import { mergeContent, type TemplateContent } from "@/lib/templateContent";

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_iqd: number;
  category_id: string | null;
  is_featured?: boolean | null;
};
export type Category = { id: string; name: string; sort_order?: number | null };
export type Tenant = {
  id: string; name: string; description: string | null;
  logo_url: string | null; phone: string | null; address: string | null;
};
export type Cart = Record<string, { name: string; price: number; qty: number }>;

export interface TemplateProps {
  tenant: Tenant;
  categories: Category[];
  items: MenuItem[];
  cart: Cart;
  primary: string;
  accent: string;
  coverUrl?: string | null;
  content?: TemplateContent | null;
  addItem: (id: string, name: string, price: number) => void;
  removeItem: (id: string) => void;
}

/* =========================================================
   Shared bits
   ========================================================= */

function Qty({
  q, primary, accent, onAdd, onRemove, size = "md",
}: { q: number; primary: string; accent: string; onAdd: () => void; onRemove: () => void; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const ic = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  if (q === 0) {
    return (
      <button
        onClick={onAdd}
        className={`flex ${dim} items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-110 active:scale-95`}
        style={{ background: primary }}
        aria-label="أضف"
      >
        <Plus className={ic} />
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1 rounded-full p-1 shadow-md" style={{ background: primary }}>
      <button onClick={onAdd} className="flex h-7 w-7 items-center justify-center rounded-full text-white hover:bg-white/10">
        <Plus className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[1.5rem] text-center text-sm font-black" style={{ color: accent }}>{q}</span>
      <button onClick={onRemove} className="flex h-7 w-7 items-center justify-center rounded-full text-white hover:bg-white/10">
        <Minus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function initials(s: string) { return s.trim().charAt(0) || "م"; }

function ItemImagePlaceholder({ accent, emoji = "🍽️" }: { accent: string; emoji?: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center text-4xl" style={{ background: `${accent}44` }}>
      {emoji}
    </div>
  );
}

/* =========================================================
   1) STORE — "زَعتر وزيت" (warm cream + orange, editorial storefront)
   ========================================================= */

function StoreTemplate({ tenant, categories, items, cart, primary, accent, coverUrl, content, addItem, removeItem }: TemplateProps) {
  const [active, setActive] = useState<string>("all");
  const c = mergeContent("store", content);
  const list = useMemo(
    () => active === "all" ? items : items.filter(i => i.category_id === active),
    [items, active],
  );
  const heroBg = c.hero_gradient
    ? c.hero_gradient
    : coverUrl
      ? `linear-gradient(90deg,rgba(20,36,27,.94) 4%,rgba(20,36,27,.55) 60%),url(${coverUrl}) center/cover`
      : `linear-gradient(135deg, ${primary}, #17231d)`;

  return (
    <div className="min-h-screen pb-32" style={{ background: "#fbf8f1", color: "#17231d", fontFamily: "Tahoma,Arial,sans-serif" }}>
      {c.top_banner && (
        <div className="bg-[#17231d] px-4 py-2 text-center text-[12px] text-white sm:text-[13px]">{c.top_banner}</div>
      )}

      <header className="mx-auto flex h-[70px] max-w-[1180px] items-center justify-between gap-3 px-4 sm:h-[88px] sm:gap-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover sm:h-10 sm:w-10" />
          ) : (
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg text-white sm:h-10 sm:w-10" style={{ background: primary }}>✦</div>
          )}
          <span className="truncate text-lg font-extrabold tracking-tight sm:text-2xl">{tenant.name}</span>
        </div>
        {tenant.address && <span className="hidden text-[13px] text-neutral-600 md:inline">⌖ {tenant.address}</span>}
      </header>

      <section className="mx-auto max-w-[1180px] px-3 sm:px-6">
        <div
          className="relative isolate min-h-[320px] overflow-hidden rounded-3xl px-6 py-10 text-white sm:min-h-[430px] sm:rounded-[28px] sm:px-8 sm:py-16 md:px-16"
          style={{ background: heroBg }}
        >
          <div className="max-w-[520px]">
            {c.hero_badge && <span className="text-[13px] font-bold" style={{ color: accent }}>{c.hero_badge}</span>}
            <h1 className="mt-3 text-3xl font-black leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              {c.hero_title || tenant.name}
            </h1>
            {(c.hero_subtitle || tenant.description) && (
              <p className="mt-3 text-sm leading-loose text-white/85 sm:mt-4 sm:text-base">{c.hero_subtitle || tenant.description}</p>
            )}
            <a href="#menu" className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold sm:mt-6 sm:px-6 sm:py-3.5" style={{ background: accent, color: "#17231d" }}>
              {c.hero_cta} ←
            </a>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 sm:py-16">
          <div className="mb-5 sm:mb-7">
            <span className="text-[13px] font-bold" style={{ color: primary }}>تصفح كما تحب</span>
            <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{c.categories_title}</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {categories.slice(0, 8).map(cat => {
              const first = items.find(i => i.category_id === cat.id);
              const count = items.filter(i => i.category_id === cat.id).length;
              return (
                <button key={cat.id} onClick={() => setActive(cat.id)}
                  className="relative flex h-[140px] items-end overflow-hidden rounded-[20px] p-4 text-white transition-transform hover:-translate-y-1 sm:h-[185px] sm:p-5">
                  {first?.image_url ? (
                    <img src={first.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0" style={{ background: primary }} />
                  )}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(0deg,rgba(9,19,13,.8),transparent 70%)" }} />
                  <div className="relative">
                    <div className="text-base font-bold sm:text-xl">{cat.name}</div>
                    <small className="mt-1 block text-[13px] opacity-85 sm:text-xs">{count} صنف</small>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section id="menu" className="py-12 sm:py-20" style={{ background: `${accent}22` }}>
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
          <div className="mb-5 sm:mb-6">
            {c.menu_kicker && <span className="text-[13px] font-bold" style={{ color: primary }}>{c.menu_kicker}</span>}
            <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{c.menu_title}</h2>
          </div>
          <div className="mb-5 flex flex-wrap gap-2 sm:mb-7">
            <FilterChip active={active === "all"} onClick={() => setActive("all")} primary={primary}>الكل</FilterChip>
            {categories.map(cc => (
              <FilterChip key={cc.id} active={active === cc.id} onClick={() => setActive(cc.id)} primary={primary}>{cc.name}</FilterChip>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {list.map(it => {
              const q = cart[it.id]?.qty ?? 0;
              return (
                <article key={it.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  <div className="relative h-32 overflow-hidden bg-neutral-100 sm:h-44">
                    {it.image_url ? <img src={it.image_url} alt={it.name} className="h-full w-full object-cover transition-transform hover:scale-105" /> : <ItemImagePlaceholder accent={accent} />}
                    {it.is_featured && <span className="absolute right-2 top-2 rounded-md bg-white px-2 py-0.5 text-[12px] font-bold sm:right-3 sm:top-3 sm:text-[13px]" style={{ color: primary }}>الأكثر طلباً</span>}
                  </div>
                  <div className="p-3 sm:p-4">
                    <h3 className="text-sm font-bold sm:text-[15px]">{it.name}</h3>
                    {it.description && <p className="mt-1 line-clamp-1 text-[13px] text-neutral-500 sm:text-xs">{it.description}</p>}
                    <div className="mt-2 flex items-center justify-between sm:mt-3">
                      <span className="text-sm font-black sm:text-base">{formatIQD(it.price_iqd)}</span>
                      <Qty q={q} primary={primary} accent={accent} size="sm"
                           onAdd={() => addItem(it.id, it.name, it.price_iqd)}
                           onRemove={() => removeItem(it.id)} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {!list.length && <p className="py-12 text-center text-neutral-500">لا توجد أصناف.</p>}
        </div>
      </section>
    </div>
  );
}

function FilterChip({ active, onClick, primary, children }: { active: boolean; onClick: () => void; primary: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-colors"
      style={active
        ? { background: "#17231d", color: "#fff", borderColor: "#17231d" }
        : { background: "rgba(255,255,255,.7)", color: primary, borderColor: "rgba(0,0,0,.08)" }}
    >{children}</button>
  );
}

/* =========================================================
   2) FAST — "لُقمة" (playful blue + yellow, big rounded hero)
   ========================================================= */

function FastTemplate({ tenant, categories, items, cart, primary, accent, coverUrl, content, addItem, removeItem }: TemplateProps) {
  const [active, setActive] = useState<string>("all");
  const c = mergeContent("fast", content);
  const list = useMemo(
    () => active === "all" ? items : items.filter(i => i.category_id === active),
    [items, active],
  );
  const heroBg = c.hero_gradient
    ? c.hero_gradient
    : coverUrl
      ? `linear-gradient(90deg,${primary} 30%,${primary}cc),url(${coverUrl}) right center/cover`
      : primary;

  return (
    <div className="min-h-screen pb-32" style={{ background: "#fffef9", color: "#111323", fontFamily: "Alexandria,Arial,sans-serif" }}>
      {c.top_banner && (
        <div className="px-3 py-2 text-center text-[13px] font-bold sm:text-xs" style={{ background: accent, color: "#111323" }}>{c.top_banner}</div>
      )}
      <nav className="mx-auto flex h-[70px] max-w-[1220px] items-center justify-between gap-3 px-4 sm:h-[86px] sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {tenant.logo_url && <img src={tenant.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover sm:h-10 sm:w-10" />}
          <span className="truncate text-lg font-extrabold tracking-tight sm:text-2xl" style={{ color: primary }}>{tenant.name}</span>
        </div>
        <a href="#menu" className="shrink-0 rounded-full px-3 py-2 text-[13px] font-bold text-white sm:px-5 sm:py-3 sm:text-xs" style={{ background: primary }}>اطلب دلوقتي 🛵</a>
      </nav>

      <section className="mx-auto max-w-[1220px] px-3 sm:px-6">
        <div
          className="relative isolate flex min-h-[380px] items-center overflow-hidden rounded-3xl px-6 py-10 text-white sm:min-h-[500px] sm:rounded-[30px] sm:px-8 sm:py-12 md:px-16"
          style={{ background: heroBg }}
        >
          <div className="absolute -bottom-72 -left-40 hidden h-[500px] w-[500px] rounded-full opacity-90 sm:block"
               style={{ border: `70px solid ${accent}` }} />
          <div className="relative max-w-[560px]">
            {c.hero_badge && <span className="text-sm sm:text-base">{c.hero_badge} {tenant.name}</span>}
            <h1 className="mt-2 text-3xl font-extrabold leading-[1.1] tracking-tighter sm:mt-3 sm:text-5xl md:text-6xl">
              {c.hero_title}<br/>
              {c.hero_highlight && <em className="not-italic" style={{ color: accent }}>{c.hero_highlight}</em>}
            </h1>
            {(c.hero_subtitle || tenant.description) && (
              <p className="mt-3 max-w-md text-xs leading-loose text-white/90 sm:mt-4 sm:text-sm">{c.hero_subtitle || tenant.description}</p>
            )}
            <div className="mt-5 flex flex-wrap gap-2 sm:mt-6">
              <a href="#menu" className="rounded-full bg-white px-4 py-2.5 text-[13px] font-bold text-neutral-900 sm:px-5 sm:py-3 sm:text-xs">{c.hero_cta} ↓</a>
              {tenant.phone && <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-2.5 text-[13px] font-bold sm:px-4 sm:py-3 sm:text-xs" style={{ background: accent, color: "#111323" }}><Phone className="h-3 w-3" /><span dir="ltr">{tenant.phone}</span></span>}
            </div>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-[1220px] px-4 pt-10 sm:px-6 sm:pt-14">
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-5">
            {categories.slice(0, 10).map(cat => {
              const isAct = active === cat.id;
              return (
                <button key={cat.id} onClick={() => setActive(cat.id)}
                  className="rounded-2xl border-2 p-3 text-center text-xs font-bold transition-all hover:-rotate-2 sm:p-4 sm:text-sm"
                  style={isAct ? { background: accent, borderColor: "#111323" } : { borderColor: "#111323" }}>
                  <span className="mb-1 block text-2xl sm:mb-2 sm:text-3xl">🍽️</span>
                  {cat.name}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section id="menu" className="mt-10 py-10 sm:mt-16 sm:py-16" style={{ background: "#f1f3ff" }}>
        <div className="mx-auto max-w-[1220px] px-4 sm:px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-7">
            <div>
              {c.menu_kicker && <span className="text-[13px] font-extrabold sm:text-xs" style={{ color: accent === "#f8d943" ? "#ff5c78" : accent }}>{c.menu_kicker}</span>}
              <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{c.menu_title}</h2>
            </div>
            <button onClick={() => setActive("all")} className="rounded-full px-3 py-2 text-[13px] font-bold text-white sm:px-4 sm:py-2.5 sm:text-xs" style={{ background: primary }}>المنيو كامل ←</button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {list.map(it => {
              const q = cart[it.id]?.qty ?? 0;
              return (
                <article key={it.id} className="relative rounded-2xl bg-white p-2.5 sm:p-3">
                  <div className="relative overflow-hidden rounded-xl">
                    {it.image_url ? <img src={it.image_url} alt={it.name} className="h-32 w-full object-cover sm:h-44" /> : <div className="h-32 sm:h-44"><ItemImagePlaceholder accent={accent} /></div>}
                  </div>
                  <h3 className="mt-2 px-1 text-xs font-bold sm:mt-3 sm:text-sm">{it.name}</h3>
                  {it.description && <p className="mt-1 line-clamp-1 px-1 text-[12px] text-neutral-500 sm:text-[13px]">{it.description}</p>}
                  <div className="mt-2 flex items-center justify-between px-1 sm:mt-3">
                    <span className="text-sm font-extrabold sm:text-base">{formatIQD(it.price_iqd)}</span>
                    <Qty q={q} primary={primary} accent={accent} size="sm"
                         onAdd={() => addItem(it.id, it.name, it.price_iqd)}
                         onRemove={() => removeItem(it.id)} />
                  </div>
                </article>
              );
            })}
          </div>
          {!list.length && <p className="py-12 text-center text-neutral-500">لا توجد أصناف.</p>}
        </div>
      </section>
    </div>
  );
}

/* =========================================================
   3) LUXE — "سُفرة" (dark night, gold, editorial fine-dining)
   ========================================================= */

function LuxeTemplate({ tenant, categories, items, cart, primary, accent, coverUrl, content, addItem, removeItem }: TemplateProps) {
  const [active, setActive] = useState<string>(categories[0]?.id ?? "");
  const c = mergeContent("luxe", content);
  const list = items.filter(i => i.category_id === active);
  const heroBg = c.hero_gradient
    ? c.hero_gradient
    : `linear-gradient(#10110faa,#10110faa), url(${coverUrl || "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1800&q=90"}) center/cover`;

  return (
    <div className="min-h-screen pb-32" style={{ background: "#10110f", color: "#f2eee6", fontFamily: "Alexandria,Arial,sans-serif" }}>
      {c.top_banner && (
        <div className="border-b border-neutral-800 px-3 py-2.5 text-center text-[12px] tracking-widest text-neutral-400 sm:text-[13px]">{c.top_banner}</div>
      )}
      <header className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between gap-3 px-4 sm:h-[92px] sm:px-8">
        <div className="flex min-w-0 items-baseline gap-2" style={{ fontFamily: "serif" }}>
          {tenant.logo_url && <img src={tenant.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />}
          <span className="truncate text-xl sm:text-3xl" style={{ color: accent }}>{tenant.name}</span>
        </div>
        {tenant.phone && <span className="hidden text-xs text-neutral-400 sm:inline" dir="ltr">{tenant.phone}</span>}
      </header>

      <section className="relative flex min-h-[440px] items-center justify-center overflow-hidden px-4 py-16 text-center sm:h-[610px] sm:py-0">
        <div className="absolute inset-0 -z-10" style={{ background: heroBg }} />
        <div className="px-2 sm:px-6">
          <span className="tracking-[8px]" style={{ color: accent }}>✦ ✦ ✦</span>
          {c.hero_badge && <div className="mt-3 text-[12px] tracking-[3px] sm:text-[13px]" style={{ color: "#dfbb7f" }}>{c.hero_badge}</div>}
          <h1 className="mt-4 text-3xl font-medium leading-tight sm:mt-5 sm:text-5xl md:text-7xl" style={{ fontFamily: "serif" }}>
            {c.hero_title || tenant.name}
          </h1>
          {(c.hero_subtitle || tenant.description) && (
            <p className="mx-auto mt-4 max-w-lg text-xs leading-loose text-neutral-300 sm:mt-5 sm:text-sm">{c.hero_subtitle || tenant.description}</p>
          )}
          <a href="#menu" className="mt-5 inline-block px-6 py-3 text-[13px] font-bold sm:mt-6 sm:px-8 sm:py-4 sm:text-xs" style={{ background: accent, color: "#161510" }}>
            {c.hero_cta}
          </a>
        </div>
      </section>

      <section id="menu" className="py-14 sm:py-24" style={{ background: "#1a1c19" }}>
        <div className="mx-auto max-w-[1200px] px-4 text-center sm:px-8">
          {c.menu_kicker && <div className="text-[12px] tracking-[3px] sm:text-[13px]" style={{ color: "#dfbb7f" }}>{c.menu_kicker}</div>}
          <h2 className="mt-2 text-2xl font-medium sm:mt-3 sm:text-4xl" style={{ fontFamily: "serif" }}>{c.menu_title}</h2>
          <div className="mt-3 tracking-[8px]" style={{ color: accent }}>✦</div>

          <div className="mt-6 flex flex-wrap justify-center gap-2 sm:mt-8">
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActive(cat.id)}
                className="rounded-none border px-3 py-1.5 text-[13px] transition-colors sm:px-4 sm:py-2 sm:text-xs"
                style={active === cat.id
                  ? { background: accent, color: "#161510", borderColor: accent }
                  : { color: "#c5c4bd", borderColor: "#30332e" }}>
                {cat.name}
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-4 text-right sm:mt-10 sm:gap-5 md:grid-cols-3">
            {list.map(it => {
              const q = cart[it.id]?.qty ?? 0;
              return (
                <div key={it.id} className="border p-4 transition-all hover:-translate-y-1 sm:p-6" style={{ borderColor: "#30332e" }}>
                  {it.image_url && <img src={it.image_url} alt={it.name} className="mb-3 h-36 w-full object-cover sm:mb-4 sm:h-40" style={{ filter: "saturate(.85)" }} />}
                  <small style={{ color: accent }}>—</small>
                  <h3 className="mt-2 text-base font-medium sm:mt-3 sm:text-lg" style={{ fontFamily: "serif" }}>{it.name}</h3>
                  {it.description && <p className="mt-2 text-[13px] leading-relaxed text-neutral-400 sm:text-xs">{it.description}</p>}
                  <div className="mt-4 flex items-center justify-between sm:mt-5">
                    <span className="text-sm font-bold" style={{ color: "#dfbb7f" }}>{formatIQD(it.price_iqd)}</span>
                    <Qty q={q} primary={primary} accent={accent} size="sm"
                         onAdd={() => addItem(it.id, it.name, it.price_iqd)}
                         onRemove={() => removeItem(it.id)} />
                  </div>
                </div>
              );
            })}
          </div>
          {!list.length && <p className="mt-8 text-neutral-500">لا توجد أصناف في هذا القسم.</p>}
        </div>
      </section>
    </div>
  );
}

/* =========================================================
   4) BOWL — "نَبتة" (healthy green + lime, rounded bowls)
   ========================================================= */

function BowlTemplate({ tenant, categories, items, cart, primary, accent, coverUrl, content, addItem, removeItem }: TemplateProps) {
  const c = mergeContent("bowl", content);
  const featured = items.find(i => i.is_featured) ?? items[0];
  const heroImg = coverUrl || featured?.image_url;

  return (
    <div className="min-h-screen pb-32" style={{ background: "#f8f8ed", color: "#16362d", fontFamily: "Alexandria,Arial,sans-serif" }}>
      {c.top_banner && (
        <div className="px-3 py-2 text-center text-[12px] text-white sm:text-[13px]" style={{ background: primary }}>{c.top_banner}</div>
      )}
      <header className="mx-auto flex h-[70px] max-w-[1180px] items-center justify-between gap-3 px-4 sm:h-[85px] sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {tenant.logo_url ? <img src={tenant.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover sm:h-10 sm:w-10" /> : <span className="shrink-0 text-2xl">✿</span>}
          <span className="truncate text-lg font-extrabold sm:text-2xl" style={{ color: primary }}>{tenant.name}</span>
        </div>
      </header>

      <section className="mx-auto max-w-[1180px] px-3 sm:px-6">
        <div className="grid overflow-hidden rounded-3xl sm:rounded-[26px] md:grid-cols-[1.05fr_.95fr]"
             style={{ background: c.hero_gradient || accent }}>
          <div className="p-6 sm:p-10 md:p-16">
            <h1 className="text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl md:text-6xl">
              {c.hero_title} {c.hero_highlight && <span style={{ color: "#f27459" }}>{c.hero_highlight}</span>} اليوم
            </h1>
            {(c.hero_subtitle || tenant.description) && (
              <p className="mt-3 max-w-md text-xs leading-loose sm:mt-4 sm:text-sm">{c.hero_subtitle || tenant.description}</p>
            )}
            <a href="#menu" className="mt-4 inline-block rounded-xl px-5 py-3 text-[13px] font-bold text-white sm:mt-6 sm:py-3.5 sm:text-xs" style={{ background: primary }}>{c.hero_cta} ←</a>
          </div>
          <div className="min-h-[200px] sm:min-h-[280px] md:min-h-[460px]">
            {heroImg ? (
              <img src={heroImg} alt="" className="h-full w-full object-cover" style={{ mixBlendMode: "multiply" }} />
            ) : (
              <div className="grid h-full place-items-center text-7xl sm:text-8xl">🥗</div>
            )}
          </div>
        </div>

        <div className="my-6 grid grid-cols-3 overflow-hidden rounded-2xl border sm:my-8" style={{ borderColor: "#d8e1c8" }}>
          <div className="border-l p-3 text-[13px] sm:p-5 sm:text-xs" style={{ borderColor: "#d8e1c8", color: "#557067" }}>
            <b className="block text-base sm:text-lg" style={{ color: primary }}>{items.length}+</b>وصفة طازة
          </div>
          <div className="border-l p-3 text-[13px] sm:p-5 sm:text-xs" style={{ borderColor: "#d8e1c8", color: "#557067" }}>
            <b className="block text-base sm:text-lg" style={{ color: primary }}>~25د</b>وقت التوصيل
          </div>
          <div className="p-3 text-[13px] sm:p-5 sm:text-xs" style={{ color: "#557067" }}>
            <b className="block text-base sm:text-lg" style={{ color: primary }}>{categories.length}</b>قسم متنوع
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-[1180px] px-3 pb-8 sm:px-6">
        {categories.map(cat => {
          const list = items.filter(i => i.category_id === cat.id);
          if (!list.length) return null;
          return (
            <div key={cat.id} className="mb-10 sm:mb-12">
              <div className="mb-4 sm:mb-6">
                <span className="text-[13px] font-bold sm:text-xs" style={{ color: "#f27459" }}>قسم</span>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{cat.name}</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                {list.map(it => {
                  const q = cart[it.id]?.qty ?? 0;
                  return (
                    <article key={it.id} className="rounded-2xl bg-white p-2.5 sm:rounded-[17px] sm:p-3">
                      <div className="overflow-hidden rounded-xl">
                        {it.image_url ? <img src={it.image_url} alt={it.name} className="h-36 w-full object-cover sm:h-52" /> : <div className="h-36 sm:h-52"><ItemImagePlaceholder accent={accent} emoji="🥗" /></div>}
                      </div>
                      <h3 className="mt-2 px-1 text-sm font-bold sm:mt-3 sm:text-base">{it.name}</h3>
                      {it.description && <p className="mt-1 line-clamp-1 px-1 text-[13px] text-neutral-500 sm:text-xs">{it.description}</p>}
                      <div className="mt-2 flex items-center justify-between px-1 sm:mt-3">
                        <span className="text-sm font-extrabold sm:text-base" style={{ color: primary }}>{formatIQD(it.price_iqd)}</span>
                        <Qty q={q} primary={primary} accent={accent} size="sm"
                             onAdd={() => addItem(it.id, it.name, it.price_iqd)}
                             onRemove={() => removeItem(it.id)} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

/* =========================================================
   5) CAFE — "نُقطة" (editorial café, serif, sand + clay)
   ========================================================= */

function CafeTemplate({ tenant, categories, items, cart, primary, accent, coverUrl, content, addItem, removeItem }: TemplateProps) {
  const c = mergeContent("cafe", content);
  return (
    <div className="min-h-screen pb-32" style={{ background: "#f4eee4", color: "#35251d", fontFamily: "'IBM Plex Sans Arabic',sans-serif" }}>
      <header className="mx-auto flex max-w-[1140px] items-center justify-between gap-3 border-b px-4 py-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-6 sm:py-5" style={{ borderColor: "#d8cdbf" }}>
        <div className="flex min-w-0 items-center gap-2">
          {tenant.logo_url && <img src={tenant.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />}
          <span className="truncate text-xl font-bold sm:text-3xl" style={{ fontFamily: "'Playfair Display',serif" }}>{tenant.name}</span>
        </div>
        <a href="#menu" className="shrink-0 border-b-2 pb-1 text-[13px] sm:text-xs sm:justify-self-end" style={{ borderColor: accent }}>{c.hero_cta}</a>
      </header>

      <section className="mx-auto grid max-w-[1140px] grid-cols-1 md:grid-cols-[1.03fr_.97fr]">
        <div className="self-center px-5 py-10 sm:px-6 sm:py-16 md:pr-16">
          {c.hero_badge && <span className="text-[12px] font-bold tracking-widest sm:text-[13px]" style={{ color: accent }}>{c.hero_badge}</span>}
          <h1 className="mt-3 text-4xl font-bold leading-[1.05] sm:mt-4 sm:text-5xl md:text-7xl" style={{ fontFamily: "'Playfair Display',serif" }}>
            {c.hero_title} {c.hero_highlight && <i style={{ color: accent }}>{c.hero_highlight}</i>}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-loose sm:mt-5 sm:text-[15px]" style={{ color: "#614c40" }}>
            {c.hero_subtitle || tenant.description || "نقدم أفضل ما لدينا بمكونات مختارة وحب."}
          </p>
          <a href="#menu" className="mt-4 inline-block px-5 py-3 text-[13px] text-white sm:mt-5 sm:px-6 sm:py-3.5 sm:text-xs" style={{ background: "#35251d" }}>
            {c.hero_cta}
          </a>
        </div>
        <div className="min-h-[220px] sm:min-h-[360px]">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-full w-full object-cover" style={{ filter: "sepia(.18)" }} />
          ) : (
            <div className="grid h-full place-items-center text-7xl sm:text-8xl" style={{ background: c.hero_gradient || `${accent}44` }}>☕</div>
          )}
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-[1140px] px-4 py-14 sm:px-6 sm:py-20">
        {categories.map(cat => {
          const list = items.filter(i => i.category_id === cat.id);
          if (!list.length) return null;
          return (
            <div key={cat.id} className="mb-12 sm:mb-16">
              <div className="mb-6 text-center sm:mb-8">
                <span className="text-[12px] font-bold tracking-widest sm:text-[13px]" style={{ color: accent }}>—</span>
                <h2 className="mt-1 text-3xl sm:text-4xl" style={{ fontFamily: "'Playfair Display',serif" }}>{cat.name}</h2>
              </div>
              <div className="grid grid-cols-1 border-r border-t sm:grid-cols-2 md:grid-cols-3" style={{ borderColor: "#d7c9b9" }}>
                {list.map((it, i) => {
                  const q = cart[it.id]?.qty ?? 0;
                  return (
                    <div key={it.id} className="min-h-[150px] border-b border-l p-4 sm:min-h-[170px] sm:p-6" style={{ borderColor: "#d7c9b9" }}>
                      <div className="text-xl font-bold sm:text-2xl" style={{ fontFamily: "'Playfair Display',serif", color: accent }}>
                        0{i + 1}
                      </div>
                      <h3 className="mt-3 text-[15px] font-bold sm:mt-4 sm:text-[17px]">{it.name}</h3>
                      {it.description && <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed sm:text-xs" style={{ color: "#775f50" }}>{it.description}</p>}
                      <div className="mt-3 flex items-center justify-between sm:mt-4">
                        <span className="text-sm font-bold sm:text-base" style={{ color: primary }}>{formatIQD(it.price_iqd)}</span>
                        <Qty q={q} primary={primary} accent={accent} size="sm"
                             onAdd={() => addItem(it.id, it.name, it.price_iqd)}
                             onRemove={() => removeItem(it.id)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

/* =========================================================
   6) SEAFOOD — "مرسى"
   ========================================================= */

function SeafoodTemplate({ tenant, categories, items, cart, primary, accent, coverUrl, content, addItem, removeItem }: TemplateProps) {
  const c = mergeContent("seafood", content);
  return (
    <div className="min-h-screen pb-32" style={{ background: "#fff", color: "#12303b", fontFamily: "Cairo,Arial,sans-serif" }}>
      {c.top_banner && (
        <div className="px-3 py-2 text-center text-[12px] text-white sm:text-[13px]" style={{ background: primary }}>{c.top_banner}</div>
      )}
      <header className="mx-auto flex h-[70px] max-w-[1200px] items-center justify-between gap-3 px-4 sm:h-[92px] sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {tenant.logo_url && <img src={tenant.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover sm:h-10 sm:w-10" />}
          <span className="truncate text-lg font-extrabold sm:text-2xl" style={{ color: primary }}>{tenant.name} <span style={{ color: accent }}>〰</span></span>
        </div>
        {tenant.phone && (
          <a href={`tel:${tenant.phone}`} className="shrink-0 rounded-md px-3 py-2 text-[13px] font-bold text-white sm:px-5 sm:py-3 sm:text-xs" style={{ background: accent }} dir="ltr">
            {tenant.phone}
          </a>
        )}
      </header>

      <section className="relative overflow-hidden" style={{ background: c.hero_gradient || `${accent}22` }}>
        <div className="mx-auto flex min-h-[380px] max-w-[1200px] items-center px-4 py-10 sm:min-h-[500px] sm:px-6 sm:py-0">
          <div className="z-10 max-w-[520px]">
            {c.hero_badge && <span className="text-[13px] font-bold sm:text-xs" style={{ color: accent }}>{c.hero_badge}</span>}
            <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:mt-3 sm:text-5xl md:text-6xl" style={{ color: primary }}>
              {c.hero_title} {c.hero_highlight && <span style={{ color: "#ed765b" }}>{c.hero_highlight}</span>}
            </h1>
            <p className="mt-3 text-xs leading-loose sm:mt-4 sm:text-sm" style={{ color: "#42636b" }}>
              {c.hero_subtitle || tenant.description || "نختار مكوناتنا يومياً من المصدر، ونحضّرها بأيدي طهاة خبراء لتصلك بأفضل جودة."}
            </p>
            <a href="#menu" className="mt-5 inline-block rounded-md px-5 py-3 text-[13px] font-bold text-white sm:mt-6 sm:px-6 sm:py-3.5 sm:text-xs" style={{ background: primary }}>
              {c.hero_cta}
            </a>
          </div>
          {coverUrl && (
            <img src={coverUrl} alt="" className="absolute inset-y-0 left-0 hidden h-full w-1/2 object-cover md:block"
                 style={{ clipPath: "polygon(22% 0,100% 0,100% 100%,0 100%)" }} />
          )}
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
        {categories.map(cat => {
          const list = items.filter(i => i.category_id === cat.id);
          if (!list.length) return null;
          return (
            <div key={cat.id} className="mb-10 sm:mb-14">
              <div className="mb-4 sm:mb-6">
                <small className="text-[13px] font-bold sm:text-xs" style={{ color: "#ed765b" }}>—</small>
                <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl" style={{ color: primary }}>{cat.name}</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
                {list.map(it => {
                  const q = cart[it.id]?.qty ?? 0;
                  return (
                    <article key={it.id} className="overflow-hidden rounded-xl border" style={{ borderColor: "#dcebea" }}>
                      <div className="h-32 overflow-hidden sm:h-44">
                        {it.image_url ? <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" /> : <ItemImagePlaceholder accent={accent} emoji="🐟" />}
                      </div>
                      <div className="p-3 sm:p-3.5">
                        <h3 className="text-xs font-bold sm:text-sm">{it.name}</h3>
                        {it.description && <p className="mt-1 line-clamp-1 text-[12px] sm:text-[13px]" style={{ color: "#728789" }}>{it.description}</p>}
                        <div className="mt-2 flex items-center justify-between sm:mt-3">
                          <span className="text-xs font-bold sm:text-sm" style={{ color: "#ed765b" }}>{formatIQD(it.price_iqd)}</span>
                          <Qty q={q} primary={primary} accent={accent} size="sm"
                               onAdd={() => addItem(it.id, it.name, it.price_iqd)}
                               onRemove={() => removeItem(it.id)} />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

/* =========================================================
   7) FRESH — "نَبتة" (editorial healthy: cream + green + lime + coral)
   ========================================================= */

function FreshTemplate({ tenant, categories, items, cart, primary, accent, coverUrl, content, addItem, removeItem }: TemplateProps) {
  const c = mergeContent("fresh", content);
  const featured = items.find(i => i.is_featured) ?? items[0];
  const heroImg = coverUrl || featured?.image_url;
  const coral = "#f27459";
  const cream = "#f8f8ed";
  const ink = "#16362d";

  return (
    <div className="min-h-screen pb-32" style={{ background: cream, color: ink, fontFamily: "Alexandria,Cairo,Arial,sans-serif" }}>
      {c.top_banner && (
        <div className="px-3 py-2.5 text-center text-[13px] text-white sm:text-sm" style={{ background: primary }}>
          {c.top_banner}
        </div>
      )}

      <header className="mx-auto flex h-[78px] max-w-[1180px] items-center justify-between gap-3 px-4 sm:h-[92px] sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover sm:h-12 sm:w-12" />
          ) : (
            <span className="shrink-0 text-2xl" style={{ color: coral }}>✿</span>
          )}
          <span className="truncate text-xl font-extrabold sm:text-2xl" style={{ color: primary }}>{tenant.name}</span>
        </div>
        <a href="#menu" className="shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold sm:px-5 sm:py-3 sm:text-sm" style={{ background: accent, color: primary }}>
          {c.hero_cta}
        </a>
      </header>

      {/* HERO — split with lime bg */}
      <section className="mx-auto max-w-[1180px] px-3 sm:px-6">
        <div className="grid overflow-hidden rounded-3xl sm:rounded-[26px] md:grid-cols-[1.05fr_.95fr]"
             style={{ background: c.hero_gradient || accent }}>
          <div className="p-6 sm:p-10 md:p-14">
            {c.hero_badge && <span className="text-sm font-bold" style={{ color: coral }}>{c.hero_badge}</span>}
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl md:text-6xl">
              {c.hero_title} {c.hero_highlight && <span style={{ color: coral }}>{c.hero_highlight}</span>}
            </h1>
            {(c.hero_subtitle || tenant.description) && (
              <p className="mt-4 max-w-md text-sm leading-loose sm:text-base">{c.hero_subtitle || tenant.description}</p>
            )}
            <a href="#menu" className="mt-5 inline-block rounded-xl px-6 py-3.5 text-sm font-bold text-white sm:mt-6 sm:text-base" style={{ background: primary }}>
              {c.hero_cta} ←
            </a>
          </div>
          <div className="min-h-[220px] sm:min-h-[300px] md:min-h-[460px]">
            {heroImg ? (
              <img src={heroImg} alt="" className="h-full w-full object-cover" style={{ mixBlendMode: "multiply" }} />
            ) : (
              <div className="grid h-full place-items-center text-7xl sm:text-8xl">🥗</div>
            )}
          </div>
        </div>

        {/* STATS ROW */}
        <div className="my-6 grid grid-cols-3 overflow-hidden rounded-2xl border sm:my-8" style={{ borderColor: "#d8e1c8" }}>
          <div className="border-l p-4 text-xs sm:p-5 sm:text-sm" style={{ borderColor: "#d8e1c8", color: "#557067" }}>
            <b className="block text-lg sm:text-2xl" style={{ color: primary }}>{items.length}+</b>وصفة طازة
          </div>
          <div className="border-l p-4 text-xs sm:p-5 sm:text-sm" style={{ borderColor: "#d8e1c8", color: "#557067" }}>
            <b className="block text-lg sm:text-2xl" style={{ color: primary }}>~30د</b>حتى باب بيتك
          </div>
          <div className="p-4 text-xs sm:p-5 sm:text-sm" style={{ color: "#557067" }}>
            <b className="block text-lg sm:text-2xl" style={{ color: primary }}>{categories.length}</b>قسم متنوع
          </div>
        </div>
      </section>

      {/* BUILD YOUR OWN — 3 steps card */}
      {c.build_title && (
        <section className="mx-auto max-w-[1180px] px-3 sm:px-6">
          <div className="grid gap-8 rounded-3xl p-8 text-white sm:p-10 md:grid-cols-[1.15fr_.85fr]" style={{ background: primary }}>
            <div>
              <span className="text-sm font-bold" style={{ color: accent }}>الوجبة زي ما تحب</span>
              <h2 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">{c.build_title}</h2>
              {c.build_subtitle && (
                <p className="mt-3 max-w-md text-sm leading-loose sm:text-base" style={{ color: "#d3dfcc" }}>
                  {c.build_subtitle}
                </p>
              )}
              <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
                {["اختر القاعدة", "أضف البروتين", "زوّد النكهة"].map((s, i) => (
                  <div key={i} className="rounded-xl border p-3 text-center text-xs sm:text-sm" style={{ borderColor: "#668578" }}>
                    <b className="block text-lg sm:text-xl" style={{ color: accent }}>{["١","٢","٣"][i]}</b>
                    {s}
                  </div>
                ))}
              </div>
              <a href="#menu" className="mt-6 inline-block rounded-xl px-6 py-3 text-sm font-bold sm:text-base" style={{ background: accent, color: primary }}>
                ابدأ التركيب ←
              </a>
            </div>
            {heroImg && (
              <img src={heroImg} alt="" className="h-56 w-full rounded-2xl object-cover sm:h-full" />
            )}
          </div>
        </section>
      )}

      {/* PRODUCTS */}
      <section id="menu" className="mx-auto max-w-[1180px] px-3 py-12 sm:px-6 sm:py-16">
        {categories.map(cat => {
          const list = items.filter(i => i.category_id === cat.id);
          if (!list.length) return null;
          return (
            <div key={cat.id} className="mb-12 sm:mb-14">
              <div className="mb-5 flex items-end justify-between sm:mb-7">
                <div>
                  <span className="text-sm font-bold" style={{ color: coral }}>{c.menu_kicker}</span>
                  <h2 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{cat.name}</h2>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-5">
                {list.map(it => {
                  const q = cart[it.id]?.qty ?? 0;
                  return (
                    <article key={it.id} className="rounded-2xl bg-white p-3 shadow-sm">
                      <div className="overflow-hidden rounded-xl">
                        {it.image_url ? (
                          <img src={it.image_url} alt={it.name} className="h-44 w-full object-cover sm:h-56" />
                        ) : (
                          <div className="h-44 sm:h-56"><ItemImagePlaceholder accent={accent} emoji="🥗" /></div>
                        )}
                      </div>
                      <h3 className="mt-3 px-1 text-base font-bold sm:text-lg">{it.name}</h3>
                      {it.description && (
                        <p className="mt-1 line-clamp-2 px-1 text-sm sm:text-[15px]" style={{ color: "#6c8276" }}>
                          {it.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between px-1">
                        <span className="text-lg font-extrabold sm:text-xl" style={{ color: primary }}>
                          {formatIQD(it.price_iqd)}
                        </span>
                        <Qty q={q} primary={primary} accent={accent}
                             onAdd={() => addItem(it.id, it.name, it.price_iqd)}
                             onRemove={() => removeItem(it.id)} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* SUBSCRIPTION CTA */}
      {c.subscription_title && (
        <section className="px-4 py-14 text-center text-white sm:py-20" style={{ background: coral }}>
          <h2 className="text-3xl font-extrabold sm:text-4xl">{c.subscription_title}</h2>
          {c.subscription_subtitle && (
            <p className="mx-auto mt-3 max-w-xl text-sm sm:text-base">{c.subscription_subtitle}</p>
          )}
          <a href="#menu" className="mt-6 inline-block rounded-xl bg-white px-6 py-3 text-sm font-bold sm:text-base" style={{ color: coral }}>
            اطلب أول وجبة →
          </a>
        </section>
      )}
    </div>
  );
}

/* =========================================================
   Registry
   ========================================================= */

export const TEMPLATES = [
  { id: "store", name: "متجر أنيق", description: "واجهة متجر دافئة بتصميم تحريري وصورة غلاف كبيرة.", Component: StoreTemplate,
    palette: { primary: "#ed6c35", accent: "#dce6d5" } },
  { id: "fast", name: "وجبات سريعة", description: "مرح، شبابي، بألوان جريئة وأزرار كبيرة.", Component: FastTemplate,
    palette: { primary: "#142bd4", accent: "#f8d943" } },
  { id: "luxe", name: "فاخر", description: "خلفية داكنة بلمسات ذهبية لتجربة راقية.", Component: LuxeTemplate,
    palette: { primary: "#10110f", accent: "#c79f62" } },
  { id: "bowl", name: "صحي وطازج", description: "أخضر وليموني، مناسب للسلطات والوجبات الصحية.", Component: BowlTemplate,
    palette: { primary: "#174b3c", accent: "#cfed70" } },
  { id: "cafe", name: "كافيه تحريري", description: "خطوط سيريف وشبكة أصناف مرقمة على ورق كريمي.", Component: CafeTemplate,
    palette: { primary: "#35251d", accent: "#bd6547" } },
  { id: "seafood", name: "بحري / ساحلي", description: "أزرق كحلي مع لمسات مرجانية، مناسب للمأكولات البحرية.", Component: SeafoodTemplate,
    palette: { primary: "#073a51", accent: "#55c8c3" } },
  { id: "fresh", name: "نَبتة — تحريري صحي", description: "قالب صحي متكامل: بطل + إحصائيات + اصنع طبقك + اشتراك. مثالي للسلطات والعصائر.", Component: FreshTemplate,
    palette: { primary: "#174b3c", accent: "#cfed70" } },
] as const;


export type TemplateId = typeof TEMPLATES[number]["id"];

export function getTemplate(id: string | null | undefined) {
  return TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0];
}

/* Thumbnails for the picker */
export function TemplateThumb({ id, primary, accent }: { id: string; primary: string; accent: string }) {
  const common = "h-full w-full overflow-hidden";
  switch (id) {
    case "fast":
      return (
        <div className={common} style={{ background: "#fffef9" }}>
          <div className="h-3" style={{ background: accent }} />
          <div className="m-2 rounded-lg p-3" style={{ background: primary, color: "#fff" }}>
            <div className="text-[12px] font-black">جوعان؟</div>
            <div className="mt-1 h-1 w-8 rounded" style={{ background: accent }} />
          </div>
          <div className="grid grid-cols-3 gap-1 px-2">
            <div className="h-4 rounded" style={{ background: accent }} />
            <div className="h-4 rounded" style={{ background: `${primary}30` }} />
            <div className="h-4 rounded" style={{ background: `${primary}30` }} />
          </div>
        </div>
      );
    case "luxe":
      return (
        <div className={common} style={{ background: "#10110f" }}>
          <div className="mx-auto mt-3 h-2 w-8" style={{ background: accent }} />
          <div className="mx-auto mt-2 h-3 w-16" style={{ background: "#dfbb7f66" }} />
          <div className="mt-2 grid grid-cols-3 gap-1 p-2">
            <div className="h-6 border" style={{ borderColor: "#30332e" }} />
            <div className="h-6 border" style={{ borderColor: "#30332e" }} />
            <div className="h-6 border" style={{ borderColor: "#30332e" }} />
          </div>
        </div>
      );
    case "bowl":
      return (
        <div className={common} style={{ background: "#f8f8ed" }}>
          <div className="m-2 rounded-lg p-3" style={{ background: accent }}>
            <div className="text-[12px] font-black" style={{ color: primary }}>صحي</div>
          </div>
          <div className="grid grid-cols-3 gap-1 px-2">
            <div className="h-5 rounded-md bg-white" />
            <div className="h-5 rounded-md bg-white" />
            <div className="h-5 rounded-md bg-white" />
          </div>
        </div>
      );
    case "cafe":
      return (
        <div className={common} style={{ background: "#f4eee4" }}>
          <div className="mx-auto mt-3 h-3 w-16" style={{ background: `${primary}44` }} />
          <div className="mt-3 grid grid-cols-3 border-r border-t" style={{ borderColor: "#d7c9b9" }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} className="h-6 border-b border-l" style={{ borderColor: "#d7c9b9" }} />
            ))}
          </div>
        </div>
      );
    case "seafood":
      return (
        <div className={common} style={{ background: "#fff" }}>
          <div className="h-4" style={{ background: primary }} />
          <div className="grid grid-cols-2 gap-1 p-2">
            <div className="h-8 rounded" style={{ background: `${accent}55` }} />
            <div className="h-8 rounded" style={{ background: `${accent}55` }} />
          </div>
        </div>
      );
    case "fresh":
      return (
        <div className={common} style={{ background: "#f8f8ed" }}>
          <div className="h-2" style={{ background: primary }} />
          <div className="m-2 rounded-lg p-2" style={{ background: accent }}>
            <div className="text-[12px] font-black" style={{ color: primary }}>نَبتة</div>
            <div className="mt-1 h-1 w-6 rounded" style={{ background: "#f27459" }} />
          </div>
          <div className="grid grid-cols-3 gap-1 px-2">
            <div className="h-5 rounded bg-white" />
            <div className="h-5 rounded bg-white" />
            <div className="h-5 rounded bg-white" />
          </div>
          <div className="mx-2 mt-1 h-2 rounded" style={{ background: "#f27459" }} />
        </div>
      );
    case "store":
    default:
      return (
        <div className={common} style={{ background: "#fbf8f1" }}>
          <div className="m-2 rounded-lg p-3" style={{ background: "#17231d", color: "#fff" }}>
            <div className="text-[12px] font-black" style={{ color: accent }}>متجر</div>
          </div>
          <div className="grid grid-cols-4 gap-1 px-2">
            <div className="h-4 rounded" style={{ background: primary }} />
            <div className="h-4 rounded" style={{ background: `${primary}55` }} />
            <div className="h-4 rounded" style={{ background: `${primary}55` }} />
            <div className="h-4 rounded" style={{ background: `${primary}55` }} />
          </div>
        </div>
      );
  }
}
