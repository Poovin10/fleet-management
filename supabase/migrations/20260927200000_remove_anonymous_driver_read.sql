-- KSS ERP: P5.1.9 Remove Anonymous Driver Read Access
--
-- Drivers contain operational and personally identifiable information.
-- Anonymous clients must not be able to read the driver master.

begin;

revoke all
on public.drivers
from anon;

drop policy if exists "Enable read access for all users"
on public.drivers;

commit;
