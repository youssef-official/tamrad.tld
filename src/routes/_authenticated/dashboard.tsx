import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DashboardShell } from "@/components/DashboardShell";
import { BranchSwitcher } from "@/components/BranchSwitcher";
import { useMe } from "@/lib/useMe";
import { ensureOwnerRestaurant } from "@/lib/owner-setup.functions";
import { LayoutDashboard, UtensilsCrossed, ShoppingBag, Settings, Store, Tag, Map, BarChart3, Wallet, Bike, Palette, Star, LifeBuoy, Gift, History, Bell } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
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
  { label: "التقارير", to: "/dashboard/reports", icon: BarChart3 },
  { label: "الدعم والبلاغات", to: "/dashboard/support", icon: LifeBuoy },
  { label: "الإعدادات", to: "/dashboard/settings", icon: Settings },
];

function DashboardLayout() {
  const queryClient = useQueryClient();
  const setupOwner = useServerFn(ensureOwnerRestaurant);
  const { data: me, isLoading } = useMe();

  const setup = useMutation({
    mutationFn: async () => setupOwner(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      await queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });

  useEffect(() => {
    if (isLoading || !me || me.tenantId || setup.isPending || setup.isSuccess || setup.isError) return;
    setup.mutate();
  }, [isLoading, me, setup]);

  if (isLoading || setup.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        جاري التحميل...
      </div>
    );
  }

  if (setup.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <div className="max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h1 className="text-xl font-bold">تعذر تجهيز لوحة المطعم</h1>
          <p className="mt-2 text-sm text-muted-foreground">{setup.error.message}</p>
          <button
            onClick={() => setup.mutate()}
            className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            حاول مجدداً
          </button>
        </div>
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
