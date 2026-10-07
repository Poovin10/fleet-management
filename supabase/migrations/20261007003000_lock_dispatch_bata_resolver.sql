BEGIN;

REVOKE ALL ON FUNCTION public.resolve_dispatch_bata_atomic(
  integer,
  numeric,
  text,
  text,
  text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.resolve_dispatch_bata_atomic(
  integer,
  numeric,
  text,
  text,
  text
) TO postgres, service_role;

COMMIT;
