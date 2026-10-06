-- Workshop / tyre tables must be mutated only through secured RPCs.
-- Keep authenticated read access for ERP screens.
-- Remove all direct anonymous access.

REVOKE ALL ON TABLE public.fleet_tyres
FROM anon;

REVOKE ALL ON TABLE public.fleet_tyre_events
FROM anon;

REVOKE ALL ON TABLE public.fleet_tyre_cost_entries
FROM anon;

REVOKE ALL ON TABLE public.workshop_spares_bills
FROM anon;

REVOKE ALL ON TABLE public.inventory_items
FROM anon;

REVOKE ALL ON TABLE public.inventory_purchase_bills
FROM anon;

REVOKE ALL ON TABLE public.inventory_purchase_items
FROM anon;

REVOKE ALL ON TABLE public.inventory_stock_movements
FROM anon;


-- Remove direct mutation from authenticated users.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON TABLE public.fleet_tyres
FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON TABLE public.fleet_tyre_events
FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON TABLE public.fleet_tyre_cost_entries
FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON TABLE public.workshop_spares_bills
FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON TABLE public.inventory_items
FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON TABLE public.inventory_purchase_bills
FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON TABLE public.inventory_purchase_items
FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON TABLE public.inventory_stock_movements
FROM authenticated;


-- Explicitly retain read access required by ERP screens.

GRANT SELECT ON TABLE public.fleet_tyres
TO authenticated;

GRANT SELECT ON TABLE public.fleet_tyre_events
TO authenticated;

GRANT SELECT ON TABLE public.fleet_tyre_cost_entries
TO authenticated;

GRANT SELECT ON TABLE public.workshop_spares_bills
TO authenticated;

GRANT SELECT ON TABLE public.inventory_items
TO authenticated;

GRANT SELECT ON TABLE public.inventory_purchase_bills
TO authenticated;

GRANT SELECT ON TABLE public.inventory_purchase_items
TO authenticated;

GRANT SELECT ON TABLE public.inventory_stock_movements
TO authenticated;
