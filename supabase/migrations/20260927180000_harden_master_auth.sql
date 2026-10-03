-- KSS ERP: P5.1.3 Master Auth Hardening
--
-- 1. Remove anonymous execution of the Superadmin helper.
-- 2. Remove anonymous access to app_users.
-- 3. Remove direct authenticated writes to drivers.
-- 4. Driver creation must subsequently happen through a secure RPC.

begin;

-- ---------------------------------------------------------------------------
-- 1. Superadmin helper must never be callable by anonymous users.
-- ---------------------------------------------------------------------------

revoke execute
on function public.is_current_user_superadmin()
from anon;

grant execute
on function public.is_current_user_superadmin()
to authenticated;


-- ---------------------------------------------------------------------------
-- 2. app_users contains authorization information.
-- Anonymous users must not be able to read it.
-- ---------------------------------------------------------------------------

revoke all
on public.app_users
from anon;

-- Authenticated users only need the minimum read access currently used
-- by the dashboard. Write access remains unavailable.
revoke insert, update, delete, truncate, references, trigger
on public.app_users
from anon, authenticated;

grant select
on public.app_users
to authenticated;


-- ---------------------------------------------------------------------------
-- 3. Remove direct authenticated INSERT on drivers.
--
-- TripForm currently creates dispatch-only drivers directly.
-- That path will be moved to create_dispatch_driver_atomic().
-- ---------------------------------------------------------------------------

revoke insert, update, delete, truncate, references, trigger
on public.drivers
from anon, authenticated;

grant select
on public.drivers
to authenticated;

commit;
