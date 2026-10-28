import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MARKETING_NOTICE_VERSION } from "./meta-capi";

/** Appends the signed-in visitor's advertising choice (evidence trail, withdrawal included). */
export const recordMarketingConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ choice: z.enum(["granted", "denied"]), source: z.enum(["banner", "signup"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: last } = await (supabaseAdmin as any).from("marketing_consent_records").select("choice")
      .eq("user_id", context.userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (last?.choice === data.choice) return { ok: true };
    const { error } = await (supabaseAdmin as any).from("marketing_consent_records").insert({
      user_id: context.userId, choice: data.choice, notice_version: MARKETING_NOTICE_VERSION, source: data.source,
    });
    if (error) throw new Error("Não foi possível registrar sua preferência");
    if (data.choice === "denied") {
      // Withdrawal applies immediately to queued server reports of this user.
      const { data: attrs } = await (supabaseAdmin as any).from("meta_checkout_attribution").select("id").eq("user_id", context.userId);
      const ids = (attrs ?? []).map((a: any) => a.id);
      if (ids.length) await (supabaseAdmin as any).from("meta_capi_events").update({ status: "blocked_consent" }).in("attribution_id", ids).in("status", ["pending", "failed"]);
    }
    return { ok: true };
  });

async function assertFounder(context: any) {
  const { data } = await context.supabase.rpc("is_platform_admin");
  if (!data) throw new Error("Acesso restrito ao fundador");
}

export const getMetaCapiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertFounder(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any).from("meta_capi_events").select("event_name,status,last_error,created_at").order("created_at", { ascending: false }).limit(200);
    const counts: Record<string, number> = {};
    for (const r of data ?? []) counts[`${r.event_name}:${r.status}`] = (counts[`${r.event_name}:${r.status}`] ?? 0) + 1;
    const lastError = (data ?? []).find((r: any) => r.last_error)?.last_error ?? null;
    return { counts, lastError, tokenConfigured: Boolean(process.env["META_CAPI_ACCESS_TOKEN"]) };
  });

export const retryMetaCapiEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertFounder(context);
    const { processMetaEvents } = await import("./meta-capi.server");
    return processMetaEvents(undefined, 50);
  });
