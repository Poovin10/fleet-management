-- KSS ERP: Secure Master CRUD
-- Master writes are moved behind SUPERADMIN-only SECURITY DEFINER RPCs.

create or replace function public.is_current_user_superadmin()
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_email text;
  v_username text;
begin
  v_email := auth.email();

  if v_email is null or btrim(v_email) = '' then
    return false;
  end if;

  v_username := split_part(btrim(v_email), '@', 1);

  return exists (
    select 1
    from public.app_users au
    where lower(btrim(au.username)) = lower(v_username)
      and upper(btrim(au.role)) = 'SUPERADMIN'
  );
end;
$$;

revoke all on function public.is_current_user_superadmin() from public;
grant execute on function public.is_current_user_superadmin() to authenticated;

create or replace function public.create_master_vehicle(
  p_vehicle_number text,
  p_truck_type text,
  p_carrying_capacity_tons numeric default 30.00,
  p_gross_vehicle_weight_tons numeric default 0.00,
  p_fc_expiry_date date default null,
  p_insurance_expiry_date date default null,
  p_qtax_expiry_date date default null,
  p_puc_expiry_date date default null,
  p_np_expiry_date date default null,
  p_state_permit_expiry_date date default null,
  p_tank_cert_expiry_date date default null
)
returns public.vehicles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_vehicle public.vehicles%rowtype;
begin
  if not public.is_current_user_superadmin() then
    raise exception 'SUPERADMIN authorization required';
  end if;

  if p_vehicle_number is null or btrim(p_vehicle_number) = '' then
    raise exception 'Vehicle number is required';
  end if;

  if p_truck_type is null or btrim(p_truck_type) = '' then
    raise exception 'Truck type is required';
  end if;

  if p_carrying_capacity_tons is null or p_carrying_capacity_tons <= 0 then
    raise exception 'Carrying capacity must be greater than zero';
  end if;

  insert into public.vehicles (
    vehicle_number,
    truck_type,
    carrying_capacity_tons,
    gross_vehicle_weight_tons,
    is_active,
    current_status,
    fc_expiry_date,
    insurance_expiry_date,
    qtax_expiry_date,
    puc_expiry_date,
    np_expiry_date,
    state_permit_expiry_date,
    tank_cert_expiry_date
  )
  values (
    upper(btrim(p_vehicle_number)),
    btrim(p_truck_type),
    p_carrying_capacity_tons,
    coalesce(p_gross_vehicle_weight_tons, 0),
    true,
    'WAITING_FOR_LOAD',
    p_fc_expiry_date,
    p_insurance_expiry_date,
    p_qtax_expiry_date,
    p_puc_expiry_date,
    p_np_expiry_date,
    p_state_permit_expiry_date,
    p_tank_cert_expiry_date
  )
  returning * into v_vehicle;

  return v_vehicle;
exception
  when unique_violation then
    raise exception 'Vehicle number already exists';
end;
$$;

revoke all on function public.create_master_vehicle(text,text,numeric,numeric,date,date,date,date,date,date,date) from public;
grant execute on function public.create_master_vehicle(text,text,numeric,numeric,date,date,date,date,date,date,date) to authenticated;

create or replace function public.update_master_vehicle(
  p_vehicle_id integer,
  p_vehicle_number text,
  p_truck_type text,
  p_carrying_capacity_tons numeric,
  p_gross_vehicle_weight_tons numeric,
  p_is_active boolean,
  p_odometer_working boolean,
  p_fc_expiry_date date,
  p_insurance_expiry_date date,
  p_qtax_expiry_date date,
  p_puc_expiry_date date,
  p_np_expiry_date date,
  p_state_permit_expiry_date date,
  p_tank_cert_expiry_date date
)
returns public.vehicles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_vehicle public.vehicles%rowtype;
begin
  if not public.is_current_user_superadmin() then
    raise exception 'SUPERADMIN authorization required';
  end if;

  if p_vehicle_id is null then
    raise exception 'Vehicle ID is required';
  end if;

  if p_vehicle_number is null or btrim(p_vehicle_number) = '' then
    raise exception 'Vehicle number is required';
  end if;

  if p_truck_type is null or btrim(p_truck_type) = '' then
    raise exception 'Truck type is required';
  end if;

  if p_carrying_capacity_tons is null or p_carrying_capacity_tons <= 0 then
    raise exception 'Carrying capacity must be greater than zero';
  end if;

  update public.vehicles
  set vehicle_number = upper(btrim(p_vehicle_number)),
      truck_type = btrim(p_truck_type),
      carrying_capacity_tons = p_carrying_capacity_tons,
      gross_vehicle_weight_tons = coalesce(p_gross_vehicle_weight_tons, 0),
      is_active = coalesce(p_is_active, true),
      odometer_working = coalesce(p_odometer_working, true),
      fc_expiry_date = p_fc_expiry_date,
      insurance_expiry_date = p_insurance_expiry_date,
      qtax_expiry_date = p_qtax_expiry_date,
      puc_expiry_date = p_puc_expiry_date,
      np_expiry_date = p_np_expiry_date,
      state_permit_expiry_date = p_state_permit_expiry_date,
      tank_cert_expiry_date = p_tank_cert_expiry_date
  where vehicle_id = p_vehicle_id
  returning * into v_vehicle;

  if not found then
    raise exception 'Vehicle not found';
  end if;

  return v_vehicle;
exception
  when unique_violation then
    raise exception 'Vehicle number already exists';
end;
$$;

revoke all on function public.update_master_vehicle(integer,text,text,numeric,numeric,boolean,boolean,date,date,date,date,date,date,date) from public;
grant execute on function public.update_master_vehicle(integer,text,text,numeric,numeric,boolean,boolean,date,date,date,date,date,date,date) to authenticated;

drop function if exists public.create_master_driver(text,text,text,date,integer);

create or replace function public.create_master_driver(
  p_full_name text,
  p_phone_number text,
  p_license_number text,
  p_license_expiry_date date default null,
  p_branch_id integer default 1,
  p_pin text default null
)
returns public.drivers
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_driver public.drivers%rowtype;
  v_next_code integer;
begin
  if not public.is_current_user_superadmin() then
    raise exception 'SUPERADMIN authorization required';
  end if;

  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'Driver name is required';
  end if;

  if p_phone_number is null or btrim(p_phone_number) = '' then
    raise exception 'Driver phone number is required';
  end if;

  if p_license_number is null or btrim(p_license_number) = '' then
    raise exception 'License number is required';
  end if;

  if p_pin is not null and (
    btrim(p_pin) !~ '^[0-9]{4}$'
  ) then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  if not exists (
    select 1 from public.branches where branch_id = coalesce(p_branch_id, 1)
  ) then
    raise exception 'Invalid branch';
  end if;

  select coalesce(max(nullif(regexp_replace(driver_code, '[^0-9]', '', 'g'), '')::integer), 0) + 1
  into v_next_code
  from public.drivers
  where driver_code ~ '^DRV-[0-9]+$';

  insert into public.drivers (
    driver_code,
    full_name,
    phone_number,
    license_number,
    license_expiry_date,
    branch_id,
    is_active,
    pin,
    pin_hash
  )
  values (
    'DRV-' || lpad(v_next_code::text, 3, '0'),
    upper(btrim(p_full_name)),
    btrim(p_phone_number),
    upper(btrim(p_license_number)),
    p_license_expiry_date,
    coalesce(p_branch_id, 1),
    true,
    null,
    case
      when p_pin is null then null
      else extensions.crypt(btrim(p_pin), extensions.gen_salt('bf'))
    end
  )
  returning * into v_driver;

  return v_driver;
exception
  when unique_violation then
    raise exception 'Generated driver code already exists; retry the operation';
end;
$$;

revoke all on function public.create_master_driver(text,text,text,date,integer,text) from public;
grant execute on function public.create_master_driver(text,text,text,date,integer,text) to authenticated;

create or replace function public.update_master_driver(
  p_driver_id integer,
  p_full_name text,
  p_phone_number text,
  p_license_number text,
  p_license_expiry_date date,
  p_branch_id integer,
  p_is_active boolean
)
returns public.drivers
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_driver public.drivers%rowtype;
begin
  if not public.is_current_user_superadmin() then
    raise exception 'SUPERADMIN authorization required';
  end if;

  if p_driver_id is null then
    raise exception 'Driver ID is required';
  end if;

  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'Driver name is required';
  end if;

  if p_phone_number is null or btrim(p_phone_number) = '' then
    raise exception 'Driver phone number is required';
  end if;

  if p_license_number is null or btrim(p_license_number) = '' then
    raise exception 'License number is required';
  end if;

  if not exists (
    select 1 from public.branches where branch_id = coalesce(p_branch_id, 1)
  ) then
    raise exception 'Invalid branch';
  end if;

  update public.drivers
  set full_name = upper(btrim(p_full_name)),
      phone_number = btrim(p_phone_number),
      license_number = upper(btrim(p_license_number)),
      license_expiry_date = p_license_expiry_date,
      branch_id = coalesce(p_branch_id, 1),
      is_active = coalesce(p_is_active, true)
  where driver_id = p_driver_id
  returning * into v_driver;

  if not found then
    raise exception 'Driver not found';
  end if;

  return v_driver;
end;
$$;

revoke all on function public.update_master_driver(integer,text,text,text,date,integer,boolean) from public;
grant execute on function public.update_master_driver(integer,text,text,text,date,integer,boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Freight Slab CRUD
-- ---------------------------------------------------------------------------

create or replace function public.create_master_freight(
  p_cargo_type text,
  p_origin text,
  p_destination_name text,
  p_capacity_tons text,
  p_freight_rate_per_ton numeric,
  p_standard_km numeric default 0,
  p_cargo_category text default null,
  p_min_km_tolerance_pct numeric default 10,
  p_max_km_tolerance_pct numeric default 10
)
returns public.destinations_freight_master
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.destinations_freight_master%rowtype;
begin
  if not public.is_current_user_superadmin() then
    raise exception 'SUPERADMIN authorization required';
  end if;

  if p_cargo_type is null or btrim(p_cargo_type) = '' then
    raise exception 'Cargo type is required';
  end if;

  if p_origin is null or btrim(p_origin) = '' then
    raise exception 'Origin is required';
  end if;

  if p_destination_name is null or btrim(p_destination_name) = '' then
    raise exception 'Destination is required';
  end if;

  if p_capacity_tons is null or btrim(p_capacity_tons) = '' then
    raise exception 'Capacity slab is required';
  end if;

  if p_freight_rate_per_ton is null or p_freight_rate_per_ton < 0 then
    raise exception 'Freight rate cannot be negative';
  end if;

  if coalesce(p_standard_km, 0) < 0 then
    raise exception 'Standard KM cannot be negative';
  end if;

  if coalesce(p_min_km_tolerance_pct, 10) < 0
     or coalesce(p_max_km_tolerance_pct, 10) < 0 then
    raise exception 'KM tolerance cannot be negative';
  end if;

  insert into public.destinations_freight_master (
    cargo_type,
    origin,
    destination_name,
    capacity_tons,
    freight_rate_per_ton,
    standard_km,
    is_active,
    cargo_category,
    min_km_tolerance_pct,
    max_km_tolerance_pct
  )
  values (
    upper(btrim(p_cargo_type)),
    upper(btrim(p_origin)),
    upper(btrim(p_destination_name)),
    btrim(p_capacity_tons),
    p_freight_rate_per_ton,
    coalesce(p_standard_km, 0),
    true,
    nullif(upper(btrim(coalesce(p_cargo_category, ''))), ''),
    coalesce(p_min_km_tolerance_pct, 10),
    coalesce(p_max_km_tolerance_pct, 10)
  )
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'A freight slab already exists for this cargo, origin, destination and capacity';
end;
$$;

revoke all on function public.create_master_freight(text,text,text,text,numeric,numeric,text,numeric,numeric) from public;
grant execute on function public.create_master_freight(text,text,text,text,numeric,numeric,text,numeric,numeric) to authenticated;


create or replace function public.update_master_freight(
  p_destination_id integer,
  p_cargo_type text,
  p_origin text,
  p_destination_name text,
  p_capacity_tons text,
  p_freight_rate_per_ton numeric,
  p_standard_km numeric,
  p_is_active boolean,
  p_cargo_category text,
  p_min_km_tolerance_pct numeric,
  p_max_km_tolerance_pct numeric
)
returns public.destinations_freight_master
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.destinations_freight_master%rowtype;
begin
  if not public.is_current_user_superadmin() then
    raise exception 'SUPERADMIN authorization required';
  end if;

  if p_destination_id is null then
    raise exception 'Freight slab ID is required';
  end if;

  if p_cargo_type is null or btrim(p_cargo_type) = '' then
    raise exception 'Cargo type is required';
  end if;

  if p_origin is null or btrim(p_origin) = '' then
    raise exception 'Origin is required';
  end if;

  if p_destination_name is null or btrim(p_destination_name) = '' then
    raise exception 'Destination is required';
  end if;

  if p_capacity_tons is null or btrim(p_capacity_tons) = '' then
    raise exception 'Capacity slab is required';
  end if;

  if p_freight_rate_per_ton is null or p_freight_rate_per_ton < 0 then
    raise exception 'Freight rate cannot be negative';
  end if;

  if coalesce(p_standard_km, 0) < 0 then
    raise exception 'Standard KM cannot be negative';
  end if;

  if coalesce(p_min_km_tolerance_pct, 10) < 0
     or coalesce(p_max_km_tolerance_pct, 10) < 0 then
    raise exception 'KM tolerance cannot be negative';
  end if;

  update public.destinations_freight_master
  set cargo_type = upper(btrim(p_cargo_type)),
      origin = upper(btrim(p_origin)),
      destination_name = upper(btrim(p_destination_name)),
      capacity_tons = btrim(p_capacity_tons),
      freight_rate_per_ton = p_freight_rate_per_ton,
      standard_km = coalesce(p_standard_km, 0),
      is_active = coalesce(p_is_active, true),
      cargo_category = nullif(upper(btrim(coalesce(p_cargo_category, ''))), ''),
      min_km_tolerance_pct = coalesce(p_min_km_tolerance_pct, 10),
      max_km_tolerance_pct = coalesce(p_max_km_tolerance_pct, 10)
  where destination_id = p_destination_id
  returning * into v_row;

  if not found then
    raise exception 'Freight slab not found';
  end if;

  return v_row;
exception
  when unique_violation then
    raise exception 'A freight slab already exists for this cargo, origin, destination and capacity';
end;
$$;

revoke all on function public.update_master_freight(integer,text,text,text,text,numeric,numeric,boolean,text,numeric,numeric) from public;
grant execute on function public.update_master_freight(integer,text,text,text,text,numeric,numeric,boolean,text,numeric,numeric) to authenticated;


-- ---------------------------------------------------------------------------
-- Driver Bata CRUD
-- ---------------------------------------------------------------------------

create or replace function public.create_master_bata(
  p_destination_name text,
  p_cargo_type text default 'BULK',
  p_vehicle_id integer default null,
  p_capacity_tons text default null,
  p_standard_bata_inr numeric default 0,
  p_origin text default 'ALL'
)
returns public.driver_bata_master
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.driver_bata_master%rowtype;
begin
  if not public.is_current_user_superadmin() then
    raise exception 'SUPERADMIN authorization required';
  end if;

  if p_destination_name is null or btrim(p_destination_name) = '' then
    raise exception 'Destination is required';
  end if;

  if p_standard_bata_inr is null or p_standard_bata_inr < 0 then
    raise exception 'Bata cannot be negative';
  end if;

  if p_vehicle_id is not null and not exists (
    select 1 from public.vehicles where vehicle_id = p_vehicle_id
  ) then
    raise exception 'Invalid vehicle';
  end if;

  insert into public.driver_bata_master (
    destination_name,
    cargo_type,
    vehicle_id,
    capacity_tons,
    standard_bata_inr,
    origin
  )
  values (
    upper(btrim(p_destination_name)),
    upper(btrim(coalesce(p_cargo_type, 'BULK'))),
    p_vehicle_id,
    nullif(btrim(coalesce(p_capacity_tons, '')), ''),
    p_standard_bata_inr,
    upper(btrim(coalesce(p_origin, 'ALL')))
  )
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'A matching Bata rule already exists for this destination/cargo/vehicle or capacity slab';
end;
$$;

revoke all on function public.create_master_bata(text,text,integer,text,numeric,text) from public;
grant execute on function public.create_master_bata(text,text,integer,text,numeric,text) to authenticated;


create or replace function public.update_master_bata(
  p_bata_rule_id integer,
  p_destination_name text,
  p_cargo_type text,
  p_vehicle_id integer,
  p_capacity_tons text,
  p_standard_bata_inr numeric,
  p_origin text
)
returns public.driver_bata_master
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.driver_bata_master%rowtype;
begin
  if not public.is_current_user_superadmin() then
    raise exception 'SUPERADMIN authorization required';
  end if;

  if p_bata_rule_id is null then
    raise exception 'Bata rule ID is required';
  end if;

  if p_destination_name is null or btrim(p_destination_name) = '' then
    raise exception 'Destination is required';
  end if;

  if p_standard_bata_inr is null or p_standard_bata_inr < 0 then
    raise exception 'Bata cannot be negative';
  end if;

  if p_vehicle_id is not null and not exists (
    select 1 from public.vehicles where vehicle_id = p_vehicle_id
  ) then
    raise exception 'Invalid vehicle';
  end if;

  update public.driver_bata_master
  set destination_name = upper(btrim(p_destination_name)),
      cargo_type = upper(btrim(coalesce(p_cargo_type, 'BULK'))),
      vehicle_id = p_vehicle_id,
      capacity_tons = nullif(btrim(coalesce(p_capacity_tons, '')), ''),
      standard_bata_inr = p_standard_bata_inr,
      origin = upper(btrim(coalesce(p_origin, 'ALL')))
  where bata_rule_id = p_bata_rule_id
  returning * into v_row;

  if not found then
    raise exception 'Bata rule not found';
  end if;

  return v_row;
exception
  when unique_violation then
    raise exception 'A matching Bata rule already exists for this destination/cargo/vehicle or capacity slab';
end;
$$;

revoke all on function public.update_master_bata(integer,text,text,integer,text,numeric,text) from public;
grant execute on function public.update_master_bata(integer,text,text,integer,text,numeric,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Lock direct Master-table writes
-- ---------------------------------------------------------------------------

-- Vehicles: all writes must go through secure Master RPCs.
revoke insert, update, delete, truncate, references, trigger
on public.vehicles from anon, authenticated;

-- Freight: all writes must go through secure Master RPCs.
revoke insert, update, delete, truncate, references, trigger
on public.destinations_freight_master from anon, authenticated;

-- Bata: all writes must go through secure Master RPCs.
revoke insert, update, delete, truncate, references, trigger
on public.driver_bata_master from anon, authenticated;

-- Drivers:
-- remove anonymous writes immediately.
-- authenticated INSERT remains temporarily because TripForm still creates
-- dispatch-only drivers directly. UPDATE/DELETE are already being moved
-- behind the Master RPCs.
revoke insert, update, delete, truncate, references, trigger
on public.drivers from anon;

revoke update, delete, truncate, references, trigger
on public.drivers from authenticated;

grant insert on public.drivers to authenticated;
