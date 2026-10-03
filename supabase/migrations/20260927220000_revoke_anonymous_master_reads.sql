-- KSS ERP: P5.4.3 Revoke Anonymous Master Reads
--
-- RLS policies restrict rows, but table privileges must also be
-- removed from anon so anonymous clients cannot query master data.

begin;

revoke all on public.app_users
from anon;

revoke all on public.drivers
from anon;

revoke all on public.vehicles
from anon;

revoke all on public.destinations_freight_master
from anon;

revoke all on public.driver_bata_master
from anon;

commit;
