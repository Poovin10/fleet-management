BEGIN;

-- Remove the overly broad public policies.
DROP POLICY IF EXISTS "Allow all operations" ON public.pending_scans;
DROP POLICY IF EXISTS "Full access pending_scans" ON public.pending_scans;

-- Anonymous clients must have no access to the OCR inbox.
REVOKE ALL ON TABLE public.pending_scans FROM anon;

-- The ERP browser is authenticated, and the existing UI requires:
-- INSERT  -> UploadHub
-- SELECT  -> POD/Fuel inboxes
-- UPDATE  -> mark Fuel/POD scan processed
-- DELETE  -> remove obsolete inbox entries
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pending_scans TO authenticated;

-- Keep backend/service-role access.
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
ON TABLE public.pending_scans TO service_role;

-- Explicit authenticated policies.
CREATE POLICY "Authenticated users can read pending scans"
ON public.pending_scans
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create pending scans"
ON public.pending_scans
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update pending scans"
ON public.pending_scans
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete pending scans"
ON public.pending_scans
FOR DELETE
TO authenticated
USING (true);

COMMIT;
