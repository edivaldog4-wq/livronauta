ALTER TABLE public.contact_messages ADD COLUMN captcha_challenge text;
CREATE UNIQUE INDEX contact_messages_captcha_challenge_key ON public.contact_messages (captcha_challenge) WHERE captcha_challenge IS NOT NULL;
COMMENT ON COLUMN public.contact_messages.captcha_challenge IS 'Server-verified challenge digest; unique to prevent replay, nullable for historical messages.';
ALTER POLICY contact_insert_any ON public.contact_messages WITH CHECK (false);
REVOKE INSERT ON public.contact_messages FROM anon, authenticated;
GRANT INSERT ON public.contact_messages TO service_role;