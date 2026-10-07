BEGIN;

-- ============================================================
-- AUTHORITATIVE TRIP COMPLETION
--
-- Driver closes a RETURNING trip with the closing odometer.
--
-- Atomic business transaction:
--   RETURNING
--       ->
--   COMPLETED (trip)
--       +
--   WAITING_FOR_LOAD (vehicle)
--       +
--   TRIP_END odometer log
--
-- WAITING_FOR_LOAD belongs to VEHICLE availability only.
-- It is never written as the final state of a completed trip.
-- ============================================================

CREATE OR REPLACE FUNCTION public.close_driver_trip_session_atomic(
  p_session_token text,
  p_trip_id bigint,
  p_end_km numeric,
  p_reading_at timestamptz DEFAULT CURRENT_TIMESTAMP
)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_driver_id integer;
  v_trip public.trips%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_previous_km numeric;
  v_previous_reading_at timestamptz;
  v_reading_at timestamptz;
  v_total_km numeric;
  v_min_km numeric;
  v_max_km numeric;
BEGIN
  -- ----------------------------------------------------------
  -- 1. Resolve authenticated driver session.
  -- ----------------------------------------------------------
  v_driver_id := public.resolve_driver_session(p_session_token);

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'DRIVER_SESSION_INVALID';
  END IF;

  IF p_trip_id IS NULL THEN
    RAISE EXCEPTION 'TRIP_ID_REQUIRED';
  END IF;

  IF p_end_km IS NULL OR p_end_km <= 0 THEN
    RAISE EXCEPTION 'ODOMETER_MUST_BE_GREATER_THAN_ZERO';
  END IF;

  v_reading_at := COALESCE(p_reading_at, CURRENT_TIMESTAMP);

  -- ----------------------------------------------------------
  -- 2. Lock authoritative trip.
  -- ----------------------------------------------------------
  SELECT *
  INTO v_trip
  FROM public.trips
  WHERE trip_id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRIP_NOT_FOUND: %', p_trip_id;
  END IF;

  IF v_trip.primary_driver_id IS DISTINCT FROM v_driver_id THEN
    RAISE EXCEPTION 'DRIVER_NOT_ASSIGNED_TO_TRIP';
  END IF;

  IF v_trip.vehicle_id IS NULL THEN
    RAISE EXCEPTION 'TRIP_VEHICLE_REQUIRED: trip %', p_trip_id;
  END IF;

  -- ----------------------------------------------------------
  -- 3. Completion is allowed ONLY from RETURNING.
  --
  -- This prevents skipping:
  --   REACHED -> UNLOADED -> RETURNING
  -- ----------------------------------------------------------
  IF v_trip.trip_status <> 'RETURNING' THEN
    RAISE EXCEPTION
      'TRIP_NOT_READY_FOR_COMPLETION: trip %, current status %; RETURNING required',
      p_trip_id,
      v_trip.trip_status;
  END IF;

  IF v_trip.start_km IS NULL OR v_trip.start_km <= 0 THEN
    RAISE EXCEPTION
      'TRIP_START_ODOMETER_REQUIRED: trip %',
      p_trip_id;
  END IF;

  IF v_reading_at < COALESCE(v_trip.returning_at, v_reading_at) THEN
    RAISE EXCEPTION 'ODOMETER_TIMESTAMP_REVERSED';
  END IF;

  -- ----------------------------------------------------------
  -- 4. Lock vehicle.
  -- ----------------------------------------------------------
  SELECT *
  INTO v_vehicle
  FROM public.vehicles
  WHERE vehicle_id = v_trip.vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VEHICLE_NOT_FOUND: %', v_trip.vehicle_id;
  END IF;

  -- ----------------------------------------------------------
  -- 5. Authoritative odometer chain.
  -- ----------------------------------------------------------
  SELECT
    vol.odometer_km,
    vol.reading_at
  INTO
    v_previous_km,
    v_previous_reading_at
  FROM public.vehicle_odometer_logs vol
  WHERE vol.vehicle_id = v_trip.vehicle_id
  ORDER BY
    vol.reading_at DESC,
    vol.odometer_log_id DESC
  LIMIT 1;

  IF v_previous_reading_at IS NOT NULL
     AND v_reading_at < v_previous_reading_at THEN
    RAISE EXCEPTION
      'ODOMETER_TIMESTAMP_REVERSED: vehicle %, previous timestamp %, new timestamp %',
      v_trip.vehicle_id,
      v_previous_reading_at,
      v_reading_at;
  END IF;

  IF p_end_km <= v_trip.start_km THEN
    RAISE EXCEPTION
      'ODOMETER_CLOSE_NOT_GREATER_THAN_START: trip %, start KM %, closing KM %',
      p_trip_id,
      v_trip.start_km,
      p_end_km;
  END IF;

  IF v_previous_km IS NOT NULL
     AND p_end_km <= v_previous_km THEN
    RAISE EXCEPTION
      'ODOMETER_NOT_INCREASING: vehicle %, previous KM %, closing KM %',
      v_trip.vehicle_id,
      v_previous_km,
      p_end_km;
  END IF;

  v_total_km := p_end_km - v_trip.start_km;

  -- ----------------------------------------------------------
  -- 6. Route KM integrity.
  --
  -- Use the trip's route snapshot where available.
  -- ----------------------------------------------------------
  IF COALESCE(v_trip.route_standard_km, 0) > 0 THEN
    v_min_km := ROUND(
      v_trip.route_standard_km
      * (1 - COALESCE(v_trip.min_km_tolerance_pct, 10) / 100),
      3
    );

    v_max_km := ROUND(
      v_trip.route_standard_km
      * (1 + COALESCE(v_trip.max_km_tolerance_pct, 10) / 100),
      3
    );

    IF v_total_km < v_min_km THEN
      RAISE EXCEPTION
        'ROUTE_KM_BELOW_ALLOWED_RANGE: trip %, actual %, minimum %, standard %',
        p_trip_id,
        v_total_km,
        v_min_km,
        v_trip.route_standard_km;
    END IF;

    IF v_total_km > v_max_km THEN
      RAISE EXCEPTION
        'ROUTE_KM_ABOVE_ALLOWED_RANGE: trip %, actual %, maximum %, standard %',
        p_trip_id,
        v_total_km,
        v_max_km,
        v_trip.route_standard_km;
    END IF;
  END IF;

  -- ----------------------------------------------------------
  -- 7. Record authoritative closing odometer.
  -- ----------------------------------------------------------
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
    p_end_km,
    'TRIP_END',
    p_trip_id,
    v_reading_at,
    CURRENT_TIMESTAMP,
    v_driver_id::text,
    'Trip completion: ' ||
      COALESCE(v_trip.trip_number, p_trip_id::text)
  );

  -- ----------------------------------------------------------
  -- 8. Complete trip + release vehicle atomically.
  -- ----------------------------------------------------------
  UPDATE public.trips
  SET
    end_km = p_end_km,
    total_km_run = v_total_km,
    trip_end_date = v_reading_at::date,
    trip_status = 'COMPLETED'
  WHERE trip_id = p_trip_id
  RETURNING *
  INTO v_trip;

  UPDATE public.vehicles
  SET
    current_status = 'WAITING_FOR_LOAD',
    status_remarks = 'Trip completed - vehicle available for next load',
    status_updated_at = v_reading_at
  WHERE vehicle_id = v_trip.vehicle_id;

  RETURN v_trip;
END;
$function$;

-- ------------------------------------------------------------
-- Lock the legacy direct close function.
--
-- Driver portal must use the session-authenticated wrapper.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.close_driver_trip_atomic(
  bigint,
  numeric,
  timestamptz,
  text
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.close_driver_trip_atomic(
  bigint,
  numeric,
  timestamptz,
  text
) TO postgres;

-- Session wrapper is the only driver-facing close path.
REVOKE ALL ON FUNCTION public.close_driver_trip_session_atomic(
  text,
  bigint,
  numeric,
  timestamptz
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.close_driver_trip_session_atomic(
  text,
  bigint,
  numeric,
  timestamptz
) TO anon, authenticated, service_role;

COMMIT;
