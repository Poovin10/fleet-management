# P&L Reconciliation Audit

**Scope:** Priority #3 — reconcile P&L formula and date window across modules
**Repository:** `C:\Users\unnik\kss-erp`, branch `design/premium-ui-v2`
**Audit date:** 2026-09-27
**Mode:** Read-only source audit. This report is the only file created for this task. No financial logic, application code, RPC, or database object was changed.

## Executive summary

The five requested surfaces do not currently implement one consistent P&L definition.

- `ProfitLossModule` calculates a lifetime-since-2026-09-01 statement as freight revenue minus diesel logs, driver bata, halt bata, and workshop bills. It **does not include** trip `enroute_repairs_maintenance`.
- `FinancialsModule` and the visible dashboard `TelemetryHUD` calculate freight minus diesel logs, driver bata, halt bata, enroute repairs/maintenance, and workshop bills. Their scope is intended to be monthly/custom/lifetime (Financials) and current calendar month (TelemetryHUD), but the workshop amount field differs from the generated schema type. `FinancialsModule` also omits costs and revenue associated with inactive vehicles from its fleet aggregate and omits workshop bills with no vehicle assignment.
- `ReportsModule`'s `Financial/P&L` category is a **trip-level detail report**, not an aggregate P&L. It filters trips by trip start date and shows revenue, trip costs and fuel litres, but no diesel cost, workshop expense, total expense, or net result.
- `get_monthly_pl_summary` appears in generated types only. It is not called by current source and has no definition in checked-in migrations, so its formula, date semantics and grants cannot be established.
- Current dashboard `TelemetryHUD` uses JavaScript local-midnight dates converted to UTC date strings. In a UTC+05:30 browser timezone, both month boundaries shift to the prior calendar date. The component-shell dashboard also retains a separate fixed-start-date calculation that sets unused state; it is not the visible dashboard metric.

No actual dollar/rupee discrepancy can be quantified without data and a confirmed deployed schema, and no transactions were created. The formula and scope discrepancies are proven from source. Before changing numbers, the business owner must define which categories belong in operating P&L, the accounting attribution date, treatment of incomplete trips and other cost fields, and whether “retention/margin” is intended to mean the displayed result.

## Evidence levels

- **Verified source fact:** directly visible in checked-in frontend/types/migration source.
- **Inferred runtime effect:** follows from the code if the deployed schema behaves like the checked-in generated type snapshot.
- **Unresolved:** requires deployed schema/RPC definition or business-owner accounting policy.

The application has no checked-in SQL definition for `get_monthly_pl_summary` or `view_corporate_fleet_retention`; prior security audit found no live database catalog access. The generated types are a contract snapshot, not proof of current production DDL.

## Revenue formula

### ProfitLossModule

**Verified source fact:**

```text
Revenue = SUM(trips.freight_revenue)
           for trips with trip_start_date >= 2026-09-01
```

There is no upper date bound and no trip-status predicate. Active/incomplete and completed trips are included. Each trip's full freight amount is attributed to its `trip_start_date`; a trip spanning periods is not split.

### FinancialsModule

**Verified source fact:** it sums `freight_revenue` for the selected trip-date window, then builds fleet rows only for `vehicles.is_active = true`, plus a separate unassigned-trip bucket. Therefore the top-level aggregate contains:

```text
Revenue = freight for active-vehicle trips + freight for trips with vehicle_id NULL
```

Trips linked to inactive vehicles are fetched but not included in a fleet row or the unassigned bucket. They are omitted from the aggregate. There is no trip-status filter.

### ReportsModule

**Verified source fact:** `Financial/P&L` returns one row per trip with its `freight_revenue`; it does not compute or display a revenue total. The optional from/to filters use `trip_start_date`; optional status filters use `trip_status`. Query has a 1,000-row cap.

### Dashboard (`TelemetryHUD`)

**Verified source fact:** `Revenue = SUM(trips.freight_revenue)` where `trip_start_date` falls within the computed current-month date strings. There is no status filter. Each trip is attributed wholly to trip start date.

## Expense formula

### ProfitLossModule

**Verified source fact:**

```text
Expenses = SUM(diesel_fuel_logs.total_fuel_cost)
         + SUM(trips.driver_bata + trips.halt_bata)
         + SUM(workshop_spares_bills.total_bill_amount)
```

Date bases: `fuel_date` for fuel, `trip_start_date` for bata, and `bill_date` for workshop. Each query uses `>= 2026-09-01`, with no upper bound. There is no status filter.

It does not include `trips.enroute_repairs_maintenance`, `cash_advance_issued`, `driver_direct_advances`, `driver_advances`, `expenses`, trip `fuel_expense`, `loading_unloading_expense`, `misc_trip_expense`, `toll_fastag_expense`, or `shortage_penalty_deduction`.

Fuel is sourced from `diesel_fuel_logs`, not also from `trips.fuel_expense`; this avoids an apparent double inclusion in this module. Whether the log total or trip snapshot should be authoritative remains a data/business question.

### FinancialsModule

**Verified source formula:** per active vehicle it calculates:

```text
Vehicle retention = trip freight
                  - diesel log total_fuel_cost
                  - trip driver_bata
                  - trip halt_bata
                  - trip enroute_repairs_maintenance
                  - workshop bill amount
```

Unassigned records use a different formula:

```text
Unassigned retention = unassigned trip freight
                     - unassigned diesel log total_fuel_cost
                     - unassigned trip driver_bata
                     - unassigned trip halt_bata
                     - unassigned trip enroute_repairs_maintenance
```

Unassigned workshop bills are not fetched into `unassignedHistorical` and are not subtracted. Records tied to inactive vehicles are also excluded from top-level aggregates. The same extra expense fields listed under ProfitLossModule are otherwise omitted.

**Schema-contract issue:** Financials queries `workshop_spares_bills.bill_amount` and reads `b.bill_amount`. The checked-in generated type lists `total_bill_amount` and has no `bill_amount`. Dashboard `TelemetryHUD` and the unused `useFleetTelemetry` hook also query/read `bill_amount`. `ProfitLossModule` and the Workshop report read `total_bill_amount`; Accounts and Workshop bill-entry RPC payloads use `p_total_bill_amount`.

**Inferred runtime effect if deployed schema matches generated types:** selecting `bill_amount` may return a PostgREST error. Financials does not inspect the `error` from the bills query, and its bills data can then be null, making workshop spend appear as zero. Dashboard similarly does not throw on this query error and treats absent workshop data as zero. The deployed schema was not inspected, so whether the column is absent in production is unresolved. Even if `bill_amount` exists in production, Financials excludes unassigned bills and inactive-vehicle amounts from its fleet aggregate.

### Dashboard (`TelemetryHUD`)

**Verified source formula:**

```text
Dashboard net retention = trip freight
                         - diesel log total_fuel_cost
                         - trip driver_bata
                         - trip halt_bata
                         - trip enroute_repairs_maintenance
                         - workshop bill_amount
```

Expense event dates use fuel date and bill date, while trip revenue/bata/repairs use trip start date. No other fields or status filters are included. Its workshop field has the same generated-type mismatch as Financials.

### Other operating entry/settlement fields

- `AccountsModule` records “Petty Expense” entries through `create_workshop_bill_atomic`, using the `workshop_spares_bills` path and `p_total_bill_amount`. Therefore petty expenses recorded this way are included by ProfitLossModule's workshop-table sum if the RPC writes to that table as named. The exact deployed function body is absent locally; the write destination is strongly indicated by the function and payload, but should be confirmed against the RPC definition.
- Driver settlement uses `driver_bata + halt_bata - cash_advance_issued - direct advances` as a settlement balance, not a P&L formula. The source code does not establish that advances are expenses; subtracting them again from P&L could double-count cash paid against bata. They are excluded by current P&L formulas.
- `expenses` and `driver_advances` exist in generated types but no active P&L module query uses them. No evidence shows petty-entry forms writing to `expenses` directly.
- Trip schema types also contain `fuel_expense`, `loading_unloading_expense`, `misc_trip_expense`, `toll_fastag_expense`, and `shortage_penalty_deduction`. Current P&L/Financials/dashboard formulas do not include those fields. Whether each belongs in operating expenses, revenue reductions, settlement deductions, or is a duplicate/legacy field is unresolved.
- `enroute_repairs_maintenance` and workshop bills are both subtracted by Financials/dashboard. Whether the same repair can be recorded in both fields/tables, causing duplication, requires owner/process confirmation.

## Net P&L formula

| Source | Formula actually implemented | Result label |
|---|---|---|
| ProfitLossModule | `freight_revenue - total_fuel_cost - driver_bata - halt_bata - total_bill_amount` | UI says “Net Operating Margin”; variable is `netProfit`. |
| FinancialsModule (assigned active vehicles) | `freight_revenue - total_fuel_cost - driver_bata - halt_bata - enroute_repairs_maintenance - bill_amount` | “Net Retention” / “Net Margin”. |
| FinancialsModule (unassigned) | Same as above but **without workshop bills** | “Net Retention”. |
| Dashboard / TelemetryHUD | `freight_revenue - total_fuel_cost - driver_bata - halt_bata - enroute_repairs_maintenance - bill_amount` | “Net Retention”. |
| ReportsModule Financial/P&L | No net formula; trip rows only | Report category is named “Financial/P&L”, but no P&L is calculated. |
| Database RPC | Unknown; generated type says JSON return, no implementation found | Not currently called by these frontend modules. |

These are implementation labels/formulas only; the audit does not assert a formal accounting definition of net profit, operating expense, or retention.

## Date-window analysis

| Source | From / To behavior | Date basis | Inclusive? | Status / spanning-trip behavior |
|---|---|---|---|---|
| ProfitLossModule | Hard-coded lower bound `2026-09-01`; no end date | Trips: `trip_start_date`; fuel: `fuel_date`; workshop: `bill_date` | Lower bound uses `gte`; no upper bound | All statuses. Trip amount and trip costs assigned wholly to start date; fuel/workshop by their own transaction dates. |
| FinancialsModule — Current Fiscal Month | Actually computes first and final calendar day of current month as `YYYY-MM-DD` strings | Same separate trip/fuel/workshop dates above | `gte` start and `lte` end (inclusive for date-valued columns) | All statuses. Trips not split; date of trip start determines period, costs with own dates may fall in another period. |
| FinancialsModule — Custom Dates | Uses selected `customStart` and `customEnd` | Same as above | `gte` / `lte` | Same status and spanning-trip behavior. Initial custom-date defaults use `toISOString().split('T')[0]`, which can shift a local calendar date in non-UTC timezones. |
| FinancialsModule — Lifetime Fleet | No date predicates | Queries all available trips/fuel/bills | Not applicable | Active vehicle plus unassigned aggregation still omits inactive-vehicle records and unassigned bills. |
| ReportsModule — Financial/P&L | Optional date inputs; both blank by default; 1,000 row limit | `trip_start_date` only | `gte` / `lte` | Optional status filter; all amounts are shown at trip-level; not split across periods. |
| Dashboard / TelemetryHUD | Current month start and last day are constructed as local midnight `Date` values, then converted to UTC with `toISOString()` and sliced to date | Trips: `trip_start_date`; fuel: `fuel_date`; workshop: `bill_date` | `gte` / `lte` after conversion | All statuses. In UTC+05:30, local midnight converts to the prior UTC date, so both generated boundary strings are one day earlier than the intended local month (e.g. Sep 1→Aug 31; Sep 30→Sep 29). Actual browser timezone controls this. |
| `get_monthly_pl_summary` | Args types: `p_start_date`, `p_end_date`, both strings; no definition/callsite | Unknown | Unknown | Unknown whether it filters trips, transactions, status, or splits long trips. |
| DriverSettlementModule (related period) | Selected `fromDate` and `toDate`, defaults use local date converted through ISO; queries trips and advances separately | Trips: `trip_start_date`; direct advances: `advance_date` | `gte` / `lte` | Settlement balance covers bata/trip advances/direct advances in those respective date windows. Exact RPC mutation period semantics are unknown. |
| ReportsModule — Driver Settlement (related period) | Filters trips by optional from/to; direct-advance query is not filtered by either date | Trips: `trip_start_date`; advances: all `advance_date` values returned (limited to 1,000) | Trip bounds inclusive; no advance bounds | Can show direct advances outside the selected report period. This is not the Financial/P&L calculation but is a related date-window inconsistency. |

**Date-type limitation:** generated TypeScript represents date and timestamp database values as `string` and does not encode which SQL type is deployed. For a true `date` column, `gte`/`lte` string bounds are natural inclusive calendar-day filters. If any field is a timestamp, passing an end-date string as `lte` may mean midnight at the start of that date and exclude later times; confirm the actual column types and Supabase/PostgREST interpretation before relying on full-day inclusion.

**Dashboard duplicate calculation:** `components/dashboard.tsx` still runs a second calculation starting at the fixed `2026-09-01` with no end date, but its month-related state values are set and never rendered/read in that component. The displayed dashboard finance metrics come from `TelemetryHUD`. This is a redundant non-visible query/calculation, not the visible dashboard P&L. `lib/useFleetTelemetry.ts` contains another duplicate calculation and uses the same `bill_amount` field; no import/call site was found, so it is not an active rendered source.

## Module comparison

| Source | Revenue | Expenses | Net P&L | Date Basis | Source |
|---|---|---|---|---|---|
| ProfitLossModule | Sum `trips.freight_revenue` | Fuel log `total_fuel_cost`; trip driver/halt bata; workshop `total_bill_amount`; excludes enroute repairs | Revenue minus those expenses | From 2026-09-01 onward, no end; trip start, fuel date, bill date respectively | Direct Supabase table reads; no RPC |
| FinancialsModule | Active-vehicle trips + unassigned trips; inactive-vehicle trips omitted | Fuel cost; bata; halt; enroute repairs; active-vehicle workshop `bill_amount`; unassigned workshop omitted; inactive vehicle costs omitted | Per-vehicle net retention plus unassigned retention, with different formula coverage | Current calendar month, custom inclusive bounds, or unbounded lifetime; each source's own event date | Direct Supabase table reads; no RPC |
| ReportsModule | Row-level freight only; no aggregate | Shows bata, halt, enroute repairs, fuel **litres**; no fuel cost or workshop spend in Financial/P&L report | None | Optional inclusive trip-start date bounds; 1,000 trip rows max | Direct Supabase reads; no RPC |
| Database RPC | Unknown | Unknown | Unknown | Type only: p_start_date/p_end_date; semantics unknown | `get_monthly_pl_summary` exists in generated type only; no callsite or checked-in definition |
| Dashboard | Visible TelemetryHUD sums trip freight | Fuel cost, bata, halt, enroute repairs, workshop `bill_amount` | Revenue minus these expenses | Intended current calendar month but UTC-converted date boundaries can shift earlier by a day in positive-offset zones | Direct Supabase reads; no RPC |

## RPC and helper comparison

- `get_monthly_pl_summary` is declared in `lib/database.types.ts` with `{ p_start_date: string; p_end_date: string }` and `Returns: Json`. Repository-wide search found no call and no SQL function definition in the checked-in migrations. Inputs, end-date inclusivity, expense categories, status handling, aggregation and output keys are **unresolved**.
- `view_corporate_fleet_retention` is a generated view type, not an RPC call. Its typed columns include total driver bata, fuel expense, direct trip costs, ad-hoc operating costs, toll expense and shortage penalty. No checked-in SQL view definition or active frontend query was found. Those column names suggest broader categories than the frontend retention formulas, but the exact view formula cannot be inferred from names alone.
- Financial reporting in the inspected modules is computed client-side from direct table reads; no P&L RPC is invoked.
- `settle_driver_period_atomic` is called by `DriverSettlementModule` to mark a driver period settled. It is an operational settlement RPC, not a P&L report source. Its deployed formula/date semantics are not defined in local migrations and should not be presumed to equal P&L.
- `create_workshop_bill_atomic` is called by Accounts and Workshop to enter expense/bill data. It is data-entry, not a reporting RPC. Its deployed target table/date/amount behavior should be checked when confirming the workshop amount field and petty expense inclusion.
- No financial-related SQL function definitions were found in the three checked-in migrations. Therefore local repository evidence cannot reconcile any deployed RPC/view formula.

## Discrepancies

### D1 — Enroute maintenance is excluded by ProfitLossModule but included by Financials and dashboard

- **Exact difference:** Financials/dashboard subtract `trips.enroute_repairs_maintenance`; ProfitLoss does not.
- **Why:** formula divergence in frontend implementations.
- **Intent:** no documentation establishes intent; appears accidental given Financials comment “synchronized math” and dashboard's same formula.
- **Authoritative recommendation:** after owner confirms this field is a distinct expense and not duplicated in workshop bills, include it consistently in the approved company P&L definition.
- **Correction:** consolidate formula logic or use one approved server-side aggregate after verifying deployed schema/RPC; no correction applied here.

### D2 — Workshop amount field differs between financial surfaces and generated schema

- **Exact difference:** P&L and Reports read `total_bill_amount`; Financials/dashboard/hook select and read `bill_amount`; types expose only `total_bill_amount`; write payload uses `p_total_bill_amount`.
- **Why:** inconsistent column naming or stale generated types/deployed schema drift.
- **Intent:** no evidence of intentional split.
- **Impact:** if production follows types, Financials/dashboard workshop query may fail or yield no workshop cost; if `bill_amount` is the deployed column, P&L/Reports/type contract may be stale or fail.
- **Authoritative recommendation:** verify deployed `workshop_spares_bills` columns and RPC body; choose the actual authoritative amount field and align consumers/types.
- **Correction:** none until production schema is verified.

### D3 — Financials aggregate excludes inactive-vehicle records and unassigned workshop bills

- **Exact difference:** Financials queries all records but aggregates only active vehicles and null-vehicle trips/fuel; bills are aggregated only for active vehicles. Its null-vehicle retention does not subtract bills. ProfitLoss sums all trips/fuel/bills in the selected lower-bound range regardless of vehicle active state/assignment.
- **Why:** fleet analytics iterates only `activeVehicles`; unassigned costs do not receive a complete bill allocation.
- **Intent:** may be intentional for current-fleet benchmark analysis, but not for a company-wide P&L; the code's top-level “Total Fleet Revenue/Net Retention” makes scope ambiguous.
- **Authoritative recommendation:** keep Financials explicitly scoped to active fleet if that is the intended analytics function; use an all-record accounting aggregate for company P&L. Do not compare its top-line total as identical to P&L without qualification.
- **Correction:** separately aggregate all records or label/exclude the figures as active-fleet analytics; owner must decide treatment of retired/inactive vehicles.

### D4 — Reports Financial/P&L is a detail listing, not a financial result

- **Exact difference:** It displays trip freight/bata/halt/enroute/fuel litres and has no fuel cost, workshop bill, total expenses, or net P&L. It caps rows at 1,000.
- **Why:** the category maps trips to rows rather than aggregating transactions.
- **Intent:** possibly meant as a trip-cost detail report, but category name implies statement output.
- **Authoritative recommendation:** treat Reports as authoritative historical transaction detail; do not treat this category as the company P&L. After financial definition is approved, either rename it to trip financial detail or make it a reconciled report summary with linked category details.

### D5 — Period windows use different scopes and attribution dates

- **Exact difference:** ProfitLoss is lower-bound-only since 2026-09-01; Financials uses selectable current calendar month/custom/lifetime; visible dashboard intends current month; Reports uses optional trip-start-only filters; RPC semantics unknown. Fuel and workshop dates are separate from trip start.
- **Why:** independent date-window implementations with no shared definition.
- **Intent:** ProfitLoss text explicitly says “from September 1, 2026 onwards”; dashboard month intent is clear; Financials says “Current Fiscal Month” while computing calendar month. Whether “fiscal” should mean a different starting month is unresolved.
- **Impact:** same trips/cost transactions land in different reporting windows. Trips spanning periods are assigned wholly by `trip_start_date`; fuel/workshop remain in their own event-date periods, so costs may post to a different period than associated trip revenue.
- **Authoritative recommendation:** owner chooses accrual/event-date vs trip-start attribution and financial period definition. Then share date utilities/query rules; use a timezone-safe date-only range.

### D6 — Dashboard month boundaries shift in positive UTC-offset browser zones

- **Exact difference:** `TelemetryHUD` converts local midnight boundary Date objects to UTC date strings; at UTC+05:30 both boundary strings move to the prior date.
- **Why:** local calendar dates are serialized as UTC timestamps and then truncated.
- **Intent:** likely accidental.
- **Impact:** metrics can include previous month's final day and omit current month's final day.
- **Authoritative recommendation:** generate date-only strings from local year/month/day without UTC conversion, or define/report in UTC consistently.
- **Correction:** no change applied.

### D7 — Reports settlement advances ignore the selected date range

- **Exact difference:** Driver Settlement report filters trips by from/to but fetches direct advances across all dates (limit 1,000). `DriverSettlementModule` filters direct advances by `advance_date` inside the selected period.
- **Why:** advance query has no date predicates.
- **Intent:** no evidence it is intended to display lifetime advances in a period report.
- **Impact:** detail report can place out-of-period advances beside an in-period settlement view.
- **Authoritative recommendation:** apply the same period semantics to direct advances in the settlement report, after validating whether settlement activity is attributed by advance date or settlement date.

### D8 — Other monetary fields and possible duplicate cost capture are omitted/unclear

- **Exact difference:** all P&L-like formulas omit trip `loading_unloading_expense`, `misc_trip_expense`, `toll_fastag_expense`, `fuel_expense`, `shortage_penalty_deduction`, and standalone `expenses`; they also do not include direct advances as P&L expenses. Financials/dashboard add `enroute_repairs_maintenance` to workshop bills while ProfitLoss does not.
- **Why:** business definitions and source-of-truth mapping are not encoded in shared logic/documentation.
- **Intent:** unresolved; some values may be duplicates, settlement deductions, or legacy fields and should not be summed blindly.
- **Authoritative recommendation:** owner/accountant classifies each field/table and confirms which is revenue, operating expense, settlement balance, deduction, cash advance, or duplicated representation.
- **Correction:** no amounts added/removed before that approval.

## Authoritative-source recommendation

For historical transaction detail, keep the central Reports module as the navigation/source for trip, fuel and workshop records. For **company P&L totals**, none of the current UI surfaces is authoritative yet: their formulas or periods diverge, and the RPC definition is unavailable. The generated `get_monthly_pl_summary` contract is not enough to establish a canonical calculation.

After business-owner decisions and live schema verification, designate one P&L formula/date policy and one calculation path as canonical. Financials may remain a separate active-fleet analytics view if its scope is explicitly active fleet; it should not be represented as an equivalent company-wide P&L. The current dashboard should consume the approved summary rather than reimplementing it independently.

## Financials vs P&L architecture recommendation

**Recommend Option B as a later navigation/product grouping, without merging implementations now:** a Financial Management area can contain a company P&L statement and separate Fleet Economics/Driver Economics/Cost Analysis views. Evidence supports distinct responsibilities: `ProfitLossModule` attempts a consolidated time-window statement; `FinancialsModule` is vehicle/driver benchmarking by active fleet; dashboard is a current operational snapshot; Reports is row-level history. A shared parent can organize them, but their data scope and calculation services should remain distinct until formulas and accounting policy are reconciled. No component merge is recommended as part of this audit.

## Required fixes after owner approval

1. Confirm production column names, data types, RPC bodies and view definition for workshop amounts, `get_monthly_pl_summary` and `view_corporate_fleet_retention`.
2. Approve one company P&L revenue/expense category map and decide treatment of incomplete trips, fuel snapshots vs fuel logs, direct advances, petty expenses, toll/loading/miscellaneous, shortage deductions, enroute repairs and workshop bills.
3. Decide accounting attribution: trip-start date, trip-end/closure date, transaction date, or split across periods; define local/fiscal timezone and inclusive end-date behavior.
4. Fix/align the workshop amount-field contract and inspect query errors rather than silently treating failures as zero.
5. Separate company totals from active-fleet analytics; include/explicitly exclude inactive and unassigned records by design.
6. Make the Reports Financial/P&L section either a detail report with accurate labeling or a true reconciled period report; apply date bounds consistently to its direct-advance rows.
7. Use one date-only range utility and one approved formula source for all P&L-like widgets. Reassess the unused dashboard sidecar calculations/hook only during an explicitly authorized cleanup.

## Business-owner confirmation required

- Is P&L intended to include all trip statuses, or only completed/closed/POD-settled trips?
- Should revenue be attributed to dispatch/start date, POD/closure date, invoice date, or another date? Should multi-period trips be split?
- Are diesel logs the authoritative fuel cost, or should `trips.fuel_expense` be used for any period/use case?
- Are `driver_bata` and `halt_bata` expenses at earning date, settlement date, or payment date?
- Are `cash_advance_issued` and `driver_direct_advances` advances/receivables deducted from settlement rather than expenses? (Current P&L excludes them.)
- Should petty expenses entered through `create_workshop_bill_atomic` be included in workshop cost or categorized separately?
- Do `enroute_repairs_maintenance` and workshop bills ever represent the same repair? If yes, which record is canonical to prevent duplicate expense?
- Do toll, loading/unloading, misc trip expense, shortage penalty, and the `expenses` table belong in operating P&L? Are any fields obsolete/duplicative?
- Does “Current Fiscal Month” mean calendar month or a different fiscal calendar? Which timezone governs report dates?
- Should fleet analytics include inactive vehicles in historical performance and totals?

## Files inspected

- `components/ProfitLossModule.tsx`
- `components/FinancialsModule.tsx`
- `components/ReportsModule.tsx`
- `components/dashboard.tsx`
- `components/TelemetryHUD.tsx`
- `components/DriverSettlementModule.tsx` (related settlement period semantics)
- `components/AccountsModule.tsx` and `components/WorkshopModule.tsx` (expense/bill-entry data paths)
- `lib/database.types.ts`
- `lib/useFleetTelemetry.ts` and repository-wide financial/date/helper searches
- all `supabase/migrations/*.sql` (no financial RPC definition found)
- relevant report/settlement RPC call sites

## Read-only validation

`git status --short` was inspected before and after this audit. The repository already had application/UI/security/config modifications, `.before-*` backups, and prior audit reports before this task began. Those were left untouched. The only new file from this task is `audit/pnl-reconciliation-audit.md`. `git diff --check` was run; see final response for its result. No application, database, migration, RPC, or financial calculation code was modified. No transaction was created; no commit or push was made.

