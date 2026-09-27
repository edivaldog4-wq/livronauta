import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { z } from "zod";

const asaasEventSchema = z.object({
  event: z.string().max(100),
  payment: z.object({
    subscription: z.string().max(100).optional(),
    dueDate: z.string().max(20).optional(),
  }).passthrough().optional(),
  subscription: z.object({ id: z.string().max(100) }).passthrough().optional(),
}).passthrough();

function safeEq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["ASAAS_WEBHOOK_TOKEN"];
        const got = request.headers.get("asaas-access-token") ?? "";
        if (!expected || !safeEq(got, expected)) return new Response("Unauthorized", { status: 401 });

        const parsed = asaasEventSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid payload", { status: 400 });
        const body = parsed.data;
        const event = body.event;
        const subId = body.payment?.subscription ?? body.subscription?.id;
        if (!subId) return new Response("ignored");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: lib } = await supabaseAdmin.from("libraries").select("id, plan").eq("asaas_subscription_id", subId).maybeSingle();
        if (!lib || lib.plan === "unlimited") return new Response("ok");

        let patch: { plan?: string; subscription_status?: string; current_period_end?: string } | null = null;
        if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
          const due = body.payment?.dueDate ? new Date(body.payment.dueDate) : new Date();
          due.setMonth(due.getMonth() + 1);
          patch = { plan: "pro", subscription_status: "active", current_period_end: due.toISOString() };
        } else if (event === "PAYMENT_OVERDUE") {
          patch = { subscription_status: "overdue", current_period_end: body.payment?.dueDate ? new Date(body.payment.dueDate).toISOString() : new Date().toISOString() };
        } else if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED" || event === "PAYMENT_REFUNDED") {
          patch = { plan: "free", subscription_status: "canceled" };
        }
        if (patch) await supabaseAdmin.from("libraries").update(patch).eq("id", lib.id);
        return new Response("ok");
      },
    },
  },
});
