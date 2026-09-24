
CREATE TABLE public.libraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  owner_id uuid,
  plan text NOT NULL DEFAULT 'free',
  subscription_status text,
  asaas_customer_id text,
  asaas_subscription_id text,
  current_period_end timestamptz,
  invite_code text NOT NULL UNIQUE DEFAULT upper(substr(md5(gen_random_uuid()::text),1,8)),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.libraries TO authenticated;
GRANT UPDATE (nome) ON public.libraries TO authenticated;
GRANT ALL ON public.libraries TO service_role;
ALTER TABLE public.libraries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD COLUMN active_library_id uuid REFERENCES public.libraries(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.current_library_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT active_library_id FROM public.profiles WHERE id = auth.uid() $$;
GRANT EXECUTE ON FUNCTION public.current_library_id() TO authenticated;

-- main library
INSERT INTO public.libraries (nome, owner_id, plan, subscription_status)
SELECT coalesce((SELECT value#>>'{}' FROM public.settings WHERE key='library_name'), 'Biblioteca principal'),
       (SELECT user_id FROM public.user_roles WHERE role='admin' ORDER BY created_at LIMIT 1),
       'unlimited', 'active';

DO $$
DECLARE main uuid := (SELECT id FROM public.libraries LIMIT 1);
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['books','categories','shelves','labels','loans','loan_requests','reservations','settings','user_roles','audit_log','import_logs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN library_id uuid REFERENCES public.libraries(id) ON DELETE CASCADE DEFAULT public.current_library_id()', t);
    EXECUTE format('UPDATE public.%I SET library_id = %L', t, main);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN library_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX ON public.%I (library_id)', t);
  END LOOP;
  UPDATE public.profiles SET active_library_id = main;
END $$;

ALTER TABLE public.categories DROP CONSTRAINT categories_nome_key;
ALTER TABLE public.categories ADD CONSTRAINT categories_library_nome_key UNIQUE (library_id, nome);
ALTER TABLE public.shelves DROP CONSTRAINT shelves_nome_key;
ALTER TABLE public.shelves ADD CONSTRAINT shelves_library_nome_key UNIQUE (library_id, nome);
ALTER TABLE public.settings DROP CONSTRAINT settings_pkey;
ALTER TABLE public.settings ADD PRIMARY KEY (library_id, key);
ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_lib_user_role_key UNIQUE (library_id, user_id, role);

-- role helpers now scoped to active library
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id = _user_id
  WHERE ur.user_id = _user_id AND ur.role = _role AND ur.library_id = p.active_library_id) $$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.profiles p ON p.id = _user_id
  WHERE ur.user_id = _user_id AND ur.role IN ('admin','bibliotecario') AND ur.library_id = p.active_library_id) $$;

CREATE OR REPLACE FUNCTION public.is_library_member(_library_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND library_id = _library_id) $$;
GRANT EXECUTE ON FUNCTION public.is_library_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin' AND library_id = public.current_library_id()) $$;

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); lib uuid := public.current_library_id();
BEGIN
  IF uid IS NULL OR lib IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin' AND library_id=lib) THEN RETURN FALSE; END IF;
  INSERT INTO public.user_roles (user_id, role, library_id) VALUES (uid,'admin',lib) ON CONFLICT DO NOTHING;
  RETURN TRUE;
END $$;

-- libraries policies
CREATE POLICY libraries_select_member ON public.libraries FOR SELECT TO authenticated USING (public.is_library_member(id));
CREATE POLICY libraries_update_admin ON public.libraries FOR UPDATE TO authenticated
  USING (id = public.current_library_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = public.current_library_id() AND public.has_role(auth.uid(),'admin'));

-- rewrite table policies
DROP POLICY books_manage_staff ON public.books; DROP POLICY books_select_all ON public.books;
CREATE POLICY books_select ON public.books FOR SELECT TO authenticated USING (library_id = public.current_library_id());
CREATE POLICY books_manage_staff ON public.books FOR ALL TO authenticated USING (library_id = public.current_library_id() AND public.is_staff(auth.uid())) WITH CHECK (library_id = public.current_library_id() AND public.is_staff(auth.uid()));

DROP POLICY categories_manage_staff ON public.categories; DROP POLICY categories_select_all ON public.categories;
CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated USING (library_id = public.current_library_id());
CREATE POLICY categories_manage_staff ON public.categories FOR ALL TO authenticated USING (library_id = public.current_library_id() AND public.is_staff(auth.uid())) WITH CHECK (library_id = public.current_library_id() AND public.is_staff(auth.uid()));

DROP POLICY shelves_manage_staff ON public.shelves; DROP POLICY shelves_select_auth ON public.shelves;
CREATE POLICY shelves_select ON public.shelves FOR SELECT TO authenticated USING (library_id = public.current_library_id());
CREATE POLICY shelves_manage_staff ON public.shelves FOR ALL TO authenticated USING (library_id = public.current_library_id() AND public.is_staff(auth.uid())) WITH CHECK (library_id = public.current_library_id() AND public.is_staff(auth.uid()));

DROP POLICY labels_manage_staff ON public.labels; DROP POLICY labels_select_auth ON public.labels;
CREATE POLICY labels_select ON public.labels FOR SELECT TO authenticated USING (library_id = public.current_library_id());
CREATE POLICY labels_manage_staff ON public.labels FOR ALL TO authenticated USING (library_id = public.current_library_id() AND public.is_staff(auth.uid())) WITH CHECK (library_id = public.current_library_id() AND public.is_staff(auth.uid()));

DROP POLICY loans_manage_staff ON public.loans; DROP POLICY loans_select_own_or_staff ON public.loans;
CREATE POLICY loans_select ON public.loans FOR SELECT TO authenticated USING (library_id = public.current_library_id() AND (auth.uid() = user_id OR public.is_staff(auth.uid())));
CREATE POLICY loans_manage_staff ON public.loans FOR ALL TO authenticated USING (library_id = public.current_library_id() AND public.is_staff(auth.uid())) WITH CHECK (library_id = public.current_library_id() AND public.is_staff(auth.uid()));

DROP POLICY loan_requests_delete_staff ON public.loan_requests; DROP POLICY loan_requests_insert_self ON public.loan_requests;
DROP POLICY loan_requests_select_own_or_staff ON public.loan_requests; DROP POLICY loan_requests_update_owner_note ON public.loan_requests; DROP POLICY loan_requests_update_staff ON public.loan_requests;
CREATE POLICY loan_requests_select ON public.loan_requests FOR SELECT TO authenticated USING (library_id = public.current_library_id() AND (auth.uid() = user_id OR public.is_staff(auth.uid())));
CREATE POLICY loan_requests_insert_self ON public.loan_requests FOR INSERT TO authenticated WITH CHECK (library_id = public.current_library_id() AND auth.uid() = user_id);
CREATE POLICY loan_requests_update_owner_note ON public.loan_requests FOR UPDATE TO authenticated USING (library_id = public.current_library_id() AND auth.uid() = user_id AND status='pendente') WITH CHECK (library_id = public.current_library_id() AND auth.uid() = user_id AND status='pendente');
CREATE POLICY loan_requests_manage_staff ON public.loan_requests FOR ALL TO authenticated USING (library_id = public.current_library_id() AND public.is_staff(auth.uid())) WITH CHECK (library_id = public.current_library_id() AND public.is_staff(auth.uid()));

DROP POLICY reservations_insert_self ON public.reservations; DROP POLICY reservations_manage_staff ON public.reservations; DROP POLICY reservations_select_own_or_staff ON public.reservations;
CREATE POLICY reservations_select ON public.reservations FOR SELECT TO authenticated USING (library_id = public.current_library_id() AND (auth.uid() = user_id OR public.is_staff(auth.uid())));
CREATE POLICY reservations_insert_self ON public.reservations FOR INSERT TO authenticated WITH CHECK (library_id = public.current_library_id() AND (auth.uid() = user_id OR public.is_staff(auth.uid())));
CREATE POLICY reservations_manage_staff ON public.reservations FOR ALL TO authenticated USING (library_id = public.current_library_id() AND public.is_staff(auth.uid())) WITH CHECK (library_id = public.current_library_id() AND public.is_staff(auth.uid()));

DROP POLICY settings_manage_admin ON public.settings; DROP POLICY settings_select_auth ON public.settings;
CREATE POLICY settings_select ON public.settings FOR SELECT TO authenticated USING (library_id = public.current_library_id());
CREATE POLICY settings_manage_admin ON public.settings FOR ALL TO authenticated USING (library_id = public.current_library_id() AND public.has_role(auth.uid(),'admin')) WITH CHECK (library_id = public.current_library_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY roles_manage_admin ON public.user_roles; DROP POLICY roles_select_own_or_staff ON public.user_roles;
CREATE POLICY roles_select ON public.user_roles FOR SELECT TO authenticated USING (library_id = public.current_library_id() AND (auth.uid() = user_id OR public.is_staff(auth.uid())));
CREATE POLICY roles_manage_admin ON public.user_roles FOR ALL TO authenticated USING (library_id = public.current_library_id() AND public.has_role(auth.uid(),'admin')) WITH CHECK (library_id = public.current_library_id() AND public.has_role(auth.uid(),'admin'));

DROP POLICY audit_log_staff_select ON public.audit_log;
CREATE POLICY audit_log_staff_select ON public.audit_log FOR SELECT TO authenticated USING (library_id = public.current_library_id() AND public.is_staff(auth.uid()));

DROP POLICY import_logs_insert_staff ON public.import_logs; DROP POLICY import_logs_select_staff ON public.import_logs;
CREATE POLICY import_logs_insert_staff ON public.import_logs FOR INSERT TO authenticated WITH CHECK (library_id = public.current_library_id() AND public.is_staff(auth.uid()));
CREATE POLICY import_logs_select_staff ON public.import_logs FOR SELECT TO authenticated USING (library_id = public.current_library_id() AND public.is_staff(auth.uid()));

DROP POLICY profiles_delete_staff ON public.profiles; DROP POLICY profiles_select_own_or_staff ON public.profiles; DROP POLICY profiles_update_own_or_staff ON public.profiles;
CREATE OR REPLACE FUNCTION public.is_member_of_my_library(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_uid AND library_id = public.current_library_id()) $$;
GRANT EXECUTE ON FUNCTION public.is_member_of_my_library(uuid) TO authenticated;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR (public.is_staff(auth.uid()) AND public.is_member_of_my_library(id)));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR (public.is_staff(auth.uid()) AND public.is_member_of_my_library(id)));

-- switch / join
CREATE OR REPLACE FUNCTION public.set_active_library(_library_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
  IF NOT public.is_library_member(_library_id) THEN RAISE EXCEPTION 'Você não participa desta biblioteca'; END IF;
  UPDATE public.profiles SET active_library_id = _library_id WHERE id = auth.uid();
  RETURN TRUE; END $$;

CREATE OR REPLACE FUNCTION public.join_library(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE lib uuid; BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT id INTO lib FROM public.libraries WHERE invite_code = upper(trim(_code));
  IF lib IS NULL THEN RAISE EXCEPTION 'Código de convite inválido'; END IF;
  INSERT INTO public.user_roles (user_id, role, library_id) VALUES (auth.uid(), 'membro', lib) ON CONFLICT DO NOTHING;
  UPDATE public.profiles SET active_library_id = lib WHERE id = auth.uid();
  RETURN lib; END $$;

CREATE OR REPLACE FUNCTION public.create_library(_nome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE lib uuid; BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  INSERT INTO public.libraries (nome, owner_id) VALUES (coalesce(nullif(trim(_nome),''),'Minha Biblioteca'), auth.uid()) RETURNING id INTO lib;
  INSERT INTO public.user_roles (user_id, role, library_id) VALUES (auth.uid(), 'admin', lib);
  INSERT INTO public.settings (library_id, key, value) VALUES (lib, 'library_name', to_jsonb(coalesce(nullif(trim(_nome),''),'Minha Biblioteca')));
  UPDATE public.profiles SET active_library_id = lib WHERE id = auth.uid();
  RETURN lib; END $$;

CREATE OR REPLACE FUNCTION public.regenerate_invite_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE c text := upper(substr(md5(gen_random_uuid()::text),1,8)); BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Permissão negada'; END IF;
  UPDATE public.libraries SET invite_code = c WHERE id = public.current_library_id();
  RETURN c; END $$;

REVOKE ALL ON FUNCTION public.set_active_library(uuid), public.join_library(text), public.create_library(text), public.regenerate_invite_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_active_library(uuid), public.join_library(text), public.create_library(text), public.regenerate_invite_code() TO authenticated;

-- new users get their own free library
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE lib uuid; nm text := COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1));
BEGIN
  INSERT INTO public.libraries (nome, owner_id) VALUES ('Biblioteca de ' || nm, NEW.id) RETURNING id INTO lib;
  INSERT INTO public.profiles (id, nome, email, numero, active_library_id) VALUES (NEW.id, nm, NEW.email, public.generate_profile_number(), lib);
  INSERT INTO public.user_roles (user_id, role, library_id) VALUES (NEW.id, 'admin', lib);
  INSERT INTO public.settings (library_id, key, value) VALUES (lib, 'library_name', to_jsonb('Biblioteca de ' || nm));
  RETURN NEW; END $$;

-- free plan limit
CREATE OR REPLACE FUNCTION public.enforce_book_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE p text; st text; n int; BEGIN
  SELECT plan, subscription_status INTO p, st FROM public.libraries WHERE id = NEW.library_id;
  IF p = 'unlimited' OR (p = 'pro' AND coalesce(st,'') IN ('active','overdue_grace')) THEN RETURN NEW; END IF;
  SELECT count(*) INTO n FROM public.books WHERE library_id = NEW.library_id;
  IF n >= 150 THEN RAISE EXCEPTION 'Limite do plano gratuito atingido (150 livros). Faça upgrade para o plano Pro.'; END IF;
  RETURN NEW; END $$;
CREATE TRIGGER trg_books_limit BEFORE INSERT ON public.books FOR EACH ROW EXECUTE FUNCTION public.enforce_book_limit();

CREATE OR REPLACE FUNCTION public.library_usage()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT jsonb_build_object('books', (SELECT count(*) FROM public.books WHERE library_id = l.id), 'limit', 150,
  'plan', l.plan, 'status', l.subscription_status, 'nome', l.nome, 'invite_code', CASE WHEN public.has_role(auth.uid(),'admin') THEN l.invite_code END)
  FROM public.libraries l WHERE l.id = public.current_library_id() AND public.is_library_member(l.id) $$;
GRANT EXECUTE ON FUNCTION public.library_usage() TO authenticated;

-- cross-library guards in RPCs
CREATE OR REPLACE FUNCTION public.create_loan(_book_id uuid, _user_id uuid, _dias integer DEFAULT 14)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE caller uuid := auth.uid(); lib uuid := public.current_library_id(); new_id uuid; qtd integer;
BEGIN
  IF NOT public.is_staff(caller) THEN RAISE EXCEPTION 'Permissão negada'; END IF;
  SELECT quantidade_disponivel INTO qtd FROM public.books WHERE id = _book_id AND library_id = lib FOR UPDATE;
  IF qtd IS NULL THEN RAISE EXCEPTION 'Livro não encontrado'; END IF;
  IF qtd < 1 THEN RAISE EXCEPTION 'Livro indisponível'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND library_id=lib) THEN RAISE EXCEPTION 'Usuário não pertence a esta biblioteca'; END IF;
  UPDATE public.books SET quantidade_disponivel = quantidade_disponivel - 1 WHERE id = _book_id;
  INSERT INTO public.loans (book_id, user_id, data_devolucao_prevista, library_id)
    VALUES (_book_id, _user_id, (CURRENT_DATE + (_dias || ' days')::interval)::date, lib) RETURNING id INTO new_id;
  UPDATE public.loan_requests SET status='aprovado', decided_at=now(), decided_by=caller
    WHERE book_id=_book_id AND user_id=_user_id AND status='pendente' AND library_id=lib;
  RETURN new_id; END $$;

CREATE OR REPLACE FUNCTION public.request_loan(_book_id uuid, _observacao text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE uid uuid := auth.uid(); lib uuid := public.current_library_id(); new_id uuid; BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.books WHERE id=_book_id AND library_id=lib) THEN RAISE EXCEPTION 'Livro não encontrado'; END IF;
  IF EXISTS (SELECT 1 FROM public.loan_requests WHERE user_id = uid AND book_id = _book_id AND status = 'pendente') THEN
    RAISE EXCEPTION 'Você já possui uma solicitação pendente para este livro'; END IF;
  INSERT INTO public.loan_requests (book_id, user_id, observacao, library_id) VALUES (_book_id, uid, _observacao, lib) RETURNING id INTO new_id;
  RETURN new_id; END $$;

CREATE OR REPLACE FUNCTION public.approve_loan_request(_request_id uuid, _dias integer DEFAULT 14)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE caller uuid := auth.uid(); req RECORD; loan_id uuid; BEGIN
  IF NOT public.is_staff(caller) THEN RAISE EXCEPTION 'Permissão negada'; END IF;
  SELECT * INTO req FROM public.loan_requests WHERE id = _request_id AND library_id = public.current_library_id() FOR UPDATE;
  IF req IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF req.status <> 'pendente' THEN RAISE EXCEPTION 'Solicitação já decidida'; END IF;
  loan_id := public.create_loan(req.book_id, req.user_id, _dias);
  UPDATE public.loan_requests SET status = 'aprovado', decided_at = now(), decided_by = caller WHERE id = _request_id;
  RETURN loan_id; END $$;

CREATE OR REPLACE FUNCTION public.reject_loan_request(_request_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE caller uuid := auth.uid(); BEGIN
  IF NOT public.is_staff(caller) THEN RAISE EXCEPTION 'Permissão negada'; END IF;
  UPDATE public.loan_requests SET status = 'rejeitado', decided_at = now(), decided_by = caller
    WHERE id = _request_id AND status = 'pendente' AND library_id = public.current_library_id();
  RETURN FOUND; END $$;

CREATE OR REPLACE FUNCTION public.cancel_loan_request(_request_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE caller uuid := auth.uid(); req RECORD; BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO req FROM public.loan_requests WHERE id = _request_id AND library_id = public.current_library_id() FOR UPDATE;
  IF req IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF req.status <> 'pendente' THEN RAISE EXCEPTION 'Solicitação já decidida'; END IF;
  IF NOT (public.is_staff(caller) OR req.user_id = caller) THEN RAISE EXCEPTION 'Permissão negada'; END IF;
  UPDATE public.loan_requests SET status = 'cancelado', decided_at = now(), decided_by = caller WHERE id = _request_id;
  RETURN TRUE; END $$;

CREATE OR REPLACE FUNCTION public.update_loan_due_date(_loan_id uuid, _new_date date)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Permissão negada'; END IF;
  UPDATE public.loans SET data_devolucao_prevista = _new_date WHERE id = _loan_id AND status = 'ativo' AND library_id = public.current_library_id();
  RETURN FOUND; END $$;

CREATE OR REPLACE FUNCTION public.return_loan(_loan_id uuid, _observacao text DEFAULT NULL::text, _condicao text DEFAULT NULL::text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE caller uuid := auth.uid(); l RECORD; dias_atraso integer; multa_dia numeric; multa_total numeric := 0;
BEGIN
  SELECT * INTO l FROM public.loans WHERE id = _loan_id AND library_id = public.current_library_id() FOR UPDATE;
  IF l IS NULL THEN RAISE EXCEPTION 'Empréstimo não encontrado'; END IF;
  IF NOT (public.is_staff(caller) OR l.user_id = caller) THEN RAISE EXCEPTION 'Permissão negada'; END IF;
  IF l.status = 'concluido' THEN RAISE EXCEPTION 'Empréstimo já concluído'; END IF;
  SELECT (value#>>'{}')::numeric INTO multa_dia FROM public.settings WHERE key='multa_por_dia' AND library_id = l.library_id;
  multa_dia := coalesce(multa_dia, 0);
  dias_atraso := GREATEST(0, (CURRENT_DATE - l.data_devolucao_prevista));
  multa_total := dias_atraso * multa_dia;
  UPDATE public.loans SET status='concluido', data_devolucao_real = now(), multa = multa_total,
    devolucao_observacao = COALESCE(_observacao, devolucao_observacao), devolucao_condicao = COALESCE(_condicao, devolucao_condicao)
    WHERE id = _loan_id;
  UPDATE public.books SET quantidade_disponivel = quantidade_disponivel + 1 WHERE id = l.book_id;
  RETURN multa_total; END $$;

CREATE OR REPLACE FUNCTION public.return_loan(_loan_id uuid)
RETURNS numeric LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.return_loan(_loan_id, NULL::text, NULL::text) $$;

CREATE OR REPLACE FUNCTION public.merge_books(_target_id uuid, _source_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE lib uuid := public.current_library_id(); tgt RECORD; src RECORD; added_total int; added_disp int;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Permissão negada'; END IF;
  IF _target_id = _source_id THEN RAISE EXCEPTION 'IDs iguais'; END IF;
  SELECT * INTO tgt FROM public.books WHERE id = _target_id AND library_id = lib FOR UPDATE;
  IF tgt IS NULL THEN RAISE EXCEPTION 'Livro alvo não encontrado'; END IF;
  SELECT * INTO src FROM public.books WHERE id = _source_id AND library_id = lib FOR UPDATE;
  IF src IS NULL THEN RAISE EXCEPTION 'Livro de origem não encontrado'; END IF;
  added_total := COALESCE(src.quantidade_total, 0); added_disp := COALESCE(src.quantidade_disponivel, 0);
  UPDATE public.loans SET book_id = _target_id WHERE book_id = _source_id;
  UPDATE public.loan_requests SET book_id = _target_id WHERE book_id = _source_id;
  UPDATE public.reservations SET book_id = _target_id WHERE book_id = _source_id;
  UPDATE public.labels SET book_id = _target_id WHERE book_id = _source_id;
  UPDATE public.books SET quantidade_total = COALESCE(quantidade_total,0) + added_total,
    quantidade_disponivel = COALESCE(quantidade_disponivel,0) + added_disp,
    isbn = COALESCE(isbn, src.isbn), editora = COALESCE(editora, src.editora), ano = COALESCE(ano, src.ano),
    numero_paginas = COALESCE(numero_paginas, src.numero_paginas), sinopse = COALESCE(sinopse, src.sinopse),
    capa_url = COALESCE(capa_url, src.capa_url), idioma = COALESCE(idioma, src.idioma),
    localizacao_prateleira = COALESCE(localizacao_prateleira, src.localizacao_prateleira), categoria_id = COALESCE(categoria_id, src.categoria_id)
    WHERE id = _target_id;
  DELETE FROM public.books WHERE id = _source_id;
  RETURN jsonb_build_object('added_total', added_total, 'added_disp', added_disp); END $$;
