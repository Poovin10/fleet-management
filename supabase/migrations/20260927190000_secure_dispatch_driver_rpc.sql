-- KSS ERP: P5.1.3 Secure Dispatch Driver Creation
--
-- Manual driver creation from TripForm is moved behind a
-- SECURITY DEFINER RPC so authenticated users never receive
-- direct INSERT permission on public.drivers.

begin;

create or replace function public.create_dispatch_driver_atomic(
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

  -- ------------------------------------------------------------
  -- Authentication gate
  -- ------------------------------------------------------------
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  -- ------------------------------------------------------------
  -- Required fields
  -- ------------------------------------------------------------
  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'Driver name is required';
  end if;

  if p_phone_number is null or btrim(p_phone_number) = '' then
    raise exception 'Driver phone number is required';
  end if;

  if p_license_number is null or btrim(p_license_number) = '' then
    raise exception 'License number is required';
  end if;

  -- ------------------------------------------------------------
  -- Optional driver PIN
  -- ------------------------------------------------------------
  if p_pin is not null
     and btrim(p_pin) !~ '^[0-9]{4}$'
  then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  -- ------------------------------------------------------------
  -- Branch validation
  -- ------------------------------------------------------------
  if not exists (
    select 1
    from public.branches
    where branch_id = coalesce(p_branch_id, 1)
  ) then
    raise exception 'Invalid branch';
  end if;

  -- ------------------------------------------------------------
  -- Generate next driver code.
  --
  -- Lock the driver table during code generation so two
  -- simultaneous dispatches cannot generate the same code.
  -- ------------------------------------------------------------
  lock table public.drivers in share row exclusive mode;

  select
    coalesce(
      max(
        nullif(
          regexp_replace(driver_code, '[^0-9]', '', 'g'),
          ''
        )::integer
      ),
      0
    ) + 1
  into v_next_code
  from public.drivers
  where driver_code ~ '^DRV-[0-9]+$';

  -- ------------------------------------------------------------
  -- Create dispatch-only driver
  -- ------------------------------------------------------------
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
      else extensions.crypt(
        btrim(p_pin),
        extensions.gen_salt('bf')
      )
    end
  )
  returning * into v_driver;

  return v_driver;

exception
  when unique_violation then
    raise exception
      'Driver code or driver information already exists; retry the operation';
end;
$$;

-- ------------------------------------------------------------
-- RPC permissions
-- ------------------------------------------------------------

revoke all
on function public.create_dispatch_driver_atomic(
  text,
  text,
  text,
  date,
  integer,
  text
)
from public, anon;

grant execute
on function public.create_dispatch_driver_atomic(
  text,
  text,
  text,
  date,
  integer,
  text
)
to authenticated;

commit;
