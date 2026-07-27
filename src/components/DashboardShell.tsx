import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToWebPush } from "@/lib/webPush";
import logo from "@/assets/tamrad-logo.png";
import { Bell, CheckCheck, LogOut, Menu, X } from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";

export type NavItem = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
};

export function DashboardShell({
  title,
  subtitle,
  nav,
  user,
  headerExtra,
  children,
}: {
  title: string;
  subtitle: string;
  nav: NavItem[];
  user?: { name?: string | null; email?: string | null } | null;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initial = (user?.name ?? user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-64 flex-col border-l border-border bg-primary text-primary-foreground transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex h-20 items-center justify-between gap-2 border-b border-primary-foreground/10 px-6">
          <div className="flex items-center gap-2">
            <img src={logo} alt="تمراد" className="h-9 w-9" />
            <div>
              <div className="text-lg font-black">تمراد</div>
              <div className="text-[10px] opacity-60">{subtitle}</div>
            </div>
          </div>
          <button className="lg:hidden" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {nav.map((n) => {
            const active =
              pathname === n.to || (n.to !== "/" && pathname.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-primary-foreground/10 p-4">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium opacity-80 transition-all hover:bg-primary-foreground/10 hover:opacity-100"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 lg:mr-64">
        <header className="flex h-20 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl lg:px-10">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="text-sm text-muted-foreground">
              تمراد <span className="mx-2">/</span> {title}
            </div>
            {headerExtra && <div className="ms-2">{headerExtra}</div>}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="hidden text-right sm:block">
              <div className="text-sm font-bold">{user?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lime font-black text-lime-foreground">
              {initial}
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-10">{children}</div>
      </main>
    </div>
  );
}

function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => { if (active) setUserId(data.user?.id ?? null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { data } = await (supabase.from("notification_queue") as any)
        .select("id, title, body, data, created_at, read_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(12);
      setItems(data ?? []);
    };
    void load();
    const channel = supabase.channel(`notification-bell-${userId}`).on(
      "postgres_changes", { event: "INSERT", schema: "public", table: "notification_queue", filter: `user_id=eq.${userId}` },
      () => void load(),
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const unread = items.filter((item) => !item.read_at).length;
  const markAllRead = async () => {
    if (!userId || unread === 0) return;
    await (supabase.from("notification_queue") as any)
      .update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
  };
  const enablePush = async () => {
    if (!userId) return;
    setPushBusy(true);
    const result = await subscribeToWebPush(userId);
    setPushMessage(result.message);
    setPushBusy(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((value) => !value)} aria-label="الإشعارات" className="relative rounded-xl border border-border bg-card p-2 text-foreground hover:bg-muted">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -left-1 -top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-black leading-4 text-destructive-foreground">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <span className="font-black">الإشعارات</span>
            <button onClick={markAllRead} disabled={!unread} className="inline-flex items-center gap-1 text-xs font-bold text-primary disabled:opacity-40"><CheckCheck className="h-3.5 w-3.5" /> قراءة الكل</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? <p className="p-5 text-center text-xs text-muted-foreground">لا توجد إشعارات بعد.</p> : items.map((item) => (
              <button key={item.id} onClick={async () => {
                if (!item.read_at) await (supabase.from("notification_queue") as any).update({ read_at: new Date().toISOString() }).eq("id", item.id);
                setItems((current) => current.map((row) => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row));
                const url = item.data?.url;
                if (typeof url === "string" && url.startsWith("/")) window.location.assign(url);
              }} className={`block w-full border-b border-border px-3 py-3 text-right hover:bg-muted/60 ${item.read_at ? "" : "bg-primary/5"}`}>
                <div className="text-sm font-bold">{item.title}</div><div className="mt-0.5 text-xs text-muted-foreground">{item.body}</div>
              </button>
            ))}
          </div>
          <div className="border-t border-border p-3">
            <button onClick={enablePush} disabled={pushBusy} className="w-full rounded-xl border border-primary/30 bg-primary/5 py-2 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-50">
              {pushBusy ? "جاري التفعيل..." : "تفعيل إشعارات خارج التطبيق"}
            </button>
            {pushMessage && <p className="mt-2 text-center text-[11px] text-muted-foreground">{pushMessage}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-black">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card py-14 text-center">
      <Icon className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
      <p className="text-base font-bold">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
