import { z } from "zod";

export const contactSchema = z.object({
  nome: z.string().trim().min(1, "Informe seu nome").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  mensagem: z.string().trim().min(5, "Escreva sua mensagem").max(2000),
});