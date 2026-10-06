CREATE OR REPLACE FUNCTION public.enforce_book_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p text;
  st text;
  pe timestamptz;
  grandfathered boolean;
  complimentary boolean;
  n int;
BEGIN
  SELECT plan, subscription_status, current_period_end, free_plan_grandfathered, complimentary_access
  INTO p, st, pe, grandfathered, complimentary
  FROM public.libraries
  WHERE id = NEW.library_id;

  IF p = 'unlimited' OR complimentary THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.library_usage()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'books', (SELECT count(*) FROM public.books WHERE library_id = l.id),
    'limit', CASE WHEN l.plan = 'free' AND l.free_plan_grandfathered AND NOT l.complimentary_access THEN 50 ELSE NULL END,
    'plan', l.plan,
    'status', l.subscription_status,
    'nome', l.nome,
    'period_end', l.current_period_end,
    'has_subscription', l.asaas_subscription_id IS NOT NULL,
    'free_plan_grandfathered', l.free_plan_grandfathered,
    'complimentary_access', l.complimentary_access,
    'invite_code', CASE WHEN public.has_role(auth.uid(), 'admin') THEN l.invite_code END
  )
  FROM public.libraries l
  WHERE l.id = public.current_library_id()
    AND public.is_library_member(l.id)
$function$;