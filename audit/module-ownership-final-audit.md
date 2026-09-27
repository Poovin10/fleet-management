# KSS ERP — Final Module Ownership Audit

**Repository:** `C:\Users\unnik\kss-erp`  
**Branch:** `design/premium-ui-v2`  
**Audit date:** 2026-09-27  
**Scope:** Read-only source and checked-in migration review. This report does not claim production database behavior unless explicitly stated.

## Executive Summary

**FACT:** The active ERP is a single authenticated dashboard shell mounted at `/`, with separate driver self-service at `/driver`. The shell mounts distinct dispatch, trip edit, POD close, approval, fuel, workshop/tyre, driver settlement, Accounts entry, reporting, fleet analytics, P&L, insights and master-data views. `ReportsModule` is the common read-only historical report surface for eight categories.

**FACT:** Most important module boundaries are valid and operationally meaningful: dispatch creates a trip; Modify Trips edits an existing trip; POD closes a trip; fuel performs vehicle-specific fuel actions; Workshop owns repair/tyre lifecycle actions; Settlement calculates and closes driver periods. Their report-like historical data has largely been removed or centralized, while action queues and pickers remain operational.

**FACT:** The material unresolved overlap is Accounts Petty Expense and Workshop Service Bill: both call `create_workshop_bill_atomic`, but their inputs have different meanings and checked-in source does not define the RPC. The deployed RPC destination, safeguards and semantics are **not verified**. Do not merge or remove either path on this evidence.

**FACT:** Financial summaries overlap across `TelemetryHUD`, `FinancialsModule`, `ProfitLossModule`, the legacy state/query logic in `dashboard.tsx`, and Reports’ trip-level Financial/P&L dataset. These are not equivalent views: their date windows, cost definitions, aggregation level and data sources differ. Reconcile the accounting definition before deciding whether to merge the two financial navigation entries.

**FACT:** `FleetTable`, `Insights`, `UploadHub`, and `lib/useFleetTelemetry.ts` have no active import/render call sites in the inspected source tree. `LiveAlertsWidget` is imported by the dashboard but never rendered. This establishes that these code units are currently unmounted; it does not establish whether their capability is unwanted or externally expected.

**RECOMMENDATION:** Keep operation, entry/control, reporting, analytics, master data and system administration as distinct ownership areas. Simplify navigation by grouping them, not by collapsing their business workflows. Resolve Petty Expense RPC ownership, reconcile financial calculations, and confirm unmounted functionality with its owner before any removal or reactivation.

## Module Ownership Matrix

`Mounted?` and confidence refer to current repository references, not production usage. “Transactions” distinguishes creation/editing from read-only display. For RPC destination details, see the listed source and the related audit where indicated.

| Module | Primary Category | Main Purpose | Main data / RPC evidence | Creates / edits transactions | Historical data | Analytics | Duplicate/Overlap | Future Ownership | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| Dashboard shell (`dashboard.tsx`) | D — Analytics/monitoring | Authenticated shell, navigation, Quick Status action | `vehicles`, `trips`, `driver_pending_entries`; `update_vehicle_status_atomic` | Edits vehicle status in Quick Status | No report table; contains unused legacy fetch state | Yes, delegates visible command center to TelemetryHUD | Legacy unused financial query/state overlaps TelemetryHUD | Keep shell/navigation; retain Quick Status as an operational action or link | High |
| TelemetryHUD | D — Analytics/monitoring | Live fleet status, operational alerts, current-month KPIs | `vehicles`, `trips`, `driver_pending_entries`, `drivers`, `diesel_fuel_logs`, `workshop_spares_bills` | No transaction creation | Recent alert/operational summaries, not a ledger | Yes | Financial totals overlap Financials/P&L and dashboard legacy calculation | Keep as current command center; align KPI definitions after financial reconciliation | High |
| TripForm | A — Operational workflow | Dispatch / create trip | `trips`, `vehicles`, `drivers`, freight/bata masters; `create_dispatch_trip_atomic`, `get_vehicle_current_odometer`; direct `drivers` insert for manual driver | Creates trip; contextual manual driver insert | Uses master/suggestion data, not a trip report | Calculates dispatch values | Overlaps Modify Trips on trip fields; driver create overlaps Setup master CRUD | Keep dispatch separate from editing; consider contextual driver quick-create link/shared validation | High |
| ModifyTrips | A — Operational workflow | Search/select and modify an existing trip | `trips`, `vehicles`, `drivers`; `modify_trip_atomic` | Edits existing trip | Search picker only; not a report | No | Same trip domain as TripForm, but distinct create vs edit responsibility | Keep separate workflow, nested under Operations | High |
| PodClosure | A — Operational workflow | Select pending trip and close POD | `trips`, `vehicles`, `drivers`, `diesel_fuel_logs`, `pending_scans`; `close_pod_atomic` | Closes trip/POD; removes applied scan records | Pending POD and scan queues are actionable | Calculates closure validations/amounts | POD history appears in Reports, but queue is operational | Keep closure workflow; Reports owns historical POD reporting | High |
| ApprovalQueue | F — System/administration | Review pending driver requests, approve/acknowledge/reject | `driver_pending_entries`, `vehicles`, fuel-rate lookup; `approve_driver_fuel_atomic`, `reject_driver_pending_entry_atomic` | Changes pending request state / approval outcome | Pending queue only | No | Related to DriverPortal request creation and Fuel issue, but distinct approval control | Keep as an access-controlled workflow; group under Operations or Control Center | High |
| FuelAdvanceModule | A — Operational workflow | Diesel issue/edit/delete, AdBlue entry, fuel slip handling | `diesel_fuel_logs`, `adblue_logs`, `vehicles`, `vendors`, `pending_scans`; `record_fuel_atomic`, `update_fuel_atomic`, `delete_fuel_atomic` and other visible fuel RPC calls | Creates/edits/deletes fuel records; processes fuel slips | Action-driven existing-record search, not a broad report | Validates odometer/KMPL/vehicle fuel workflow | Fuel history is in Reports; DriverPortal submits fuel requests for approval | Keep Fuel/AdBlue operational entry and corrections; Reports owns broad history | High |
| WorkshopModule | A — Operational workflow | Service bill entry and tyre lifecycle actions | `fleet_tyres`, `tyre_tracking`, `workshop_spares_bills`, `vehicles`, `vendors`; `create_workshop_bill_atomic`, tyre purchase/mount/unmount/retread/dispose RPCs | Creates service bills / tyre purchase; updates tyre lifecycle | Disposed tyre history popup; active mounted/in-store lists | No general analytics | Bill history is Reports-owned; Accounts Petty Expense shares bill RPC unresolved | Keep repair/bill entry and tyre actions; preserve disposed tyre history if operationally needed; define tyre-history reporting owner | High |
| DriverSettlementModule | A — Operational workflow | Calculate and mark a driver period settled | `drivers`, `trips`, `driver_direct_advances`; `settle_driver_period_atomic` | Marks settlement period settled | Current period review only | Calculates settlement amount | Reports has settlement history; DriverPortal has a driver-specific ledger | Keep settlement action; Reports owns central history; retain portal’s audience-specific statement | High |
| DriverPortal (`/driver`) | A — Operational workflow | Driver authentication, trip status actions, fuel/breakdown submissions and personal ledger | RPCs include `authenticate_driver_session`, `get_driver_portal_data`, `get_driver_monthly_reports`, trip-session actions, fuel pending submission, `update_trip_status_atomic`, cancellation | Creates pending requests; updates trip/session status | Current-month driver-specific ledger and PDF/CSV statement | No fleet-level analytics | Overlaps settlement/report data, but serves a separate driver audience and request workflow | Keep separate driver surface; ensure all access remains session/RPC scoped | High |
| AccountsModule | B — Accounts/financial entry | Direct driver advance and Petty Expense entry through focused New Entry | `drivers`, `vehicles`; `save_driver_advance_atomic`, `create_workshop_bill_atomic` | Creates advance and petty-expense-labeled record | No historical ledger/export | No | Petty Expense shares RPC with Workshop service bill; destination unknown | Keep limited verified entry workspace; resolve shared RPC/business ownership before changing Petty Expense | High for UI; low for Petty destination |
| ReportsModule | C — Historical reporting | Search, filter, paginate and export historical datasets | `trips`, `diesel_fuel_logs`, `driver_direct_advances`, `workshop_spares_bills`, vehicle/driver joins; no mutating RPC | No | Yes: Trips, POD, Diesel/Fuel, Driver Bata, Driver Settlement, Workshop, Fleet/Vehicle, Financial/P&L | Limited summaries accompany reports | Some personalized statement data also exists in DriverPortal; reports remain central staff reporting | Keep the single central historical/report/export surface; add verified gaps such as tyre lifecycle only if required | High |
| FinancialsModule (nav “Fleet Analytics”) | D — Analytics/monitoring | Fleet retention, vehicle benchmarks, driver scorecard, unassigned aggregation | `vehicles`, `drivers`, `trips`, `diesel_fuel_logs`, `workshop_spares_bills` | No | Aggregated historical inputs, not transaction ledger | Yes | Retention/KMPL and cost rollups overlap TelemetryHUD and P&L; cost field discrepancy recorded in P&L audit | Keep analytical purpose; reconcile formulas and attribution, then consider a Financial Management section | High |
| ProfitLossModule (nav “P&L Statement”) | C — Historical reporting | Aggregate freight, fuel, bata/halt and workshop costs into a statement | `trips`, `diesel_fuel_logs`, `workshop_spares_bills` | No | Yes, aggregate statement from baseline date | Financial summary | Overlaps analytics and Reports’ trip-level Financial/P&L, but is a different aggregation | Keep the statement function; place with Financial Management after accounting definition is approved | High |
| SetupModule | E — Master data/configuration | CRUD for vehicles, drivers, vendors, freight and bata rules; app_users list | `vehicles`, `drivers`, `vendors`, `destinations_freight_master`, `driver_bata_master`, `app_users`; `create/update_master_vehicle`, `create/update_master_driver`, `set_master_driver_pin`, freight/bata/vendor RPCs | Creates/edits master records | Master lists, not historical transaction report | No | Driver creation overlaps TripForm contextual manual driver insert; app_users is loaded but no user-management action evidenced | Keep as master-data workspace; confirm whether user administration is intended or separate | High |
| AiInsightsDashboard (nav “Insights”) | D — Analytics/monitoring | Show latest AI/fleet audit and allow manual audit trigger | `daily_ai_audits`; fetches `/api/cron/audit` | Triggers audit process, not financial transaction | Shows latest audit output | Yes | Insight domain overlaps Financials/Telemetry, but audit findings are a distinct generated monitoring view | Keep if daily audit is a supported product capability; separate scheduled/system action from manual user trigger policy | High |
| FleetTable (`components/FleetTable.tsx`) | A — Operational workflow (unmounted) | Searchable live vehicle details popup | `vehicles` | No | Live master/operational vehicle list | Status summary only | Concept overlaps TelemetryHUD live fleet; no active mount found | Confirm product owner need; if retained, make it the detailed Fleet view linked from command center | Medium |
| Insights (`components/Insights.tsx`) | D — Analytics/monitoring (unmounted) | Distance and tonnage summary since fixed baseline | `trips`, `diesel_fuel_logs` | No | Aggregated historical data | Yes | Overlaps active Financials/AI insights; no active mount found | Confirm whether obsolete prototype or intended lightweight analytics before disposition | Medium |
| LiveAlertsWidget (`components/LiveAlertsWidget.tsx`) | D — Analytics/monitoring (unmounted) | Expiry/trip/fuel notifications | `vehicles`, `drivers`, `trips`, `diesel_fuel_logs` | No | Recent event snippets | Monitoring | Overlaps TelemetryHUD live alerts; dashboard imports it but does not render it | Choose one alert source if this capability is revived; no removal decision here | High for unrendered status |
| UploadHub (`components/UploadHub.tsx`) | F — System/administration (unmounted) | Manual OCR text intake into pending scan queue | `/api/parse-document`, `pending_scans` insert | Creates pending scan record | Pending intake payload | No | Its consumers are POD/Fuel pending-scan handling; no active route/mount found | Confirm scan-ingestion product workflow and then mount behind appropriate role/access controls or retire by approved decision | Medium |
| `lib/useFleetTelemetry.ts` | D — Analytics/monitoring helper (unreferenced) | Shared telemetry fetch hook | `vehicles`, `trips`, `diesel_fuel_logs` (from hook implementation) | No | KPI data | Yes | Potentially duplicates TelemetryHUD/dashboard queries; no imports found | Decide whether to adopt as canonical query hook or leave unused pending refactor | High for unreferenced status |
| Auth pages, Supabase helpers, middleware/proxy, cron and parse API | F — System/administration | Authentication, session gate, scheduler audit, document parsing | Auth clients/session, `app_users`; cron writes audit records via its implementation | System mutation only; not user accounting entry | Cron audit persistence | Security/automation support | Cross-cutting, not an ERP business module | Keep separate from business navigation; review authorization at API/RPC boundary | High |
| Shared UI (`components/ui/*`, modals/providers) | F — System/shared infrastructure | Buttons, tables, pagination, forms, modal primitives and design foundation | No direct business tables/RPCs | No | No | No | Repeated visual usage; components are shared by active workflows | Keep shared; centralize patterns where duplicated | High |

## Operational Workflow Map

**FACT — observed source flow:**

```text
Setup / Master Data
      ↓
TripForm — dispatch trip creation
      ↓
Fuel / AdBlue operations ───── Driver Portal fuel request → Approval Queue → Fuel action
      ↓
Trip movement/status (staff Quick Status or Driver Portal)
      ↓
POD Closure — close trip and attach POD/scan data
      ↓
Workshop — repairs/service bills and tyre lifecycle (as needed)
      ↓
Driver Settlement — calculate and mark period settled
      ↓
Accounts — direct advance / Petty Expense-labeled entry (Petty ownership unresolved)
      ↓
Reports — central historical records and exports
```

**RECOMMENDATION:** Treat trip-specific monetary fields as part of their owning trip/POD or settlement workflow unless accounting policy explicitly assigns them elsewhere. Treat Accounts as the general entry/control surface only for transaction types verified as independent of an operational workflow. Use Reports for history, with analytics pages consuming an agreed accounting definition rather than defining separate P&L rules.

## Accounts Ownership

### What Accounts owns today

**FACT:** The active Accounts workspace exposes two forms: Driver Advance and Petty Expense. Driver Advance calls `save_driver_advance_atomic`. Petty Expense calls `create_workshop_bill_atomic`. There is no historical ledger or export in Accounts. The nonfunctional Workshop Ledger UI was removed in the current code before this audit.

**RECOMMENDATION:** Keep the current concise entry surface for Driver Advance pending its accounting/control policy. Keep the Petty Expense ownership classification open until the deployed RPC and business meaning are verified.

### What Accounts should not own without an explicit decision

**RECOMMENDATION:** Do not create duplicate entry forms for Diesel/AdBlue, trip freight, trip-generated Driver Bata/Halt Bata, POD claims/shortage, Workshop service bills/spares, tyre lifecycle transactions, driver settlement, trip modification, or operational approvals. Those require domain-specific validation or have an existing operational owner.

### Petty Expense / Workshop RPC

**FACT:** Accounts’ Petty Expense caller and Workshop’s Service Bill caller both invoke `create_workshop_bill_atomic`; their submitted values differ (Accounts category-as-vendor and optional vehicle vs Workshop vendor and required vehicle). No function definition is present in checked-in migrations or generated function types.

**NOT VERIFIED:** Deployed RPC body, table destination, authorization, deduplication and atomic behavior. The report `audit/workshop-bill-rpc-verification.md` records that the deployed definition is not verified.

**BUSINESS DECISION:** After authorized read-only production RPC inspection, decide whether petty categories represent a general expense, are a legacy workshop path, or require a separately owned workflow. Do not infer that from the function name or generated table type.

### Future entry types

**UNKNOWN / BUSINESS DECISION:** Staff Advance, general office/admin expense, vendor payment, customer invoice/receipt, payable/receivable and salary are not verified as active Accounts transaction forms. Add none until the business owner confirms the accounting need, authorization, posting/approval lifecycle and authoritative data model.

## Reporting Ownership

**FACT:** `ReportsModule` currently offers these report categories:

| Historical dataset | Intended reporting owner | Operational source remains |
|---|---|---|
| Trip history | Reports → Trips | TripForm / ModifyTrips |
| POD closures and status | Reports → POD | PodClosure |
| Diesel/Fuel transactions | Reports → Diesel/Fuel | FuelAdvanceModule |
| Driver Bata | Reports → Driver Bata | Trip/POD/settlement workflows as currently implemented |
| Driver settlement history | Reports → Driver Settlement | DriverSettlementModule; DriverPortal has own-period self-view |
| Workshop bills | Reports → Workshop | WorkshopModule bill entry |
| Fleet/vehicle history | Reports → Fleet/Vehicle | Live status and masters remain in Telemetry/Setup |
| Financial/P&L trip details | Reports → Financial/P&L | Financial calculations remain subject to reconciliation |

**FACT:** Workshop retains a Tyre History popup for disposed tyres and operational lists for mounted/in-store/retreading state. Reports has a Workshop bill category but no explicit tyre-lifecycle category found. The popup is not a duplicate transaction ledger: it presents disposed asset history in the tyre workflow.

**RECOMMENDATION:** Keep operational pickers and actionable queues with their workflow. Keep broad historical searches, transaction tables and full-result exports centralized in Reports. Decide whether tyre purchase/mount/retread/disposal history needs a separate Reports dataset; do not remove the current operational Tyre History without confirming its replacement.

**FACT:** DriverPortal exposes a current-month driver-specific ledger/statement and download. This overlaps the underlying trip/advance facts in central reports but is an audience-specific self-service statement, not a staff-wide report. Keep it only under driver-session authorization and reconcile its displayed formula with the settlement policy.

## Analytics Ownership

| Surface | Intended responsibility | Verified overlap / concern |
|---|---|---|
| Dashboard → TelemetryHUD | Current command center: fleet status, alerts, pending POD/approval counts, current-month summary | Current-month money summary overlaps Financials/P&L; its cost/date semantics need alignment |
| FinancialsModule / “Fleet Analytics” | Vehicle/fleet economics, variant benchmarks, driver scorecard, unassigned aggregation | Genuine aggregation/benchmarking; should remain analytics, but its retention calculation and source fields differ from other surfaces |
| ProfitLossModule / “P&L Statement” | Aggregate operating statement | Historical summary with separate date basis/cost definition; finance authority needs reconciliation |
| AiInsightsDashboard / “Insights” | Latest daily generated audit/anomalies/efficiency suggestions | A distinct monitoring product surface, though “insights” overlaps analytics naming |
| Legacy `dashboard.tsx` fetch state | Loads vehicles, counts, and a fixed-start-date financial aggregation | Source fact: several set state values (`monthFreight`, `monthDieselCost`, `monthNetRetention`, counts, status counts) are not read in render; `liveVehicles` is used in Quick Status. This is redundant fetch/state, not a second visible dashboard report. |
| `Insights.tsx` (unmounted) | Distance and tonnage aggregate from fixed baseline | Overlaps active analytics; no active mount found |
| `LiveAlertsWidget.tsx` (not rendered) | Expiry, recent trips and fuel alerts | Overlaps TelemetryHUD alert generation; import exists but no JSX render |

**FACT:** `audit/pnl-reconciliation-audit.md` documents source-level differences: `ProfitLossModule` excludes `enroute_repairs_maintenance`; `FinancialsModule` and TelemetryHUD include it in some calculations, use different windows, and have a workshop amount-field mismatch (`bill_amount` vs generated/report `total_bill_amount`). Reports Financial/P&L is trip-detail data, not aggregate net P&L. No production values or deployed RPC definitions were verified.

**RECOMMENDATION:** Keep Dashboard, fleet analytics, statement and AI audit as different user purposes, but establish a shared, approved financial query/calculation contract before consolidating navigation or reusing metrics. A common “Financial Management” parent with separate P&L and Fleet Economics subpages is a reasonable future shape only after formula and date ownership is approved.

## Duplicate / Overlap Matrix

| Function | Current Modules | Type of Overlap | Recommended Future Owner | Decision Required? |
|---|---|---|---|---|
| Petty Expense / workshop bill | AccountsModule, WorkshopModule, ReportsModule | Accounts and Workshop call same RPC with distinct caller semantics; Reports shows historical workshop bills | One canonical creation owner after RPC destination and business type are verified; Reports remains historical | **Yes**, production RPC verification + accounting owner |
| Workshop service bills and spares | WorkshopModule, ReportsModule, FinancialsModule, ProfitLossModule, TelemetryHUD | Operational entry vs central history vs derived cost analytics | Workshop creates; Reports histories; approved finance model supplies analytics | Yes, cost inclusion/field/date definition |
| Tyre lifecycle | WorkshopModule, ReportsModule | Workshop owns lifecycle actions and disposed history; no clear central tyre lifecycle report category | Workshop owns actions; Reports is candidate for broad lifecycle history | Yes, whether lifecycle reporting is required and what events/data are in scope |
| Trip history and edit | TripForm, ModifyTrips, ReportsModule | Same trip entity but create/edit/history are separate tasks | TripForm creates; ModifyTrips edits; Reports histories | No ownership merge indicated |
| POD | PodClosure, ReportsModule, scan intake | Pending POD selection/closure vs closed-trip history; scans support closure | PodClosure owns pending work; Reports owns history; source of scan intake unclear | Confirm UploadHub lifecycle only |
| Fuel and AdBlue | FuelAdvanceModule, DriverPortal, ApprovalQueue, ReportsModule | Staff issue/edit vs driver pending request and approval vs history | Fuel module issues/maintains records; ApprovalQueue approves requests; Reports histories | No duplicate entry path proven; confirm approved request to issue handoff |
| Driver advance / settlement / statement | AccountsModule, DriverSettlementModule, DriverPortal, ReportsModule | Direct advance entry, trip cash values and period close; personalized/current-month view and central report | Accounts/approved operational source creates direct advance; Settlement closes period; Reports central history; Portal self-view | Business policy for advance posting and settlement statement consistency |
| Financial totals | TelemetryHUD, FinancialsModule, ProfitLossModule, ReportsModule, legacy dashboard state | Same underlying measures shown at KPI, analytics, statement and trip detail levels; formulas/windows differ | One approved finance definition; separate dashboard/analytics/report presentations | **Yes**, accounting policy/date basis |
| Live fleet list | TelemetryHUD, FleetTable, SetupModule, ReportsModule | Live status, unmounted detail picker, master record, historical snapshot/report | Telemetry for command status; Setup for master CRUD; Reports for historical view | Confirm whether FleetTable should be mounted |
| Driver master creation | SetupModule, TripForm | Full master CRUD vs contextual quick insert during dispatch | Setup owns master; TripForm may retain controlled quick-create tied to dispatch | Confirm PIN/identity workflow and synchronization |
| Driver approvals | ApprovalQueue, DriverPortal, FuelAdvanceModule | Driver submits/cancels request; staff reviews; Fuel performs issue | DriverPortal submits; ApprovalQueue decides; Fuel owns fuel record | Confirm workflow handoff but no merge |
| Insights/alerts | TelemetryHUD, AiInsightsDashboard, Insights.tsx, LiveAlertsWidget | Current operational alerts, generated audit, unused older aggregate and widget | Telemetry owns live command alerts; AI dashboard owns generated audit; confirm unused prototypes | Product-owner check for unmounted screens |
| Upload/scan intake | UploadHub, PodClosure, FuelAdvanceModule | Unmounted scan intake component vs active consumers of pending scan records | System/document intake feeding operational queues | **Yes**, intended scan capture route and role access |

## Dead / Unclear Functionality

The following are evidence-backed observations, not deletion decisions:

| Item | Evidence | Audit conclusion |
|---|---|---|
| `FleetTable.tsx` | Search finds component definition but no import or JSX mount in active source | Unmounted detailed live fleet UI; intended product status unknown |
| `Insights.tsx` | No import/render call site; active nav mounts `AiInsightsDashboard` instead | Unmounted fixed-baseline distance/tonnage analytics; likely overlaps active analytics, but obsolescence is not proven |
| `UploadHub.tsx` | No import/render call site; component can parse text and insert `pending_scans` | Scan entry UI is unmounted while operational consumers read pending scans; intended ingestion path unclear |
| `useFleetTelemetry.ts` | No import/call site | Unreferenced hook; its query logic overlaps dashboard/TelemetryHUD patterns |
| `LiveAlertsWidget` | Dashboard imports it; no `<LiveAlertsWidget />` render found | Imported but not displayed; overlaps TelemetryHUD alert behavior |
| Dashboard financial/count state | Several state fields set during fetch but not read in JSX; fixed start date `2026-09-01` used in legacy query | Dead/redundant state and fetch work, not a visible report; remove only in a later scoped cleanup after confirming consumers |
| `app_users` Setup data | Setup fetches and stores `app_users`, but inspected UI lacks user-role CRUD actions | User administration capability is not demonstrated; decide whether this is intentionally read-only or unfinished |
| Petty Expense destination | Shared RPC call; no checked-in RPC definition and no production catalog access | Cannot determine from repository evidence whether it creates a general expense, workshop bill or other record |
| Tyre history/report ownership | Workshop has a disposed-tyre history popup; central Reports lacks explicit tyre lifecycle report type | Cannot determine whether popup is the only required history view or a future central report is expected |
| `/protected` starter area and auth starter components | Route/layout files remain in tree; separate from ERP shell; route/layout behavior depends on current auth redirects | Review route accessibility before calling obsolete; this audit does not recommend removal |

No dead button is asserted beyond the historical audit’s already-removed Workshop Ledger button: current Accounts code has no Workshop Ledger control. No RPC destination or production policy is inferred from generated types.

## Proposed Final Navigation Architecture

**RECOMMENDATION — proposed grouping, not implemented:**

```text
COMMAND
  Dashboard

OPERATIONS
  Dispatch
  Modify Trips
  POD Closure
  Approvals
  Fuel & AdBlue
  Workshop & Tyres
  Driver Settlement

FINANCE
  Accounts
  Financial Management
    P&L Statement
    Fleet Economics / Driver Scorecard

REPORTS
  Reports

INTELLIGENCE
  Fleet Audit / AI Insights

ADMINISTRATION
  Masters
  Users & Access (only if implemented/approved)
  Document Intake (only if UploadHub is confirmed and mounted)

DRIVER SURFACE (separate route)
  Driver Portal
```

**RECOMMENDATION:** “Operations” may be a parent with direct task links rather than a nested full-screen tab; avoid hiding frequent tasks behind multiple navigation layers. Approval remains an operational control queue, not a report. Keep the Driver Portal separate because it has a different audience and authentication flow. Do not add FleetTable as a nav item until its purpose is confirmed; if wanted, mount it as a detailed fleet view from Dashboard/Fleet.

## Business Decisions Required

1. **Petty Expense ownership:** Are the Accounts categories (Toll/Fastag, Police/RTO, Loading, Office) independent general expenses, or are they supposed to be Workshop service bills? What is the deployed `create_workshop_bill_atomic` body and destination? Production definition is not verified.
2. **Financial statement policy:** Which date attributes each cost and revenue, which trip statuses count, whether enroute repairs and workshop bills belong in operating expenses, and which amount column is authoritative? Required before reconciling Dashboard, Financials, P&L, Reports and DriverPortal figures.
3. **Driver advance/settlement policy:** Is Accounts the authoritative direct-advance entry point for all advances? How should period settlement history and driver self-service statements reconcile?
4. **Tyre reporting:** Is disposed tyre history within Workshop sufficient, or does management require a central historical tyre lifecycle report including purchase, mount, retread, disposal and associated costs?
5. **Document intake:** Is UploadHub intended as an active document ingestion path? If yes, who may submit scans and how should manual text capture relate to external scanning?
6. **User administration:** Should Setup manage `app_users` roles/status, or is user provisioning intentionally outside the ERP?
7. **Unmounted FleetTable/Insights:** Are these unfinished screens to reactivate, or old prototypes to retire through a separately approved cleanup?
8. **Navigation audience:** Are Finance, Reports, analytics and master-data visibility policies intentionally limited to the current roles? Sidebar visibility alone does not prove database authorization.

## Recommended Refactor Order

1. **Verify ownership and policy first:** obtain read-only deployed definition/constraints for `create_workshop_bill_atomic`; obtain business-owner decisions for Petty Expense and P&L/settlement accounting semantics.
2. **Publish authoritative domain contracts:** document which module creates each trip, fuel, workshop, advance, settlement and approval event; agree one financial date/cost contract.
3. **Reconcile financial surfaces:** align data-source fields and date windows for TelemetryHUD, Financials, P&L, reports and driver statements without merging navigation first.
4. **Confirm screen inventory:** ask owners about unmounted FleetTable, Insights, UploadHub and user management. Only then mark capabilities to mount or retire.
5. **Finalize ownership/navigation:** group modules into Operations, Finance, Reports, Intelligence and Administration while preserving separate workflows; keep Driver Portal as separate audience surface.
6. **Close reporting gaps:** decide on tyre lifecycle reporting and ensure broad historical transaction views remain centralized in Reports while operational queues stay with actions.
7. **Consolidate repeated query/calculation logic:** after definitions are approved, extract shared financial summaries and common query utilities; do not share UI state that obscures different purposes.
8. **Perform scoped implementation and validation:** implement one bounded ownership change at a time, verify RPC/query contracts and role access, then test operational flows and reports against known cases.

## Safety Notes

- **FACT:** This task was a read-only source audit. No application source, Supabase schema, migration, RPC, business logic, UI, or database data was changed.
- **FACT:** Existing working-tree changes and `.before-*` backups were left untouched. The only file created by this task is `audit/module-ownership-final-audit.md`.
- **NOT VERIFIED:** No live production Supabase catalog inspection was available for the Petty Expense/Workshop RPC. This report makes no claim about its deployed destination or behavior.
- **RECOMMENDATION:** Treat all ownership changes, module removal, navigation restructuring and calculation consolidation as future work requiring approval after the listed decisions are resolved.
