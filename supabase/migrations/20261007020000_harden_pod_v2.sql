-- ============================================================
-- KSS ERP — POD V2
-- Delivery verification is independent from:
--   trip completion, fuel, odometer and driver settlement.
-- ============================================================

-- 1. POD number must be unique once supplied.
CREATE UNIQUE INDEX IF NOT EXISTS trips_pod_number_unique_idx
ON public.trips (UPPER(BTRIM(pod_number)))
WHERE NULLIF(BTRIM(pod_number), '') IS NOT NULL;


-- 2. pending_scans is controlled by the authoritative RPC.
REVOKE INSERT, UPDATE, DELETE
ON TABLE public.pending_scans
FROM anon, authenticated;


-- 3. Replace the legacy POD transaction with a delivery-only transaction.
CREATE OR REPLACE FUNCTION public.close_pod_atomic(
  p_trip_id bigint,
  p_pod_number text,
  p_closing_date date,
  p_unloaded_weight_mt numeric,
  p_shortage_mt numeric,
  p_halt_bata numeric,
  p_claims numeric,
  p_add_diesel numeric,
  p_diesel_rate_per_litre numeric,
  p_filling_odometer_km numeric,
  p_is_tank_full boolean,
  p_scan_id uuid DEFAULT NULL
)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_scan public.pending_scans%ROWTYPE;
  v_scan_lr text;
  v_trip_lr text;
  v_shortage numeric := 0;
  v_role text;
  v_pod_number text;
BEGIN
  -- ----------------------------------------------------------
  -- Authorization
  -- ----------------------------------------------------------
  IF auth.role() <> 'service_role' THEN
    v_role := public.get_current_user_role();

    IF v_role NOT IN ('ADMIN', 'SUPERADMIN') THEN
      RAISE EXCEPTION
        'POD authorization requires ADMIN or SUPERADMIN';
    END IF;
  END IF;


  -- ----------------------------------------------------------
  -- Basic validation
  -- ----------------------------------------------------------
  IF p_trip_id IS NULL OR p_trip_id <= 0 THEN
    RAISE EXCEPTION 'TRIP_ID_REQUIRED';
  END IF;

  v_pod_number := UPPER(BTRIM(COALESCE(p_pod_number, '')));

  IF v_pod_number = '' THEN
    RAISE EXCEPTION 'POD_NUMBER_REQUIRED';
  END IF;

  IF p_closing_date IS NULL THEN
    RAISE EXCEPTION 'POD_CLOSING_DATE_REQUIRED';
  END IF;

  IF p_closing_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'POD_CLOSING_DATE_CANNOT_BE_FUTURE';
  END IF;

  IF p_unloaded_weight_mt IS NULL THEN
    RAISE EXCEPTION 'UNLOADED_WEIGHT_REQUIRED';
  END IF;

  IF p_unloaded_weight_mt < 0 THEN
    RAISE EXCEPTION 'UNLOADED_WEIGHT_INVALID';
  END IF;


  -- ----------------------------------------------------------
  -- Lock trip and verify lifecycle
  -- ----------------------------------------------------------
  SELECT *
  INTO v_trip
  FROM public.trips
  WHERE trip_id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRIP_NOT_FOUND';
  END IF;

  IF v_trip.trip_status <> 'COMPLETED' THEN
    RAISE EXCEPTION
      'POD_REQUIRES_COMPLETED_TRIP_CURRENT_STATUS=%',
      COALESCE(v_trip.trip_status, 'NULL');
  END IF;

  IF v_trip.pod_status <> 'PENDING_SUBMISSION' THEN
    RAISE EXCEPTION 'POD_ALREADY_PROCESSED';
  END IF;


  -- ----------------------------------------------------------
  -- Quantity / shortage
  -- Server is authoritative.
  -- Client-supplied shortage is ignored.
  -- ----------------------------------------------------------
  IF p_unloaded_weight_mt > v_trip.loaded_weight_mt THEN
    RAISE EXCEPTION 'UNLOADED_WEIGHT_EXCEEDS_LOADED_WEIGHT';
  END IF;

  v_shortage :=
    GREATEST(
      0,
      v_trip.loaded_weight_mt - p_unloaded_weight_mt
    );


  -- ----------------------------------------------------------
  -- POD number uniqueness
  -- ----------------------------------------------------------
  IF EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE UPPER(BTRIM(t.pod_number)) = v_pod_number
      AND t.trip_id <> v_trip.trip_id
  ) THEN
    RAISE EXCEPTION 'POD_NUMBER_ALREADY_EXISTS=%', v_pod_number;
  END IF;


  -- ----------------------------------------------------------
  -- Optional OCR scan binding
  -- ----------------------------------------------------------
  IF p_scan_id IS NOT NULL THEN

    SELECT *
    INTO v_scan
    FROM public.pending_scans
    WHERE scan_id = p_scan_id
      AND document_type = 'POD_CLOSURE'
      AND status = 'PENDING'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'POD_SCAN_NOT_FOUND_OR_ALREADY_PROCESSED';
    END IF;

    v_scan_lr := NULLIF(
      REGEXP_REPLACE(
        UPPER(COALESCE(v_scan.raw_json_result ->> 'lrNo', '')),
        '[^A-Z0-9]',
        '',
        'g'
      ),
      ''
    );

    v_trip_lr := NULLIF(
      REGEXP_REPLACE(
        UPPER(COALESCE(v_trip.trip_number, '')),
        '[^A-Z0-9]',
        '',
        'g'
      ),
      ''
    );

    IF v_scan_lr IS NOT NULL
       AND v_scan_lr <> 'UNKNOWN'
       AND v_trip_lr IS NOT NULL
       AND v_scan_lr <> v_trip_lr
       AND POSITION(v_scan_lr IN v_trip_lr) = 0
       AND POSITION(v_trip_lr IN v_scan_lr) = 0
    THEN
      RAISE EXCEPTION
        'POD_SCAN_LR_MISMATCH_SCAN=%_TRIP=%',
        v_scan_lr,
        v_trip_lr;
    END IF;

  END IF;


  -- ----------------------------------------------------------
  -- IMPORTANT:
  -- The following legacy parameters are intentionally ignored:
  --
  -- p_shortage_mt
  -- p_halt_bata
  -- p_claims
  -- p_add_diesel
  -- p_diesel_rate_per_litre
  -- p_filling_odometer_km
  -- p_is_tank_full
  --
  -- Fuel, odometer and driver settlement have their own
  -- authoritative workflows.
  -- ----------------------------------------------------------


  -- ----------------------------------------------------------
  -- POD-only update
  -- ----------------------------------------------------------
  UPDATE public.trips
  SET
    pod_number = v_pod_number,
    pod_received_date = p_closing_date,
    unloaded_weight_mt = p_unloaded_weight_mt,
    shortage_mt = v_shortage,
    pod_status = 'VERIFIED_ACCEPTED'
  WHERE trip_id = p_trip_id
  RETURNING *
  INTO v_trip;


  -- ----------------------------------------------------------
  -- Consume OCR scan atomically
  -- ----------------------------------------------------------
  IF p_scan_id IS NOT NULL THEN
    UPDATE public.pending_scans
    SET status = 'PROCESSED'
    WHERE scan_id = p_scan_id
      AND document_type = 'POD_CLOSURE'
      AND status = 'PENDING';
  END IF;

  RETURN v_trip;
END;
$$;


-- 4. Keep the RPC controlled.
REVOKE EXECUTE
ON FUNCTION public.close_pod_atomic(
  bigint,
  text,
  date,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  boolean,
  uuid
)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.close_pod_atomic(
  bigint,
  text,
  date,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  boolean,
  uuid
)
TO authenticated, service_role;


COMMENT ON FUNCTION public.close_pod_atomic(
  bigint,
  text,
  date,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  boolean,
  uuid
)
IS
'Authoritative POD verification. Requires COMPLETED trip. Calculates shortage server-side and does not modify fuel, odometer, halt bata, claims or trip lifecycle.';
