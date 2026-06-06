import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ book_id: z.string().uuid(), user_id: z.string().uuid(), dias: z.number().int().min(1).max(90).default(14) }))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("create_loan", {
      _book_id: data.book_id,
      _user_id: data.user_id,
      _dias: data.dias,
    });
    if (error) throw new Error(error.message);
    return { id };
  });

export const returnLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ loan_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: multa, error } = await context.supabase.rpc("return_loan", { _loan_id: data.loan_id });
    if (error) throw new Error(error.message);
    return { multa: Number(multa ?? 0) };
  });

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("bootstrap_first_admin");
    if (error) throw new Error(error.message);
    return { promoted: Boolean(data) };
  });
