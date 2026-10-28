-- Historical evidence is a marker, not a made-up first-payment timestamp.
UPDATE public.libraries SET first_paid_activation_at = NULL
WHERE first_paid_source = 'historical_backfill';

CREATE OR REPLACE FUNCTION public.protect_library_marketing_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF coalesce(auth.role(), '') <> 'service_role' AND (
 NEW.first_paid_activation_at IS DISTINCT FROM OLD.first_paid_activation_at OR
 NEW.first_paid_payment_id IS DISTINCT FROM OLD.first_paid_payment_id OR
 NEW.first_paid_source IS DISTINCT FROM OLD.first_paid_source) THEN
 RAISE EXCEPTION 'Alterações de confirmação de assinatura exigem operação protegida';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_library_marketing BEFORE UPDATE ON public.libraries
FOR EACH ROW EXECUTE FUNCTION public.protect_library_marketing_fields();

DROP FUNCTION public.record_asaas_paid_payment(uuid,text,numeric,text);
CREATE FUNCTION public.record_asaas_paid_payment(_library_id uuid, _payment_id text, _value numeric, _environment text, _paid_at timestamptz)
RETURNS TABLE(event_row_id uuid, event_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _lib record; _attr uuid; _event_id text;
BEGIN
 IF _payment_id IS NULL OR _payment_id !~ '^[A-Za-z0-9_-]{1,100}$'
 OR _value IS NULL OR _value <= 0 OR _paid_at IS NULL OR _paid_at > now() + interval '1 minute'
 OR _environment NOT IN ('production','sandbox') THEN RAISE EXCEPTION 'invalid payment'; END IF;
 SELECT * INTO _lib FROM libraries WHERE id = _library_id FOR UPDATE;
 IF NOT FOUND OR _lib.complimentary_access OR _lib.plan = 'unlimited' THEN RETURN; END IF;
 SELECT a.id INTO _attr FROM meta_checkout_attribution a
 WHERE a.library_id = _library_id ORDER BY a.created_at DESC LIMIT 1;
 _event_id := CASE WHEN _environment = 'production' THEN 'asaas_pay_' ELSE 'asaas_sandbox_pay_' END || _payment_id;
 INSERT INTO meta_capi_events (event_name,event_id,library_id,asaas_payment_id,asaas_customer_id,attribution_id,value,environment,event_time,status)
 VALUES ('Purchase',_event_id,_library_id,_payment_id,_lib.asaas_customer_id,_attr,_value,_environment,_paid_at,
 CASE WHEN _environment = 'sandbox' THEN 'skipped_test'
 WHEN _paid_at < now() - interval '7 days' THEN 'expired' ELSE 'pending' END)
 ON CONFLICT ON CONSTRAINT meta_capi_events_event_name_event_id_key DO NOTHING;
 -- Test payments cannot consume a production subscription's first activation.
 IF _environment = 'production' AND _lib.first_paid_activation_at IS NULL AND _lib.first_paid_source IS NULL THEN
  UPDATE libraries SET first_paid_activation_at = _paid_at, first_paid_payment_id = _payment_id,
   first_paid_source = 'asaas_webhook' WHERE id = _library_id;
  INSERT INTO meta_capi_events (event_name,event_id,library_id,asaas_payment_id,asaas_customer_id,attribution_id,value,environment,event_time,history_verified,status)
  VALUES ('Subscribe','asaas_sub_' || _library_id::text,_library_id,_payment_id,_lib.asaas_customer_id,_attr,_value,_environment,_paid_at,false,
   CASE WHEN _paid_at < now() - interval '7 days' THEN 'expired' ELSE 'pending' END)
  ON CONFLICT DO NOTHING;
 END IF;
 -- Replayed Asaas confirmations also recover existing failed/pending reports.
 RETURN QUERY SELECT e.id,e.event_name FROM meta_capi_events e
 WHERE e.library_id = _library_id AND e.asaas_payment_id = _payment_id
 AND e.environment = _environment AND e.status IN ('pending','failed');
END $$;
REVOKE ALL ON FUNCTION public.record_asaas_paid_payment(uuid,text,numeric,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_asaas_paid_payment(uuid,text,numeric,text,timestamptz) TO service_role;
