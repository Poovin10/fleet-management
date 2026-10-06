CREATE OR REPLACE FUNCTION public.get_admin_report_atomic(
  p_report_type text,
  p_from_date date DEFAULT NULL::date,
  p_to_date date DEFAULT NULL::date,
  p_search text DEFAULT ''::text,
  p_status text DEFAULT 'All'::text,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(rows jsonb, total_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_report_type text := upper(trim(coalesce(p_report_type, '')));
  v_search text := lower(trim(coalesce(p_search, '')));
  v_status text := upper(trim(coalesce(p_status, 'ALL')));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_limit integer := greatest(coalesce(p_limit, 50), 0);
  v_count bigint := 0;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF auth.role() <> 'service_role'
     AND public.get_current_user_role() NOT IN ('ADMIN', 'SUPERADMIN') THEN
    RAISE EXCEPTION 'ADMIN_REPORT authorization requires ADMIN or SUPERADMIN';
  END IF;

  IF p_from_date IS NOT NULL
     AND p_to_date IS NOT NULL
     AND p_from_date > p_to_date THEN
    RAISE EXCEPTION 'REPORT_DATE_RANGE_INVALID';
  END IF;

  IF v_report_type NOT IN (
    'TRIPS',
    'POD',
    'DIESEL/FUEL',
    'DRIVER BATA',
    'DRIVER SETTLEMENT',
    'WORKSHOP',
    'FLEET/VEHICLE',
    'FINANCIAL/P&L'
  ) THEN
    RAISE EXCEPTION 'REPORT_TYPE_INVALID';
  END IF;

  IF v_report_type = 'TRIPS' THEN
    SELECT count(*)
    INTO v_count
    FROM public.trips t
    LEFT JOIN public.vehicles v ON v.vehicle_id = t.vehicle_id
    LEFT JOIN public.drivers d ON d.driver_id = t.primary_driver_id
    WHERE (p_from_date IS NULL OR t.trip_start_date >= p_from_date)
      AND (p_to_date IS NULL OR t.trip_start_date <= p_to_date)
      AND (
        v_search = ''
        OR lower(coalesce(t.trip_number, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(v.vehicle_number, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(d.full_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(d.driver_code, '')) LIKE '%' || v_search || '%'
      )
      AND (
        v_status = 'ALL'
        OR upper(coalesce(t.trip_status, '')) = v_status
      );

    SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        t.trip_number,
        t.trip_start_date,
        t.trip_end_date,
        v.vehicle_number,
        d.full_name AS driver,
        t.origin,
        t.destination,
        t.loaded_weight_mt,
        t.tonnage_loaded,
        t.total_km_run,
        t.start_km,
        t.end_km,
        t.freight_revenue,
        t.driver_bata,
        t.halt_bata,
        t.cash_advance_issued,
        t.fuel_litres,
        t.trip_status,
        t.settlement_status
      FROM public.trips t
      LEFT JOIN public.vehicles v ON v.vehicle_id = t.vehicle_id
      LEFT JOIN public.drivers d ON d.driver_id = t.primary_driver_id
      WHERE (p_from_date IS NULL OR t.trip_start_date >= p_from_date)
        AND (p_to_date IS NULL OR t.trip_start_date <= p_to_date)
        AND (
          v_search = ''
          OR lower(coalesce(t.trip_number, '')) LIKE '%' || v_search || '%'
          OR lower(coalesce(v.vehicle_number, '')) LIKE '%' || v_search || '%'
          OR lower(coalesce(d.full_name, '')) LIKE '%' || v_search || '%'
          OR lower(coalesce(d.driver_code, '')) LIKE '%' || v_search || '%'
        )
        AND (
          v_status = 'ALL'
          OR upper(coalesce(t.trip_status, '')) = v_status
        )
      ORDER BY t.trip_start_date DESC, t.trip_id DESC
      OFFSET v_offset
      LIMIT nullif(v_limit, 0)
    ) x;

  ELSIF v_report_type = 'POD' THEN
    SELECT count(*)
    INTO v_count
    FROM public.trips t
    LEFT JOIN public.vehicles v ON v.vehicle_id = t.vehicle_id
    LEFT JOIN public.drivers d ON d.driver_id = t.primary_driver_id
    WHERE (p_from_date IS NULL OR t.trip_start_date >= p_from_date)
      AND (p_to_date IS NULL OR t.trip_start_date <= p_to_date)
      AND (
        v_search = ''
        OR lower(coalesce(t.trip_number, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(v.vehicle_number, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(d.full_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(d.driver_code, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(t.pod_number, '')) LIKE '%' || v_search || '%'
      )
      AND (
        v_status = 'ALL'
        OR upper(coalesce(t.pod_status, '')) = v_status
      );

    SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        t.trip_number,
        t.trip_start_date,
        v.vehicle_number,
        d.full_name AS driver,
        t.origin,
        t.destination,
        t.loaded_weight_mt,
        t.unloaded_weight_mt,
        t.shortage_mt,
        t.pod_number,
        t.pod_received_date,
        t.pod_status,
        t.halt_bata,
        t.enroute_repairs_maintenance
      FROM public.trips t
      LEFT JOIN public.vehicles v ON v.vehicle_id = t.vehicle_id
      LEFT JOIN public.drivers d ON d.driver_id = t.primary_driver_id
      WHERE (p_from_date IS NULL OR t.trip_start_date >= p_from_date)
        AND (p_to_date IS NULL OR t.trip_start_date <= p_to_date)
        AND (
          v_search = ''
          OR lower(coalesce(t.trip_number, '')) LIKE '%' || v_search || '%'
          OR lower(coalesce(v.vehicle_number, '')) LIKE '%' || v_search || '%'
          OR lower(coalesce(d.full_name, '')) LIKE '%' || v_search || '%'
          OR lower(coalesce(d.driver_code, '')) LIKE '%' || v_search || '%'
          OR lower(coalesce(t.pod_number, '')) LIKE '%' || v_search || '%'
        )
        AND (
          v_status = 'ALL'
          OR upper(coalesce(t.pod_status, '')) = v_status
        )
      ORDER BY t.trip_start_date DESC, t.trip_id DESC
      OFFSET v_offset
      LIMIT nullif(v_limit, 0)
    ) x;

  ELSIF v_report_type = 'DIESEL/FUEL' THEN
    SELECT count(*)
    INTO v_count
    FROM public.diesel_fuel_logs f
    LEFT JOIN public.vehicles v ON v.vehicle_id = f.vehicle_id
    WHERE (p_from_date IS NULL OR f.fuel_date >= p_from_date)
      AND (p_to_date IS NULL OR f.fuel_date <= p_to_date)
      AND (
        v_search = ''
        OR lower(coalesce(v.vehicle_number, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(f.diesel_category, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(f.fuel_station_vendor, '')) LIKE '%' || v_search || '%'
      );

    SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        f.fuel_date,
        v.vehicle_number,
        f.diesel_category,
        f.litres_filled,
        f.diesel_rate_per_litre,
        f.total_fuel_cost,
        f.filling_odometer_km,
        f.is_tank_full
      FROM public.diesel_fuel_logs f
      LEFT JOIN public.vehicles v ON v.vehicle_id = f.vehicle_id
      WHERE (p_from_date IS NULL OR f.fuel_date >= p_from_date)
        AND (p_to_date IS NULL OR f.fuel_date <= p_to_date)
        AND (
          v_search = ''
          OR lower(coalesce(v.vehicle_number, '')) LIKE '%' || v_search || '%'
          OR lower(coalesce(f.diesel_category, '')) LIKE '%' || v_search || '%'
          OR lower(coalesce(f.fuel_station_vendor, '')) LIKE '%' || v_search || '%'
        )
      ORDER BY f.fuel_date DESC, f.fuel_log_id DESC
      OFFSET v_offset
      LIMIT nullif(v_limit, 0)
    ) x;

  ELSIF v_report_type = 'DRIVER BATA' THEN
    SELECT count(*)
    INTO v_count
    FROM public.trips t
    LEFT JOIN public.vehicles v ON v.vehicle_id = t.vehicle_id
    LEFT JOIN public.drivers d ON d.driver_id = t.primary_driver_id
    WHERE (p_from_date IS NULL OR t.trip_start_date >= p_from_date)
      AND (p_to_date IS NULL OR t.trip_start_date <= p_to_date)
      AND (
        v_search = ''
        OR lower(coalesce(t.trip_number, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(v.vehicle_number, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(d.full_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(d.driver_code, '')) LIKE '%' || v_search || '%'
      );

    SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        t.trip_start_date,
        t.trip_number,
        d.full_name AS driver,
        d.driver_code,
        v.vehicle_number,
        t.origin,
        t.destination,
        t.driver_bata,
        t.halt_bata,
        t.cash_advance_issued,
        t.settlement_status
      FROM public.trips t
      LEFT JOIN public.vehicles v ON v.vehicle_id = t.vehicle_id
      LEFT JOIN public.drivers d ON d.driver_id = t.primary_driver_id
      WHERE (p_from_date IS NULL OR t.trip_start_date >= p_from_date)
        AND (p_to_date IS NULL OR t.trip_start_date <= p_to_date)
        AND (
          v_search = ''
          OR lower(coalesce(t.trip_number, '')) LIKE '%' || v_search || '%'
          OR lower(coalesce(v.vehicle_number, '')) LIKE '%' || v_search || '%'
          OR lower(coalesce(d.full_name, '')) LIKE '%' || v_search || '%'
          OR lower(coalesce(d.driver_code, '')) LIKE '%' || v_search || '%'
        )
      ORDER BY t.trip_start_date DESC, t.trip_id DESC
      OFFSET v_offset
      LIMIT nullif(v_limit, 0)
    ) x;

  ELSIF v_report_type = 'DRIVER SETTLEMENT' THEN
    SELECT count(*)
    INTO v_count
    FROM (
      SELECT t.trip_id::bigint AS sort_id
      FROM public.trips t
      WHERE (p_from_date IS NULL OR t.trip_start_date >= p_from_date)
        AND (p_to_date IS NULL OR t.trip_start_date <= p_to_date)

      UNION ALL

      SELECT a.advance_id::bigint
      FROM public.driver_direct_advances a
      WHERE (p_from_date IS NULL OR a.advance_date >= p_from_date)
        AND (p_to_date IS NULL OR a.advance_date <= p_to_date)
    ) q;

    SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        q.record_type,
        q.date,
        q.reference,
        q.driver,
        q.driver_code,
        q.vehicle,
        q.description,
        q.freight,
        q.driver_bata,
        q.halt_bata,
        q.cash_advance,
        q.direct_advance,
        q.settlement_status
      FROM (
        SELECT
          'TRIP'::text AS record_type,
          t.trip_start_date AS date,
          t.trip_number AS reference,
          d.full_name AS driver,
          d.driver_code,
          v.vehicle_number AS vehicle,
          coalesce(t.origin, '') || ' → ' || coalesce(t.destination, '') AS description,
          coalesce(t.freight_revenue, 0) AS freight,
          coalesce(t.driver_bata, 0) AS driver_bata,
          coalesce(t.halt_bata, 0) AS halt_bata,
          coalesce(t.cash_advance_issued, 0) AS cash_advance,
          0::numeric AS direct_advance,
          coalesce(t.settlement_status, '') AS settlement_status,
          t.trip_id::bigint AS sort_id
        FROM public.trips t
        LEFT JOIN public.vehicles v ON v.vehicle_id = t.vehicle_id
        LEFT JOIN public.drivers d ON d.driver_id = t.primary_driver_id
        WHERE (p_from_date IS NULL OR t.trip_start_date >= p_from_date)
          AND (p_to_date IS NULL OR t.trip_start_date <= p_to_date)
          AND (
            v_search = ''
            OR lower(coalesce(t.trip_number, '')) LIKE '%' || v_search || '%'
            OR lower(coalesce(v.vehicle_number, '')) LIKE '%' || v_search || '%'
            OR lower(coalesce(d.full_name, '')) LIKE '%' || v_search || '%'
            OR lower(coalesce(d.driver_code, '')) LIKE '%' || v_search || '%'
          )

        UNION ALL

        SELECT
          'DIRECT ADVANCE'::text,
          a.advance_date,
          coalesce(a.advance_type, 'Advance'),
          d.full_name,
          d.driver_code,
          ''::text,
          coalesce(a.reference_remarks, ''),
          0::numeric,
          0::numeric,
          0::numeric,
          0::numeric,
          coalesce(a.amount_inr, 0),
          CASE
            WHEN a.is_settled THEN 'SETTLED'
            ELSE 'PENDING'
          END,
          a.advance_id::bigint
        FROM public.driver_direct_advances a
        LEFT JOIN public.drivers d ON d.driver_id = a.driver_id
        WHERE (p_from_date IS NULL OR a.advance_date >= p_from_date)
          AND (p_to_date IS NULL OR a.advance_date <= p_to_date)
          AND (
            v_search = ''
            OR lower(coalesce(d.full_name, '')) LIKE '%' || v_search || '%'
            OR lower(coalesce(d.driver_code, '')) LIKE '%' || v_search || '%'
            OR lower(coalesce(a.reference_remarks, '')) LIKE '%' || v_search || '%'
          )
          AND (
            v_status = 'ALL'
            OR (v_status = 'SETTLED' AND a.is_settled = true)
            OR (v_status = 'PENDING' AND a.is_settled = false)
          )
      ) q
      ORDER BY q.date DESC, q.sort_id DESC
      OFFSET v_offset
      LIMIT nullif(v_limit, 0)
    ) x;

  ELSIF v_report_type = 'WORKSHOP' THEN
    SELECT count(*)
    INTO v_count
    FROM public.workshop_spares_bills w
    LEFT JOIN public.vehicles v ON v.vehicle_id = w.vehicle_id
    WHERE (p_from_date IS NULL OR w.bill_date >= p_from_date)
      AND (p_to_date IS NULL OR w.bill_date <= p_to_date)
      AND (
        v_search = ''
        OR lower(coalesce(v.vehicle_number, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(w.vendor_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(w.spare_parts_details, '')) LIKE '%' || v_search || '%'
      );

    SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        w.bill_date,
        v.vehicle_number,
        w.vendor_name,
        w.spare_parts_details,
        w.total_bill_amount
      FROM public.workshop_spares_bills w
      LEFT JOIN public.vehicles v ON v.vehicle_id = w.vehicle_id
      WHERE (p_from_date IS NULL OR w.bill_date >= p_from_date)
        AND (p_to_date IS NULL OR w.bill_date <= p_to_date)
        AND (
          v_search = ''
          OR lower(coalesce(v.vehicle_number, '')) LIKE '%' || v_search || '%'
          OR lower(coalesce(w.vendor_name, '')) LIKE '%' || v_search || '%'
          OR lower(coalesce(w.spare_parts_details, '')) LIKE '%' || v_search || '%'
        )
      ORDER BY w.bill_date DESC, w.bill_id DESC
      OFFSET v_offset
      LIMIT nullif(v_limit, 0)
    ) x;

  ELSIF v_report_type = 'FLEET/VEHICLE' THEN
    SELECT count(*)
    INTO v_count
    FROM public.vehicles v
    WHERE (
      v_search = ''
      OR lower(coalesce(v.vehicle_number, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(v.truck_type, '')) LIKE '%' || v_search || '%'
      OR lower(coalesce(v.current_status, '')) LIKE '%' || v_search || '%'
    );

    SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT v.*
      FROM public.vehicles v
      WHERE (
        v_search = ''
        OR lower(coalesce(v.vehicle_number, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(v.truck_type, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(v.current_status, '')) LIKE '%' || v_search || '%'
      )
      ORDER BY v.vehicle_id DESC
      OFFSET v_offset
      LIMIT nullif(v_limit, 0)
    ) x;

  ELSIF v_report_type = 'FINANCIAL/P&L' THEN
    SELECT count(*)
    INTO v_count
    FROM public.trips t
    LEFT JOIN public.vehicles v ON v.vehicle_id = t.vehicle_id
    WHERE (p_from_date IS NULL OR t.trip_start_date >= p_from_date)
      AND (p_to_date IS NULL OR t.trip_start_date <= p_to_date)
      AND (
        v_search = ''
        OR lower(coalesce(t.trip_number, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(v.vehicle_number, '')) LIKE '%' || v_search || '%'
      );

    SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        t.trip_number,
        t.trip_start_date,
        v.vehicle_number,
        t.freight_revenue,
        t.driver_bata,
        t.halt_bata,
        t.enroute_repairs_maintenance,
        t.fuel_litres,
        t.total_km_run,
        t.trip_status
      FROM public.trips t
      LEFT JOIN public.vehicles v ON v.vehicle_id = t.vehicle_id
      WHERE (p_from_date IS NULL OR t.trip_start_date >= p_from_date)
        AND (p_to_date IS NULL OR t.trip_start_date <= p_to_date)
        AND (
          v_search = ''
          OR lower(coalesce(t.trip_number, '')) LIKE '%' || v_search || '%'
          OR lower(coalesce(v.vehicle_number, '')) LIKE '%' || v_search || '%'
        )
      ORDER BY t.trip_start_date DESC, t.trip_id DESC
      OFFSET v_offset
      LIMIT nullif(v_limit, 0)
    ) x;
  END IF;

  rows := v_rows;
  total_count := v_count;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_report_atomic(
  text, date, date, text, text, integer, integer
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.get_admin_report_atomic(
  text, date, date, text, text, integer, integer
) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_admin_report_atomic(
  text, date, date, text, text, integer, integer
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_admin_report_atomic(
  text, date, date, text, text, integer, integer
) TO service_role;
