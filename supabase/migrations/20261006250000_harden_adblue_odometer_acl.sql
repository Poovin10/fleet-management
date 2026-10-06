BEGIN;

-- ============================================================
-- AdBlue RPC authorization
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_adblue_atomic(
    p_adblue_log_id bigint,
    p_adblue_date date,
    p_litres_filled numeric,
    p_adblue_rate_per_litre numeric,
    p_vendor_id bigint DEFAULT NULL::bigint,
    p_lr_number text DEFAULT NULL::text,
    p_is_tank_full boolean DEFAULT false,
    p_remarks text DEFAULT NULL::text
)
RETURNS public.adblue_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_log public.adblue_logs%ROWTYPE;
    v_vendor public.vendors%ROWTYPE;
    v_total_cost numeric(14,2);
BEGIN
    IF public.get_current_user_role()
       NOT IN ('ADMIN', 'SUPERADMIN') THEN
        RAISE EXCEPTION 'ADBLUE_ADMIN_ROLE_REQUIRED';
    END IF;

    IF p_adblue_log_id IS NULL THEN
        RAISE EXCEPTION 'AdBlue log ID is required';
    END IF;

    IF p_adblue_date IS NULL THEN
        RAISE EXCEPTION 'AdBlue date is required';
    END IF;

    IF p_litres_filled IS NULL OR p_litres_filled <= 0 THEN
        RAISE EXCEPTION 'AdBlue litres must be greater than zero';
    END IF;

    IF p_adblue_rate_per_litre IS NULL OR p_adblue_rate_per_litre <= 0 THEN
        RAISE EXCEPTION 'AdBlue rate must be greater than zero';
    END IF;

    SELECT *
    INTO v_log
    FROM public.adblue_logs
    WHERE adblue_log_id = p_adblue_log_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'AdBlue record % does not exist', p_adblue_log_id;
    END IF;

    IF p_vendor_id IS NOT NULL THEN
        SELECT *
        INTO v_vendor
        FROM public.vendors
        WHERE vendor_id = p_vendor_id
        FOR UPDATE;

        IF NOT FOUND OR COALESCE(v_vendor.is_active, false) = false THEN
            RAISE EXCEPTION 'Vendor % is missing or inactive', p_vendor_id;
        END IF;

        IF v_vendor.vendor_type NOT IN ('ADBLUE', 'GENERAL', 'DIESEL') THEN
            RAISE EXCEPTION 'Vendor % is not valid for AdBlue', p_vendor_id;
        END IF;
    END IF;

    v_total_cost := ROUND(
        (p_litres_filled * p_adblue_rate_per_litre)::numeric,
        2
    );

    IF v_total_cost <= 0 THEN
        RAISE EXCEPTION 'Calculated AdBlue cost must be greater than zero';
    END IF;

    UPDATE public.adblue_logs
    SET
        adblue_date = p_adblue_date,
        litres_filled = p_litres_filled,
        adblue_rate_per_litre = p_adblue_rate_per_litre,
        total_adblue_cost = v_total_cost,
        vendor_id = p_vendor_id,
        adblue_vendor = CASE
            WHEN p_vendor_id IS NOT NULL THEN v_vendor.vendor_name
            ELSE NULL
        END,
        lr_number = NULLIF(BTRIM(p_lr_number), ''),
        is_tank_full = COALESCE(p_is_tank_full, false),
        remarks = NULLIF(BTRIM(p_remarks), '')
    WHERE adblue_log_id = p_adblue_log_id
    RETURNING *
    INTO v_log;

    RETURN v_log;
END;
$function$;


-- ============================================================
-- Delete authorization + ADBLUE odometer event
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_adblue_atomic(
    p_adblue_log_id bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_log public.adblue_logs%ROWTYPE;
    v_odo public.vehicle_odometer_logs%ROWTYPE;
BEGIN
    IF public.get_current_user_role()
       NOT IN ('ADMIN', 'SUPERADMIN') THEN
        RAISE EXCEPTION 'ADBLUE_ADMIN_ROLE_REQUIRED';
    END IF;

    SELECT *
    INTO v_log
    FROM public.adblue_logs
    WHERE adblue_log_id = p_adblue_log_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'AdBlue record % does not exist', p_adblue_log_id;
    END IF;

    PERFORM 1
    FROM public.vehicles
    WHERE vehicle_id = v_log.vehicle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vehicle % does not exist', v_log.vehicle_id;
    END IF;

    SELECT *
    INTO v_odo
    FROM public.vehicle_odometer_logs
    WHERE vehicle_id = v_log.vehicle_id
      AND reading_type IN ('ADBLUE', 'WORKSHOP')
      AND reference_id = v_log.adblue_log_id
      AND odometer_km = v_log.filling_odometer_km
    ORDER BY reading_at DESC, odometer_log_id DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Cannot safely delete AdBlue record %. Matching odometer ledger entry was not found.',
            p_adblue_log_id;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.vehicle_odometer_logs later
        WHERE later.vehicle_id = v_log.vehicle_id
          AND (
              later.reading_at > v_odo.reading_at
              OR (
                  later.reading_at = v_odo.reading_at
                  AND later.odometer_log_id > v_odo.odometer_log_id
              )
          )
    ) THEN
        RAISE EXCEPTION
            'Cannot delete AdBlue record %. A later authoritative odometer reading already exists for this vehicle.',
            p_adblue_log_id;
    END IF;

    DELETE FROM public.vehicle_odometer_logs
    WHERE odometer_log_id = v_odo.odometer_log_id;

    DELETE FROM public.adblue_logs
    WHERE adblue_log_id = p_adblue_log_id;
END;
$function$;


-- ============================================================
-- Remove direct authenticated execution.
-- Service role remains available for controlled server paths.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.update_adblue_atomic(
    bigint, date, numeric, numeric, bigint, text, boolean, text
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_adblue_atomic(
    bigint
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_adblue_atomic(
    bigint, date, numeric, numeric, bigint, text, boolean, text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.delete_adblue_atomic(
    bigint
) TO service_role;

COMMIT;
