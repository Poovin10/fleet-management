BEGIN;

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
  v_trip public.trips%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_driver public.drivers%ROWTYPE;
  v_payload jsonb;
  v_blocked_fields text[] := ARRAY[]::text[];
  v_status text;
  v_pod_status text;
  v_settlement_status text;
  v_tonnage numeric;
  v_start_date date;
  v_origin text;
  v_destination text;
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
    RAISE EXCEPTION 'MODIFY_TRIP_INVALID_PAYLOAD';
  END IF;

  /*
   * Normal Modify Trip is an operational correction workflow.
   * Financial, fuel, POD, settlement and odometer changes belong
   * to their dedicated workflows.
   */
  SELECT
    t.*
  INTO v_trip
  FROM public.trips t
  WHERE t.trip_id = p_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRIP_NOT_FOUND';
  END IF;

  v_status := upper(COALESCE(btrim(v_trip.trip_status), ''));
  v_pod_status := upper(COALESCE(btrim(v_trip.pod_status), ''));
  v_settlement_status := upper(
    COALESCE(btrim(v_trip.settlement_status), 'UNSETTLED')
  );

  IF v_settlement_status = 'SETTLED' THEN
    RAISE EXCEPTION 'SETTLED_TRIP_CANNOT_BE_MODIFIED';
  END IF;

  IF v_status = 'COMPLETED'
     OR v_pod_status IN (
       'VERIFIED_ACCEPTED',
       'CLOSED',
       'COMPLETED'
     )
  THEN
    RAISE EXCEPTION
      'COMPLETED_OR_POD_CLOSED_TRIP_REQUIRES_CONTROLLED_CORRECTION';
  END IF;

  /*
   * Fields that must never enter the normal operational correction path.
   */
  IF p_payload ? 'freight_revenue' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'freight_revenue');
  END IF;

  IF p_payload ? 'freight_rate_used' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'freight_rate_used');
  END IF;

  IF p_payload ? 'freight_master_id' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'freight_master_id');
  END IF;

  IF p_payload ? 'driver_bata' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'driver_bata');
  END IF;

  IF p_payload ? 'bata_amount_used' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'bata_amount_used');
  END IF;

  IF p_payload ? 'bata_rule_id' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'bata_rule_id');
  END IF;

  IF p_payload ? 'cash_advance_issued' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'cash_advance_issued');
  END IF;

  IF p_payload ? 'halt_bata' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'halt_bata');
  END IF;

  IF p_payload ? 'fuel_litres' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'fuel_litres');
  END IF;

  IF p_payload ? 'fuel_expense' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'fuel_expense');
  END IF;

  IF p_payload ? 'diesel_rate_per_litre' THEN
    v_blocked_fields := array_append(
      v_blocked_fields,
      'diesel_rate_per_litre'
    );
  END IF;

  IF p_payload ? 'fuel_date' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'fuel_date');
  END IF;

  IF p_payload ? 'diesel_category' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'diesel_category');
  END IF;

  IF p_payload ? 'fuel_station_vendor' THEN
    v_blocked_fields := array_append(
      v_blocked_fields,
      'fuel_station_vendor'
    );
  END IF;

  IF p_payload ? 'fuel_remarks' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'fuel_remarks');
  END IF;

  IF p_payload ? 'is_tank_full' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'is_tank_full');
  END IF;

  IF p_payload ? 'start_km' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'start_km');
  END IF;

  IF p_payload ? 'end_km' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'end_km');
  END IF;

  IF p_payload ? 'odometer_km' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'odometer_km');
  END IF;

  IF p_payload ? 'unloaded_weight_mt' THEN
    v_blocked_fields := array_append(
      v_blocked_fields,
      'unloaded_weight_mt'
    );
  END IF;

  IF p_payload ? 'pod_number' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'pod_number');
  END IF;

  IF p_payload ? 'pod_received_date' THEN
    v_blocked_fields := array_append(
      v_blocked_fields,
      'pod_received_date'
    );
  END IF;

  IF p_payload ? 'pod_status' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'pod_status');
  END IF;

  IF p_payload ? 'shortage_mt' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'shortage_mt');
  END IF;

  IF p_payload ? 'trip_status' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'trip_status');
  END IF;

  IF p_payload ? 'vehicle_id' THEN
    v_blocked_fields := array_append(v_blocked_fields, 'vehicle_id');
  END IF;

  IF array_length(v_blocked_fields, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'MODIFY_TRIP_FIELDS_LOCKED: %',
      array_to_string(v_blocked_fields, ', ');
  END IF;

  /*
   * The normal correction surface is deliberately small.
   */
  v_payload := jsonb_build_object();

  IF p_payload ? 'trip_number' THEN
    v_payload := v_payload || jsonb_build_object(
      'trip_number',
      p_payload->>'trip_number'
    );
  END IF;

  IF p_payload ? 'trip_start_date' THEN
    v_payload := v_payload || jsonb_build_object(
      'trip_start_date',
      p_payload->>'trip_start_date'
    );
  END IF;

  IF p_payload ? 'trip_end_date' THEN
    v_payload := v_payload || jsonb_build_object(
      'trip_end_date',
      p_payload->>'trip_end_date'
    );
  END IF;

  IF p_payload ? 'origin' THEN
    v_payload := v_payload || jsonb_build_object(
      'origin',
      p_payload->>'origin'
    );
  END IF;

  IF p_payload ? 'destination' THEN
    v_payload := v_payload || jsonb_build_object(
      'destination',
      p_payload->>'destination'
    );
  END IF;

  IF p_payload ? 'primary_driver_id' THEN
    v_payload := v_payload || jsonb_build_object(
      'primary_driver_id',
      p_payload->>'primary_driver_id'
    );
  END IF;

  IF p_payload ? 'tonnage_loaded' THEN
    v_payload := v_payload || jsonb_build_object(
      'tonnage_loaded',
      p_payload->>'tonnage_loaded'
    );
  END IF;

  /*
   * Require an active driver when the correction changes the driver.
   */
  IF p_payload ? 'primary_driver_id' THEN
    SELECT d.*
    INTO v_driver
    FROM public.drivers d
    WHERE d.driver_id =
      NULLIF(p_payload->>'primary_driver_id', '')::integer
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DRIVER_NOT_FOUND';
    END IF;

    IF COALESCE(v_driver.status, '') <> 'ACTIVE' THEN
      RAISE EXCEPTION 'DRIVER_NOT_ACTIVE';
    END IF;
  END IF;

  /*
   * Vehicle is inherited from the existing trip and cannot be reassigned.
   */
  SELECT v.*
  INTO v_vehicle
  FROM public.vehicles v
  WHERE v.vehicle_id = v_trip.vehicle_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VEHICLE_NOT_FOUND';
  END IF;

  v_tonnage :=
    CASE
      WHEN p_payload ? 'tonnage_loaded'
      THEN NULLIF(p_payload->>'tonnage_loaded', '')::numeric
      ELSE v_trip.tonnage_loaded
    END;

  IF v_tonnage IS NULL OR v_tonnage <= 0 THEN
    RAISE EXCEPTION 'TRIP_TONNAGE_INVALID';
  END IF;

  IF v_vehicle.capacity_tons IS NULL
     OR v_vehicle.capacity_tons <= 0
  THEN
    RAISE EXCEPTION 'VEHICLE_CAPACITY_INVALID';
  END IF;

  IF v_tonnage > v_vehicle.capacity_tons THEN
    RAISE EXCEPTION
      'TRIP_TONNAGE_EXCEEDS_VEHICLE_CAPACITY';
  END IF;

  v_start_date :=
    CASE
      WHEN p_payload ? 'trip_start_date'
      THEN NULLIF(p_payload->>'trip_start_date', '')::date
      ELSE v_trip.trip_start_date
    END;

  IF v_start_date IS NULL THEN
    RAISE EXCEPTION 'TRIP_START_DATE_REQUIRED';
  END IF;

  IF v_start_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'TRIP_START_DATE_CANNOT_BE_FUTURE';
  END IF;

  /*
   * Route corrections must still remain tied to the historical
   * Freight Master snapshot. We do not change the master reference.
   */
  v_origin := upper(
    btrim(
      COALESCE(
        NULLIF(p_payload->>'origin', ''),
        v_trip.origin
      )
    )
  );

  v_destination := upper(
    btrim(
      COALESCE(
        NULLIF(p_payload->>'destination', ''),
        v_trip.destination
      )
    )
  );

  IF v_origin IS NULL OR v_origin = '' THEN
    RAISE EXCEPTION 'TRIP_ORIGIN_REQUIRED';
  END IF;

  IF v_destination IS NULL OR v_destination = '' THEN
    RAISE EXCEPTION 'TRIP_DESTINATION_REQUIRED';
  END IF;

  IF p_payload ? 'origin'
     OR p_payload ? 'destination'
     OR p_payload ? 'tonnage_loaded'
  THEN
    IF v_trip.freight_master_id IS NULL THEN
      RAISE EXCEPTION
        'ROUTE_CORRECTION_REQUIRES_FREIGHT_MASTER';
    END IF;

    PERFORM 1
    FROM public.destinations_freight_master d
    WHERE d.destination_id = v_trip.freight_master_id
      AND upper(btrim(COALESCE(d.origin, ''))) = v_origin
      AND upper(btrim(COALESCE(d.destination_name, ''))) = v_destination
      AND COALESCE(d.is_active, false) = true
      AND (
        d.capacity_tons IS NULL
        OR d.capacity_tons = ''
        OR v_vehicle.capacity_tons::text = ANY (
          regexp_split_to_array(
            regexp_replace(d.capacity_tons, '\s+', '', 'g'),
            '/'
          )
        )
      );

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'ROUTE_CORRECTION_DOES_NOT_MATCH_HISTORICAL_FREIGHT_MASTER';
    END IF;
  END IF;

  /*
   * Never pass the caller's unrestricted payload to the legacy core.
   */
  RETURN public.modify_trip_atomic_core(
    p_trip_id,
    v_payload
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
