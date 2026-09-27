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
  INSERT INTO public.libraries (nome, owner_id, plan, subscription_status)
  VALUES ('Biblioteca de ' || nm, NEW.id, 'free', NULL)
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