BEGIN;

-- ============================================================
-- KSS ERP: Secure Modify Trips authorization boundary
--
-- Existing implementation is preserved as an internal core RPC.
-- The public application-facing RPC performs the role check.
-- ============================================================

ALTER FUNCTION public.modify_trip_atomic(bigint, jsonb)
RENAME TO modify_trip_atomic_core;

-- The core implementation must not be directly callable by
-- normal authenticated clients.
REVOKE EXECUTE
ON FUNCTION public.modify_trip_atomic_core(bigint, jsonb)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.modify_trip_atomic_core(bigint, jsonb)
TO service_role;

-- Application-facing wrapper keeps the existing RPC name and
-- signature used by ModifyTrips.tsx.
CREATE OR REPLACE FUNCTION public.modify_trip_atomic(
  p_trip_id bigint,
  p_payload jsonb
)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_role text;
BEGIN
  -- Trusted backend/service-role callers bypass application-role
  -- lookup. Normal authenticated users must be ADMIN/SUPERADMIN.
  IF auth.role() <> 'service_role' THEN
    v_role := public.get_current_user_role();

    IF v_role NOT IN ('ADMIN', 'SUPERADMIN') THEN
      RAISE EXCEPTION
        'MODIFY_TRIP authorization requires ADMIN or SUPERADMIN';
    END IF;
  END IF;

  RETURN public.modify_trip_atomic_core(
    p_trip_id,
    p_payload
  );
END;
$function$;

REVOKE EXECUTE
ON FUNCTION public.modify_trip_atomic(bigint, jsonb)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.modify_trip_atomic(bigint, jsonb)
TO authenticated, service_role;

COMMIT;
