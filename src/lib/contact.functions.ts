import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { contactSchema } from "@/lib/contact-schema";

export const createContactChallenge = createServerFn({ method: "POST" }).handler(async () => {
  const secret = process.env["CONTACT_CAPTCHA_SECRET"];
  if (!secret) throw new Error("Verificação indisponível. Tente novamente mais tarde.");
  const { createChallenge } = await import("altcha-lib/v1");
  return createChallenge({
    hmacKey: secret,
    algorithm: "SHA-256",
    maxNumber: 150000,
    expires: new Date(Date.now() + 5 * 60 * 1000),
    params: { purpose: "contact" },
  });
});

export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((input) => contactSchema.extend({ captcha: z.string().min(1).max(2048) }).parse(input))
  .handler(async ({ data }) => {
    const secret = process.env["CONTACT_CAPTCHA_SECRET"];
    if (!secret) throw new Error("Verificação indisponível. Tente novamente mais tarde.");
    const { verifyContactCaptcha } = await import("@/lib/contact-captcha");
    const challenge = await verifyContactCaptcha(data.captcha, secret);
    if (!challenge) throw new Error("Verificação inválida ou expirada. Faça uma nova tentativa.");
    // Only verified submissions may use the privileged writer. The unique digest
    // makes challenge consumption and message persistence atomic across Workers.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contact_messages").insert({
      nome: data.nome, email: data.email, mensagem: data.mensagem,
      captcha_challenge: challenge,
    });
    if (error) throw new Error("Não foi possível enviar. Refaça a verificação e tente novamente.");
    return { ok: true };
  });