BEGIN;

-- ============================================================
-- KSS ERP: Modify Trips business-integrity hardening
--
-- The application-facing wrapper remains the security boundary.
-- The existing core implementation is preserved.
--
-- Hardening:
--   1. Payload must be a JSON object.
--   2. trip_status is restricted to the statuses exposed by
--      the Modify Trips workflow.
--   3. Client-supplied fuel_expense is removed before the core
--      function receives the payload.
--      The core therefore calculates:
--          litres × diesel_rate_per_litre
--
-- We intentionally do NOT enforce the full operational trip
-- state machine here because Modify Trips is an ADMIN/SUPERADMIN
-- correction workflow.
-- ============================================================

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
  v_status text;
  v_safe_payload jsonb;
BEGIN
  -- ----------------------------------------------------------
  -- Authorization
  -- ----------------------------------------------------------
  IF auth.role() <> 'service_role' THEN
    v_role := public.get_current_user_role();

    IF v_role NOT IN ('ADMIN', 'SUPERADMIN') THEN
      RAISE EXCEPTION
        'MODIFY_TRIP authorization requires ADMIN or SUPERADMIN';
    END IF;
  END IF;

  -- ----------------------------------------------------------
  -- Payload shape
  -- ----------------------------------------------------------
  IF p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'TRIP_PAYLOAD_INVALID';
  END IF;

  -- ----------------------------------------------------------
  -- Status allow-list
  --
  -- These are the statuses intentionally exposed by the
  -- Modify Trips UI.
  -- ----------------------------------------------------------
  v_status := NULLIF(BTRIM(p_payload->>'trip_status'), '');

  IF v_status IS NOT NULL
     AND v_status NOT IN (
       'DISPATCHED',
       'IN_TRANSIT',
       'COMPLETED',
       'CANCELLED'
     ) THEN
    RAISE EXCEPTION 'TRIP_STATUS_INVALID_FOR_MODIFY';
  END IF;

  -- ----------------------------------------------------------
  -- Server-authoritative fuel expense
  --
  -- Never allow the client to choose fuel_expense.
  -- The existing core calculates the amount from:
  --
  --     fuel_litres × diesel_rate_per_litre
  --
  -- when fuel_litres > 0.
  -- ----------------------------------------------------------
  v_safe_payload := p_payload - 'fuel_expense';

  RETURN public.modify_trip_atomic_core(
    p_trip_id,
    v_safe_payload
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
