BEGIN;

-- ============================================================
-- MODIFY TRIP: FINANCIAL SNAPSHOT PROTECTION
--
-- Normal Modify Trip is an operational correction workflow.
-- Freight/Bata are historical financial evidence and must not
-- be overwritten here.
-- ============================================================

CREATE OR REPLACE FUNCTION public.modify_trip_atomic(
  p_trip_id bigint,
  p_payload jsonb
)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog, public'
AS $function$
DECLARE
  v_role text;
  v_settlement_status text;
  v_blocked_financial_fields text[] := ARRAY[]::text[];
BEGIN

  IF auth.role() <> 'service_role' THEN
    v_role := public.get_current_user_role();

    IF v_role NOT IN ('ADMIN', 'SUPERADMIN') THEN
      RAISE EXCEPTION
        'MODIFY_TRIP authorization requires ADMIN or SUPERADMIN';
    END IF;
  END IF;

  IF p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object'
  THEN
    RAISE EXCEPTION
      'MODIFY_TRIP_INVALID_PAYLOAD';
  END IF;

  -- ----------------------------------------------------------
  -- Financial fields are never editable through normal
  -- Modify Trip.
  -- ----------------------------------------------------------

  IF p_payload ? 'freight_revenue' THEN
    v_blocked_financial_fields :=
      array_append(v_blocked_financial_fields, 'freight_revenue');
  END IF;

  IF p_payload ? 'freight_rate_used' THEN
    v_blocked_financial_fields :=
      array_append(v_blocked_financial_fields, 'freight_rate_used');
  END IF;

  IF p_payload ? 'freight_master_id' THEN
    v_blocked_financial_fields :=
      array_append(v_blocked_financial_fields, 'freight_master_id');
  END IF;

  IF p_payload ? 'driver_bata' THEN
    v_blocked_financial_fields :=
      array_append(v_blocked_financial_fields, 'driver_bata');
  END IF;

  IF p_payload ? 'bata_amount_used' THEN
    v_blocked_financial_fields :=
      array_append(v_blocked_financial_fields, 'bata_amount_used');
  END IF;

  IF p_payload ? 'bata_rule_id' THEN
    v_blocked_financial_fields :=
      array_append(v_blocked_financial_fields, 'bata_rule_id');
  END IF;

  IF array_length(v_blocked_financial_fields, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'MODIFY_TRIP_FINANCIAL_FIELDS_LOCKED: %',
      array_to_string(v_blocked_financial_fields, ', ');
  END IF;

  -- ----------------------------------------------------------
  -- Fuel expense remains server-controlled.
  -- ----------------------------------------------------------

  IF p_payload ? 'fuel_expense' THEN
    p_payload := p_payload - 'fuel_expense';
  END IF;

  -- ----------------------------------------------------------
  -- Status allow-list.
  -- ----------------------------------------------------------

  IF p_payload ? 'trip_status'
     AND NULLIF(btrim(p_payload->>'trip_status'), '') IS NOT NULL
     AND upper(btrim(p_payload->>'trip_status'))
         NOT IN (
           'DISPATCHED',
           'IN_TRANSIT',
           'COMPLETED',
           'CANCELLED'
         )
  THEN
    RAISE EXCEPTION
      'MODIFY_TRIP_INVALID_STATUS';
  END IF;

  -- ----------------------------------------------------------
  -- Settled trips are immutable.
  -- ----------------------------------------------------------

  SELECT settlement_status
  INTO v_settlement_status
  FROM public.trips
  WHERE trip_id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'TRIP_NOT_FOUND';
  END IF;

  IF upper(COALESCE(v_settlement_status, 'UNSETTLED'))
     = 'SETTLED'
  THEN
    RAISE EXCEPTION
      'SETTLED_TRIP_CANNOT_BE_MODIFIED';
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
