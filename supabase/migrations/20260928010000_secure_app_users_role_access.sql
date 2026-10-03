-- KSS ERP: P5.25 Secure app_users role access
--
-- app_users contains authorization data, including the legacy password
-- column. Authenticated clients must not receive direct table access.
--
-- Role information required by the application is exposed only through
-- narrowly scoped SECURITY DEFINER RPCs.

begin;

-- ============================================================
-- 1. Remove direct client access to authorization records
-- ============================================================

revoke all
on public.app_users
from anon;

revoke select
on public.app_users
from authenticated;

drop policy if exists "Authenticated users can read app_users"
on public.app_users;

-- ============================================================
-- 2. Current authenticated user's role
-- ============================================================

create or replace function public.get_current_user_role()
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_email text;
  v_username text;
  v_role text;
begin
  v_email := auth.email();

  if v_email is null or btrim(v_email) = '' then
    return null;
  end if;

  v_username := split_part(btrim(v_email), '@', 1);

  select upper(btrim(au.role))
    into v_role
  from public.app_users au
  where lower(btrim(au.username)) = lower(v_username)
  limit 1;

  return v_role;
end;
$function$;

revoke all
on function public.get_current_user_role()
from public;

revoke execute
on function public.get_current_user_role()
from anon;

grant execute
on function public.get_current_user_role()
to authenticated;

grant execute
on function public.get_current_user_role()
to service_role;

-- ============================================================
-- 3. Protected app_users list for ADMIN / SUPERADMIN
-- ============================================================

create or replace function public.get_manageable_app_users()
returns table (
  user_id integer,
  username text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_email text;
  v_username text;
  v_role text;
begin
  v_email := auth.email();

  if v_email is null or btrim(v_email) = '' then
    return;
  end if;

  v_username := split_part(btrim(v_email), '@', 1);

  select upper(btrim(au.role))
    into v_role
  from public.app_users au
  where lower(btrim(au.username)) = lower(v_username)
  limit 1;

  if v_role not in ('ADMIN', 'SUPERADMIN') then
    return;
  end if;

  return query
  select
    au.user_id,
    au.username,
    au.role,
    au.created_at
  from public.app_users au
  order by au.username;
end;
$function$;

revoke all
on function public.get_manageable_app_users()
from public;

revoke execute
on function public.get_manageable_app_users()
from anon;

grant execute
on function public.get_manageable_app_users()
to authenticated;

grant execute
on function public.get_manageable_app_users()
to service_role;

commit;
