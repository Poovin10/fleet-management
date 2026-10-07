BEGIN;

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
  text,
  timestamptz
) TO postgres;

COMMIT;
