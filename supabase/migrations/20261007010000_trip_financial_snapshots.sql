BEGIN;

-- ============================================================
-- TRIP FINANCIAL SNAPSHOTS
-- Historical trips must retain the exact master values used
-- when the dispatch was created.
-- ============================================================

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS freight_rate_used numeric,
  ADD COLUMN IF NOT EXISTS bata_rule_id integer,
  ADD COLUMN IF NOT EXISTS bata_amount_used numeric;

-- ============================================================
-- HISTORICAL DATA
-- There are currently zero trips referencing freight_master_id.
-- Existing trips therefore remain untouched where no master
-- reference exists.
-- ============================================================

UPDATE public.trips
SET freight_rate_used =
      CASE
        WHEN tonnage_loaded > 0
        THEN round(freight_revenue / tonnage_loaded, 2)
        ELSE NULL
      END
WHERE freight_rate_used IS NULL;

UPDATE public.trips
SET bata_amount_used = COALESCE(driver_bata, 0)
WHERE bata_amount_used IS NULL;

-- ============================================================
-- FOREIGN KEYS
-- Master records cannot be deleted while historical trips
-- depend on them.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trips_freight_master_id_fkey'
      AND conrelid = 'public.trips'::regclass
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT trips_freight_master_id_fkey
      FOREIGN KEY (freight_master_id)
      REFERENCES public.destinations_freight_master(destination_id)
      ON UPDATE RESTRICT
      ON DELETE RESTRICT;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'trips_bata_rule_id_fkey'
      AND conrelid = 'public.trips'::regclass
  ) THEN
    ALTER TABLE public.trips
      ADD CONSTRAINT trips_bata_rule_id_fkey
      FOREIGN KEY (bata_rule_id)
      REFERENCES public.driver_bata_master(bata_rule_id)
      ON UPDATE RESTRICT
      ON DELETE RESTRICT;
  END IF;
END
$$;

-- ============================================================
-- SNAPSHOT TRIGGER
-- Runs only for INSERT.
--
-- The authoritative dispatch RPC has already validated:
--   freight_master_id
--   vehicle
--   route
--   tonnage
--   authoritative freight
--   authoritative bata
--
-- This trigger records the exact master/rule evidence.
-- ============================================================

CREATE OR REPLACE FUNCTION public.capture_trip_financial_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog, public'
AS $function$
DECLARE
  v_freight_rate numeric;
  v_bata_rule_id integer;
  v_bata_amount numeric;
  v_route_cargo text;
BEGIN
  IF TG_OP = 'INSERT' THEN

    -- Freight snapshot
    IF NEW.freight_master_id IS NOT NULL THEN
      SELECT
        d.freight_rate_per_ton,
        d.cargo_type
      INTO
        v_freight_rate,
        v_route_cargo
      FROM public.destinations_freight_master d
      WHERE d.destination_id = NEW.freight_master_id
        AND COALESCE(d.is_active, true) = true;

      IF v_freight_rate IS NULL OR v_freight_rate <= 0 THEN
        RAISE EXCEPTION
          'TRIP_FINANCIAL_SNAPSHOT_FREIGHT_MASTER_INVALID';
      END IF;

      NEW.freight_rate_used := v_freight_rate;
    END IF;

    -- Bata snapshot
    IF NEW.vehicle_id IS NOT NULL
       AND NEW.freight_master_id IS NOT NULL
       AND NEW.primary_driver_id IS NOT NULL THEN

      SELECT
        r.bata_rule_id,
        r.standard_bata_inr
      INTO
        v_bata_rule_id,
        v_bata_amount
      FROM public.resolve_dispatch_bata_atomic(
        NEW.vehicle_id,
        (
          SELECT v.capacity_tons
          FROM public.vehicles v
          WHERE v.vehicle_id = NEW.vehicle_id
        ),
        NEW.origin,
        NEW.destination,
        v_route_cargo
      ) r;

      NEW.bata_rule_id := v_bata_rule_id;
      NEW.bata_amount_used := v_bata_amount;
    ELSE
      NEW.bata_amount_used := COALESCE(NEW.driver_bata, 0);
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_capture_trip_financial_snapshot
ON public.trips;

CREATE TRIGGER trg_capture_trip_financial_snapshot
BEFORE INSERT ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.capture_trip_financial_snapshot();

-- ============================================================
-- SNAPSHOT IMMUTABILITY
-- Once a trip exists, its master/rate/rule evidence cannot
-- be changed by Modify Trip or direct SQL.
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_trip_financial_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog, public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN

    IF NEW.freight_master_id IS DISTINCT FROM OLD.freight_master_id
       OR NEW.freight_rate_used IS DISTINCT FROM OLD.freight_rate_used
       OR NEW.freight_revenue IS DISTINCT FROM OLD.freight_revenue
       OR NEW.bata_rule_id IS DISTINCT FROM OLD.bata_rule_id
       OR NEW.bata_amount_used IS DISTINCT FROM OLD.bata_amount_used
       OR NEW.driver_bata IS DISTINCT FROM OLD.driver_bata
    THEN
      RAISE EXCEPTION
        'TRIP_FINANCIAL_SNAPSHOT_IMMUTABLE: historical Freight/Bata values require a controlled correction workflow';
    END IF;

  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_trip_financial_snapshot
ON public.trips;

CREATE TRIGGER trg_protect_trip_financial_snapshot
BEFORE UPDATE ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.protect_trip_financial_snapshot();

-- ============================================================
-- FUNCTION SECURITY
-- ============================================================

REVOKE ALL ON FUNCTION public.capture_trip_financial_snapshot()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.capture_trip_financial_snapshot()
TO postgres, service_role;

REVOKE ALL ON FUNCTION public.protect_trip_financial_snapshot()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.protect_trip_financial_snapshot()
TO postgres, service_role;

COMMIT;
