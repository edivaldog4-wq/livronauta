import { deliverEvent, PIXEL_RE, MARKETING_NOTICE_VERSION, type Attribution, type CapiEvent } from "./meta-capi";
import { asaas } from "./asaas.server";

/** Claims pending/failed events atomically and delivers them. Never throws. */
export async function processMetaEvents(ids?: string[], limit = 25) {
  const summary: Record<string, number> = {};
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: claimed, error } = await db.rpc("claim_meta_capi_events", { _ids: ids ?? null, _limit: limit });
    if (error) { console.error("meta capi claim failed", error.code); return summary; }
    if (!claimed?.length) return summary;
    const { data: setting } = await db.from("platform_settings").select("value").eq("key", "meta_pixel_id").maybeSingle();
    const pixelId = PIXEL_RE.test(setting?.value ?? "") ? setting.value : undefined;
    for (const ev of claimed as (CapiEvent & { attribution_id: string | null; library_id: string })[]) {
      const outcome = await deliverEvent(ev, {
        fetch,
        token: process.env["META_CAPI_ACCESS_TOKEN"],
        testEventCode: process.env["META_CAPI_TEST_EVENT_CODE"] || undefined,
        pixelId,
        attribution: async (e) => {
          const attrId = (e as any).attribution_id;
          if (!attrId) return null;
          const { data: a } = await db.from("meta_checkout_attribution")
            .select("*, consent:marketing_consent_records(choice)").eq("id", attrId).eq("library_id", ev.library_id).maybeSingle();
          if (!a) return null;
          return { ...a, consent_granted: a.consent?.choice === "granted" } as Attribution;
        },
        latestConsentGranted: async (userId) => {
          const { data } = await db.from("marketing_consent_records").select("choice,notice_version").eq("user_id", userId)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          return data?.choice === "granted" && data?.notice_version === MARKETING_NOTICE_VERSION;
        },
        customerPayments: async (customerId) => {
          const payments: any[] = [];
          for (let offset = 0; offset < 10000; offset += 100) {
            const r = await asaas<{ data: any[]; hasMore: boolean }>(`/payments?customer=${encodeURIComponent(customerId)}&limit=100&offset=${offset}`);
            if (!Array.isArray(r.data) || typeof r.hasMore !== "boolean") throw new Error("incomplete_history");
            payments.push(...r.data);
            if (!r.hasMore) return payments;
            if (!r.data.length) throw new Error("incomplete_history");
          }
          throw new Error("history_limit_exceeded");
        },
      });
      summary[outcome.status] = (summary[outcome.status] ?? 0) + 1;
      const patch: Record<string, unknown> = { status: outcome.status, last_error: outcome.error ?? null };
      if (outcome.status === "sent") patch.sent_at = new Date().toISOString();
      if (outcome.status === "skipped_existing_customer") patch.history_verified = true;
      await db.from("meta_capi_events").update(patch).eq("id", ev.id).eq("status", "sending");
      if (outcome.error) console.warn("meta capi", ev.event_name, outcome.status, outcome.error);
    }
  } catch (e) {
    console.error("meta capi processing error", (e as Error)?.name);
  }
  return summary;
}
