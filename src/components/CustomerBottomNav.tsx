import { Link, useLocation } from "@tanstack/react-router";
import { ShoppingBag, Ticket, User, Utensils } from "lucide-react";
import { useEffect, useState } from "react";

const LAST_STORE_KEY = "tamrad:last-storefront";

/**
 * Bottom navigation for customer surfaces (storefront + account pages).
 * Remembers the last visited storefront so the "المطعم" tab stays available
 * on account pages (orders, coupons, profile) — not just on the storefront.
 */
export function CustomerBottomNav({
  storefrontSlug,
  primary = "hsl(var(--primary))",
}: {
  storefrontSlug?: string | null;
  primary?: string;
}) {
  const loc = useLocation();
  const path = loc.pathname;
  const [rememberedSlug, setRememberedSlug] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (storefrontSlug) {
        localStorage.setItem(LAST_STORE_KEY, storefrontSlug);
        setRememberedSlug(storefrontSlug);
      } else {
        setRememberedSlug(localStorage.getItem(LAST_STORE_KEY));
      }
    } catch { /* ignore */ }
  }, [storefrontSlug]);

  const slug = storefrontSlug ?? rememberedSlug;

  const items = [
    slug
      ? {
          key: "shop",
          label: "المطعم",
          icon: Utensils,
          to: typeof window !== "undefined" && window.location.pathname === "/" ? "/" : `/r/${slug}`,
          match: path === "/" || path.startsWith("/r/"),
        }
      : null,
    { key: "orders", label: "طلباتي", icon: ShoppingBag, to: "/my-orders", match: path.startsWith("/my-orders") || path.startsWith("/orders/") },
    { key: "coupons", label: "الأكواد", icon: Ticket, to: "/my-coupons", match: path.startsWith("/my-coupons") },
    { key: "account", label: "حسابي", icon: User, to: "/account", match: path.startsWith("/account") },
  ].filter(Boolean) as Array<{ key: string; label: string; icon: any; to: string; match: boolean }>;

  return (
    <>
      <div aria-hidden style={{ height: "calc(4.5rem + env(safe-area-inset-bottom))" }} />
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <li key={it.key}>
                <Link
                  to={it.to}
                  className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold"
                  style={{ color: it.match ? primary : "hsl(var(--muted-foreground))" }}
                >
                  <Icon className="h-5 w-5" />
                  {it.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
