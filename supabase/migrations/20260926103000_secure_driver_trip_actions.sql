-- Secure driver trip close and breakdown actions behind driver sessions.
-- Existing atomic functions remain available only to trusted backend roles.

CREATE OR REPLACE FUNCTION public.close_driver_trip_session_atomic(
  p_session_token text,
  p_trip_id bigint,
  p_end_km numeric,
  p_reading_at timestamptz DEFAULT CURRENT_TIMESTAMP
)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog, public'
AS $function$
DECLARE
  v_driver_id integer;
  v_trip public.trips%ROWTYPE;
  v_result public.trips;
BEGIN
  v_driver_id := public.resolve_driver_session(p_session_token);

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

  v_result := public.close_driver_trip_atomic(
    p_trip_id,
    p_end_km,
    p_reading_at,
    'DRIVER_SESSION'
  );

  RETURN v_result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.record_driver_breakdown_session_atomic(
  p_session_token text,
  p_trip_id bigint,
  p_vehicle_id integer,
  p_odometer_km numeric,
  p_reading_at timestamptz,
  p_breakdown_remarks text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog, public'
AS $function$
DECLARE
  v_driver_id integer;
  v_trip public.trips%ROWTYPE;
BEGIN
  v_driver_id := public.resolve_driver_session(p_session_token);

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

  IF v_trip.vehicle_id IS DISTINCT FROM p_vehicle_id THEN
    RAISE EXCEPTION 'TRIP_VEHICLE_MISMATCH';
  END IF;

  PERFORM public.record_driver_breakdown_atomic(
    p_trip_id,
    p_vehicle_id,
    p_odometer_km,
    p_reading_at,
    'DRIVER_SESSION',
    p_breakdown_remarks
  );
END;
$function$;


REVOKE EXECUTE ON FUNCTION public.close_driver_trip_session_atomic(
  text,
  bigint,
  numeric,
  timestamptz
) FROM PUBLIC;


REVOKE EXECUTE ON FUNCTION public.record_driver_breakdown_session_atomic(
  text,
  bigint,
  integer,
  numeric,
  timestamptz,
  text
) FROM PUBLIC;


REVOKE EXECUTE ON FUNCTION public.close_driver_trip_atomic(
  bigint,
  numeric,
  timestamptz,
  text
) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.close_driver_trip_atomic(
  bigint,
  numeric,
  timestamptz,
  text
) FROM PUBLIC;


REVOKE EXECUTE ON FUNCTION public.record_driver_breakdown_atomic(
  bigint,
  integer,
  numeric,
  timestamptz,
  text,
  text
) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.record_driver_breakdown_atomic(
  bigint,
  integer,
  numeric,
  timestamptz,
  text,
  text
) FROM PUBLIC;


GRANT EXECUTE ON FUNCTION public.close_driver_trip_session_atomic(
  text,
  bigint,
  numeric,
  timestamptz
) TO anon, authenticated;


GRANT EXECUTE ON FUNCTION public.record_driver_breakdown_session_atomic(
  text,
  bigint,
  integer,
  numeric,
  timestamptz,
  text
) TO anon, authenticated;
