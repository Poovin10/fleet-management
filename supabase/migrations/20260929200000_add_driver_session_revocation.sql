BEGIN;

CREATE OR REPLACE FUNCTION public.revoke_driver_session(p_session_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
    IF p_session_token IS NULL OR btrim(p_session_token) = '' THEN
        RETURN true;
    END IF;

    UPDATE public.driver_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE token_hash = encode(
        extensions.digest(p_session_token, 'sha256'),
        'hex'
    )
      AND revoked_at IS NULL;

    RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.revoke_driver_session(text)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.revoke_driver_session(text)
TO anon, authenticated, service_role;

COMMIT;
