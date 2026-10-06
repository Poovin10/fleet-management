BEGIN;

-- ============================================================
-- TRIP ROUTE / KM CONTROL
-- ============================================================

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS freight_master_id integer,
  ADD COLUMN IF NOT EXISTS route_standard_km numeric,
  ADD COLUMN IF NOT EXISTS route_min_km_tolerance_pct numeric,
  ADD COLUMN IF NOT EXISTS route_max_km_tolerance_pct numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trips_freight_master_id_fkey'
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT trips_freight_master_id_fkey
      FOREIGN KEY (freight_master_id)
      REFERENCES public.destinations_freight_master(destination_id);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trips_route_standard_km_nonnegative'
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT trips_route_standard_km_nonnegative
      CHECK (
        route_standard_km IS NULL
        OR route_standard_km >= 0
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trips_route_min_tolerance_nonnegative'
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT trips_route_min_tolerance_nonnegative
      CHECK (
        route_min_km_tolerance_pct IS NULL
        OR route_min_km_tolerance_pct >= 0
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trips_route_max_tolerance_nonnegative'
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT trips_route_max_tolerance_nonnegative
      CHECK (
        route_max_km_tolerance_pct IS NULL
        OR route_max_km_tolerance_pct >= 0
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_trips_freight_master_id
  ON public.trips(freight_master_id);


-- ============================================================
-- DISPATCH RPC
--
-- New argument:
--   p_freight_master_id integer
--
-- It is deliberately BEFORE the defaulted arguments so that
-- there is no ambiguous overloaded signature.
-- ============================================================

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
    d.is_active
  INTO
    v_route_origin,
    v_route_destination,
    v_route_standard_km,
    v_route_min_tolerance_pct,
    v_route_max_tolerance_pct,
    v_route_active
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
  SELECT current_status
  INTO v_vehicle_status
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


-- ============================================================
-- REMOVE EXECUTE ACCESS FROM THE OLD 16-ARG FUNCTION.
--
-- We intentionally leave the old function object in place for
-- migration compatibility, but nobody can execute it anymore.
-- All new dispatches must use the route-aware signature.
-- ============================================================

REVOKE ALL ON FUNCTION public.create_dispatch_trip_atomic(
  character varying,
  integer,
  integer,
  date,
  character varying,
  character varying,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  boolean,
  text,
  timestamptz
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_dispatch_trip_atomic(
  character varying,
  integer,
  integer,
  date,
  character varying,
  character varying,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  boolean,
  text,
  timestamptz
) FROM anon;

REVOKE ALL ON FUNCTION public.create_dispatch_trip_atomic(
  character varying,
  integer,
  integer,
  date,
  character varying,
  character varying,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  boolean,
  text,
  timestamptz
) FROM authenticated;


-- ============================================================
-- ACL FOR NEW 17-ARG ROUTE-AWARE FUNCTION
-- ============================================================

REVOKE ALL ON FUNCTION public.create_dispatch_trip_atomic(
  character varying,
  integer,
  integer,
  date,
  character varying,
  character varying,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  boolean,
  integer,
  text,
  timestamptz
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_dispatch_trip_atomic(
  character varying,
  integer,
  integer,
  date,
  character varying,
  character varying,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  boolean,
  integer,
  text,
  timestamptz
) FROM anon;

GRANT EXECUTE ON FUNCTION public.create_dispatch_trip_atomic(
  character varying,
  integer,
  integer,
  date,
  character varying,
  character varying,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  boolean,
  integer,
  text,
  timestamptz
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_dispatch_trip_atomic(
  character varying,
  integer,
  integer,
  date,
  character varying,
  character varying,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  boolean,
  integer,
  text,
  timestamptz
) TO service_role;


-- ============================================================
-- CLOSE TRIP RPC
--
-- Route KM is validated against the immutable snapshot stored
-- on the trip at dispatch.
-- ============================================================

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
  v_min_km numeric;
  v_max_km numeric;
BEGIN
  IF p_trip_id IS NULL THEN
    RAISE EXCEPTION 'TRIP_ID_REQUIRED';
  END IF;

  IF p_end_km IS NULL OR p_end_km <= 0 THEN
    RAISE EXCEPTION 'ODOMETER_MUST_BE_GREATER_THAN_ZERO';
  END IF;

  v_reading_at := COALESCE(
    p_reading_at,
    CURRENT_TIMESTAMP
  );

  SELECT *
  INTO v_trip
  FROM public.trips
  WHERE trip_id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'TRIP_NOT_FOUND: %',
      p_trip_id;
  END IF;

  IF v_trip.vehicle_id IS NULL THEN
    RAISE EXCEPTION
      'TRIP_VEHICLE_REQUIRED: trip % has no vehicle_id',
      p_trip_id;
  END IF;

  IF v_trip.trip_status NOT IN (
    'IN_TRANSIT',
    'REACHED_DESTINATION',
    'UNLOADED',
    'RETURNING'
  ) THEN
    RAISE EXCEPTION
      'TRIP_NOT_CLOSABLE: trip %, current status %',
      p_trip_id,
      v_trip.trip_status;
  END IF;

  IF v_trip.start_km IS NULL
     OR v_trip.start_km <= 0
  THEN
    RAISE EXCEPTION
      'TRIP_START_ODOMETER_REQUIRED: trip %',
      p_trip_id;
  END IF;

  IF p_end_km <= v_trip.start_km THEN
    RAISE EXCEPTION
      'ODOMETER_CLOSE_NOT_GREATER_THAN_START: trip %, start KM %, closing KM %',
      p_trip_id,
      v_trip.start_km,
      p_end_km;
  END IF;


  -- ----------------------------------------------------------
  -- Authoritative latest vehicle odometer.
  -- ----------------------------------------------------------
  PERFORM 1
  FROM public.vehicles
  WHERE vehicle_id = v_trip.vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'VEHICLE_NOT_FOUND: %',
      v_trip.vehicle_id;
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
     AND v_reading_at < v_previous_reading_at
  THEN
    RAISE EXCEPTION
      'ODOMETER_TIMESTAMP_REVERSED: vehicle %, previous timestamp %, new timestamp %',
      v_trip.vehicle_id,
      v_previous_reading_at,
      v_reading_at;
  END IF;

  IF v_previous_km IS NOT NULL
     AND p_end_km <= v_previous_km
  THEN
    RAISE EXCEPTION
      'ODOMETER_NOT_INCREASING: vehicle %, previous KM %, closing KM %',
      v_trip.vehicle_id,
      v_previous_km,
      p_end_km;
  END IF;


  -- ----------------------------------------------------------
  -- Route distance validation.
  --
  -- If a standard KM exists, actual trip KM must be inside
  -- the route master's configured tolerance.
  --
  -- Exception workflow will be added later. For now an
  -- out-of-range trip is hard blocked.
  -- ----------------------------------------------------------
  IF COALESCE(v_trip.route_standard_km, 0) > 0 THEN

    v_min_km := ROUND(
      v_trip.route_standard_km
      * (
        1
        - COALESCE(v_trip.route_min_km_tolerance_pct, 0) / 100
      ),
      1
    );

    v_max_km := ROUND(
      v_trip.route_standard_km
      * (
        1
        + COALESCE(v_trip.route_max_km_tolerance_pct, 0) / 100
      ),
      1
    );

    v_total_km := p_end_km - v_trip.start_km;

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

  ELSE
    v_total_km := p_end_km - v_trip.start_km;
  END IF;


  -- ----------------------------------------------------------
  -- Record authoritative closing odometer.
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
    p_entered_by,
    'Trip end: '
      || COALESCE(
        v_trip.trip_number,
        p_trip_id::text
      )
  );


  UPDATE public.trips
  SET
    end_km = p_end_km,
    total_km_run = v_total_km,
    trip_end_date = v_reading_at::date,
    trip_status = 'WAITING_FOR_LOAD'
  WHERE trip_id = p_trip_id
  RETURNING *
  INTO v_trip;

  RETURN v_trip;
END;
$function$;


COMMIT;
