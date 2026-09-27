# KSS Roadways ERP — Project Plan

## Project Goal
Build a production-ready, world-class fleet ERP for a small fleet operator.
Simple on the surface, sophisticated underneath.

## Architecture
Dashboard → Main Module → Functional Menu → Action → Workspace

## Master Navigation

### Dashboard
Landing page / fleet command center.
Keep existing dashboard intact except remove Quick Links.

### Operations
- Trip Dispatch
- POD Closure
- Modify Trip
- Quick Status

### Accounts
- Advance
- Expense
- Reconcile

### Fleet
- Tyre Management
- Workshop Work Details
- Fuel Issue / Modify
- AdBlue Issue / Modify
- Inventory

### Master
- Truck
- Driver
- Freight Rate
- Driver Bata
- Vendors
- Customers
- Users
- Users/Admin management restricted to Superadmin

### Reports
- Fleet Analytics & Margin
- Driver Settlement
- P&L Report
- Outstanding Expense / Revenue
- Diesel Mileage
- Trip Audit

### AI — Future Phase
- Uploads / OCR
- Driver Logs
- Insights
- GPS / Live Location

---

# PROJECT STATUS

Legend:
[ ] Not Started
[~] In Progress
[✓] Complete
[!] Blocked

## P0 — Baseline & Project Control
Target: 0.5 day

[ ] P0.1 Create project plan
[ ] P0.2 Audit current repository
[ ] P0.3 Audit current database/schema
[ ] P0.4 Map existing modules to target architecture
[ ] P0.5 Identify obsolete/duplicate UI
[ ] P0.6 Establish safe historical-data cleanup plan

## P1 — Core Navigation Architecture
Target: 1 day

[ ] P1.1 Refactor main navigation
[ ] P1.2 Implement module landing workspaces
[ ] P1.3 Implement functional module menus
[ ] P1.4 Implement action → workspace flow
[ ] P1.5 Remove obsolete top-level tabs
[ ] P1.6 Remove Dashboard Quick Links
[ ] P1.7 Verify role-based navigation
[ ] P1.8 Desktop/mobile navigation QA

## P2 — Operations
Target: 2 days

[ ] P2.1 Trip Dispatch
[ ] P2.2 POD Closure
[ ] P2.3 Modify Trip
[ ] P2.4 Quick Status
[ ] P2.5 Operations validation
[ ] P2.6 Operations workflow QA

## P3 — Accounts
Target: 1.5 days

[ ] P3.1 Driver Advance
[ ] P3.2 Expense
[ ] P3.3 Reconcile
[ ] P3.4 Accounts validation
[ ] P3.5 Accounts workflow QA

## P4 — Fleet
Target: 2 days

[x] P4.1 Tyre Management
[x] P4.2 Workshop Work Details
[x] P4.3 Fuel Issue / Modify
[x] P4.4 AdBlue Issue / Modify
[x] P4.5 Inventory
[x] P4.6 Fleet validation
[x] P4.7 Fleet workflow QA

## P5 — Masters
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

## P6 — Reports
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

## P7 — Data Integrity & Historical Cleanup
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

## P8 — Security & Production Hardening
Target: 1.5 days

[ ] P8.1 RLS audit
[ ] P8.2 Role authorization audit
[ ] P8.3 Server/API security audit
[ ] P8.4 Input validation
[ ] P8.5 Error handling
[ ] P8.6 Secrets/environment audit
[ ] P8.7 Cron/security audit
[ ] P8.8 Production build verification

## P9 — Final UX / QA / Release
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

---

# UI RULES

- Dashboard remains the landing page.
- Remove Quick Links from Dashboard.
- Main navigation is module-based.
- Module entry should show a clean themed workspace.
- Functional menus appear within the selected module.
- Actions open focused workspaces/forms.
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

# CHECKPOINTS

Current branch:
design/premium-ui-v2

Known stable remote checkpoint:
be37fab — checkpoint: liquid glass UI, reports, pagination and master security

Next checkpoint:
P0 baseline complete

