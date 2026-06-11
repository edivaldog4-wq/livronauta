REVOKE EXECUTE ON FUNCTION public.import_books_batch(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.import_books_batch(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.import_books_batch(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_books_batch(jsonb) TO service_role;