# Workshop Bill RPC Verification

**Repository:** `C:\Users\unnik\kss-erp`
**Branch:** `design/premium-ui-v2`
**Audit date:** 2026-09-27
**Scope:** Read-only inspection of `create_workshop_bill_atomic` definitions, current callers, and available database catalog access.

## Evidence labels

- **FACT** — visible in checked-in source or tooling inventory.
- **VERIFIED** — confirmed directly from the applicable source/catalog. For production claims, this requires live catalog evidence.
- **NOT VERIFIED** — not established by available checked-in source or production access.
- **RECOMMENDATION** — next safe action; not implemented.
- **BUSINESS DECISION** — policy/ownership decision not answerable from code alone.

## 1. Executive Summary

### FACT

Both `components/AccountsModule.tsx` (Petty Expense) and `components/WorkshopModule.tsx` (Workshop Service Bill) call `create_workshop_bill_atomic` with the same six named arguments. The caller values differ in meaning and constraints: Accounts sends a petty-expense category in the vendor field and permits a null vehicle; Workshop sends a selected vendor and requires a vehicle.

No definition of `create_workshop_bill_atomic` was found in checked-in migrations. It is also absent from the `Functions` section of `lib/database.types.ts`. The checked-in generated `workshop_spares_bills` type looks consistent with the RPC's argument names, but it cannot prove that the RPC writes that table, or prove live behavior.

### NOT VERIFIED

**DEPLOYED RPC DEFINITION NOT VERIFIED**

The Supabase CLI is not installed on PATH, no database catalog inspection connector is available in the current tools, and no live function definition was obtained. No SQL mutation or RPC invocation was performed. The deployed RPC destination, validation, duplicate protection, authorization, and transaction behavior remain unknown.

### RECOMMENDATION

Do not classify the Accounts caller as a safe general-expense path or remove it based on this evidence alone. Treat it as an unresolved shared-RPC path. Before choosing an owner, have an authorized operator inspect the deployed function definition and relevant constraints, then get the business owner to define whether petty categories are general expenses or workshop bills.

## 2. Checked-in RPC Definitions

### FACT / VERIFIED from repository search

- A repository-wide search of `supabase/migrations/` found **zero** occurrences of `create_workshop_bill_atomic`.
- The migration directory contains these three files:
  - `20260926103000_secure_driver_trip_actions.sql`
  - `20260926170000_secure_master_crud.sql`
  - `20260926190000_secure_master_driver_pin.sql`
- No checked-in definition history, overload, drop/recreate, or grant change for this RPC was found.
- `lib/database.types.ts` does not declare `create_workshop_bill_atomic` under its generated Functions.
- Current callers show the following argument names: `p_bill_date`, `p_vehicle_id`, `p_vendor_name`, `p_invoice_number`, `p_spare_parts_details`, and `p_total_bill_amount`. These are **caller payload keys**, not a verified server signature or parameter types.

### NOT VERIFIED — server function behavior

Because no function body or signature is checked in, local evidence cannot establish:

- Return type or returned record/identifier.
- Tables read or written.
- Whether one or multiple rows are written.
- Server-side validation, date/amount handling, rounding, or amount calculations.
- Duplicate checks, bill-number/invoice protection, idempotency, or conflict handling.
- Role/authorization checks or RLS behavior.
- Any status/approval transition.
- Whether vehicle, trip, workshop, vendor or expense relationships are read or enforced.

No behavior in the table above should be inferred from the function name.

## 3. Deployed RPC Verification

### FACT — tooling availability checked

- `supabase` CLI was not found on PATH.
- `psql` was not found on PATH.
- No database/Postgres/Supabase catalog MCP connector is exposed in the current tool inventory.
- The repository contains Supabase local temp metadata, but that metadata is not a database catalog result.
- `.env.local` contains Supabase-related variable names, but this audit did not print or use secret values. A REST client configured with project keys does not by itself provide access to `pg_proc`/catalog definitions.

### NOT VERIFIED

**DEPLOYED RPC DEFINITION NOT VERIFIED**

There is no read-only production database catalog inspection available through the existing tooling in this environment. No production function definition or deployed migration state is claimed here. No RPC was called, and no database rows were read or modified.

## 4. Accounts Caller Analysis

**File:** `components/AccountsModule.tsx`, `handleCreateExpense`.

### FACT — caller payload

| RPC argument | Accounts Petty Expense value |
|---|---|
| `p_bill_date` | `expDate`; initialized to the current date string. There is no visible date input in the form. |
| `p_vehicle_id` | `Number(expVehicleId)` when a vehicle is selected; otherwise `null`. |
| `p_vendor_name` | `expCategory`, one of `TOLL_FASTAG`, `POLICE_RTO`, `LOADING`, or `OFFICE`. This is a category value, not a vendor selected from the vendor master. |
| `p_invoice_number` | `null`. |
| `p_spare_parts_details` | Trimmed free-text remarks, or fallback `Petty Expense`. |
| `p_total_bill_amount` | `Number(expAmount)`. |

### FACT — client behavior and validation

- Handler rejects if `!expAmount` or the numeric amount is `<= 0`.
- Numeric input includes browser constraints minimum 1 and maximum 100,000.
- Vehicle is optional; category is selected from the four fixed options.
- There is no vendor selector, invoice entry, confirmation dialog, pending/approval state, or local idempotency/reference value in this form.
- On RPC error it displays an alert. On success it clears amount/remarks, closes the entry sheet and refreshes selector data.
- The caller only reads the RPC error result; it does not receive or record a bill ID.

### NOT VERIFIED

The caller's “Petty Expense” label does not prove that the deployed RPC stores a general expense. The server may reject, transform or store these values in any way; only the deployed function body and schema could establish that.

## 5. Workshop Caller Analysis

**File:** `components/WorkshopModule.tsx`, `handleSaveBill`.

### FACT — caller payload

| RPC argument | Workshop Service Bill value |
|---|---|
| `p_bill_date` | `billDate`, selected in the service-bill workflow. |
| `p_vehicle_id` | `Number(wsTruckId)`; handler requires a selected vehicle. |
| `p_vendor_name` | `vendor.trim()`; handler requires a non-empty vendor string selected/entered in the Workshop workflow. |
| `p_invoice_number` | `null`. |
| `p_spare_parts_details` | Trimmed description, or fallback `Workshop Service`. |
| `p_total_bill_amount` | `Number(amount)`. |

### FACT — client behavior and validation

- Handler rejects if vehicle is missing, vendor is blank after trimming, or amount is `<= 0`.
- It opens a confirmation modal summarizing the amount and vendor before calling the RPC.
- On error it displays an alert. On success it displays a success alert, clears vendor/description/amount and refreshes Workshop data.
- The caller closes the confirmation modal after the attempt and does not receive or record a bill ID.
- Invoice number is always null in this form; no client idempotency token is supplied.

### NOT VERIFIED

Client-side Workshop validation does not prove the same validations exist inside the deployed function. The exact vendor data source and how it is mapped server-side are not discoverable from this caller payload alone.

## 6. Parameter Comparison

| Parameter | Accounts Petty Expense | Workshop Service Bill |
|---|---|---|
| RPC name | `create_workshop_bill_atomic` | `create_workshop_bill_atomic` |
| `p_bill_date` | `expDate` (default current date; not user-editable in the form) | `billDate` (service-bill date) |
| `p_vehicle_id` | Selected vehicle ID or `null` | Required selected vehicle ID, converted to number |
| `p_vendor_name` | Category code: `TOLL_FASTAG`, `POLICE_RTO`, `LOADING`, or `OFFICE` | Actual vendor text after trimming |
| `p_invoice_number` | `null` | `null` |
| `p_spare_parts_details` | Remarks, fallback `Petty Expense` | Description, fallback `Workshop Service` |
| `p_total_bill_amount` | Numeric conversion of petty amount | Numeric conversion of service-bill amount |
| Extra dedupe/reference argument | None | None |
| Confirmation before RPC | No separate confirmation dialog | Yes, modal confirmation |
| Returned record consumed | No; only `error` is used | No; only `error` is used |

### FACT

The callers use the **same RPC and argument names**, but their category/vendor and optional/required vehicle semantics differ. Both pass a null invoice number and neither passes an explicit transaction type, workflow origin, shared external reference, or idempotency key.

### UNKNOWN / BUSINESS DECISION

The call sites alone cannot establish whether they are:

- Two intended UI entry points for one workshop-bill record type.
- Two distinct transaction types being multiplexed through a shared RPC.
- A malformed/legacy Accounts caller whose category is stored as a vendor name.
- A deliberate shared workflow with server-side branching.

## 7. Database Destination

### FACT

The generated `workshop_spares_bills` type contains `bill_id`, `bill_date`, `invoice_number`, `spare_parts_details`, `total_bill_amount`, `vehicle_id`, and `vendor_name`. Active reports/analytics read `workshop_spares_bills`. This type shape resembles the RPC argument names.

### NOT VERIFIED

This is not proof of the deployed RPC target. The RPC may write to `workshop_spares_bills`, `expenses`, `workshop_repairs`, another table, or multiple tables. The current repository cannot distinguish those outcomes.

Therefore the Accounts Petty Expense destination is **E. unknown** among the options in the request. It is not verified as a general expense, workshop bill, or multiple financial records.

## 8. Duplicate / Idempotency Analysis

### FACT

- Both UI paths can submit the same RPC.
- Both pass `p_invoice_number: null`.
- Neither passes a shared event ID, idempotency key, or other explicit duplicate identifier.
- Accounts accepts a nullable vehicle; Workshop requires one.
- No checked-in migration definition, unique index, or constraint for the RPC or invoice deduplication was found.
- The generated table shape includes `bill_id` and nullable `invoice_number`, but generated types do not describe all unique constraints, indexes, triggers, or function-level duplicate checks.

### NOT VERIFIED

No live constraints or duplicate checks were inspected. It cannot be asserted that the same transaction definitely creates two records, nor that the database prevents it.

### RECOMMENDATION

Treat duplicate entry as a **credible risk** until the deployed function and constraints are checked. If the RPC inserts one record per call and has no duplicate protection, the same real-world workshop expense could be entered once through Accounts and again through Workshop. Both calls could use null invoice values, so an invoice-number check would not distinguish these submissions unless the server has another safeguard.

## 9. Ownership Classification

### Classification: **5. Cannot determine without further business decision**

This is the requested one-of-five outcome for the Accounts Petty Expense path.

### FACT

- Current Accounts presents the action as **Petty Expense** with general categories and an optional vehicle.
- Workshop presents its action as **Service Bill** with a required vehicle, vendor and service description.
- Both use the same RPC with the same six named parameters.
- Local checked-in source does not include the function body or production catalog.

### RECOMMENDATION

Do not label Petty Expense “safe Accounts-owned general expense” or “Workshop-owned bill” as a verified fact. The current form is a **shared/unresolved caller path**. Keep the catalogue decision pending until both questions are answered:

1. What does the deployed RPC actually write, and what safeguards does it apply?
2. Does the business intend Accounts categories such as Office/RTO/Loading/Toll to be standalone general expenses, or are they misrouted workshop bills?

After verification, if the function writes only workshop bills, the business owner should decide whether Accounts Petty Expense is a legacy/incorrect path or whether those categories intentionally count as workshop bills. If it writes a generic expense, confirm why Workshop calls it and how workshop bills are represented. If it writes multiple records, identify the required ledger/report treatment before changing either UI.

## 10. Impact on Accounts Transaction Catalogue

### FACT

The current catalogue lists Petty Expense as implemented but unresolved. This inspection confirms the two callers share an RPC but does not resolve the target table or semantics.

### RECOMMENDATION

- Keep **Driver Advance (Direct)** as the verified Accounts candidate, subject to the separate advance-RPC production check already recorded in the catalogue.
- Keep **Petty Expense** marked **implemented, ownership/destination not verified**; do not add subtypes or expand categories based on this audit.
- Do not remove Petty Expense or alter its caller in this task.
- Do not add a parallel Workshop service-bill form inside Accounts.

## 11. Recommended Next Step

### RECOMMENDATION

Have a database operator with read-only access inspect the deployed catalog and capture:

1. Exact `pg_proc` signature, definition, return type and security mode for `create_workshop_bill_atomic`.
2. Function dependencies and all tables/sequences it reads/writes.
3. Validation, amount transformation, status/approval changes and authorization checks in the body.
4. Relevant table constraints, unique indexes, triggers and policies—especially around invoice numbers and duplicate bills.
5. Deployed migration/function history or a schema-only definition sufficient to identify drift from repository.

Then ask the business owner whether Accounts petty categories are intended as generic operating expenses and choose one canonical creation point. Return to the Accounts catalogue and caller design only after both production behavior and accounting ownership are established.

No production SQL command was run as part of this audit.

## 12. Unknowns / Production Verification Gaps

### NOT VERIFIED

- Deployed RPC signature, return type and definition.
- Whether RPC is `SECURITY INVOKER` or `SECURITY DEFINER`, its grants and internal role checks.
- Target table(s), reads, writes and transaction atomicity.
- Database-side amount/date/vendor/vehicle validation.
- Duplicate checks, idempotency, unique invoice or bill constraints, triggers and null semantics.
- Whether any approval or posted/pending status is created or changed.
- Whether vehicle is optional at database level.
- Whether Accounts category-as-vendor is accepted, transformed, rejected or persisted literally.
- Whether `workshop_spares_bills` generated types match deployed columns/relationships.
- Whether the same real event can be posted through both callers without server-side detection.
- Business definition of Petty Expense categories and the intended authoritative module.

**DEPLOYED RPC DEFINITION NOT VERIFIED.** No code, SQL, migration, RPC, or data was modified or invoked.
