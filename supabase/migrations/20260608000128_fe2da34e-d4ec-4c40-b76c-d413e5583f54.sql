
-- Loan requests table for borrowing approval flow
CREATE TABLE public.loan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado','cancelado')),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_requests TO authenticated;
GRANT ALL ON public.loan_requests TO service_role;

ALTER TABLE public.loan_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loan_requests_select_own_or_staff" ON public.loan_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE POLICY "loan_requests_insert_self" ON public.loan_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "loan_requests_update_owner_or_staff" ON public.loan_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE POLICY "loan_requests_delete_staff" ON public.loan_requests
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- Request a loan (any authenticated user, for themselves)
CREATE OR REPLACE FUNCTION public.request_loan(_book_id uuid, _observacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  -- avoid duplicate pending request for same book/user
  IF EXISTS (SELECT 1 FROM public.loan_requests WHERE user_id = uid AND book_id = _book_id AND status = 'pendente') THEN
    RAISE EXCEPTION 'Você já possui uma solicitação pendente para este livro';
  END IF;
  INSERT INTO public.loan_requests (book_id, user_id, observacao)
    VALUES (_book_id, uid, _observacao)
    RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

-- Approve a loan request (staff)
CREATE OR REPLACE FUNCTION public.approve_loan_request(_request_id uuid, _dias integer DEFAULT 14)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  req RECORD;
  loan_id uuid;
BEGIN
  IF NOT public.is_staff(caller) THEN RAISE EXCEPTION 'Permissão negada'; END IF;
  SELECT * INTO req FROM public.loan_requests WHERE id = _request_id FOR UPDATE;
  IF req IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF req.status <> 'pendente' THEN RAISE EXCEPTION 'Solicitação já decidida'; END IF;

  loan_id := public.create_loan(req.book_id, req.user_id, _dias);

  UPDATE public.loan_requests
    SET status = 'aprovado', decided_at = now(), decided_by = caller
    WHERE id = _request_id;
  RETURN loan_id;
END; $$;

-- Reject a loan request (staff)
CREATE OR REPLACE FUNCTION public.reject_loan_request(_request_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid();
BEGIN
  IF NOT public.is_staff(caller) THEN RAISE EXCEPTION 'Permissão negada'; END IF;
  UPDATE public.loan_requests
    SET status = 'rejeitado', decided_at = now(), decided_by = caller
    WHERE id = _request_id AND status = 'pendente';
  RETURN FOUND;
END; $$;

-- Update due date of an active loan (staff)
CREATE OR REPLACE FUNCTION public.update_loan_due_date(_loan_id uuid, _new_date date)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller uuid := auth.uid();
BEGIN
  IF NOT public.is_staff(caller) THEN RAISE EXCEPTION 'Permissão negada'; END IF;
  UPDATE public.loans
    SET data_devolucao_prevista = _new_date
    WHERE id = _loan_id AND status = 'ativo';
  RETURN FOUND;
END; $$;

-- Allow borrower to return their own loan (in addition to staff)
CREATE OR REPLACE FUNCTION public.return_loan(_loan_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := auth.uid();
  l RECORD;
  dias_atraso integer;
  multa_dia numeric;
  multa_total numeric := 0;
BEGIN
  SELECT * INTO l FROM public.loans WHERE id = _loan_id FOR UPDATE;
  IF l IS NULL THEN RAISE EXCEPTION 'Empréstimo não encontrado'; END IF;
  IF NOT (public.is_staff(caller) OR l.user_id = caller) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  IF l.status = 'concluido' THEN RAISE EXCEPTION 'Empréstimo já concluído'; END IF;

  SELECT (value#>>'{}')::numeric INTO multa_dia FROM public.settings WHERE key='multa_por_dia';
  IF multa_dia IS NULL THEN multa_dia := 0; END IF;

  dias_atraso := GREATEST(0, (CURRENT_DATE - l.data_devolucao_prevista));
  multa_total := dias_atraso * multa_dia;

  UPDATE public.loans
    SET status='concluido', data_devolucao_real = now(), multa = multa_total
    WHERE id = _loan_id;
  UPDATE public.books SET quantidade_disponivel = quantidade_disponivel + 1
    WHERE id = l.book_id;
  RETURN multa_total;
END; $$;
