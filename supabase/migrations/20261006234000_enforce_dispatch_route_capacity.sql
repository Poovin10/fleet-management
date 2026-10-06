-- Server-side vehicle capacity enforcement for dispatch.
-- The authoritative route master must match the selected vehicle capacity.
-- Loaded tonnage may not exceed the vehicle carrying capacity.

CREATE OR REPLACE FUNCTION public.create_dispatch_trip_atomic(
  p_trip_number character varying,
  p_vehicle_id integer,
  p_primary_driver_id integer,
  p_trip_start_date date,
  p_origin character varying,
  p_destination character varying,
  p_tonnage_loaded numeric,
  p_freight_revenue numeric,
  p_fuel_litres numeric,
  p_fuel_expense numeric,
  p_driver_bata numeric,
  p_cash_advance_issued numeric,
  p_start_km numeric,
  p_is_tank_full boolean,
  p_freight_master_id integer,
  p_entered_by text DEFAULT NULL::text,
  p_reading_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_previous_km numeric;
  v_previous_reading_at timestamptz;
  v_reading_at timestamptz;
  v_trip public.trips;
  v_vehicle_status text;
  v_entered_by text;

  v_route_origin text;
  v_route_destination text;
  v_route_standard_km numeric;
  v_route_min_tolerance_pct numeric;
  v_route_max_tolerance_pct numeric;
  v_route_active boolean;
  v_route_capacity_tons text;
  v_vehicle_capacity_tons numeric;
BEGIN
  IF p_trip_number IS NULL OR btrim(p_trip_number) = '' THEN
    RAISE EXCEPTION 'TRIP_NUMBER_REQUIRED';
  END IF;

  IF p_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'ODOMETER_VEHICLE_REQUIRED';
  END IF;

  IF p_primary_driver_id IS NULL THEN
    RAISE EXCEPTION 'PRIMARY_DRIVER_REQUIRED';
  END IF;

  IF p_trip_start_date IS NULL THEN
    RAISE EXCEPTION 'TRIP_START_DATE_REQUIRED';
  END IF;

  IF p_origin IS NULL OR btrim(p_origin) = '' THEN
    RAISE EXCEPTION 'TRIP_ORIGIN_REQUIRED';
  END IF;

  IF p_destination IS NULL OR btrim(p_destination) = '' THEN
    RAISE EXCEPTION 'TRIP_DESTINATION_REQUIRED';
  END IF;

  IF p_freight_master_id IS NULL THEN
    RAISE EXCEPTION 'FREIGHT_MASTER_REQUIRED';
  END IF;

  IF p_start_km IS NULL OR p_start_km <= 0 THEN
    RAISE EXCEPTION 'ODOMETER_MUST_BE_GREATER_THAN_ZERO';
  END IF;

  IF p_tonnage_loaded IS NULL OR p_tonnage_loaded < 0 THEN
    RAISE EXCEPTION 'INVALID_TONNAGE';
  END IF;

  IF p_freight_revenue IS NULL OR p_freight_revenue < 0 THEN
    RAISE EXCEPTION 'INVALID_FREIGHT_REVENUE';
  END IF;

  IF p_fuel_litres IS NULL OR p_fuel_litres < 0 THEN
    RAISE EXCEPTION 'INVALID_FUEL_LITRES';
  END IF;

  IF p_fuel_expense IS NULL OR p_fuel_expense < 0 THEN
    RAISE EXCEPTION 'INVALID_FUEL_EXPENSE';
  END IF;

  IF p_driver_bata IS NULL OR p_driver_bata < 0 THEN
    RAISE EXCEPTION 'INVALID_DRIVER_BATA';
  END IF;

  IF p_cash_advance_issued IS NULL OR p_cash_advance_issued < 0 THEN
    RAISE EXCEPTION 'INVALID_CASH_ADVANCE';
  END IF;

  v_reading_at := COALESCE(
    p_reading_at,
    current_timestamp
  );

  -- ----------------------------------------------------------
  -- Route master is authoritative for this trip.
  -- ----------------------------------------------------------
  SELECT
    d.origin,
    d.destination_name,
    d.standard_km,
    d.min_km_tolerance_pct,
    d.max_km_tolerance_pct,
    d.is_active,
    d.capacity_tons
  INTO
    v_route_origin,
    v_route_destination,
    v_route_standard_km,
    v_route_min_tolerance_pct,
    v_route_max_tolerance_pct,
    v_route_active,
    v_route_capacity_tons
  FROM public.destinations_freight_master d
  WHERE d.destination_id = p_freight_master_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'FREIGHT_MASTER_NOT_FOUND: %',
      p_freight_master_id;
  END IF;

  IF COALESCE(v_route_active, false) <> true THEN
    RAISE EXCEPTION
      'FREIGHT_MASTER_INACTIVE: %',
      p_freight_master_id;
  END IF;

  IF upper(btrim(v_route_origin))
     <> upper(btrim(p_origin))
  THEN
    RAISE EXCEPTION
      'FREIGHT_MASTER_ORIGIN_MISMATCH: master %, trip %',
      v_route_origin,
      p_origin;
  END IF;

  IF upper(btrim(v_route_destination))
     <> upper(btrim(p_destination))
  THEN
    RAISE EXCEPTION
      'FREIGHT_MASTER_DESTINATION_MISMATCH: master %, trip %',
      v_route_destination,
      p_destination;
  END IF;

  IF v_route_standard_km IS NOT NULL
     AND v_route_standard_km < 0
  THEN
    RAISE EXCEPTION 'INVALID_ROUTE_STANDARD_KM';
  END IF;

  IF v_route_min_tolerance_pct IS NULL
     OR v_route_min_tolerance_pct < 0
  THEN
    RAISE EXCEPTION 'INVALID_ROUTE_MIN_TOLERANCE';
  END IF;

  IF v_route_max_tolerance_pct IS NULL
     OR v_route_max_tolerance_pct < 0
  THEN
    RAISE EXCEPTION 'INVALID_ROUTE_MAX_TOLERANCE';
  END IF;


  -- ----------------------------------------------------------
  -- Vehicle lock / availability.
  -- ----------------------------------------------------------
  SELECT
    current_status,
    carrying_capacity_tons
  INTO
    v_vehicle_status,
    v_vehicle_capacity_tons
  FROM public.vehicles
  WHERE vehicle_id = p_vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'VEHICLE_NOT_FOUND: %',
      p_vehicle_id;
  END IF;

  IF v_vehicle_status <> 'AVAILABLE_FOR_LOAD' THEN
    RAISE EXCEPTION
      'VEHICLE_NOT_AVAILABLE_FOR_DISPATCH: vehicle %, status %',
      p_vehicle_id,
      v_vehicle_status;
  END IF;

  IF v_vehicle_capacity_tons IS NULL
     OR v_vehicle_capacity_tons <= 0
  THEN
    RAISE EXCEPTION
      'VEHICLE_CAPACITY_INVALID: vehicle %',
      p_vehicle_id;
  END IF;

  IF p_tonnage_loaded > v_vehicle_capacity_tons THEN
    RAISE EXCEPTION
      'TONNAGE_EXCEEDS_VEHICLE_CAPACITY: loaded %, vehicle capacity %',
      p_tonnage_loaded,
      v_vehicle_capacity_tons;
  END IF;

  IF NULLIF(btrim(COALESCE(v_route_capacity_tons, '')), '') IS NULL THEN
    RAISE EXCEPTION
      'FREIGHT_MASTER_CAPACITY_REQUIRED: master %',
      p_freight_master_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM regexp_split_to_table(
      regexp_replace(v_route_capacity_tons, '[[:space:]]+', '', 'g'),
      '/'
    ) AS capacity_token
    WHERE NULLIF(btrim(capacity_token), '') IS NOT NULL
      AND CASE
        WHEN btrim(capacity_token) ~ '^[0-9]+([.][0-9]+)?$'
        THEN btrim(capacity_token)::numeric
        ELSE NULL
      END = v_vehicle_capacity_tons
  ) THEN
    RAISE EXCEPTION
      'FREIGHT_MASTER_VEHICLE_CAPACITY_MISMATCH: master %, vehicle capacity %',
      v_route_capacity_tons,
      v_vehicle_capacity_tons;
  END IF;


  -- ----------------------------------------------------------
  -- No active trip for this vehicle.
  -- ----------------------------------------------------------
  IF EXISTS (
    SELECT 1
    FROM public.trips
    WHERE vehicle_id = p_vehicle_id
      AND (
        trip_status IS NULL
        OR trip_status NOT IN ('COMPLETED', 'CANCELLED')
      )
  ) THEN
    RAISE EXCEPTION
      'VEHICLE_ALREADY_HAS_ACTIVE_TRIP: vehicle %',
      p_vehicle_id;
  END IF;


  -- ----------------------------------------------------------
  -- Active driver.
  -- ----------------------------------------------------------
  PERFORM 1
  FROM public.drivers
  WHERE driver_id = p_primary_driver_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'ACTIVE_DRIVER_NOT_FOUND: %',
      p_primary_driver_id;
  END IF;


  -- ----------------------------------------------------------
  -- Unique LR / trip number.
  -- ----------------------------------------------------------
  IF EXISTS (
    SELECT 1
    FROM public.trips
    WHERE trip_number = btrim(p_trip_number)
  ) THEN
    RAISE EXCEPTION
      'TRIP_NUMBER_ALREADY_EXISTS: %',
      btrim(p_trip_number);
  END IF;


  -- ----------------------------------------------------------
  -- Entered-by identity.
  -- ----------------------------------------------------------
  SELECT au.username
  INTO v_entered_by
  FROM public.app_users au
  WHERE lower(btrim(au.username))
        = lower(btrim(COALESCE(auth.email(), '')))
  LIMIT 1;

  v_entered_by := COALESCE(
    NULLIF(btrim(v_entered_by), ''),
    NULLIF(btrim(auth.email()), ''),
    'SYSTEM'
  );


  -- ----------------------------------------------------------
  -- Authoritative vehicle odometer chain.
  -- ----------------------------------------------------------
  SELECT
    vol.odometer_km,
    vol.reading_at
  INTO
    v_previous_km,
    v_previous_reading_at
  FROM public.vehicle_odometer_logs vol
  WHERE vol.vehicle_id = p_vehicle_id
  ORDER BY
    vol.reading_at DESC,
    vol.odometer_log_id DESC
  LIMIT 1;

  IF v_previous_reading_at IS NOT NULL
     AND v_reading_at < v_previous_reading_at
  THEN
    RAISE EXCEPTION
      'ODOMETER_TIMESTAMP_REVERSED: vehicle %, previous timestamp %, new timestamp %',
      p_vehicle_id,
      v_previous_reading_at,
      v_reading_at;
  END IF;

  IF v_previous_km IS NOT NULL
     AND p_start_km <= v_previous_km
  THEN
    RAISE EXCEPTION
      'ODOMETER_NOT_INCREASING: vehicle %, previous KM %, new KM %',
      p_vehicle_id,
      v_previous_km,
      p_start_km;
  END IF;


  -- ----------------------------------------------------------
  -- Start odometer reading.
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
    p_vehicle_id,
    p_start_km,
    'TRIP_START',
    NULL,
    v_reading_at,
    current_timestamp,
    v_entered_by,
    'Trip start: ' || btrim(p_trip_number)
  );


  -- ----------------------------------------------------------
  -- Create trip with immutable route snapshot.
  -- ----------------------------------------------------------
  INSERT INTO public.trips (
    trip_number,
    vehicle_id,
    primary_driver_id,
    trip_start_date,
    trip_end_date,
    origin,
    destination,
    tonnage_loaded,
    loaded_weight_mt,
    freight_revenue,
    fuel_litres,
    fuel_expense,
    driver_bata,
    cash_advance_issued,
    start_km,
    is_tank_full,
    trip_status,
    freight_master_id,
    route_standard_km,
    route_min_km_tolerance_pct,
    route_max_km_tolerance_pct
  )
  VALUES (
    btrim(p_trip_number),
    p_vehicle_id,
    p_primary_driver_id,
    p_trip_start_date,
    p_trip_start_date,
    btrim(p_origin),
    btrim(p_destination),
    p_tonnage_loaded,
    p_tonnage_loaded,
    p_freight_revenue,
    p_fuel_litres,
    0,
    p_driver_bata,
    p_cash_advance_issued,
    p_start_km,
    COALESCE(p_is_tank_full, false),
    'WAITING_FOR_LOAD',
    p_freight_master_id,
    v_route_standard_km,
    v_route_min_tolerance_pct,
    v_route_max_tolerance_pct
  )
  RETURNING *
  INTO v_trip;


  -- Link odometer reading to created trip.
  UPDATE public.vehicle_odometer_logs
  SET reference_id = v_trip.trip_id
  WHERE vehicle_id = p_vehicle_id
    AND reading_type = 'TRIP_START'
    AND reference_id IS NULL
    AND odometer_km = p_start_km
    AND reading_at = v_reading_at;

  RETURN v_trip;
END;
$function$;
