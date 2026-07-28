import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CreateTenantInput = {
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  phone?: string;
  address?: string;
  description?: string;
  logoUrl?: string;
  customDomain?: string;
  primary: string;
  accent: string;
  loyalty: boolean;
  wallet: boolean;
  credit: boolean;
  plan: string;
  status: string;
  monthlyFee: number;
  subscriptionExpiresAt?: string | null;
};

function cleanSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const createTenantWithOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CreateTenantInput) => {
    const slug = cleanSlug(data?.slug ?? "");
    if (!data?.name?.trim()) throw new Error("اسم المطعم مطلوب");
    if (!slug || slug.length < 2) throw new Error("اكتب Subdomain صالحاً من حرفين على الأقل");
    if (!data?.ownerName?.trim()) throw new Error("اسم صاحب الحساب مطلوب");
    if (!/^\S+@\S+\.\S+$/.test(data?.ownerEmail?.trim() ?? ""))
      throw new Error("بريد صاحب الحساب غير صحيح");
    if ((data?.ownerPassword ?? "").length < 8)
      throw new Error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    return {
      ...data,
      slug,
      ownerEmail: data.ownerEmail.trim().toLowerCase(),
      name: data.name.trim(),
      ownerName: data.ownerName.trim(),
    };
  })
  .handler(async ({ data, context }) => {
    const { data: adminRole } = await context.supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!adminRole) throw new Error("هذه العملية متاحة للمشرف فقط");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: data.name,
        slug: data.slug,
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        description: data.description?.trim() || null,
        logo_url: data.logoUrl?.trim() || null,
        custom_domain: data.customDomain?.trim() || null,
        theme_config: { primary: data.primary, accent: data.accent },
        features_enabled: { loyalty: data.loyalty, wallet: data.wallet, credit: data.credit },
        subscription_plan: data.plan,
        subscription_status: data.status,
        monthly_fee_iqd: Math.max(0, Math.floor(data.monthlyFee || 0)),
        subscription_expires_at: data.subscriptionExpiresAt || null,
        owner_email: data.ownerEmail,
        is_admin_provisioned: true,
      })
      .select("id, slug")
      .single();
    if (tenantError || !tenant) throw new Error(tenantError?.message || "تعذر إضافة المطعم");

    const { data: created, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: data.ownerEmail,
      password: data.ownerPassword,
      email_confirm: true,
      user_metadata: { full_name: data.ownerName },
    });
    if (userError || !created.user) {
      await supabaseAdmin.from("tenants").delete().eq("id", tenant.id);
      throw new Error(userError?.message || "تعذر إنشاء حساب صاحب المطعم");
    }

    const ownerId = created.user.id;
    const [{ error: profileError }, { error: roleError }, { error: branchError }] =
      await Promise.all([
        supabaseAdmin.from("profiles").upsert({
          id: ownerId,
          full_name: data.ownerName,
          phone: data.phone?.trim() || null,
          email: data.ownerEmail,
          tenant_id: tenant.id,
        }),
        supabaseAdmin
          .from("user_roles")
          .upsert(
            { user_id: ownerId, role: "owner", tenant_id: tenant.id },
            { onConflict: "user_id,role,tenant_id" },
          ),
        supabaseAdmin
          .from("branches")
          .insert({ tenant_id: tenant.id, name: "الفرع الرئيسي", slug: "main", is_active: true }),
      ]);
    if (profileError || roleError || branchError) {
      await supabaseAdmin.auth.admin.deleteUser(ownerId);
      await supabaseAdmin.from("tenants").delete().eq("id", tenant.id);
      throw new Error(
        profileError?.message ||
          roleError?.message ||
          branchError?.message ||
          "تعذر ربط صاحب الحساب بالمطعم",
      );
    }

    return {
      tenantId: tenant.id,
      slug: tenant.slug,
      ownerEmail: data.ownerEmail,
      ownerPassword: data.ownerPassword,
    };
  });
