# Historical Data Search and Pagination Audit

**Scope:** Move historical search and pagination to the database — read-only inventory
**Repository:** `C:\Users\unnik\kss-erp`, branch `design/premium-ui-v2`
**Audit date:** 2026-09-27
**Change boundary:** This report is the only file created for this task. No source, SQL, migration, RPC, or business logic was changed.

## 1. Executive summary

The shared `usePagination` hook slices in-memory arrays. `components/ui/Pagination.tsx` renders controls but does not query Supabase; `usePagination.ts` calls `items.slice(...)` after the complete capped/uncapped result has loaded.

The largest issue is `ReportsModule`: nine reads across eight report categories use `.limit(1000)`, then many datasets are filtered in the browser and paginated 10 rows at a time. Some predicates run in SQL; others run after fetch. CSV/Excel/PDF use the full filtered in-memory result, not just the visible page, but results are still capped by the query limits. The present path is hybrid:

```text
Database predicates (some filters/search) → at most 1,000 selected rows
→ remaining client filtering → client page of 10 → display
```

Other high-growth cases include 200-row diesel and AdBlue edit pickers, uncapped pending POD and approval queues, and tyre reads that include disposed lifetime history before client filtering. `ModifyTrips` already filters on the server but caps at 200 and paginates locally. Driver Portal data comes from RPCs whose SQL is absent from local migrations; response limits/search cannot be verified.

Financials, P&L, Insights and dashboard fetch transaction rows to aggregate in the browser. These are aggregate analytics; future optimization should generally move aggregation to the database, not page incomplete source rows. Live queues, small selectors, latest-rate lookups and bounded alerts should not be paginated merely for consistency.

**FACT:** the three checked-in migrations define no indexes. `database.types.ts` has no index metadata. **UNKNOWN:** deployed indexes, Supabase max-row configuration, production row counts, RPC definitions and query plans.

## 2. Evidence labels

- **FACT** — verified in checked-in source/types/migrations.
- **RECOMMENDATION** — proposed architecture, not implemented.
- **UNKNOWN** — requires production schema/configuration, RPC definition, or workload measurement.

“Uncapped” means no explicit application `.limit()`/`.range()` exists. A project PostgREST max-row setting may still cap it; configuration was not available.

## 3. Current fetch/search/filter/pagination matrix

| Module / file | Dataset / source | Current fetch limit | Current server filters | Current client filters/search | Client sort | Pagination | Growth risk | Class | Recommended database-side strategy | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| Reports — Trips (`trips`) | Historical trips + vehicle/driver embeds | `.limit(1000)` | Optional `trip_start_date` from/to, `trip_status`, `trip_number ILIKE`; order date desc + `trip_id` desc | None post-query | Server stable order | 10 after fetch | High; may exceed cap | D | Server filters + `.range()` + count; keep stable order | P1 |
| Reports — POD (`trips`) | POD history + vehicle/driver | `.limit(1000)` | Optional trip-start range, `pod_status`, OR partial LR/POD number; stable date/id order | None post-query | Server stable | 10 after fetch | Medium/high | D | Server page after existing filters; preserve multi-column partial search | P1 |
| Reports — Diesel/Fuel (`diesel_fuel_logs`) | Fuel transactions + vehicle | `.limit(1000)` | `fuel_date`, exact category; date/id ordering | Vehicle number/category case-insensitive substring | Client filter | 10 after fetch | High | D | Push search/filters to SQL; resolve vehicle relation/filter; count same predicate | P1 |
| Reports — Driver Bata (`trips`) | Bata/advance trip rows + driver/vehicle | `.limit(1000)` | Start-date range, settlement status, stable date/id order | Partial LR/name/code/vehicle search | Client filter | 10 after fetch | High | D | Server-filter; relation search via join filters or view/RPC | P1 |
| Reports — Driver Settlement trips (`trips`) | Trip settlement rows + driver/vehicle | `.limit(1000)` | Trip-start range, settlement status; stable date/id order | LR/name/code/vehicle search | Client filter | Combined page 10 | High | D | Server-page trip rows; relationship search needs embedded filters/view/RPC | P1 |
| Reports — Driver Settlement advances (`driver_direct_advances`) | Direct advances + driver | `.limit(1000)` | No date/status; order advance date desc only | Driver/code/type/remarks search | Client filter | Combined page 10 | High; period mismatch | D | Add approved date scope; page/count with `advance_id` tie-break; consider unified view/RPC | P1 |
| Reports — Workshop (`workshop_spares_bills`) | Workshop bills + vehicle | `.limit(1000)` | Optional bill-date range; bill date desc | Vendor/vehicle/description partial search | Client filter | 10 after fetch | High | D | Server search/page; stable bill date + bill_id | P1 |
| Reports — Fleet/Vehicle (`vehicles`) | Vehicle snapshot/report | `.limit(1000)` | Exact current status; vehicle number asc | Number/type/status substring | Client filter | 10 after fetch | Low/medium, fleet bounded | D | Keep local if small; otherwise server search/range + vehicle_id tie-break | P3 |
| Reports — Financial/P&L (`trips`) | Trip-level financial detail, not aggregate | `.limit(1000)` | Optional trip-start range/status; stable date/id order | LR/vehicle partial search | Client filter | 10 after fetch | High | D | Server page/search; multi-table report may need approved view/RPC | P1 |
| FuelAdvance — diesel picker (`diesel_fuel_logs`) | Existing entry edit/delete | `.limit(200)`, latest date/id | None beyond ordering | Lowercase partial vehicle/LR search | None | No pagination; searches newest 200 only | High; older records unreachable | B | Server search and page; preserve edit/delete actions | P1 |
| FuelAdvance — AdBlue picker (`adblue_logs`) | Existing entry edit/delete + vehicle/vendor | `.limit(200)`, latest date/id | None beyond ordering | Partial date/truck/LR/vendor/remarks search | None | No pagination; newest 200 only | High | B | Server search/page; relation filters for vehicle/vendor; stable date/id | P1 |
| ModifyTrips (`trips`) | Trip edit picker + vehicle/driver | `.limit(200)` | Specific/range dates, truck, status, LR `ILIKE`; date/id stable order | No additional search | Server order | 10 of capped 200 | High; broad query can hide older records | B | Replace hard cap with `.range()`/count, preserve filters and stable ordering | P1 |
| PodClosure (`trips`) | Pending POD action picker | Uncapped | `pod_status=PENDING_SUBMISSION`; start date asc | Case-insensitive LR/truck/origin/destination/driver | None | 10 after client search | Backlog may grow | B | Keep pending predicate; server search/range/count, relation query if needed; add trip_id tie-break | P1 |
| ApprovalQueue (`driver_pending_entries`) | Pending approval workflow; vehicles fetched separately | Uncapped | `status=PENDING`, submitted_at desc | Truck/driver/type/remarks/date/litres/odo substring; vehicle number mapped client-side | None | 10 after client search | Backlog may grow | B | Server page/search/count, vehicle relation, submitted_at + entry_id order | P1 |
| Fuel/POD — pending scans (`pending_scans`) | Operational scanned-document queue | Uncapped | Fuel and POD use document_type + `status=PENDING`, ordered created_at desc | No historical search; rows are consumed by operational workflow | None | No pagination | Backlog may grow, but queue is action-required | B | Preserve document-type/status filters; page only if backlog warrants; keep scan actions bound to exact selected scan IDs | P2 |
| Workshop — mounted/store (`fleet_tyres`) | Current operational tyres + vehicle | Uncapped full tyre table | None | Status partition; serial/vehicle or brand search | None | No pagination | High because same read includes lifetime disposed records | A | Keep action list; query current statuses separately; page only if live set warrants | P2 |
| Workshop — Tyre History (`fleet_tyres`) | Disposed tyres | Same full tyre read | None | `SCRAPPED` status and serial substring | None | 10 after in-memory filter | High over lifecycle | C | Separate status-filtered server query; serial search/range/count; recorded date + tyre_id | P1 |
| DriverPortal — live workspace (`get_driver_portal_data`) | Session vehicles/active trips | RPC-defined; none visible client-side | Session token only in client call; SQL unknown | Client selects current assigned trip | Trip ID desc client sort | None | Intended small live context | A | Preserve; inspect RPC scope before any paging | Verify RPC |
| DriverPortal — monthly report (`get_driver_monthly_reports`) | Monthly trips, advances, pending requests | RPC-defined; arrays stored whole | Session token + month start; SQL unknown | Browser reduces and maps arrays | No visible server-order contract | None | Medium/high monthly growth | D | Inspect SQL; aggregate summary and page details without changing totals | P2 |
| SetupModule masters | vehicles, drivers, freight, bata, app users, vendors | Uncapped | Ordered by display field | Vendor name/type/subcategory/phone substring; other lists not searched | Server order | None | Usually small; vendor/driver may grow | B | Load selected sublist on demand; server vendor search only if counts justify | P3 |
| FleetTable (`vehicles`) | Live fleet/status | Uncapped | Vehicle number order | Partial number/type/status/remarks search | None | 10 after local filter | Low/medium bounded | A | Keep live view; server paging only if measured fleet size warrants; add vehicle_id tie-break | P3 |
| FinancialsModule source | Fleet/driver performance aggregates | No explicit limit; Lifetime has no date bound | Current/custom date bounds and active vehicle/driver lookups | Transaction rows grouped client-side; derived fleet/driver search | Client sort by selected metric | Derived detail popup 10/page | High for lifetime transactions | E | Database aggregation by window/vehicle/driver, then page aggregate rows | P1 |
| ProfitLossModule | Historical financial totals | No explicit limit/range; lower date bound only | `>= 2026-09-01` per table date | Client sums all received rows | None | None | High; API cap may truncate | E | Approved aggregate RPC/view; explicit period; do not page raw rows for a total | P1 |
| TelemetryHUD | Current-month totals + live vehicles | Financial rows uncapped; vehicles uncapped | Month dates; status/count filters | Client sums transactions/classifies vehicles | Client status classification | None | Monthly growth; fleet bounded | E (totals) + A (live) | DB aggregate for totals; keep small live queries | P1 totals |
| dashboard.tsx duplicate | Fixed-baseline totals assigned to unused state | Uncapped; no end date | `>=2026-09-01`; status/vehicle reads | Client aggregate; values not rendered/read | Client status classification | None | Needless growing reads | E / dormant | Verify execution necessity; do not paginate unused computation | P2 later |
| Insights (`trips`, `diesel_fuel_logs`) | Distance/tonnage totals since baseline | Uncapped, lower bound only | Date lower bounds | Client reduces trips; fuel array fetched but unused in displayed totals | None | None | High and unnecessary fuel transfer | E | Database aggregate KM/tonnage; avoid unused fuel fetch | P2 |
| `useFleetTelemetry` hook | Duplicate monthly aggregate | Uncapped | Current month/status | Client classifies/sums | Client | None | Medium; no import/call found | E / apparently unused | Verify unused status; aggregate if retained | P3 |
| LiveAlertsWidget | Compliance + recent event alerts | Active vehicles/drivers uncapped; recent trips uncapped; fuel `.limit(3)` | Active rows; recent dates | Builds alert items in client | Client combine/sort | No table | Low/medium | A | Keep live alerts; narrow recent window and deterministic order | P3 |
| AiInsightsDashboard (`daily_ai_audits`) | Latest audit only | `.limit(1)` | Audit date desc | None | Server order | Not needed | Low, bounded | A | Keep as-is | No change |
| TripForm route autocomplete (`trips`) | Recent origins/destinations | `.limit(300)` | None; created_at desc | Client distinct extraction | Source order inherited | Not paginated | Low/medium; sample can miss older unique routes | B | If completeness matters, query authoritative distinct/master list; preserve “recent” semantics if desired | P3 |
| DriverSettlementModule | Chosen driver's period trips/advances | Uncapped | Driver ID + date ranges; date order | Client summary arithmetic | Server order, no unique tie-break | No detail paging after purge | Low/medium for unusually long periods | B | Keep calculation workflow; consider server aggregate only after proving arithmetic equality; add stable IDs | P3 |
| Cron audit API (server, not browser) | Recent samples and pending PODs | Trips 60, fuel 60, repairs 30; pending POD uncapped | POD status; recent orders | Server audit computations | Server order; some tie-breaks absent | Not applicable | Pending backlog may grow | A/E | Not UI paging target; bound/aggregate only if audit semantics permit | P3 |

**Classification:** A operational/live; B picker/search; C historical transactional; D historical report; E aggregate analytics. Rows that share a broad fetch (e.g. tyre inventory/history) are split by actual purpose.

## 4. ReportsModule deep audit

### Query and filter behavior

Eight report types perform nine select queries because Driver Settlement loads trips and direct advances separately. All nine use `.limit(1000)`.

- Trips: start/end, status and LR `ILIKE` are server-side.
- POD: date, POD status and LR/POD number OR search are server-side.
- Diesel: date/category are server-side; vehicle/category search is client-side.
- Driver Bata: date/settlement status are server-side; LR/driver/code/vehicle search is client-side.
- Driver Settlement: trips get period/status predicates; advances have no date/status filter. Search is client-side on both arrays before merging.
- Workshop: bill date is server-side; vendor/vehicle/description search is client-side.
- Fleet/Vehicle: status server-side; text search client-side.
- Financial/P&L: trip-start date/status server-side; LR/vehicle search client-side.

The result array is then paged locally by `usePagination(rows,{pageSize:10})`. The displayed record count is the number of rows retained in the browser (after client filtering), not necessarily the true database match count beyond 1,000.

### Search, ordering, and count

Search and filters run only when **Generate Report** is clicked. Trips/POD/Driver Bata/Settlement trips/Financial P&L have deterministic date + trip_id order. Diesel has date + fuel_log_id. Workshop order lacks a bill_id tie-break; direct advances lack advance_id; Fleet lacks vehicle_id. Those need unique tie-breaks before stable DB pages.

Client filters happen after up to 1,000 rows are fetched. Some free-text searches are pushed into PostgREST (`ilike`, `.or`); relationship-field searches are not. Query count is not requested; the UI count is client array length.

### Exports

CSV/Excel take `normalizedRows`, derived from all filtered `rows`, not just the current `paginatedItems`. PDF also maps all `normalizedRows`. Current export behavior is full loaded filtered result, **up to the query cap**, not current visible ten. Driver Settlement can cap two source arrays independently.

**RECOMMENDATION:** keep screen page retrieval separate from full-result export. Export should apply the same report type, dates, status, search and ordering, then retrieve all matching records through deterministic pages (or a dedicated RPC/background export for large or merged reports). Do not silently switch exports to the visible 10 rows. The current 1,000 cap means “all matching” is not guaranteed at scale.

### `.range()` feasibility

Supabase `.range(from,to)` can replace local slice for numbered historical pages after server filters and deterministic order. End index is inclusive; page 1 of ten records uses 0–9. Pair with `{count:'exact'}` only when UI needs accurate total pages/count; exact count cost should be measured. Same predicates must apply to page, count, and export. For volatile queues, offset pages may shift as rows arrive/are acted on; keyset paging plus refresh may be safer than exact page numbers.

## 5. Popup/search audit

| Popup/list | Current behavior | Server-side opportunity | Count/order notes |
|---|---|---|---|
| Modify Trips | Server filters first, hard cap 200, local page 10 | Replace cap with `.range()` while preserving date/truck/status/LR filters | Exact total useful; date + trip_id already stable |
| Pending POD | Uncapped pending-only queue, JS search over joined fields, page 10 | Filter/search before page; joined vehicle/driver search may need relation filters or RPC | Count matching pending; add trip_id tie-break; refresh on closure |
| Approval Queue | Uncapped pending rows + vehicle list; JS search text/numeric/date; page 10 | Server pending page/search; embed vehicle or filter IDs | submitted_at + entry_id stable; mutation can shift offsets |
| Diesel picker | Newest 200 only, client truck/LR search, no pagination | Server LR/vehicle/date/category search and page | Date + fuel_log_id already deterministic |
| AdBlue picker | Newest 200 only, client date/truck/LR/vendor/remarks search, no pagination | Server text/relationship filters and page | Date + adblue_log_id stable; remarks contains-search may require trigram |
| Tyre History | Fetch all tyre rows; then client SCRAPPED + serial filter, page 10 | Separate server SCRAPPED query and serial filter | recorded_date + tyre_id tie-break |
| Fleet popup | All vehicles, client search, page 10 | Possible, but fleet is live and bounded | Only if measured size requires; add vehicle_id tie-break |
| Financials vehicle/driver popups | Fetch transactions, aggregate in browser, then search/page derived rows | Aggregate by vehicle/driver/window in DB; page groups, not raw transaction fragments | Count groups, preserve metric formula |
| Setup master lists | Fetch every master table on mount; vendor search client-side | Load selected sub-list on demand; server vendor search if large | Count/paging only when actual size warrants |
| DriverPortal monthly ledger | RPC arrays loaded whole; browser computes summary/maps rows | Inspect deployed RPC; aggregate totals and page details only if needed | Function SQL/limits/count unknown |
| DriverPortal live trip picker | Session RPC returns active trips/vehicles; client filters/sorts | Preserve unless RPC returns broad history | Verify RPC scope; active set should remain small |

## 6. Supabase/index audit

**FACT:** the three checked-in migrations contain no `CREATE INDEX`; generated types do not describe indexes. **UNKNOWN:** production secondary indexes, row counts and query plans; primary key index existence is not asserted from this audit.

Evaluate the following candidates against actual production query plans before proposing migrations:

| Query pattern | Candidate access path |
|---|---|
| Trips date report | `(trip_start_date DESC, trip_id DESC)` |
| Modify trip by vehicle/date | `(vehicle_id, trip_start_date DESC, trip_id DESC)` |
| Pending POD queue | Partial `(trip_start_date, trip_id)` where POD status pending, or status/date/id composite |
| Settlement trips | `(primary_driver_id, trip_start_date, trip_id)` |
| Diesel latest/history | `(fuel_date DESC, fuel_log_id DESC)`; possibly vehicle/date/id |
| AdBlue history | `(adblue_date DESC, adblue_log_id DESC)`; possibly vehicle/vendor/date |
| Workshop bills | `(bill_date DESC, bill_id)`; possibly vehicle/date/id |
| Tyre history | `(tyre_status, recorded_date DESC, tyre_id)`; serial lookup strategy |
| Pending approvals | `(status, submitted_at DESC, entry_id)` |
| Direct advances | `(driver_id, advance_date, advance_id)` |
| Master lists | Active flag/order columns only if measurements justify |

B-tree indexes generally do not support arbitrary `ILIKE '%term%'` well. **RECOMMENDATION:** evaluate `pg_trgm` or a dedicated search view/RPC for high-volume substring fields after verifying production extension support and query plans. Relationship search may need FK indexes or a different query shape. No indexes are created here.

## 7. Search semantics audit

| Current search/filter semantics | Examples | Equivalent and caveats |
|---|---|---|
| Case-insensitive partial text via lower-case `includes` | Fuel truck/LR; AdBlue date/truck/LR/vendor/remarks; POD LR/route/driver; Approval; Fleet; tyre serial; Setup vendors; analytics popup | `ILIKE '%term%'` is close for text, with proper escaping. Joined fields need relationship filters/view/RPC. Leading wildcard may need trigram index. |
| Existing DB substring match | Reports Trips LR; Reports POD LR/POD; ModifyTrips LR | Already `ILIKE`; retain same wildcard semantics when adding paging. |
| Multi-column OR | Reports POD search | Base-table `.or()` is supported; embedded relation OR needs validated syntax or RPC/view. Escape PostgREST filter punctuation and `%`/`_`. |
| Exact status/category | Reports status; pending queue status; POD status; ModifyTrips status | Preserve `.eq()` and null/status mapping. |
| Inclusive date range | Reports, ModifyTrips, settlement and analytics | `.gte(from).lte(to)` is calendar-inclusive for SQL date fields. If a deployed field is timestamp, end-date literal might exclude times after midnight; production types/timezone are UNKNOWN. |
| Numeric/date substring | Approval searches litres, odometer and submitted date; AdBlue searches date string | Converting to numeric/date range changes meaning: current “2” can match “12”; keep text-cast contains or approve a new contract. |
| Recent unique route autocomplete | TripForm takes newest 300 rows and derives unique origins/destinations | It is a sample, not complete distinct history; server `DISTINCT`/master list must preserve whether “recently used” is desired. |

## 8. Recommended database-pagination architecture

1. Keep query state together: report type, dates, status, search, sort, page and page size.
2. Apply filters/search on the database before `.range()`; explicitly reset to page 1 on any predicate/order change, even if result count stays the same.
3. Order by current date and a unique key for every page. Use date+ID for trips, fuel, bills, advances, tyres, approvals and vehicles as appropriate.
4. Return page rows and a matching count. Use exact counts only where numbered pages/“N records” require them; if count is approximate or next-page-only, make that UI contract explicit.
5. Clamp after deletes; refresh volatile queues after approval/closure. Consider keyset pagination for high-churn queues.
6. Preserve page size 10 as the default; do not treat current `usePagination` as server paging.
7. Keep query, count and export predicates identical; preserve deployed RLS/session role on every request.
8. For KPI/scorecard/P&L datasets, aggregate in SQL rather than paging raw transactions into the browser. Formula safety is separate and must be confirmed before aggregation changes.

**Shared component relationship:** `Pagination.tsx` accepts page, totalPages and callback only and can render either local or server page controls. `usePagination.ts` owns local state, slices arrays, resets only on item-count change, and clamps pages. **RECOMMENDATION:** retain the visual control but use separate server-page state/hook for loading, range, count and cancellation. Add explicit reset on filter/search changes; current count-only reset does not detect equal-length new results.

## 9. Export architecture

- **FACT:** Reports exports all currently loaded filtered rows, not only current page; query caps still limit completeness.
- **RECOMMENDATION:** re-run same filters/search/order in an export path and iterate stable `.range()` pages until exhausted, or use an authorized export RPC/background job for large or merged data. Keep memory bounded and respect configured maximum rows.
- **RECOMMENDATION:** Driver Settlement may need an export/report RPC because it merges trips and advances; make date semantics identical for both sources.
- **FACT:** Financials CSV exports all derived fleet/driver rows, not only current 10-row popup page. After DB aggregation, export must retrieve all matching aggregate groups for the same filters.
- Do not change exports to only the visible 10 rows unless the product explicitly introduces “export current page.”

## 10. Datasets that should NOT be changed as historical paging

- Live vehicle status, current availability, immediate alerts and recent events.
- Pending POD, pending approval, fuel slip and other operational queues as workflows. Their row loading can be paged, but keep the queue, actions, filters, validations and state transitions.
- Small driver/vehicle/vendor/freight/bata selectors and master tables until counts show need; load on demand before introducing paging UX.
- `.limit(1)` latest fuel-rate and latest AI audit lookups; `.limit(3)` recent fuel alerts.
- TripForm previous driver `.limit(1)` and scalar odometer RPC.
- DriverPortal session-scoped active-trip picker unless deployed RPC shows broad history.
- Mounted/in-store tyre action lists. Query statuses separately from disposed history, but keep operational actions directly available.
- Workshop/Accounts entry forms, trip/freight/bata calculations, settlement, POD, diesel validation, odometer validation, workshop/tyre lifecycle, approval rules and all RPC mutations.

## 11. Priority list

1. **P1 ReportsModule:** server-page nine report selects; push remaining search filters; stable tie-breaks; preserve full-result exports.
2. **P1 Diesel/AdBlue picker:** older records are unreachable beyond newest 200; server search/page while retaining edit/delete actions.
3. **P1 ModifyTrips:** retain all filters, replace hard 200 cap with server range/count.
4. **P1 POD/Approval queues:** server-search/page pending sets and refresh after actions; keep operational workflow.
5. **P1 analytics:** database-side aggregates for Financials/P&L/dashboard/Insights, not partial raw-page totals. Use separately approved formula.
6. **P1 Tyre History:** separate disposed status query from active inventory; server search/page history.
7. **P2 DriverPortal monthly RPC:** inspect deployed SQL and response sizes before changing; page detail and preserve summary.
8. **P2 driver settlement preview:** optimize only if selected periods are large and calculation equality can be established.
9. **P3 setup/fleet:** measure sizes; load selected master lists on demand, paginate only if warranted.
10. **P3 autocomplete/dormant reads:** assess TripForm’s newest-300 route sample and unused duplicate aggregate separately.

## 12. Risks and migration considerations

- Search must preserve partial/case-insensitive/null/numeric/date semantics; changing contains to prefix/exact changes behavior.
- Page and count must have identical predicates and RLS. Stable unique order prevents duplicate/omitted rows.
- Inserts/deletes can shift offset pages in queues; refresh after actions or use keyset cursors.
- Full exports must not accidentally become current-page exports; existing 1,000 caps may already truncate results.
- Embedded relationship search and `%term%` may need views/RPC or trigram indexes; validate production plans/extensions first.
- Count performance depends on row counts, joins and RLS; measure before exact count on every keystroke.
- RPC SQL, configured PostgREST max rows, production column/index definitions and actual workload are not available locally.
- The audit is data-access only. It must not change calculations, validation, settlement/POD/fuel/odometer/business rules, RPC payloads, lifecycle states or approvals.

## 13. Files and database objects inspected

Reviewed ReportsModule, FuelAdvanceModule, ModifyTrips, PodClosure, ApprovalQueue, WorkshopModule, FleetTable, FinancialsModule, ProfitLossModule, DriverPortal, DriverSettlementModule, SetupModule, TripForm, TelemetryHUD, LiveAlertsWidget, Insights, AiInsightsDashboard, dashboard.tsx, `components/ui/Pagination.tsx`, `components/ui/usePagination.ts`, `lib/useFleetTelemetry.ts`, `lib/database.types.ts`, API/lib call sites, and all checked-in `supabase/migrations/*.sql`.

**FACT:** migrations contain no `CREATE INDEX`; generated types contain no index metadata. **UNKNOWN:** deployed indexes and SQL/RPC page behavior. Production catalog and `EXPLAIN` review are prerequisites before migrations are proposed.

## 14. Validation and change boundary

`git status --short` was recorded before and after. The starting tree already contained intentional source/config changes, `.before-*` backups, and previous audit reports; these were left untouched. The only new file from this task is `audit/historical-data-pagination-audit.md`. `git diff --check` was run; result is in the final response. No application source, SQL, migration, RPC, schema, business logic, or backup file was edited. No commit or push was made.

