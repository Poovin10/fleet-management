# KSS ERP Security Permission Audit

**Scope:** Priority #2, deployed RLS and RPC permissions for application roles
**Repository:** `C:\Users\unnik\kss-erp`, branch `design/premium-ui-v2`
**Audit date:** 2026-09-27
**Mode:** Read-only source/configuration review. This report is the only file created for this task. No deployed database connection was available, so deployed permissions cannot be certified by this audit.

## Executive result

The repository has three checked-in migrations. They define security for driver-session wrappers and selected master-data RPCs, but they do not define table RLS enablement/policies for the application tables or the grants/definitions for most business RPCs called by the frontend. Generated `database.types.ts` is not a privilege snapshot and is stale/incomplete relative to active code. The deployment metadata does not expose an inspectable schema snapshot, and no usable Supabase CLI/database connection was present. Therefore the deployed RLS and function ACL state is **unverified**, not presumed safe or unsafe.

Two source-level security concerns are identifiable: the retained table-level authenticated `INSERT` grant on `drivers` has no row/role restriction in the checked-in migration (effective reach still depends on deployed RLS); and `SetupModule` selects every `app_users` column even though generated types include a `password` column. Both require deployed-policy verification; the latter should be narrowed in source before a user table with credential material is exposed to a browser query. The `set_master_driver_pin` migration also omits an explicit revoke from `PUBLIC`, so its intended execute scope is not established by that migration alone. Its body does check the SUPERADMIN helper before mutation.

No RLS or RPC changes are recommended/applied in this audit. The first deployment action should be a read-only catalog snapshot from the linked production Supabase project covering `pg_class.relrowsecurity`, `pg_policies`, `information_schema.role_table_grants`, `pg_proc.prosecdef/proconfig`, `has_function_privilege`, and `supabase_migrations.schema_migrations`. Compare that output to this report and the repository migrations before approving any remediation.

## Evidence and limitations

Inspected: `audit/master-architecture-audit.md`; `lib/database.types.ts`; all three files under `supabase/migrations/`; application auth/session and Supabase helpers; `proxy.ts` and `lib/supabase/proxy.ts`; API routes; package metadata; all active `.from(...)` and `.rpc(...)` usages in `app/`, `components/`, and `lib/`; relevant environment-variable **names only**. Secret values were not read or printed.

`supabase/migrations/` contains:

- `20260926103000_secure_driver_trip_actions.sql`
- `20260926170000_secure_master_crud.sql`
- `20260926190000_secure_master_driver_pin.sql`

No checked-in migration contains `CREATE POLICY`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, or a complete table permission policy set. `audit/remote-public-schema.sql` exists but is **0 bytes**. `supabase/config.toml`, usable `supabase`, `psql`, and `pg_dump` tooling, or database connection credentials suitable for catalog inspection were not available. Local `.temp` metadata is not proof of deployment state. Migration application status and production drift cannot be determined. No production connection was attempted with application secrets.

Generated types list 20 tables and one view; active code additionally uses `adblue_logs` and `vendors`, which are absent from those types. Several typed tables have no active frontend access. The types describe row shapes, not RLS or grants.

## Application roles vs database roles

| Role | Evidence / use | Intended frontend access | Database identity / enforcement evidence |
|---|---|---|---|
| `SUPERADMIN` | `dashboard.tsx`; master RPC guard `is_current_user_superadmin()` | Admin operations and master-data management | App role is derived from `app_users.username` matched to auth email local-part. Master write RPCs check the role server-side. Deployed table policies not available. |
| `ADMIN` | `dashboard.tsx`; cron route accepts ADMIN or SUPERADMIN | Operations and admin-facing modules | Frontend visibility is not DB authorization. Not accepted by master write RPC guard (SUPERADMIN required). Deployed policies not available. |
| `VIEWER` | `dashboard.tsx` default for missing/unrecognized role | Read-oriented dashboard/report/financial views | No distinct database role or role-specific policy found in repository. |
| Driver portal identity (driver PIN/session) | `DriverPortal.tsx`, `/driver`; session-oriented RPC calls | Own trip, fuel, breakdown, status/closure workflows | Not an `app_users.role` value. Migration wrappers accept `anon` and `authenticated`, then resolve/check a driver session and trip assignment. Definitions/grants of most portal RPCs are absent locally. |
| `FINANCE` | Searched app role checks, types, migrations | None found | Do not treat as an existing role. |
| PostgreSQL/Supabase `anon` | Supabase client and driver portal | Public/unauthenticated HTTP role | Distinct from application role. Only locally evidenced intended grants are specified below. |
| PostgreSQL/Supabase `authenticated` | Normal Supabase Auth client | Signed-in users, regardless of UI role unless policy/RPC checks constrain them | Distinct from ADMIN/SUPERADMIN/VIEWER. Effective table policies/grants are mostly unknown. |
| `service_role` | `app/api/cron/audit/route.ts` only | Server-side cron aggregation/write | Privileged key bypasses RLS. Route performs scheduler/admin authorization before creating/using the privileged client. No client import/reference was found. |

## Table permission matrix

**Legend:** “Unknown” means the repository does not establish actual RLS enablement, deployed policy predicates, or effective grants. “No policy definition in checked-in migrations” does **not** prove RLS is disabled. Application-operation column describes what the code calls, not a verified database permission. RPC writes are listed separately from direct table writes.

| Table | RLS enabled? | SELECT | INSERT | UPDATE | DELETE | Frontend operation / scope observation |
|---|---|---|---|---|---|---|
| `app_users` | Unknown | Unknown; browser reads role; Setup reads all columns | Unknown | Unknown | Unknown | Dashboard selects a user role; Setup selects `*` and orders by username. Types include a `password` field; no active frontend feature shown to need it. Cron’s admin fallback reads role. |
| `branches` | Unknown | Unknown | Unknown | Unknown | Unknown | Not directly queried by UI; master-driver RPC validates branch existence. |
| `vehicles` | Unknown | Unknown; extensively read | Checked-in migration revokes direct INSERT/UPDATE/DELETE from `anon, authenticated`; effective RLS still unverified | Same | Same | Direct reads for selectors, dashboard and fleet. Status update and master writes use RPCs. Whether direct SELECT should be role-scoped is unknown. |
| `trucks` | Unknown | Unknown | Unknown | Unknown | Unknown | Generated type only; no active `.from('trucks')` call found. Current UI uses `vehicles`. |
| `drivers` | Unknown | Unknown; extensively read | **Migration explicitly grants table INSERT to `authenticated`**; no row/role restriction appears in that migration | Migration revokes direct UPDATE from `anon, authenticated` | Migration revokes direct DELETE from `anon, authenticated` | TripForm directly inserts a manually entered driver; existing workflow explains why INSERT exists. UI restriction to operations/admin is client-side; RLS predicate/column scope is not present locally. Other driver edits use SUPERADMIN RPC. |
| `trips` | Unknown | Unknown; read by operational UI, analytics, reports | Unknown (dispatch uses RPC) | Unknown (modification/status/POD use RPC) | Unknown | Active reads and operational pickers; dispatch, modify, status and POD mutations use RPCs. No frontend direct table mutation found. |
| `diesel_fuel_logs` | Unknown | Unknown; operational, reports and analytics read | Unknown (recording uses RPC) | Unknown (editing uses RPC) | Unknown (deletion uses RPC) | Direct SELECT incl. recent rows/rate; fuel create/update/delete use RPCs. |
| `driver_bata_master` | Unknown | Unknown; trip/settlement setup reads | Checked-in migration revokes direct INSERT/UPDATE/DELETE from `anon, authenticated` | Same | Same | Reads for trip and master UI; writes use SUPERADMIN-only master RPCs. |
| `driver_direct_advances` | Unknown | Unknown; Reports reads; operational entry may query related data | Unknown (save uses RPC) | Unknown | Unknown | Historical report query and `save_driver_advance_atomic` workflow. |
| `driver_pending_entries` | Unknown | Unknown; dashboard/approval/telemetry read | Unknown (driver submission RPC) | Unknown (approve/reject RPC) | Unknown | Queue/read plus submit/approve/reject/cancel RPCs. Role scoping is crucial because this contains driver-submitted pending records. |
| `driver_advances` | Unknown | Unknown | Unknown | Unknown | Unknown | Generated type only; no active frontend `.from()` access found. Reports use `driver_direct_advances` and trip fields instead. |
| `expenses` | Unknown | Unknown | Unknown | Unknown | Unknown | Generated type only; no active frontend `.from()` access found. |
| `fleet_tyres` | Unknown | Unknown; Workshop reads | Unknown (tyre lifecycle uses RPCs) | Unknown | Unknown | Operational reads; purchase/mount/unmount/retread/dispose actions use RPCs. |
| `tyre_tracking` | Unknown | Unknown | Unknown | Unknown | Unknown | Generated type only; no active frontend `.from()` call found. |
| `workshop_repairs` | Unknown | Cron service-role read | Unknown | Unknown | Unknown | Read only by the cron audit endpoint in active code. The service-role request bypasses RLS. No browser access found. |
| `workshop_spares_bills` | Unknown | Unknown; dashboard, reports and financials read | Unknown (bill create RPC) | Unknown | Unknown | Reads for analytics/reporting; create uses `create_workshop_bill_atomic`. |
| `pending_scans` | Unknown | Unknown; fuel/POD read pending records | Unknown; `UploadHub` directly inserts | Unknown; fuel module directly updates status | Unknown; POD closure directly deletes selected scan | Direct browser DML is present. UploadHub exists in source; current mount status should be verified separately. A broad authenticated policy could let users forge, alter, or delete another user’s pending document workflow. No local policy establishes ownership or role scope. |
| `destinations_freight_master` | Unknown | Unknown; trip/setup reads | Checked-in migration revokes direct INSERT/UPDATE/DELETE from `anon, authenticated` | Same | Same | Reads for selectors/setup; master write RPCs require SUPERADMIN. |
| `daily_ai_audits` | Unknown | Unknown; Insights reads | Cron service-role upsert | Cron service-role upsert may update existing conflict row | Unknown | Browser reads; cron writes with `service_role`, bypassing RLS. No direct browser DML found. |
| `system_settings` | Unknown | Unknown | Unknown | Unknown | Unknown | Generated type only; no active frontend table access found. |
| `adblue_logs` | Unknown | Unknown; Fuel module reads | Unknown (RPC) | Unknown (RPC) | Unknown (RPC) | Used by active code but missing from generated DB types. Writes call AdBlue RPCs. |
| `vendors` | Unknown | Unknown; Fuel/Setup read | Unknown (RPC) | Unknown (RPC) | Unknown | Used by active code but missing from generated DB types. Vendor write calls atomic vendor RPCs. |

### Known local table ACL evidence and policy gap

The master CRUD migration explicitly revokes direct write privileges on `vehicles`, `destinations_freight_master`, and `driver_bata_master` from `anon` and `authenticated`; corresponding CRUD is routed through guarded master RPCs. For `drivers`, it revokes direct UPDATE/DELETE and explicitly grants `INSERT` to `authenticated` to preserve TripForm's manual driver creation. None of these statements reveal whether RLS is enabled or which rows/columns the deployed policies permit. The effective access cannot be derived from ACL statements alone when RLS is involved.

The application never directly writes most transactional tables; their writes are RPC-mediated. This does not establish safety until each RPC's `EXECUTE` ACL, security mode, internal role checks, and RLS behavior are inspected.

## Role-to-table summary

This summary reflects code usage and local migration facts only. It is **not** proof of deployed database policy.

| Role | Tables | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|---|
| `SUPERADMIN` | Masters and operational tables surfaced in UI | UI requires reads for vehicles, drivers, trips, fuel, vendors, reports and masters; actual DB row scope unknown | Master writes through guarded RPCs; direct driver INSERT also available to authenticated principal | Master writes through guarded RPCs; other mutations through domain RPCs | Master RPCs have create/update only in checked-in migration; other deletes via domain RPCs |
| `ADMIN` | Operations, queue, fleet and reporting data | UI requires reads for operational tables; actual DB row scope unknown | Driver INSERT through `authenticated` ACL; other creates via RPC | Operational actions via RPC; direct row scope unknown | Some operational actions use RPC/direct pending scan delete; effective rights unknown |
| `VIEWER` | Dashboard, reports, financial views | UI renders broad report/analytics reads; actual DB row scope unknown | No UI entry action found; DB restrictions unknown | No UI entry action found; DB restrictions unknown | No UI entry action found; DB restrictions unknown |
| Driver portal session | `trips`, pending entries, fuel and session-relevant records | Session-specific RPCs intended to expose driver data; direct DB reads/policies unknown | Submission/start actions via RPC; authenticated table insert is not the driver PIN path | Session wrapper RPCs; direct table access unknown | Cancel/close actions via RPC; direct table access unknown |
| `anon` / unauthenticated | Driver session RPC surface and public pages | Effective table access unknown | Migration grants execution on two token/session-guarded driver wrapper RPCs; table access unknown | Same | Same |
| `service_role` | `vehicles`, `trips`, `diesel_fuel_logs`, `workshop_repairs`, `daily_ai_audits` in cron | Cron reads these tables | Upsert to `daily_ai_audits` | Upsert may update that audit row | No use found |

## RPC inventory and permissions

The application uses **44 distinct RPC names** in active source. The generated database types expose only a subset and omit many active calls. The checked-in migrations locally define/grant only the driver session wrappers and master CRUD functions; most business RPC definitions and their effective grants are absent. For those functions, SECURITY INVOKER/DEFINER, PUBLIC/anon/authenticated EXECUTE, internal role checks, search_path, and RLS bypass are **unknown**. Do not infer PostgreSQL defaults as deployed grants, because functions may predate these migrations or later grants may exist remotely.

| RPC / group | Definition and grant evidence in repository | Role check / privilege effect | Risk status |
|---|---|---|---|
| `close_driver_trip_session_atomic` | Migration defines SECURITY DEFINER; fixed `search_path = pg_catalog, public`; revoke from PUBLIC; grant EXECUTE to `anon, authenticated` | Resolves driver session token and checks driver assignment to trip before close operation | Intentional anonymous API boundary; security depends on resolver/session implementation and token entropy/expiry, which are not locally defined. |
| `record_driver_breakdown_session_atomic` | Migration defines SECURITY DEFINER; fixed search_path; revoke from PUBLIC; grant to `anon, authenticated` | Resolves session and verifies trip/driver/vehicle relationship before recording breakdown | Same; wrapper checks exist, underlying implementation needs deployed verification. |
| `close_driver_trip_atomic`, `record_driver_breakdown_atomic` (internal dependencies) | Migration revokes EXECUTE from PUBLIC, anon, authenticated | Intended to be callable only through guarded wrapper/privileged owner context | Locally restricted as intended; deployed ACL not confirmed. |
| `is_current_user_superadmin` | Migration defines SECURITY DEFINER with fixed search_path; revoke all from PUBLIC; grant authenticated | Checks auth email local-part against app_users.username with role `SUPERADMIN` | Role check exists; identity mapping is a design constraint to verify against deployed auth records. |
| `create_master_vehicle`, `update_master_vehicle`, `create_master_driver`, `update_master_driver`, `create_master_freight`, `update_master_freight`, `create_master_bata`, `update_master_bata` | SECURITY DEFINER; fixed search_path; revoke all EXECUTE from PUBLIC; grant authenticated | Each checks `is_current_user_superadmin()` before privileged master mutations | Guard present locally; DEFINER means these functions bypass caller RLS for operations they own. Must preserve guard and verify exact deployed body/grants. |
| `set_master_driver_pin` | SECURITY DEFINER; fixed search_path. Migration revokes EXECUTE from `anon`, grants to `authenticated`, but does **not** explicitly revoke from `PUBLIC` | Calls SUPERADMIN check before updating PIN hash; stores bcrypt hash and clears plaintext PIN | LOW hardening concern: migration does not establish that PUBLIC lost default/preexisting execute. The role check limits mutation; effective deployed privilege is unknown. |
| `create_dispatch_trip_atomic`, `dispatch_trip_atomic` | Active code calls `create_dispatch_trip_atomic`; no local definition found for either spelling | Dispatch mutates trip data; internal checks/mode unknown | High-priority verification required before certifying dispatch authorization. `dispatch_trip_atomic` was specifically requested but is absent from searched active code and checked-in migrations. |
| `close_pod_atomic`, `modify_trip_atomic`, `settle_driver_period_atomic`, `settle_and_close_trip` | `close_pod_atomic`, `modify_trip_atomic`, `settle_driver_period_atomic` are active calls; `settle_and_close_trip` appears in generated types but no active call. No local definitions/grants found | Privileged trip/financial mutations; mode/role validation unknown | Verification required; no claim of a defect without deployed bodies/grants. |
| `save_driver_advance_atomic`, `create_workshop_bill_atomic`, `update_trip_status_atomic`, `update_vehicle_status_atomic` | Active calls; no checked-in definitions/grants. `update_trip_status_atomic` also appears in generated types | Financial/workshop/status mutations; role checks unknown | Verification required. |
| Fuel RPCs: `get_vehicle_current_odometer`, `record_fuel_atomic`, `update_fuel_atomic`, `delete_fuel_atomic`, `update_adblue_atomic`, `record_adblue_credit_atomic`, `record_adblue_filling_atomic`, `delete_adblue_atomic` | Active calls; no checked-in definitions/grants. `get_vehicle_current_odometer` also used by TripForm | Read-only odometer plus fuel/AdBlue mutations; execution scope and validation unknown | Verification required, especially deletes/edits and whether vehicle/odometer ownership/status checks are server-side. |
| Approval/session RPCs: `approve_driver_fuel_atomic`, `reject_driver_pending_entry_atomic`, `get_driver_portal_data`, `get_driver_monthly_reports`, `authenticate_driver_session`, `start_driver_existing_trip_session_atomic`, `start_driver_draft_trip_session_atomic`, `submit_driver_fuel_pending_atomic`, `cancel_driver_pending_entry_atomic` | Active calls; no local definitions/grants except the two guarded close/breakdown wrappers above | Approval and driver-private data/actions; role/session checks unknown | High-priority verification because improper EXECUTE scope could permit cross-driver data access or unauthorized approvals. |
| Tyre RPCs: `create_tyre_purchase_atomic`, `unmount_tyre_to_store_atomic`, `mount_tyre_atomic`, `send_tyre_for_retread_atomic`, `complete_tyre_retread_atomic`, `dispose_tyre_atomic` | Active calls; no local definitions/grants | Privileged fleet/asset lifecycle writes; role checks and constraints unknown | Verification required. |
| Vendor RPCs: `create_vendor_atomic`, `update_vendor_atomic` | Active calls; no local definitions/grants | Master/vendor mutations; role checks unknown | Verification required. |
| Generated-types-only RPCs: `approve_driver_entry`, `get_monthly_pl_summary` | In `database.types.ts`; no active call or local function definition found | Unknown | Confirm whether deployed legacy endpoints should remain granted; revoke if obsolete only after dependency/deployment verification. |
| `view_corporate_fleet_retention` | Generated as a **view**, not an RPC; no active frontend call found | View grants/RLS behavior unknown; if backed by a SECURITY DEFINER view, underlying RLS semantics need review | Inspect view definition and grants in deployed catalogs. |

**RPC count note:** the 43 active names are enumerated above by groups. `dispatch_trip_atomic` and `settle_and_close_trip` were explicitly requested but are not active calls; the latter is type-only. `approve_driver_entry` and `get_monthly_pl_summary` are also type-only. `view_corporate_fleet_retention` is a typed view, not an RPC. The migration-only helper and internal functions are listed separately.

## `pending_scans` and manually inserted drivers

### Manually inserted driver exception

`TripForm.tsx` performs a direct insert into `drivers` for the manual-driver workflow, then calls `create_dispatch_trip_atomic`. The master security migration retains `GRANT INSERT ON public.drivers TO authenticated`; it revokes authenticated direct UPDATE/DELETE. The insert request sends driver identity/contact/license fields and does not set PIN credentials. This confirms the insert capability is used by current source and should not be removed without replacing the workflow. It does **not** prove the exception is appropriately scoped: the checked-in migration has no RLS policy, tenant/branch predicate, or column-level grant, and the UI role gate is not an authorization boundary. Verify deployed RLS `WITH CHECK`, permitted columns, and whether only authorized dispatch roles can insert. If policy is broad, route the insertion through a role-checked RPC or narrow grant/policy while preserving manual dispatch.

### Pending scans

`pending_scans` has browser-side direct INSERT (`UploadHub`), UPDATE (fuel processing), and DELETE (POD scan cleanup), in addition to SELECT. No local migration establishes row ownership, document-type constraints, state-transition rules, or role restrictions. Because scan records drive POD/fuel processing, an overly broad policy could allow forged documents, status tampering, or deleting another operator's pending scan. The actual risk depends on deployed policies and whether `UploadHub` is mounted. Inspect RLS `USING` and `WITH CHECK` for every command, and ideally enforce allowed status transitions/document ownership server-side. Do not treat the queue as report-only.

## Service-role usage and authorization path

Repository search found `SUPABASE_SERVICE_ROLE_KEY` and a service-role client only in `app/api/cron/audit/route.ts`. It is a server API route; no client component imports the privileged client and the variable is not a `NEXT_PUBLIC_*` key. The route checks a configured cron bearer secret using timing-safe comparison and has an ADMIN/SUPERADMIN authenticated fallback before constructing the service-role client. The route is exempted from generic session proxy interception and therefore depends on its own route-level authorization. Once authorized it reads fleet/trip/fuel/workshop data and upserts `daily_ai_audits`; service role bypasses RLS. This is a deliberately privileged surface, not evidence of a client bundle leak. Deployment must keep the secret server-only and ensure the scheduler sends the configured token. The admin fallback must continue to resolve the authenticated user/role correctly under deployed RLS. No secret values were read or printed.

## Deployed database comparison

**Status: not performed; tooling/evidence unavailable.** Local migration files cannot prove they are deployed. `audit/remote-public-schema.sql` is empty. No Supabase CLI, `psql`, or `pg_dump` executable/package was found; no database password was available in checked configuration. Local Supabase `.temp` metadata does not report deployed DDL/grants. Therefore:

- No local migration can be identified as applied or unapplied in production.
- Production policies present but absent locally cannot be enumerated.
- Production RPC definitions or grants cannot be compared.
- No assertion that production RLS is enabled/disabled is made.

Obtain a read-only production catalog export or authorized Supabase SQL Editor results. Include `pg_policies`, `pg_class.relrowsecurity/relforcerowsecurity`, table grants for `anon`, `authenticated`, and `service_role`, routine ACLs plus `prosecdef`/`proconfig`, view definitions/grants, and applied migration versions. Redact credentials and sensitive row data; catalog output should contain definitions and grants only.

## Findings by severity

### CRITICAL

**None proven from available repository evidence.** Production is unverified, so this is not a certification that no critical exposure exists.

### HIGH

**H1 — Production RLS and most privileged RPC grants cannot be verified.** The repository lacks table-policy definitions and definitions/grants for most active transaction and driver RPCs, and production catalog access was unavailable. The concrete impact is that the authorization boundary for trip, approval, settlement, fuel, workshop and driver-session mutations cannot be established. This is an assurance gap, not proof that any deployed policy is permissive. **Required action:** obtain the read-only deployed catalog snapshot before treating this priority as complete; compare every object with the matrix and test each principal in staging.

**H2 — `app_users` is fetched with `select('*')` although its generated row type includes `password`.** This is a confirmed over-fetch path in `SetupModule`; whether unprivileged users can invoke it/read rows depends on deployed RLS and the component's admin-facing navigation. If stored values contain credentials or hashes, any role permitted to query those rows receives the column in the browser response even though the UI only needs usernames/roles. **Recommended fix (after this audit, on explicit approval):** narrow query to the exact non-sensitive columns needed (for current rendering, verify whether `username`/`role` suffice) and verify the `app_users` SELECT policy. Do not expose credential fields to browser code.

### MEDIUM

**M1 — Authenticated direct `drivers` INSERT is table-wide in the checked-in grant.** The manual TripForm insert proves the capability is needed; however the migration grants the entire `INSERT` table privilege to the `authenticated` database role and does not define a narrow RLS `WITH CHECK` or column restriction. Frontend role gating can be bypassed by direct API calls. If deployed RLS permits broad inserts, any authenticated principal could create driver records. **Recommended fix:** preserve the workflow but verify/narrow deployed row policy and column grants, or use an authenticated dispatch-role RPC with validation. Only apply after confirming live policy and UX requirements.

**M2 — `pending_scans` direct browser DML has no local policy evidence.** Active source inserts, updates, deletes and reads rows that control operational queues. If deployed policy is permissive, authenticated users may forge, reclassify or remove another user's scan. **Recommended fix:** verify strict per-command RLS and `WITH CHECK`/`USING`, ownership, allowed document types/status transitions, and consider moving state transitions behind guarded RPCs. No change made because deployed policies are unknown.

### LOW

**L1 — `set_master_driver_pin` does not explicitly revoke `PUBLIC` EXECUTE.** The migration revokes from `anon` and grants to `authenticated` but omits `REVOKE ... FROM PUBLIC`; default or pre-existing PUBLIC ACL is therefore not excluded by this migration. The function body checks SUPERADMIN before changing the PIN, so no unauthorized mutation is proven. **Recommended fix:** verify deployed ACL; if PUBLIC execute is present, explicitly revoke from PUBLIC and anon, then grant authenticated. Confirm guard and fixed search_path remain intact.

**L2 — Generated database types drift from active schema/API usage.** `adblue_logs`, `vendors`, and many active RPCs are not represented in generated types; type-only functions/views do not correlate fully with actual source usage. Stale types weaken review quality and may mask permission/schema changes, but are not independently an access-control defect. **Recommended action:** regenerate types from the verified deployed schema after resolving migration drift.

### INFORMATIONAL

**I1 — Application roles are not database roles.** `ADMIN`, `SUPERADMIN`, and `VIEWER` are UI/domain values; Supabase requests usually execute as `authenticated` or `anon`. Only checked-in master RPCs and the cron route show explicit server-side app-role checks. Do not rely on hidden tabs or client checks to secure table/RPC access.

**I2 — Driver portal intentionally exposes two anonymous-executable session wrappers.** The migration revokes PUBLIC and grants `anon, authenticated`; wrappers validate a driver session and assignment before acting. This is an intentional design if token resolution is robust. Validate deployed function body, session token entropy/expiry/revocation, and underlying operation ACLs.

**I3 — Service-role key is only used in the protected server cron route.** No client-side occurrence/import was found. The route’s privileged use is explicit and guarded; keep credentials server-side and validate deployment secret configuration.

## Recommended verification/fix order

1. Capture production catalog state read-only; include RLS flags, policies, table ACLs, function ACLs and definitions, views, and applied migration versions. This closes the principal evidence gap.
2. Confirm `app_users` RLS and remove `password` from browser selection; determine whether password material remains in that table at all and whether it is hashed/legacy.
3. Verify `drivers` INSERT policy scope against authenticated principals and preserve TripForm manual driver flow while narrowing authorization/columns if needed.
4. Verify `pending_scans` policies for SELECT/INSERT/UPDATE/DELETE, including row ownership and permitted transitions; confirm UploadHub mount status.
5. For every active RPC, compare deployed definition and grants with expected callers. Explicitly review SECURITY DEFINER routines for role checks, fixed search_path, qualified object names, and PUBLIC/anon revocation.
6. Check `set_master_driver_pin` effective ACL; revoke PUBLIC if present while preserving authenticated SUPERADMIN guard.
7. Reconcile deployed migration history with the three checked-in migrations and investigate any production-only policy/function drift.
8. Regenerate `lib/database.types.ts` only from the agreed authoritative schema after drift review; document role and RPC contracts.

## Read-only validation and change record

At the start of this audit, `git status --short` showed pre-existing changes in application/UI files, cron/proxy/config files, numerous `.before-*` backups, and the untracked `audit/master-architecture-audit.md` from prior work. These are not changes made by this security audit and were left untouched. The requested report is the only new file from this task. Final `git status --short` and `git diff --check` are recorded in the task response. No migrations, RLS policies, RPCs, app code, backups, or deployment settings were modified. No commit or push was made.

