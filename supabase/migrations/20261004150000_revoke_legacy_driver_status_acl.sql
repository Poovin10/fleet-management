BEGIN;

REVOKE EXECUTE
ON FUNCTION public.update_trip_status_atomic(
  bigint,
  bigint,
  jsonb,
  text,
  text
)
FROM anon, authenticated;

COMMIT;
