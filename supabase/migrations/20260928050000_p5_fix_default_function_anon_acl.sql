-- P5.89
-- Corrective migration for the postgres/public function default ACL.
--
-- P5.81 revoked PUBLIC execution, but Supabase's default ACL contains
-- an explicit anon grant. Remove that explicit anon grant.
--
-- Existing function ACLs are not changed here.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE EXECUTE ON FUNCTIONS FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
