CREATE OR REPLACE FUNCTION public.protect_library_billing_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF coalesce(auth.role(), '') <> 'service_role' AND (
 NEW.plan IS DISTINCT FROM OLD.plan OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
 OR NEW.asaas_customer_id IS DISTINCT FROM OLD.asaas_customer_id OR NEW.asaas_subscription_id IS DISTINCT FROM OLD.asaas_subscription_id
 OR NEW.current_period_end IS DISTINCT FROM OLD.current_period_end OR NEW.free_plan_grandfathered IS DISTINCT FROM OLD.free_plan_grandfathered
 OR NEW.complimentary_access IS DISTINCT FROM OLD.complimentary_access OR NEW.complimentary_reason IS DISTINCT FROM OLD.complimentary_reason
 OR NEW.complimentary_granted_by IS DISTINCT FROM OLD.complimentary_granted_by OR NEW.complimentary_granted_at IS DISTINCT FROM OLD.complimentary_granted_at
 OR NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
 RAISE EXCEPTION 'Alterações de cobrança e gratuidade exigem operação protegida';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_library_billing BEFORE UPDATE ON public.libraries FOR EACH ROW EXECUTE FUNCTION public.protect_library_billing_fields();

CREATE OR REPLACE FUNCTION public.set_library_member_role(_user_id uuid, _library_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.is_platform_admin() OR (_library_id=public.current_library_id() AND public.has_role(auth.uid(),'admin'))) THEN RAISE EXCEPTION 'Permissão negada'; END IF;
 SELECT owner_id INTO owner FROM public.libraries WHERE id=_library_id;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND library_id=_library_id) THEN RAISE EXCEPTION 'Usuário não pertence a esta biblioteca'; END IF;
 IF owner=_user_id AND _role <> 'admin' THEN RAISE EXCEPTION 'O titular deve permanecer administrador'; END IF;
 DELETE FROM public.user_roles WHERE user_id=_user_id AND library_id=_library_id;
 INSERT INTO public.user_roles(user_id,library_id,role) VALUES(_user_id,_library_id,_role);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.set_library_member_role(uuid,uuid,public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_library_member_role(uuid,uuid,public.app_role) TO authenticated;