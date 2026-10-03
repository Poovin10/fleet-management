-- P5.81
-- Prevent future public-schema functions owned by postgres from
-- automatically receiving PUBLIC/anon EXECUTE.
--
-- Existing function ACLs are intentionally not changed here.
-- Existing functions are handled by dedicated security migrations.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
