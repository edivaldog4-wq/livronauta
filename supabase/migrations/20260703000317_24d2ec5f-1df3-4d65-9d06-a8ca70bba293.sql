-- Fix search_path on set_updated_at
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- Revoke public execute on all SECURITY DEFINER + helper functions
REVOKE EXECUTE ON FUNCTION public.approve_loan_request(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_log_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_loan(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_profile_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.import_books_batch(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.loan_requests_owner_update_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.merge_books(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_book_text(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_loan_request(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.request_loan(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.return_loan(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.return_loan(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_loan_due_date(uuid, date) FROM PUBLIC, anon, authenticated;

-- Re-grant EXECUTE to authenticated ONLY on RPCs the app calls
GRANT EXECUTE ON FUNCTION public.approve_loan_request(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_loan(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_books_batch(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_books(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_loan_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_loan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_loan(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_loan_due_date(uuid, date) TO authenticated;