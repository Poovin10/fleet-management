BEGIN;

REVOKE SELECT
ON TABLE public.driver_direct_advances
FROM anon;

COMMIT;
