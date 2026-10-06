import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requirePlatformAdmin(context: any) {
  const { data: allowed, error } = await context.supabase.rpc("is_platform_admin");
  if (error || !allowed) throw new Error("Acesso exclusivo do fundador");
  return import("@/integrations/supabase/client.server");
}

async function auditPlatformAction(supabaseAdmin: any, actorId: string, summary: string, rowId: string, diff?: unknown) {
  const { data: profile } = await supabaseAdmin.from("profiles").select("email, active_library_id").eq("id", actorId).maybeSingle();
  if (!profile?.active_library_id) return;
  await supabaseAdmin.from("audit_log").insert({
    actor_id: actorId,
    actor_email: profile.email,
    table_name: "platform_admin",
    operation: "ADMIN",
    row_id: rowId,
    summary,
    diff: diff ?? null,
    library_id: profile.active_library_id,
  });
}

export const listPlatformUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await requirePlatformAdmin(context);
    const [{ data: authData, error: authError }, { data: profiles }, { data: roles }, { data: libraries }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("profiles").select("id, nome, email, numero, telefone, data_cadastro, active_library_id"),
      supabaseAdmin.from("user_roles").select("user_id, role, library_id"),
      supabaseAdmin.from("libraries").select("id, nome, owner_id, plan, subscription_status, complimentary_access, complimentary_reason"),
    ]);
    if (authError) throw authError;
    const profileById = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
    const libraryById = new Map((libraries ?? []).map((library: any) => [library.id, library]));
    return authData.users.map((authUser) => {
      const profile: any = profileById.get(authUser.id);
      const memberships = (roles ?? []).filter((role: any) => role.user_id === authUser.id).map((role: any) => ({
        ...role,
        library: libraryById.get(role.library_id) ?? null,
      }));
      return {
        id: authUser.id,
        email: authUser.email ?? profile?.email ?? "",
        nome: profile?.nome ?? "",
        numero: profile?.numero ?? null,
        telefone: profile?.telefone ?? null,
        createdAt: authUser.created_at,
        memberships,
      };
    });
  });

export const sendUserPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await requirePlatformAdmin(context);
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (userError || !userData.user.email) throw new Error("Usuário ou e-mail não encontrado");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(userData.user.email, {
      redirectTo: "https://livronauta.app/auth?recovery=1",
    });
    if (error) throw error;
    await auditPlatformAction(supabaseAdmin, context.userId, "Recuperação de senha enviada", data.userId);
    return { ok: true };
  });

export const changePlatformUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid(), email: z.string().trim().email().max(255) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await requirePlatformAdmin(context);
    const { data: current, error: currentError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (currentError) throw currentError;
    const oldEmail = current.user.email ?? "";
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { email: data.email, email_confirm: true });
    if (error) throw error;
    await supabaseAdmin.from("profiles").update({ email: data.email }).eq("id", data.userId);
    await auditPlatformAction(supabaseAdmin, context.userId, "E-mail de acesso alterado", data.userId, { oldEmail, newEmail: data.email });
    return { ok: true };
  });

export const setPlatformUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    userId: z.string().uuid(),
    libraryId: z.string().uuid(),
    role: z.enum(["admin", "bibliotecario", "membro"]),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await requirePlatformAdmin(context);
    const { data: library } = await supabaseAdmin.from("libraries").select("owner_id").eq("id", data.libraryId).single();
    if (library?.owner_id === data.userId && data.role !== "admin") throw new Error("O titular da biblioteca deve permanecer administrador");
    const { error: deleteError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("library_id", data.libraryId);
    if (deleteError) throw deleteError;
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, library_id: data.libraryId, role: data.role });
    if (error) throw error;
    await auditPlatformAction(supabaseAdmin, context.userId, `Papel global alterado para ${data.role}`, data.userId, { libraryId: data.libraryId });
    return { ok: true };
  });

export const setComplimentaryAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ libraryId: z.string().uuid(), enabled: z.boolean(), reason: z.string().trim().max(300).optional() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await requirePlatformAdmin(context);
    const { data: library, error: libraryError } = await supabaseAdmin.from("libraries").select("asaas_subscription_id, complimentary_access").eq("id", data.libraryId).single();
    if (libraryError) throw libraryError;
    if (data.enabled && !data.reason) throw new Error("Informe o motivo da gratuidade");
    if (data.enabled && library.asaas_subscription_id) {
      const { asaas } = await import("./asaas.server");
      await asaas(`/subscriptions/${library.asaas_subscription_id}`, { method: "DELETE" });
    }
    const patch = data.enabled ? {
      complimentary_access: true,
      complimentary_reason: data.reason,
      complimentary_granted_by: context.userId,
      complimentary_granted_at: new Date().toISOString(),
      plan: "pro",
      subscription_status: "complimentary",
      asaas_subscription_id: null,
      current_period_end: null,
    } : {
      complimentary_access: false,
      complimentary_reason: null,
      complimentary_granted_by: null,
      complimentary_granted_at: null,
      plan: "pro",
      subscription_status: "pending",
      asaas_subscription_id: null,
      current_period_end: null,
    };
    const { error } = await supabaseAdmin.from("libraries").update(patch).eq("id", data.libraryId);
    if (error) throw error;
    await auditPlatformAction(supabaseAdmin, context.userId, data.enabled ? "Gratuidade concedida" : "Gratuidade revogada", data.libraryId, { reason: data.reason ?? null });
    return { ok: true };
  });