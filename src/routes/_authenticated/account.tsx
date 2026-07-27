import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/useMe";
import { CustomerBottomNav } from "@/components/CustomerBottomNav";
import { MapPin, ShoppingBag, Ticket, LogOut, User as UserIcon, ChevronLeft, Wallet } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "حسابي — تمراد" },
      { name: "description", content: "إدارة معلومات حسابك، عناوينك، وطلباتك." },
      { property: "og:title", content: "حسابي — تمراد" },
      { property: "og:description", content: "إدارة حسابك في تمراد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [walletTenant, setWalletTenant] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tamrad:last-wallet-tenant");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.id && parsed?.name) setWalletTenant({ id: parsed.id, name: parsed.name });
    } catch {
      setWalletTenant(null);
    }
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links = [
    { to: "/account/addresses", label: "عناوين التوصيل", icon: MapPin, hint: "أضف وعدّل عناوين التوصيل" },
    { to: "/my-orders", label: "طلباتي السابقة", icon: ShoppingBag, hint: "متابعة الطلبات وإعادة الطلب" },
    { to: "/my-coupons", label: "أكوادي وجوائزي", icon: Ticket, hint: "أكواد الخصم وهدايا الولاء" },
    { to: "/wallet", label: "محفظتي", icon: Wallet, hint: walletTenant ? `رصيدك لدى ${walletTenant.name}` : "اختر مطعماً أولاً" },
  ] as const;

  return (
    <div dir="rtl" className="min-h-screen bg-background pb-4">
      <header className="border-b border-border bg-card px-4 py-4">
        <h1 className="flex items-center gap-2 text-xl font-black">
          <UserIcon className="h-5 w-5 text-primary" /> حسابي
        </h1>
      </header>

      <main className="mx-auto max-w-md space-y-4 p-4">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="text-lg font-black">{me?.profile?.full_name || "زبون تمراد"}</div>
          <div className="mt-1 text-xs text-muted-foreground">{me?.user.email}</div>
          {me?.profile?.phone && (
            <div className="text-xs text-muted-foreground" dir="ltr">{me.profile.phone}</div>
          )}
        </section>

        <section className="space-y-2">
          {links.map((l) => {
            const Icon = l.icon;
            const href = l.to === "/wallet" && walletTenant
              ? `/wallet?tenant=${encodeURIComponent(walletTenant.id)}`
              : l.to;
            return (
              <a
                key={l.to}
                href={href}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary"
              >
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-black">{l.label}</div>
                  <div className="text-[11px] text-muted-foreground">{l.hint}</div>
                </div>
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </a>
            );
          })}
        </section>

        <button
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 py-3 text-sm font-bold text-destructive"
        >
          <LogOut className="h-4 w-4" /> تسجيل الخروج
        </button>
      </main>

      <CustomerBottomNav />
    </div>
  );
}
