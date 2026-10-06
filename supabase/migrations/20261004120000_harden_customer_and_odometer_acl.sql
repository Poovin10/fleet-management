BEGIN;

-- ============================================================
-- KSS ERP: Harden direct table ACLs
-- Business logic unchanged.
-- Writes must go through controlled SECURITY DEFINER RPCs.
-- ============================================================

-- ------------------------------------------------------------
-- CUSTOMER MASTER
-- ------------------------------------------------------------
-- Authenticated users may read customers through the existing
-- RLS SELECT policy, but must not directly mutate the table.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON TABLE public.customers
FROM anon, authenticated;

-- No anonymous access to the customer table.
REVOKE ALL
ON TABLE public.customers
FROM anon;

-- Keep authenticated read access.
GRANT SELECT
ON TABLE public.customers
TO authenticated;

-- Customer writes remain through:
--   create_master_customer(...)
--   update_master_customer(...)

-- ------------------------------------------------------------
-- VEHICLE ODOMETER LEDGER
-- ------------------------------------------------------------
-- The odometer ledger is authoritative audit data.
-- Prevent direct client-side mutation.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON TABLE public.vehicle_odometer_logs
FROM anon, authenticated;

-- Anonymous clients should have no direct table access.
REVOKE ALL
ON TABLE public.vehicle_odometer_logs
FROM anon;

-- Authenticated users retain read-only visibility through RLS.
GRANT SELECT
ON TABLE public.vehicle_odometer_logs
TO authenticated;

COMMIT;
