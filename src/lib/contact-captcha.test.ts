import { describe, expect, test } from "bun:test";
import { createChallenge, solveChallenge } from "altcha-lib/v1";
import { verifyContactCaptcha } from "./contact-captcha";
import { contactSchema } from "./contact-schema";

const secret = "test-only-not-a-production-secret";
async function proof(expires: Date) {
  const challenge = await createChallenge({ hmacKey: secret, number: 10, maxNumber: 100, expires, params: { purpose: "contact" } });
  const solution = await solveChallenge(challenge.challenge, challenge.salt, challenge.algorithm, 100).promise;
  if (!solution) throw new Error("No solution");
  return { challenge, encoded: btoa(JSON.stringify({ ...challenge, number: solution.number })) };
}

describe("contact anti-bot verification", () => {
  test("accepts a signed solved challenge", async () => {
    const { challenge, encoded } = await proof(new Date(Date.now() + 60000));
    expect(await verifyContactCaptcha(encoded, secret)).toBe(challenge.challenge);
  });
  test("rejects a forged signature", async () => {
    const { encoded } = await proof(new Date(Date.now() + 60000));
    expect(await verifyContactCaptcha(encoded, "wrong-secret")).toBeNull();
  });
  test("rejects expired proof", async () => {
    const { encoded } = await proof(new Date(Date.now() - 60000));
    expect(await verifyContactCaptcha(encoded, secret)).toBeNull();
  });
  test("rejects a checkbox-only or malformed proof", async () => {
    expect(await verifyContactCaptcha(btoa(JSON.stringify({ verified: true })), secret)).toBeNull();
  });
  test("validates message inputs before submission", () => {
    expect(contactSchema.safeParse({ nome: "Ana", email: "invalid", mensagem: "Olá Livronauta" }).success).toBe(false);
  });
});