CREATE TABLE public.import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_email text,
  filename text,
  total_rows integer NOT NULL DEFAULT 0,
  selected_rows integer NOT NULL DEFAULT 0,
  imported integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  merged integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  details jsonb NOT NULL DEFAULT '[]'::jsonb
);

GRANT SELECT, INSERT ON public.import_logs TO authenticated;
GRANT ALL ON public.import_logs TO service_role;

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_logs_select_staff ON public.import_logs
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY import_logs_insert_staff ON public.import_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX import_logs_created_at_idx ON public.import_logs (created_at DESC);

CREATE OR REPLACE FUNCTION public.import_books_batch(_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := auth.uid();
  item jsonb;
  existing_id uuid;
  imported integer := 0;
  updated integer := 0;
  merged integer := 0;
  skipped integer := 0;
  errors jsonb := '[]'::jsonb;
  details jsonb := '[]'::jsonb;
  title_text text;
  author_text text;
  isbn_text text;
  isbn_digits text;
  qty integer;
  category_name text;
  category_id_value uuid;
  shelf_name text;
  resolution text;
  outcome text;
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
      qty := greatest(1, coalesce(nullif(trim(coalesce(item->>'quantidade_total','')),'')::int, 1));
      category_name := nullif(trim(coalesce(item->>'categoria_nome', '')), '');
      shelf_name := nullif(trim(coalesce(item->>'localizacao_prateleira', '')), '');
      resolution := coalesce(nullif(item->>'resolution', ''), 'import');
      category_id_value := null;
      existing_id := null;
      outcome := null;

      IF title_text IS NULL THEN
        skipped := skipped + 1;
        details := details || jsonb_build_array(jsonb_build_object(
          'titulo', coalesce(item->>'titulo',''), 'autor', coalesce(author_text,''),
          'isbn', coalesce(isbn_text,''), 'resolution', resolution,
          'outcome', 'skipped', 'motivo', 'Linha sem título'));
        errors := errors || jsonb_build_array(jsonb_build_object(
          'titulo', coalesce(item->>'titulo',''), 'erro', 'Linha sem título'));
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

      IF existing_id IS NOT NULL AND resolution = 'import' THEN
        existing_id := NULL;
      END IF;

      IF existing_id IS NULL THEN
        INSERT INTO public.books (
          titulo, autor, isbn, editora, ano, numero_paginas, sinopse,
          quantidade_total, quantidade_disponivel, localizacao_prateleira, categoria_id, capa_url, idioma
        ) VALUES (
          title_text,
          coalesce(author_text, ''),
          isbn_text,
          nullif(trim(coalesce(item->>'editora', '')), ''),
          nullif(trim(coalesce(item->>'ano', '')), '')::int,
          nullif(trim(coalesce(item->>'numero_paginas', '')), '')::int,
          nullif(trim(coalesce(item->>'sinopse', '')), ''),
          qty,
          qty,
          shelf_name,
          category_id_value,
          nullif(trim(coalesce(item->>'capa_url', '')), ''),
          nullif(trim(coalesce(item->>'idioma', '')), '')
        );
        imported := imported + 1;
        outcome := 'imported';
      ELSIF resolution = 'overwrite' THEN
        UPDATE public.books
        SET
          titulo = coalesce(title_text, titulo),
          autor = coalesce(author_text, autor),
          isbn = coalesce(isbn_text, isbn),
          editora = coalesce(nullif(trim(coalesce(item->>'editora', '')), ''), editora),
          ano = coalesce(nullif(trim(coalesce(item->>'ano', '')), '')::int, ano),
          numero_paginas = coalesce(nullif(trim(coalesce(item->>'numero_paginas', '')), '')::int, numero_paginas),
          sinopse = coalesce(nullif(trim(coalesce(item->>'sinopse', '')), ''), sinopse),
          localizacao_prateleira = coalesce(shelf_name, localizacao_prateleira),
          categoria_id = coalesce(category_id_value, categoria_id),
          capa_url = coalesce(nullif(trim(coalesce(item->>'capa_url', '')), ''), capa_url),
          idioma = coalesce(nullif(trim(coalesce(item->>'idioma', '')), ''), idioma)
        WHERE id = existing_id;
        updated := updated + 1;
        outcome := 'updated';
      ELSIF resolution = 'merge' THEN
        UPDATE public.books
        SET
          titulo = coalesce(title_text, titulo),
          autor = coalesce(author_text, autor),
          isbn = coalesce(isbn_text, isbn),
          editora = coalesce(nullif(trim(coalesce(item->>'editora', '')), ''), editora),
          ano = coalesce(nullif(trim(coalesce(item->>'ano', '')), '')::int, ano),
          numero_paginas = coalesce(nullif(trim(coalesce(item->>'numero_paginas', '')), '')::int, numero_paginas),
          sinopse = coalesce(nullif(trim(coalesce(item->>'sinopse', '')), ''), sinopse),
          localizacao_prateleira = coalesce(shelf_name, localizacao_prateleira),
          categoria_id = coalesce(category_id_value, categoria_id),
          capa_url = coalesce(nullif(trim(coalesce(item->>'capa_url', '')), ''), capa_url),
          idioma = coalesce(nullif(trim(coalesce(item->>'idioma', '')), ''), idioma),
          quantidade_total = quantidade_total + qty,
          quantidade_disponivel = quantidade_disponivel + qty
        WHERE id = existing_id;
        merged := merged + 1;
        outcome := 'merged';
      ELSE
        skipped := skipped + 1;
        outcome := 'skipped';
      END IF;

      details := details || jsonb_build_array(jsonb_build_object(
        'titulo', title_text, 'autor', coalesce(author_text,''), 'isbn', coalesce(isbn_text,''),
        'resolution', resolution, 'outcome', outcome, 'motivo', ''));
    EXCEPTION WHEN others THEN
      skipped := skipped + 1;
      errors := errors || jsonb_build_array(jsonb_build_object('titulo', coalesce(title_text, item->>'titulo'), 'erro', SQLERRM));
      details := details || jsonb_build_array(jsonb_build_object(
        'titulo', coalesce(title_text, item->>'titulo', ''), 'autor', coalesce(author_text,''),
        'isbn', coalesce(isbn_text,''), 'resolution', resolution,
        'outcome', 'error', 'motivo', SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'imported', imported, 'updated', updated, 'merged', merged, 'skipped', skipped,
    'errors', errors, 'details', details);
END;
$function$;

REVOKE ALL ON FUNCTION public.import_books_batch(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_books_batch(jsonb) TO authenticated;