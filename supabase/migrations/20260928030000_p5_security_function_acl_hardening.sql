-- KSS ERP: P5 security function ACL hardening.
--
-- Production ACL corrections performed during the P5 security audit.
-- All ERP mutation/helper functions below are callable by authenticated
-- application users and service_role, but never by PUBLIC/anon.
--
-- Driver authentication/session entrypoints are intentionally excluded.

BEGIN;

-- ---------------------------------------------------------------------------
-- ERP mutation functions: authenticated + service_role only.
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.approve_driver_fuel_atomic(
  integer, numeric, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_driver_fuel_atomic(
  integer, numeric, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.close_pod_atomic(
  bigint, text, date, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, boolean, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_pod_atomic(
  bigint, text, date, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, boolean, uuid
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.complete_tyre_retread_atomic(
  integer, text, bigint, date, numeric, text, integer, text,
  numeric, numeric, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_tyre_retread_atomic(
  integer, text, bigint, date, numeric, text, integer, text,
  numeric, numeric, text, text, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_dispatch_trip_atomic(
  character varying, integer, integer, date, character varying,
  character varying, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, boolean, text, timestamptz
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_dispatch_trip_atomic(
  character varying, integer, integer, date, character varying,
  character varying, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, boolean, text, timestamptz
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_inventory_item(
  text, text, text, text, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_inventory_item(
  text, text, text, text, numeric
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_inventory_purchase_atomic(
  integer, date, text, date, numeric, numeric, numeric, text, text,
  text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_inventory_purchase_atomic(
  integer, date, text, date, numeric, numeric, numeric, text, text,
  text, jsonb
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_tyre_purchase_atomic(
  bigint, date, text, date, numeric, numeric, numeric, text, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_tyre_purchase_atomic(
  bigint, date, text, date, numeric, numeric, numeric, text, text, jsonb
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_vendor_atomic(
  text, text, text, text, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_vendor_atomic(
  text, text, text, text, text, text, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.delete_adblue_atomic(
  bigint
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_adblue_atomic(
  bigint
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.delete_fuel_atomic(
  integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_fuel_atomic(
  integer
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.dispose_tyre_atomic(
  integer, text, date, numeric, numeric, bigint, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispose_tyre_atomic(
  integer, text, date, numeric, numeric, bigint, text, text, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_vehicle_current_odometer(
  integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vehicle_current_odometer(
  integer
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.issue_inventory_stock(
  bigint, numeric, integer, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_inventory_stock(
  bigint, numeric, integer, text, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.modify_trip_atomic(
  bigint, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modify_trip_atomic(
  bigint, jsonb
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mount_tyre_atomic(
  integer, integer, text, numeric, date, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mount_tyre_atomic(
  integer, integer, text, numeric, date, text, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_adblue_credit_atomic(
  integer, date, numeric, numeric, numeric, bigint, bigint, text,
  text, date, boolean, text, text, timestamptz
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_adblue_credit_atomic(
  integer, date, numeric, numeric, numeric, bigint, bigint, text,
  text, date, boolean, text, text, timestamptz
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_adblue_filling_atomic(
  integer, date, numeric, numeric, numeric, bigint, bigint, text,
  boolean, text, timestamptz, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_adblue_filling_atomic(
  integer, date, numeric, numeric, numeric, bigint, bigint, text,
  boolean, text, timestamptz, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_fuel_atomic(
  integer, date, character varying, numeric, numeric, numeric, numeric,
  bigint, character varying, character varying, text, boolean,
  timestamptz, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_fuel_atomic(
  integer, date, character varying, numeric, numeric, numeric, numeric,
  bigint, character varying, character varying, text, boolean,
  timestamptz, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_vehicle_odometer(
  integer, numeric, character varying, bigint, timestamptz, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_vehicle_odometer(
  integer, numeric, character varying, bigint, timestamptz, text, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.record_vendor_payment_atomic(
  bigint, date, numeric, text, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_vendor_payment_atomic(
  bigint, date, numeric, text, text, text, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.register_tyre_atomic(
  text, text, text, numeric, integer, text, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_tyre_atomic(
  text, text, text, numeric, integer, text, numeric
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reject_driver_pending_entry_atomic(
  integer, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_driver_pending_entry_atomic(
  integer, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.send_tyre_for_retread_atomic(
  integer, bigint, numeric, numeric, date, text, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_tyre_for_retread_atomic(
  integer, bigint, numeric, numeric, date, text, text, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.set_master_driver_pin(
  integer, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_master_driver_pin(
  integer, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.settle_and_close_trip(
  bigint, numeric, character varying, date, numeric, numeric,
  character varying, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_and_close_trip(
  bigint, numeric, character varying, date, numeric, numeric,
  character varying, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.unmount_tyre_to_store_atomic(
  integer, numeric, numeric, date, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unmount_tyre_to_store_atomic(
  integer, numeric, numeric, date, text, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_adblue_atomic(
  bigint, date, numeric, numeric, bigint, text, boolean, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_adblue_atomic(
  bigint, date, numeric, numeric, bigint, text, boolean, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_fuel_atomic(
  integer, date, character varying, numeric, numeric, numeric,
  character varying, character varying, text, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_fuel_atomic(
  integer, date, character varying, numeric, numeric, numeric,
  character varying, character varying, text, boolean
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_vehicle_status_atomic(
  integer, text, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_vehicle_status_atomic(
  integer, text, text
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_vendor_atomic(
  bigint, text, text, text, text, text, text, text, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_vendor_atomic(
  bigint, text, text, text, text, text, text, text, boolean
) TO authenticated, service_role;

COMMIT;
