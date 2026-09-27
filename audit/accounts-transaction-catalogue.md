# KSS ERP Accounts Transaction Catalogue

**Repository:** `C:\Users\unnik\kss-erp`
**Branch:** `design/premium-ui-v2`
**Evidence date:** 2026-09-27
**Scope:** Read-only business/domain catalogue. No application or database code was changed.

## Evidence labels

- **FACT** — verified in current checked-in source or generated database types.
- **RECOMMENDATION** — proposed future product/menu behavior.
- **UNKNOWN / BUSINESS DECISION** — repository evidence is insufficient to decide safely.

“Exists Today” is precise about evidence: **Active** means an active UI or code path was found; **Typed only** means generated database types list a table/field but no active transaction entry path was found; **Not found** means no corresponding active form/table/RPC was found in inspected application source/types. Generated types do not certify deployed production schema. Financial RPC definitions are not present in checked-in migrations, so call-site arguments do not prove all server-side effects.

## 1. Executive Summary

### FACT

The current Accounts component has a **New Entry** flow with two choices and focused Liquid Glass forms:

1. **Driver Advance** — submits through `save_driver_advance_atomic`; the UI sends `CASH` as payment mode. This is the clearest existing Accounts-owned transaction.
2. **Petty Expense** — categories are Toll/Fastag, RTO/Permits, Hamali/Loading and Office Misc. It calls `create_workshop_bill_atomic`, placing the category in `p_vendor_name`. This is implemented in Accounts, but its storage/accounting identity is not confirmed and it overlaps the Workshop Service Bill path, which calls the same RPC.

The earlier Accounts domain audit describes the old “Workshop Ledger” button. Current `AccountsModule.tsx` no longer has that button; the first Accounts UI restructuring removed it. The current code is authoritative for this catalogue.

Other amounts are entered or generated within trip dispatch, POD closure, fuel, workshop/tyre, driver settlement or approval workflows. They need vehicle/trip/odometer/driver-period/asset validation and should not become parallel Accounts forms. Accounts should link users to those modules instead.

### RECOMMENDATION

For a safe immediate menu, expose **Driver Advance (Direct)** as the confirmed Accounts-owned choice. Keep **Petty Expense** in a clearly identified “existing, ownership unresolved” state until the owner and technical team confirm that it represents general expenses rather than a second way to create workshop bills. If retained as an Accounts option, limit it to approved general categories and route workshop/vendor repair bills to Workshop.

### UNKNOWN / BUSINESS DECISION

The business must decide whether general petty/office/toll/RTO/loading expenses belong in Accounts, and the deployed database/RPC must confirm their posting destination. Staff advances, vendor payment, customer invoicing/receipts, bank/cash reconciliation and actual driver payout are not evidenced as complete Accounts workflows.

## 2. Verified Existing Transactions

### FACT — current Accounts options

| Transaction | Current Table/RPC | Exists Today? | Safe to expose in Accounts? | Reason | Status |
|---|---|---|---|---|---|
| Driver Advance (direct) | UI calls `save_driver_advance_atomic`; generated active data shape is `driver_direct_advances` (date, driver, amount, type, payment mode, settlement state, remarks) | **Yes — active Accounts form and RPC call** | **Yes, with “Direct” clarified** | This is the direct Accounts advance workflow. It is separate from trip-linked cash advance, though the exact deployed RPC target should be confirmed. | FACT; Accounts-owned candidate. |
| Petty Expense | UI calls `create_workshop_bill_atomic`; likely bill storage is suggested by the RPC/readers, but exact destination is unverified | **Yes — active Accounts form and RPC call** | **Not as an unrestricted general-expense menu item yet** | The same RPC is used by Workshop Service Bill. Account categories are passed as vendor names, making type/ledger semantics ambiguous and creating duplicate-entry risk. | FACT: implemented; RECOMMENDATION: defer broad exposure pending decision and RPC verification. |

### FACT — current Accounts form details

- Driver Advance fields: date, active driver, amount (HTML min 1/max 500,000 plus positive-value handler check), category (`GENERAL_ADVANCE`, `BATA_ADVANCE`, `SALARY_ADVANCE`), remarks (max 60, uppercased); payment mode is fixed to `CASH` in the RPC call.
- Petty Expense fields: category (`TOLL_FASTAG`, `POLICE_RTO`, `LOADING`, `OFFICE`), optional vehicle, amount (HTML min 1/max 100,000 plus positive-value handler check), remarks (max 60, uppercased). `expDate` is passed to the RPC but there is no visible date input; it remains initialized to today.
- Current Accounts does not contain an approval queue, history table, export, payment reconciliation or account balance screen.
- The Workshop Ledger control found by the prior audit is absent in current source.

## 3. Master Transaction Catalogue

### FACT / RECOMMENDATION / UNKNOWN matrix

| Family | Transaction | Current Owner | Current Table/RPC | Exists Today? | Accounts Option? | Reason | Status |
|---|---|---|---|---|---|---|---|
| ADVANCE | Driver Advance (direct) | Accounts | `save_driver_advance_atomic`; generated `driver_direct_advances` shape | Yes — active | **Yes** | Direct off-trip advance is the current verified Accounts-owned workflow. Define direct vs trip-linked use. | FACT; recommended option. |
| ADVANCE | Staff Advance | No owner/workflow found | No staff advance table/RPC or staff entity found in generated types/source | No active evidence | **No, pending decision** | Requires staff identity, payment, settlement/repayment and likely approval semantics. A driver relation cannot safely stand in for staff. | UNKNOWN / BUSINESS DECISION. |
| EXPENSE | Driver Expense / reimbursement | No generic driver expense form found | No dedicated expense RPC/table flow found; trip/POD claims and fuel requests are separate | No active evidence as a general expense | **No** | Fuel request and POD claims have operational validations; generic reimbursement scope, receipt and approval are undefined. | FACT; defer. |
| EXPENSE | Workshop Expense / service bill | Workshop | `create_workshop_bill_atomic`; generated `workshop_spares_bills` has vendor/date/vehicle/details/amount (target inference only) | Yes — active Workshop service-bill form | **No duplicate form** | Workshop already captures vendor, vehicle, date, amount and service description. Accounts petty form uses the same RPC. | FACT; Workshop authoritative recommendation. |
| EXPENSE | Workshop Spares | Workshop | Workshop service-bill RPC / `workshop_spares_bills` read model; no dedicated spares subtype confirmed | Partial — bill workflow exists, subtype not distinct | **No** | Vehicle/vendor/bill context belongs in Workshop. Do not add another Accounts spares record. | FACT / RECOMMENDATION. |
| EXPENSE | Tyre Expense | Workshop tyre lifecycle | `create_tyre_purchase_atomic`, `complete_tyre_retread_atomic`, `dispose_tyre_atomic` | Yes — operational cost/recovery payloads exist | **No** | Amounts are tied to tyre identity, inventory state, vendor, odometer or disposal; a manual duplicate could double count. | FACT; Workshop-owned. |
| EXPENSE | Diesel/Fuel Purchase or Issue | Fuel; driver-originated requests go through Driver Portal and Approval Queue | `record_fuel_atomic`, `update_fuel_atomic`, `delete_fuel_atomic`; generated `diesel_fuel_logs`; approval RPCs for pending driver request | Yes — active forms and RPC calls | **No** | Fuel entry requires vehicle/trip, litres/rate, authoritative odometer and tank state. | FACT; Fuel-owned. |
| EXPENSE | AdBlue | Fuel | `record_adblue_filling_atomic`, `record_adblue_credit_atomic`, update/delete RPCs; `adblue_logs` queried by UI but absent from generated types | Yes — active forms/RPC calls | **No** | Vehicle/trip/odometer and credit/vendor/invoice/due-date validation are specialized. | FACT; Fuel-owned; database type snapshot incomplete. |
| EXPENSE | Toll / Fastag | Accounts petty form; possible trip field | Accounts calls `create_workshop_bill_atomic`; generated `trips.toll_fastag_expense` | Yes — Accounts category exists; trip field typed; live TripForm entry not verified | **Not until canonical owner chosen** | Existing Accounts category can overlap a trip cost field and shares the workshop-bill RPC. | FACT overlap possibility; UNKNOWN actual posting ownership. |
| EXPENSE | Halt | POD Closure / trip settlement | `close_pod_atomic(p_halt_bata)`; generated `trips.halt_bata` | Yes — active POD form/RPC | **No** | It is trip-linked Bata captured at closure and included in settlement. | FACT; POD/Settlement-owned. |
| EXPENSE | Maintenance / Enroute Repair | POD Closure and Workshop have adjacent workflows | `close_pod_atomic(p_claims)` → generated `trips.enroute_repairs_maintenance`; Workshop service bills; generated `workshop_repairs` typed | Partial — POD claims form active; separate workshop repair creation not found in active UI | **No generic form** | POD claim and vendor repair bill may be different event stages or may refer to one event; needs relation/owner rule. | FACT overlap; UNKNOWN whether same event. |
| EXPENSE | Office/Admin | Accounts petty category `OFFICE` | Same `create_workshop_bill_atomic` payload; typed `expenses` table is unused in active frontend | Yes — category exists; no verified generic expense ledger path | **Conditional, not yet safe** | The interface supports the category but does not establish a proper general-expense table/RPC. | FACT; business + production verification required. |
| EXPENSE | Petty Cash | Accounts petty expense workflow | `create_workshop_bill_atomic`; destination unknown | Yes — active entry form, ambiguous posting model | **Conditional** | Distinct Accounts form exists, but “petty cash” has no cashbook/payment-account structure and overlaps Workshop RPC. | FACT; business decision. |
| EXPENSE | Other | None found | No generic other-expense category or verified path | No active evidence | **No, pending definition** | No category, approval, report mapping or storage behavior established. | UNKNOWN / BUSINESS DECISION. |
| DRIVER | Driver Bata | Trip dispatch; master rates from Setup | `create_dispatch_trip_atomic(p_driver_bata)`; `driver_bata_master`; `trips.driver_bata` | Yes — active trip field/master workflow | **No** | Bata is linked to trip/master rules and later settlement; do not manually duplicate. | FACT; Trip-owned. |
| DRIVER | Driver Direct Advance | Accounts | Same as Driver Advance row: `save_driver_advance_atomic` / `driver_direct_advances` | Yes — active; alias of Driver Advance | **Yes, as one option only** | This is not a second type; use the label “Driver Advance (Direct)” to distinguish from trip cash advance. | FACT; do not duplicate menu entry. |
| DRIVER | Driver Settlement | Driver Settlement | Reads `trips` and `driver_direct_advances`; calls `settle_driver_period_atomic` | Yes — period calculation/close active | **No** | It summarizes trip Bata and advances by driver/date period, then marks records settled. No explicit payout form is shown. | FACT; Settlement-owned. |
| DRIVER | Driver Deduction | POD/trip fields may carry shortage penalty; no separate generic entry confirmed | Generated `trips.shortage_penalty_deduction`; `close_pod_atomic`; settlement RPC | Partial — field/RPC model exists, active monetary entry path not confirmed | **No, pending semantics** | A deduction may be shortage penalty, recovery or settlement adjustment; no generic manual entry should be added. | FACT / UNKNOWN. |
| DRIVER | Driver Recovery | No distinct driver recovery form found | No dedicated active recovery table/RPC identified; tyre disposal recovery is a separate asset event | No active driver recovery evidence | **No** | Driver recovery must be tied to an approved claim/deduction and settlement rule. | UNKNOWN / BUSINESS DECISION. |
| TRIP | Freight Revenue | TripForm / ModifyTrips | `create_dispatch_trip_atomic(p_freight_revenue)`; `modify_trip_atomic`; `trips.freight_revenue`; freight master | Yes — active | **No standalone Accounts entry** | It is trip-specific, rate-derived/manual override and tied to dispatch. No customer invoice workflow was found. | FACT; Trip-owned. |
| TRIP | Shortage | POD Closure | `close_pod_atomic`; shortage weight/quantity fields in `trips` | Yes — shortage quantity calculation and closure are active; penalty amount not verified | **No** | Shortage measurement and closure depend on loaded/unloaded weights and POD. A financial penalty is not the same as shortage quantity. | FACT; POD-owned; penalty UNKNOWN. |
| TRIP | Enroute Expense | POD Closure | `close_pod_atomic(p_claims)`; generated `trips.enroute_repairs_maintenance` | Yes — active Claims/repairs amount field | **No** | It is trip/POD-linked and must not be entered again as a generic Accounts expense without a deduplication rule. | FACT; POD-owned. |
| TRIP | Trip Cash Advance | TripForm / ModifyTrips | `create_dispatch_trip_atomic(p_cash_advance_issued)`; `modify_trip_atomic`; `trips.cash_advance_issued` | Yes — active | **No** | It is associated with an identified trip and subtracted separately in settlement. | FACT; Trip-owned. |
| WORKSHOP | Workshop Labour | Workshop | Generic Workshop Service Bill form with description/vendor/vehicle/amount; `create_workshop_bill_atomic` | Partial — generic service bill active; labour subtype not distinct | **No duplicate form** | Labour can be recorded as a service bill; no distinct labour classification established. | FACT; Workshop-owned. |
| WORKSHOP | Workshop Spares | Workshop | Service bill path and `workshop_spares_bills` generated table | Partial — bill records active; itemized spare workflow not verified in current UI | **No** | Keep vendor/invoice/vehicle/work detail in Workshop. | FACT; Workshop-owned. |
| WORKSHOP | Workshop Repair | Workshop operational/history model | Generated `workshop_repairs`; cron reads recent rows; no active repair-create UI/RPC found in current component | Typed/read-only evidence; no active entry verified | **No Accounts form** | Repair workflow needs vehicle, category, odometer, status and repair lifecycle; currently a UI gap, not an Accounts entry type. | FACT / potential operational gap. |
| WORKSHOP | Tyre Purchase | Workshop | `create_tyre_purchase_atomic`; `fleet_tyres` inventory | Yes — active lifecycle entry | **No** | Purchase line is connected to tyre identity, vendor and inventory/mount state. | FACT; Workshop-owned. |
| WORKSHOP | Tyre Mount | Workshop | `mount_tyre_atomic`; `fleet_tyres` | Yes — operational action; no separate amount captured in mount action | **No** | Fitment/position/odometer validation, not a standalone expense. | FACT; Workshop-owned. |
| WORKSHOP | Tyre Retread | Workshop | `send_tyre_for_retread_atomic`, `complete_tyre_retread_atomic(p_retread_amount)` | Yes — active lifecycle action and cost field | **No** | Cost is attached to the tyre's retread event. | FACT; Workshop-owned. |
| WORKSHOP | Tyre Disposal | Workshop | `dispose_tyre_atomic(p_recovery_amount, p_buyer_vendor_id)` | Yes — active lifecycle action and optional recovery | **No** | Disposal proceeds/cost are linked to tyre disposition; accounting treatment is separate and unresolved. | FACT; Workshop-owned. |
| FUEL | Diesel Purchase | Fuel | `record_fuel_atomic`; `diesel_fuel_logs` | Yes — active | **No** | This is the same domain event as diesel issue/fill, not an extra Accounts subtype. | FACT; Fuel-owned. |
| FUEL | Diesel Issue | Fuel; driver request via Portal/Approval | `record_fuel_atomic`; `submit_driver_fuel_pending_atomic`; `approve_driver_fuel_atomic` | Yes — active | **No** | Distinguish final fuel entry from pending driver request, but keep both within Fuel/Approval. | FACT; operationally owned. |
| FUEL | AdBlue | Fuel | AdBlue filling/credit/update/delete RPCs | Yes — active | **No** | Same transaction family already listed under Expense; not a second menu option. | FACT; Fuel-owned. |
| PAYMENTS | Vendor Payment | No vendor-payment screen found; AdBlue credit purchase has due-date metadata only | AdBlue credit RPC; no payment-settlement RPC/table identified | No active payment evidence | **No, pending decision** | Recording a credit purchase does not prove that a vendor payment can be made/reconciled. | FACT; potential capability. |
| PAYMENTS | Customer Receipt | No customer receipt workflow found | No receipt table/RPC identified | No active evidence | **No, pending decision** | Requires customer, invoice/allocation, date, method and receipt reference. | FACT; potential capability. |
| PAYMENTS | Staff Payment | No staff payment workflow found | No staff/payment table/RPC identified | No active evidence | **No, pending decision** | Staff master/payroll/payment semantics are absent from current evidence. | FACT; potential capability. |
| PAYMENTS | Driver Payment | Settlement module calculates balance and closes period; no payout form | `settle_driver_period_atomic`; exact server behavior unavailable | Partial — settlement close active; payment record unverified | **No separate Accounts option yet** | Adding a payment form could duplicate server-side settlement payment if RPC already does it. Verify first. | FACT / UNKNOWN. |
| REVENUE | Customer Invoice | No invoice/AR workflow found | No invoice table/RPC in generated types/active source identified | No active evidence | **No, pending decision** | Trip freight is recorded but is not proof of invoice issuance, tax calculation or receivable tracking. | FACT; potential capability. |
| REVENUE | Freight Revenue | TripForm / ModifyTrips | Same `trips.freight_revenue` and dispatch/modification RPCs as TRIP row | Yes — active | **No duplicate menu option** | This is the same trip revenue event; display under Trip ownership, not as a second standalone Accounts entry. | FACT; Trip-owned. |

## 4. Transactions Owned by Operational Modules

### FACT and RECOMMENDATION

| Owner | Keep these transaction/actions there | Why Accounts should link instead of recreate |
|---|---|---|
| Trip Dispatch / Modify Trips | Freight, trip fuel snapshot, driver Bata, trip cash advance, trip corrections | Trip ID, route, vehicle, driver, freight/Bata masters, odometer and dispatch rules are part of the event. Modify Trips edits the original trip, not a separate transaction. |
| POD Closure | Halt Bata, shortage quantity, Claims/repairs, closing diesel, POD status | Values depend on POD/weight/odometer/atomic closure validation. |
| Fuel & AdBlue | Diesel and AdBlue purchase/issue/edit/delete | Vehicle/trip/quantity/rate/odometer/tank-full and vendor-credit rules. |
| Approval Queue | Approve/reject driver-originated pending fuel request | Pending-to-approved workflow and final cost belong to authorization path; Accounts should only show a link/count if appropriate. |
| Workshop & Tyres | Service bill, spares/repair description, tyre purchase/mount/retread/disposal/recovery | Vendor/vehicle, asset identity, position, odometer and lifecycle are domain-specific. |
| Driver Settlement | Calculate driver-period balance and mark source records settled | Driver/date grouping and settlement rules are specialized; actual payout semantics remain unverified. |
| Reports / Financials / P&L | Historical records, exports, transaction reports and analysis | Read/report/analytics role; no new transaction should originate from these screens. |

## 5. Transactions That Should Appear in Accounts

### RECOMMENDATION — safe now

**Driver Advance (Direct)** should be the first stable transaction choice. Keep one menu item; do not duplicate it as both “Driver Advance” and “Driver Direct Advance.” Label it clearly so it is not confused with Trip Cash Advance. The existing workflow and generated direct-advance model provide the strongest support, subject to a final deployed RPC confirmation.

### UNKNOWN / BUSINESS DECISION — existing but not yet safe as a broad category

**Petty Expense** is already implemented and currently appears in Accounts, but the repository shows it calling the same workshop-bill RPC as Workshop service bills. The future menu should not advertise it as a broad generic expense entry until:

1. The owner confirms which categories belong to general Accounts rather than Trip/Workshop.
2. Production verification establishes the RPC destination, accounting treatment and deduplication constraints.
3. The Reports/P&L mapping is confirmed for each allowed category.

If the owner confirms general petty expenses as valid and the posting path is verified, the existing Petty Expense can remain as one form with approved categories. Do not add additional types just to make the menu appear more complete.

### Proposed safe menu

```text
Accounts
└── New Entry
    └── Advance
        └── Driver Advance (Direct)

Petty Expense
└── Keep as an existing option only after ownership/storage verification
```

This separates “verified safe menu option” from “currently implemented but unresolved.”

## 6. Transactions That Should NOT Appear in Accounts

### FACT / RECOMMENDATION

- Trip freight revenue, trip cash advance and trip Bata.
- POD halt Bata, shortage workflow, Claims/repairs and POD diesel top-up.
- Diesel/fuel and AdBlue.
- Workshop service/repair/spares bills while Workshop owns their validation.
- Tyre purchase, mounting, retreading, disposal and recovery.
- Driver settlement calculation and period closure.
- Pending driver fuel approval/rejection.
- Modify-trip corrections.
- Customer invoice/receipt, vendor payment, staff advance/payment, receivable/payable and bank/cash payment workflows: not shown as implemented and cannot be added as verified options.

For currently operational entries, Accounts should provide deep links or quick actions such as **Open Fuel Entry**, **Open Workshop**, **Open POD Closure**, **Open Driver Settlement**, **Open Dispatch**, and **Review Approvals**. These are navigation affordances, not new Accounts transaction forms.

## 7. Duplicate Entry Risks

| Risk | Current entry points | Why duplication matters | Recommendation |
|---|---|---|---|
| Petty Expense vs Workshop Service Bill | Accounts and Workshop both call `create_workshop_bill_atomic` | Same real vendor/vehicle bill can be submitted through two forms. The Accounts form passes category as vendor name; no shared idempotency key is visible. | Workshop owns actual workshop bills. Keep a separate Accounts general-expense option only after RPC/storage/report ownership is resolved. |
| Direct Driver Advance vs Trip Cash Advance | Accounts `save_driver_advance_atomic` vs TripForm `create_dispatch_trip_atomic` field `p_cash_advance_issued` | The same payout could be recorded in both; settlement subtracts both source categories separately. | Define direct as off-trip and trip cash as trip-linked. Keep one direct-advance Accounts option. |
| `BATA_ADVANCE` category vs Trip Bata | Accounts direct advance type vs TripForm `p_driver_bata` | If “Bata advance” means the same as earned trip Bata, both may reduce/affect settlement separately. | Business owner defines meaning; do not treat the category as a new Bata form. |
| Dispatch fuel snapshot vs Diesel log | Trip dispatch `p_fuel_expense` / trip field vs Fuel `record_fuel_atomic` / `diesel_fuel_logs` | May be snapshot plus actual transaction, or duplicate cost posting; RPC body not checked in. | Keep Fuel as actual fuel-entry owner and verify reporting never sums both as distinct costs. |
| POD Claims/repairs vs Workshop bill | `close_pod_atomic(p_claims)` vs Workshop `create_workshop_bill_atomic` | Same repair could be entered as driver claim and vendor bill without linking; or could legitimately be different stages. | Confirm event definitions, then document separate/duplicate rules and use a reference link if existing model supports it. |
| Accounts Toll/Fastag vs Trip toll field | Petty Expense category vs typed `trips.toll_fastag_expense` | Same toll could be included in generic petty expense and trip costs; active TripForm toll input was not verified. | Check deployed writes and business process; expose only one creation point. |
| Driver Settlement close vs Driver Payment | `settle_driver_period_atomic` vs potential future payment form | RPC may already create payment or may only mark records settled; a new payout action could double-pay. | Inspect deployed RPC before adding any driver payment choice. |
| AdBlue credit vs Vendor Payment | Fuel creates credit purchase with invoice/due date; potential AP payment | Purchase liability and payment are separate stages, but no payment flow is present. | If needed, define AP/payment distinctly and link to original AdBlue credit; do not call purchase “vendor payment.” |

## 8. Proposed Accounts New Entry Menu

### RECOMMENDATION — staged presentation

**Available now after verification:**

```text
New Entry
└── Advance
    └── Driver Advance (Direct)
```

**Conditional existing flow — hold as “Petty Expense” pending ownership decision:**

```text
New Entry
└── Expense
    └── Petty Expense
```

Only offer the second choice as an approved Accounts transaction when the owner confirms the general categories and the production call path is not a second way to create Workshop service bills. The existing category list should not be expanded in this task.

**Operational shortcuts (navigation only):**

```text
Fuel           → Open Fuel Entry
Workshop       → Open Workshop Entry
Dispatch / POD → Open trip or POD workflow
Settlement     → Open Driver Settlement
Approvals      → Review Approval Queue
History        → Reports
```

### FACT

The current component exposes Driver Advance and Petty Expense through the New Entry sheet. This catalogue recommends retaining the direct advance as safe and flags Petty Expense for clarification. It does not recommend adding other options.

## 9. Potential New Capabilities

These are possibilities, not approved requirements and not current menu items.

| Potential capability | Why it may be useful | Information likely required | Likely owner | Database changes may be needed? | Approval likely? | Status |
|---|---|---|---|---|---|---|
| Staff Advance | A company may issue advances to non-driver employees, but none are represented in current entity/types. | Staff identity, date, amount, method, purpose, approver, outstanding balance and settlement/repayment reference. | Accounts/HR-Finance | **Likely**, unless an existing deployed staff/advance model is discovered. | Likely threshold/role review; owner decision. | UNKNOWN / BUSINESS DECISION. |
| General Office/Admin Expense | Existing `OFFICE` category indicates a current category concept, but no verified generic ledger use. | Date, category, amount, payee, description, method/account, receipt, branch/cost center, approver. | Accounts | **Possibly**; typed `expenses` exists but is unused and may not support payment/approval requirements. | Likely policy-dependent. | UNKNOWN; current petty path must be verified. |
| General Petty Cash / Expense | Current petty form suggests a use case, but payment-account/cashbook semantics are absent. | Date, authorized category, payee, vehicle if applicable, amount, receipt, payment source, entered-by and approval state. | Accounts | **Possibly**; verify existing `expenses` and RPC before schema decision. | Likely based on amount/category. | UNKNOWN / BUSINESS DECISION. |
| Vendor Payment / Accounts Payable | AdBlue credit captures vendor/invoice/due date, indicating possible need to track settlement, but no payment workflow exists. | Vendor, invoice/liability, due date, amount, payment date/method/account, reference, allocation and balance. | Accounts/AP, linked to Fuel/Workshop bill | **Likely** unless a deployed AP model exists. | Likely payment authorization/segregation of duties. | UNKNOWN / BUSINESS DECISION. |
| Customer Invoice | Freight revenue exists at trip level; customer billing/tax/invoice tracking was not found. | Customer, completed trips, freight amount, tax, invoice number/date/due date, terms, status and credit note. | Billing/Accounts with Dispatch handoff | **Likely**; no invoice/AR table or RPC in generated types/source identified. | Invoice approval may be policy-dependent. | UNKNOWN / BUSINESS DECISION. |
| Customer Receipt / Collections | No receipt/allocation workflow found; would support matching payments to invoices if invoicing is in scope. | Customer, receipt date/amount/method/reference, invoices allocated, bank/cash account, unmatched balance. | Accounts/AR | **Likely** absent an existing deployed model. | Likely authorization/reconciliation control. | UNKNOWN / BUSINESS DECISION. |
| Driver Settlement Payment | Module computes payable and closes period but does not display payment instrument or receipt. | Driver, settled period, payable, advances/deductions, payment date/method/reference, approver and proof. | Driver Settlement + Accounts payment handoff | **Unknown** until deployed `settle_driver_period_atomic` is inspected; likely if it only marks status. | Likely policy-dependent. | UNKNOWN / BUSINESS DECISION. |
| Staff Salary/Payment | `SALARY_ADVANCE` is an advance category, not a payroll run/payment. No payroll capability found. | Staff/pay period, gross/net, deductions, tax, payment information, approval and statutory reporting. | Payroll/HR/Finance | **Likely**; no payroll schema/workflow found. | Likely. | UNKNOWN / BUSINESS DECISION. |
| Cash/Bank Payment and Reconciliation | Current Accounts does not have cashbook/bank-account selection; advance forces CASH. | Accounts, date, transaction, amount, method, bank/cash ledger, reference, reconciliation state. | Treasury/Accounts | **Likely** if not already available in deployed systems. | Segregation/approval likely. | UNKNOWN / BUSINESS DECISION. |

## 10. Business Owner Decisions

1. Is Driver Advance specifically for **off-trip direct advances**, with all trip-associated advances entered only in TripForm?
2. What do `GENERAL_ADVANCE`, `BATA_ADVANCE`, and `SALARY_ADVANCE` mean operationally? Can `BATA_ADVANCE` overlap earned Bata or trip cash advance?
3. Is the Accounts Petty Expense flow intended to create general expense records or workshop bills? Should it remain visible while the RPC destination is unresolved?
4. Should Toll/Fastag be recorded against a trip, as a general expense, or through both only when they are distinct transactions? Which date/owner is canonical?
5. Which RTO/permit and loading/hamali costs belong in Accounts, and when must they be associated with a vehicle/trip/vendor?
6. Should general office/admin expenses be supported? What evidence, payment method and approval rules apply?
7. Does `save_driver_advance_atomic` represent a payment already made, an approved advance, or an outstanding authorization? Is CASH the only supported method?
8. Does `settle_driver_period_atomic` only mark rows settled, or does it execute/record a real driver payout?
9. Does a POD Claims/repairs amount represent driver reimbursement distinct from a vendor Workshop bill?
10. Are trip fuel snapshot fields estimates or posted costs? Which record is authoritative for the ledger/report?
11. Should the ERP support staff advance, reimbursement or payroll? Is there an authoritative staff master and approval process?
12. Should vendor credit settlement/payment tracking be implemented for AdBlue and Workshop bills?
13. Are customer invoice/receivable/receipt workflows in the intended ERP scope, beyond recording trip freight revenue?
14. Should tyre acquisition/retread be treated as operational cost, capital asset, or lifecycle-only measurement? How should disposal recovery appear in accounting?
15. Which transaction categories require approval, and what are the amount/category thresholds and separation-of-duties rules?

## 11. Database/RPC Dependencies

### FACT

- `lib/database.types.ts` contains `driver_direct_advances`, `driver_advances`, `expenses`, `driver_pending_entries`, `diesel_fuel_logs`, `trips`, `fleet_tyres`, `workshop_repairs`, and `workshop_spares_bills` type definitions.
- Active Accounts direct advance calls `save_driver_advance_atomic`; Petty Expense calls `create_workshop_bill_atomic`.
- Workshop Service Bill also calls `create_workshop_bill_atomic`.
- Active operational modules use separate dispatch/POD/fuel/AdBlue/tyre/settlement/approval RPCs.
- The checked-in migrations do not contain definitions for the financial RPCs listed here; the previous security audit could not inspect deployed database state.
- `adblue_logs` and `vendors` are queried in application source but absent from the checked-in generated type set.

### RECOMMENDATION

Before changing the menu or form destinations, verify production definitions and grants for `save_driver_advance_atomic`, `create_workshop_bill_atomic`, fuel/AdBlue RPCs, tyre RPCs, dispatch/POD RPCs, approval RPCs and `settle_driver_period_atomic`. Confirm the actual insert/update tables, validation, approval state, duplicate constraints and returned identifiers. Regenerate database types from the verified deployed schema before implementing new transaction families.

### UNKNOWN / BUSINESS DECISION

Do not infer the live target of `create_workshop_bill_atomic` from its name alone. Do not assume the typed `expenses` relation is the correct destination for Petty Expense. Do not assume `settled` means a payment was sent, and do not assume the Accounts RPC response means approval or ledger posting unless its body confirms that result.

## 12. Recommended Implementation Order

1. **Confirm ownership and definitions:** answer the decision list above; choose the canonical owner for Petty Expense vs Workshop bill and direct vs trip advance.
2. **Verify production schema/RPC behavior:** inspect deployed table/function definitions, constraints, RLS/grants, approval and settlement side effects; reconcile generated types.
3. **Approve a small Accounts menu:** keep Driver Advance (Direct). Retain Petty Expense only once its general-expense ownership and posting destination are confirmed.
4. **Resolve duplicate paths:** ensure Workshop bills are created only from Workshop; define an idempotency/reference approach if the deployed model allows duplicate bill creation.
5. **Verify report/P&L mappings:** ensure every approved Accounts transaction type appears once, with a defined date, amount, category, entity and status.
6. **Add only approved general expense types:** do so only if the existing verified model supports them; otherwise scope any schema/RPC work separately for approval.
7. **Add operational shortcuts:** navigate to Fuel, Workshop, POD, Dispatch, Settlement and Approval Queue without duplicating their entry forms.
8. **Consider new capabilities separately:** staff advances, AP/AR, receipts, payroll and cash/bank reconciliation require explicit product/accounting approval and their own data/security design.

## Catalogue Conclusion

### FACT

The implemented Accounts options are Driver Advance and Petty Expense. They are not equally safe to treat as distinct general Accounts transaction families: direct driver advance is the clear Accounts path; petty expense shares a workshop-bill RPC with Workshop and has unresolved posting semantics. The current source no longer contains the old Workshop Ledger tab.

### RECOMMENDATION

The defensible future **New Entry** menu starts with **Driver Advance (Direct)**. Keep **Petty Expense** conditional until its owner, table/RPC destination and report treatment are confirmed. All other verified financial-looking transactions should remain in their operational owner’s module and be reached through navigation shortcuts.

### UNKNOWN / BUSINESS DECISION

Do not add Staff Advance, Vendor Payment, Customer Receipt, Customer Invoice, Staff Payment, general office/admin, or any new “Other” category until the business owner approves the workflow and the underlying deployed data/RPC model is verified.
