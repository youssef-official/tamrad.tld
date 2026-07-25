import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Store, ShoppingBag, Users, Ticket, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/search")({
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["admin", "global-search", term],
    enabled: term.length >= 2,
    queryFn: async () => {
      const like = `%${term}%`;
      const [tenants, orders, profiles, coupons] = await Promise.all([
        supabase.from("tenants").select("id, name, slug, phone").or(`name.ilike.${like},slug.ilike.${like},phone.ilike.${like}`).limit(20),
        supabase.from("orders").select("id, order_number, customer_phone, status, total_iqd, tenant_id").or(`order_number.ilike.${like},customer_phone.ilike.${like}`).limit(30),
        supabase.from("profiles").select("id, full_name, phone").or(`full_name.ilike.${like},phone.ilike.${like}`).limit(20),
        (supabase.from("coupons") as any).select("id, code, tenant_id, discount_type, discount_value").ilike("code", like).limit(20),
      ]);
      return {
        tenants: tenants.data ?? [],
        orders: orders.data ?? [],
        profiles: profiles.data ?? [],
        coupons: coupons.data ?? [],
      };
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTerm(q.trim());
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-black text-foreground">
          <Search className="h-6 w-6 text-primary" />
          البحث الشامل
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ابحث في المطاعم، الطلبات، المستخدمين، والكوبونات دفعة واحدة.
        </p>
      </header>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="اسم مطعم، رقم طلب، رقم هاتف، اسم زبون، كود كوبون…"
          className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button type="submit" className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">
          بحث
        </button>
      </form>

      {isFetching && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <Section title="المطاعم" icon={Store} count={data.tenants.length}>
            {data.tenants.map((t: any) => (
              <Link
                key={t.id}
                to="/admin/tenants/$id"
                params={{ id: t.id }}
                className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-muted/50"
              >
                <span className="text-xs text-muted-foreground" dir="ltr">/{t.slug}</span>
                <span className="font-bold">{t.name}</span>
              </Link>
            ))}
          </Section>

          <Section title="الطلبات" icon={ShoppingBag} count={data.orders.length}>
            {data.orders.map((o: any) => (
              <Link
                key={o.id}
                to="/orders/$id"
                params={{ id: o.id }}
                className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-muted/50"
              >
                <span className="text-xs text-muted-foreground">{o.status} · {o.total_iqd} د.ع</span>
                <span className="font-bold">
                  #{o.order_number} · <span dir="ltr">{o.customer_phone}</span>
                </span>
              </Link>
            ))}
          </Section>

          <Section title="المستخدمون" icon={Users} count={data.profiles.length}>
            {data.profiles.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                <span className="text-xs text-muted-foreground" dir="ltr">{p.phone ?? "—"}</span>
                <span className="font-bold">{p.full_name ?? "بلا اسم"}</span>
              </div>
            ))}
          </Section>

          <Section title="الكوبونات" icon={Ticket} count={data.coupons.length}>
            {data.coupons.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                <span className="text-xs text-muted-foreground">
                  {c.discount_type === "percent" ? `${c.discount_value}%` : `${c.discount_value} د.ع`}
                </span>
                <span className="font-mono font-bold">{c.code}</span>
              </div>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: any;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-black text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{count}</span>
      </h2>
      {count === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          لا نتائج
        </p>
      ) : (
        <div className="space-y-1.5">{children}</div>
      )}
    </section>
  );
}
