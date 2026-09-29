-- Functional fix:
-- Keep trip_end_date synchronized with the authoritative Trip End reading date.
-- No security behavior is changed here.

CREATE OR REPLACE FUNCTION public.close_driver_trip_atomic(
  p_trip_id bigint,
  p_end_km numeric,
  p_reading_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  p_entered_by text DEFAULT NULL::text
)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_trip public.trips;
  v_previous_km numeric;
  v_previous_reading_at timestamptz;
  v_reading_at timestamptz;
  v_total_km numeric;
BEGIN
  IF p_trip_id IS NULL THEN
    RAISE EXCEPTION 'TRIP_ID_REQUIRED';
  END IF;

  IF p_end_km IS NULL OR p_end_km <= 0 THEN
    RAISE EXCEPTION 'ODOMETER_MUST_BE_GREATER_THAN_ZERO';
  END IF;

  v_reading_at := COALESCE(p_reading_at, CURRENT_TIMESTAMP);

  SELECT *
  INTO v_trip
  FROM public.trips
  WHERE trip_id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRIP_NOT_FOUND: %', p_trip_id;
  END IF;

  IF v_trip.vehicle_id IS NULL THEN
    RAISE EXCEPTION 'TRIP_VEHICLE_REQUIRED: trip % has no vehicle_id', p_trip_id;
  END IF;

  IF v_trip.trip_status NOT IN (
    'IN_TRANSIT',
    'REACHED_DESTINATION',
    'UNLOADED',
    'RETURNING'
  ) THEN
    RAISE EXCEPTION 'TRIP_NOT_CLOSABLE: trip %, current status %',
      p_trip_id, v_trip.trip_status;
  END IF;

  IF v_trip.start_km IS NULL OR v_trip.start_km <= 0 THEN
    RAISE EXCEPTION 'TRIP_START_ODOMETER_REQUIRED: trip %', p_trip_id;
  END IF;

  IF p_end_km <= v_trip.start_km THEN
    RAISE EXCEPTION
      'ODOMETER_CLOSE_NOT_GREATER_THAN_START: trip %, start KM %, closing KM %',
      p_trip_id, v_trip.start_km, p_end_km;
  END IF;

  PERFORM 1
  FROM public.vehicles
  WHERE vehicle_id = v_trip.vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VEHICLE_NOT_FOUND: %', v_trip.vehicle_id;
  END IF;

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

  IF v_previous_km IS NOT NULL
     AND p_end_km <= v_previous_km THEN
    RAISE EXCEPTION
      'ODOMETER_NOT_INCREASING: vehicle %, previous KM %, closing KM %',
      v_trip.vehicle_id,
      v_previous_km,
      p_end_km;
  END IF;

  v_total_km := p_end_km - v_trip.start_km;

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
    p_entered_by,
    'Trip end: ' || COALESCE(v_trip.trip_number, p_trip_id::text)
  );

  UPDATE public.trips
  SET
    end_km = p_end_km,
    total_km_run = v_total_km,
    trip_end_date = v_reading_at::date,
    trip_status = 'WAITING_FOR_LOAD'
  WHERE trip_id = p_trip_id
  RETURNING * INTO v_trip;

  RETURN v_trip;
END;
$function$;
