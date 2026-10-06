BEGIN;

-- ============================================================
-- KSS ERP: Driver Settlement Financial Integrity
--
-- 1. Settlement requires ADMIN / SUPERADMIN.
-- 2. Only COMPLETED, unsettled trips can be settled.
-- 3. Unsettled direct advances are included.
-- 4. Matching rows are locked before settlement.
-- 5. Financial totals are calculated server-side.
-- 6. Settlement returns authoritative financial totals.
-- 7. Normal Modify Trip cannot modify a SETTLED trip.
--
-- Existing modify_trip_atomic_core remains the write engine.
-- The application-facing modify_trip_atomic remains the
-- authorization/integrity boundary.
-- ============================================================


-- ============================================================
-- 1. AUTHORITATIVE DRIVER PERIOD SETTLEMENT
-- ============================================================

CREATE OR REPLACE FUNCTION public.settle_driver_period_atomic(
  p_driver_id integer,
  p_from_date date,
  p_to_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_role text;

  v_trip_count integer := 0;
  v_advance_count integer := 0;

  v_bata numeric := 0;
  v_halt_bata numeric := 0;
  v_trip_cash_advance numeric := 0;
  v_direct_advance numeric := 0;
  v_net_balance numeric := 0;

  v_now timestamptz := CURRENT_TIMESTAMP;
BEGIN

  -- ----------------------------------------------------------
  -- Authorization
  -- ----------------------------------------------------------

  IF auth.role() <> 'service_role' THEN
    v_role := public.get_current_user_role();

    IF v_role NOT IN ('ADMIN', 'SUPERADMIN') THEN
      RAISE EXCEPTION
        'DRIVER_SETTLEMENT authorization requires ADMIN or SUPERADMIN';
    END IF;
  END IF;


  -- ----------------------------------------------------------
  -- Input validation
  -- ----------------------------------------------------------

  IF p_driver_id IS NULL OR p_driver_id <= 0 THEN
    RAISE EXCEPTION 'Invalid driver ID';
  END IF;

  IF p_from_date IS NULL OR p_to_date IS NULL THEN
    RAISE EXCEPTION 'Settlement dates are required';
  END IF;

  IF p_from_date > p_to_date THEN
    RAISE EXCEPTION 'From date cannot be after to date';
  END IF;


  -- ----------------------------------------------------------
  -- Driver validation
  -- ----------------------------------------------------------

  PERFORM 1
  FROM public.drivers
  WHERE driver_id = p_driver_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver does not exist or is inactive';
  END IF;


  -- ----------------------------------------------------------
  -- Lock eligible trips.
  --
  -- Settlement eligibility:
  --   correct driver
  --   period
  --   COMPLETED
  --   not already settled
  -- ----------------------------------------------------------

  PERFORM 1
  FROM public.trips
  WHERE primary_driver_id = p_driver_id
    AND trip_start_date BETWEEN p_from_date AND p_to_date
    AND trip_status = 'COMPLETED'
    AND COALESCE(settlement_status, 'UNSETTLED') <> 'SETTLED'
  FOR UPDATE;


  -- ----------------------------------------------------------
  -- Lock eligible direct advances.
  -- ----------------------------------------------------------

  PERFORM 1
  FROM public.driver_direct_advances
  WHERE driver_id = p_driver_id
    AND advance_date BETWEEN p_from_date AND p_to_date
    AND COALESCE(is_settled, false) = false
  FOR UPDATE;


  -- ----------------------------------------------------------
  -- Calculate authoritative settlement totals.
  -- ----------------------------------------------------------

  SELECT
    COALESCE(SUM(COALESCE(driver_bata, 0)), 0),
    COALESCE(SUM(COALESCE(halt_bata, 0)), 0),
    COALESCE(SUM(COALESCE(cash_advance_issued, 0)), 0),
    COUNT(*)
  INTO
    v_bata,
    v_halt_bata,
    v_trip_cash_advance,
    v_trip_count
  FROM public.trips
  WHERE primary_driver_id = p_driver_id
    AND trip_start_date BETWEEN p_from_date AND p_to_date
    AND trip_status = 'COMPLETED'
    AND COALESCE(settlement_status, 'UNSETTLED') <> 'SETTLED';


  SELECT
    COALESCE(SUM(COALESCE(amount_inr, 0)), 0),
    COUNT(*)
  INTO
    v_direct_advance,
    v_advance_count
  FROM public.driver_direct_advances
  WHERE driver_id = p_driver_id
    AND advance_date BETWEEN p_from_date AND p_to_date
    AND COALESCE(is_settled, false) = false;


  -- ----------------------------------------------------------
  -- Signed driver balance.
  --
  -- Positive = payable to driver.
  -- Negative = driver deficit / amount recoverable.
  -- ----------------------------------------------------------

  v_net_balance :=
      v_bata
    + v_halt_bata
    - v_trip_cash_advance
    - v_direct_advance;


  -- ----------------------------------------------------------
  -- Mark exactly the eligible rows settled.
  -- ----------------------------------------------------------

  UPDATE public.trips
  SET
    settlement_status = 'SETTLED',
    settled_at = v_now
  WHERE primary_driver_id = p_driver_id
    AND trip_start_date BETWEEN p_from_date AND p_to_date
    AND trip_status = 'COMPLETED'
    AND COALESCE(settlement_status, 'UNSETTLED') <> 'SETTLED';


  UPDATE public.driver_direct_advances
  SET
    is_settled = true,
    settled_at = v_now
  WHERE driver_id = p_driver_id
    AND advance_date BETWEEN p_from_date AND p_to_date
    AND COALESCE(is_settled, false) = false;


  -- ----------------------------------------------------------
  -- Return authoritative result.
  -- ----------------------------------------------------------

  RETURN jsonb_build_object(
    'success', true,
    'driver_id', p_driver_id,
    'from_date', p_from_date,
    'to_date', p_to_date,

    'trips_settled', v_trip_count,
    'advances_settled', v_advance_count,

    'driver_bata', v_bata,
    'halt_bata', v_halt_bata,
    'trip_cash_advance', v_trip_cash_advance,
    'direct_advance', v_direct_advance,

    'net_balance', v_net_balance,

    'settled_at', v_now
  );
END;
$function$;


-- ------------------------------------------------------------
-- Settlement RPC ACL
-- ------------------------------------------------------------

REVOKE EXECUTE
ON FUNCTION public.settle_driver_period_atomic(integer, date, date)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.settle_driver_period_atomic(integer, date, date)
TO authenticated, service_role;


-- ============================================================
-- 2. PROTECT SETTLED TRIPS FROM NORMAL MODIFY TRIP
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
  v_settlement_status text;
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
  -- Payload validation
  -- ----------------------------------------------------------

  IF p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'TRIP_PAYLOAD_INVALID';
  END IF;


  -- ----------------------------------------------------------
  -- Lock and inspect the trip before modification.
  --
  -- A settled trip is financially closed and cannot be changed
  -- through the normal Modify Trip workflow.
  -- ----------------------------------------------------------

  SELECT settlement_status
  INTO v_settlement_status
  FROM public.trips
  WHERE trip_id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRIP_NOT_FOUND';
  END IF;

  IF v_settlement_status = 'SETTLED' THEN
    RAISE EXCEPTION
      'SETTLED_TRIP_CANNOT_BE_MODIFIED';
  END IF;


  -- ----------------------------------------------------------
  -- Status allow-list
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
  -- Client cannot choose fuel_expense.
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
