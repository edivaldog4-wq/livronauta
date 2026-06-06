
-- ============== ENUM ==============
CREATE TYPE public.app_role AS ENUM ('admin', 'bibliotecario', 'membro');
CREATE TYPE public.loan_status AS ENUM ('ativo', 'concluido');
CREATE TYPE public.reservation_status AS ENUM ('ativa', 'cancelada', 'concluida');

-- ============== PROFILES ==============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  telefone TEXT,
  endereco TEXT,
  data_cadastro TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============== USER_ROLES ==============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- is_staff: admin or bibliotecario
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','bibliotecario')
  )
$$;

-- ============== CATEGORIES ==============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- ============== BOOKS ==============
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  autor TEXT NOT NULL DEFAULT '',
  isbn TEXT,
  editora TEXT,
  ano INTEGER,
  numero_paginas INTEGER,
  idioma TEXT,
  sinopse TEXT,
  capa_url TEXT,
  quantidade_total INTEGER NOT NULL DEFAULT 1,
  quantidade_disponivel INTEGER NOT NULL DEFAULT 1,
  localizacao_prateleira TEXT,
  categoria_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.books TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

-- ============== LOANS ==============
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_emprestimo TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_devolucao_prevista DATE NOT NULL,
  data_devolucao_real TIMESTAMPTZ,
  status public.loan_status NOT NULL DEFAULT 'ativo',
  multa NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loans TO authenticated;
GRANT ALL ON public.loans TO service_role;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- ============== RESERVATIONS ==============
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_reserva TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.reservation_status NOT NULL DEFAULT 'ativa'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- ============== LABELS ==============
CREATE TABLE public.labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  codigo_barras TEXT NOT NULL UNIQUE,
  data_geracao TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.labels TO authenticated;
GRANT ALL ON public.labels TO service_role;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

-- ============== SETTINGS ==============
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.settings (key, value) VALUES ('multa_por_dia', '1.00'::jsonb);

-- ============== RLS POLICIES ==============

-- profiles
CREATE POLICY "profiles_select_own_or_staff" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_update_own_or_staff" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_delete_staff" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- user_roles
CREATE POLICY "roles_select_own_or_staff" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "roles_manage_admin" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- categories
CREATE POLICY "categories_select_all" ON public.categories
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories_manage_staff" ON public.categories
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- books
CREATE POLICY "books_select_all" ON public.books
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "books_manage_staff" ON public.books
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- loans
CREATE POLICY "loans_select_own_or_staff" ON public.loans
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "loans_manage_staff" ON public.loans
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- reservations
CREATE POLICY "reservations_select_own_or_staff" ON public.reservations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "reservations_insert_self" ON public.reservations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "reservations_manage_staff" ON public.reservations
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- labels
CREATE POLICY "labels_select_auth" ON public.labels
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "labels_manage_staff" ON public.labels
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- settings
CREATE POLICY "settings_select_auth" ON public.settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_manage_admin" ON public.settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== TRIGGERS ==============

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_books_updated BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Handle new user signup: create profile + membro role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'membro');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============== RPC: bootstrap_first_admin ==============
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  has_any_admin BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin') INTO has_any_admin;
  IF has_any_admin THEN RETURN FALSE; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid,'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN TRUE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin() TO authenticated;

-- ============== RPC: create_loan ==============
CREATE OR REPLACE FUNCTION public.create_loan(_book_id UUID, _user_id UUID, _dias INTEGER DEFAULT 14)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
  new_id UUID;
  qtd INTEGER;
BEGIN
  IF NOT public.is_staff(caller) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  SELECT quantidade_disponivel INTO qtd FROM public.books WHERE id = _book_id FOR UPDATE;
  IF qtd IS NULL THEN RAISE EXCEPTION 'Livro não encontrado'; END IF;
  IF qtd < 1 THEN RAISE EXCEPTION 'Livro indisponível'; END IF;

  UPDATE public.books SET quantidade_disponivel = quantidade_disponivel - 1 WHERE id = _book_id;
  INSERT INTO public.loans (book_id, user_id, data_devolucao_prevista)
    VALUES (_book_id, _user_id, (CURRENT_DATE + (_dias || ' days')::interval)::date)
    RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_loan(UUID, UUID, INTEGER) TO authenticated;

-- ============== RPC: return_loan ==============
CREATE OR REPLACE FUNCTION public.return_loan(_loan_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
  l RECORD;
  dias_atraso INTEGER;
  multa_dia NUMERIC;
  multa_total NUMERIC := 0;
BEGIN
  IF NOT public.is_staff(caller) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  SELECT * INTO l FROM public.loans WHERE id = _loan_id FOR UPDATE;
  IF l IS NULL THEN RAISE EXCEPTION 'Empréstimo não encontrado'; END IF;
  IF l.status = 'concluido' THEN RAISE EXCEPTION 'Empréstimo já concluído'; END IF;

  SELECT (value#>>'{}')::numeric INTO multa_dia FROM public.settings WHERE key='multa_por_dia';
  IF multa_dia IS NULL THEN multa_dia := 0; END IF;

  dias_atraso := GREATEST(0, (CURRENT_DATE - l.data_devolucao_prevista));
  multa_total := dias_atraso * multa_dia;

  UPDATE public.loans
    SET status='concluido', data_devolucao_real = now(), multa = multa_total
    WHERE id = _loan_id;
  UPDATE public.books SET quantidade_disponivel = quantidade_disponivel + 1
    WHERE id = l.book_id;
  RETURN multa_total;
END;
$$;
GRANT EXECUTE ON FUNCTION public.return_loan(UUID) TO authenticated;

-- ============== SEED CATEGORIES ==============
INSERT INTO public.categories (nome, descricao) VALUES
  ('Romance','Obras de ficção romântica'),
  ('Ficção Científica','Sci-fi e fantasia futurista'),
  ('História','Livros de história e biografias'),
  ('Tecnologia','Programação, computação e tecnologia'),
  ('Infantil','Livros para crianças'),
  ('Autoajuda','Desenvolvimento pessoal'),
  ('Acadêmico','Livros didáticos e técnicos')
ON CONFLICT (nome) DO NOTHING;
