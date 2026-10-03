-- KSS ERP: P5.4.2 Master RLS Policy Hardening
--
-- Master writes are performed through SECURITY DEFINER RPCs.
-- Direct table writes must not be available to anon/authenticated.
--
-- Anonymous access to master data is removed.
-- Authenticated users retain read access where required.

begin;

-- ============================================================
-- APP USERS
-- ============================================================

drop policy if exists "Allow select on app_users"
on public.app_users;

drop policy if exists "Full access app_users"
on public.app_users;

create policy "Authenticated users can read app_users"
on public.app_users
for select
to authenticated
using (true);


-- ============================================================
-- DRIVERS
-- ============================================================

drop policy if exists "Full access drivers"
on public.drivers;

create policy "Authenticated users can read drivers"
on public.drivers
for select
to authenticated
using (true);


-- ============================================================
-- VEHICLES
-- ============================================================

drop policy if exists "Allow public read access"
on public.vehicles;

drop policy if exists "Allow driver portal vehicle updates"
on public.vehicles;

drop policy if exists "Full access vehicles"
on public.vehicles;

-- Existing authenticated read requirement is preserved.
drop policy if exists "Authenticated users can read vehicles"
on public.vehicles;

create policy "Authenticated users can read vehicles"
on public.vehicles
for select
to authenticated
using (true);


-- ============================================================
-- DESTINATIONS / FREIGHT MASTER
-- ============================================================

drop policy if exists "Enable read access for all users"
on public.destinations_freight_master;

drop policy if exists "Full access destinations_freight_master"
on public.destinations_freight_master;

create policy "Authenticated users can read destinations freight master"
on public.destinations_freight_master
for select
to authenticated
using (true);


-- ============================================================
-- DRIVER BATA MASTER
-- ============================================================

drop policy if exists "Enable read access for all users"
on public.driver_bata_master;

drop policy if exists "Full access driver_bata_master"
on public.driver_bata_master;

create policy "Authenticated users can read driver bata master"
on public.driver_bata_master
for select
to authenticated
using (true);

commit;
