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
  n int;
BEGIN
  SELECT plan, subscription_status, current_period_end
  INTO p, st, pe
  FROM public.libraries
  WHERE id = NEW.library_id;

  IF p = 'unlimited' THEN
    RETURN NEW;
  END IF;

  IF p = 'pro' AND (
    coalesce(st, '') = 'active'
    OR (st = 'overdue' AND pe IS NOT NULL AND now() < pe + interval '7 days')
  ) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO n
  FROM public.books
  WHERE library_id = NEW.library_id;

  IF n >= 50 THEN
    RAISE EXCEPTION 'Limite do plano gratuito atingido (50 livros). Faça upgrade para o plano Pro.';
  END IF;

  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.library_usage()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'books', (SELECT count(*) FROM public.books WHERE library_id = l.id),
    'limit', 50,
    'plan', l.plan,
    'status', l.subscription_status,
    'nome', l.nome,
    'period_end', l.current_period_end,
    'has_subscription', l.asaas_subscription_id IS NOT NULL,
    'invite_code', CASE WHEN public.has_role(auth.uid(), 'admin') THEN l.invite_code END
  )
  FROM public.libraries l
  WHERE l.id = public.current_library_id()
    AND public.is_library_member(l.id)
$$;