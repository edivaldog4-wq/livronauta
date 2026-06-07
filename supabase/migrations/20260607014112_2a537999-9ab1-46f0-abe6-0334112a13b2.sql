
-- Library name setting
INSERT INTO public.settings(key, value) VALUES ('library_name', to_jsonb('Minha Biblioteca'::text))
ON CONFLICT (key) DO NOTHING;

-- Shelves table
CREATE TABLE IF NOT EXISTS public.shelves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shelves TO authenticated;
GRANT ALL ON public.shelves TO service_role;
ALTER TABLE public.shelves ENABLE ROW LEVEL SECURITY;
CREATE POLICY shelves_select_auth ON public.shelves FOR SELECT TO authenticated USING (true);
CREATE POLICY shelves_manage_staff ON public.shelves FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER shelves_set_updated_at BEFORE UPDATE ON public.shelves
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- profiles.numero (5 digits unique)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS numero TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_profile_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n TEXT; tries INT := 0;
BEGIN
  LOOP
    n := lpad(floor(random()*100000)::int::text, 5, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE numero = n);
    tries := tries + 1;
    IF tries > 50 THEN RAISE EXCEPTION 'Não foi possível gerar número de perfil'; END IF;
  END LOOP;
  RETURN n;
END; $$;

-- Backfill existing profiles
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE numero IS NULL LOOP
    UPDATE public.profiles SET numero = public.generate_profile_number() WHERE id = r.id;
  END LOOP;
END $$;

-- Update handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, numero)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)),
    NEW.email,
    public.generate_profile_number()
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'membro');
  RETURN NEW;
END; $$;

-- Ensure auth trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed categories (broad Brazilian list)
INSERT INTO public.categories (nome) VALUES
('Literatura Brasileira'),('Literatura Estrangeira'),('Romance'),('Conto'),('Poesia'),
('Crônica'),('Infantil'),('Juvenil'),('HQ/Mangá'),('Biografia'),
('História'),('Filosofia'),('Sociologia'),('Psicologia'),('Religião/Espiritualidade'),
('Autoajuda'),('Educação'),('Direito'),('Administração'),('Economia'),
('Negócios'),('Marketing'),('Tecnologia/Informática'),('Engenharia'),('Ciências Exatas'),
('Ciências Biológicas'),('Saúde/Medicina'),('Artes'),('Música'),('Arquitetura'),
('Gastronomia'),('Esportes'),('Viagem'),('Política'),('Atualidades'),
('Dicionários/Referência'),('Didáticos'),('Concursos'),('ENEM/Vestibular'),
('Ficção Científica'),('Fantasia'),('Suspense/Mistério'),('Terror')
ON CONFLICT (nome) DO NOTHING;
