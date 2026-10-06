BEGIN;

-- ============================================================
-- Secure Driver Portal status actions
--
-- Driver may request an ACTION.
-- Database decides the resulting trip/vehicle state.
--
-- Actions:
--   REACHED
--   UNLOADED
--   RETURNING
--
-- Driver session is authenticated through resolve_driver_session().
-- No arbitrary trip_status / vehicle_status / end_km is accepted.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_driver_trip_status_session_atomic(
  p_session_token text,
  p_trip_id bigint,
  p_action text,
  p_unloaded_weight_mt numeric DEFAULT NULL,
  p_remarks text DEFAULT NULL,
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
  v_vehicle_id bigint;
  v_action text;
  v_timestamp timestamptz;
  v_shortage numeric;
  v_remarks text;
BEGIN
  -- ----------------------------------------------------------
  -- 1. Resolve and validate the driver session.
  -- ----------------------------------------------------------
  v_driver_id := public.resolve_driver_session(p_session_token);

  v_action := upper(btrim(COALESCE(p_action, '')));
  v_timestamp := COALESCE(p_reading_at, CURRENT_TIMESTAMP);
  v_remarks := NULLIF(btrim(COALESCE(p_remarks, '')), '');

  IF p_trip_id IS NULL THEN
    RAISE EXCEPTION 'TRIP_ID_REQUIRED';
  END IF;

  IF v_action NOT IN ('REACHED', 'UNLOADED', 'RETURNING') THEN
    RAISE EXCEPTION 'INVALID_DRIVER_TRIP_ACTION';
  END IF;

  -- ----------------------------------------------------------
  -- 2. Lock the trip and establish driver ownership.
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
    RAISE EXCEPTION 'TRIP_VEHICLE_REQUIRED';
  END IF;

  v_vehicle_id := v_trip.vehicle_id;

  -- ----------------------------------------------------------
  -- 3. Lock the authoritative vehicle row.
  -- ----------------------------------------------------------
  PERFORM 1
  FROM public.vehicles
  WHERE vehicle_id = v_vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VEHICLE_NOT_FOUND: %', v_vehicle_id;
  END IF;

  -- ----------------------------------------------------------
  -- 4. REACHED
  --
  -- IN_TRANSIT -> REACHED_DESTINATION
  -- Vehicle -> WAITING_FOR_UNLOAD
  -- ----------------------------------------------------------
  IF v_action = 'REACHED' THEN

    IF v_trip.trip_status <> 'IN_TRANSIT' THEN
      RAISE EXCEPTION
        'INVALID_TRIP_TRANSITION: REACHED requires IN_TRANSIT, current status %',
        v_trip.trip_status;
    END IF;

    IF v_timestamp < COALESCE(v_trip.trip_start_date::timestamptz, v_timestamp) THEN
      RAISE EXCEPTION 'DRIVER_STATUS_TIMESTAMP_REVERSED';
    END IF;

    UPDATE public.trips
    SET
      reached_at = v_timestamp,
      trip_status = 'REACHED_DESTINATION',
      breakdown_remarks = CASE
        WHEN v_remarks IS NOT NULL THEN v_remarks
        ELSE breakdown_remarks
      END
    WHERE trip_id = p_trip_id
    RETURNING * INTO v_trip;

    UPDATE public.vehicles
    SET
      current_status = 'WAITING_FOR_UNLOAD',
      status_remarks = COALESCE(v_remarks, 'Reached destination - waiting for unload'),
      status_updated_at = v_timestamp
    WHERE vehicle_id = v_vehicle_id;

    RETURN v_trip;
  END IF;

  -- ----------------------------------------------------------
  -- 5. UNLOADED
  --
  -- REACHED_DESTINATION -> UNLOADED
  -- Vehicle -> UNLOADED
  --
  -- Shortage is calculated by the database.
  -- The browser cannot supply shortage_mt.
  -- ----------------------------------------------------------
  IF v_action = 'UNLOADED' THEN

    IF v_trip.trip_status <> 'REACHED_DESTINATION' THEN
      RAISE EXCEPTION
        'INVALID_TRIP_TRANSITION: UNLOADED requires REACHED_DESTINATION, current status %',
        v_trip.trip_status;
    END IF;

    IF v_timestamp < COALESCE(v_trip.reached_at, v_timestamp) THEN
      RAISE EXCEPTION 'DRIVER_STATUS_TIMESTAMP_REVERSED';
    END IF;

    IF p_unloaded_weight_mt IS NOT NULL THEN
      IF p_unloaded_weight_mt < 0 THEN
        RAISE EXCEPTION 'UNLOADED_WEIGHT_CANNOT_BE_NEGATIVE';
      END IF;

      IF v_trip.loaded_weight_mt IS NOT NULL
         AND v_trip.loaded_weight_mt > 0
         AND p_unloaded_weight_mt > v_trip.loaded_weight_mt THEN
        RAISE EXCEPTION
          'UNLOADED_WEIGHT_EXCEEDS_LOADED_WEIGHT: loaded %, unloaded %',
          v_trip.loaded_weight_mt,
          p_unloaded_weight_mt;
      END IF;

      IF v_trip.loaded_weight_mt IS NOT NULL
         AND v_trip.loaded_weight_mt > 0 THEN
        v_shortage :=
          GREATEST(0, v_trip.loaded_weight_mt - p_unloaded_weight_mt);
      ELSE
        v_shortage := NULL;
      END IF;
    ELSE
      v_shortage := v_trip.shortage_mt;
    END IF;

    UPDATE public.trips
    SET
      unloaded_at = v_timestamp,
      trip_status = 'UNLOADED',
      unloaded_weight_mt = COALESCE(
        p_unloaded_weight_mt,
        unloaded_weight_mt
      ),
      shortage_mt = v_shortage,
      breakdown_remarks = CASE
        WHEN v_remarks IS NOT NULL THEN v_remarks
        ELSE breakdown_remarks
      END
    WHERE trip_id = p_trip_id
    RETURNING * INTO v_trip;

    UPDATE public.vehicles
    SET
      current_status = 'UNLOADED',
      status_remarks = COALESCE(v_remarks, 'Unloaded'),
      status_updated_at = v_timestamp
    WHERE vehicle_id = v_vehicle_id;

    RETURN v_trip;
  END IF;

  -- ----------------------------------------------------------
  -- 6. RETURNING
  --
  -- UNLOADED -> RETURNING
  -- Vehicle -> RETURNING
  -- ----------------------------------------------------------
  IF v_action = 'RETURNING' THEN

    IF v_trip.trip_status <> 'UNLOADED' THEN
      RAISE EXCEPTION
        'INVALID_TRIP_TRANSITION: RETURNING requires UNLOADED, current status %',
        v_trip.trip_status;
    END IF;

    IF v_timestamp < COALESCE(v_trip.unloaded_at, v_timestamp) THEN
      RAISE EXCEPTION 'DRIVER_STATUS_TIMESTAMP_REVERSED';
    END IF;

    UPDATE public.trips
    SET
      returning_at = v_timestamp,
      trip_status = 'RETURNING',
      breakdown_remarks = CASE
        WHEN v_remarks IS NOT NULL THEN v_remarks
        ELSE breakdown_remarks
      END
    WHERE trip_id = p_trip_id
    RETURNING * INTO v_trip;

    UPDATE public.vehicles
    SET
      current_status = 'RETURNING',
      status_remarks = COALESCE(v_remarks, 'Returning from destination'),
      status_updated_at = v_timestamp
    WHERE vehicle_id = v_vehicle_id;

    RETURN v_trip;
  END IF;

  RAISE EXCEPTION 'UNEXPECTED_DRIVER_TRIP_ACTION';

END;
$function$;

-- Driver portal uses its own session-token authentication.
REVOKE ALL ON FUNCTION public.update_driver_trip_status_session_atomic(
  text,
  bigint,
  text,
  numeric,
  text,
  timestamptz
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_driver_trip_status_session_atomic(
  text,
  bigint,
  text,
  numeric,
  text,
  timestamptz
) TO anon, authenticated, service_role;

COMMIT;
