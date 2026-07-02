CREATE OR REPLACE FUNCTION public.create_loan(_book_id uuid, _user_id uuid, _dias integer DEFAULT 14)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caller UUID := auth.uid();
  new_id UUID;
  qtd INTEGER;
BEGIN
  IF NOT public.is_staff(caller) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  SELECT quantidade_disponivel INTO qtd FROM public.books WHERE id = _book_id FOR UPDATE;
  IF qtd IS NULL THEN RAISE EXCEPTION 'Livro não encontrado'; END IF;
  IF qtd < 1 THEN RAISE EXCEPTION 'Livro indisponível'; END IF;

  UPDATE public.books SET quantidade_disponivel = quantidade_disponivel - 1 WHERE id = _book_id;
  INSERT INTO public.loans (book_id, user_id, data_devolucao_prevista)
    VALUES (_book_id, _user_id, (CURRENT_DATE + (_dias || ' days')::interval)::date)
    RETURNING id INTO new_id;

  -- Auto-approve any pending request from same user for same book
  UPDATE public.loan_requests
    SET status='aprovado', decided_at=now(), decided_by=caller
    WHERE book_id=_book_id AND user_id=_user_id AND status='pendente';

  RETURN new_id;
END;
$function$;