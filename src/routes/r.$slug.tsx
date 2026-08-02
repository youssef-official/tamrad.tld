import { createFileRoute, Link, notFound, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatIQD, useMe } from "@/lib/useMe";
import { fetchTenantWalletBalance } from "@/lib/walletBalance";
import { useEffect, useMemo, useState } from "react";
import {
  Minus,
  Plus,
  ShoppingCart,
  X,
  Store,
  MapPin,
  Check,
  Download,
  PlusCircle,
  Ticket,
  Wallet,
  Bell,
  Megaphone,
} from "lucide-react";
import { getTemplate, type Cart } from "@/lib/restaurantTemplates";
import { LoyaltyBadge } from "@/components/LoyaltyBadge";
import { subscribeToWebPush } from "@/lib/webPush";
import { StorefrontAuthDialog } from "@/components/StorefrontAuthDialog";
import { ModifierPicker, type PickedModifier } from "@/components/ModifierPicker";
import { useInstallPrompt } from "@/lib/pwa-install";
import { useAddresses, useAddressMutations } from "@/lib/useAddresses";
import { AddressFormDialog } from "@/components/AddressFormDialog";
import { InstallAppGate } from "@/components/InstallAppGate";
import { CustomerBottomNav } from "@/components/CustomerBottomNav";
import { toast } from "sonner";

type BranchLite = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const Route = createFileRoute("/r/$slug")({
  component: RestaurantPage,
  notFoundComponent: () => {
    const { slug } = Route.useParams();
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/40 px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Store className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-black text-foreground">هذا المطعم غير متاح</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            المطعم <span className="font-mono font-bold text-foreground">/{slug}</span> غير موجود،
            أو تم إيقافه مؤقتاً. جرّب التأكد من الرابط أو تواصل مع المطعم مباشرة.
          </p>
          <div className="mt-8">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90"
            >
              اكتشف مطاعم أخرى
            </Link>
          </div>
        </div>
      </div>
    );
  },
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <Store className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-black text-foreground">تعذّر تحميل هذه الصفحة</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          حدث خطأ أثناء تحميل صفحة المطعم. حاول تحديث الصفحة.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  ),
  head: ({ params }) => ({
    meta: [
      { title: "المطعم — تمراد" },
      { name: "description", content: "اطلب طعامك المفضل بسهولة." },
    ],
    links: [
      { rel: "manifest", href: `/api/public/manifest/${params.slug}` },
      { rel: "apple-touch-icon", href: `/api/public/icon/${params.slug}` },
    ],
  }),
});

export function RestaurantPage({ slugProp }: { slugProp?: string } = {}) {
  const routeParams = useParams({ strict: false }) as { slug?: string };
  const slug = slugProp ?? routeParams?.slug;
  const navigate = useNavigate();
  const [cart, setCart] = useState<Cart>({});
  const [showCart, setShowCart] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [phone, setPhone] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [notes, setNotes] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "wallet">("cash");

  const [branchId, setBranchId] = useState<string | null>(null);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const [pickerFor, setPickerFor] = useState<{ id: string; name: string; price: number } | null>(
    null,
  );
  const install = useInstallPrompt();

  const { data: me } = useMe();
  const isSignedIn = !!me?.user.id;
  const qc = useQueryClient();

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["tenant-public", slug],
    retry: false, // a missing tenant won't appear by retrying — fail fast to notFound
    queryFn: async () => {
      const { data: t } = await supabase
        .from("tenants")
        .select(
          "id, name, slug, description, logo_url, phone, address, theme_config, is_active, accepting_orders",
        )
        .or(`slug.eq.${slug},custom_domain.eq.${slug}`)
        .eq("is_active", true)
        .maybeSingle();
      if (!t) throw notFound();
      const [
        { data: cats },
        { data: items },
        { data: zones },
        { data: branches },
        { data: modGroups },
      ] = await Promise.all([
        supabase
          .from("menu_categories")
          .select("*")
          .eq("tenant_id", t.id)
          .eq("is_active", true)
          .order("sort_order"),
        supabase.from("menu_items").select("*").eq("tenant_id", t.id).eq("is_active", true),
        (supabase.from("delivery_zones") as any)
          .select("*")
          .eq("tenant_id", t.id)
          .eq("is_active", true)
          .order("sort_order"),
        (supabase.from("branches" as any) as any)
          .select(
            "id, name, slug, address, city, phone, is_active, latitude, longitude, theme, logo_url, cover_url, description",
          )
          .eq("tenant_id", t.id)
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
        (supabase.from("menu_modifier_groups") as any).select("menu_item_id").eq("tenant_id", t.id),
      ]);
      const itemsWithMods = new Set<string>(
        ((modGroups ?? []) as { menu_item_id: string }[]).map((g) => g.menu_item_id),
      );
      return {
        tenant: t as any,
        categories: cats ?? [],
        items: items ?? [],
        zones: (zones ?? []) as any[],
        branches: (branches ?? []) as BranchLite[],
        itemsWithMods,
      };
    },
  });

  // Customer's wallet balance AT THIS tenant (per-tenant, authoritative via RPC)
  const tenantId = data?.tenant.id;
  const { data: addresses = [] } = useAddresses(tenantId ?? null);
  const { create: createAddress } = useAddressMutations(tenantId ?? null);

  // The address query must be initialized before it is read. Keeping this
  // effect after useAddresses also prevents production minification from
  // exposing a temporal-dead-zone ReferenceError during the first render.
  useEffect(() => {
    if (!isSignedIn) {
      setSelectedAddressId(null);
      return;
    }
    if (addresses.length === 0) {
      setSelectedAddressId(null);
      return;
    }
    if (!selectedAddressId || !addresses.find((address) => address.id === selectedAddressId)) {
      const defaultAddress = addresses.find((address) => address.is_default) ?? addresses[0];
      setSelectedAddressId(defaultAddress.id);
      if (!phone && me?.profile?.phone) setPhone(me.profile.phone);
    }
  }, [isSignedIn, addresses, selectedAddressId, me?.profile?.phone, phone]);

  const selectedAddress = addresses.find((address) => address.id === selectedAddressId) ?? null;

  // Keep the wallet context tied to the restaurant the customer is browsing.
  // Account pages can then open that restaurant's wallet rather than a global total.
  useEffect(() => {
    if (!data?.tenant?.id || typeof window === "undefined") return;
    localStorage.setItem("tamrad:last-wallet-tenant", JSON.stringify({
      id: data.tenant.id,
      name: data.tenant.name,
      slug,
    }));
  }, [data?.tenant?.id, data?.tenant?.name, slug]);

  // Broadcast notifications sent by this restaurant to its customers
  const { data: broadcasts = [] } = useQuery({
    queryKey: ["storefront-broadcasts", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: rows } = await (supabase.from("broadcast_notifications") as any)
        .select("id, title, body, created_at")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(10);
      return (rows ?? []) as Array<{ id: string; title: string; body: string; created_at: string }>;
    },
  });

  const {
    data: walletBalance = null,
    isLoading: walletBalanceLoading,
    refetch: refetchWalletBalance,
  } = useQuery({
    queryKey: ["wallet-balance", tenantId, me?.user.id],
    queryFn: () => fetchTenantWalletBalance(supabase, tenantId!, me!.user.id),
    enabled: !!tenantId && !!me?.user.id,
    staleTime: 30_000,
  });

  const [broadcastReadAt, setBroadcastReadAt] = useState(0);
  const broadcastReadKey = `tamrad:broadcast-read:${tenantId}:${me?.user.id ?? "guest"}`;

  useEffect(() => {
    if (!tenantId || typeof window === "undefined") return;
    setBroadcastReadAt(Number(localStorage.getItem(broadcastReadKey) ?? 0));
  }, [tenantId, broadcastReadKey]);

  const unreadBroadcasts = broadcasts.filter((broadcast) =>
    new Date(broadcast.created_at).getTime() > broadcastReadAt,
  ).length;

  const openNotifications = () => {
    const seenAt = Date.now();
    setBroadcastReadAt(seenAt);
    if (typeof window !== "undefined") localStorage.setItem(broadcastReadKey, String(seenAt));
    setShowNotifications(true);
  };

  useEffect(() => {
    if (checkingOut && tenantId && me?.user.id) void refetchWalletBalance();
  }, [checkingOut, tenantId, me?.user.id, refetchWalletBalance]);

  const branches = data?.branches ?? [];
  const currentBranch = useMemo(
    () => branches.find((b) => b.id === branchId) ?? branches[0] ?? null,
    [branches, branchId],
  );

  // Pick initial branch: saved > geo nearest > first
  useEffect(() => {
    if (!data || branches.length === 0 || branchId) return;
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem(`tamrad:r-branch:${data.tenant.id}`)
        : null;
    if (saved && branches.find((b) => b.id === saved)) {
      setBranchId(saved);
      return;
    }
    if (branches.length === 1) {
      setBranchId(branches[0].id);
      return;
    }
    const withCoords = branches.filter((b) => b.latitude != null && b.longitude != null);
    if (withCoords.length === 0 || typeof navigator === "undefined" || !navigator.geolocation) {
      setBranchId(branches[0].id);
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const nearest = withCoords
          .map((b) => ({ b, d: haversineKm(me, { lat: b.latitude!, lng: b.longitude! }) }))
          .sort((a, z) => a.d - z.d)[0].b;
        setBranchId(nearest.id);
        setGeoBusy(false);
      },
      () => {
        setBranchId(branches[0].id);
        setGeoBusy(false);
      },
      { timeout: 5000, maximumAge: 60_000 },
    );
  }, [data, branches, branchId]);

  function selectBranch(id: string) {
    setBranchId(id);
    if (data) localStorage.setItem(`tamrad:r-branch:${data.tenant.id}`, id);
    setShowBranchPicker(false);
  }

  const tenantTheme =
    (data?.tenant.theme_config as {
      primary?: string;
      accent?: string;
      template?: string;
      cover_url?: string;
      content?: any;
    }) ?? {};
  const branchTheme =
    ((currentBranch as any)?.theme as { primary?: string; accent?: string } | null) ?? {};
  const primary = branchTheme.primary ?? tenantTheme.primary ?? "#ed6c35";
  const accent = branchTheme.accent ?? tenantTheme.accent ?? "#dce6d5";
  const coverUrl = tenantTheme.cover_url ?? null;
  const templateContent = tenantTheme.content ?? null;
  const template = getTemplate(tenantTheme.template);

  // Dynamic browser title, iOS home-screen app name, PWA manifest & icons
  useEffect(() => {
    if (data?.tenant && typeof document !== "undefined") {
      const { name, logo_url, slug: tenantSlug } = data.tenant;
      document.title = `${name} — اطلب أونلاين`;

      // Apple mobile web app title
      let metaApple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (!metaApple) {
        metaApple = document.createElement("meta");
        metaApple.setAttribute("name", "apple-mobile-web-app-title");
        document.head.appendChild(metaApple);
      }
      metaApple.setAttribute("content", name);

      // Theme color
      let metaTheme = document.querySelector('meta[name="theme-color"]');
      if (!metaTheme) {
        metaTheme = document.createElement("meta");
        metaTheme.setAttribute("name", "theme-color");
        document.head.appendChild(metaTheme);
      }
      metaTheme.setAttribute("content", primary);

      // Dynamic manifest link
      const manifestUrl = `/api/public/manifest/${tenantSlug}`;
      let linkManifest = document.querySelector('link[rel="manifest"]');
      if (!linkManifest) {
        linkManifest = document.createElement("link");
        linkManifest.setAttribute("rel", "manifest");
        document.head.appendChild(linkManifest);
      }
      linkManifest.setAttribute("href", manifestUrl);

      // Dynamic Apple Touch Icon
      const iconUrl = logo_url || `/api/public/icon/${tenantSlug}`;
      let linkAppleIcon = document.querySelector('link[rel="apple-touch-icon"]');
      if (!linkAppleIcon) {
        linkAppleIcon = document.createElement("link");
        linkAppleIcon.setAttribute("rel", "apple-touch-icon");
        document.head.appendChild(linkAppleIcon);
      }
      linkAppleIcon.setAttribute("href", iconUrl);

      // Dynamic Favicon
      let linkFavicon = document.querySelector('link[rel="icon"]');
      if (linkFavicon) {
        linkFavicon.setAttribute("href", iconUrl);
      }
    }
  }, [data?.tenant, primary]);

  const totals = useMemo(() => {
    const entries = Object.values(cart);
    return {
      subtotal: entries.reduce((s, x) => s + x.price * x.qty, 0),
      count: entries.reduce((s, x) => s + x.qty, 0),
    };
  }, [cart]);

  const zone = useMemo(() => {
    if (!selectedAddress?.latitude || !selectedAddress?.longitude) return null;
    return (
      data?.zones.find((candidate: any) => {
        if (candidate.shape_type === "polygon") {
          const points = candidate.polygon_points as Array<{ lat: number; lng: number }> | null;
          if (!points || points.length < 3) return false;
          let inside = false;
          for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const a = points[i];
            const b = points[j];
            if (
              a.lng > selectedAddress.longitude! !== b.lng > selectedAddress.longitude! &&
              selectedAddress.latitude! <
                ((b.lat - a.lat) * (selectedAddress.longitude! - a.lng)) / (b.lng - a.lng) + a.lat
            )
              inside = !inside;
          }
          return inside;
        }
        return (
          candidate.center_lat != null &&
          candidate.center_lng != null &&
          candidate.radius_km != null &&
          haversineKm(
            { lat: selectedAddress.latitude!, lng: selectedAddress.longitude! },
            { lat: candidate.center_lat, lng: candidate.center_lng },
          ) <= candidate.radius_km
        );
      }) ?? null
    );
  }, [data?.zones, selectedAddress]);
  const deliveryFee = zone?.fee_iqd ?? 0;
  const discount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (totals.subtotal < (appliedCoupon.min_order_iqd || 0)) return 0;
    return appliedCoupon.discount_type === "percent"
      ? Math.round((totals.subtotal * appliedCoupon.discount_value) / 100)
      : Math.min(appliedCoupon.discount_value, totals.subtotal);
  }, [appliedCoupon, totals.subtotal]);
  const grandTotal = Math.max(0, totals.subtotal - discount) + deliveryFee;
  const canPayWithWallet =
    !walletBalanceLoading && walletBalance != null && walletBalance > 0 && grandTotal > 0;
  // Partial application: any available balance is used, the rest is cash on delivery.
  const walletApplied =
    paymentMethod === "wallet" && walletBalance != null ? Math.min(walletBalance, grandTotal) : 0;
  const cashDue = grandTotal - walletApplied;

  // If the wallet option was selected but the balance is gone (e.g. spent in
  // another tab), fall back to cash silently.
  useEffect(() => {
    if (paymentMethod === "wallet" && !canPayWithWallet) setPaymentMethod("cash");
  }, [paymentMethod, canPayWithWallet]);

  async function applyCoupon() {
    setCouponError(null);
    if (!couponInput.trim() || !data) return;
    const { data: c } = await (supabase.from("coupons") as any)
      .select("*")
      .eq("tenant_id", data.tenant.id)
      .eq("code", couponInput.trim().toUpperCase())
      .eq("is_active", true)
      .maybeSingle();
    if (!c) {
      setCouponError("كوبون غير صالح");
      return;
    }
    if (c.expires_at && new Date(c.expires_at) < new Date()) {
      setCouponError("الكوبون منتهي");
      return;
    }
    if (c.usage_limit && c.used_count >= c.usage_limit) {
      setCouponError("تم استنفاذ الكوبون");
      return;
    }
    if (totals.subtotal < (c.min_order_iqd || 0)) {
      setCouponError(`الحد الأدنى ${c.min_order_iqd} د.ع`);
      return;
    }
    setAppliedCoupon(c);
  }

  function addItem(id: string, name: string, price: number) {
    if (!isSignedIn) {
      setShowLoginPrompt(true);
      return;
    }
    if (data?.itemsWithMods.has(id)) {
      setPickerFor({ id, name, price });
      return;
    }
    setCart((c) => ({ ...c, [id]: { name, price, qty: (c[id]?.qty ?? 0) + 1 } }));
  }

  function removeItem(id: string) {
    setCart((c) => {
      // Remove one qty from the FIRST variant (base or with-mods) that matches this base id
      const keys = Object.keys(c).filter((k) => k === id || k.startsWith(`${id}::`));
      if (keys.length === 0) return c;
      const key = keys[0];
      const cur = c[key];
      if (cur.qty <= 1) {
        const { [key]: _, ...rest } = c;
        return rest;
      }
      return { ...c, [key]: { ...cur, qty: cur.qty - 1 } };
    });
  }
  function addWithMods(baseId: string, name: string, finalPrice: number, mods: PickedModifier[]) {
    const modKey = mods
      .map((m) => m.option_id)
      .sort()
      .join(",");
    const key = modKey ? `${baseId}::${modKey}` : baseId;
    const label = mods.length > 0 ? `${name} (${mods.map((m) => m.option_name).join(", ")})` : name;
    setCart((c) => ({
      ...c,
      [key]: {
        name: label,
        price: finalPrice,
        qty: (c[key]?.qty ?? 0) + 1,
        modifiers: mods,
        baseItemId: baseId,
      } as any,
    }));
  }

  // Rehydrate cart from sessionStorage on re-order
  useEffect(() => {
    if (!data) return;
    try {
      const raw = sessionStorage.getItem(`tamrad:reorder:${data.tenant.id}`);
      if (!raw) return;
      const items = JSON.parse(raw) as Array<{
        name: string;
        qty: number;
        price: number;
        id?: string;
        modifiers?: PickedModifier[];
        baseItemId?: string;
      }>;
      const seeded: Cart = {};
      for (const it of items) {
        const baseId = it.baseItemId ?? it.id ?? it.name;
        const modKey = (it.modifiers ?? [])
          .map((m) => m.option_id)
          .sort()
          .join(",");
        const key = modKey ? `${baseId}::${modKey}` : baseId;
        seeded[key] = { name: it.name, price: it.price, qty: it.qty } as any;
        if (it.modifiers) (seeded[key] as any).modifiers = it.modifiers;
        if (it.baseItemId) (seeded[key] as any).baseItemId = it.baseItemId;
      }
      setCart(seeded);
      setShowCart(true);
      sessionStorage.removeItem(`tamrad:reorder:${data.tenant.id}`);
    } catch {
      /* ignore */
    }
  }, [data]);

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!data) return;
    if (!isSignedIn) {
      setShowLoginPrompt(true);
      return;
    }
    if (totals.count === 0) {
      setError("سلتك فارغة — أضف أصنافاً أولاً.");
      return;
    }
    if (!selectedAddress) {
      setError("اختر عنوان توصيل أو أضف واحداً جديداً.");
      return;
    }
    if (data.tenant.accepting_orders === false) {
      setError("المطعم لا يقبل طلبات جديدة حالياً.");
      return;
    }
    if (
      data.zones.length > 0 &&
      (selectedAddress.latitude == null || selectedAddress.longitude == null)
    ) {
      setError("فعّل GPS عند إضافة العنوان حتى نتحقق من منطقة التوصيل.");
      return;
    }
    if (data.zones.length > 0 && !zone) {
      setError("عنوانك خارج مناطق التوصيل المتاحة لهذا المطعم.");
      return;
    }
    if (branches.length > 0 && !currentBranch) {
      setError("اختر الفرع أولاً.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setSubmitting(false);
        setShowLoginPrompt(true);
        return;
      }
      const savedPhone = phone.trim();
      if (savedPhone) {
        const { error: phoneError } = await supabase
          .from("tenant_customers" as any)
          .upsert(
            {
              tenant_id: data.tenant.id,
              user_id: u.user.id,
              full_name: me?.profile?.full_name ?? null,
              phone: savedPhone,
              email: u.user.email ?? null,
            },
            { onConflict: "tenant_id,user_id" },
          );
        if (phoneError) throw phoneError;
      }
      const items = Object.entries(cart).map(([key, v]) => {
        const anyV = v as any;
        return {
          id: anyV.baseItemId ?? key.split("::")[0],
          name: v.name,
          qty: v.qty,
          price: v.price,
          modifiers: anyV.modifiers ?? [],
          baseItemId: anyV.baseItemId,
        };
      });
      const orderNumber = `${Date.now().toString().slice(-6)}`;
      const insertPayload: any = {
        tenant_id: data.tenant.id,
        customer_id: u.user.id,
        order_number: orderNumber,
        total_iqd: grandTotal,
        items,
        customer_phone: savedPhone,
        customer_address: [
          selectedAddress?.label,
          selectedAddress?.full_address,
          selectedAddress?.city,
          selectedAddress?.notes,
        ]
          .filter(Boolean)
          .join(" — "),
        notes: notes || null,
        payment_method: paymentMethod,
        discount_iqd: discount,
        delivery_fee_iqd: deliveryFee,
        coupon_code: appliedCoupon?.code ?? null,
        zone_id: zone?.id ?? null,
        delivery_lat: selectedAddress.latitude,
        delivery_lng: selectedAddress.longitude,
        branch_id: currentBranch?.id ?? null,
      };
      const { data: created, error: err } = await supabase
        .from("orders")
        .insert(insertPayload)
        .select("id")
        .single();
      if (err) throw err;

      // Wallet payment: debit atomically on the DB. If it fails for any reason
      // (e.g. balance dropped between render and submit), fall back to cash so the
      // order is still placed, and tell the customer.
      if (paymentMethod === "wallet") {
        const { error: payErr } = await (supabase.rpc as any)("pay_order_with_wallet", {
          p_order_id: created.id,
        });
        if (payErr) {
          await supabase.from("orders").update({ payment_method: "cash" }).eq("id", created.id);
          const msg = payErr.message ?? "";
          if (msg.includes("INSUFFICIENT_BALANCE")) {
            toast.error(
              "رصيد محفظتك في هذا المطعم غير كافٍ لخصم أي مبلغ — سيتم الدفع نقداً عند الاستلام.",
            );
          } else if (msg.includes("Could not find the function") || msg.includes("PGRST202")) {
            toast.error(
              "الدفع من المحفظة غير مفعّل على الخادم بعد — سيتم الدفع نقداً عند الاستلام.",
            );
          } else {
            toast.error("تعذّر الدفع من المحفظة — سيتم الدفع نقداً عند الاستلام.");
          }
        }
        qc.invalidateQueries({ queryKey: ["wallet-balance", data.tenant.id, u.user.id] });
      }

      // Bump coupon usage (best-effort)
      if (appliedCoupon) {
        await (supabase.from("coupons") as any)
          .update({ used_count: (appliedCoupon.used_count || 0) + 1 })
          .eq("id", appliedCoupon.id);
      }
      setCart({});
      setShowCart(false);
      setCheckingOut(false);
      navigate({ to: "/orders/$id", params: { id: created.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-register the signed-in visitor as a customer OF THIS restaurant
  // (per-tenant membership: restaurant A's customers are separate from B's).
  useEffect(() => {
    if (!isSignedIn || !data?.tenant?.id) return;
    const key = `tamrad:member:${data.tenant.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    void (supabase.rpc as any)("ensure_customer_membership", { _tenant_id: data.tenant.id });
  }, [isSignedIn, data?.tenant?.id]);

  // Let the router render notFoundComponent / errorComponent instead of
  // hanging on "جاري التحميل..." forever (e.g. unknown slug).
  if (queryError) throw queryError;

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        جاري التحميل...
      </div>
    );
  }

  const Tpl = template.Component;
  const notAccepting = data.tenant.accepting_orders === false;

  return (
    <InstallAppGate name={data.tenant.name} logoUrl={data.tenant.logo_url} primary={primary}>
      <Tpl
        tenant={data.tenant as any}
        categories={data.categories as any}
        items={data.items as any}
        cart={cart}
        primary={primary}
        accent={accent}
        coverUrl={coverUrl}
        content={templateContent}
        addItem={addItem}
        removeItem={removeItem}
      />

      {pickerFor && (
        <ModifierPicker
          itemId={pickerFor.id}
          itemName={pickerFor.name}
          basePrice={pickerFor.price}
          primary={primary}
          onCancel={() => setPickerFor(null)}
          onConfirm={(picks, finalPrice) => {
            addWithMods(pickerFor.id, pickerFor.name, finalPrice, picks);
            setPickerFor(null);
          }}
        />
      )}

      {/* Top Floating Notification Bell */}
      {(broadcasts.length > 0 || isSignedIn) && (
        <button
          onClick={openNotifications}
          className="fixed top-4 left-4 z-30 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold shadow transition hover:scale-105"
          style={{ color: primary, top: "calc(1rem + env(safe-area-inset-top))" }}
        >
          <Bell className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
          <span className="hidden sm:inline">إشعارات المطعم</span>
          {unreadBroadcasts > 0 && (
            <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-white">
              {unreadBroadcasts}
            </span>
          )}
        </button>
      )}

      {/* Notifications Modal */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
          onClick={() => setShowNotifications(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <button onClick={() => setShowNotifications(false)}>
                <X className="h-5 w-5 text-neutral-500" />
              </button>
              <h3 className="flex items-center gap-2 text-lg font-black text-neutral-900">
                <Bell className="h-5 w-5" style={{ color: primary }} />
                إشعارات وعروض {data.tenant.name}
              </h3>
            </div>

            <div className="space-y-3">
              {broadcasts.map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl border border-neutral-100 bg-neutral-50/80 p-4 text-right shadow-sm"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400" dir="ltr">
                      {new Date(b.created_at).toLocaleDateString("ar-IQ")}
                    </span>
                    <span className="font-black text-sm text-neutral-900">{b.title}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-neutral-600 whitespace-pre-wrap">
                    {b.body}
                  </p>
                </div>
              ))}
            </div>

            {isSignedIn && (
              <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <button
                  onClick={async () => {
                    if (!me?.user.id) return;
                    setPushBusy(true);
                    const result = await subscribeToWebPush(me.user.id);
                    setPushMessage(result.message);
                    setPushBusy(false);
                  }}
                  disabled={pushBusy}
                  className="w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: primary }}
                >{pushBusy ? "جاري التفعيل..." : "تفعيل إشعارات خارج التطبيق"}</button>
                {pushMessage && <p className="mt-2 text-center text-xs text-neutral-500">{pushMessage}</p>}
              </div>
            )}

            <button
              onClick={() => setShowNotifications(false)}
              className="mt-6 w-full rounded-xl py-3 text-sm font-bold text-white shadow"
              style={{ background: primary }}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {branches.length > 0 && (
        <button
          onClick={() => setShowBranchPicker(true)}
          className="fixed top-4 right-4 z-30 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold shadow"
          style={{ color: primary, top: "calc(1rem + env(safe-area-inset-top))" }}
        >
          <Store className="h-3.5 w-3.5" />
          <span className="max-w-[140px] truncate">
            {geoBusy ? "جاري تحديد أقرب فرع…" : (currentBranch?.name ?? "اختر فرعاً")}
          </span>
          {branches.length > 1 && <span className="opacity-60">تبديل ▾</span>}
        </button>
      )}

      {showBranchPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
          onClick={() => setShowBranchPicker(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <button onClick={() => setShowBranchPicker(false)}>
                <X className="h-5 w-5" />
              </button>
              <h3 className="flex items-center gap-2 text-lg font-black">
                <MapPin className="h-4 w-4" style={{ color: primary }} />
                اختر الفرع
              </h3>
            </div>
            <ul className="space-y-2">
              {branches.map((b) => {
                const active = currentBranch?.id === b.id;
                return (
                  <li key={b.id}>
                    <button
                      onClick={() => selectBranch(b.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-right transition-colors ${
                        active ? "border-transparent" : "border-neutral-200 hover:bg-neutral-50"
                      }`}
                      style={active ? { background: primary, color: "white" } : undefined}
                    >
                      <div className="shrink-0">
                        {active ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <Store className="h-5 w-5 opacity-40" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold">{b.name}</div>
                        <div className={`text-xs ${active ? "opacity-80" : "text-neutral-500"}`}>
                          {[b.city, b.address].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-center text-[11px] text-neutral-400">
              يتم اختيار أقرب فرع تلقائياً عند السماح بالموقع.
            </p>
          </div>
        </div>
      )}

      {totals.count > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl px-6 py-3.5 font-bold text-white shadow-2xl transition-transform hover:scale-105"
          style={{
            background: primary,
            bottom: isSignedIn
              ? "calc(5.5rem + env(safe-area-inset-bottom))"
              : "calc(1.5rem + env(safe-area-inset-bottom))",
          }}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-black"
            style={{ background: accent, color: primary }}
          >
            {totals.count}
          </span>
          <span>عرض السلة</span>
          <span>· {formatIQD(totals.subtotal)}</span>
        </button>
      )}

      {showCart && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCart(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <button onClick={() => setShowCart(false)}>
                <X className="h-5 w-5" />
              </button>
              <h2 className="flex items-center gap-2 text-xl font-black">
                <ShoppingCart className="h-5 w-5" style={{ color: primary }} />
                سلتك
              </h2>
            </div>

            {install.canInstall && !install.installed && (
              <button
                onClick={install.install}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-bold"
                style={{ borderColor: primary + "60", color: primary, background: primary + "0d" }}
              >
                <Download className="h-4 w-4" /> ثبّت تطبيق {data.tenant.name} على جهازك
              </button>
            )}

            <div className="mb-3">
              <LoyaltyBadge tenantId={data.tenant.id} primary={primary} />
            </div>

            {!checkingOut ? (
              <>
                <ul className="mb-4 space-y-2">
                  {Object.entries(cart).map(([id, it]) => (
                    <li
                      key={id}
                      className="flex items-center gap-3 rounded-xl border border-neutral-200 p-3"
                    >
                      <div
                        className="flex items-center gap-1 rounded-full p-1"
                        style={{ background: primary }}
                      >
                        <button
                          onClick={() => addItem(id, it.name, it.price)}
                          className="rounded-full p-1 text-white"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[1.5rem] text-center text-sm font-bold text-white">
                          {it.qty}
                        </span>
                        <button
                          onClick={() => removeItem(id)}
                          className="rounded-full p-1 text-white"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex-1 text-right">
                        <div className="font-bold">{it.name}</div>
                        <div className="text-xs text-neutral-500">
                          {formatIQD(it.price * it.qty)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mb-4 flex items-center justify-between border-t pt-4">
                  <span className="text-2xl font-black" style={{ color: primary }}>
                    {formatIQD(totals.subtotal)}
                  </span>
                  <span className="text-sm font-bold text-neutral-500">المجموع</span>
                </div>
                <button
                  onClick={() => setCheckingOut(true)}
                  className="w-full rounded-xl py-3 font-bold text-white"
                  style={{ background: primary }}
                >
                  متابعة الطلب ←
                </button>
              </>
            ) : (
              <form onSubmit={placeOrder} className="space-y-3">
                {notAccepting && (
                  <div className="rounded-xl bg-destructive/10 p-3 text-sm font-bold text-destructive">
                    عذراً، المطعم أوقف استقبال الطلبات مؤقتاً.
                  </div>
                )}
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">رقم الهاتف *</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    dir="ltr"
                    className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </label>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-bold">عنوان التوصيل *</span>
                    <button
                      type="button"
                      onClick={() => setShowAddressForm(true)}
                      className="flex items-center gap-1 text-xs font-bold"
                      style={{ color: primary }}
                    >
                      <PlusCircle className="h-3.5 w-3.5" /> إضافة عنوان
                    </button>
                  </div>
                  {addresses.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowAddressForm(true)}
                      className="w-full rounded-xl border-2 border-dashed border-neutral-300 py-4 text-sm font-bold text-neutral-500 hover:border-primary hover:text-primary"
                    >
                      + أضف عنوان توصيلك الأول
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {addresses.map((a) => {
                        const active = selectedAddressId === a.id;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setSelectedAddressId(a.id)}
                            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-right transition ${
                              active
                                ? "border-transparent text-white"
                                : "border-neutral-200 hover:bg-neutral-50"
                            }`}
                            style={active ? { background: primary } : undefined}
                          >
                            <div className="shrink-0 pt-0.5">
                              {active ? (
                                <Check className="h-5 w-5" />
                              ) : (
                                <MapPin className="h-5 w-5 opacity-40" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-bold">
                                {a.label}
                                {a.is_default && !active && (
                                  <span className="mr-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                                    افتراضي
                                  </span>
                                )}
                              </div>
                              <div
                                className={`text-xs ${active ? "opacity-90" : "text-neutral-500"}`}
                              >
                                {a.full_address}
                                {a.city ? ` · ${a.city}` : ""}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {data.zones.length > 0 && (
                  <div
                    className={`rounded-xl border p-3 text-sm ${zone ? "border-green-500/30 bg-green-50" : "border-amber-500/30 bg-amber-50"}`}
                  >
                    <div className="font-bold">
                      {zone ? `منطقة التوصيل: ${zone.name}` : "تحقق من منطقة التوصيل"}
                    </div>
                    <div className="mt-1 text-xs text-neutral-600">
                      {zone
                        ? zone.fee_iqd === 0
                          ? "التوصيل مجاني لهذا العنوان"
                          : `رسوم التوصيل: ${formatIQD(zone.fee_iqd)}`
                        : "اختر عنواناً محفوظاً بموقع GPS أو أضف عنواناً جديداً ثم فعّل موقعك."}
                    </div>
                  </div>
                )}

                <div>
                  <span className="mb-1 flex items-center gap-1.5 text-sm font-bold">
                    <Ticket className="h-4 w-4" style={{ color: primary }} />
                    عندك كوبون أو بطاقة هدايا؟ (اختياري)
                  </span>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between rounded-xl border border-green-500/40 bg-green-50 p-3 text-sm">
                      <span>
                        ✓ <b className="font-mono">{appliedCoupon.code}</b> —{" "}
                        {appliedCoupon.discount_type === "percent"
                          ? `${appliedCoupon.discount_value}%`
                          : formatIQD(appliedCoupon.discount_value)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedCoupon(null);
                          setCouponInput("");
                        }}
                        className="text-xs text-destructive"
                      >
                        إزالة
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        placeholder="WELCOME10"
                        className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 font-mono text-sm outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={applyCoupon}
                        className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-bold hover:bg-neutral-50"
                      >
                        تطبيق
                      </button>
                    </div>
                  )}
                  {couponError && (
                    <div className="mt-1 text-xs text-destructive">{couponError}</div>
                  )}
                </div>

                <label className="block">
                  <span className="mb-1 block text-sm font-bold">ملاحظات (اختياري)</span>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </label>

                {isSignedIn && (
                  <div>
                    <span className="mb-1.5 block text-sm font-bold">طريقة الدفع</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cash")}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-3 text-sm font-bold transition ${
                          paymentMethod === "cash"
                            ? "border-primary bg-primary/5"
                            : "border-neutral-200 bg-white hover:border-neutral-300"
                        }`}
                      >
                        <span>نقداً (كاش)</span>
                        {paymentMethod === "cash" && (
                          <Check className="h-4 w-4" style={{ color: primary }} />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={!canPayWithWallet}
                        onClick={() => canPayWithWallet && setPaymentMethod("wallet")}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-3 text-sm font-bold transition ${
                          paymentMethod === "wallet"
                            ? "border-primary bg-primary/5"
                            : canPayWithWallet
                              ? "border-neutral-200 bg-white hover:border-neutral-300"
                              : "border-neutral-200 bg-neutral-50 text-neutral-400"
                        }`}
                        title={
                          walletBalanceLoading
                            ? "جاري تحميل رصيد المحفظة…"
                            : !canPayWithWallet
                              ? walletBalance != null && walletBalance <= 0
                                ? "لا يوجد رصيد في محفظتك لهذا المطعم (الرصيد مرتبط بكل مطعم على حدة)"
                                : "لا يوجد رصيد متاح في المحفظة"
                              : undefined
                        }
                      >
                        <Wallet className="h-4 w-4" />
                        <span>المحفظة</span>
                        {paymentMethod === "wallet" && (
                          <Check className="h-4 w-4" style={{ color: primary }} />
                        )}
                      </button>
                    </div>
                    {walletBalanceLoading ? (
                      <p className="mt-1.5 text-xs text-neutral-400">
                        جاري تحميل رصيد محفظتك لهذا المطعم…
                      </p>
                    ) : walletBalance == null ? null : paymentMethod === "wallet" ? (
                      cashDue > 0 ? (
                        <p className="mt-1.5 text-xs text-neutral-500">
                          سيُخصم {formatIQD(walletApplied)} من محفظتك — والباقي {formatIQD(cashDue)}{" "}
                          نقداً عند الاستلام.
                        </p>
                      ) : (
                        <p className="mt-1.5 text-xs text-neutral-500">
                          رصيدك يغطي الطلب بالكامل — لن تدفع شيئاً عند الاستلام.
                        </p>
                      )
                    ) : walletBalance > 0 ? (
                      <p className="mt-1.5 text-xs text-neutral-500">
                        رصيدك في هذا المطعم: {formatIQD(walletBalance)}
                        {walletBalance < grandTotal &&
                          " — سيُخصم من طلبك والباقي نقداً عند الاستلام"}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs text-neutral-400">
                        لا يوجد رصيد في محفظتك لهذا المطعم بعد.
                      </p>
                    )}
                  </div>
                )}

                {error && (
                  <div className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="space-y-1 border-t pt-3 text-sm">
                  <Row label="السلة" value={formatIQD(totals.subtotal)} />
                  {discount > 0 && (
                    <Row label="الخصم" value={`- ${formatIQD(discount)}`} color="text-green-600" />
                  )}
                  {deliveryFee > 0 && <Row label="التوصيل" value={formatIQD(deliveryFee)} />}
                  {walletApplied > 0 && (
                    <Row
                      label="من المحفظة"
                      value={`- ${formatIQD(walletApplied)}`}
                      color="text-green-600"
                    />
                  )}
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-xl font-black" style={{ color: primary }}>
                      {formatIQD(paymentMethod === "wallet" ? cashDue : grandTotal)}
                    </span>
                    <span className="text-sm font-bold">
                      {paymentMethod === "wallet"
                        ? cashDue > 0
                          ? `يدفع نقداً (الإجمالي ${formatIQD(grandTotal)})`
                          : "الإجمالي (محفظة)"
                        : "الإجمالي (نقداً)"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCheckingOut(false)}
                    className="flex-1 rounded-xl border py-3 font-bold"
                  >
                    رجوع
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || notAccepting}
                    className="flex-1 rounded-xl py-3 font-bold text-white disabled:opacity-60"
                    style={{ background: primary }}
                  >
                    {submitting ? "..." : "تأكيد الطلب"}
                  </button>
                </div>
                <p className="text-center text-xs text-neutral-500">
                  * يتطلب تسجيل الدخول لإرسال الطلب
                </p>
              </form>
            )}
          </div>
        </div>
      )}

      <AddressFormDialog
        open={showAddressForm}
        onClose={() => setShowAddressForm(false)}
        onSubmit={async (input) => {
          try {
            if (!isSignedIn) {
              setShowAddressForm(false);
              setShowLoginPrompt(true);
              return;
            }
            const created = await createAddress.mutateAsync(input);
            setSelectedAddressId(created.id);
            setShowAddressForm(false);
            toast.success("تم حفظ العنوان");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "خطأ");
          }
        }}
        saving={createAddress.isPending}
      />

      <StorefrontAuthDialog
        open={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
        name={data.tenant.name}
        logoUrl={data.tenant.logo_url}
        primary={primary}
        tenantId={data.tenant.id}
      />

      {isSignedIn && <CustomerBottomNav storefrontSlug={slug} primary={primary} />}
    </InstallAppGate>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`font-bold ${color ?? ""}`}>{value}</span>
      <span className="text-neutral-500">{label}</span>
    </div>
  );
}
