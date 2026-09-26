CREATE OR REPLACE FUNCTION public.enforce_book_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE p text; st text; pe timestamptz; n int; BEGIN
  SELECT plan, subscription_status, current_period_end INTO p, st, pe FROM public.libraries WHERE id = NEW.library_id;
  IF p = 'unlimited' THEN RETURN NEW; END IF;
  IF p = 'pro' AND (coalesce(st,'') = 'active' OR (st = 'overdue' AND pe IS NOT NULL AND now() < pe + interval '7 days')) THEN RETURN NEW; END IF;
  SELECT count(*) INTO n FROM public.books WHERE library_id = NEW.library_id;
  IF n >= 100 THEN RAISE EXCEPTION 'Limite do plano gratuito atingido (100 livros). Faça upgrade para o plano Pro.'; END IF;
  RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.library_usage()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT jsonb_build_object('books', (SELECT count(*) FROM public.books WHERE library_id = l.id), 'limit', 100,
  'plan', l.plan, 'status', l.subscription_status, 'nome', l.nome, 'period_end', l.current_period_end,
  'has_subscription', l.asaas_subscription_id IS NOT NULL,
  'invite_code', CASE WHEN public.has_role(auth.uid(),'admin') THEN l.invite_code END)
  FROM public.libraries l WHERE l.id = public.current_library_id() AND public.is_library_member(l.id) $$;

CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (char_length(nome) BETWEEN 1 AND 100),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  mensagem text NOT NULL CHECK (char_length(mensagem) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_insert_any ON public.contact_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.libraries l ON l.id = ur.library_id
  WHERE ur.user_id = auth.uid() AND ur.role='admin' AND l.plan='unlimited') $$;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
CREATE POLICY contact_select_admin ON public.contact_messages FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE POLICY contact_delete_admin ON public.contact_messages FOR DELETE TO authenticated USING (public.is_platform_admin());