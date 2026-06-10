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
  .inputValidator(z.object({
    loan_id: z.string().uuid(),
    observacao: z.string().max(1000).optional(),
    condicao: z.string().max(50).optional(),
  }))
  .handler(async ({ data, context }) => {
    const { data: multa, error } = await context.supabase.rpc("return_loan", {
      _loan_id: data.loan_id,
      _observacao: data.observacao ?? null,
      _condicao: data.condicao ?? null,
    } as any);
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

export const requestLoan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ book_id: z.string().uuid(), observacao: z.string().max(500).optional() }))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("request_loan", {
      _book_id: data.book_id,
      _observacao: data.observacao ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { id };
  });

export const approveLoanRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ request_id: z.string().uuid(), dias: z.number().int().min(1).max(90).default(14) }))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("approve_loan_request", {
      _request_id: data.request_id,
      _dias: data.dias,
    });
    if (error) throw new Error(error.message);
    return { loan_id: id };
  });

export const rejectLoanRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ request_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("reject_loan_request", { _request_id: data.request_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateLoanDueDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ loan_id: z.string().uuid(), new_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("update_loan_due_date", {
      _loan_id: data.loan_id,
      _new_date: data.new_date,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
