import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asaas } from "./asaas.server";
import { FBC_RE, FBP_RE, MARKETING_NOTICE_VERSION, normalizeEmail, sha256Hex } from "./meta-capi";

async function adminLibrary(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Apenas o administrador da biblioteca pode gerenciar a assinatura");
  const { data: libId } = await context.supabase.rpc("current_library_id");
  if (!libId) throw new Error("Biblioteca não encontrada");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lib } = await supabaseAdmin.from("libraries").select("*").eq("id", libId).single();
  if (!lib) throw new Error("Biblioteca não encontrada");
  return { lib, supabaseAdmin };
}

const marketingSchema = z.object({
  consent: z.enum(["granted", "denied"]).nullable(),
  fbp: z.string().regex(FBP_RE).nullable().optional(),
  fbc: z.string().regex(FBC_RE).nullable().optional(),
}).optional();

/** Stores consented attribution for this library's checkout. Never blocks billing. */
async function saveCheckoutAttribution(supabaseAdmin: any, context: any, libraryId: string, m: z.infer<typeof marketingSchema>) {
  try {
    if (!m?.consent) return;
    const { data: consent } = await supabaseAdmin.from("marketing_consent_records").insert({
      user_id: context.userId, choice: m.consent, notice_version: MARKETING_NOTICE_VERSION, source: "checkout",
    }).select("id").single();
    if (m.consent !== "granted" || !consent) return;
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const saved = context.claims?.user_metadata?.marketing_attribution;
    const email = typeof context.claims?.email === "string" ? context.claims.email : "";
    await supabaseAdmin.from("meta_checkout_attribution").insert({
      library_id: libraryId, user_id: context.userId, consent_record_id: consent.id,
      em_hash: email ? await sha256Hex(normalizeEmail(email)) : null,
      external_id_hash: await sha256Hex(context.userId),
      // Fallback: identifiers saved with consent at signup (e.g. email confirmed in another browser).
      fbp: m.fbp ?? (FBP_RE.test(saved?.fbp ?? "") ? saved.fbp : null),
      fbc: m.fbc ?? (FBC_RE.test(saved?.fbc ?? "") ? saved.fbc : null),
      client_ip: (getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "").slice(0, 64) || null,
      client_user_agent: (getRequestHeader("user-agent") ?? "").slice(0, 512) || null,
      event_source_url: "https://livronauta.app/plan",
    });
  } catch (e) {
    console.error("checkout attribution skipped", (e as Error)?.name);
  }
}

export const createAsaasSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      nome: z.string().trim().min(2).max(100),
      cpfCnpj: z.string().regex(/^\d{11}$|^\d{14}$/, "CPF/CNPJ inválido"),
      email: z.string().trim().email().max(255),
      marketing: marketingSchema,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { lib, supabaseAdmin } = await adminLibrary(context);
    if (lib.plan === "unlimited" || lib.complimentary_access) throw new Error("Esta biblioteca já possui acesso ilimitado gratuito");
    let customerId = lib.asaas_customer_id as string | null;
    if (!customerId) {
      const c = await asaas<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify({ name: data.nome, cpfCnpj: data.cpfCnpj, email: data.email, externalReference: lib.id }),
      });
      customerId = c.id;
    }
    if (lib.asaas_subscription_id && lib.subscription_status !== "canceled") {
      const pays = await asaas<{ data: any[] }>(`/subscriptions/${lib.asaas_subscription_id}/payments?status=PENDING`);
      const p = pays.data?.[0];
      if (p?.invoiceUrl) {
        await saveCheckoutAttribution(supabaseAdmin, context, lib.id, data.marketing);
        return { url: p.invoiceUrl as string, paymentId: String(p.id), value: Number(p.value) };
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    const sub = await asaas<{ id: string }>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId, billingType: "UNDEFINED", value: 14.99, nextDueDate: today, cycle: "MONTHLY",
        description: "Livronauta Pro — livros ilimitados", externalReference: lib.id,
      }),
    });
    await supabaseAdmin.from("libraries").update({
      asaas_customer_id: customerId, asaas_subscription_id: sub.id, subscription_status: "pending",
    }).eq("id", lib.id);
    const pays = await asaas<{ data: any[] }>(`/subscriptions/${sub.id}/payments`);
    const p = pays.data?.[0];
    const url = p?.invoiceUrl as string | undefined;
    if (!url) throw new Error("Cobrança criada, mas o link de pagamento ainda não está disponível. Tente novamente em instantes.");
    await saveCheckoutAttribution(supabaseAdmin, context, lib.id, data.marketing);
    return { url, paymentId: String(p.id), value: Number(p.value) };
  });

export const cancelAsaasSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { lib, supabaseAdmin } = await adminLibrary(context);
    if (!lib.asaas_subscription_id) throw new Error("Nenhuma assinatura ativa");
    if (lib.complimentary_access || lib.plan === "unlimited") throw new Error("Esta biblioteca possui acesso gratuito permanente");
    await asaas(`/subscriptions/${lib.asaas_subscription_id}`, { method: "DELETE" });
    await supabaseAdmin.from("libraries").update({
      subscription_status: "canceled",
      plan: lib.free_plan_grandfathered ? "free" : "pro",
      current_period_end: lib.free_plan_grandfathered ? null : lib.current_period_end,
    }).eq("id", lib.id);
    return { ok: true };
  });
