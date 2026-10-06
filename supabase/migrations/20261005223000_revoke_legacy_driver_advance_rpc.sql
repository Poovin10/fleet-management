BEGIN;

REVOKE ALL
ON FUNCTION public.save_driver_advance_atomic(
  integer,
  date,
  integer,
  numeric,
  text,
  text,
  text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.save_driver_advance_atomic(
  integer,
  date,
  integer,
  numeric,
  text,
  text,
  text
)
TO service_role;

COMMIT;
