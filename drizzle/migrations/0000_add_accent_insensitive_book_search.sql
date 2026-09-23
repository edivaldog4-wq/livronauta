ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS titulo_busca text GENERATED ALWAYS AS (public.normalize_book_text(titulo)) STORED,
  ADD COLUMN IF NOT EXISTS autor_busca text GENERATED ALWAYS AS (public.normalize_book_text(autor)) STORED;

CREATE INDEX IF NOT EXISTS books_titulo_busca_idx ON public.books (titulo_busca text_pattern_ops);
CREATE INDEX IF NOT EXISTS books_autor_busca_idx ON public.books (autor_busca text_pattern_ops);

DROP POLICY IF EXISTS settings_select_auth ON public.settings;
CREATE POLICY settings_select_auth
ON public.settings
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);