import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asaas } from "./asaas.server";

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

export const createAsaasSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      nome: z.string().trim().min(2).max(100),
      cpfCnpj: z.string().regex(/^\d{11}$|^\d{14}$/, "CPF/CNPJ inválido"),
      email: z.string().trim().email().max(255),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { lib, supabaseAdmin } = await adminLibrary(context);
    if (lib.plan === "unlimited") throw new Error("Esta biblioteca já é ilimitada");
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
      if (pays.data?.[0]?.invoiceUrl) return { url: pays.data[0].invoiceUrl as string };
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
    const url = pays.data?.[0]?.invoiceUrl as string | undefined;
    if (!url) throw new Error("Cobrança criada, mas o link de pagamento ainda não está disponível. Tente novamente em instantes.");
    return { url };
  });

export const cancelAsaasSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { lib, supabaseAdmin } = await adminLibrary(context);
    if (!lib.asaas_subscription_id) throw new Error("Nenhuma assinatura ativa");
    await asaas(`/subscriptions/${lib.asaas_subscription_id}`, { method: "DELETE" });
    await supabaseAdmin.from("libraries").update({
      subscription_status: "canceled",
      plan: lib.free_plan_grandfathered ? "free" : "pro",
      current_period_end: lib.free_plan_grandfathered ? null : lib.current_period_end,
    }).eq("id", lib.id);
    return { ok: true };
  });
