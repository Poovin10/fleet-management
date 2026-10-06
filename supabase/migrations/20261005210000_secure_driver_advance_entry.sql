-- KSS ERP: Secure Driver Advance Entry
BEGIN;

CREATE OR REPLACE FUNCTION public.save_driver_advance_atomic(
  p_advance_date date DEFAULT null,
  p_driver_id integer DEFAULT null,
  p_amount_inr numeric DEFAULT null,
  p_advance_type text DEFAULT null,
  p_payment_mode text DEFAULT null,
  p_reference_remarks text DEFAULT null,
  p_advance_id integer DEFAULT null
)
RETURNS public.driver_direct_advances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role text;
  v_result public.driver_direct_advances;
BEGIN
  /*
    Only Accounts-authorized users may create/update driver advances.
  */
  v_role := public.get_current_user_role();

  IF v_role NOT IN ('ADMIN', 'SUPERADMIN') THEN
    RAISE EXCEPTION 'Not authorized to manage driver advances';
  END IF;

  IF p_advance_date IS NULL THEN
    RAISE EXCEPTION 'Advance date is required';
  END IF;

  IF p_driver_id IS NULL THEN
    RAISE EXCEPTION 'Driver is required';
  END IF;

  IF p_amount_inr IS NULL OR p_amount_inr <= 0 THEN
    RAISE EXCEPTION 'Advance amount must be greater than zero';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.driver_id = p_driver_id
  ) THEN
    RAISE EXCEPTION 'Selected driver does not exist';
  END IF;

  IF p_advance_id IS NULL THEN

    INSERT INTO public.driver_direct_advances (
      advance_date,
      driver_id,
      amount_inr,
      advance_type,
      payment_mode,
      reference_remarks
    )
    VALUES (
      p_advance_date,
      p_driver_id,
      p_amount_inr,
      nullif(pg_catalog.btrim(p_advance_type), ''),
      nullif(pg_catalog.btrim(p_payment_mode), ''),
      nullif(pg_catalog.btrim(p_reference_remarks), '')
    )
    RETURNING *
    INTO v_result;

  ELSE

    /*
      Lock the existing row and prevent modification of a settled
      advance through this general entry RPC.
    */
    SELECT *
    INTO v_result
    FROM public.driver_direct_advances
    WHERE advance_id = p_advance_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Driver advance does not exist';
    END IF;

    IF COALESCE(v_result.is_settled, false) THEN
      RAISE EXCEPTION 'Settled driver advances cannot be modified';
    END IF;

    UPDATE public.driver_direct_advances
    SET
      advance_date = p_advance_date,
      driver_id = p_driver_id,
      amount_inr = p_amount_inr,
      advance_type = nullif(pg_catalog.btrim(p_advance_type), ''),
      payment_mode = nullif(pg_catalog.btrim(p_payment_mode), ''),
      reference_remarks = nullif(pg_catalog.btrim(p_reference_remarks), '')
    WHERE advance_id = p_advance_id
    RETURNING *
    INTO v_result;

  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL
ON FUNCTION public.save_driver_advance_atomic(
  date,
  integer,
  numeric,
  text,
  text,
  text,
  integer
)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.save_driver_advance_atomic(
  date,
  integer,
  numeric,
  text,
  text,
  text,
  integer
)
TO authenticated, service_role;

REVOKE INSERT, UPDATE, DELETE
ON TABLE public.driver_direct_advances
FROM PUBLIC, anon, authenticated;

GRANT SELECT
ON TABLE public.driver_direct_advances
TO authenticated;

DROP POLICY IF EXISTS "Enable read access for all users"
ON public.driver_direct_advances;

DROP POLICY IF EXISTS "Full access driver_direct_advances"
ON public.driver_direct_advances;

CREATE POLICY "Authenticated users can read driver advances"
ON public.driver_direct_advances
FOR SELECT
TO authenticated
USING (true);

COMMIT;
