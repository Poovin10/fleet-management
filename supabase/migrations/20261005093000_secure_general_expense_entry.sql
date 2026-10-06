-- ============================================================
-- KSS ERP
-- Secure General Expense Entry
-- ============================================================

BEGIN;

-- General expense writes must go through this controlled RPC.
-- Direct table writes are removed from authenticated/anon roles.

CREATE OR REPLACE FUNCTION public.save_general_expense_atomic(
  p_expense_date date,
  p_category text,
  p_amount numeric,
  p_vehicle_id bigint DEFAULT null,
  p_description text DEFAULT null
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_expense_id bigint;
  v_category text;
BEGIN
  -- ----------------------------------------------------------
  -- Basic validation
  -- ----------------------------------------------------------

  IF p_expense_date IS NULL THEN
    RAISE EXCEPTION 'Expense date is required';
  END IF;

  v_category := upper(btrim(coalesce(p_category, '')));

  IF v_category = '' THEN
    RAISE EXCEPTION 'Expense category is required';
  END IF;

  -- ----------------------------------------------------------
  -- Controlled category vocabulary
  -- ----------------------------------------------------------

  IF v_category NOT IN (
    'TOLL_FASTAG',
    'POLICE_RTO',
    'LOADING',
    'OFFICE',
    'MISCELLANEOUS'
  ) THEN
    RAISE EXCEPTION 'Invalid expense category';
  END IF;

  -- ----------------------------------------------------------
  -- Amount validation
  -- ----------------------------------------------------------

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be greater than zero';
  END IF;

  -- ----------------------------------------------------------
  -- Vehicle validation
  -- ----------------------------------------------------------

  IF p_vehicle_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.vehicles v
      WHERE v.vehicle_id = p_vehicle_id
    ) THEN
      RAISE EXCEPTION 'Selected vehicle does not exist';
    END IF;
  END IF;

  -- ----------------------------------------------------------
  -- Atomic expense creation
  -- ----------------------------------------------------------

  INSERT INTO public.expenses (
    expense_date,
    category,
    amount,
    vehicle_id,
    description
  )
  VALUES (
    p_expense_date,
    v_category,
    p_amount,
    p_vehicle_id,
    nullif(btrim(coalesce(p_description, '')), '')
  )
  RETURNING expense_id
  INTO v_expense_id;

  RETURN v_expense_id;
END;
$$;

-- ------------------------------------------------------------
-- Direct browser writes are forbidden.
-- Reads remain controlled by the existing RLS policy.
-- ------------------------------------------------------------

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.expenses
FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- Controlled RPC ACL
-- ------------------------------------------------------------

REVOKE EXECUTE
ON FUNCTION public.save_general_expense_atomic(
  date,
  text,
  numeric,
  bigint,
  text
)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.save_general_expense_atomic(
  date,
  text,
  numeric,
  bigint,
  text
)
TO authenticated, service_role;

COMMIT;
