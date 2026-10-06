CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

INSERT INTO public.platform_admins (user_id)
SELECT DISTINCT l.owner_id
FROM public.libraries l
WHERE l.plan = 'unlimited' AND l.owner_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()
    )
$$;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO service_role;

ALTER TABLE public.libraries
  ADD COLUMN complimentary_access boolean NOT NULL DEFAULT false,
  ADD COLUMN complimentary_reason text,
  ADD COLUMN complimentary_granted_by uuid,
  ADD COLUMN complimentary_granted_at timestamptz;

CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_settings_public_read
ON public.platform_settings
FOR SELECT
TO anon, authenticated
USING (key IN ('meta_pixel_id', 'google_ads_id'));
CREATE POLICY platform_settings_founder_manage
ON public.platform_settings
FOR ALL
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());