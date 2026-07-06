-- Restore EXECUTE for signed-in users on role-check helper functions.
-- These are called by row-access policies; without EXECUTE, every role check
-- fails and all users appear as plain members. Anonymous access stays revoked.
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;