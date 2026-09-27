# Accounts Domain and Entry Flow Audit

**Repository:** `C:\Users\unnik\kss-erp`
**Branch:** `design/premium-ui-v2`
**Scope:** Read-only audit of the Accounts area and financial-entry ownership across the ERP.
**Evidence date:** 2026-09-27
**Changes:** This report only. Application code, SQL, migrations, RPCs, schema, and existing backups were not changed.

## Evidence labels

- **FACT** — directly verified in the checked-in application source or generated database types.
- **RECOMMENDATION** — proposed future information architecture or ownership rule; not implemented.
- **UNKNOWN / BUSINESS DECISION** — cannot be settled from this repository alone. It needs a deployed RPC/schema check or an accounting/process decision.

Generated TypeScript types are a code contract snapshot, not proof of the live database schema. Only three checked-in migrations are present, and they concern driver trip actions and master CRUD/PIN security; they do not define the financial transaction tables or the financial RPCs discussed here. The previous security audit also found no production database catalog access. RPC effects below are therefore limited to what call sites, argument names, generated types, and UI behavior demonstrate.

## 1. Executive Summary

### FACT

`AccountsModule` is mounted from the admin/superadmin dashboard navigation. It currently exposes two working entry panels:

1. **Driver Advances** — driver, date, amount, category, remarks; records through `save_driver_advance_atomic` with payment mode hardcoded to `CASH`.
2. **Petty Expenses** — category, optional vehicle, amount, remarks; records through `create_workshop_bill_atomic`.

The component also exposes a **Workshop Ledger** tab/button, but its state type and rendered panels have no `workshop` case. Selecting the button leaves the content area blank. It is nonfunctional UI, not a third ledger or entry path.

The main cross-module overlap is concrete: the Petty Expenses form in Accounts and the Workshop Service Bill form in Workshop both call `create_workshop_bill_atomic` with bill date, vendor name, amount and description. The Accounts path encodes the expense category into `p_vendor_name` and passes a null invoice. The Workshop path collects a vendor and vehicle and uses the same RPC. If one real bill is entered in both forms, the call sites provide no deduplication key or shared confirmation that would prevent duplicate bills. The deployed RPC body is unavailable locally, so the exact target table and duplicate constraints require production verification; `workshop_spares_bills` is strongly indicated by the RPC name, payload and readers.

Other money-related workflows are deliberately distributed because they are attached to domain checks and operational state: dispatch creates trip revenue/cost values, POD closure records halt bata/claims and can add diesel, Fuel records fuel and AdBlue with odometer/credit validation, Workshop manages bills and tyre lifecycle, and settlement calculates and closes a driver period. These are not automatically candidates for duplicate Accounts forms.

The generated types also contain `expenses` and `driver_advances`, but no active frontend code reads or writes those tables. `driver_direct_advances` is the active direct-advance record shape used by Accounts/settlement/Reports. The existence of a typed `expenses` table does not establish that the current Petty Expenses RPC writes there.

### RECOMMENDATION

Make Accounts an entry/control workspace for transactions that are not intrinsically part of a trip, fuel, workshop, tyre, or settlement workflow. Use one focused **New Entry → family → subtype → form** flow. Preserve operational module ownership through shortcuts. Route history and exports to Reports and approvals to Approval Queue. Before building forms, agree and document the owner for general petty costs and remove the current shared-RPC ambiguity between petty costs and workshop bills.

### UNKNOWN / BUSINESS DECISION

The repository cannot establish whether the owner intends the Accounts Petty Expense path to create a generic expense, a workshop bill, or a vendor liability; whether a driver “advance” is a cash payout, an accounting liability, or only a settlement offset; or whether marking a period settled records payment or merely closes the accounting period. These decisions must precede an Accounts redesign.

## 2. Current Accounts Capabilities

### 2.1 Driver Advances — FACT

The entry form includes:

| Field | Current behavior |
|---|---|
| Advance date | Required date input, initialized to the browser's current date. |
| Driver | Required selector of active drivers, ordered by full name. |
| Amount | Required numeric input, HTML range 1–500,000; handler rejects amounts not greater than zero. |
| Category | `GENERAL_ADVANCE`, `BATA_ADVANCE`, or `SALARY_ADVANCE`; defaults to `GENERAL_ADVANCE`. |
| Remarks | Optional uppercase text, maximum 60 characters. |
| Payment mode | Not shown or selectable; RPC argument is always `CASH`. |

It calls `save_driver_advance_atomic` with date, driver ID, amount, type, `CASH`, and reference remarks. On error it displays an alert. On success it clears amount/remarks and refreshes active driver/vehicle selectors. There is no approval, acknowledgement, pending state, editing, cancellation, or payment confirmation UI in Accounts.

**Database mapping:** generated `driver_direct_advances` fields include `advance_id`, `advance_date`, `advance_type`, `amount_inr`, `driver_id`, `is_settled`, `payment_mode`, `reference_remarks`, and `settled_at`; the driver foreign key is represented in generated types. Reports and Driver Settlement read this table. The Accounts RPC name/arguments and this matching active data path strongly indicate it creates a direct advance, but the exact deployed function body and insert target are not checked in.

### 2.2 Petty Expenses — FACT

The entry form includes:

| Field | Current behavior |
|---|---|
| Expense category | `TOLL_FASTAG`, `POLICE_RTO`, `LOADING`, or `OFFICE`; defaults to toll/Fastag. |
| Vehicle | Optional vehicle selector; blank is sent as null. |
| Amount | Required numeric input, HTML range 1–100,000; handler rejects amounts not greater than zero. |
| Remarks | Optional uppercase text, maximum 60 characters. |
| Date | `expDate` state is initialized to today and passed to the RPC, but there is no visible date input. The user cannot select a different date in this form. |

It calls `create_workshop_bill_atomic` using the category as `p_vendor_name`, a null invoice number, description or default text `Petty Expense` as `p_spare_parts_details`, and the amount as `p_total_bill_amount`. On success it clears amount/remarks and refreshes selectors. There is no approval, pending state, edit/delete history, payment method, receipt/invoice field, or vendor selector.

**Important semantic mismatch — FACT:** the UI presents categories as expense types, but the RPC payload uses workshop-bill-shaped argument names and the category is assigned to the vendor field. The UI does not call a generic `expenses` table path.

### 2.3 Tabs, buttons, state, and dead UI — FACT

- Buttons: Driver Advances, Petty Expenses, Workshop Ledger.
- Panels: Driver Advances and Petty Expenses only.
- Workshop Ledger has no corresponding valid state member or rendered panel; click is accepted through `as any`, after which no panel matches. It is a dead navigation button.
- `formatDate` is declared but unused because Accounts no longer renders history.
- `isLoading` is toggled by selector refresh but not rendered.
- `expDate` is used in the RPC but not exposed as an input.
- `activeSubTab` is declared as only `advances | petty`, while tab rendering casts arbitrary IDs to `any` to admit `workshop`.
- No Accounts history/search/filter/pagination/export remains. The copy points users to Reports for history.
- No account balance, debit/credit, cash/bank account, payment reconciliation, vendor payable, receipt attachment, or financial approval panel is present.

### 2.4 Validation and calculations — FACT

- Amount checks reject values `<= 0`; HTML inputs carry upper/lower bounds but those are browser constraints.
- Driver, date and category controls use HTML required only where marked.
- Advance payment mode is fixed to CASH.
- Petty expense date is implicitly today.
- The only monetary computation is converting entered values to numbers and passing them to RPCs. No tax, debit/credit, balance, P&L, approval threshold, or payment calculation exists in Accounts.

## 3. Complete Financial Entry Inventory

The table distinguishes a **recording call** from a standalone accounting transaction. An operational record can carry a monetary value without being an Accounts ledger entry.

| Transaction / value | Current source and write | What the source records | Classification |
|---|---|---|---|
| Direct driver advance | Accounts → `save_driver_advance_atomic`; data represented by `driver_direct_advances` | Dated amount/type/payment mode/driver/remarks; later marked settled by period RPC. | **A** for a genuine off-trip direct advance; **E** if same payout is also entered as a trip advance or Bata advance. |
| Trip cash advance | TripForm → `create_dispatch_trip_atomic`; `trips.cash_advance_issued`; ModifyTrips can update trip values | Cash issued as part of an identified trip; included as a deduction in settlement balance. | **B** trip workflow; not a duplicate general Accounts advance when correctly distinguished. |
| Driver Bata | TripForm → dispatch RPC; `trips.driver_bata` | Master-derived or manually overridden trip Bata associated with dispatch. | **B/C** operational trip value and settlement amount, not a second manual Accounts expense. |
| Halt Bata | POD Closure → `close_pod_atomic`; `trips.halt_bata` | Amount entered during POD/trip closure and included in settlement calculation. | **B** POD/settlement input; not a generic duplicate expense. |
| Driver settlement balance/period closure | DriverSettlementModule reads trip Bata/halt/cash advances and `driver_direct_advances`; calls `settle_driver_period_atomic` | Calculates Bata less trip/direct advances in UI; RPC reports trip/advance counts settled. No payment method or payout event is entered in this UI. | **B** operational reconciliation; actual disbursement status is **F** until the deployed RPC/process is confirmed. |
| Driver fuel request | DriverPortal → `submit_driver_fuel_pending_atomic`; pending item in `driver_pending_entries`; ApprovalQueue approve/reject RPCs | Driver-submitted litres/odometer/remarks wait for dispatch approval and final cost. | **B** staged operational request. It is not yet the same event as a posted fuel log. |
| Diesel fuel issue/record | FuelAdvanceModule → `record_fuel_atomic`; edit/delete use corresponding RPCs; `diesel_fuel_logs` is read by reports/analytics | Vehicle/date/litres/rate/odometer/tank status; cost is calculated as litres × rate; may relate to trip/scan. | **B** fuel domain because vehicle/trip/odometer validation is required. |
| Diesel added during POD close | POD Closure → `close_pod_atomic` with `p_add_diesel`, rate and filling odometer | Atomic POD closure can include a fuel top-up at trip closure. The RPC body is not local, so exact fuel-log write behavior is **UNKNOWN**. | **B** POD/fuel operational step; verify that it posts one fuel event and does not also use a second manual fuel entry. |
| AdBlue cash purchase/filling | FuelAdvanceModule → `record_adblue_filling_atomic`; active `adblue_logs` query | Vehicle/trip/date/litres/rate/odometer/vendor/remarks/payment reference; odometer checks apply. | **B** fuel/vehicle workflow. `adblue_logs` is used in source but absent from generated types. |
| AdBlue credit purchase | FuelAdvanceModule → `record_adblue_credit_atomic`; update/delete RPCs | Adds vendor, invoice, due date, odometer and purchase data; UI requires vendor/invoice/due date for credit. | **B** operational procurement record; whether separate AP/payment workflow is needed is **F**. |
| Workshop service bill | WorkshopModule → `create_workshop_bill_atomic`; inferred `workshop_spares_bills` | Vehicle, vendor, date, description, amount; workshop validation and confirmation. | **B** when it is a vehicle repair/service bill. |
| Petty expense (Toll/Fastag, RTO/permit, loading, office) | Accounts → same `create_workshop_bill_atomic` call as Workshop | Category is sent as vendor name; optional vehicle and free text; no category-specific validation. | **E** with workshop bill route at storage/RPC level; general categories may belong in **A**, but exact ledger model and toll overlap need owner confirmation. |
| Workshop spares bill | WorkshopModule service-bill workflow and workshop/Reports data; no separate spares-specific Accounts form | Current form is titled service bill and accepts free-text description and amount; generated bill table has invoice/details/amount/vendor/vehicle. | **B** Workshop. Do not add a parallel Accounts spares form. |
| Tyre purchase | WorkshopModule → `create_tyre_purchase_atomic` | Vendor, date, amount/subtotal/tax, invoice metadata, tyre serial and inventory/mount details. | **B** controlled tyre asset/inventory lifecycle; separate accounting expense treatment is **F**. |
| Tyre retread cost | WorkshopModule → `complete_tyre_retread_atomic` with `p_retread_amount` | Cost attached to tyre retread result and lifecycle. | **B** lifecycle event; generic Accounts duplication risks double recording. |
| Tyre disposal recovery | WorkshopModule → `dispose_tyre_atomic` with recovery amount/buyer | Recovery proceeds tied to tyre disposal/scrap event. | **B/C** operational asset disposal value; accounting classification as other income/recovery is **F**. |
| Enroute repair/claims | POD Closure → `close_pod_atomic` `p_claims`; generated trip value `enroute_repairs_maintenance` | Trip-close amount labeled Claims/repairs. | **B** trip/POD context; whether this can be the same transaction as a workshop bill is **E/F** to reconcile. |
| Freight revenue | TripForm → `create_dispatch_trip_atomic`; `trips.freight_revenue`; editable in ModifyTrips | Revenue amount associated with a specific trip, master rate or manual override. No customer invoice/receivable screen was found. | **B/C** trip-generated revenue; a customer invoice/AR module does not exist in inspected source. |
| Fuel cost | Trip dispatch stores `p_fuel_expense` and a diesel log workflow records litres/rate/cost; P&L modules generally read diesel log cost | Trip snapshot and fuel-event amount may coexist. P&L reconciliation notes active P&L consumers source cost from diesel logs rather than trip `fuel_expense`. | **E/F** possible representational overlap; not enough evidence to assert duplicate ledger postings. Keep fuel entry authoritative in Fuel and define reporting source. |
| Other trip expense fields | Generated `trips` fields include `toll_fastag_expense`, `loading_unloading_expense`, `misc_trip_expense`, and `shortage_penalty_deduction`; active entry paths are not all apparent in current forms | Typed fields exist; no evidence all are currently set by active UI. Pod computes shortage quantity, but penalty amount entry/source is not established here. | **F** until call-site/deployed-RPC mapping and accounting meaning are confirmed. |
| Generic expenses table | Generated `expenses` type: expense ID/date/category/amount/description/optional vehicle | No active frontend read/write found. | **F**; do not assume this is the current petty expense target. |
| Legacy/alternate driver advances table | Generated `driver_advances`: date/amount/driver/payment mode/remarks/optional trip | No active frontend read/write found; active direct advance path uses `driver_direct_advances`. | **F** whether this table is legacy, migration residue, or used by external clients. |
| Office/Admin expense | Accounts category `OFFICE`, encoded into current workshop-bill RPC | No independent generic expense path. | Candidate **A**, but the target table and report/P&L treatment must be verified first. |
| Staff advance, staff expense/reimbursement, vendor payment, customer invoice, bank/cash transfer | No actual entry forms/table writes found in inspected application modules/types (apart from vendor-credit metadata for AdBlue) | Not present as a distinct application workflow in checked-in frontend. | **F** whether needed in product; do not invent entry types without owner decision and model verification. |

## 4. Module-by-Module Financial Ownership

| Module | Transaction / financial action | Creates or changes a money record? | Table / RPC evidence | Why it exists there | Should Accounts also create it? |
|---|---|---:|---|---|---|
| AccountsModule | Direct driver advance | Yes, via RPC | `save_driver_advance_atomic`; related active table shape `driver_direct_advances` | Central off-trip advance entry | No duplicate form elsewhere; keep as Accounts action, but clarify category and payment/approval rules. |
| AccountsModule | Petty expense | Yes, via RPC | `create_workshop_bill_atomic`; target not verifiable locally, likely workshop bill table | General expense entry presented as petty expense | Do not duplicate. Decide if general expenses remain here and give them a distinct verified storage path, or if this form is only for workshop bills. |
| AccountsModule | Workshop Ledger tab | No | No render branch or query/panel | Orphan navigation button | Remove/replace only in a future approved redesign; history already belongs in Reports. |
| TripForm | Freight, fuel amount/litres, driver Bata, trip cash advance | Yes, trip creation | `create_dispatch_trip_atomic`; `trips` | Financial values are required for trip dispatch and tied to master/odometer/trip validation. | No; an unlinked duplicate Accounts entry would break trip reconciliation. |
| TripForm | Manual driver identity for dispatch | Inserts driver master then creates trip | `drivers` insert, then dispatch RPC | Dispatch supports manually entered driver creation. Not a monetary transaction. | Not an Accounts concern. |
| ModifyTrips | Edit trip freight/Bata/advance and trip fields | Changes existing trip financial values | `modify_trip_atomic` | Correction of original operational trip record | No separate entry; correction belongs to trip workflow. |
| PodClosure | Halt Bata, claims/repairs, shortage/unloaded data; optional diesel addition | Yes/updates trip/possibly fuel through atomic RPC | `close_pod_atomic` | POD validation and trip closure determine values | No duplicate Accounts form for trip-linked items. |
| FuelAdvanceModule | Diesel entry/edit/delete | Yes | `record_fuel_atomic`, `update_fuel_atomic`, `delete_fuel_atomic`; `diesel_fuel_logs` | Fuel quantity, vehicle/trip, odometer and tank validation | No; Accounts shortcut may navigate to Fuel but should not create a second fuel record. |
| FuelAdvanceModule | AdBlue cash/credit entry/edit/delete | Yes | `record_adblue_filling_atomic`, `record_adblue_credit_atomic`, update/delete RPCs; `adblue_logs` | Odometer and credit/vendor/invoice validation | No duplicate generic expense entry; accounting payment integration remains an owner decision. |
| ApprovalQueue | Approve/reject pending driver fuel request | Approves/rejects staged item; approved action likely posts fuel/expense | `approve_driver_fuel_atomic`, `reject_driver_pending_entry_atomic`; `driver_pending_entries` | Approval after driver request and final cost | No. Accounts may link to queue but must not create another pending/posting path. RPC target behavior is unknown locally. |
| WorkshopModule | Service bill | Yes | `create_workshop_bill_atomic` | Vehicle/vendor/repair description and confirmation | No second Accounts workshop bill entry. This is the concrete overlap with Accounts petty path. |
| WorkshopModule | Tyre purchase/retread/disposal/mount/unmount | Yes, lifecycle events and amounts | `create_tyre_purchase_atomic`, `complete_tyre_retread_atomic`, `dispose_tyre_atomic`, mount/unmount/retread RPCs | Inventory, vehicle fitment, odometer and disposition constraints | No parallel Accounts entry; expose account/report linkage only after canonical accounting treatment is defined. |
| DriverSettlementModule | Calculate payable and mark period settled | Reads/calculates and invokes period-close RPC | Reads `trips`, `driver_direct_advances`; calls `settle_driver_period_atomic` | Reconciliation and settlement closure based on a driver/date range | No duplicate payout form until it is clear whether this RPC actually records disbursement. If not, Accounts may need a separate settlement payment event, but that is an owner decision. |
| DriverPortal | Submit pending fuel; perform trip/session status, odometer and breakdown actions | Pending request or operational trip state | `submit_driver_fuel_pending_atomic`, session and status RPCs | Driver-side workflow and authorization | No; approval/entry belongs to operations/Fuel. No direct driver advance/expense entry found. |
| ReportsModule | Historical trip/POD/fuel/Bata/settlement/workshop/fleet/financial reports | No | Select-only report queries | Historical search/filter/export | No. Link to reports from Accounts rather than repeat ledgers. |
| FinancialsModule | Vehicle/driver economics and fleet aggregations | No | Select-only trips/fuel/workshop bills | Analytical profitability/performance, not transaction posting | No. Keep as analytics surface. |
| ProfitLossModule | Aggregate P&L-like calculation | No | Select-only trips/fuel/workshop bills | Statement-style aggregate | No. It is not an entry workflow. |
| SetupModule | Vendor, freight, Bata and master CRUD | Master data, not money transaction | Master RPCs incl. vendor create/update | Configure selectors/rates | No. Vendor master belongs in administration. |
| Dashboard / TelemetryHUD / useFleetTelemetry | KPIs and pending counts | No financial transaction write | Read-only aggregate queries; some duplicate/non-mounted read logic exists per prior audit | Command-center metrics | No. Link only. |
| UploadHub | Scanned document intake | Inserts a pending scan, not an expense posting | `pending_scans` direct insert | Capture documents for later operations | No. Approval/posting workflow remains separate. |
| Cron audit | AI audit record | Derived system record, not ledger | Server route upserts `daily_ai_audits` | Audit metadata | No. |

## 5. Duplicate Entry Paths

### D1 — Accounts Petty Expense vs Workshop Service Bill — FACT, concrete overlap

- **Accounts path:** `handleCreateExpense` calls `create_workshop_bill_atomic`; sends expense category as vendor, optional vehicle, date, remarks and amount.
- **Workshop path:** service bill form calls the same `create_workshop_bill_atomic`; sends selected vehicle, actual vendor, date, description and amount.
- **Could this create duplicate records?** The code provides two forms reaching the same RPC and neither carries a shared event ID/idempotency token. If the user enters the same bill twice, two creations are possible unless the deployed RPC or database applies a constraint not visible here.
- **Recommendation:** select one canonical owner for workshop/vendor service bills: Workshop. Keep Accounts for only genuinely general expenses after confirming an appropriate existing storage/reporting path. Do not create a second Workshop bill subtype in Accounts.
- **Unknown:** exact destination table, uniqueness rules and whether RPC applies any de-duplication must be checked from deployed function definition/database.

### D2 — Accounts direct advance vs trip cash advance / Bata — FACT for separate pathways; UNKNOWN for same-event duplication

- Accounts `save_driver_advance_atomic` creates a direct advance path; trip dispatch records `cash_advance_issued` on a trip and calculates `driver_bata` on that trip.
- Settlement sums trip Bata/halt Bata, subtracts trip cash advances, and separately subtracts direct advances. These are intentionally different source fields in the current UI calculation.
- An operator could record the same cash payout as both a direct advance and trip cash advance, or choose `BATA_ADVANCE` in Accounts while also entering trip Bata. The source does not link or block this double representation.
- **Recommendation:** document a rule: trip-associated cash advances/Bata are entered only on TripForm/POD; Accounts direct advance is for off-trip advances. Consider making the category label/description clear, but do not change calculation semantics without approval.
- **Unknown:** whether `BATA_ADVANCE` denotes a separate cash advance against future Bata or duplicates earned Bata must be confirmed.

### D3 — Trip fuel snapshot vs fuel event — FACT fields; UNKNOWN posting duplication

- Dispatch sends `p_fuel_expense` and litres to `create_dispatch_trip_atomic`; Fuel also writes explicit fuel records using `record_fuel_atomic`. Trip schema has a `fuel_expense` field; P&L source audit found P&L consumers generally sum `diesel_fuel_logs.total_fuel_cost`, not trip snapshot `fuel_expense`.
- These may be operational trip snapshots and transaction fuel logs rather than two ledger postings, but the function body is not checked in.
- **Recommendation:** preserve Fuel as the authoritative actual fuel transaction entry and define whether dispatch `fuel_expense` is a snapshot/estimate, then ensure reports do not aggregate both as independent costs.

### D4 — POD claims/repairs vs Workshop service bill — FACT overlap in concepts; UNKNOWN duplication

- POD accepts `Claims / repairs` and sends it as `p_claims`, represented by `trips.enroute_repairs_maintenance` in generated types/reports.
- Workshop records a vehicle service bill through `create_workshop_bill_atomic`.
- Same repair could be reflected in both fields/table, but no identifier or canonical relation is visible.
- **Recommendation:** define whether POD amount means driver-paid enroute reimbursement/claim while Workshop bill means company-vendor bill. If those are distinct, retain both with labels; if same event can be recorded twice, establish one posting rule and reconcile report aggregation.

### D5 — Accounts category Toll/Fastag vs trip toll field — possible overlap, no second TripForm entry verified

- Accounts offers `TOLL_FASTAG`; trip generated type includes `toll_fastag_expense`.
- Search in the active TripForm showed no Toll input or `p_toll_fastag_expense` payload, so this audit cannot prove a live duplicate form today. A deployed RPC or other writer may populate the trip field.
- **Recommendation:** verify deployed data/RPC usage before deciding whether toll belongs only in Accounts or on trip. Do not add both paths.

### Not duplicates by themselves

- DriverPortal fuel request → ApprovalQueue decision → Fuel record represents staged submission and approval, not two authorized final postings if RPCs behave as named.
- Workshop tyre purchase/retread/disposal values belong to separate lifecycle events; do not mirror them manually in Accounts without an agreed ledger source.
- Marking a driver period settled and recording a cash payout may be separate stages; repository source does not establish that they are the same event.

## 6. Transaction Classification

| Type | Class | Rationale / ownership |
|---|---|---|
| Off-trip driver direct advance | **A** | Existing Accounts workflow and direct-advance data model. Clarify payment mode and approval policy. |
| Trip-specific cash advance | **B** | Bound to a trip and settled against that trip; TripForm owns it. |
| Trip Bata | **B/C** | Master-derived/overridden trip amount and settlement input; TripForm owns. |
| Halt Bata | **B** | Added at POD closure, linked to trip close. |
| Driver settlement calculation/period closure | **B** | Driver/date workflow; no verified payout transaction in current UI. |
| Driver fuel request awaiting approval | **B** | Staged operational request, not general expense entry. |
| Posted diesel purchase/fill | **B** | Requires truck/trip/odometer/rate/tank data. Fuel owns actual entry. |
| AdBlue fill, cash or vendor credit | **B** | Fuel/vehicle, odometer, vendor and credit metadata. |
| Workshop service/repair bill | **B** | Vehicle, vendor, work description and workshop workflow; avoid a second generic Accounts form. |
| Workshop spares bill | **B** | Workshop documentation and vehicle association. |
| Tyre purchase, retread, mount, unmount and disposal | **B** | Tyre inventory/asset lifecycle with specialized validations. Monetary effect is tied to lifecycle. |
| General office/admin expense | **A candidate** | Accounts has an OFFICE category today, but its current RPC stores it through a workshop-bill-shaped call. Verify model and reports first. |
| Toll, RTO/permit, loading/hamali, other petty operating cost | **A candidate / F** | These appear as Accounts categories, but toll field also exists on trip and storage/reporting target is unclear. Must choose a single posting rule. |
| Freight revenue | **C/B** | Trip-generated/recorded revenue tied to dispatch, not manual standalone Accounts entry. Customer invoices are not implemented in inspected code. |
| Cash advance principal | **C/F** | Settlement deduction, not necessarily an operating expense. Do not include in P&L as expense without accounting policy. |
| Shortage quantity/penalty | **B/F** | Shortage calculation occurs in POD; typed penalty field exists but monetary posting/owner is not established. |
| Tyre recovery on disposal | **B/F** | Operational recovery value; ledger income classification unknown. |
| Vendor payment / AdBlue payable settlement | **F** | AdBlue credit metadata exists; no separate payment workflow found. |
| Staff advance / staff expense / reimbursement | **F** | No staff transaction form/table flow identified in checked-in source/types. |
| Customer invoice / receivable | **F** | No billing/receivable entry flow identified; trip freight is recorded without invoice workflow. |
| Historical reports and exports | **D** | Centralized Reports and specialized Reports/Portal displays; not new entries. |
| Petty expense recorded as workshop bill | **E** | Current Accounts route shares workshop bill RPC and likely storage; semantics and deduplication unclear. |

## 7. Currently Missing From Accounts

“Missing” means no distinct Accounts form is present. It does **not** imply it belongs there.

| Transaction | Current module/path | Table/RPC | Should it become an Accounts option? | Reason |
|---|---|---|---|---|
| Staff advance | No active UI found | No staff advance table/RPC in generated types/source identified | **UNKNOWN; likely only if staff master, approval and settlement rules are defined.** | No staff entity/foreign-key flow is evident. Do not make a driver-only schema fit staff. |
| Staff expense/reimbursement | No active UI found | No active table/RPC found | **UNKNOWN** | Need claimant, approval, receipt, payment and GL requirements. |
| Vendor payment / AP settlement | AdBlue CREDIT records only store credit purchase/invoice/due date; no payment screen found | AdBlue RPCs; generated types omit `adblue_logs`; no payable settlement table identified | **UNKNOWN** | Credit purchase and paying the vendor are different events; current product handles only the purchase-side metadata. |
| Customer invoice / receivable / collection | No billing UI found; trip stores freight revenue | `trips.freight_revenue`; no invoice/receipt table or RPC identified | **Do not add until business owner confirms billing scope and model.** | Trip revenue is not evidence of invoice issuance or collection. |
| Generic office/admin/other operating expenses on a distinct general-expense ledger | Accounts has categories, but routes them to workshop bill RPC | Current RPC target unknown; generated `expenses` table is unused by frontend | **Candidate Accounts option after schema/RPC/report verification.** | Current form says expense while payload resembles workshop bill. Need correct authoritative source before expanding categories. |
| Toll/Fastag | Accounts petty category; trip schema has toll field | `create_workshop_bill_atomic` from Accounts; trip field in generated types | **Only one route after usage investigation.** | Possible duplicate semantic field. Active TripForm toll entry was not verified. |
| Driver deductions beyond advances / shortage penalty / recoveries | Trip/POD schema fields and operations; no dedicated Accounts form | Trip fields, POD RPC; `settle_driver_period_atomic` | **No generic manual Accounts option yet.** | Identify source, approvals and whether these are deductions, expenses or recovery before entry. |
| Driver settlement payout | DriverSettlement closes period and reports payable balance, but has no payment-method/receipt form | `settle_driver_period_atomic`; exact function behavior unavailable | **Unknown.** Could become a linked payment action only if RPC does not already record one. | Avoid duplicate payout or falsely treating period closure as payment. |
| Cash/bank/corporate-card payment and reconciliation | No active entry screens found | No active cash/bank ledger tables/RPCs identified | **Business decision / likely future finance scope, not inferred requirement.** | No account chart or cashbook model found. |

### Already Correctly Owned Elsewhere — FACT / RECOMMENDATION

- **Trip revenue, trip Bata and trip cash advance:** TripForm, linked to dispatch validation and trip ID.
- **Halt Bata, claims/repairs, shortage and POD-associated diesel:** PodClosure, linked to POD closure and atomic validations.
- **Diesel and AdBlue event records:** FuelAdvanceModule, linked to vehicle/trip/odometer and AdBlue credit requirements.
- **Pending driver fuel request approval:** DriverPortal submission and ApprovalQueue decision.
- **Workshop bills, spares, tyre purchase/retread/disposal:** WorkshopModule, linked to vehicle/vendor/tyre state.
- **Settlement arithmetic and period close:** DriverSettlementModule, linked to driver/date period and settled flags.
- **History, exports, P&L and analytics:** ReportsModule, ProfitLossModule and FinancialsModule in their respective read/report/analysis roles.

These should not be copied into Accounts as independent transaction forms. An Accounts workspace may link or launch the owning workflow.

## 8. Database/Table/RPC Mapping

The following is the checked-in generated-type/call-site model, not a certified production schema.

| Transaction/data family | Typed table / fields / relationships | Frontend write or read evidence | Status/date/amount/association notes |
|---|---|---|---|
| Direct driver advance | `driver_direct_advances`: `advance_id`, `advance_date`, `advance_type`, `amount_inr`, `driver_id`, `is_settled`, `payment_mode`, `reference_remarks`, `settled_at`; FK to `drivers` | Write via `save_driver_advance_atomic`; read via DriverSettlement and Reports | Date, amount, driver, settled flag; no trip FK in generated type. RPC body/approval state unknown. |
| Alternate/legacy driver advance | `driver_advances`: `advance_id`, `advance_date`, `amount`, nullable `driver_id`, `payment_mode`, `remarks`, nullable `trip_id`; FKs to drivers/trips | No active frontend `.from()` use found | Has trip association unlike active direct advance model. Whether legacy/external use remains unknown. |
| General expenses | `expenses`: `expense_id`, `expense_date`, `category`, `amount`, `description`, nullable `vehicle_id`; FK to vehicles | No active frontend `.from()`/mutation found | Generated type has no driver/trip/vendor/approval/payment columns. Current Accounts does not call it. |
| Trip financial values | `trips`: includes `freight_revenue`, `fuel_expense`, `cash_advance_issued`, `driver_bata`, `halt_bata`, `toll_fastag_expense`, `enroute_repairs_maintenance`, `loading_unloading_expense`, `misc_trip_expense`, shortage penalty/weight fields; links to vehicle/driver/branch | Dispatch RPC; ModifyTrips modification RPC; POD close RPC; read by settlement, reports, analytics | Status, trip dates, POD and settlement fields coexist. Monetary definitions and deployed RPC mapping unknown. |
| Diesel | `diesel_fuel_logs` (active read/report table; generated type has fuel ID/date/vehicle/trip, litres/rate/total cost/odometer/tank metadata) | `record_fuel_atomic`, `update_fuel_atomic`, `delete_fuel_atomic`; pending approval path | Amount is litres × rate at form. Odometer and vehicle/trip ties. Approval/post behavior of driver requests depends on unavailable RPC. |
| AdBlue | `adblue_logs` and `vendors` queried by FuelAdvanceModule; **not present in generated types** | `record_adblue_filling_atomic`, `record_adblue_credit_atomic`, `update_adblue_atomic`, `delete_adblue_atomic` | Credit path has vendor/invoice/due date; payment mode and odometer safeguards. Deployed schema is required. |
| Pending driver fuel | `driver_pending_entries`: `entry_id`, `entry_type`, `amount_inr`, `litres`, `odometer_km`, `status`, `submitted_at`, `driver_code`, `vehicle_id`, receipt/rejection fields; FK to vehicle | DriverPortal submits, ApprovalQueue reads/approves/rejects, dashboard counts | `status` is PENDING in queue. Approval state and approved record destination are only partially established by UI text. |
| Workshop bill / spares | `workshop_spares_bills`: `bill_id`, `bill_date`, `invoice_number`, `spare_parts_details`, `total_bill_amount`, nullable `vehicle_id`, `vendor_name`; FK to vehicle | Workshop and Accounts call `create_workshop_bill_atomic`; Reports/P&L/Financials read data (some field-name mismatch noted in prior P&L audit) | No generated approval/payment/status/vendor FK. Exact RPC target and live column names unknown. |
| Workshop repair | `workshop_repairs`: `repair_id`, breakdown date, preventative flag, odometer, category, notes, `total_cost_inr`, vehicle FK | Cron reads recent repair records; no active Workshop repair-create form/write identified in inspected current source | No visible vendor/bill/payment/approval fields in generated type. |
| Tyre inventory | `fleet_tyres`: tyre ID, serial, brand, type, condition/status, vehicle/position, recorded date, odometer/NSD/KM; no typed cost fields | Workshop lifecycle RPCs include purchase amounts, retread amount, recovery amount; query reads tyres | RPC payload carries financial amounts not represented by generated tyre row type. Exact cost storage/ledger linkage unknown. |
| Tyre tracking | `tyre_tracking` generated type exists | No current active component query/write found in inspected source | Possible legacy/history model; do not treat as active Accounts source without deployment/source check. |
| Vendors | Vendor table queried by Fuel and Workshop/Setup; absent from generated type list shown | Setup creates/updates vendor; Workshop/Fuel select vendors | Vendor master is not itself a transaction. Tyre/AdBlue/bill association differs; some bill payload uses vendor name string. |
| Freight/Bata masters | `destinations_freight_master`, `driver_bata_master` generated types; Setup writes through master RPCs; TripForm reads | Master CRUD RPCs, not financial transaction writes | They provide operational rate values; no posted revenue/payment by themselves. |
| Pending scans | `pending_scans` generated type contains scanned operational monetary fields and status metadata; UploadHub inserts scans; PodClosure handles/deletes/uses scans | Upload, trip/POD workflows | Intake/scan record, not a posted financial ledger event by itself. |
| Tyre asset vendors and direct payments | Vendor IDs appear in tyre purchase/lifecycle RPC payload; no payment ledger shown | Workshop RPCs | Whether these create payment/AP records or only operational cost metadata is unknown. |

### RPC evidence and limitations

Active financial/operational calls found include `save_driver_advance_atomic`, `create_workshop_bill_atomic`, `create_dispatch_trip_atomic`, `modify_trip_atomic`, `close_pod_atomic`, `settle_driver_period_atomic`, `record_fuel_atomic`, `update_fuel_atomic`, `delete_fuel_atomic`, `approve_driver_fuel_atomic`, `reject_driver_pending_entry_atomic`, AdBlue record/update/delete RPCs, tyre purchase/retread/disposal/mount/unmount RPCs, and the DriverPortal pending/session RPCs. Their financial function bodies are not present in checked-in migrations. Generated types declare some unrelated/stale RPCs but do not provide implementations.

**UNKNOWN:** exact target table, atomic inserts/updates, approval side effects, idempotency, constraints, settlement posting, tyre accounting linkage, and whether RPCs update both trip snapshots and transaction logs must be verified from the deployed catalog before implementation.

## 9. Approval Flow

### FACT

- Accounts driver advances are posted by a direct RPC call and have no local pending/approval state.
- Accounts petty expenses are posted by direct RPC call and have no local pending/approval state.
- DriverPortal fuel submissions create a pending entry; ApprovalQueue filters `driver_pending_entries.status = PENDING`.
- ApprovalQueue has an approve flow for `entry_type === FUEL`, asks for final cost and calls `approve_driver_fuel_atomic`; it also calls `reject_driver_pending_entry_atomic` with an entry and reason.
- Other entry types display legacy/acknowledgement wording in the UI; exact server-side effect is not established here.
- Driver settlement is calculated in the module and then marked settled through `settle_driver_period_atomic`; the module reports counts for trips and advances. There is no distinct settlement approval UI in Accounts.
- No transaction-level approval metadata columns are visible on generated `expenses`, `driver_direct_advances`, or `workshop_spares_bills` types.

### RECOMMENDATION

Keep approval actions authoritative in ApprovalQueue. Accounts can show a count/shortcut but should not implement a second approval or “post” pathway. Decide whether direct advances and petty costs need approval thresholds before redesign; current UI behavior is immediate posting.

### UNKNOWN / BUSINESS DECISION

The RPC bodies may enforce approval or immutability not exposed in the UI/type snapshot. Confirm whether `settle_driver_period_atomic` performs actual payment or only sets settled flags and whether advance records become immutable after period close.

## 10. Reporting Ownership

### FACT

- `ReportsModule` centrally offers Trips, POD, Diesel/Fuel, Driver Bata, Driver Settlement, Workshop, Fleet/Vehicle and Financial/P&L report categories with search/filter/export behavior.
- Accounts itself has no historical table or export now; it directs users to Reports.
- `ReportsModule` reads `driver_direct_advances` for driver-settlement history and `workshop_spares_bills` for workshop history; it also reads fuel logs and trip rows.
- `FinancialsModule` performs fleet/vehicle and driver scorecard analytics; it is read-only analysis, not Accounts entry.
- `ProfitLossModule` is a statement-style aggregate; it is read-only.
- `DriverPortal` has a current-month driver ledger with trips/direct advances and download behavior; this is driver-facing personal information, not a second office Accounts entry point.
- Workshop exposes operational tyre history for lifecycle context; this is not a general financial ledger.

### RECOMMENDATION

Accounts should not recreate transaction-history tables, filters, CSV/PDF export, P&L or driver statements. Provide links to Reports/Financials and an approvals shortcut. A post-save confirmation may show the saved transaction reference/status, but should not become a second ledger.

## 11. Recommended Accounts Information Architecture

### RECOMMENDATION — future structure based on verified flows

```text
Accounts
├── New Entry
│   ├── Advance
│   │   └── Driver direct advance (existing workflow; clarify categories/payment)
│   └── General Expense (only after storage and ownership are confirmed)
│       ├── Office / Admin
│       ├── RTO / permit
│       ├── Loading / Hamali
│       ├── Toll / Fastag (only if not trip-owned)
│       └── Other approved operating expense
├── Needs Attention
│   └── Shortcut to Approval Queue (no second approval implementation)
├── Quick Actions
│   ├── Record trip-linked value → Dispatch / POD
│   ├── Fuel / AdBlue → Fuel module
│   ├── Workshop bill / tyre → Workshop module
│   └── Driver period close → Driver Settlement
└── View History / Analysis
    ├── Reports
    ├── Financials
    └── P&L Statement
```

### Do not expose as Accounts subtypes without evidence/owner approval

- Staff advance or staff reimbursement (no staff model found).
- Workshop labour/spares/repair bill (Workshop owns vehicle/vendor validation).
- Tyre purchase/retread/disposal (specialized lifecycle RPCs).
- Diesel/AdBlue (Fuel owns odometer/vehicle/credit workflow).
- Driver Bata, halt Bata, trip cash advance, freight and POD claims (trip/POD-owned).
- Customer invoice, vendor payment, cashbook or bank transfer (no current ledger flow found).
- Driver settlement payment until the settlement RPC's real semantics are confirmed.

## 12. Recommended New Entry Flow

### RECOMMENDATION

The proposed selector architecture fits the current limited Accounts domain if transaction options are restricted to true Accounts-owned records:

1. Accounts landing screen shows concise actions and existing account-entry status, not all forms at once.
2. User selects **New Entry**.
3. Choose **Advance** or **General Expense**. Do not offer “Fuel”, “Workshop”, “Bata” or “Settlement” as new Accounts entry forms while their operational owners remain authoritative.
4. Choose subtype only where the type has an agreed business meaning and verified database/report mapping.
5. Open one focused Liquid Glass form, with date, amount, payment method, entity association, evidence/reference, validation, and explicit approval/posting language appropriate to that RPC.
6. Submit once; show the result and next action, then return to Accounts.
7. Route pending approvals to ApprovalQueue; historical details to Reports.

### UNKNOWN / BUSINESS DECISION

Before form design, resolve whether general expense uses the existing typed `expenses` relation or whether there is another deployed RPC/table, whether office/general expenses require vehicle allocation, what payment methods/accounts are supported, whether a receipt/vendor is required, and which categories are actually allowed.

## 13. Popup / Liquid Glass Interaction Model

### RECOMMENDATION

- Keep the Accounts workspace compact: primary **+ New Entry**, a small count of items needing action if an authoritative pending source exists, and shortcuts to reports/approvals.
- Use one selector sheet for family and subtype, followed by one form sheet. Avoid showing several unrelated forms simultaneously.
- Use the existing glass overlay/sheet and confirmation pattern; do not introduce another framework.
- Show transaction-specific validation in the form. For domain-specific events, navigate to the owning module rather than embedding those forms in Accounts.
- For save result, show a transaction reference/posted or pending status only if the RPC returns it; do not infer approval from a successful network response.

This pattern matches current direct driver advance and potential generic expense entry, but not vehicle/trip/odometer-sensitive operations.

## 14. Dead / Orphaned Accounts UI

| Item | Evidence | Status |
|---|---|---|
| Workshop Ledger button | Rendered as a tab, but state type omits `workshop` and there is no matching panel/query | **FACT: dead/nonfunctional tab.** It does not render a workshop ledger. |
| `formatDate` helper | Declared but never called | **FACT: unused helper.** |
| `isLoading` state | Set during selector fetching but not rendered or used for form gating | **FACT: unused presentation state.** |
| `expDate` state | Passed to RPC but no UI control renders it | **FACT: hidden/uneditable date state; entry always uses initialized date unless state is changed internally.** |
| Workshop ledger query/panel | None in Accounts | **FACT: no query/history panel remains.** |
| Exports and historical search | None in Accounts | **FACT: no obsolete export/search code was found in current component.** |
| `activeSubTab` mismatch/cast | State union is `advances | petty`; tab ID forced through `as any` | **FACT: type/UI mismatch creates the dead Workshop tab.** |

No code was removed as part of this audit.

## 15. Potential Future Schema Changes

### FACT

- Generated `expenses` is a simple date/category/amount/description/vehicle structure and is unused by the frontend.
- Active direct advances use a different generated `driver_direct_advances` shape with settlement state and driver association.
- `driver_advances` is separately typed, includes optional trip association, and is unused in active frontend.
- `workshop_spares_bills` lacks generated approval/payment fields and ties to vehicle/vendor name, not a vendor foreign key.
- `adblue_logs` and `vendors` are used by frontend code but absent from generated types as inspected.
- Generated `fleet_tyres` does not show the cost values passed in tyre lifecycle RPC payloads.

### Potential future schema change — NOT IMPLEMENTED

No schema change is proven necessary for a redesigned entry chooser. Before deciding, compare production schema/RPC bodies to generated types and check report/P&L mappings. If requirements include staff advances, AP/AR, payment reconciliation, receipts, approval states or general expenses with actor/vendor/payment-account lineage, the current generated model may not represent those requirements. Document those needs and assess normalized tables/relations only after the business owner defines them. Do not repurpose `expenses` or `driver_advances` based on names alone.

## 16. Implementation Plan — Safest Dependency Order

1. **Business definitions:** approve the distinction between direct advance, trip cash advance, Bata, settlement close and actual payout; define petty/general expense categories and whether toll is trip-linked.
2. **Production truth:** retrieve deployed table definitions, RPC bodies, grants, constraints and reports for advance, expense, workshop bill, fuel, AdBlue, tyre, pending approval and settlement. Regenerate database types from the actual database.
3. **Ownership policy:** establish one canonical creation point per event. Specifically resolve Accounts petty vs Workshop bill. Identify any idempotency/duplicate constraints.
4. **Reporting reconciliation:** verify where each selected category appears in Reports/P&L and which amount/date/vehicle/driver/trip columns are authoritative. Do not add entry types that Reports cannot identify correctly.
5. **Entry catalogue:** approve only Accounts-owned families/subtypes; represent other workflows as deep links/quick actions.
6. **Form consolidation:** implement one selector and one focused form at a time while reusing only appropriate existing RPCs. Do not change the schema/RPC unless verified requirements demand it and that scope is separately approved.
7. **Approval and result UX:** expose pending/posting/settled status only where backend state proves it; keep ApprovalQueue authoritative.
8. **History and analysis:** keep reports and analytics outside Accounts; use a small post-save receipt/reference rather than duplicated ledger tables.
9. **Validation:** verify each entry against the owning module/report and test duplicate-event prevention without altering production transactions.

## 17. Business-Owner Decisions Required

1. What exactly is a `GENERAL_ADVANCE`, `BATA_ADVANCE`, and `SALARY_ADVANCE`? Are any of these trip-specific? Who can issue them, and do they require approval?
2. Does a successful driver advance RPC mean cash was paid, an advance was authorized, or only an advance balance was recorded? Is `CASH` the only allowed payment mode?
3. Should petty `TOLL_FASTAG`, `POLICE_RTO`, `LOADING`, and `OFFICE` categories be generic Accounts expenses? Which require a vehicle, vendor, invoice, receipt, or approval?
4. Is Accounts Petty Expense intentionally meant to create a workshop bill? If not, which existing deployed general-expense table/RPC is authoritative? Does the typed `expenses` table correspond to it?
5. Are Workshop service bills and workshop spares bills one type or distinct? Are there separate workshop labour/repair flows not represented in current UI?
6. Is a POD `Claims / repairs` amount a driver reimbursement distinct from a vendor workshop bill? Can one real repair appear in both records?
7. Where is toll recorded today: Accounts petty expense, trip field, another system, or more than one? What is the canonical date and association?
8. Is diesel cost from dispatch an estimate/snapshot or a posted financial event? Which single cost source should be used in reporting when fuel log and trip snapshot both exist?
9. Does `settle_driver_period_atomic` only mark trip/advance rows settled, or also create a payment/disbursement record? What does “settled” mean operationally/accounting-wise?
10. Are fuel/AdBlue vendor credits subsequently paid in this ERP? Should the system support vendor payable/payment tracking?
11. Are tyre purchase and retread amounts capitalized, expensed, or tracked only for operational analytics? How should disposal recovery be treated?
12. Should shortage penalty, damage deductions, trip deductions, or other driver recoveries be entered, approved, or settled through Accounts or remain in POD/Settlement?
13. Does KSS need staff advances/expenses, reimbursements, customer invoicing/receivables, cashbook or bank reconciliation? None was found as an implemented entry flow.
14. What is the intended date for expense entry? Accounts Petty Expense currently stores a hidden default date; should user-entered date and timezone behavior be explicit?

## Audit Conclusion

### FACT

Accounts currently handles a direct driver-advance form and a petty-expense form, with no historical ledger or approval UI. Petty expenses share the workshop bill RPC with Workshop service bills. A dead Workshop Ledger tab remains. The operational modules own the other linked financial event paths. The generated database model contains possible but unused generic `expenses` and alternate `driver_advances` tables; their deployed purpose is unknown.

### RECOMMENDATION

Proceed toward a focused Accounts entry selector only after clarifying ownership and production RPC/table behavior. Start with the existing direct driver advance; treat general expense as a separate candidate, not as a verified existing ledger. Keep trip, POD, fuel, workshop, tyre, approval and settlement mutation workflows in their current domain modules and route to them from Accounts when useful.

### UNKNOWN / BUSINESS DECISION

The deployed RPC implementations and live database relationships were not available from checked-in migrations. Exact posting destinations, approval/immutability rules, settlement payout effects and accounting classification of several lifecycle amounts remain unverified. No silent financial/business decision should be made from the frontend labels alone.
