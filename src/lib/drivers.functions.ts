import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Generate a short random code (e.g. "R7K3M")
function genCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
function genPassword() {
  const s = Math.random().toString(36).slice(2, 8);
  return `d-${s}${Math.floor(Math.random() * 99)}`;
}

export const createDriverAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string; phone?: string }) => {
    if (!data?.name || data.name.length < 2) throw new Error("الاسم مطلوب");
    return data;
  })
  .handler(async ({ data, context }) => {
    // Get caller's tenant: prefer owner role, fall back to profile tenant_id
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("tenant_id, role")
      .eq("user_id", context.userId)
      .in("role", ["owner", "super_admin"]);
    let tenantId = roles?.find((r) => r.tenant_id)?.tenant_id ?? null;
    if (!tenantId) {
      const { data: prof } = await context.supabase
        .from("profiles").select("tenant_id").eq("id", context.userId).maybeSingle();
      tenantId = prof?.tenant_id ?? null;
    }
    if (!tenantId) throw new Error("ليس لديك صلاحية مطعم");


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const code = genCode();
    const password = genPassword();
    const email = `driver-${code.toLowerCase()}@drivers.tamrad.local`;

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.name, driver_code: code, tenant_id: tenantId },
    });
    if (cErr || !created?.user) throw new Error(cErr?.message || "تعذر إنشاء الحساب");

    const uid = created.user.id;

    // profiles insert (handle_new_user trigger will also try to insert; use upsert)
    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      full_name: data.name,
      phone: data.phone ?? null,
      tenant_id: tenantId,
    });

    // driver role
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: uid, role: "driver", tenant_id: tenantId },
      { onConflict: "user_id,role,tenant_id" },
    );

    // credentials record
    const { error: credErr } = await supabaseAdmin.from("driver_credentials").insert({
      tenant_id: tenantId,
      user_id: uid,
      code,
      driver_name: data.name,
      driver_phone: data.phone ?? null,
    });
    if (credErr) throw credErr;

    return { code, password, driver_name: data.name };
  });

export const resetDriverPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { driver_user_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("tenant_id").eq("user_id", context.userId).eq("role", "owner").limit(1);
    const tenantId = roles?.[0]?.tenant_id;
    if (!tenantId) throw new Error("ليس لديك صلاحية");

    // verify driver belongs to tenant
    const { data: cred } = await context.supabase
      .from("driver_credentials")
      .select("id, code, tenant_id")
      .eq("user_id", data.driver_user_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!cred) throw new Error("سائق غير موجود");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = genPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.driver_user_id, { password });
    if (error) throw error;
    return { code: cred.code, password };
  });

export const deleteDriverAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { driver_user_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("tenant_id").eq("user_id", context.userId).eq("role", "owner").limit(1);
    const tenantId = roles?.[0]?.tenant_id;
    if (!tenantId) throw new Error("ليس لديك صلاحية");

    const { data: cred } = await context.supabase
      .from("driver_credentials").select("id").eq("user_id", data.driver_user_id).eq("tenant_id", tenantId).maybeSingle();
    if (!cred) throw new Error("سائق غير موجود");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.auth.admin.deleteUser(data.driver_user_id);
    // FKs cascade the credentials + roles
    return { ok: true };
  });

// Public: driver signs in with code only — we rotate a temp password server-side
export const signInDriverByCode = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string }) => {
    if (!data?.code) throw new Error("الرمز مطلوب");
    return { code: data.code.trim().toUpperCase() };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("driver_credentials")
      .select("user_id, is_active")
      .eq("code", data.code)
      .maybeSingle();
    if (!row || !row.is_active) throw new Error("رمز غير صحيح");
    const password = `t-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, { password });
    if (error) throw new Error("تعذر تسجيل الدخول");
    return { email: `driver-${data.code.toLowerCase()}@drivers.tamrad.local`, password };
  });

