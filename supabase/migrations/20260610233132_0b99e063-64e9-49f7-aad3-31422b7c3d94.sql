
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS devolucao_observacao text,
  ADD COLUMN IF NOT EXISTS devolucao_condicao text;

CREATE OR REPLACE FUNCTION public.return_loan(_loan_id uuid, _observacao text DEFAULT NULL, _condicao text DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    SET status='concluido',
        data_devolucao_real = now(),
        multa = multa_total,
        devolucao_observacao = COALESCE(_observacao, devolucao_observacao),
        devolucao_condicao = COALESCE(_condicao, devolucao_condicao)
    WHERE id = _loan_id;
  UPDATE public.books SET quantidade_disponivel = quantidade_disponivel + 1
    WHERE id = l.book_id;
  RETURN multa_total;
END;
$function$;

-- ensure realtime publication includes the tables (in case it was reset)
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.loans; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.loan_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.books; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
