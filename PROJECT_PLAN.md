# KSS Roadways ERP — Project Plan

## Project Goal

Build a production-ready, world-class fleet ERP for a small fleet operator.

Simple on the surface, sophisticated underneath.

---

# Architecture

Dashboard → Main Module → Functional Menu → Action → Workspace

---

# Master Navigation

## Dashboard
Landing page / fleet command center.
Keep existing dashboard intact except remove Quick Links.

## Operations
- Trip Dispatch
- POD Closure
- Modify Trip
- Quick Status

## Accounts
- Advance
- Expense
- Reconcile

## Fleet
- Tyre Management
- Workshop Work Details
- Fuel Issue / Modify
- AdBlue Issue / Modify
- Inventory

## Master
- Truck
- Driver
- Freight Rate
- Driver Bata
- Vendors
- Customers
- Users
- Users/Admin management restricted to Superadmin

## Reports
- Fleet Analytics & Margin
- Driver Settlement
- P&L Report
- Outstanding Expense / Revenue
- Diesel Mileage
- Trip Audit

## AI — Future Phase
- Uploads / OCR
- Driver Logs
- Insights
- GPS / Live Location

---

# PROJECT STATUS

Legend:

[ ] Not Started
[~] In Progress / Partially Complete
[✓] Complete
[!] Blocked

---

# P0 — Baseline & Project Control
Target: 0.5 day

[✓] P0.1 Create project plan
[✓] P0.2 Audit current repository
[✓] P0.3 Audit current database/schema
[✓] P0.4 Map existing modules to target architecture
[✓] P0.5 Identify obsolete/duplicate UI
[✓] P0.6 Establish safe historical-data cleanup plan

Status: COMPLETE

Notes:
- Project architecture and module boundaries established.
- Database/schema audited against the application.
- Safe historical-data cleanup deferred to P7.
- Dangerous Git operations prohibited.
- .before-* backups must remain untouched.

---

# P1 — Core Navigation Architecture
Target: 1 day

[✓] P1.1 Refactor main navigation
[✓] P1.2 Implement module landing workspaces
[✓] P1.3 Implement functional module menus
[✓] P1.4 Implement action → workspace flow
[✓] P1.5 Remove obsolete top-level tabs
[✓] P1.6 Remove Dashboard Quick Links
[✓] P1.7 Verify role-based navigation
[✓] P1.8 Desktop/mobile navigation QA

Status: COMPLETE

Notes:
- Navigation is module-based.
- Module landing → functional menu → action workspace architecture implemented.
- Dashboard remains the command center.
- Further permission-matrix hardening remains part of P8.

---

# P2 — Operations
Target: 2 days

[✓] P2.1 Trip Dispatch
[✓] P2.2 POD Closure
[✓] P2.3 Modify Trip
[✓] P2.4 Quick Status
[✓] P2.5 Operations validation
[✓] P2.6 Operations workflow QA

Status: COMPLETE

Notes:
- Existing business logic preserved.
- Shared Liquid Glass dialog architecture applied to major workflows.
- Dispatch, POD and trip modification workflows retained.

---

# P3 — Accounts
Target: 1.5 days

[✓] P3.1 Driver Advance
[✓] P3.2 Expense
[✓] P3.3 Reconcile
[✓] P3.4 Accounts validation
[✓] P3.5 Accounts workflow QA

Status: COMPLETE

Notes:
- Existing Accounts workflows preserved.
- Further visual consistency cleanup remains for P9.

---

# P4 — Fleet
Target: 2 days

[✓] P4.1 Tyre Management
[✓] P4.2 Workshop Work Details
[✓] P4.3 Fuel Issue / Modify
[✓] P4.4 AdBlue Issue / Modify
[✓] P4.5 Inventory
[✓] P4.6 Fleet validation
[✓] P4.7 Fleet workflow QA

Status: COMPLETE

Validated:
- Tyre lifecycle workflows
- Workshop work details
- Fuel issue/modify
- AdBlue issue/modify
- Spare-parts inventory
- Inventory purchase and issue RPCs
- Inventory immutable stock ledger
- Fleet orphan/data validation
- TypeScript
- Production build

Known fleet data baseline:
- vehicles: 21
- drivers: 26
- trips: 418
- diesel_fuel_logs: 220
- workshop_spares_bills: 93
- inventory_items: 4
- inventory_purchase_bills: 4
- inventory_purchase_items: 3
- inventory_stock_movements: 4

---

# P5 — Masters
Target: 2 days

[ ] P5.1 Truck Master
[ ] P5.2 Driver Master
[ ] P5.3 Freight Rate Master
[ ] P5.4 Driver Bata Master
[ ] P5.5 Vendor Master
[ ] P5.6 Customer Master
[ ] P5.7 User/Admin Master
[ ] P5.8 Master validation
[ ] P5.9 Master workflow QA

Status: NOT STARTED

Next functional phase.

Rules:
- Inspect existing master implementation before modifying.
- Preserve existing business logic.
- Use protected RPCs for privileged mutations.
- User/Admin management must remain Superadmin-only.
- No direct unsafe client writes to protected master data.
- Search-first and paginated large master lists.
- Use centered Liquid Glass workspaces where appropriate.

---

# P6 — Reports
Target: 2 days

[ ] P6.1 Fleet Analytics & Margin
[ ] P6.2 Driver Settlement
[ ] P6.3 P&L Report
[ ] P6.4 Outstanding Expense / Revenue
[ ] P6.5 Diesel Mileage
[ ] P6.6 Trip Audit
[ ] P6.7 Search/filter/pagination
[ ] P6.8 Excel exports
[ ] P6.9 PDF exports
[ ] P6.10 Reports QA

Status: NOT STARTED

Important:
Reports must own historical and analytical presentation.
Do not duplicate operational workflows merely to produce reports.

---

# P7 — Data Integrity & Historical Cleanup
Target: 2 days

[ ] P7.1 Audit orphan records
[ ] P7.2 Audit trip relationships
[ ] P7.3 Audit vehicle relationships
[ ] P7.4 Audit driver relationships
[ ] P7.5 Odometer integrity
[ ] P7.6 Fuel integrity
[ ] P7.7 Trip distance validation
[ ] P7.8 Historical-data cleanup plan
[ ] P7.9 Safe cleanup execution
[ ] P7.10 Clean starting dataset verification

Status: NOT STARTED

Critical requirements:

Odometer:
- Starting KM required before trip.
- Closing KM required before next trip.
- New KM must never be equal to or lower than previous valid KM.
- Every vehicle odometer entry must be timestamped.
- Backward/negative odometer movement must be detected.
- Route distance must be validated against configured route KM.
- Abnormal trip distance must be flagged using configured tolerance/min-max rules.

Fuel:
- Validate fuel quantity and cost.
- Validate vehicle relationship.
- Cross-check fuel entries against odometer/trip history.
- Detect suspicious mileage.

Historical cleanup:
- Never blindly delete records.
- Perform dependency/orphan audit first.
- Preserve business history unless a safe correction is proven.

---

# P8 — Security & Production Hardening
Target: 1.5 days

[~] P8.1 RLS audit
[~] P8.2 Role authorization audit
[~] P8.3 Server/API security audit
[ ] P8.4 Input validation
[ ] P8.5 Error handling
[✓] P8.6 Secrets/environment audit
[~] P8.7 Cron/security audit
[✓] P8.8 Production build verification

Status: IN PROGRESS

Completed security work includes:
- SECURITY DEFINER function privilege audit.
- Removal of unintended PUBLIC EXECUTE access.
- Authenticated/service-role execution hardening.
- Driver-session anonymous entrypoints intentionally preserved.
- Inventory immutable trigger reviewed.
- SECURITY DEFINER search_path audit completed.
- PostgreSQL default function privileges hardened for application-owned functions.
- Anonymous application access to protected master data reduced.
- app_users access hardened through protected RPCs.
- Server-side service-role usage reviewed.
- Production build successfully verified.

Intentional exceptions:
- Driver authentication/session RPCs require anonymous access because they are driver portal entrypoints.
- Inventory stock immutability trigger function is trigger-only.
- Certain internal/service-role-only SECURITY DEFINER functions remain restricted intentionally.

Remaining P8 work:
- Complete RLS audit.
- Complete role/authorization matrix.
- Complete API/server authorization review.
- Input validation review.
- Error handling review.
- Cron configuration verification.
- Final production security regression.

---

# P9 — Final UX / QA / Release
Target: 2 days

[ ] P9.1 Liquid Glass consistency
[ ] P9.2 Desktop viewport QA
[ ] P9.3 Mobile/tablet QA
[ ] P9.4 Modal/drawer QA
[ ] P9.5 Empty-state QA
[ ] P9.6 Pagination QA
[ ] P9.7 Search/filter QA
[ ] P9.8 Export QA
[ ] P9.9 Performance QA
[ ] P9.10 Final regression test
[ ] P9.11 Production release checklist

Status: NOT STARTED

---

# UI RULES

- Dashboard remains the landing page.
- Remove Quick Links from Dashboard.
- Main navigation is module-based.
- Module entry should show a clean themed workspace.
- Functional menus appear within the selected module.
- Actions open focused workspaces.
- Large historical lists should not permanently occupy operational screens.
- Default list pagination: 10 rows.
- Use controlled internal scrolling where necessary.
- Desktop should maximize one-page fit without overlap or visual squeezing.
- Mobile/tablet may naturally scroll.
- Primary workflows use centered wide Liquid Glass modals when modal workflow is appropriate.
- Modal background must blur/dim.
- Avoid unnecessary nested glass containers.
- No naked notification/history blocks.
- Search-first for large datasets.
- Reports own historical/analytical data.

---

# ENGINEERING RULES

- Preserve existing business logic unless explicitly changing it.
- Inspect before modifying.
- One focused task at a time.
- Run TypeScript/build/tests after meaningful changes.
- Never use `git add .`.
- Never use `git reset --hard`.
- Never use `git clean -fd`.
- Never modify or delete `.before-*` backups.
- Never commit/push unless explicitly requested.
- Do not blindly delete historical data.
- Database cleanup must follow dependency/orphan audit.
- Server-side authorization must be enforced.
- Secrets must never be exposed client-side.
- Local migrations must match the remote database before a phase is considered complete.
- Do not create corrective migrations unless an actual database issue is identified.
- Do not modify migration history that has already been applied remotely.

---

# CURRENT CHECKPOINT

Current branch:
design/premium-ui-v2

Latest known stable pushed checkpoint:
193f0e0 — Complete fleet module and P4 validation

Remote:
origin/design/premium-ui-v2

Current functional phase:
P5 — Masters

Next task:
P5.1 — Truck Master audit

Security:
P8 security hardening is partially complete and must be finalized later.

---

# PHASE COMPLETION RULE

A phase is only marked [✓] when:

1. Implementation is complete.
2. Existing business logic is preserved or intentionally changed.
3. Database/schema/RPC dependencies are verified.
4. TypeScript passes.
5. Relevant workflow QA passes.
6. Data-integrity checks pass where applicable.
7. Security implications are reviewed.
8. Local migrations match remote.
9. Production build passes where applicable.
10. Git checkpoint is verified.

Never mark a phase complete merely because the UI appears functional.

---

# PROJECT CONTROL PRINCIPLE

The project plan is the single source of truth for project status.

When the plan, code, database, Git state, or previous conversation appears inconsistent:

1. Stop.
2. Inspect the authoritative source.
3. Reconcile the difference.
4. Update the project plan.
5. Continue only after the state is understood.

Do not guess.
Do not silently skip incomplete work.
Do not declare completion without verification.
