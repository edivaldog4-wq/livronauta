// Pure Meta Conversions API rules (no secrets, no I/O). Shared by server code and tests.
export const META_GRAPH_VERSION = "v26.0";
export const MARKETING_NOTICE_VERSION = "2026-10-28";
export const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const PAID_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const PAID_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

export const FBP_RE = /^fb\.[0-2]\.\d{10,16}\.\d{1,20}$/;
export const FBC_RE = /^fb\.[0-2]\.\d{10,16}\.[A-Za-z0-9_-]{10,400}$/;
export const PIXEL_RE = /^\d{8,20}$/;

/** Extracts a genuinely paid payment from an authenticated Asaas webhook body, or null. */
/** Asaas date-only fields are interpreted at the start of their calendar day in Brazil.
 * Precision is limited by the provider; never replace the payment date with the retry time.
 */
export function paymentTimestamp(p: Record<string, unknown>): string | null {
  for (const key of ["clientPaymentDate", "confirmedDate", "paymentDate"]) {
    const value = p[key];
    if (typeof value !== "string") continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) continue;
    const date = new Date(`${value}T00:00:00-03:00`);
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value) return date.toISOString();
  }
  return null;
}

export function extractPaidPayment(body: any): { id: string; value: number; paidAt: string } | null {
  if (!body || !PAID_EVENTS.has(body.event)) return null;
  const p = body.payment;
  if (!p || typeof p.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(p.id)) return null;
  if (!PAID_STATUSES.has(p.status) || p.deleted === true) return null;
  const value = Number(p.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  const paidAt = paymentTimestamp(p);
  if (!paidAt) return null;
  return { id: p.id, value: Math.round(value * 100) / 100, paidAt };
}

/** Missing or same-day ambiguous history fails closed rather than reporting an existing subscriber as new. */
export type HistoricalPayment = { id?: string; status?: string; clientPaymentDate?: string; confirmedDate?: string; paymentDate?: string };
export function hasEarlierPaidPayment(payments: HistoricalPayment[], currentId: string, paidAt: string) {
  const current = Date.parse(paidAt);
  if (!Number.isFinite(current)) throw new Error("history_unverified: invalid current date");
  return payments.some((p) => {
    if (p.id === currentId || !PAID_STATUSES.has(p.status ?? "")) return false;
    const date = paymentTimestamp(p);
    if (!date) throw new Error("history_unverified: missing paid date");
    return Date.parse(date) <= current;
  });
}

export async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export type CapiEvent = {
  id: string; event_name: "Purchase" | "Subscribe" | string; event_id: string; value: number; currency: string;
  event_time: string; environment: string; history_verified: boolean; asaas_payment_id: string; asaas_customer_id: string | null;
};
export type Attribution = {
  em_hash: string | null; external_id_hash: string | null; fbp: string | null; fbc: string | null;
  client_ip: string | null; client_user_agent: string | null; event_source_url: string; user_id: string; consent_granted: boolean;
};

export function buildPayload(event: CapiEvent, attr: Attribution, testEventCode?: string) {
  const user_data: Record<string, unknown> = {};
  if (attr.client_user_agent) user_data.client_user_agent = attr.client_user_agent;
  if (attr.client_ip) user_data.client_ip_address = attr.client_ip;
  if (attr.fbp) user_data.fbp = attr.fbp;
  if (attr.fbc) user_data.fbc = attr.fbc;
  if (attr.em_hash) user_data.em = [attr.em_hash];
  if (attr.external_id_hash) user_data.external_id = [attr.external_id_hash];
  return {
    data: [{
      event_name: event.event_name,
      event_time: Math.floor(new Date(event.event_time).getTime() / 1000),
      event_id: event.event_id,
      action_source: "website",
      event_source_url: attr.event_source_url,
      user_data,
      custom_data: { value: Number(event.value), currency: event.currency, content_name: "Livronauta Pro" },
    }],
    partner_agent: "lovable",
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };
}

export type Outcome = { status: string; error?: string };
export type Deps = {
  fetch: typeof fetch;
  token?: string;
  pixelId?: string;
  testEventCode?: string;
  now?: () => number;
  attribution: (event: CapiEvent) => Promise<Attribution | null>;
  latestConsentGranted: (userId: string) => Promise<boolean>;
  customerPayments: (customerId: string) => Promise<HistoricalPayment[]>;
};

/** Decides and performs one delivery. Never throws; returns the status to persist. */
export async function deliverEvent(event: CapiEvent, deps: Deps): Promise<Outcome> {
  try {
    const now = deps.now?.() ?? Date.now();
    if (event.environment !== "production") return { status: "skipped_test" };
    if (!Number.isFinite(Date.parse(event.event_time)) || Date.parse(event.event_time) > now + 60000) return { status: "failed", error: "invalid_payment_time" };
    if (now - new Date(event.event_time).getTime() > MAX_EVENT_AGE_MS) return { status: "expired", error: "older than 7 days" };
    if (event.event_name === "Subscribe" && !event.history_verified) {
      if (!event.asaas_customer_id) return { status: "failed", error: "history_unverified: missing customer" };
      let payments;
      try { payments = await deps.customerPayments(event.asaas_customer_id); }
      catch { return { status: "failed", error: "history_unverified: asaas unavailable" }; }
      if (hasEarlierPaidPayment(payments, event.asaas_payment_id, event.event_time)) return { status: "skipped_existing_customer" };
    }
    const attr = await deps.attribution(event);
    if (!attr || !attr.consent_granted || !(await deps.latestConsentGranted(attr.user_id))) return { status: "blocked_consent" };
    if (!deps.pixelId || !PIXEL_RE.test(deps.pixelId)) return { status: "failed", error: "missing_pixel_id" };
    if (!deps.token) return { status: "failed", error: "missing_token META_CAPI_ACCESS_TOKEN" };
    const body = { ...buildPayload(event, attr, deps.testEventCode), access_token: deps.token };
    const res = await deps.fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${deps.pixelId}/events`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const json: any = await res.json().catch(() => ({}));
    if (res.ok && Number(json?.events_received) >= 1) return { status: "sent" };
    const err = json?.error;
    const msg = `meta ${res.status}${err?.code ? ` code ${err.code}` : ""}${err?.error_subcode ? `/${err.error_subcode}` : ""}${err?.fbtrace_id ? ` trace ${err.fbtrace_id}` : ""}`;
    return { status: "failed", error: msg.slice(0, 500) };
  } catch (e) {
    return { status: "failed", error: `network: ${(e as Error)?.name ?? "error"}`.slice(0, 500) };
  }
}
