import { createFileRoute, Outlet, notFound } from "@tanstack/react-router";
import { DashboardShell } from "@/components/DashboardShell";
import { useMe } from "@/lib/useMe";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Store, Users, MessageSquare, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) throw notFound();
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!data) throw notFound();
  },
  component: AdminLayout,
});

const NAV = [
  { label: "لوحة التحكم", to: "/admin", icon: LayoutDashboard },
  { label: "المطاعم", to: "/admin/tenants", icon: Store },
  { label: "المستخدمون", to: "/admin/users", icon: Users },
  { label: "مراقبة الدردشات", to: "/admin/chat-monitor", icon: MessageSquare },
  { label: "البحث الشامل", to: "/admin/search", icon: Search },
];

function AdminLayout() {
  const { data: me } = useMe();
  return (
    <DashboardShell
      title="الإدارة المركزية"
      subtitle="سوبر أدمن"
      nav={NAV}
      user={{ name: me?.profile?.full_name, email: me?.user.email }}
    >
      <Outlet />
    </DashboardShell>
  );
}
