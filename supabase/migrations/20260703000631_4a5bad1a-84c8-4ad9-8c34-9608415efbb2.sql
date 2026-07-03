
-- 1) Add FKs so PostgREST can embed books and profiles from loan_requests
ALTER TABLE public.loan_requests
  ADD CONSTRAINT loan_requests_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;

ALTER TABLE public.loan_requests
  ADD CONSTRAINT loan_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2) Update owner-guard trigger to allow the owner to cancel their own pending request
CREATE OR REPLACE FUNCTION public.loan_requests_owner_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- Owner may cancel a pending request (status -> 'cancelado')
  IF OLD.status = 'pendente' AND NEW.status = 'cancelado'
     AND NEW.user_id = OLD.user_id
     AND NEW.book_id = OLD.book_id THEN
    RETURN NEW;
  END IF;
  -- Otherwise, only observacao may change for the owner
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.decided_by IS DISTINCT FROM OLD.decided_by
     OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.book_id IS DISTINCT FROM OLD.book_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Somente a equipe pode alterar esses campos da solicitação';
  END IF;
  RETURN NEW;
END;
$$;

-- 3) RPC: cancel a pending request (owner or staff)
CREATE OR REPLACE FUNCTION public.cancel_loan_request(_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  req RECORD;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO req FROM public.loan_requests WHERE id = _request_id FOR UPDATE;
  IF req IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF req.status <> 'pendente' THEN RAISE EXCEPTION 'Solicitação já decidida'; END IF;
  IF NOT (public.is_staff(caller) OR req.user_id = caller) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  UPDATE public.loan_requests
    SET status = 'cancelado', decided_at = now(), decided_by = caller
    WHERE id = _request_id;
  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_loan_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_loan_request(uuid) TO authenticated;
