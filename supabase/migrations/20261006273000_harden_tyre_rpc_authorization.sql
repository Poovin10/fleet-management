-- KSS ERP: Harden tyre lifecycle RPC authorization.
--
-- The original tyre lifecycle implementations are preserved unchanged.
-- They are renamed to internal implementation functions.
-- Same-signature SECURITY DEFINER wrappers enforce ADMIN/SUPERADMIN
-- authorization before calling the original implementation.
--
-- This avoids rewriting the existing tyre/odometer business logic.

BEGIN;

-- ============================================================
-- 1. Rename the existing implementations.
-- ============================================================

ALTER FUNCTION public.mount_tyre_atomic(
    integer, integer, text, numeric, date, text, text
) RENAME TO mount_tyre_atomic_internal;

ALTER FUNCTION public.send_tyre_for_retread_atomic(
    integer, bigint, numeric, numeric, date, text, text, text
) RENAME TO send_tyre_for_retread_atomic_internal;

ALTER FUNCTION public.complete_tyre_retread_atomic(
    integer, text, bigint, date, numeric, text, integer, text,
    numeric, numeric, text, text, text
) RENAME TO complete_tyre_retread_atomic_internal;

ALTER FUNCTION public.dispose_tyre_atomic(
    integer, text, date, numeric, numeric, bigint, text, text, text
) RENAME TO dispose_tyre_atomic_internal;


-- ============================================================
-- 2. Internal implementations are not directly callable by
--    normal authenticated users.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.mount_tyre_atomic_internal(
    integer, integer, text, numeric, date, text, text
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.send_tyre_for_retread_atomic_internal(
    integer, bigint, numeric, numeric, date, text, text, text
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.complete_tyre_retread_atomic_internal(
    integer, text, bigint, date, numeric, text, integer, text,
    numeric, numeric, text, text, text
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.dispose_tyre_atomic_internal(
    integer, text, date, numeric, numeric, bigint, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mount_tyre_atomic_internal(
    integer, integer, text, numeric, date, text, text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.send_tyre_for_retread_atomic_internal(
    integer, bigint, numeric, numeric, date, text, text, text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.complete_tyre_retread_atomic_internal(
    integer, text, bigint, date, numeric, text, integer, text,
    numeric, numeric, text, text, text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.dispose_tyre_atomic_internal(
    integer, text, date, numeric, numeric, bigint, text, text, text
) TO service_role;


-- ============================================================
-- 3. ADMIN/SUPERADMIN wrappers.
-- ============================================================

CREATE OR REPLACE FUNCTION public.mount_tyre_atomic(
    p_tyre_id integer,
    p_vehicle_id integer,
    p_position text,
    p_mount_odo numeric,
    p_mount_date date,
    p_entered_by text,
    p_remarks text
)
RETURNS public.fleet_tyres
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
    IF auth.role() <> 'service_role'
       AND public.get_current_user_role()
           NOT IN ('ADMIN', 'SUPERADMIN')
    THEN
        RAISE EXCEPTION 'TYRE_ADMIN_ROLE_REQUIRED';
    END IF;

    RETURN public.mount_tyre_atomic_internal(
        p_tyre_id,
        p_vehicle_id,
        p_position,
        p_mount_odo,
        p_mount_date,
        p_entered_by,
        p_remarks
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.send_tyre_for_retread_atomic(
    p_tyre_id integer,
    p_vendor_id bigint,
    p_odometer_km numeric,
    p_amount numeric,
    p_retread_date date,
    p_entered_by text,
    p_remarks text,
    p_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
    IF auth.role() <> 'service_role'
       AND public.get_current_user_role()
           NOT IN ('ADMIN', 'SUPERADMIN')
    THEN
        RAISE EXCEPTION 'TYRE_ADMIN_ROLE_REQUIRED';
    END IF;

    RETURN public.send_tyre_for_retread_atomic_internal(
        p_tyre_id,
        p_vendor_id,
        p_odometer_km,
        p_amount,
        p_retread_date,
        p_entered_by,
        p_remarks,
        p_reference
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.complete_tyre_retread_atomic(
    p_tyre_id integer,
    p_result text,
    p_vendor_id bigint,
    p_completion_date date,
    p_mount_odo numeric,
    p_entered_by text,
    p_vehicle_id integer,
    p_position text,
    p_rework_amount numeric,
    p_nsd numeric,
    p_remarks text,
    p_reference text,
    p_disposition text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
    IF auth.role() <> 'service_role'
       AND public.get_current_user_role()
           NOT IN ('ADMIN', 'SUPERADMIN')
    THEN
        RAISE EXCEPTION 'TYRE_ADMIN_ROLE_REQUIRED';
    END IF;

    RETURN public.complete_tyre_retread_atomic_internal(
        p_tyre_id,
        p_result,
        p_vendor_id,
        p_completion_date,
        p_mount_odo,
        p_entered_by,
        p_vehicle_id,
        p_position,
        p_rework_amount,
        p_nsd,
        p_remarks,
        p_reference,
        p_disposition
    );
END;
$function$;


CREATE OR REPLACE FUNCTION public.dispose_tyre_atomic(
    p_tyre_id integer,
    p_disposition text,
    p_disposal_date date,
    p_odometer_km numeric,
    p_recovery_amount numeric,
    p_vendor_id bigint,
    p_entered_by text,
    p_remarks text,
    p_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
    IF auth.role() <> 'service_role'
       AND public.get_current_user_role()
           NOT IN ('ADMIN', 'SUPERADMIN')
    THEN
        RAISE EXCEPTION 'TYRE_ADMIN_ROLE_REQUIRED';
    END IF;

    RETURN public.dispose_tyre_atomic_internal(
        p_tyre_id,
        p_disposition,
        p_disposal_date,
        p_odometer_km,
        p_recovery_amount,
        p_vendor_id,
        p_entered_by,
        p_remarks,
        p_reference
    );
END;
$function$;


-- ============================================================
-- 4. Public RPC ACL.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.mount_tyre_atomic(
    integer, integer, text, numeric, date, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mount_tyre_atomic(
    integer, integer, text, numeric, date, text, text
) TO authenticated, service_role;


REVOKE EXECUTE ON FUNCTION public.send_tyre_for_retread_atomic(
    integer, bigint, numeric, numeric, date, text, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.send_tyre_for_retread_atomic(
    integer, bigint, numeric, numeric, date, text, text, text
) TO authenticated, service_role;


REVOKE EXECUTE ON FUNCTION public.complete_tyre_retread_atomic(
    integer, text, bigint, date, numeric, text, integer, text,
    numeric, numeric, text, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.complete_tyre_retread_atomic(
    integer, text, bigint, date, numeric, text, integer, text,
    numeric, numeric, text, text, text
) TO authenticated, service_role;


REVOKE EXECUTE ON FUNCTION public.dispose_tyre_atomic(
    integer, text, date, numeric, numeric, bigint, text, text, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.dispose_tyre_atomic(
    integer, text, date, numeric, numeric, bigint, text, text, text
) TO authenticated, service_role;

COMMIT;
