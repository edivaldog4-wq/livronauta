CREATE OR REPLACE FUNCTION public.normalize_book_text(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT regexp_replace(
    lower(
      translate(
        coalesce(_value, ''),
        'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñÝýÿ',
        'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy'
      )
    ),
    '[^a-z0-9]+',
    ' ',
    'g'
  )
$$;

CREATE INDEX IF NOT EXISTS books_isbn_digits_idx
  ON public.books ((regexp_replace(coalesce(isbn, ''), '\\D', '', 'g')))
  WHERE isbn IS NOT NULL AND regexp_replace(coalesce(isbn, ''), '\\D', '', 'g') <> '';

CREATE INDEX IF NOT EXISTS books_title_author_normalized_idx
  ON public.books ((public.normalize_book_text(titulo)), (public.normalize_book_text(autor)));

CREATE OR REPLACE FUNCTION public.import_books_batch(_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller uuid := auth.uid();
  item jsonb;
  existing_id uuid;
  imported integer := 0;
  updated integer := 0;
  skipped integer := 0;
  errors jsonb := '[]'::jsonb;
  title_text text;
  author_text text;
  isbn_text text;
  isbn_digits text;
  qty integer;
  category_name text;
  category_id_value uuid;
  shelf_name text;
BEGIN
  IF NOT public.is_staff(caller) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  LOCK TABLE public.books IN SHARE ROW EXCLUSIVE MODE;

  FOR item IN SELECT * FROM jsonb_array_elements(coalesce(_items, '[]'::jsonb)) LOOP
    BEGIN
      title_text := nullif(trim(item->>'titulo'), '');
      author_text := nullif(trim(coalesce(item->>'autor', '')), '');
      isbn_text := nullif(trim(coalesce(item->>'isbn', '')), '');
      isbn_digits := regexp_replace(coalesce(isbn_text, ''), '\D', '', 'g');
      qty := greatest(1, coalesce((item->>'quantidade_total')::int, 1));
      category_name := nullif(trim(coalesce(item->>'categoria_nome', '')), '');
      shelf_name := nullif(trim(coalesce(item->>'localizacao_prateleira', '')), '');
      category_id_value := null;

      IF title_text IS NULL THEN
        skipped := skipped + 1;
        CONTINUE;
      END IF;

      IF category_name IS NOT NULL THEN
        INSERT INTO public.categories (nome)
        VALUES (category_name)
        ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome
        RETURNING id INTO category_id_value;
      END IF;

      SELECT id INTO existing_id
      FROM public.books
      WHERE (
        isbn_digits <> ''
        AND regexp_replace(coalesce(isbn, ''), '\D', '', 'g') = isbn_digits
      ) OR (
        public.normalize_book_text(titulo) = public.normalize_book_text(title_text)
        AND public.normalize_book_text(autor) = public.normalize_book_text(author_text)
      )
      ORDER BY CASE WHEN isbn_digits <> '' AND regexp_replace(coalesce(isbn, ''), '\D', '', 'g') = isbn_digits THEN 0 ELSE 1 END
      LIMIT 1
      FOR UPDATE;

      IF existing_id IS NULL THEN
        INSERT INTO public.books (
          titulo, autor, isbn, editora, ano, numero_paginas, sinopse,
          quantidade_total, quantidade_disponivel, localizacao_prateleira, categoria_id, capa_url, idioma
        ) VALUES (
          title_text,
          coalesce(author_text, ''),
          isbn_text,
          nullif(trim(coalesce(item->>'editora', '')), ''),
          nullif(item->>'ano', '')::int,
          nullif(item->>'numero_paginas', '')::int,
          nullif(trim(coalesce(item->>'sinopse', '')), ''),
          qty,
          qty,
          shelf_name,
          category_id_value,
          nullif(trim(coalesce(item->>'capa_url', '')), ''),
          nullif(trim(coalesce(item->>'idioma', '')), '')
        );
        imported := imported + 1;
      ELSE
        UPDATE public.books
        SET
          titulo = coalesce(title_text, titulo),
          autor = coalesce(author_text, autor),
          isbn = coalesce(isbn_text, isbn),
          editora = coalesce(nullif(trim(coalesce(item->>'editora', '')), ''), editora),
          ano = coalesce(nullif(item->>'ano', '')::int, ano),
          numero_paginas = coalesce(nullif(item->>'numero_paginas', '')::int, numero_paginas),
          sinopse = coalesce(nullif(trim(coalesce(item->>'sinopse', '')), ''), sinopse),
          localizacao_prateleira = coalesce(shelf_name, localizacao_prateleira),
          categoria_id = coalesce(category_id_value, categoria_id),
          capa_url = coalesce(nullif(trim(coalesce(item->>'capa_url', '')), ''), capa_url),
          idioma = coalesce(nullif(trim(coalesce(item->>'idioma', '')), ''), idioma),
          quantidade_total = quantidade_total + qty,
          quantidade_disponivel = quantidade_disponivel + qty
        WHERE id = existing_id;
        updated := updated + 1;
      END IF;
    EXCEPTION WHEN others THEN
      skipped := skipped + 1;
      errors := errors || jsonb_build_array(jsonb_build_object('titulo', coalesce(title_text, item->>'titulo'), 'erro', SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object('imported', imported, 'updated', updated, 'skipped', skipped, 'errors', errors);
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_books_batch(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_books_batch(jsonb) TO service_role;