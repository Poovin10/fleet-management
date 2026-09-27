# KSS ERP — UI and Page Architecture Blueprint

**Status:** Blueprint only; not implemented  
**Repository:** `C:\Users\unnik\kss-erp` · `design/premium-ui-v2`  
**Basis:** The six requested architecture audits plus current route/component mounting. Findings about source behavior are labeled **FACT**; proposed design is **RECOMMENDATION**; items without enough evidence are **UNRESOLVED / BUSINESS DECISION**.

## 1. Design Intent

**RECOMMENDATION:** Give each screen one primary job and make its ownership visible in its layout:

- **Dashboard:** What is happening now, and what needs attention?
- **Operations:** What work must staff execute or complete?
- **Accounts:** Which supported financial entries or controls need to be performed?
- **Reports:** What happened over a selected period, and what records match my search?
- **Analytics:** What trends and performance patterns should management understand?
- **Masters:** Which reference data governs operations?
- **Administration:** Which requests, documents, users, and system controls need oversight?

**FACT:** The staff ERP currently enters through authenticated `/` and renders most sections as client-side tabs in `components/dashboard.tsx`. `/driver` is a separate driver-facing route. Reports, operational workflows, analytics, and masters are mounted inside that shell. The proposal below describes eventual routes and page boundaries; it does not implement them.

## 2. Final Navigation Tree

### Recommended staff navigation

```text
COMMAND
  Dashboard

OPERATIONS
  Dispatch
  Modify Trips
  POD Closure
  Fuel & AdBlue
  Workshop & Tyres
  Driver Settlement

FINANCE
  Accounts
  Financial Management
    P&L Statement
    Fleet Economics

REPORTS
  Reports

INTELLIGENCE
  Fleet Audit

MASTERS
  Vehicles
  Drivers
  Vendors
  Destinations & Freight
  Bata Rules

ADMINISTRATION
  Approvals
  Document Intake (pending owner confirmation)
  Users & Access (only when actual management actions exist)

DRIVER SURFACE (separate experience)
  Driver Portal
```

**RECOMMENDATION:** Show only sections permitted to the signed-in role, but treat navigation visibility as usability, not authorization. Enforce access at server/RPC/database boundaries. Group frequently used work as direct destinations rather than nesting three levels deep. Approvals is listed in Administration because it is a control/decision function; a dashboard card and Operations shortcut may deep-link to pending approvals.

### Navigation destination contract

Persistent tables below means a continuously visible table/list. Selectors, modal results, active work queues, or report tables are distinguished explicitly.

| Navigation item / future route | Purpose | Primary user | Primary action | Persistent tables? | History ownership | Modal/sheet workflow | Links to Reports / other modules |
|---|---|---|---|---|---|---|---|
| Dashboard — `/dashboard` | Live command center | Dispatcher, operations lead, manager | Open an alert or continue an urgent task | No transaction table; compact live status and alert summaries only | No detailed history | Drilldown to an actionable queue/detail | Deep links to POD, approvals, fuel, workshop, fleet and reports |
| Dispatch — `/operations/dispatch` | Create a trip | Dispatcher | Create/dispatch trip | No historical table; trip form is the main work area | Reports → Trips | Vehicle/driver/freight selectors; focused create-driver only if supported | Links to Modify Trips and Reports → Trips |
| Modify Trips — `/operations/modify-trips` | Find and edit an existing trip | Dispatcher/supervisor | Find Trip, select, edit, save | No permanent historical list | Reports → Trips | Searchable paginated trip picker | Link to Reports → Trips for history |
| POD Closure — `/operations/pod` | Complete POD and close a pending trip | Operations/accounts staff as currently authorized | Select pending POD, validate and close | No permanent large queue; selected trip/form remains visible | Reports → POD | Pending POD search picker; scan selection/review; confirmation | Link to Reports → POD and Dispatch if a trip needs follow-up |
| Fuel & AdBlue — `/operations/fuel` | Issue/record fuel and maintain operational fuel records | Fuel operator/fleet staff | Issue Diesel or record AdBlue | Entry form and bounded pending-slip actions; no historical report | Reports → Diesel/Fuel | Find Fuel Record and AdBlue record selectors with actionable edit/delete; scan review | Link to Reports → Diesel/Fuel; Approval Review when fuel request pending |
| Workshop & Tyres — `/operations/workshop` | Record service bills and manage tyre lifecycle | Workshop/fleet staff | Create service bill or take tyre action | Active mounted/store/retread queues may remain because actions are needed | Reports → Workshop for bills; tyre history owner unresolved | Tyre selection/action sheets, confirmations, disposed Tyre History | Link to Reports → Workshop; link to tyre report only if approved |
| Driver Settlement — `/operations/driver-settlement` | Calculate and settle one driver's period | Accounts/settlement operator | Load period, review amount, mark settled | Current settlement summary and concise period review only | Reports → Driver Settlement | Driver selector; optional current-period detail sheet only when needed | Link to Reports → Driver Settlement and Accounts → Direct Advance |
| Accounts — `/accounts` | Controlled financial entry workspace | Accounts user | New Entry → supported entry form | No history ledger | Reports owns broad transaction history | Entry chooser and one focused form at a time | Link to Reports; operational shortcuts to Fuel, Workshop, Settlement where appropriate |
| Reports — `/reports` | Search historical records and export | Accounts, operations leads, management | Select report, set filters, search, export | Yes: one central filtered/paginated result table | Authoritative historical owner | Optional record detail inspector; not a mutation form | Links to source operational record when useful, without duplicate editing |
| Financial Management — `/analytics/financials` (parent) | Separate approved financial statement and fleet economics views | Finance lead, fleet manager | Choose P&L or Fleet Economics | Analytical tables are paginated/searchable; no transaction ledger | Reports owns historical records | Detail inspector for an aggregate row may link to reports | Links to corresponding Reports category |
| Fleet Economics — `/analytics/fleet` | Vehicle benchmarks, driver scorecard, unassigned aggregation | Fleet manager | Filter/sort analysis window and inspect outliers | Analytical tables allowed, paginated | Reports → Fleet/Vehicle and Financial/P&L for source records | Vehicle/driver detail inspector | Links to Reports; formula remains governed by approved finance contract |
| Fleet Audit — `/analytics/audit` | Latest generated audit, anomalies and recommendations | Fleet/operations manager | Review latest audit; trigger only if role/policy allows | No large historical ledger; latest audit findings as cards/lists | Audit history/system retention owner needs confirmation | Finding detail inspector | Links to Operations or Reports as a finding requires |
| Masters — `/masters` | Maintain authoritative reference data | Admin/master-data steward | Search a master and create/edit a record | Master tables can persist in selected workspace; use query/search/pagination by growth | Not Reports | Focused create/edit form sheet | Links to workflows that consume the selected master |
| Approvals — `/admin/approvals` | Decide pending driver requests | Authorized approver | Approve/acknowledge/reject | Compact count/summary only; queue opens on action | Not Reports; decision state remains in request workflow | Review queue sheet/page, decision confirmation | Deep links to Driver Portal context and Fuel action |
| Document Intake — `/admin/document-intake` (conditional) | Parse/submit scans into verification queues | Authorized operations clerk | Create pending scan | No history table by default; queue work appears in consuming operation | Reports only if scans become a reportable record type | Focused upload/parse/review sheet; route only after owner/access confirmation | Links to POD Closure or Fuel review queue |
| Users & Access — `/admin/users` (conditional) | Provision and manage application roles | System administrator | Create/change/deactivate user | Searchable user list if true CRUD is implemented | No transaction history | Focused user form/confirmation | No current working user CRUD proven; do not expose as active nav item yet |
| Driver Portal — `/driver` | Driver-specific status, request and own-month statement experience | Driver | Authenticate, update trip status, submit request, view own ledger | Active trip list and own-period ledger are purpose-built | Driver-scoped statement; staff Reports remains central | Focused action form/confirmation | No staff navigation; deep links not required |

### Items not added as standalone destinations yet

- **FACT:** `FleetTable.tsx` is not mounted; the dashboard provides live fleet status and TelemetryHUD drilldown. **RECOMMENDATION:** decide whether a dedicated Fleet page is needed before surfacing one.
- **FACT:** `Insights.tsx` is unmounted; active “Insights” navigation renders `AiInsightsDashboard`. **RECOMMENDATION:** do not expose both under competing names.
- **FACT:** `UploadHub.tsx` is unmounted while POD/Fuel read pending scan records. **UNRESOLVED:** confirm intended document-intake ownership before adding a route.
- **FACT:** Setup fetches `app_users` but no user-role CRUD screen is evidenced. **RECOMMENDATION:** only add Users & Access after the actual workflow exists and its authorization is reviewed.

## 3. Page vs Popup vs Drawer Matrix

| Function | Full Page | Modal | Drawer/Sheet | Dashboard Card | Report | Recommended primary surface and reason |
|---|---:|---:|---:|---:|---:|---|
| Trip Dispatch | Yes | — | Focused record selectors only | Shortcut only | History in Reports | Full page: multi-field operational transaction with validation |
| Find/Edit Trip | Edit page/work area | Search picker | Optional on wide desktop | Shortcut only | History in Reports | Keep edit work as a page/work area; picker is transient and searchable |
| POD Closure | Yes | — | Pending trip selector / scan review | Pending count + deep link | POD history | Full workflow page after selection; queue is too operational to move to Reports |
| Find Pending POD | — | Possible | Yes | Pending count shortcut | No | Searchable paginated sheet because task is select-one then return to closure |
| Diesel Issue | Yes | — | Optional vehicle/vendor selector | Shortcut | Fuel history | Full operational page/form; odometer and fuel validations need working context |
| Find Fuel Record | — | Possible | Yes | No | Full history in Reports | Action picker because selected rows retain edit/delete operations; do not display broad report permanently |
| Workshop | Yes | Confirmations | Action sheets for tyre lifecycle | Active jobs/counts only | Bill history | Dedicated operational page: service bill and tyre lifecycle are substantive workflows |
| Workshop History | — | — | — | — | Yes for bills | Bill history belongs in Reports → Workshop; current Workshop has no broad bill-history table |
| Tyre History | — | Possible | Yes | Small count/link | Candidate report, unresolved | Keep disposed-tyre lookup in Workshop as compact context until central tyre report is approved |
| Driver Settlement | Yes | Confirmation if required | Driver selector/detail review | Unsettled-count shortcut if available | Settlement history | Dedicated workflow because period calculation and close action need focused review |
| Driver History | — | — | Driver portal statement tab | No | Staff history in Reports | Driver-specific ledger is a separate authenticated self-service page; no duplicate staff ledger in settlement |
| Driver Advance | Focused form | Entry chooser | Yes | Accounts shortcut only | Historical advance under settlement/report datasets | Accounts entry sheet, one focused form at a time |
| Petty Expense | Focused form only while supported | Entry chooser | Yes | Accounts shortcut only | Reports if destination confirmed | Mark unresolved: caller shares `create_workshop_bill_atomic` with Workshop; do not redesign its ownership based on name |
| Approval Review | Administration page/queue if needed | Confirmation | Queue sheet | Pending count + action | No report replacement | Review surface plus confirmation; keep decision actions out of Dashboard cards |
| Fleet Live View | Optional full page | — | Vehicle inspector | Dashboard summary | No | Telemetry summary remains dashboard; detailed FleetTable is unmounted and requires product decision |
| Fleet History | — | — | — | No | Yes | Reports → Fleet/Vehicle for historical/report use; live status remains Dashboard |
| Reports | Yes | — | Optional row inspector | Shortcut only | It is the report | Dedicated searchable page with server-side filtered page and full-result export semantics |
| Financial Analytics | Yes | — | Aggregate detail inspector | Summary KPI only | No transaction history | Dedicated analytics page; aggregation is not a report ledger |
| AI Insights / Fleet Audit | Yes | Finding inspector | Optional | Alert/count teaser | Audit history as product requirement | Dedicated intelligence page for generated audit output; no operational entry form |
| Master Data | Yes (workspace) | — | Create/edit forms | Shortcuts only | No | Dedicated configuration area with selected master list and focused edit surface |

## 4. Shared Page Architecture

### Standard page frame

```text
Application Shell
  Sidebar (section navigation + collapse)
  Top Bar (breadcrumbs, global search entry, notifications, account)
  Page Canvas
    Page Header (title, purpose sentence, optional primary action)
    Command Bar (workflow actions or report filters; not both unrelated sets)
    Optional Status/KPI Strip (only decision-relevant values)
    Primary Work Surface (form, operational queue, report table or analytics)
    Secondary Context (alerts, help, recent task status, deep links)
```

**RECOMMENDATION:** Use one primary surface at a time. A section heading can separate work areas, but a surface should not be wrapped in multiple nested translucent cards. Put report date/search filters next to the report table; put operational actions next to their workflow. A primary action should be visible in the page header or command bar.

### Visual hierarchy — design tokens by role, not per component

| Layer | Role | Blueprint behavior |
|---|---|---|
| App background | Stable canvas and ambient brand atmosphere | Lowest contrast/background plane; visual texture remains quiet and static |
| Primary content surface | Main form, table or work area | Highest content contrast and most opaque surface; readable at all viewport sizes |
| Secondary surface | Supporting note, KPI strip, filters or sub-panel | One step below primary; use for grouping only when it clarifies hierarchy |
| Glass surface | Navigation, selected controls and lightweight secondary content | Translucency is selective; maintain text contrast and avoid stacking glass panels |
| Command/action area | Page actions, primary/secondary buttons | Stable placement and obvious priority; do not disguise primary action as a table control |
| Table surface | Historical/analytical rows or operational queue | Shared header, row, empty/loading/error states; horizontal overflow only inside the table region when necessary |
| Modal/sheet surface | Temporary focused task | Opaque enough to read and distinct from page; blurred/dimmed overlay establishes focus |
| Status/alert surface | State, warning, success or exception | Semantic variants from shared tokens; color always paired with text/icon/label |

**RECOMMENDATION:** Keep blur behind overlays and a few shell surfaces, not every card/input. Do not select colors ad hoc in modules. Use the existing shared table/button/input/modal foundations as the implementation starting point; formalize missing page-header, empty-state, status-badge and dialog behavior before broad page migration.

## 5. Operational Page Blueprints

These define information hierarchy and interaction responsibility, not detailed visual design or new business rules.

### Dispatch

- **Purpose:** create one valid trip.
- **Header:** Dispatch / Create Trip, concise description, primary “Create Trip”.
- **Secondary actions:** open Modify Trips; link to trip report; contextual driver creation only where current manual-driver workflow is supported.
- **Summary:** only dispatch-relevant vehicle availability or validation status; no monthly report cards.
- **Main work:** the existing TripForm, with vehicle, driver, trip/freight, date and required business validations grouped by decision sequence.
- **Queue/history:** no permanent history table. Recent route suggestions are selectors, not records for reporting.
- **Sheets:** vehicle/driver/freight lookup; confirm submission only if existing business interaction requires it.
- **Report access:** Reports → Trips.

### Modify Trips

- **Purpose:** find and edit one existing trip.
- **Header:** Modify Trips; primary “Find Trip”.
- **Main work:** selected trip summary plus the existing editable fields and save/cancel actions.
- **Queue/history:** no visible historical table by default.
- **Sheet:** searchable, filtered, database-paginated trip picker, closes after selection.
- **Report access:** Reports → Trips for broad historical search; never recreate its export/report table here.

### POD Closure

- **Purpose:** close the selected pending trip with validated POD data.
- **Header:** POD Closure; primary “Pending PODs” / “Find Pending POD”. Show actionable pending count if available.
- **Main work:** current trip/vehicle/driver context followed by POD number/date, unloaded weight, shortage, halt bata, claims, diesel and odometer fields as currently implemented.
- **Queue/history:** no giant pending queue on the landing screen. Keep pending POD queue operational, in a search sheet with pagination.
- **Scan actions:** select/review the relevant pending scan and apply data to the active trip; preserve delete/consume semantics as currently implemented.
- **Report access:** Reports → POD. Do not move the live pending queue to Reports.

### Fuel & AdBlue

- **Purpose:** enter fuel against the required vehicle context and correct an existing entry when operationally needed.
- **Header:** Fuel & AdBlue; primary “Issue Diesel”; secondary “Record AdBlue” and “Pending Fuel Slips”.
- **Main work:** one active form/subtask at a time; retain vehicle, quantity/rate, date, odometer, tank-full and other existing rules.
- **Queue/history:** pending fuel slips remain actionable; no permanent fuel-history report table.
- **Sheet:** Find Fuel Record/AdBlue for correction; search and paginate at database level per the historical-data audit.
- **Report access:** Reports → Diesel/Fuel for read-only historical search/export.

### Workshop & Tyres

- **Purpose:** manage service bills and active tyre lifecycle work.
- **Header:** Workshop & Tyres; primary action is context dependent: “Log Service Bill” or a tyre lifecycle action.
- **Main work:** active mounted, in-store and retreading tyre groupings that need actions; service entry kept distinct from tyre lifecycle controls.
- **Actions:** unmount, retread, receive, mount, purchase/register and dispose remain domain-owned, with confirmations where already used.
- **History:** bill transactions in Reports → Workshop; disposed Tyre History is a compact lookup. Broad tyre-history reporting ownership remains open.
- **Report access:** Reports → Workshop. No duplicate permanent workshop-bill table.

### Driver Settlement

- **Purpose:** review and close a driver's settlement period.
- **Header:** Driver Settlement; primary “Calculate / Load Period”.
- **Command inputs:** driver, from date and to date.
- **Summary:** gross bata, halt bata, trip advances, direct advances/deductions as currently defined, final balance, validation state, and “Mark Period as Settled”.
- **Main work:** concise current-period review. If a detailed decision review is needed, open a focused detail sheet rather than a large ledger beneath the form.
- **History:** Reports → Driver Settlement; driver-facing period statement stays in Driver Portal.
- **Safety:** preserve the existing calculation and `settle_driver_period_atomic` behavior during any visual migration.

### Accounts

- **Purpose:** entry/control for only supported and verified Accounts workflows.
- **Header:** Accounts; primary “New Entry”; description states available entry types honestly.
- **Landing:** two supported cards/actions today: Driver Advance and Petty Expense, with Petty marked as unresolved internally in the blueprint, not a fake disabled menu item.
- **Form behavior:** chooser sheet, then one focused form; close/back/save and success return to landing. No simultaneous forms and no duplicate ledgers.
- **Reports/operations links:** link to Reports for history; links to Fuel, Workshop or Settlement should navigate to their operational owner, never render duplicate forms.
- **Safety:** keep `create_workshop_bill_atomic` uncertainty explicit. No staff advance, vendor payment, invoice, payable or general expense subtype until approved and implemented.

### Approval Review

- **Purpose:** resolve pending driver-submitted requests.
- **Header:** Approvals; count of pending items and “Review Approvals”.
- **Main work:** open a searchable/paginated queue only on demand; preserve approve/acknowledge/reject actions and confirmation behavior.
- **Report access:** not a report. Completed decision history may be surfaced through Reports only if an existing dataset supports it; do not create a new historical data model in this blueprint.
- **Links:** request context to Driver Portal origin and appropriate fuel workflow.

## 6. Reports Architecture

### Page frame

```text
Reports
  Report type selector / route tabs
  Date and report-specific filter bar
  Search (search semantics visible and stable)
  Result count + export actions
  Shared result table with loading/empty/error states
  Shared 10-row pagination
  Optional record detail inspector
```

**FACT:** Current `ReportsModule` has eight report categories and uses shared pagination. The historical-data audit found the former broad-fetch/client-filter pattern and recommends database-side filters, `.range()` pages, exact counts, stable ordering, and a separate full-filtered-result export query. A prior implementation turn states Reports UI was converted to database-backed pagination; exports must continue representing the full filtered dataset, not only visible rows. This blueprint preserves that contract.

### Report definitions

| Report | Current fields/scope concept | Filters/search | Pagination/export | Detail interaction | Operational duplicate today? |
|---|---|---|---|---|---|
| Trips | Trip and vehicle/driver history | Date, trip status, trip number/vehicle/driver as currently supported; date basis remains the current trip-start date | Database page; CSV/Excel/PDF full filtered result | Read-only details; link to Modify Trips only if user has edit rights | ModifyTrips is a search/edit picker, not a report duplicate |
| POD | POD closure data joined with trip context | Date, POD status, LR/POD text search | Database page; full filtered export | Inspect closure fields; action remains in PodClosure only for pending work | Pending POD queue is operational, not duplicate history |
| Diesel/Fuel | Fuel log data and vehicle | Fuel date, category, vehicle/search | Database page; full filtered export | Read-only fuel detail; correction in Fuel module | Fuel correction picker has actions, so it remains operational |
| Driver Bata | Trip bata/halt and driver context | Date, driver/vehicle/LR, settlement status if supported | Database page; full filtered export | Read-only trip detail | Settlement workflow uses current period calculations, not a general report |
| Driver Settlement | Settlement-related trips plus direct advances as currently implemented | Date/period, driver, status and text search | Database page across source datasets; full filtered export | Read-only statement detail | DriverPortal has a personalized statement only; avoid additional staff ledgers |
| Workshop | Workshop bill records | Bill date, vendor, vehicle, description | Database page; full filtered export | Bill detail only | Workshop has bill entry and active tyre operations; its bill history was removed |
| Fleet/Vehicle | Vehicle records/status snapshot | Status, vehicle number/type | Database page if growth warrants; full filtered export | Read-only vehicle history/snapshot | Live Telemetry is current state; Setup is master editing |
| Financial/P&L | Current report type is trip-level financial details, not a consolidated P&L statement | Trip-start date, status, LR/vehicle search as presently defined | Database page; full filtered export | Read-only trip cost/revenue detail | `ProfitLossModule` is aggregate statement; it is not the same row report |

**RECOMMENDATION:** Keep Reports one navigation destination with clear report categories; do not make every report an unrelated top-level module. Use stable, deterministic ordering and database pagination for high-growth data. Changing filters/report type returns to page one. The count must match all server-side filters. Keep full filtered exports separate from the visible page query. Avoid altering business date meaning during UI work.

**UNRESOLVED:** Whether a central Tyre Lifecycle report is required, and whether Financial/P&L should be renamed to “Trip Financial Detail” or expanded into an approved consolidated statement. Resolve policy before changing labels/formulas.

## 7. Accounts Architecture

### Landing and entry flow

```text
Accounts landing
  New Entry
    Choose currently supported transaction
      Driver Advance → focused existing form
      Petty Expense → focused existing form, ownership unresolved
  Reports → centralized history
  Operational shortcuts → Fuel / Workshop / Driver Settlement
```

| Type | Current status | Future UX rule |
|---|---|---|
| Driver Advance | **CONFIRMED as an existing Accounts form** calling `save_driver_advance_atomic`; business posting details remain governed by current behavior | Keep as focused Accounts form; do not duplicate trip cash-advance entry |
| Petty Expense | **UNRESOLVED**: current form calls `create_workshop_bill_atomic`; deployed RPC definition/destination not verified; Workshop Service Bill uses same RPC with different caller values | Preserve current behavior during visual work; do not classify as verified general expense or add subtypes until RPC and business purpose are confirmed |
| Staff Advance, vendor/customer payments/invoices, office categories beyond existing Petty form | **FUTURE / BUSINESS DECISION**; not verified active Accounts workflows | Do not show as choices, placeholders or disabled fake forms before approved implementation |
| Diesel, AdBlue, trip freight, trip bata/halt, POD claims, workshop bill/spares, tyres, settlement | **CONFIRMED operationally owned elsewhere** | Link to owner module; no Accounts duplicate form |

## 8. Analytics Architecture

| Layer | Owns | Must not own |
|---|---|---|
| Dashboard / TelemetryHUD | Current fleet state, exceptions, pending action counts, a small set of approved current-period KPIs | Historical ledgers, exports over transactions, detailed entry forms |
| Fleet Analytics / FinancialsModule | Vehicle/driver performance, retention/margins, variant comparison and aggregate analysis | Source transaction correction or an unaudited competing P&L definition |
| P&L Statement | Approved period-based accounting summary once formula/date rules are reconciled | Fleet ranking/benchmark tables; independent undocumented formula |
| AI Insights / Fleet Audit | Latest generated operational audit and recommendations | Transaction truth, manual financial adjustments, ambiguous “AI” claims if code is deterministic |
| Reports | Historical searchable rows and complete filtered exports | Live operational queues or analytics-only rankings |

**FACT — duplicated metrics/queries identified:**

1. Dashboard shell `dashboard.tsx` fetches vehicles, trip/approval counts, and historical cost/revenue aggregates; `TelemetryHUD` fetches many of the same vehicle/trip/fuel/workshop/driver datasets. Several outer-shell count/finance states are assigned but not read in JSX; Quick Status does use `liveVehicles`.
2. `FinancialsModule`, `ProfitLossModule`, and `TelemetryHUD` all compute freight/cost/retention-like values from trips, diesel logs and workshop bills. The P&L audit records different date windows, treatment of enroute repair costs, and workshop amount fields. Do not consolidate by assuming they are equivalent.
3. `ReportsModule` Financial/P&L is trip-level detail; `ProfitLossModule` is a summary. They share a label domain but not granularity or formula.
4. `Insights.tsx` and `useFleetTelemetry.ts` are unmounted/unreferenced; `LiveAlertsWidget` is imported but not rendered. Their query logic overlaps active analytics/alerts if reactivated.
5. DriverPortal's monthly statement overlaps staff-visible underlying records but is audience-scoped, and should remain separate while using an approved shared definition.

**RECOMMENDATION:** Decide a calculation and date contract before reuse or nav merge. Extract shared typed queries/calculations only after owners approve which data and date basis define each KPI. Keep page-level presentation separate.

## 9. Master Data Architecture

**RECOMMENDATION:** Initially retain one Masters workspace route with a clear sub-navigation and one selected list/form at a time. Make each high-growth list searchable; use server paging when actual size/growth merits it. Do not make every small master a top-level route without evidence.

| Master | Evidence/current owner | Responsibility | Search/page behavior | Future surface |
|---|---|---|---|---|
| Vehicles | SetupModule; also operational selectors and Dashboard live status | Authoritative vehicle identity/specs/permits/active state; operations read it | Search by number/type/status; page if fleet size makes a full list burdensome | Masters → Vehicles; live state remains on Dashboard/Fleet |
| Drivers | SetupModule; TripForm has contextual direct insertion | Identity, contact, licence, branch/PIN and active status | Search by name/code/phone; page if volume warrants; never confuse driver portal session with master record | Masters → Drivers |
| Vendors | SetupModule; Fuel and Workshop consume vendors | Vendor identity/type/contact/tax and active status | Search name/type/contact; database paging if growth requires | Masters → Vendors |
| Destinations/Freight | SetupModule `destinations_freight_master` | Route/cargo/capacity/rate and trip matching rules | Search origin/destination/cargo; paginate if history/master size grows | Masters → Destinations & Freight |
| Bata Rules | SetupModule `driver_bata_master` | Operational rate rules consumed by trip workflow | Search route/cargo/vehicle rule; paginate if needed | Masters → Bata Rules |
| Users (`app_users`) | SetupModule reads list; no actual user CRUD UI verified | User/role data exists, but management responsibility unclear | If CRUD is approved: searchable/paginated directory with strict admin access | Conditional Administration → Users & Access |
| Branches | Database type/evidence exists, but active standalone CRUD not established by this inspection | Branch reference ownership cannot be assigned from current UI evidence | Do not add active nav item until supported workflow confirmed | Business-owner decision; likely nested in administration if needed |

**FACT:** SetupModule loads vehicles, drivers, destinations/freight, bata rules, `app_users`, and vendors. It implements vehicle, driver, freight, bata and vendor management. A separate user administration workflow is not proven by the list read alone.

## 10. Global Application Shell

### Sidebar

- Group destinations by Command, Operations, Finance, Reports, Intelligence, Masters and Administration.
- Show clear active route and section; provide collapsed icon navigation only when labels remain available accessibly.
- Keep Driver Portal outside the staff sidebar.
- Do not encode security in the sidebar; route/API/RPC/database checks are authoritative.

### Top bar

- Breadcrumb/current section and page title context.
- Global search entry only if its scope is defined; until then, page-local search must remain explicit.
- Notifications/status entry with actionable counts, not an alert dump.
- User/account menu, role-aware actions, sign-out and accessible keyboard operation.

### Page header / command bar / canvas

- Page title plus one-sentence purpose.
- One primary action, secondary actions nearby, and no duplicate title bars inside the page body.
- Filters live on reports/analytics pages; operational forms use task-specific fields.
- Primary content gets one main surface. Secondary context may use a simple surface, not card-inside-card nesting.
- Loading, empty, error, success and stale-data states are consistently placed and announced.

### Must not appear permanently

- Giant historical tables embedded in operations or Accounts.
- Duplicate report filters, exports, ledgers or history queries inside operational pages without an explicit workflow need.
- Multiple unrelated full forms displayed simultaneously.
- Several nested glass/card/table shells around the same content.
- Raw database-style CRUD as the default product interaction.
- KPI collections without a decision/action they support.

## 11. Liquid Glass Interaction Model

Use existing glass class vocabulary as the visual baseline, but standardize behavior before broad migration.

| Pattern | Use when | Approximate geometry | Backdrop / surface | Close and keyboard behavior | Mobile behavior |
|---|---|---|---|---|---|
| Modal dialog | A short decision, confirmation or tightly scoped focused task that blocks the page | Compact width; height fits viewport with internal scroll | Dim overlay plus restrained blur; modal surface opaque/readable | `role="dialog"`, `aria-modal`, labelled title; move focus in, trap focus, Escape closes when safe, restore focus to opener | Nearly full width with safe margins; actions stack when needed |
| Sheet/drawer | Multi-field selector, task form or side-by-side detail that should preserve page context | Desktop side panel or centered wide sheet; max height within viewport | Same overlay language and glass surface; do not blur form controls inside | Focus management, Escape, explicit Close/Cancel; warn before discarding dirty forms according to existing behavior | Full-height/bottom sheet or full-screen step; scroll body, keep primary action reachable |
| Search popup | Select one record from operational/picker results | Search-first, compact list with 10-row paging | Overlay plus one list surface | Search label, result count, row keyboard selection, Escape, focus returns | Full-screen searchable picker; filters collapsible |
| Confirmation dialog | Destructive, irreversible or material operation already requiring confirmation | Compact centered dialog | Strong contrast and clear operation summary | Focus initial safe action; Escape behavior must match risk; explicit confirm/cancel labels | Full-width action buttons; no tiny side-by-side targets |
| Detail inspector | Read-only inspection of selected report/analytics row | Narrow/medium side drawer; content can scroll | Secondary detail surface above the page | Focus heading on open; close button/Escape; no mutation action unless explicitly permissioned | Full-screen detail route/sheet with back navigation |
| Form dialog | Small standalone entry that is not a multi-step operational workflow | Medium width; one focused form | Restrained glass; labels and validation readable | Label inputs; preserve values on validation errors; prevent accidental close during submit | Full-width/full-height sheet; one column and pinned submit/cancel area |

**Accessibility requirements for every future dialog/sheet:** semantic dialog and label; focus moved into the opened surface; focus contained where modal; Escape policy explicit; return focus to opener; visible keyboard focus; labeled inputs/actions; announce validation/loading/success; touch targets and viewport-safe sizing; no color-only status. This is a requirement for future implementation, not a claim that every current popup satisfies it.

## 12. Future URL and Route Map

These are proposed routes only. The present shell uses tabs rather than these paths.

| Future route | Current route/component mapping | Notes |
|---|---|---|
| `/dashboard` | `/` → `dashboard.tsx` → `TelemetryHUD` | Current `/` is authenticated shell; migration can preserve redirect/canonical route |
| `/operations/dispatch` | `TripForm` under Operations → Trips | Create-only workflow |
| `/operations/modify-trips` | `ModifyTrips` under Operations | Search picker plus edit work area |
| `/operations/pod` | `PodClosure` under Operations | Pending picker plus closure form |
| `/operations/fuel` | `FuelAdvanceModule` current Fuel tab | Diesel/AdBlue/pending slips/correction actions |
| `/operations/workshop` | `WorkshopModule` current Workshop & Tyres tab | Service bills and tyre lifecycle |
| `/operations/driver-settlement` | `DriverSettlementModule` | Period action |
| `/accounts` | `AccountsModule` | New Entry and current supported types only |
| `/reports` | `ReportsModule` | Eight report categories, unified historical search/export |
| `/analytics/financials` | `FinancialsModule` + `ProfitLossModule` | Two distinct views behind one parent only after formula reconciliation |
| `/analytics/audit` | `AiInsightsDashboard` | Current “Insights” nav destination |
| `/masters` | `SetupModule` | Shared master workspace; possible future nested routes if justified |
| `/admin/approvals` | `ApprovalQueue` currently under Operations | Keep as decision workflow; link from pending dashboard card |
| `/admin/document-intake` | `UploadHub` currently unmounted | Conditional: confirm product need, permissions and input flow |
| `/admin/users` | `SetupModule` currently reads app_users only | Conditional: CRUD not verified |
| `/driver` | `DriverPortal` | Existing separate route remains separate |

Auth routes (`/auth/login`, sign-up, confirm, password recovery/update, success/error), `/api/cron/audit`, and `/api/parse-document` remain system routes and are not business navigation pages. `/protected` contains starter structure and requires a separate route/access disposition; do not fold it into ERP navigation without checking its current redirects/deep links.

## 13. Safe Migration Strategy

Dependencies are adjusted to protect existing workflows and unresolved finance rules.

1. **Confirm contracts and ownership.** Verify deployed RPC/permissions for the shared Petty Expense/Workshop call and approve accounting definitions/date bases. No UI consolidation should decide data semantics.
2. **Define shared page and interaction primitives.** Document page header, command bar, modal/sheet, search selector, confirmation, status/empty/loading/error patterns using existing primitives. Ensure accessibility and responsive behavior before reuse.
3. **Introduce route-capable application shell.** Preserve the existing authenticated behavior and Driver Portal boundary; add route destinations incrementally while tabs remain functional until each page is migrated.
4. **Move navigation without changing workflows.** Re-group destinations; verify role-aware visibility and independently enforce server/database authorization.
5. **Establish page boundaries for operations.** Migrate Dispatch, Modify Trips and POD as separate pages; preserve exact RPCs, payloads, validation and odometer logic. Then migrate Fuel and Workshop. Keep operational queues action-driven.
6. **Keep settlement distinct.** Migrate the period settlement workflow only after shared display and validation primitives; preserve calculations and `settle_driver_period_atomic`.
7. **Harden Reports UX/data contract.** Maintain eight existing categories, DB-side filtering/paging, stable order/count behavior, and full filtered export independent of visible page. Do not alter date/business semantics.
8. **Reframe Accounts.** Preserve Driver Advance and Petty Expense behavior while RPC ownership remains unresolved; keep forms focused, no ledger duplication, and no unverified transaction types.
9. **Consolidate Analytics presentation only after formulas are approved.** Keep Dashboard snapshots, Fleet Economics and P&L as distinct presentations; share approved data/calculations only after reconciliation. Confirm unmounted legacy screens before removal.
10. **Organize Masters and conditional Administration.** Keep current verified master CRUD. Add Users or Document Intake pages only after ownership, role access and active workflows are confirmed.
11. **Responsive and accessibility refinement.** Verify tablet/mobile navigation, long forms, tables, keyboard dialogs, focus return and announcements across all migrated pages.
12. **Final QA.** Validate role journeys, operational RPC payloads, report search/pagination/export parity, and cross-page links. UI architecture work must not silently change calculations or record ownership.

## 14. Final Rules for Future Codex Tasks

1. One page has one primary user question or workflow.
2. Dashboard shows current state, exceptions and actions; it is not a historical report.
3. Reports owns broad historical search, filters, result tables and exports.
4. Keep operational queues with the action that consumes them; never move pending work to Reports.
5. Do not leave large historical tables permanently visible in operational pages.
6. Use a search sheet/popup for select-one operational lookup; return to the workflow after selection.
7. Use full pages for multi-step or validation-heavy operational workflows.
8. Never place several unrelated entry forms on one landing page at once.
9. Accounts exposes only transaction types verified as implemented and approved for Accounts ownership.
10. Never infer an RPC destination or accounting meaning from its name or generated types.
11. Do not duplicate a financial entry form when an operational module already owns its validation and record creation.
12. Do not change business calculations, dates, validations, RPC names or payloads during a UI-only migration.
13. Reconcile financial formulas and date semantics before combining P&L and analytics navigation or code.
14. Keep Reports UI pagination separate from full-filtered-result CSV/Excel/PDF export retrieval.
15. Use database-side search, filters, deterministic order and pagination for growing historical datasets.
16. Reuse shared pagination and table primitives; do not create module-specific pagination systems.
17. Keep analytical rankings and KPIs separate from transaction ledgers.
18. Do not activate currently unmounted screens until a product owner confirms their purpose, role and data lifecycle.
19. Do not call a table/component dead solely because its filename or UI looks old; verify every mount, consumer and route first.
20. Use one shared modal/sheet interaction contract with semantic labels, focus handling, Escape policy and focus restoration.
21. Every status uses text/icon as well as color; keyboard focus is always visible.
22. Blur is reserved for overlays and selected shell surfaces; preserve contrast and avoid stacked translucent cards.
23. Build mobile behavior into page and popup architecture; do not rely on desktop horizontal overflow for forms.
24. Navigation visibility is not authorization; protect route, API, RPC and database operations independently.
25. Preserve a single authoritative creation owner per business event and document any approved exception.
