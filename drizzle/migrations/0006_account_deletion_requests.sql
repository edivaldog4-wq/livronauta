CREATE TABLE public.account_deletion_requests (
  user_id uuid PRIMARY KEY,
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  canceled_at timestamptz,
  completed_at timestamptz
);
GRANT SELECT ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_deletion_select_self ON public.account_deletion_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  due_at timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.libraries WHERE owner_id = uid) THEN
    RAISE EXCEPTION 'Somente o titular de uma biblioteca pode solicitar a exclusão completa';
  END IF;
  due_at := now() + interval '30 days';
  INSERT INTO public.account_deletion_requests (user_id, requested_at, scheduled_for, canceled_at, completed_at)
  VALUES (uid, now(), due_at, NULL, NULL)
  ON CONFLICT (user_id) DO UPDATE
    SET requested_at = excluded.requested_at,
        scheduled_for = excluded.scheduled_for,
        canceled_at = NULL,
        completed_at = NULL;
  RETURN jsonb_build_object('status', 'pending', 'scheduled_for', due_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  UPDATE public.account_deletion_requests
     SET canceled_at = now()
   WHERE user_id = auth.uid() AND canceled_at IS NULL AND completed_at IS NULL;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.account_deletion_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    ELSE COALESCE(
      (SELECT jsonb_build_object(
        'status', CASE WHEN completed_at IS NOT NULL THEN 'completed' WHEN canceled_at IS NOT NULL THEN 'canceled' ELSE 'pending' END,
        'requested_at', requested_at,
        'scheduled_for', scheduled_for
      )
      FROM public.account_deletion_requests
      WHERE user_id = auth.uid()),
      jsonb_build_object('status', 'none')
    )
  END
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion(), public.cancel_account_deletion(), public.account_deletion_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(), public.cancel_account_deletion(), public.account_deletion_status() TO authenticated;