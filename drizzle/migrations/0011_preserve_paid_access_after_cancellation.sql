CREATE OR REPLACE FUNCTION public.enforce_book_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p text;
  st text;
  pe timestamptz;
  grandfathered boolean;
  n int;
BEGIN
  SELECT plan, subscription_status, current_period_end, free_plan_grandfathered
  INTO p, st, pe, grandfathered
  FROM public.libraries
  WHERE id = NEW.library_id;

  IF p = 'unlimited' THEN
    RETURN NEW;
  END IF;

  IF p = 'pro' AND (
    coalesce(st, '') = 'active'
    OR (st = 'overdue' AND pe IS NOT NULL AND now() < pe + interval '7 days')
    OR (st = 'canceled' AND pe IS NOT NULL AND now() < pe)
  ) THEN
    RETURN NEW;
  END IF;

  IF p = 'free' AND grandfathered THEN
    SELECT count(*) INTO n FROM public.books WHERE library_id = NEW.library_id;
    IF n >= 50 THEN
      RAISE EXCEPTION 'Limite do plano gratuito legado atingido (50 livros). Faça upgrade para o plano Pro.';
    END IF;
    RETURN NEW;
  END IF;

  IF p = 'pro' AND st = 'pending' THEN
    SELECT count(*) INTO n FROM public.books WHERE library_id = NEW.library_id;
    IF n = 0 AND NEW.titulo = 'Livro de demonstração' AND NEW.autor = 'Equipe Livronauta' THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'É necessário ativar o plano Pro para cadastrar novos livros.';
END
$$;