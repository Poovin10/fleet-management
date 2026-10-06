BEGIN;

CREATE OR REPLACE FUNCTION public.close_pod_atomic(
  p_trip_id bigint,
  p_pod_number text,
  p_closing_date date,
  p_unloaded_weight_mt numeric,
  p_shortage_mt numeric,
  p_halt_bata numeric,
  p_claims numeric,
  p_add_diesel numeric,
  p_diesel_rate_per_litre numeric,
  p_filling_odometer_km numeric,
  p_is_tank_full boolean,
  p_scan_id uuid DEFAULT NULL::uuid
)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_updated public.trips%ROWTYPE;
  v_latest_odo public.vehicle_odometer_logs%ROWTYPE;
  v_scan public.pending_scans%ROWTYPE;
  v_scan_lr text;
  v_trip_lr text;
  v_fuel_log_id integer;
  v_fuel_cost numeric := 0;
  v_shortage numeric := 0;
  v_reading_at timestamptz := CURRENT_TIMESTAMP;
BEGIN
  IF p_trip_id IS NULL OR p_trip_id <= 0 THEN
    RAISE EXCEPTION 'TRIP_ID_REQUIRED';
  END IF;

  IF NULLIF(BTRIM(p_pod_number), '') IS NULL THEN
    RAISE EXCEPTION 'POD_NUMBER_REQUIRED';
  END IF;

  IF p_closing_date IS NULL THEN
    RAISE EXCEPTION 'POD_CLOSING_DATE_REQUIRED';
  END IF;

  IF p_unloaded_weight_mt IS NOT NULL
     AND p_unloaded_weight_mt < 0 THEN
    RAISE EXCEPTION 'UNLOADED_WEIGHT_INVALID';
  END IF;

  IF p_halt_bata IS NOT NULL AND p_halt_bata < 0 THEN
    RAISE EXCEPTION 'HALT_BATA_INVALID';
  END IF;

  IF p_claims IS NOT NULL AND p_claims < 0 THEN
    RAISE EXCEPTION 'CLAIMS_INVALID';
  END IF;

  IF p_add_diesel IS NULL THEN
    p_add_diesel := 0;
  END IF;

  IF p_add_diesel < 0 THEN
    RAISE EXCEPTION 'FUEL_LITRES_INVALID';
  END IF;

  SELECT *
  INTO v_trip
  FROM public.trips
  WHERE trip_id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRIP_NOT_FOUND';
  END IF;

  IF v_trip.pod_status <> 'PENDING_SUBMISSION' THEN
    RAISE EXCEPTION 'POD_ALREADY_PROCESSED';
  END IF;

  IF v_trip.vehicle_id IS NULL THEN
    RAISE EXCEPTION 'TRIP_VEHICLE_REQUIRED';
  END IF;

  SELECT *
  INTO v_vehicle
  FROM public.vehicles
  WHERE vehicle_id = v_trip.vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VEHICLE_NOT_FOUND';
  END IF;

  IF p_unloaded_weight_mt IS NOT NULL
     AND v_trip.loaded_weight_mt IS NOT NULL
     AND p_unloaded_weight_mt > v_trip.loaded_weight_mt THEN
    RAISE EXCEPTION 'UNLOADED_WEIGHT_EXCEEDS_LOADED_WEIGHT';
  END IF;

  /*
   * Server-authoritative shortage.
   * p_shortage_mt is intentionally ignored.
   */
  v_shortage := CASE
    WHEN p_unloaded_weight_mt IS NOT NULL
         AND v_trip.loaded_weight_mt IS NOT NULL
      THEN GREATEST(
        0,
        v_trip.loaded_weight_mt - p_unloaded_weight_mt
      )
    ELSE
      0
  END;

  /*
   * Optional OCR scan binding.
   *
   * If a scan contains a usable LR number, it must match the
   * trip being closed. Scans without a usable LR remain valid
   * for the existing manual-selection workflow.
   */
  IF p_scan_id IS NOT NULL THEN

    SELECT *
    INTO v_scan
    FROM public.pending_scans
    WHERE scan_id = p_scan_id
      AND status = 'PENDING'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'POD_SCAN_NOT_FOUND_OR_ALREADY_PROCESSED';
    END IF;

    v_scan_lr := NULLIF(
      REGEXP_REPLACE(
        UPPER(
          COALESCE(
            v_scan.raw_json_result ->> 'lrNo',
            ''
          )
        ),
        '[^A-Z0-9]',
        '',
        'g'
      ),
      ''
    );

    v_trip_lr := NULLIF(
      REGEXP_REPLACE(
        UPPER(COALESCE(v_trip.trip_number, '')),
        '[^A-Z0-9]',
        '',
        'g'
      ),
      ''
    );

    IF v_scan_lr IS NOT NULL
       AND v_scan_lr <> 'UNKNOWN'
       AND v_trip_lr IS NOT NULL
       AND v_scan_lr <> v_trip_lr
       AND POSITION(v_scan_lr IN v_trip_lr) = 0
       AND POSITION(v_trip_lr IN v_scan_lr) = 0 THEN
      RAISE EXCEPTION
        'POD_SCAN_LR_MISMATCH_SCAN=%_TRIP=%',
        v_scan_lr,
        v_trip_lr;
    END IF;

  END IF;

  IF p_add_diesel > 0 THEN

    IF v_vehicle.odometer_working THEN

      IF p_filling_odometer_km IS NULL
         OR p_filling_odometer_km <= 0 THEN
        RAISE EXCEPTION 'FUEL_ODOMETER_REQUIRED';
      END IF;

      SELECT *
      INTO v_latest_odo
      FROM public.vehicle_odometer_logs
      WHERE vehicle_id = v_trip.vehicle_id
      ORDER BY reading_at DESC, odometer_log_id DESC
      LIMIT 1
      FOR UPDATE;

      IF FOUND THEN

        IF p_filling_odometer_km <= v_latest_odo.odometer_km THEN
          RAISE EXCEPTION
            'ODOMETER_MUST_INCREASE_PREVIOUS=%',
            v_latest_odo.odometer_km;
        END IF;

        IF v_latest_odo.reading_at IS NOT NULL
           AND v_reading_at < v_latest_odo.reading_at THEN
          RAISE EXCEPTION 'FUEL_READING_TIME_BEFORE_LATEST_ODOMETER';
        END IF;

      END IF;

    END IF;

    IF p_diesel_rate_per_litre IS NULL
       OR p_diesel_rate_per_litre <= 0 THEN
      RAISE EXCEPTION 'FUEL_RATE_INVALID';
    END IF;

    v_fuel_cost := ROUND(
      p_add_diesel * p_diesel_rate_per_litre,
      2
    );

    INSERT INTO public.diesel_fuel_logs (
      fuel_date,
      vehicle_id,
      trip_id,
      lr_number,
      diesel_category,
      litres_filled,
      diesel_rate_per_litre,
      total_fuel_cost,
      filling_odometer_km,
      is_tank_full
    )
    VALUES (
      p_closing_date,
      v_trip.vehicle_id,
      v_trip.trip_id,
      v_trip.trip_number,
      'TRIP_DIESEL',
      p_add_diesel,
      p_diesel_rate_per_litre,
      v_fuel_cost,
      CASE
        WHEN v_vehicle.odometer_working
          THEN p_filling_odometer_km
        ELSE NULL
      END,
      COALESCE(p_is_tank_full, false)
    )
    RETURNING fuel_log_id
    INTO v_fuel_log_id;

    IF v_vehicle.odometer_working THEN

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
        v_trip.vehicle_id,
        p_filling_odometer_km,
        'FUEL',
        v_fuel_log_id,
        v_reading_at,
        v_reading_at,
        auth.uid()::text,
        'POD closure diesel top-up'
      );

    END IF;

  END IF;

  UPDATE public.trips
  SET
    pod_number = UPPER(BTRIM(p_pod_number)),
    pod_received_date = p_closing_date,
    pod_status = 'VERIFIED_ACCEPTED',
    shortage_mt = v_shortage,
    halt_bata = COALESCE(p_halt_bata, 0),
    enroute_repairs_maintenance = COALESCE(p_claims, 0),
    fuel_litres = COALESCE(v_trip.fuel_litres, 0) + p_add_diesel,
    fuel_expense = COALESCE(v_trip.fuel_expense, 0) + v_fuel_cost
  WHERE trip_id = p_trip_id
  RETURNING *
  INTO v_updated;

  IF p_scan_id IS NOT NULL THEN
    UPDATE public.pending_scans
    SET status = 'PROCESSED'
    WHERE scan_id = p_scan_id
      AND status = 'PENDING';
  END IF;

  RETURN v_updated;
END;
$function$;

COMMIT;
