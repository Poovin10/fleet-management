create or replace function public.set_master_driver_pin(
  p_driver_id integer,
  p_pin text
)
returns public.drivers
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_driver public.drivers%rowtype;
begin
  if not public.is_current_user_superadmin() then
    raise exception 'SUPERADMIN access required';
  end if;

  if p_driver_id is null then
    raise exception 'Driver ID is required';
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'Driver PIN must be exactly 4 digits';
  end if;

  update public.drivers
  set
    pin = null,
    pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
  where driver_id = p_driver_id
  returning * into v_driver;

  if not found then
    raise exception 'Driver not found';
  end if;

  return v_driver;
end;
$function$;

revoke execute on function public.set_master_driver_pin(integer,text) from anon;
grant execute on function public.set_master_driver_pin(integer,text) to authenticated;
