-- KSS ERP: Restore authoritative dispatch trip RPC
--
-- Source:
-- Recovered from the currently deployed Supabase database.
--
-- IMPORTANT:
-- This migration restores the live implementation to source control.
-- Authorization hardening must be reviewed separately.

begin;

create or replace function public.create_dispatch_trip_atomic(
  p_trip_number character varying,
  p_vehicle_id integer,
  p_primary_driver_id integer,
  p_trip_start_date date,
  p_origin character varying,
  p_destination character varying,
  p_tonnage_loaded numeric,
  p_freight_revenue numeric,
  p_fuel_litres numeric,
  p_fuel_expense numeric,
  p_driver_bata numeric,
  p_cash_advance_issued numeric,
  p_start_km numeric,
  p_is_tank_full boolean,
  p_entered_by text default null,
  p_reading_at timestamp with time zone default current_timestamp
)
returns public.trips
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_previous_km numeric;
  v_previous_reading_at timestamptz;
  v_reading_at timestamptz;
  v_trip public.trips;
begin

  -- ========================================================
  -- BASIC VALIDATION
  -- ========================================================

  if p_trip_number is null or btrim(p_trip_number) = '' then
    raise exception 'TRIP_NUMBER_REQUIRED';
  end if;

  if p_vehicle_id is null then
    raise exception 'ODOMETER_VEHICLE_REQUIRED';
  end if;

  if p_primary_driver_id is null then
    raise exception 'PRIMARY_DRIVER_REQUIRED';
  end if;

  if p_trip_start_date is null then
    raise exception 'TRIP_START_DATE_REQUIRED';
  end if;

  if p_start_km is null or p_start_km <= 0 then
    raise exception 'ODOMETER_MUST_BE_GREATER_THAN_ZERO';
  end if;

  if p_tonnage_loaded is null or p_tonnage_loaded < 0 then
    raise exception 'INVALID_TONNAGE';
  end if;

  if p_freight_revenue is null or p_freight_revenue < 0 then
    raise exception 'INVALID_FREIGHT_REVENUE';
  end if;

  if p_fuel_litres is null or p_fuel_litres < 0 then
    raise exception 'INVALID_FUEL_LITRES';
  end if;

  if p_fuel_expense is null or p_fuel_expense < 0 then
    raise exception 'INVALID_FUEL_EXPENSE';
  end if;

  if p_driver_bata is null or p_driver_bata < 0 then
    raise exception 'INVALID_DRIVER_BATA';
  end if;

  if p_cash_advance_issued is null or p_cash_advance_issued < 0 then
    raise exception 'INVALID_CASH_ADVANCE';
  end if;

  v_reading_at := coalesce(p_reading_at, current_timestamp);


  -- ========================================================
  -- VERIFY + LOCK VEHICLE
  -- ========================================================

  perform 1
  from public.vehicles
  where vehicle_id = p_vehicle_id
  for update;

  if not found then
    raise exception 'VEHICLE_NOT_FOUND: %', p_vehicle_id;
  end if;


  -- ========================================================
  -- VERIFY DRIVER
  -- ========================================================

  perform 1
  from public.drivers
  where driver_id = p_primary_driver_id
    and is_active = true;

  if not found then
    raise exception 'ACTIVE_DRIVER_NOT_FOUND: %', p_primary_driver_id;
  end if;


  -- ========================================================
  -- CHECK DUPLICATE TRIP NUMBER
  -- ========================================================

  if exists (
    select 1
    from public.trips
    where trip_number = btrim(p_trip_number)
  ) then
    raise exception
      'TRIP_NUMBER_ALREADY_EXISTS: %',
      btrim(p_trip_number);
  end if;


  -- ========================================================
  -- GET AUTHORITATIVE PREVIOUS ODOMETER
  -- ========================================================

  select
    vol.odometer_km,
    vol.reading_at
  into
    v_previous_km,
    v_previous_reading_at
  from public.vehicle_odometer_logs vol
  where vol.vehicle_id = p_vehicle_id
  order by
    vol.reading_at desc,
    vol.odometer_log_id desc
  limit 1;


  -- ========================================================
  -- CHRONOLOGICAL VALIDATION
  -- ========================================================

  if v_previous_reading_at is not null
     and v_reading_at < v_previous_reading_at
  then
    raise exception
      'ODOMETER_TIMESTAMP_REVERSED: vehicle %, previous timestamp %, new timestamp %',
      p_vehicle_id,
      v_previous_reading_at,
      v_reading_at;
  end if;


  -- ========================================================
  -- STRICT KM VALIDATION
  -- ========================================================

  if v_previous_km is not null
     and p_start_km <= v_previous_km
  then
    raise exception
      'ODOMETER_NOT_INCREASING: vehicle %, previous KM %, new KM %',
      p_vehicle_id,
      v_previous_km,
      p_start_km;
  end if;


  -- ========================================================
  -- AUTHORITATIVE TRIP START ODOMETER
  -- ========================================================

  insert into public.vehicle_odometer_logs (
    vehicle_id,
    odometer_km,
    reading_type,
    reference_id,
    reading_at,
    entered_at,
    entered_by,
    remarks
  )
  values (
    p_vehicle_id,
    p_start_km,
    'TRIP_START',
    null,
    v_reading_at,
    current_timestamp,
    p_entered_by,
    'Trip start: ' || btrim(p_trip_number)
  );


  -- ========================================================
  -- CREATE TRIP
  -- ========================================================

  insert into public.trips (
    trip_number,
    vehicle_id,
    primary_driver_id,
    trip_start_date,
    trip_end_date,
    origin,
    destination,
    tonnage_loaded,
    loaded_weight_mt,
    freight_revenue,
    fuel_litres,
    fuel_expense,
    driver_bata,
    cash_advance_issued,
    start_km,
    is_tank_full,
    trip_status
  )
  values (
    btrim(p_trip_number),
    p_vehicle_id,
    p_primary_driver_id,
    p_trip_start_date,
    p_trip_start_date,
    btrim(p_origin),
    btrim(p_destination),
    p_tonnage_loaded,
    p_tonnage_loaded,
    p_freight_revenue,
    p_fuel_litres,
    p_fuel_expense,
    p_driver_bata,
    p_cash_advance_issued,
    p_start_km,
    coalesce(p_is_tank_full, false),
    'WAITING_FOR_LOAD'
  )
  returning *
  into v_trip;


  -- ========================================================
  -- LINK ODOMETER READING TO CREATED TRIP
  -- ========================================================

  update public.vehicle_odometer_logs
  set reference_id = v_trip.trip_id
  where vehicle_id = p_vehicle_id
    and reading_type = 'TRIP_START'
    and reference_id is null
    and odometer_km = p_start_km
    and reading_at = v_reading_at;

  return v_trip;

end;
$function$;

commit;
