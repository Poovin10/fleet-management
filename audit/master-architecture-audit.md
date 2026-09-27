# KSS Roadways ERP — Master Architecture and UX Audit

**Audit type:** Read-only source review  
**Repository:** `C:/Users/unnik/kss-erp`  
**Branch:** `design/premium-ui-v2`  
**Audit date:** 2026-09-27  
**Permitted change:** This report only. Application source, Supabase schema/RPCs, and existing backup files were not changed.

## Executive assessment

KSS ERP has a recognizable fleet-operations model and good foundations: dispatch, POD, fuel, settlement and tyre actions use named atomic RPCs; the driver portal uses session-scoped RPCs; master writes have guarded RPCs; reports are centralized; vehicle state logic is shared in `lib/operationalState.ts`; and pagination, tables, buttons, overlays and modal patterns exist.

The architecture is not yet cleanly layered. The staff ERP is mainly one client-side dashboard with in-memory tabs, hidden role-based navigation, module-specific Supabase queries and client calculations. Historical reports are centralized, but dashboard, analytics and role-specific views repeat data and math. Several reads are capped at 200 or 1,000 records, then searched/paginated in-browser; older matches can be hidden. Only selected security migrations are checked in, so this repository cannot establish deployed RLS policies or the complete RPC contract.

Priorities: define route and role boundaries, establish one financial calculation contract, use server-side filtering/paging for historical data, consolidate dashboard telemetry, and keep operational queues distinct from reporting.

## Scope and method

The inventory covered 71 source units: 36 top-level TSX components, 12 shared UI TSX files, 11 app TSX route/layout files, 10 library TypeScript files and two API route handlers. Also inspected were `proxy.ts`, three checked-in Supabase migrations, package/config files, CSS primitives, import/render sites, Supabase reads/RPCs/mutations and schema snapshot references. Classification follows actual imports and behavior, not filenames alone.

This is a source-level audit, not a live deployment, browser, database, RLS or usability test. “Unused” means no active import/render path was found in the inspected tree; it does not rule out external consumers. Existing local modifications and `.before-*` files were treated as user state and not altered.

## 1. Application inventory and module map

| Module / component | Purpose | Class | Used? | Overlap / evidence | Recommendation |
|---|---|---|---|---|---|
| `app/page.tsx` + `components/dashboard.tsx` | Staff auth entry, role lookup, shell, tabs, status override and dashboard data | Shell / operational | Yes | Dashboard repeats `TelemetryHUD` data | Keep initially; split route/shell from modules and authorize server-side |
| `TelemetryHUD.tsx` | Live fleet state, month metrics, alerts and drilldown | Operations + analytics | Yes | Dashboard and unused telemetry hook repeat queries | Keep command centre; consolidate data source |
| `TripForm.tsx` | Dispatch, master matching, freight/Bata, odometer/load checks | Operational | Yes, admin-only | Shares trip fields/math with Modify Trips | Keep dispatch authority; extract common typed rules later |
| `PodClosure.tsx` | Pending trip selector, scan intake, shortage/weight/diesel/odo checks and closure | Operational queue + action | Yes, admin-only | Queue is required; popup-driven | Keep; never move live pending queue to Reports |
| `ModifyTrips.tsx` | Search/select existing trip, edit, `modify_trip_atomic` | Operational editing | Yes, admin-only | Shares trip schema with dispatch/Reports, distinct purpose | Keep; server-side search/page |
| `ApprovalQueue.tsx` | Driver submission approve/reject | Operational queue | Yes, admin-only | Action queue, now popup-driven | Keep; enforce rights in DB |
| Dashboard Quick Status | Supervisory status update via `update_vehicle_status_atomic` | Operational action | Yes | Can overlap trip/workshop status transitions | Keep only as explicit supervisor override; define transitions/reasons |
| `FuelAdvanceModule.tsx` | Diesel/AdBlue entry, scans, odometer checks and correction actions | Operational | Yes | Correction records also in Reports but have row actions | Keep; lazy-load correction lists, backend paging |
| `WorkshopModule.tsx` | Service bill entry and tyre store/mount/retread/dispose lifecycle | Operational + lifecycle | Yes | Bills in Reports; disposed tyre history is lifecycle context | Keep jobs/bills/tyre actions and mounted/store queues; bill history absent in current source |
| `DriverSettlementModule.tsx` | Driver/period load, Bata/advance/net calculation and atomic settlement | Operational finance action | Yes | Reports has settlement history | Keep; unify formula with Driver Portal and Reports |
| `AccountsModule.tsx` | Direct driver advance and petty expense entry | Operational entry | Yes | Historical records in Reports; expense uses workshop bill RPC | Keep; clarify accounting semantics and fix dead Workshop Ledger tab |
| `ReportsModule.tsx` | Historical filters, tables and CSV/Excel/PDF | Reporting | Yes | Eight categories listed below | Keep authoritative; server-side paging and clarify P&L |
| `FinancialsModule.tsx` | Fleet retention, variants, driver scorecard, unassigned-trip aggregation | Legitimate analytics | Yes | Same source tables and overlapping totals | Keep analytics/CSV; reconcile formulas |
| `ProfitLossModule.tsx` | Three-card revenue/expense/net view | Financial summary | Yes | Duplicates finance totals and P&L concept | Merge into Financials after formula reconciliation |
| `AiInsightsDashboard.tsx` + `/api/cron/audit` | Displays persisted deterministic audit results | Intelligence | Yes, Insights tab | Endpoint runs rules, not AI inference | Keep if useful; protect scheduler endpoint and label accurately |
| `SetupModule.tsx` | Vehicle, driver/PIN, freight/Bata, vendor CRUD and app-user listing | Configuration | Yes | Broad mixed admin concerns | Keep under Administration; split masters/users when latter has actual workflows |
| `DriverPortal.tsx` + `/driver` | Driver PIN/session, assigned trip actions, monthly statement | Role-specific operational/self-service | Yes | Statement data also appears in staff Reports but is driver-scoped | Keep separate; share authorized calculation/query contract |
| `FleetTable.tsx` | Live vehicle search/detail popup | Operational view | **No active mount** | Different purpose from historical Fleet report | Decide to mount as Fleet page/action or retire |
| `LiveAlertsWidget.tsx` | Expiry/recent activity notifications | Operational alerts | **Not rendered**, imported unused | TelemetryHUD has smaller alert set; widget polls independently | Unify rules or retire; do not simply mount broad polling |
| `Insights.tsx` | Distance/tonnage since fixed date | Analytics | **No active mount** | Overlaps Financials and has unbounded reads | Retire or redesign after KPI ownership decision |
| `UploadHub.tsx` | Manual document text parse and pending-scan insertion | Operational intake | **No active mount** | Fuel/POD consume scans but no active staff intake path found | Decide to mount under Operations or retire; secure before activation |
| `useFleetTelemetry.ts` | Dashboard telemetry hook | Shared data | **No active import** | Repeats dashboard/TelemetryHUD pipeline | Use as single source or remove after external-use check |
| `hero.tsx`, `login-form.tsx` | Starter UI / alternate login | Legacy UI | **No active references** | Login route is implemented directly | Candidate obsolete after consumer check |
| Capitalized `LogoutButton.tsx` | Alternate sign-out | Auth UI | **No active references** | Lowercase variant used by starter auth button | Candidate duplicate/dead after route cleanup |
| `components/ui/*` | Buttons, fields, table, menu, badge/card, paging, toolbar, tabs | Shared UI | Mixed; core used, TabBar/TableToolbar limited | CSS and inline variants coexist; toolbar bundles exports | Keep primitives, formalize patterns |
| `lib/supabase/*`, `database.types.ts` | Browser/server clients, auth refresh and DB types | Infrastructure | Yes | Broad `any` reduces typed contract value | Keep; use generated types in query/service layer |
| PDF/export helpers | PDF, CSV and Excel generation | Infrastructure | Yes | Different paths in Reports, analytics and driver statement | Keep; standardize mapping and formatting |
| `lib/operationalState.ts` | Normalize vehicle states, labels and colors | Domain helper | Yes | Good shared rule; writes elsewhere | Keep as interpretation authority; define server transitions |
| `/api/parse-document` | Local text parser | API | Indirect via unmounted UploadHub | `imageBase64` read but unused | Keep only if intake stays; bound payload/types |
| `/protected/*`, starter layout | Tutorial shell; page redirects to `/` | Legacy routing | No useful distinct ERP content | Layout says “Next.js Supabase Starter” | Replace after checking deep links |

### Navigation and effective access

One client dashboard owns in-memory staff tabs. `ADMIN`/`SUPERADMIN` see Dashboard, Operations, Fuel, Workshop & Tyres, Driver Settlement, Accounts, Reports, Fleet Analytics, P&L, Insights and Master. Other roles see Dashboard, Reports, Fleet Analytics, P&L and Insights. Operations (Dispatch, POD, Modify, Quick Status, Approvals) is hidden from other roles. That can be policy, but tab visibility is not database authorization.

`/` checks user server-side; `/driver` is excluded from session proxy because it uses driver PIN/session tokens. `/protected` redirects while its layout retains starter chrome. Auth routes include login, signup, confirm, reset/update, success and error.

## 2. Unused, legacy and overlapping modules

### Unmounted code units (8)

1. `FleetTable.tsx` — live vehicle detail picker.
2. `Insights.tsx` — distance/tonnage summary.
3. `LiveAlertsWidget.tsx` — imported by dashboard but never rendered.
4. `UploadHub.tsx` — manual document intake.
5. `hero.tsx` and `login-form.tsx` — no active references.
6. Capitalized `LogoutButton.tsx` — no active references; lowercase variant is used in starter auth button.
7. `lib/useFleetTelemetry.ts` — no active imports.

That is seven components plus one hook. Helpers referenced by `/protected/layout.tsx` are starter-only; the page redirects and they provide no useful current ERP content.

### Six overlap domains

| Overlap | Actual overlap | Legitimate distinction | Recommendation |
|---|---|---|---|
| Dashboard vs TelemetryHUD vs telemetry hook | Vehicle list/counts, pending counts, month totals | Current-state overview is valid; hook redundant | One typed/cached telemetry source |
| TelemetryHUD, Financials, ProfitLoss, Reports P&L | Freight/diesel/Bata/workshop values and totals | Snapshot, analytics, statement and detailed rows differ | One finance read/calculation model; distinct presentations |
| TripForm vs ModifyTrips | Trip fields, freight/fuel/driver concepts and some math | Dispatch versus editing an existing trip | Shared rules/types, separate tasks |
| Settlement vs Reports vs Driver Portal | Bata, advances, trip values | Period close, historical ledger and driver statement | One formula/query contract, audience-specific authorization |
| FleetTable vs Reports Fleet/Vehicle vs TelemetryHUD | Vehicle/status data | Live detail differs from master snapshot and KPIs | Mount as Fleet page or retire; Reports remains report surface |
| Fuel/Workshop/Accounts vs Reports | Operational records also appear in history | Entry, corrections and tyre actions are not reporting | Keep action pickers; Reports owns broad history/export |

No evidence supports merging dispatch, modify, POD, approval, fuel, workshop/tyre, Accounts entry, settlement action, Reports or Driver Portal into one workflow.

## 3. Authoritative workflow by domain

### Trips and POD

`TripForm` is dispatch authority and calls `create_dispatch_trip_atomic`; it reads the current odometer through `get_vehicle_current_odometer`. `ModifyTrips` edits a selected trip using `modify_trip_atomic`. `PodClosure` owns pending selection/closure via `close_pod_atomic`. Reports → Trips/POD owns history. Flow is sound, but navigation nesting obscures direct access and UI trip math/rules are repeated.

### Fuel and AdBlue

`FuelAdvanceModule` owns entry, correction and validation through dedicated atomic RPCs. `Reports → Diesel/Fuel` owns historical reporting. Separation is sound. Fuel/AdBlue records are prefetched (up to 200) before correction popups open; load on demand and page from Supabase.

### Bata, settlement and advances

Trip entry/edit owns trip Bata/advances; Accounts issues direct advances; Driver Settlement loads/closes a period; Driver Portal gives driver-scoped monthly statement; Reports exposes Bata/settlement history. Distinct audiences/tasks, repeated math. Centralize formula/data semantics while retaining access boundaries.

### Workshop and tyres

Workshop owns repair/service bill entry and tyre lifecycle. Mounted/store lists are operational queues. Tyre History is lifecycle lookup. Reports → Workshop owns bill transactions. Do not move tyre lifecycle to Reports or assume all workshop tables are duplicate reports.

### Accounts and P&L

Accounts owns new advances/expenses; Reports owns historical rows. Petty Expense currently calls workshop bill RPC, so clarify accounting semantics. Financials and ProfitLoss repeat totals; define one finance model before changing calculations.

## 4. Operational, picker, historical and analytics lists

| Class | Lists and controls | Assessment |
|---|---|---|
| **A — operational, remain accessible** | Mounted tyres; in-store/retreading tyres; pending fuel slips; fuel/AdBlue forms; POD form after selection; dispatch/edit forms; current settlement totals; dashboard fleet status/alerts; master CRUD | Immediate work/current decision. Keep outside Reports. |
| **B — operational picker/popup** | Pending POD selector; approval queue; Modify Trips selector; Fleet detail if activated; fuel/AdBlue correction lists; disposed Tyre History | Several already use popup/search/paging. Fuel lists should be fetched on demand; Fleet picker is unreachable today. |
| **C — historical/reporting** | Eight Reports categories, filters/exports; trip/fuel/workshop/settlement/advance history | Reports is primary. 1,000-row cap/client filtering may hide older matches; page server-side. |
| **D — analytics** | Fleet retention/variant benchmarks; driver scorecard; unassigned aggregation; current dashboard metrics; deterministic AI audit | Keep outside transaction Reports when useful; reconcile formulas/windows and label rules accurately. |

### Remaining report/UI issues

- Reports centrally provides date/search/status, ten-row display paging and CSV/Excel/PDF. Queries cap at 1,000; some search runs in JS, so older matches may be absent.
- Fuel/AdBlue correction lists are operational because they have edit/delete actions. Do not remove as duplicate reports; avoid fetching before the picker opens.
- Workshop bill history is absent from current component; disposed tyre history remains.
- Driver Portal monthly PDF is scoped to the logged-in driver; retain as self-service, backed by its session RPC.
- Financials vehicle/driver tables are analytical rankings, not ledgers; retain search/paging and analytics CSV.
- `ProfitLossModule` loads all trip/fuel/workshop rows from fixed `2026-09-01` and uses `total_bill_amount`, while TelemetryHUD/Financials use `bill_amount`. Verify deployed field contract before trusting totals.
- Reports → Financial/P&L returns trip-oriented detail rows; it does not appear to combine fuel/workshop transactions into a consolidated statement. Clarify or implement a reconciled statement.
- Accounts offers “Workshop Ledger,” but state/body supports only Advances and Petty Expenses. Selecting the third tab leaves no content: confirmed defect.
- TripForm and ModifyTrips each have a large multi-field form, but create and edit are distinct actions.

## 5. Duplicate exports

| Location | Type | Data | Assessment |
|---|---|---|---|
| `ReportsModule.tsx` | CSV, Excel, PDF | Selected historical category and filters | Central exports; retain |
| `FinancialsModule.tsx` | CSV | Aggregated fleet analytics or driver scorecard | Legitimate analytics export; retain, show date range |
| `DriverPortal.tsx` | PDF | Authenticated driver’s monthly statement | Legitimate self-service; retain with scoped calculation |
| `components/ui/TableToolbar.tsx` | CSV, Excel | Passed table data | Only Workshop consumer found; appears mounted tyre inventory, not workshop bill history. Label as operational inventory export. |
| `WorkshopModule.tsx` | CSV | Mounted tyre inventory/lifetime KM | Operational inventory export, not bill report; retain if used |
| `FuelAdvanceModule.tsx` | None for fuel/AdBlue history | — | No duplicate historical export found |

Do not remove analytics CSV or driver statement just because they reuse facts from Reports.

## 6. Dashboard architecture

TelemetryHUD broadly answers “what is happening now?” with fleet state, pending POD/approval, current-month metrics, alerts and drilldown. Keep status, attention and links to operational queues. Keep historical transactions and entry forms out of Dashboard.

Concerns:

1. `dashboard.tsx` fetches vehicles, counts and finance; `TelemetryHUD` refetches similar data; unused `useFleetTelemetry` repeats the pipeline. Outer dashboard fetches again on tab/subtab changes.
2. `FleetTable` is unmounted, while TelemetryHUD has a status drilldown. Decide on a dedicated live Fleet page/action.
3. `LiveAlertsWidget` is imported but not rendered. It polls broad vehicle/driver/trip/fuel data every 30 seconds and duplicates expiry logic. Unify rules before mounting.
4. Outer dashboard uses fixed `2026-09-01`; TelemetryHUD uses current calendar month, so totals can disagree.
5. Dashboard owns auth role lookup, shell/navigation, logout, quick status and module mounting. Split responsibilities gradually.

## 7. Reports architecture

Keep eight central categories and shared filters/exports. Operational queues stay in operational modules; broad history/export stays in Reports; rankings stay in Financials; current attention stays on Dashboard.

Next decisions: server-side paging/order/count; same date scope across trip/fuel/workshop/direct advances in finance reports; define Driver Bata versus Settlement semantics; define Fleet/Vehicle as current master snapshot or actual historical status ledger; separate consolidated P&L from detail rows.

## 8. Component and design-system audit

### Strengths

- Shared `table.tsx`, `Pagination.tsx`, `usePagination.ts`, button/input/select/badge primitives.
- `globals.css` centralizes dark tokens, semantic status colors, surface levels, radius/shadows, reduced motion, glass sheets and responsive rules.
- `ConfirmModal`, `AlertModal`, `kss-glass-overlay`, `kss-glass-sheet` are reused.
- Reports, approval, trip/POD selectors, fleet detail and tyre history use search/pagination.

### Inconsistencies

- Dialogs mix `kss-glass-sheet` and raw `liquid-glass` with differing height, close, ARIA and scroll behavior. Standardize accessible Dialog/Sheet with focus trap, Escape, focus restore, scroll lock and phone sizing.
- `liquid-glass`, `kss-surface`, `kss-panel`, `kss-surface-raised`, `input-glass` mix tiers and overrides. Reserve blur for shell/backdrop/sheet; use opaque high-contrast surfaces for forms/data.
- Tables share cells but set widths/sticky headers locally; wide lists scroll on phones. Use record cards for action lists.
- Button primitive exists, but raw buttons and tiny inconsistent labels remain. Standardize hierarchy and readable labels.
- Headers, filter bars, empty/loading/error states and summaries are inline. `TableToolbar` couples search to exports.
- Nested glass adds blur/borders without clear hierarchy; forms need clearer grouping and validation feedback.

### Eight reusable building blocks

1. PageHeader with title/description/action/breadcrumbs.
2. KPI/status strip with semantic colors and “as of” time.
3. Accessible Dialog and Sheet using current CSS.
4. Search/filter bar independent of exports.
5. Server-backed responsive data table/list with loading/empty/error states.
6. Typed server query paging/filter/date helpers.
7. Report-only export actions and output mapping.
8. Shared status badge, confirmation, feedback and field errors.

## 9. Business-logic duplication

| Rule family | Current locations | Finding | Recommendation |
|---|---|---|---|
| Fleet state | `operationalState.ts`, TelemetryHUD, dashboard, FleetTable | Shared helper is good; transitions/writes remain distributed | Keep helper authoritative; define server transition contract |
| Financial totals | Dashboard, TelemetryHUD, Financials, ProfitLoss, Reports | Multiple windows/formulas; workshop field mismatch risk | One typed finance model with explicit date and inclusion rules |
| Freight/Bata | TripForm, ModifyTrips, Reports/analytics | Dispatch matches master; edit recomputes freight; reports aggregate stored values | Shared typed matching/calculation functions; retain atomic persistence |
| Settlement | DriverSettlement, DriverPortal, Reports | Bata, halt, trip/direct advances aggregated separately | One formula/query contract with audience-specific authorization |
| Fuel/cost | FuelAdvance, TripForm, ModifyTrips, ApprovalQueue, analytics | Cost rounding/estimate/linked trip values computed separately | Centralize currency/category rules; RPC validates persisted amount |
| Odometer/shortage | TripForm, Fuel/AdBlue, DriverPortal, POD, tyre lifecycle | Client preflight rules repeat; DB must remain authority | Document invariant, centralize DB rule, keep UI preflight |

When authorized, organize under `lib/domain`, `lib/calculations`, `lib/validators`, `lib/queries`, and `lib/services`. Reconcile extracted rules with SQL first.

## 10. Supabase, database, RPC and performance review

### Existing patterns

Active RPC mutations include `create_dispatch_trip_atomic`, `modify_trip_atomic`, `close_pod_atomic`, diesel/AdBlue record/update/delete, workshop bill and tyre lifecycle operations, `settle_driver_period_atomic`, approve/reject, guarded master CRUD and `update_vehicle_status_atomic`.

Direct-write exceptions in UI: driver insert from TripForm; pending scan insert from UploadHub; pending scan status update from Fuel; pending scan delete from POD. Confirm RLS and prefer narrow atomic RPCs for workflow transitions where appropriate.

Reads are issued in client components; many use `select('*')`. Reports, Financials, ProfitLoss, Fuel, Workshop and ModifyTrips cap at 200/1,000 then filter/page locally; Workshop tyre and master lists lack explicit caps; POD and approval fetch all pending rows. Use narrow projections, server filters and paging. Financials repeatedly filters each full collection per vehicle/driver, causing avoidable repeated work. Dashboard/Telemetry duplicate requests and refreshes.

### Checked-in DB source boundary

Three migrations exist: driver session wrappers, master CRUD security, superadmin driver PIN. Driver wrappers resolve session, lock/check assigned trip, delegate internal actions and revoke direct access to underlying operations. Master RPCs use `SECURITY DEFINER`, fixed search path and superadmin predicate. PIN mutation checks that predicate.

Complete schema/RLS/functions are not represented by these migrations. Generated types do not prove deployed policies. This audit cannot confirm all read grants, RPC implementations, `resolve_driver_session`, driver auth/portal/month-report functions or accounting RPC behavior. Verify deployed Supabase before implementation.

### API endpoints

- `/api/cron/audit` creates a service-role client, reads fleet/trip/fuel/repair data, upserts `daily_ai_audits`, returns details. No cron-secret/signature/admin check appears. Proxy authentication blocks anonymous users, not ordinary signed-in users. **High priority:** scheduler-specific auth and minimal response.
- `/api/parse-document` parses supplied text; `imageBase64` is unused. Proxy requires staff auth except `/driver`, but handler has no visible body-size/type/rate validation. Bound requests.
- No service-role key use was found in client code. Browser anon keys are expected; RLS is the actual data boundary.

## 11. Security findings

1. **High:** service-role audit API lacks cron-specific authorization; signed-in users appear able to call it.
2. **High:** frontend role checks only hide tabs. Verify deployed RLS/function guards for every role/write, especially approvals, settlement, status, masters and driver data.
3. **Medium/high:** authenticated driver insert remains for TripForm manual-driver entry by migration exception. Verify remaining policy is narrow; prefer dispatch-scoped RPC while preserving the feature.
4. **Medium:** direct pending-scan mutations need type/status/ownership checks and constrained transitions.
5. **Medium:** driver PIN/session internals are not fully represented in checked-in migrations. Verify hashing, rate/lockout, token entropy/expiry/revocation, assignment checks and storage; review local-storage token usage in full DriverPortal flow.
6. **Low/medium:** parser should limit request size/document types, avoid sensitive-input reflection and rate-limit as needed.

## 12. Routing and recommended sidebar

The single shell can remain during first cleanup. URL routes improve history, deep links, refresh, permission boundaries, loading/error isolation and code splitting. Wrap existing components as route bodies first.

### Recommended routes

```text
/dashboard
/operations/dispatch
/operations/pod
/operations/modify-trips
/operations/approvals
/operations/quick-status
/operations/driver-settlement
/fleet                         live fleet/compliance
/fleet/fuel                    Diesel and AdBlue
/fleet/workshop                repairs/service jobs
/fleet/tyres                   separate only if volume warrants
/finance/accounts
/finance/analytics
/finance/p-and-l                one reconciled statement
/reports
/intelligence
/admin/masters
/admin/users                   when actual user/role workflows exist
/driver
/auth/*
```

### Sidebar structure and rationale

- **Command:** Dashboard — current state and attention.
- **Operations:** Dispatch, POD, Modify Trips, Approvals, Driver Settlement — trip and settlement lifecycle.
- **Fleet:** Live Fleet, Fuel & AdBlue, Workshop; Tyres nested under Workshop unless it merits separate route.
- **Finance:** Accounts, Financial Analytics, P&L — entry, analysis, statement.
- **Reports:** Reports — cross-domain history/export.
- **Intelligence:** Insights only if distinct and labeled deterministic vs AI.
- **Administration:** Masters, Users/Roles, Settings; Setup has user listing but no evident separate user CRUD.

No evidence supports removing operational functions. Merge P&L view into Financials after reconciliation; mount or retire unused fleet/alert/intake capabilities only after product decision.

## 13. Responsive, visual and performance assessment

CSS includes responsive glass sheets, reduced-motion rules, responsive grids and overflow wrappers. This is a good base but not proof of device behavior. Tables with 560–760px minimum widths need horizontal scroll; acceptable for detail pickers, while action lists should use compact mobile cards. Forms need one-column phone flow, clear errors, keyboard use and safe-area-aware sticky actions where useful.

Glass tokens exist but blur appears on nested content. Keep ambient glass on shell/backdrop/sheet; use opaque surfaces for tables/forms. Dialogs should fit dynamic viewport and support focus, Escape, focus restore and reduced motion.

Performance priorities: server-side paging, narrow selects, lazy correction pickers, aggregate once, deduplicate telemetry and refresh only when needed. Avoid repeated broad 15/30-second queries without a measured live requirement; use explicit invalidation or bounded realtime.

## 14. Final recommendations

### A. KEEP

Dispatch, POD, Modify Trips, approvals, fuel/AdBlue, workshop/tyre lifecycle, settlement action, Accounts entry, centralized Reports, genuine fleet analytics, Driver Portal, shared status helper, UI primitives and export utilities.

### B. MERGE

- Merge ProfitLossModule into Financials as its P&L view after formula/field reconciliation; keep transaction detail Reports distinct.
- Consolidate dashboard shell, TelemetryHUD and unused telemetry hook into one current-state query boundary.
- Do not merge distinct operational actions just because they use the same table.

### C. REMOVE — only after ownership check

Eight unmounted code units in §2 are candidates. Fleet detail, document intake and alerts may be unfinished product requirements; decide mount or retire before deletion. Replace stale `/protected` starter chrome after deep-link review. Do not delete `.before-*` backups as part of this plan.

### D. MOVE

Masters under Administration; live Fleet detail under Fleet or a Dashboard action; broad historical search/export in Reports; driver monthly statement stays in Driver Portal with shared authorized calculation.

### E. REFACTOR

Dashboard role/fetch responsibilities; Reports query paging/P&L semantics; finance formula ownership; shared TripForm/ModifyTrips rules; Accounts invalid tab and expense semantics; lazy Fuel/Workshop correction lists; Setup master/user split; Driver Portal session/read model.

### F. REUSABLE COMPONENTS

Formalize eight blocks in §8: PageHeader, KPI/status strip, accessible Dialog/Sheet, independent search/filter bar, responsive data list, server paging/query helper, report-only export actions, shared badges/confirmation/feedback/field errors.

### G. ROUTING PLAN

Adopt §12 route map gradually around existing module bodies; keep shell until auth and loading boundaries are dependable.

### H. SIDEBAR PLAN

Command → Operations → Fleet → Finance → Reports → Intelligence → Administration. Derive visibility from capabilities, but never treat navigation as authorization.

### I. DESIGN SYSTEM PLAN

Document surface tiers; standardize headers, buttons, fields, errors, badges, empty/loading states, accessible glass dialogs, responsive lists and focus behavior. Blur only shell/backdrop/sheet.

### J. BUSINESS LOGIC PLAN

Document formulas, extract typed pure calculations/validators and query/service wrappers, preserve RPC as atomic state authority, and compare every extracted rule with SQL.

### K. DATABASE/RPC PLAN

Inventory deployed schema, RLS, grants and RPC definitions/signatures before code changes. Contract-check roles, driver sessions, odometer, settlement and status transitions. Scope direct writes. No database changes are authorized by this audit.

### L. IMPLEMENTATION ORDER

1. Architecture cleanup: decide unmounted capabilities; repair Accounts tab; define ownership and role matrix.
2. Route/page structure around existing workflows.
3. Shared design system: accessible dialogs/sheets, headers, validation and responsive lists.
4. Dashboard: one current-state source, consistent windows and action links.
5. Operational modules: preserve RPCs; lazy action pickers; backend search/page.
6. Reports: server paging and reconciled categories/formulas.
7. Administration: master/user separation; verify superadmin mapping.
8. Responsive UX across desktop/tablet/phone/keyboard.
9. Performance: narrow reads, aggregate once, invalidate after writes, review query plans/indexes.
10. Final role/RPC QA, finance reconciliation, type/lint/build and manual workflows.

## TOP 10 PRIORITY CHANGES

1. Add scheduler-specific authorization to `/api/cron/audit`; a service-role route must not be callable by every signed-in user.
2. Verify deployed RLS and RPC grants for every role; client tab hiding is not access control.
3. Define one P&L formula/date window across Dashboard, Financials, P&L and Reports.
4. Replace capped client historical search with server-side filtering and paging.
5. Consolidate dashboard, TelemetryHUD and unused telemetry-hook queries.
6. Verify driver insert and pending-scan policies; preserve manual dispatch driver entry safely.
7. Fix Accounts’ nonfunctional Workshop Ledger tab and clarify petty-expense storage semantics.
8. Align settlement action, driver statement, Driver Bata report and direct-advance filters.
9. Decide to mount or retire the eight unmounted code units; do not delete speculatively.
10. Standardize accessible responsive dialogs/forms/tables and reduce nested blur/fixed-width mobile lists.

## DO NOT TOUCH YET

- Do not change Supabase schema, deployed RLS or RPC signatures/bodies as part of UI cleanup.
- Do not alter POD close, settlement, dispatch, fuel, AdBlue, workshop bill, tyre, approval or odometer rules before comparing to deployed RPC contracts.
- Do not remove mounted/store/retreading tyres, pending PODs, pending approvals, pending fuel scans, settlement action, or manual dispatch driver creation because they look like lists/history.
- Do not delete unmounted capabilities before product ownership decides mount versus retire.
- Do not merge Driver Portal into staff Reports; maintain driver-scoped authorization.
- Do not remove Fleet Analytics or its CSV; preserve analysis while unifying math.
- Do not trust totals until `bill_amount`/`total_bill_amount`, date windows and expense categories are reconciled with the actual database.
- Do not modify/delete `.before-*` backups or other pre-existing repository changes.

## Audit counts

Definitions: source units are those counted in Scope; active modules are distinct staff/driver workflows in the module map, excluding auth/shared UI; unused count is seven components plus one hook; overlap count is the six domains in §2. “Merge” means Financials and P&L become one product area. Removal count is a candidate count pending product ownership confirmation.

```text
ARCHITECTURE AUDIT COMPLETE

Modules reviewed: 71 source units (36 components, 12 UI, 11 app TSX, 10 lib TS, 2 API routes)
Active modules: 16 staff/driver workflows
Unused modules: 8 code units
Duplicate/overlapping modules: 6 overlap domains
Modules recommended for merge: 2 (Financials + P&L)
Modules recommended for removal: 8 candidates, pending ownership decision
Modules recommended for refactor: 10 module/workflow clusters
Reusable components identified: 8
Routing improvements: 7 navigation groups / route areas
Business-logic duplication findings: 6 rule families
Database/RPC findings: 7
Security findings: 6
```
