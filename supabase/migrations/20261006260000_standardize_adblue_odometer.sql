BEGIN;

-- ============================================================
-- Standardize AdBlue odometer events
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_adblue_filling_atomic(
    p_vehicle_id integer,
    p_adblue_date date,
    p_litres_filled numeric,
    p_adblue_rate_per_litre numeric,
    p_filling_odometer_km numeric,
    p_vendor_id bigint DEFAULT NULL,
    p_trip_id bigint DEFAULT NULL,
    p_lr_number text DEFAULT NULL,
    p_is_tank_full boolean DEFAULT false,
    p_remarks text DEFAULT NULL,
    p_reading_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    p_entered_by text DEFAULT NULL
)
RETURNS public.adblue_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog, public'
AS $function$
DECLARE
    v_vehicle public.vehicles%ROWTYPE;
    v_trip public.trips%ROWTYPE;
    v_vendor public.vendors%ROWTYPE;
    v_previous_odo numeric;
    v_previous_at timestamptz;
    v_total_cost numeric(14,2);
    v_log public.adblue_logs%ROWTYPE;
    v_reading_at timestamptz;
BEGIN
    IF p_vehicle_id IS NULL THEN
        RAISE EXCEPTION 'Vehicle is required';
    END IF;

    IF p_adblue_date IS NULL THEN
        RAISE EXCEPTION 'AdBlue date is required';
    END IF;

    IF p_litres_filled IS NULL OR p_litres_filled <= 0 THEN
        RAISE EXCEPTION 'AdBlue litres must be greater than zero';
    END IF;

    IF p_adblue_rate_per_litre IS NULL OR p_adblue_rate_per_litre <= 0 THEN
        RAISE EXCEPTION 'AdBlue rate per litre must be greater than zero';
    END IF;

    IF p_filling_odometer_km IS NULL OR p_filling_odometer_km <= 0 THEN
        RAISE EXCEPTION 'Filling odometer KM must be greater than zero';
    END IF;

    v_reading_at := COALESCE(p_reading_at, CURRENT_TIMESTAMP);

    SELECT *
    INTO v_vehicle
    FROM public.vehicles
    WHERE vehicle_id = p_vehicle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vehicle % does not exist', p_vehicle_id;
    END IF;

    IF COALESCE(v_vehicle.is_active, false) = false THEN
        RAISE EXCEPTION 'Vehicle % is inactive', p_vehicle_id;
    END IF;

    IF p_trip_id IS NOT NULL THEN
        SELECT *
        INTO v_trip
        FROM public.trips
        WHERE trip_id = p_trip_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Trip % does not exist', p_trip_id;
        END IF;

        IF v_trip.vehicle_id IS DISTINCT FROM p_vehicle_id THEN
            RAISE EXCEPTION
                'Trip % does not belong to vehicle %',
                p_trip_id,
                p_vehicle_id;
        END IF;
    END IF;

    IF p_vendor_id IS NOT NULL THEN
        SELECT *
        INTO v_vendor
        FROM public.vendors
        WHERE vendor_id = p_vendor_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Vendor % does not exist', p_vendor_id;
        END IF;

        IF COALESCE(v_vendor.is_active, false) = false THEN
            RAISE EXCEPTION 'Vendor % is inactive', p_vendor_id;
        END IF;

        IF v_vendor.vendor_type NOT IN ('ADBLUE', 'GENERAL', 'DIESEL') THEN
            RAISE EXCEPTION 'Vendor % is not valid for AdBlue', p_vendor_id;
        END IF;
    END IF;

    SELECT
        vol.odometer_km,
        vol.reading_at
    INTO
        v_previous_odo,
        v_previous_at
    FROM public.vehicle_odometer_logs vol
    WHERE vol.vehicle_id = p_vehicle_id
    ORDER BY vol.reading_at DESC, vol.odometer_log_id DESC
    LIMIT 1;

    IF v_previous_odo IS NOT NULL
       AND p_filling_odometer_km <= v_previous_odo
    THEN
        RAISE EXCEPTION
            'AdBlue filling KM % must be greater than authoritative previous KM % for vehicle %',
            p_filling_odometer_km,
            v_previous_odo,
            p_vehicle_id;
    END IF;

    IF v_previous_at IS NOT NULL
       AND v_reading_at < v_previous_at
    THEN
        RAISE EXCEPTION
            'AdBlue reading timestamp cannot be earlier than the latest vehicle odometer reading';
    END IF;

    v_total_cost :=
        ROUND(
            (p_litres_filled * p_adblue_rate_per_litre)::numeric,
            2
        );

    IF v_total_cost <= 0 THEN
        RAISE EXCEPTION 'Calculated AdBlue cost must be greater than zero';
    END IF;

    INSERT INTO public.adblue_logs (
        adblue_date,
        vehicle_id,
        trip_id,
        lr_number,
        litres_filled,
        adblue_rate_per_litre,
        total_adblue_cost,
        filling_odometer_km,
        vendor_id,
        adblue_vendor,
        is_tank_full,
        remarks,
        created_at
    )
    VALUES (
        p_adblue_date,
        p_vehicle_id,
        p_trip_id,
        NULLIF(BTRIM(p_lr_number), ''),
        p_litres_filled,
        p_adblue_rate_per_litre,
        v_total_cost,
        p_filling_odometer_km,
        p_vendor_id,
        CASE
            WHEN p_vendor_id IS NOT NULL
            THEN v_vendor.vendor_name
            ELSE NULL
        END,
        COALESCE(p_is_tank_full, false),
        NULLIF(BTRIM(p_remarks), ''),
        CURRENT_TIMESTAMP
    )
    RETURNING *
    INTO v_log;

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
        p_vehicle_id,
        p_filling_odometer_km,
        'ADBLUE',
        v_log.adblue_log_id,
        v_reading_at,
        CURRENT_TIMESTAMP,
        COALESCE(p_entered_by, 'record_adblue_filling_atomic'),
        'AdBlue filling'
    );

    RETURN v_log;
END;
$function$;


CREATE OR REPLACE FUNCTION public.record_adblue_credit_atomic(
    p_vehicle_id integer,
    p_adblue_date date,
    p_litres_filled numeric,
    p_adblue_rate_per_litre numeric,
    p_filling_odometer_km numeric,
    p_vendor_id bigint,
    p_trip_id bigint DEFAULT NULL,
    p_lr_number text DEFAULT NULL,
    p_invoice_number text DEFAULT NULL,
    p_due_date date DEFAULT NULL,
    p_is_tank_full boolean DEFAULT false,
    p_remarks text DEFAULT NULL,
    p_created_by text DEFAULT NULL,
    p_reading_at timestamptz DEFAULT NULL
)
RETURNS public.adblue_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog, public'
AS $function$
DECLARE
    v_vehicle public.vehicles%ROWTYPE;
    v_trip public.trips%ROWTYPE;
    v_vendor public.vendors%ROWTYPE;
    v_latest_km numeric;
    v_latest_at timestamptz;
    v_reading_at timestamptz;
    v_total_cost numeric;
    v_adblue public.adblue_logs%ROWTYPE;
BEGIN
    IF p_vehicle_id IS NULL THEN
        RAISE EXCEPTION 'Vehicle is required';
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

    IF p_filling_odometer_km IS NULL OR p_filling_odometer_km <= 0 THEN
        RAISE EXCEPTION 'Filling odometer must be greater than zero';
    END IF;

    IF p_vendor_id IS NULL THEN
        RAISE EXCEPTION 'Vendor is required for credit AdBlue purchase';
    END IF;

    SELECT *
    INTO v_vehicle
    FROM public.vehicles
    WHERE vehicle_id = p_vehicle_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vehicle % does not exist', p_vehicle_id;
    END IF;

    IF COALESCE(v_vehicle.is_active, false) = false THEN
        RAISE EXCEPTION 'Vehicle % is inactive', p_vehicle_id;
    END IF;

    IF p_trip_id IS NOT NULL THEN
        SELECT *
        INTO v_trip
        FROM public.trips
        WHERE trip_id = p_trip_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Trip % does not exist', p_trip_id;
        END IF;

        IF v_trip.vehicle_id IS DISTINCT FROM p_vehicle_id THEN
            RAISE EXCEPTION
                'Trip % does not belong to vehicle %',
                p_trip_id,
                p_vehicle_id;
        END IF;
    END IF;

    SELECT *
    INTO v_vendor
    FROM public.vendors
    WHERE vendor_id = p_vendor_id
      AND is_active = true
      AND vendor_type IN ('ADBLUE', 'GENERAL')
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Vendor % is missing, inactive, or not valid for AdBlue',
            p_vendor_id;
    END IF;

    v_reading_at := COALESCE(p_reading_at, CURRENT_TIMESTAMP);

    SELECT
        vol.odometer_km,
        vol.reading_at
    INTO
        v_latest_km,
        v_latest_at
    FROM public.vehicle_odometer_logs vol
    WHERE vol.vehicle_id = p_vehicle_id
    ORDER BY vol.reading_at DESC, vol.odometer_log_id DESC
    LIMIT 1;

    IF v_latest_km IS NOT NULL
       AND p_filling_odometer_km <= v_latest_km
    THEN
        RAISE EXCEPTION
            'AdBlue filling KM %.1f must be greater than authoritative vehicle KM %.1f',
            p_filling_odometer_km,
            v_latest_km;
    END IF;

    IF v_latest_at IS NOT NULL
       AND v_reading_at < v_latest_at
    THEN
        RAISE EXCEPTION
            'AdBlue reading timestamp cannot be earlier than the latest vehicle odometer reading';
    END IF;

    v_total_cost :=
        ROUND(
            p_litres_filled * p_adblue_rate_per_litre,
            2
        );

    IF v_total_cost <= 0 THEN
        RAISE EXCEPTION 'Calculated AdBlue cost must be greater than zero';
    END IF;

    INSERT INTO public.adblue_logs (
        adblue_date,
        vehicle_id,
        trip_id,
        lr_number,
        litres_filled,
        adblue_rate_per_litre,
        total_adblue_cost,
        filling_odometer_km,
        vendor_id,
        adblue_vendor,
        is_tank_full,
        remarks
    )
    VALUES (
        p_adblue_date,
        p_vehicle_id,
        p_trip_id,
        NULLIF(btrim(p_lr_number), ''),
        ROUND(p_litres_filled, 2),
        ROUND(p_adblue_rate_per_litre, 2),
        v_total_cost,
        ROUND(p_filling_odometer_km, 1),
        p_vendor_id,
        v_vendor.vendor_name,
        COALESCE(p_is_tank_full, false),
        NULLIF(btrim(p_remarks), '')
    )
    RETURNING *
    INTO v_adblue;

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
        p_vehicle_id,
        ROUND(p_filling_odometer_km, 1),
        'ADBLUE',
        v_adblue.adblue_log_id,
        v_reading_at,
        CURRENT_TIMESTAMP,
        NULLIF(btrim(p_created_by), ''),
        'AdBlue credit purchase'
    );

    INSERT INTO public.vendor_payables (
        vendor_id,
        bill_date,
        invoice_number,
        due_date,
        source_type,
        source_reference_id,
        description,
        bill_amount,
        paid_amount,
        status,
        created_by
    )
    VALUES (
        p_vendor_id,
        p_adblue_date,
        NULLIF(btrim(p_invoice_number), ''),
        p_due_date,
        'ADBLUE',
        v_adblue.adblue_log_id,
        'AdBlue purchase - vehicle ' || v_vehicle.vehicle_number,
        v_total_cost,
        0,
        'UNPAID',
        NULLIF(btrim(p_created_by), '')
    );

    RETURN v_adblue;
END;
$function$;

COMMIT;
