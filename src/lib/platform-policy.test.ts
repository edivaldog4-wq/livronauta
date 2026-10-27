import { describe, expect, test } from "bun:test";
import { requiresProActivation, shouldIgnoreAsaasEvent } from "./platform-policy";

describe("gratuidade concedida pelo fundador", () => {
  test("o Asaas não altera uma biblioteca com gratuidade", () => {
    expect(shouldIgnoreAsaasEvent({ plan: "pro", complimentary_access: true })).toBe(true);
    expect(shouldIgnoreAsaasEvent({ plan: "pro", complimentary_access: false })).toBe(false);
  });
  test("gratuidade não exige pagamento; revogação exige ativação", () => {
    expect(requiresProActivation({ plan: "pro", status: "complimentary", complimentary_access: true })).toBe(false);
    expect(requiresProActivation({ plan: "pro", status: "pending", complimentary_access: false })).toBe(true);
  });
});