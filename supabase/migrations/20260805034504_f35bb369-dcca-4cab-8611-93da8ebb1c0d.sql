ALTER TABLE public.labels DROP CONSTRAINT IF EXISTS labels_codigo_barras_key;
ALTER TABLE public.labels ALTER COLUMN codigo_barras DROP NOT NULL;
UPDATE public.labels SET codigo_barras = NULL WHERE btrim(coalesce(codigo_barras,'')) = '';