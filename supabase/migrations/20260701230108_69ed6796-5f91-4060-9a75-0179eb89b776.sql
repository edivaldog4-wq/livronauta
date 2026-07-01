
CREATE OR REPLACE FUNCTION public.merge_books(_target_id uuid, _source_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  tgt RECORD;
  src RECORD;
  added_total int;
  added_disp int;
BEGIN
  IF NOT public.is_staff(caller) THEN RAISE EXCEPTION 'Permissão negada'; END IF;
  IF _target_id = _source_id THEN RAISE EXCEPTION 'IDs iguais'; END IF;

  SELECT * INTO tgt FROM public.books WHERE id = _target_id FOR UPDATE;
  IF tgt IS NULL THEN RAISE EXCEPTION 'Livro alvo não encontrado'; END IF;
  SELECT * INTO src FROM public.books WHERE id = _source_id FOR UPDATE;
  IF src IS NULL THEN RAISE EXCEPTION 'Livro de origem não encontrado'; END IF;

  added_total := COALESCE(src.quantidade_total, 0);
  added_disp := COALESCE(src.quantidade_disponivel, 0);

  UPDATE public.loans SET book_id = _target_id WHERE book_id = _source_id;
  UPDATE public.loan_requests SET book_id = _target_id WHERE book_id = _source_id;
  UPDATE public.reservations SET book_id = _target_id WHERE book_id = _source_id;
  UPDATE public.labels SET book_id = _target_id WHERE book_id = _source_id;

  UPDATE public.books
    SET quantidade_total = COALESCE(quantidade_total,0) + added_total,
        quantidade_disponivel = COALESCE(quantidade_disponivel,0) + added_disp,
        isbn = COALESCE(isbn, src.isbn),
        editora = COALESCE(editora, src.editora),
        ano = COALESCE(ano, src.ano),
        numero_paginas = COALESCE(numero_paginas, src.numero_paginas),
        sinopse = COALESCE(sinopse, src.sinopse),
        capa_url = COALESCE(capa_url, src.capa_url),
        idioma = COALESCE(idioma, src.idioma),
        localizacao_prateleira = COALESCE(localizacao_prateleira, src.localizacao_prateleira),
        categoria_id = COALESCE(categoria_id, src.categoria_id)
    WHERE id = _target_id;

  DELETE FROM public.books WHERE id = _source_id;

  RETURN jsonb_build_object('added_total', added_total, 'added_disp', added_disp);
END;
$$;
