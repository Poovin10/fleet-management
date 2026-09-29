BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_driver_session(p_session_token text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_driver_id integer;
    v_session_id uuid;
BEGIN
    IF p_session_token IS NULL OR btrim(p_session_token) = '' THEN
        RAISE EXCEPTION 'Driver session is required';
    END IF;

    SELECT
        ds.session_id,
        ds.driver_id
    INTO
        v_session_id,
        v_driver_id
    FROM public.driver_sessions ds
    JOIN public.drivers d
        ON d.driver_id = ds.driver_id
    WHERE ds.token_hash = encode(
              extensions.digest(p_session_token, 'sha256'),
              'hex'
          )
      AND ds.revoked_at IS NULL
      AND ds.expires_at > CURRENT_TIMESTAMP
      AND d.is_active = true
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired driver session';
    END IF;

    UPDATE public.driver_sessions
    SET last_seen_at = CURRENT_TIMESTAMP
    WHERE session_id = v_session_id;

    RETURN v_driver_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_driver_session(text)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.resolve_driver_session(text)
TO anon, authenticated, service_role;

COMMIT;
