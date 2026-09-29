BEGIN;

REVOKE ALL ON TABLE public.driver_sessions
FROM anon, authenticated;

REVOKE ALL ON TABLE public.driver_sessions
FROM PUBLIC;

COMMIT;
