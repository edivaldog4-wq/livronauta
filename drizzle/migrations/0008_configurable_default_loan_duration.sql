CREATE OR REPLACE FUNCTION public.create_loan(_book_id uuid, _user_id uuid, _dias integer DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller uuid := auth.uid();
  lib uuid := public.current_library_id();
  new_id uuid;
  qtd integer;
  prazo integer;
BEGIN
  IF NOT public.is_staff(caller) THEN RAISE EXCEPTION 'Permissão negada'; END IF;

  SELECT quantidade_disponivel INTO qtd
  FROM public.books
  WHERE id = _book_id AND library_id = lib
  FOR UPDATE;

  IF qtd IS NULL THEN RAISE EXCEPTION 'Livro não encontrado'; END IF;
  IF qtd < 1 THEN RAISE EXCEPTION 'Livro indisponível'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND library_id = lib) THEN
    RAISE EXCEPTION 'Usuário não pertence a esta biblioteca';
  END IF;

  SELECT LEAST(90, GREATEST(1, COALESCE(_dias, NULLIF(value #>> '{}', '')::integer, 14)))
  INTO prazo
  FROM public.settings
  WHERE library_id = lib AND key = 'prazo_emprestimo_dias';
  prazo := COALESCE(prazo, LEAST(90, GREATEST(1, COALESCE(_dias, 14))));

  UPDATE public.books
  SET quantidade_disponivel = quantidade_disponivel - 1
  WHERE id = _book_id;

  INSERT INTO public.loans (book_id, user_id, data_devolucao_prevista, library_id)
  VALUES (_book_id, _user_id, (CURRENT_DATE + prazo)::date, lib)
  RETURNING id INTO new_id;

  UPDATE public.loan_requests
  SET status = 'aprovado', decided_at = now(), decided_by = caller
  WHERE book_id = _book_id AND user_id = _user_id AND status = 'pendente' AND library_id = lib;

  RETURN new_id;
END
$$;

CREATE OR REPLACE FUNCTION public.approve_loan_request(_request_id uuid, _dias integer DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller uuid := auth.uid();
  req RECORD;
  loan_id uuid;
BEGIN
  IF NOT public.is_staff(caller) THEN RAISE EXCEPTION 'Permissão negada'; END IF;

  SELECT * INTO req
  FROM public.loan_requests
  WHERE id = _request_id AND library_id = public.current_library_id()
  FOR UPDATE;

  IF req IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF req.status <> 'pendente' THEN RAISE EXCEPTION 'Solicitação já decidida'; END IF;

  loan_id := public.create_loan(req.book_id, req.user_id, _dias);
  UPDATE public.loan_requests
  SET status = 'aprovado', decided_at = now(), decided_by = caller
  WHERE id = _request_id;

  RETURN loan_id;
END
$$;

REVOKE ALL ON FUNCTION public.create_loan(uuid, uuid, integer), public.approve_loan_request(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_loan(uuid, uuid, integer), public.approve_loan_request(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_loan(uuid, uuid, integer), public.approve_loan_request(uuid, integer) TO service_role;