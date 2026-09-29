BEGIN;

CREATE TABLE IF NOT EXISTS public.driver_auth_attempts (
    driver_code text PRIMARY KEY,
    failed_attempts integer NOT NULL DEFAULT 0,
    last_failed_at timestamptz,
    locked_until timestamptz,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.driver_auth_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.driver_auth_attempts
FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.driver_auth_attempts
TO postgres;

CREATE OR REPLACE FUNCTION public.authenticate_driver_session(
    p_driver_code text,
    p_pin text
)
RETURNS TABLE(
    driver_id integer,
    driver_code character varying,
    full_name character varying,
    phone_number character varying,
    branch_id integer,
    session_token text,
    session_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog, public'
AS $function$
DECLARE
    v_driver public.drivers%ROWTYPE;
    v_token text;
    v_expires_at timestamptz;
    v_code text;
    v_locked_until timestamptz;
BEGIN
    IF p_driver_code IS NULL OR btrim(p_driver_code) = '' THEN
        RAISE EXCEPTION 'Driver code is required';
    END IF;

    IF p_pin IS NULL OR btrim(p_pin) = '' THEN
        RAISE EXCEPTION 'PIN is required';
    END IF;

    v_code := upper(btrim(p_driver_code));

    SELECT locked_until
    INTO v_locked_until
    FROM public.driver_auth_attempts
    WHERE public.driver_auth_attempts.driver_code = v_code
    FOR UPDATE;

    IF v_locked_until IS NOT NULL
       AND v_locked_until > CURRENT_TIMESTAMP THEN
        RETURN;
    END IF;

    SELECT d.*
    INTO v_driver
    FROM public.drivers d
    WHERE upper(btrim(d.driver_code)) = v_code
      AND d.is_active = true
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF v_driver.pin_hash IS NULL
       OR extensions.crypt(p_pin, v_driver.pin_hash) <> v_driver.pin_hash THEN

        INSERT INTO public.driver_auth_attempts AS da (
            driver_code,
            failed_attempts,
            last_failed_at,
            locked_until,
            updated_at
        )
        VALUES (
            v_code,
            1,
            CURRENT_TIMESTAMP,
            NULL,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT ON CONSTRAINT driver_auth_attempts_pkey
        DO UPDATE SET
            failed_attempts = da.failed_attempts + 1,
            last_failed_at = CURRENT_TIMESTAMP,
            locked_until = CASE
                WHEN da.failed_attempts + 1 >= 5
                THEN CURRENT_TIMESTAMP + interval '15 minutes'
                ELSE NULL
            END,
            updated_at = CURRENT_TIMESTAMP;

        RETURN;
    END IF;

    INSERT INTO public.driver_auth_attempts (
        driver_code,
        failed_attempts,
        last_failed_at,
        locked_until,
        updated_at
    )
    VALUES (
        v_code,
        0,
        NULL,
        NULL,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT ON CONSTRAINT driver_auth_attempts_pkey
    DO UPDATE SET
        failed_attempts = 0,
        last_failed_at = NULL,
        locked_until = NULL,
        updated_at = CURRENT_TIMESTAMP;

    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    v_expires_at := CURRENT_TIMESTAMP + interval '12 hours';

    INSERT INTO public.driver_sessions(
        driver_id,
        token_hash,
        expires_at
    )
    VALUES (
        v_driver.driver_id,
        encode(extensions.digest(v_token, 'sha256'), 'hex'),
        v_expires_at
    );

    RETURN QUERY
    SELECT
        v_driver.driver_id,
        v_driver.driver_code,
        v_driver.full_name,
        v_driver.phone_number,
        v_driver.branch_id,
        v_token,
        v_expires_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.authenticate_driver_session(text, text)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.authenticate_driver_session(text, text)
TO anon, authenticated, service_role;

COMMIT;
