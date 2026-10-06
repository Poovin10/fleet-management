BEGIN;

REVOKE ALL ON TABLE public.driver_pending_entries FROM anon;
REVOKE ALL ON TABLE public.driver_pending_entries FROM authenticated;

GRANT ALL ON TABLE public.driver_pending_entries TO service_role;

ALTER TABLE public.driver_pending_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow ERP to read pending entries"
    ON public.driver_pending_entries;

DROP POLICY IF EXISTS "Allow ERP to update pending entries"
    ON public.driver_pending_entries;

DROP POLICY IF EXISTS "Allow driver deletes"
    ON public.driver_pending_entries;

DROP POLICY IF EXISTS "Allow driver portal inserts"
    ON public.driver_pending_entries;

DROP POLICY IF EXISTS "Admin read driver pending entries"
    ON public.driver_pending_entries;

CREATE POLICY "Admin read driver pending entries"
ON public.driver_pending_entries
FOR SELECT
TO authenticated
USING (
    public.get_current_user_role() IN ('ADMIN', 'SUPERADMIN')
);

CREATE OR REPLACE FUNCTION public.approve_driver_fuel_atomic(
    p_entry_id integer,
    p_final_cost numeric,
    p_entered_by text DEFAULT NULL::text
)
RETURNS public.diesel_fuel_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_entry public.driver_pending_entries%ROWTYPE;
    v_vehicle public.vehicles%ROWTYPE;
    v_latest public.vehicle_odometer_logs%ROWTYPE;
    v_fuel public.diesel_fuel_logs%ROWTYPE;
    v_rate numeric;
    v_reading_at timestamptz;
    v_entered_by text;
BEGIN
    IF auth.role() <> 'service_role'
       AND public.get_current_user_role() NOT IN ('ADMIN', 'SUPERADMIN')
    THEN
        RAISE EXCEPTION 'ADMIN_AUTHORIZATION_REQUIRED';
    END IF;

    IF p_entry_id IS NULL OR p_entry_id <= 0 THEN
        RAISE EXCEPTION 'PENDING_ENTRY_ID_REQUIRED';
    END IF;

    IF p_final_cost IS NULL OR p_final_cost <= 0 THEN
        RAISE EXCEPTION 'FUEL_COST_INVALID';
    END IF;

    SELECT *
    INTO v_entry
    FROM public.driver_pending_entries
    WHERE entry_id = p_entry_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PENDING_ENTRY_NOT_FOUND';
    END IF;

    IF COALESCE(v_entry.status, 'PENDING') <> 'PENDING' THEN
        RAISE EXCEPTION 'PENDING_ENTRY_ALREADY_PROCESSED';
    END IF;

    IF UPPER(BTRIM(COALESCE(v_entry.entry_type, ''))) <> 'FUEL' THEN
        RAISE EXCEPTION 'PENDING_ENTRY_NOT_FUEL';
    END IF;

    IF v_entry.vehicle_id IS NULL THEN
        RAISE EXCEPTION 'VEHICLE_REQUIRED';
    END IF;

    IF v_entry.litres IS NULL OR v_entry.litres <= 0 THEN
        RAISE EXCEPTION 'FUEL_LITRES_INVALID';
    END IF;

    SELECT *
    INTO v_vehicle
    FROM public.vehicles
    WHERE vehicle_id = v_entry.vehicle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'VEHICLE_NOT_FOUND';
    END IF;

    v_reading_at := CURRENT_TIMESTAMP;

    IF COALESCE(v_vehicle.odometer_working, true) THEN
        IF v_entry.odometer_km IS NULL OR v_entry.odometer_km <= 0 THEN
            RAISE EXCEPTION 'FUEL_ODOMETER_REQUIRED';
        END IF;

        SELECT *
        INTO v_latest
        FROM public.vehicle_odometer_logs
        WHERE vehicle_id = v_entry.vehicle_id
        ORDER BY reading_at DESC, odometer_log_id DESC
        LIMIT 1
        FOR UPDATE;

        IF FOUND THEN
            IF v_reading_at < v_latest.reading_at THEN
                RAISE EXCEPTION 'ODOMETER_READING_TIME_INVALID';
            END IF;

            IF v_entry.odometer_km <= v_latest.odometer_km THEN
                RAISE EXCEPTION 'ODOMETER_MUST_INCREASE_PREVIOUS';
            END IF;
        END IF;
    END IF;

    v_rate := p_final_cost / v_entry.litres;

    IF v_rate <= 0 THEN
        RAISE EXCEPTION 'FUEL_RATE_INVALID';
    END IF;

    v_entered_by := COALESCE(
        NULLIF(BTRIM(p_entered_by), ''),
        auth.uid()::text,
        'ApprovalQueue'
    );

    INSERT INTO public.diesel_fuel_logs (
        fuel_date,
        vehicle_id,
        trip_id,
        diesel_category,
        litres_filled,
        diesel_rate_per_litre,
        total_fuel_cost,
        filling_odometer_km,
        lr_number,
        fuel_station_vendor,
        remarks,
        created_at,
        is_tank_full
    )
    VALUES (
        CURRENT_DATE,
        v_entry.vehicle_id,
        NULL,
        'TRIP_DIESEL',
        v_entry.litres,
        v_rate,
        p_final_cost,
        CASE
            WHEN COALESCE(v_vehicle.odometer_working, true)
                THEN v_entry.odometer_km
            ELSE NULL
        END,
        'SUNDRY',
        NULL,
        NULLIF(BTRIM(v_entry.receipt_remarks), ''),
        v_reading_at,
        false
    )
    RETURNING *
    INTO v_fuel;

    IF COALESCE(v_vehicle.odometer_working, true) THEN
        INSERT INTO public.vehicle_odometer_logs (
            vehicle_id,
            odometer_km,
            reading_type,
            reference_id,
            reading_at,
            entered_at,
            entered_by,
            remarks
        )
        VALUES (
            v_entry.vehicle_id,
            v_entry.odometer_km,
            'FUEL',
            v_fuel.fuel_log_id,
            v_reading_at,
            v_reading_at,
            v_entered_by,
            'Driver fuel approval — pending entry ' || v_entry.entry_id::text
        );
    END IF;

    UPDATE public.driver_pending_entries
    SET
        status = 'APPROVED',
        amount_inr = p_final_cost
    WHERE entry_id = v_entry.entry_id;

    RETURN v_fuel;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_driver_pending_entry_atomic(
    p_entry_id integer,
    p_rejection_reason text DEFAULT NULL::text
)
RETURNS public.driver_pending_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    v_entry public.driver_pending_entries%ROWTYPE;
    v_reason text;
BEGIN
    IF auth.role() <> 'service_role'
       AND public.get_current_user_role() NOT IN ('ADMIN', 'SUPERADMIN')
    THEN
        RAISE EXCEPTION 'ADMIN_AUTHORIZATION_REQUIRED';
    END IF;

    IF p_entry_id IS NULL OR p_entry_id <= 0 THEN
        RAISE EXCEPTION 'PENDING_ENTRY_ID_REQUIRED';
    END IF;

    SELECT *
    INTO v_entry
    FROM public.driver_pending_entries
    WHERE entry_id = p_entry_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PENDING_ENTRY_NOT_FOUND';
    END IF;

    IF COALESCE(v_entry.status, 'PENDING') <> 'PENDING' THEN
        RAISE EXCEPTION 'PENDING_ENTRY_ALREADY_PROCESSED';
    END IF;

    v_reason := NULLIF(BTRIM(p_rejection_reason), '');

    UPDATE public.driver_pending_entries
    SET
        status = 'REJECTED',
        rejection_reason = v_reason
    WHERE entry_id = p_entry_id
    RETURNING *
    INTO v_entry;

    RETURN v_entry;
END;
$function$;

REVOKE ALL ON FUNCTION public.approve_driver_fuel_atomic(integer,numeric,text)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.approve_driver_fuel_atomic(integer,numeric,text)
FROM anon;

GRANT EXECUTE ON FUNCTION public.approve_driver_fuel_atomic(integer,numeric,text)
TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reject_driver_pending_entry_atomic(integer,text)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.reject_driver_pending_entry_atomic(integer,text)
FROM anon;

GRANT EXECUTE ON FUNCTION public.reject_driver_pending_entry_atomic(integer,text)
TO authenticated, service_role;

COMMIT;
