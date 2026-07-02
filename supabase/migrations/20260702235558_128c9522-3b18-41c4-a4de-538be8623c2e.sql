GRANT SELECT, INSERT, UPDATE, DELETE ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_requests TO authenticated;
GRANT ALL ON public.loan_requests TO service_role;