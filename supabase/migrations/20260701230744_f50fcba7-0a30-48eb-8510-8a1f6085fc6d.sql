
-- =========================================
-- AUDIT LOG
-- =========================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  actor_email text,
  table_name text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  row_id text,
  summary text,
  diff jsonb
);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_staff_select" ON public.audit_log;
CREATE POLICY "audit_log_staff_select" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_table_idx ON public.audit_log (table_name, created_at DESC);

-- Trigger function: build a compact human summary and diff
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  rid text;
  summ text;
  diff_json jsonb := NULL;
  new_json jsonb;
  old_json jsonb;
  k text;
BEGIN
  SELECT email INTO uemail FROM auth.users WHERE id = uid;

  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    rid := coalesce(old_json->>'id','');
    summ := format('Excluído em %s', TG_TABLE_NAME);
    IF TG_TABLE_NAME = 'books' THEN summ := format('Livro removido: %s', old_json->>'titulo');
    ELSIF TG_TABLE_NAME = 'loans' THEN summ := 'Empréstimo removido';
    ELSIF TG_TABLE_NAME = 'loan_requests' THEN summ := 'Solicitação removida';
    ELSIF TG_TABLE_NAME = 'categories' THEN summ := format('Categoria removida: %s', old_json->>'nome');
    ELSIF TG_TABLE_NAME = 'shelves' THEN summ := format('Estante removida: %s', old_json->>'nome');
    ELSIF TG_TABLE_NAME = 'user_roles' THEN summ := format('Papel removido: %s de %s', old_json->>'role', old_json->>'user_id');
    END IF;
    diff_json := jsonb_build_object('old', old_json);
  ELSIF TG_OP = 'INSERT' THEN
    new_json := to_jsonb(NEW);
    rid := coalesce(new_json->>'id','');
    summ := format('Criado em %s', TG_TABLE_NAME);
    IF TG_TABLE_NAME = 'books' THEN summ := format('Livro cadastrado: %s', new_json->>'titulo');
    ELSIF TG_TABLE_NAME = 'loans' THEN summ := 'Empréstimo registrado';
    ELSIF TG_TABLE_NAME = 'loan_requests' THEN summ := 'Nova solicitação de empréstimo';
    ELSIF TG_TABLE_NAME = 'categories' THEN summ := format('Categoria criada: %s', new_json->>'nome');
    ELSIF TG_TABLE_NAME = 'shelves' THEN summ := format('Estante criada: %s', new_json->>'nome');
    ELSIF TG_TABLE_NAME = 'user_roles' THEN summ := format('Papel atribuído: %s a %s', new_json->>'role', new_json->>'user_id');
    ELSIF TG_TABLE_NAME = 'settings' THEN summ := format('Configuração criada: %s', new_json->>'key');
    END IF;
    diff_json := jsonb_build_object('new', new_json);
  ELSE -- UPDATE
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    rid := coalesce(new_json->>'id','');
    -- Compute changed fields
    diff_json := '{}'::jsonb;
    FOR k IN SELECT jsonb_object_keys(new_json) LOOP
      IF (old_json->k) IS DISTINCT FROM (new_json->k) THEN
        diff_json := diff_json || jsonb_build_object(k, jsonb_build_object('de', old_json->k, 'para', new_json->k));
      END IF;
    END LOOP;
    summ := format('Editado em %s', TG_TABLE_NAME);
    IF TG_TABLE_NAME = 'books' THEN summ := format('Livro editado: %s', new_json->>'titulo');
    ELSIF TG_TABLE_NAME = 'loans' THEN
      IF (old_json->>'status') IS DISTINCT FROM (new_json->>'status') AND new_json->>'status' = 'concluido' THEN
        summ := 'Devolução registrada';
      ELSE summ := 'Empréstimo atualizado';
      END IF;
    ELSIF TG_TABLE_NAME = 'loan_requests' THEN
      IF (old_json->>'status') IS DISTINCT FROM (new_json->>'status') THEN
        summ := format('Solicitação %s', new_json->>'status');
      ELSE summ := 'Solicitação atualizada';
      END IF;
    ELSIF TG_TABLE_NAME = 'categories' THEN summ := format('Categoria editada: %s', new_json->>'nome');
    ELSIF TG_TABLE_NAME = 'shelves' THEN summ := format('Estante editada: %s', new_json->>'nome');
    ELSIF TG_TABLE_NAME = 'settings' THEN summ := format('Configuração alterada: %s', new_json->>'key');
    ELSIF TG_TABLE_NAME = 'user_roles' THEN summ := format('Papel alterado: %s', new_json->>'role');
    END IF;
  END IF;

  INSERT INTO public.audit_log(actor_id, actor_email, table_name, operation, row_id, summary, diff)
  VALUES (uid, uemail, TG_TABLE_NAME, TG_OP, rid, summ, diff_json);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Attach triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['books','loans','loan_requests','categories','shelves','settings','user_roles'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$s;', t);
    EXECUTE format('CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();', t);
  END LOOP;
END $$;

-- =========================================
-- SECURITY FIX: loan_requests self-approval
-- Split UPDATE policy so owners cannot change status/decided_*
-- =========================================
DROP POLICY IF EXISTS loan_requests_update_owner_or_staff ON public.loan_requests;
DROP POLICY IF EXISTS loan_requests_update_owner_note ON public.loan_requests;
DROP POLICY IF EXISTS loan_requests_update_staff ON public.loan_requests;

-- Staff can update any field
CREATE POLICY loan_requests_update_staff ON public.loan_requests
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Owners can update ONLY their observacao while pending; enforced by a BEFORE UPDATE trigger.
CREATE POLICY loan_requests_update_owner_note ON public.loan_requests
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pendente')
  WITH CHECK (auth.uid() = user_id AND status = 'pendente');

CREATE OR REPLACE FUNCTION public.loan_requests_owner_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Staff bypass
  IF public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- Non-staff owner path: only observacao may change; other columns must stay
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.decided_by IS DISTINCT FROM OLD.decided_by
     OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.book_id IS DISTINCT FROM OLD.book_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Somente a equipe pode alterar esses campos da solicitação';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loan_requests_owner_guard ON public.loan_requests;
CREATE TRIGGER trg_loan_requests_owner_guard
  BEFORE UPDATE ON public.loan_requests
  FOR EACH ROW EXECUTE FUNCTION public.loan_requests_owner_update_guard();

-- =========================================
-- SECURITY FIX: realtime leaks
-- Remove loans / loan_requests from realtime publication so subscriptions
-- cannot bypass RLS via realtime.messages. UI already refetches on focus and
-- via query invalidation after mutations.
-- =========================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.loans;
    EXCEPTION WHEN undefined_object THEN NULL; END;
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.loan_requests;
    EXCEPTION WHEN undefined_object THEN NULL; END;
  END IF;
END $$;
