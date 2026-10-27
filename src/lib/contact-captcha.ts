import { z } from "zod";
import { verifySolution } from "altcha-lib/v1";

const payloadSchema = z.object({
  algorithm: z.literal("SHA-256"),
  challenge: z.string().regex(/^[a-f0-9]{64}$/),
  number: z.number().int().min(0).max(150000),
  salt: z.string().min(1).max(500),
  signature: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function verifyContactCaptcha(encoded: string, secret: string) {
  try {
    const payload = payloadSchema.parse(JSON.parse(atob(encoded)));
    const params = new URLSearchParams(payload.salt.split("?")[1] ?? "");
    const expires = Number(params.get("expires"));
    if (params.get("purpose") !== "contact" || !Number.isFinite(expires) || expires <= Date.now() / 1000) return null;
    if (!(await verifySolution(payload, secret, true))) return null;
    return payload.challenge;
  } catch {
    return null;
  }
}