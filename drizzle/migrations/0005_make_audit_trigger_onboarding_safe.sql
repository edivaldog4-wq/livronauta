CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  lib uuid;
BEGIN
  IF uid IS NOT NULL THEN
    SELECT email INTO uemail FROM auth.users WHERE id = uid;
  END IF;

  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    rid := coalesce(old_json->>'id','');
    lib := NULLIF(old_json->>'library_id','')::uuid;
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
    lib := NULLIF(new_json->>'library_id','')::uuid;
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
  ELSE
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    rid := coalesce(new_json->>'id','');
    lib := COALESCE(NULLIF(new_json->>'library_id','')::uuid, NULLIF(old_json->>'library_id','')::uuid);
    diff_json := '{}'::jsonb;
    FOR k IN SELECT jsonb_object_keys(new_json) LOOP
      IF (old_json->k) IS DISTINCT FROM (new_json->k) THEN
        diff_json := diff_json || jsonb_build_object(k, jsonb_build_object('de', old_json->k, 'para', new_json->k));
      END IF;
    END LOOP;
    summ := format('Editado em %s', TG_TABLE_NAME);
    IF TG_TABLE_NAME = 'books' THEN summ := format('Livro editado: %s', new_json->>'titulo');
    ELSIF TG_TABLE_NAME = 'loans' THEN
      IF (old_json->>'status') IS DISTINCT FROM (new_json->>'status') AND new_json->>'status' = 'concluido' THEN summ := 'Devolução registrada';
      ELSE summ := 'Empréstimo atualizado'; END IF;
    ELSIF TG_TABLE_NAME = 'loan_requests' THEN
      IF (old_json->>'status') IS DISTINCT FROM (new_json->>'status') THEN summ := format('Solicitação %s', new_json->>'status');
      ELSE summ := 'Solicitação atualizada'; END IF;
    ELSIF TG_TABLE_NAME = 'categories' THEN summ := format('Categoria editada: %s', new_json->>'nome');
    ELSIF TG_TABLE_NAME = 'shelves' THEN summ := format('Estante editada: %s', new_json->>'nome');
    ELSIF TG_TABLE_NAME = 'settings' THEN summ := format('Configuração alterada: %s', new_json->>'key');
    ELSIF TG_TABLE_NAME = 'user_roles' THEN summ := format('Papel alterado: %s', new_json->>'role');
    END IF;
  END IF;

  lib := COALESCE(lib, public.current_library_id());
  IF lib IS NOT NULL THEN
    INSERT INTO public.audit_log(actor_id, actor_email, table_name, operation, row_id, summary, diff, library_id)
    VALUES (uid, uemail, TG_TABLE_NAME, TG_OP, rid, summ, diff_json, lib);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_log_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_log_trigger() TO service_role;