-- Restore authenticated access to the authoritative trip-close RPC.
-- The function itself remains SECURITY DEFINER and performs all
-- authorization/odometer/business-rule validation internally.

REVOKE EXECUTE ON FUNCTION public.close_driver_trip_atomic(
  bigint,
  numeric,
  timestamptz,
  text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.close_driver_trip_atomic(
  bigint,
  numeric,
  timestamptz,
  text
) FROM anon;

GRANT EXECUTE ON FUNCTION public.close_driver_trip_atomic(
  bigint,
  numeric,
  timestamptz,
  text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.close_driver_trip_atomic(
  bigint,
  numeric,
  timestamptz,
  text
) TO service_role;
