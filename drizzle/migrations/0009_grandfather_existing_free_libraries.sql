ALTER TABLE public.libraries
ADD COLUMN IF NOT EXISTS free_plan_grandfathered boolean NOT NULL DEFAULT false;

UPDATE public.libraries
SET free_plan_grandfathered = true
WHERE plan = 'free';

COMMENT ON COLUMN public.libraries.free_plan_grandfathered IS 'Preserves the retired free plan only for libraries that held it before new free registrations ended.';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  lib uuid;
  cat uuid;
  nm text := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'nome'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'Novo usuário'
  );
BEGIN
  INSERT INTO public.libraries (nome, owner_id, plan, subscription_status, free_plan_grandfathered)
  VALUES ('Biblioteca de ' || nm, NEW.id, 'pro', 'pending', false)
  RETURNING id INTO lib;

  INSERT INTO public.profiles (id, nome, email, numero, active_library_id)
  VALUES (NEW.id, nm, COALESCE(NEW.email, ''), public.generate_profile_number(), lib)
  ON CONFLICT (id) DO UPDATE
  SET nome = EXCLUDED.nome,
      email = EXCLUDED.email,
      active_library_id = EXCLUDED.active_library_id;

  INSERT INTO public.user_roles (user_id, role, library_id)
  VALUES (NEW.id, 'admin', lib)
  ON CONFLICT (library_id, user_id, role) DO NOTHING;

  INSERT INTO public.settings (library_id, key, value)
  VALUES (lib, 'library_name', to_jsonb(('Biblioteca de ' || nm)::text))
  ON CONFLICT (library_id, key) DO UPDATE SET value = EXCLUDED.value;

  INSERT INTO public.categories (nome, descricao, library_id)
  VALUES ('Exemplo: Literatura', 'Categoria de demonstração — você pode editar ou excluir.', lib)
  RETURNING id INTO cat;

  INSERT INTO public.shelves (nome, descricao, library_id)
  VALUES ('Exemplo: Estante principal', 'Localização de demonstração — você pode editar ou excluir.', lib);

  INSERT INTO public.books (
    titulo, autor, editora, ano, numero_paginas, idioma, sinopse,
    quantidade_total, quantidade_disponivel, localizacao_prateleira,
    categoria_id, library_id
  ) VALUES (
    'Livro de demonstração', 'Equipe Livronauta', 'Livronauta', 2026, 120,
    'Português (Brasil)',
    'Este livro mostra como seu catálogo funciona. Edite, empreste ou exclua quando quiser.',
    1, 1, 'Exemplo: Estante principal', cat, lib
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

CREATE OR REPLACE FUNCTION public.create_library(_nome text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE lib uuid;
BEGIN
  INSERT INTO public.libraries (nome, owner_id, plan, subscription_status, free_plan_grandfathered)
  VALUES (coalesce(nullif(trim(_nome),''),'Minha Biblioteca'), auth.uid(), 'pro', 'pending', false)
  RETURNING id INTO lib;
  INSERT INTO public.user_roles (user_id, role, library_id) VALUES (auth.uid(), 'admin', lib);
  UPDATE public.profiles SET active_library_id = lib WHERE id = auth.uid();
  RETURN lib;
END;
$$;

REVOKE ALL ON FUNCTION public.create_library(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_library(text) TO authenticated, service_role;

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

  RAISE EXCEPTION 'É necessário ativar o plano Pro para cadastrar novos livros.';
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
    'limit', CASE WHEN l.plan = 'free' AND l.free_plan_grandfathered THEN 50 ELSE NULL END,
    'plan', l.plan,
    'status', l.subscription_status,
    'nome', l.nome,
    'period_end', l.current_period_end,
    'has_subscription', l.asaas_subscription_id IS NOT NULL,
    'free_plan_grandfathered', l.free_plan_grandfathered,
    'invite_code', CASE WHEN public.has_role(auth.uid(), 'admin') THEN l.invite_code END
  )
  FROM public.libraries l
  WHERE l.id = public.current_library_id()
    AND public.is_library_member(l.id)
$$;