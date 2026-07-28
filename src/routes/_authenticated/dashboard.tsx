import { createFileRoute, Outlet, notFound } from "@tanstack/react-router";
import { DashboardShell } from "@/components/DashboardShell";
import { BranchSwitcher } from "@/components/BranchSwitcher";
import { useMe } from "@/lib/useMe";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  Settings,
  Store,
  Tag,
  Map,
  BarChart3,
  Wallet,
  Bike,
  Palette,
  Star,
  LifeBuoy,
  Gift,
  History,
  Bell,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) throw notFound();
    const { data } = await supabase
      .from("user_roles")
      .select("tenant_id")
      .eq("user_id", uid)
      .eq("role", "owner")
      .not("tenant_id", "is", null)
      .maybeSingle();
    if (!data?.tenant_id) throw notFound();
  },
  component: DashboardLayout,
});

const NAV = [
  { label: "نظرة عامة", to: "/dashboard", icon: LayoutDashboard },
  { label: "الطلبات", to: "/dashboard/orders", icon: ShoppingBag },
  { label: "المنيو", to: "/dashboard/menu", icon: UtensilsCrossed },
  { label: "الفروع", to: "/dashboard/branches", icon: Store },
  { label: "ثيم المطعم", to: "/dashboard/theme", icon: Palette },
  { label: "التقييمات", to: "/dashboard/reviews", icon: Star },
  { label: "المناديب", to: "/dashboard/drivers", icon: Bike },
  { label: "سجل تحويلات الطلبات", to: "/dashboard/drivers-history", icon: History },
  { label: "الكوبونات", to: "/dashboard/coupons", icon: Tag },
  { label: "نظام الولاء", to: "/dashboard/loyalty", icon: Gift },
  { label: "إرسال الإشعارات", to: "/dashboard/broadcast", icon: Bell },
  { label: "مناطق التوصيل", to: "/dashboard/zones", icon: Map },
  { label: "تسويات المناديب", to: "/dashboard/settlements", icon: Wallet },
  { label: "الإحصائيات", to: "/dashboard/reports", icon: BarChart3 },
  { label: "الدعم والبلاغات", to: "/dashboard/support", icon: LifeBuoy },
  { label: "الإعدادات", to: "/dashboard/settings", icon: Settings },
];

function DashboardLayout() {
  const { data: me, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        جاري التحميل...
      </div>
    );
  }

  return (
    <DashboardShell
      title="لوحة المطعم"
      subtitle="مطعم"
      nav={NAV}
      user={{ name: me?.profile?.full_name, email: me?.user.email }}
      headerExtra={<BranchSwitcher />}
    >
      <Outlet />
    </DashboardShell>
  );
}
