/// <reference types="bun" />
import { describe, expect, test, mock } from "bun:test";
import { deliverEvent, extractPaidPayment, hasEarlierPaidPayment, sha256Hex, normalizeEmail, type CapiEvent, type Deps } from "./meta-capi";

const ev = (o: Partial<CapiEvent> = {}): CapiEvent => ({ id: "1", event_name: "Purchase", event_id: "asaas_pay_pay_1", value: 14.99, currency: "BRL",
  event_time: new Date().toISOString(), environment: "production", history_verified: true, asaas_payment_id: "pay_1", asaas_customer_id: "cus_1", ...o });
const attr = { em_hash: "a".repeat(64), external_id_hash: "b".repeat(64), fbp: "fb.1.1700000000000.123", fbc: null, client_ip: "1.1.1.1", client_user_agent: "UA", event_source_url: "https://livronauta.app/plan", user_id: "u", consent_granted: true };
const deps = (o: Partial<Deps> = {}): Deps => ({ fetch: mock(async () => Response.json({ events_received: 1 })) as any, token: "t", pixelId: "6408460052544509",
  attribution: async () => attr, latestConsentGranted: async () => true, customerPayments: async () => [], ...o });

describe("prova de pagamento", () => {
  test("só CONFIRMED/RECEIVED pagos com valor real", () => {
    expect(extractPaidPayment({ event: "PAYMENT_RECEIVED", payment: { id: "pay_1", status: "RECEIVED", value: 14.99 } })).toEqual({ id: "pay_1", value: 14.99 });
    expect(extractPaidPayment({ event: "PAYMENT_CREATED", payment: { id: "pay_1", status: "PENDING", value: 14.99 } })).toBeNull();
    expect(extractPaidPayment({ event: "PAYMENT_REFUNDED", payment: { id: "pay_1", status: "REFUNDED", value: 14.99 } })).toBeNull();
    expect(extractPaidPayment({ event: "PAYMENT_CONFIRMED", payment: { id: "pay_1", status: "PENDING", value: 14.99 } })).toBeNull();
    expect(extractPaidPayment({ event: "PAYMENT_CONFIRMED", payment: { id: "pay_1", status: "CONFIRMED", value: 0 } })).toBeNull();
  });
  test("cliente com pagamento anterior não é nova assinatura", () => {
    expect(hasEarlierPaidPayment([{ id: "old", status: "RECEIVED" }], "pay_1")).toBe(true);
    expect(hasEarlierPaidPayment([{ id: "pay_1", status: "RECEIVED" }, { id: "x", status: "PENDING" }], "pay_1")).toBe(false);
  });
  test("e-mail normalizado e hash SHA-256", async () => {
    expect(await sha256Hex(normalizeEmail(" A@B.com "))).toBe(await sha256Hex("a@b.com"));
  });
});

describe("entrega ao Meta", () => {
  test("envia Purchase com valor real em BRL e sem token na URL", async () => {
    const d = deps();
    expect((await deliverEvent(ev(), d)).status).toBe("sent");
    const [url, init] = (d.fetch as any).mock.calls[0];
    expect(url).not.toContain("access_token");
    const body = JSON.parse(init.body);
    expect(body.data[0]).toMatchObject({ event_name: "Purchase", event_id: "asaas_pay_pay_1", action_source: "website", custom_data: { value: 14.99, currency: "BRL" } });
  });
  test("consentimento negado ou retirado bloqueia", async () => {
    expect((await deliverEvent(ev(), deps({ attribution: async () => ({ ...attr, consent_granted: false }) }))).status).toBe("blocked_consent");
    expect((await deliverEvent(ev(), deps({ latestConsentGranted: async () => false }))).status).toBe("blocked_consent");
    expect((await deliverEvent(ev(), deps({ attribution: async () => null }))).status).toBe("blocked_consent");
  });
  test("sandbox nunca vai para produção", async () => {
    const d = deps();
    expect((await deliverEvent(ev({ environment: "sandbox" }), d)).status).toBe("skipped_test");
    expect((d.fetch as any).mock.calls.length).toBe(0);
  });
  test("token ausente ou erro do Meta mantém pendente para reenvio", async () => {
    expect((await deliverEvent(ev(), deps({ token: undefined }))).status).toBe("failed");
    const r = await deliverEvent(ev(), deps({ fetch: (async () => Response.json({ error: { code: 190, fbtrace_id: "T" } }, { status: 400 })) as any }));
    expect(r.status).toBe("failed");
    expect((await deliverEvent(ev(), deps({ fetch: (async () => { throw new Error("down"); }) as any }))).status).toBe("failed");
    expect((await deliverEvent(ev(), deps({ fetch: (async () => Response.json({ events_received: 0 })) as any }))).status).toBe("failed");
  });
  test("evento com mais de 7 dias expira", async () => {
    expect((await deliverEvent(ev({ event_time: new Date(Date.now() - 8 * 864e5).toISOString() }), deps())).status).toBe("expired");
  });
  test("Subscribe: assinante antigo pulado; Asaas fora mantém pendente", async () => {
    const s = ev({ event_name: "Subscribe", history_verified: false });
    expect((await deliverEvent(s, deps({ customerPayments: async () => [{ id: "old", status: "RECEIVED" }] }))).status).toBe("skipped_existing_customer");
    expect((await deliverEvent(s, deps({ customerPayments: async () => { throw new Error(); } }))).status).toBe("failed");
    expect((await deliverEvent(s, deps())).status).toBe("sent");
  });
});
