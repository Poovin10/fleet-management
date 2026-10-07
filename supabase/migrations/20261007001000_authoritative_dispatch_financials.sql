-- ============================================================
-- KSS ERP
-- Authoritative Dispatch Financial Controls
--
-- Freight and Driver Bata are calculated from master data
-- inside the atomic dispatch transaction.
--
-- Client supplied freight/bata values remain in the RPC
-- signature for frontend compatibility only.
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_dispatch_bata_atomic(
  p_vehicle_id integer,
  p_vehicle_capacity numeric,
  p_origin text,
  p_destination text,
  p_cargo_type text
)
RETURNS TABLE (
  bata_rule_id integer,
  standard_bata_inr numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_best_priority integer;
  v_match_count integer;
  v_rule_id integer;
  v_bata numeric;
BEGIN
  /*
   * Deterministic Bata precedence.
   *
   * Destination is always exact.
   *
   * Higher score wins:
   *
   *   vehicle exact       +1000
   *   capacity exact       +100
   *   cargo exact           +10
   *   origin exact            +1
   *
   * NULL / blank vehicle   = generic vehicle
   * NULL / blank capacity  = generic capacity
   * NULL / blank origin or ALL = generic origin
   *
   * Cargo must match the authoritative Freight Master cargo type.
   */

  /*
   * CTE scope is limited to one SQL statement, so resolve the
   * winning rule, count and values together here.
   */
  WITH candidates AS (
    SELECT
      b.bata_rule_id,
      b.standard_bata_inr,

      (
        CASE
          WHEN b.vehicle_id = p_vehicle_id THEN 1000
          ELSE 0
        END
        +
        CASE
          WHEN NULLIF(btrim(COALESCE(b.capacity_tons, '')), '') IS NOT NULL
           AND EXISTS (
             SELECT 1
             FROM regexp_split_to_table(
               regexp_replace(b.capacity_tons, '[[:space:]]+', '', 'g'),
               '/'
             ) AS cap
             WHERE btrim(cap) ~ '^[0-9]+([.][0-9]+)?$'
               AND btrim(cap)::numeric = p_vehicle_capacity
           )
          THEN 100
          ELSE 0
        END
        +
        CASE
          WHEN upper(btrim(COALESCE(b.cargo_type, ''))) =
               upper(btrim(p_cargo_type))
          THEN 10
          ELSE 0
        END
        +
        CASE
          WHEN upper(btrim(COALESCE(b.origin, ''))) =
               upper(btrim(p_origin))
          THEN 1
          ELSE 0
        END
      ) AS priority

    FROM public.driver_bata_master b

    WHERE upper(btrim(b.destination_name)) =
          upper(btrim(p_destination))

      AND b.standard_bata_inr IS NOT NULL
      AND b.standard_bata_inr >= 0

      AND (
        b.vehicle_id = p_vehicle_id
        OR b.vehicle_id IS NULL
      )

      AND (
        NULLIF(btrim(COALESCE(b.capacity_tons, '')), '') IS NULL
        OR EXISTS (
          SELECT 1
          FROM regexp_split_to_table(
            regexp_replace(b.capacity_tons, '[[:space:]]+', '', 'g'),
            '/'
          ) AS cap
          WHERE btrim(cap) ~ '^[0-9]+([.][0-9]+)?$'
            AND btrim(cap)::numeric = p_vehicle_capacity
        )
      )

      AND (
        upper(btrim(COALESCE(b.cargo_type, ''))) =
          upper(btrim(p_cargo_type))
        OR upper(btrim(COALESCE(b.cargo_type, ''))) = 'ALL'
        OR NULLIF(btrim(COALESCE(b.cargo_type, '')), '') IS NULL
      )

      AND (
        upper(btrim(COALESCE(b.origin, ''))) =
          upper(btrim(p_origin))
        OR upper(btrim(COALESCE(b.origin, ''))) = 'ALL'
        OR NULLIF(btrim(COALESCE(b.origin, '')), '') IS NULL
      )
  ),

  best AS (
    SELECT MAX(priority) AS priority
    FROM candidates
  )

  SELECT
    COUNT(*) FILTER (
      WHERE c.priority = b.priority
    ),
    b.priority,
    MAX(c.bata_rule_id) FILTER (
      WHERE c.priority = b.priority
    ),
    MAX(c.standard_bata_inr) FILTER (
      WHERE c.priority = b.priority
    )
  INTO
    v_match_count,
    v_best_priority,
    v_rule_id,
    v_bata
  FROM candidates c
  CROSS JOIN best b
  GROUP BY b.priority;

  IF v_best_priority IS NULL THEN
    RAISE EXCEPTION
      'BATA_MASTER_NOT_FOUND: destination %, origin %, cargo %, vehicle %, capacity %',
      p_destination,
      p_origin,
      p_cargo_type,
      p_vehicle_id,
      p_vehicle_capacity;
  END IF;

  IF v_match_count > 1 THEN
    RAISE EXCEPTION
      'AMBIGUOUS_BATA_RULE: % rules match destination %, origin %, cargo %, vehicle %, capacity % at priority %',
      v_match_count,
      p_destination,
      p_origin,
      p_cargo_type,
      p_vehicle_id,
      p_vehicle_capacity,
      v_best_priority;
  END IF;

  RETURN QUERY
  SELECT v_rule_id, round(v_bata, 2);
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_dispatch_bata_atomic(
  integer,
  numeric,
  text,
  text,
  text
) FROM PUBLIC;

-- Internal resolver only. Do not expose Bata master values to clients.
GRANT EXECUTE ON FUNCTION public.resolve_dispatch_bata_atomic(
  integer,
  numeric,
  text,
  text,
  text
) TO service_role;

GRANT EXECUTE ON FUNCTION public.resolve_dispatch_bata_atomic(
  integer,
  numeric,
  text,
  text,
  text
) TO postgres;


-- ============================================================
-- Authoritative dispatch transaction
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
  v_route_cargo_type text;
  v_route_standard_km numeric;
  v_route_min_tolerance_pct numeric;
  v_route_max_tolerance_pct numeric;
  v_route_active boolean;
  v_route_capacity_tons text;
  v_route_freight_rate numeric;

  v_vehicle_capacity_tons numeric;

  v_authoritative_freight numeric;
  v_authoritative_bata numeric;
  v_bata_rule_id integer;
  v_role text;
BEGIN
  -- ----------------------------------------------------------
  -- Authorization
  --
  -- Normal ERP callers must be ADMIN or SUPERADMIN.
  -- Trusted service-role callers bypass application-role lookup.
  -- ----------------------------------------------------------
  IF auth.role() <> 'service_role' THEN
    v_role := public.get_current_user_role();

    IF v_role NOT IN ('ADMIN', 'SUPERADMIN') THEN
      RAISE EXCEPTION
        'DISPATCH authorization requires ADMIN or SUPERADMIN';
    END IF;
  END IF;

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

  IF p_tonnage_loaded IS NULL OR p_tonnage_loaded <= 0 THEN
    RAISE EXCEPTION 'INVALID_TONNAGE';
  END IF;

  IF p_fuel_litres IS NULL OR p_fuel_litres < 0 THEN
    RAISE EXCEPTION 'INVALID_FUEL_LITRES';
  END IF;

  IF p_fuel_expense IS NULL OR p_fuel_expense < 0 THEN
    RAISE EXCEPTION 'INVALID_FUEL_EXPENSE';
  END IF;

  IF p_cash_advance_issued IS NULL OR p_cash_advance_issued < 0 THEN
    RAISE EXCEPTION 'INVALID_CASH_ADVANCE';
  END IF;

  v_reading_at := COALESCE(
    p_reading_at,
    current_timestamp
  );

  -- ----------------------------------------------------------
  -- Freight master is the authoritative route + cargo source.
  -- ----------------------------------------------------------
  SELECT
    d.origin,
    d.destination_name,
    d.cargo_type,
    d.standard_km,
    d.min_km_tolerance_pct,
    d.max_km_tolerance_pct,
    d.is_active,
    d.capacity_tons,
    d.freight_rate_per_ton
  INTO
    v_route_origin,
    v_route_destination,
    v_route_cargo_type,
    v_route_standard_km,
    v_route_min_tolerance_pct,
    v_route_max_tolerance_pct,
    v_route_active,
    v_route_capacity_tons,
    v_route_freight_rate
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

  IF v_route_cargo_type IS NULL
     OR btrim(v_route_cargo_type) = ''
  THEN
    RAISE EXCEPTION
      'FREIGHT_MASTER_CARGO_TYPE_REQUIRED: master %',
      p_freight_master_id;
  END IF;

  IF v_route_freight_rate IS NULL
     OR v_route_freight_rate <= 0
  THEN
    RAISE EXCEPTION
      'INVALID_FREIGHT_MASTER_RATE: master %',
      p_freight_master_id;
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
  -- AUTHORITATIVE FREIGHT
  --
  -- Client p_freight_revenue is deliberately ignored.
  -- ----------------------------------------------------------
  v_authoritative_freight :=
    round(v_route_freight_rate * p_tonnage_loaded, 2);

  -- ----------------------------------------------------------
  -- AUTHORITATIVE DRIVER BATA
  --
  -- Cargo comes from the locked Freight Master.
  -- ----------------------------------------------------------
  SELECT
    r.bata_rule_id,
    r.standard_bata_inr
  INTO
    v_bata_rule_id,
    v_authoritative_bata
  FROM public.resolve_dispatch_bata_atomic(
    p_vehicle_id,
    v_vehicle_capacity_tons,
    p_origin,
    p_destination,
    v_route_cargo_type
  ) r;

  IF v_bata_rule_id IS NULL THEN
    RAISE EXCEPTION
      'BATA_MASTER_REQUIRED: destination %, cargo %',
      p_destination,
      v_route_cargo_type;
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
  -- Create trip.
  --
  -- IMPORTANT:
  -- p_freight_revenue and p_driver_bata are NOT used.
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
    v_authoritative_freight,
    p_fuel_litres,
    p_fuel_expense,
    v_authoritative_bata,
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

  -- ----------------------------------------------------------
  -- Link odometer reading to created trip.
  -- ----------------------------------------------------------
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


-- ------------------------------------------------------------
-- Disable the legacy dispatch overload.
--
-- This signature predates freight_master_id and therefore cannot
-- enforce authoritative route/financial master data.
-- ------------------------------------------------------------
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
) FROM PUBLIC, anon, authenticated, service_role;

-- Keep the authoritative dispatch signature locked down.
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
