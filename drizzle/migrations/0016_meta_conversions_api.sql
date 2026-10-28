ALTER TABLE public.libraries ADD COLUMN first_paid_activation_at timestamptz, ADD COLUMN first_paid_payment_id text, ADD COLUMN first_paid_source text;
UPDATE public.libraries SET first_paid_activation_at = COALESCE(current_period_end, now()), first_paid_source = 'historical_backfill'
 WHERE asaas_subscription_id IS NOT NULL AND (subscription_status IN ('active','overdue','canceled') OR current_period_end IS NOT NULL);

CREATE TABLE public.marketing_consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  choice text NOT NULL CHECK (choice IN ('granted','denied')),
  notice_version text NOT NULL CHECK (char_length(notice_version) <= 40),
  source text NOT NULL CHECK (source IN ('banner','signup','checkout')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marketing_consent_records_user_idx ON public.marketing_consent_records (user_id, created_at DESC);
GRANT ALL ON public.marketing_consent_records TO service_role;
ALTER TABLE public.marketing_consent_records ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.meta_checkout_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  consent_record_id uuid REFERENCES public.marketing_consent_records(id),
  em_hash text CHECK (em_hash ~ '^[0-9a-f]{64}$'),
  external_id_hash text CHECK (external_id_hash ~ '^[0-9a-f]{64}$'),
  fbp text CHECK (char_length(fbp) <= 120),
  fbc text CHECK (char_length(fbc) <= 500),
  client_ip text CHECK (char_length(client_ip) <= 64),
  client_user_agent text CHECK (char_length(client_user_agent) <= 512),
  event_source_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meta_checkout_attribution_lib_idx ON public.meta_checkout_attribution (library_id, created_at DESC);
GRANT ALL ON public.meta_checkout_attribution TO service_role;
ALTER TABLE public.meta_checkout_attribution ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.meta_capi_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL CHECK (event_name IN ('Purchase','Subscribe')),
  event_id text NOT NULL,
  library_id uuid NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
  asaas_payment_id text NOT NULL,
  asaas_customer_id text,
  attribution_id uuid REFERENCES public.meta_checkout_attribution(id) ON DELETE SET NULL,
  value numeric(12,2) NOT NULL CHECK (value > 0),
  currency text NOT NULL DEFAULT 'BRL',
  event_time timestamptz NOT NULL DEFAULT now(),
  environment text NOT NULL CHECK (environment IN ('production','sandbox')),
  history_verified boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','blocked_consent','skipped_test','skipped_existing_customer','expired','canceled_refund')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text CHECK (char_length(last_error) <= 500),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_name, event_id)
);
CREATE UNIQUE INDEX meta_capi_one_subscribe_per_library ON public.meta_capi_events (library_id) WHERE event_name = 'Subscribe';
CREATE INDEX meta_capi_events_status_idx ON public.meta_capi_events (status, created_at);
GRANT ALL ON public.meta_capi_events TO service_role;
ALTER TABLE public.meta_capi_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_asaas_paid_payment(_library_id uuid, _payment_id text, _value numeric, _environment text)
RETURNS TABLE(event_row_id uuid, event_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _lib record; _attr uuid; _first boolean := false; _pid uuid; _sid uuid;
BEGIN
  IF _payment_id IS NULL OR _payment_id !~ '^[A-Za-z0-9_-]{1,100}$' OR _value IS NULL OR _value <= 0 THEN RAISE EXCEPTION 'invalid payment'; END IF;
  SELECT * INTO _lib FROM libraries WHERE id = _library_id FOR UPDATE;
  IF NOT FOUND OR _lib.complimentary_access OR _lib.plan = 'unlimited' THEN RETURN; END IF;
  SELECT a.id INTO _attr FROM meta_checkout_attribution a WHERE a.library_id = _library_id ORDER BY a.created_at DESC LIMIT 1;
  INSERT INTO meta_capi_events (event_name, event_id, library_id, asaas_payment_id, asaas_customer_id, attribution_id, value, environment, status)
  VALUES ('Purchase', 'asaas_pay_' || _payment_id, _library_id, _payment_id, _lib.asaas_customer_id, _attr, _value, _environment,
          CASE WHEN _environment = 'production' THEN 'pending' ELSE 'skipped_test' END)
  ON CONFLICT ON CONSTRAINT meta_capi_events_event_name_event_id_key DO NOTHING RETURNING id INTO _pid;
  IF _pid IS NOT NULL THEN event_row_id := _pid; event_name := 'Purchase'; RETURN NEXT; END IF;
  IF _lib.first_paid_activation_at IS NULL THEN
    UPDATE libraries SET first_paid_activation_at = now(), first_paid_payment_id = _payment_id, first_paid_source = 'asaas_webhook' WHERE id = _library_id;
    INSERT INTO meta_capi_events (event_name, event_id, library_id, asaas_payment_id, asaas_customer_id, attribution_id, value, environment, history_verified, status)
    VALUES ('Subscribe', 'asaas_sub_' || _library_id::text, _library_id, _payment_id, _lib.asaas_customer_id, _attr, _value, _environment, false,
            CASE WHEN _environment = 'production' THEN 'pending' ELSE 'skipped_test' END)
    ON CONFLICT DO NOTHING RETURNING id INTO _sid;
    IF _sid IS NOT NULL THEN event_row_id := _sid; event_name := 'Subscribe'; RETURN NEXT; END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_unsent_meta_events_for_payment(_payment_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE meta_capi_events SET status = 'canceled_refund' WHERE asaas_payment_id = _payment_id AND status IN ('pending','failed');
$$;

CREATE OR REPLACE FUNCTION public.claim_meta_capi_events(_ids uuid[] DEFAULT NULL, _limit int DEFAULT 25)
RETURNS SETOF public.meta_capi_events LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE meta_capi_events e SET status = 'sending', last_attempt_at = now(), attempts = e.attempts + 1
  WHERE e.id IN (
    SELECT id FROM meta_capi_events
    WHERE (_ids IS NULL OR id = ANY(_ids))
      AND (status IN ('pending','failed') OR (status = 'sending' AND last_attempt_at < now() - interval '5 minutes'))
    ORDER BY created_at LIMIT LEAST(GREATEST(_limit,1),100) FOR UPDATE SKIP LOCKED)
  RETURNING e.*;
$$;

REVOKE ALL ON FUNCTION public.record_asaas_paid_payment(uuid,text,numeric,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_unsent_meta_events_for_payment(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_meta_capi_events(uuid[],int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_asaas_paid_payment(uuid,text,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_unsent_meta_events_for_payment(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_meta_capi_events(uuid[],int) TO service_role;