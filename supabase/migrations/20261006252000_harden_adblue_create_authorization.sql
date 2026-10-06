BEGIN;

CREATE OR REPLACE FUNCTION public.guard_adblue_insert_authorization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF public.get_current_user_role()
       NOT IN ('ADMIN', 'SUPERADMIN') THEN
        RAISE EXCEPTION 'ADBLUE_ADMIN_ROLE_REQUIRED';
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_adblue_insert_authorization
ON public.adblue_logs;

CREATE TRIGGER trg_guard_adblue_insert_authorization
BEFORE INSERT ON public.adblue_logs
FOR EACH ROW
EXECUTE FUNCTION public.guard_adblue_insert_authorization();

COMMIT;
