"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/FormField";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AccountWorkspace = "advances" | "expenses" | null;

type Driver = {
  driver_id: number;
  full_name: string | null;
  driver_code?: string | null;
};

type Vehicle = {
  vehicle_id: number;
  vehicle_number: string | null;
};

type DriverAdvance = {
  advance_id: number;
  advance_date: string;
  driver_id: number;
  amount_inr: number;
  advance_type: string | null;
  payment_mode: string | null;
  reference_remarks: string | null;
  is_settled: boolean | null;
  settled_at: string | null;
  created_at: string | null;
};

type Expense = {
  expense_id: number;
  expense_date: string;
  category: string;
  amount: number;
  description: string | null;
  vehicle_id: number | null;
  created_at: string | null;
};

const ADVANCE_TYPES = [
  { value: "GENERAL_ADVANCE", label: "General Advance" },
  { value: "BATA_ADVANCE", label: "Bata Advance" },
  { value: "SALARY_ADVANCE", label: "Salary Advance" },
];

const PAYMENT_MODES = [
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Bank" },
  { value: "UPI", label: "UPI" },
];

const EXPENSE_CATEGORIES = [
  { value: "OFFICE_ADMIN", label: "Office / Administration" },
  { value: "POLICE_RTO", label: "Police / RTO" },
  { value: "BANK_CHARGES", label: "Bank Charges" },
  { value: "COMPANY_MISC", label: "Company Miscellaneous" },
];

function today() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value: number | null | undefined) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function AccountsModule() {
  const supabase = createClient();

  const [workspace, setWorkspace] = useState<AccountWorkspace>(null);
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [advances, setAdvances] = useState<DriverAdvance[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [showExpenseHistory, setShowExpenseHistory] = useState(false);

  const [advancePage, setAdvancePage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);

  const [advanceDate, setAdvanceDate] = useState(today());
  const [advanceDriverId, setAdvanceDriverId] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState<number | "">("");
  const [advanceType, setAdvanceType] = useState("GENERAL_ADVANCE");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [advanceRemarks, setAdvanceRemarks] = useState("");

  const [expenseDate, setExpenseDate] = useState(today());
  const [expenseCategory, setExpenseCategory] = useState("OFFICE_ADMIN");
  const [expenseAmount, setExpenseAmount] = useState<number | "">("");
  const [expenseVehicleId, setExpenseVehicleId] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");

  const driverNameById = useMemo(() => {
    return new Map(
      drivers.map((driver) => [
        driver.driver_id,
        driver.full_name || driver.driver_code || `Driver #${driver.driver_id}`,
      ]),
    );
  }, [drivers]);

  const vehicleNumberById = useMemo(() => {
    return new Map(
      vehicles.map((vehicle) => [
        vehicle.vehicle_id,
        vehicle.vehicle_number || `Vehicle #${vehicle.vehicle_id}`,
      ]),
    );
  }, [vehicles]);

  const outstandingAdvances = useMemo(
    () => advances.filter((advance) => !advance.is_settled),
    [advances],
  );

  const outstandingAmount = useMemo(
    () =>
      outstandingAdvances.reduce(
        (total, advance) => total + Number(advance.amount_inr || 0),
        0,
      ),
    [outstandingAdvances],
  );

  const totalAdvanceAmount = useMemo(
    () =>
      advances.reduce(
        (total, advance) => total + Number(advance.amount_inr || 0),
        0,
      ),
    [advances],
  );

  const totalExpenseAmount = useMemo(
    () =>
      expenses.reduce(
        (total, expense) => total + Number(expense.amount || 0),
        0,
      ),
    [expenses],
  );

  const PAGE_SIZE = 10;

  const advancePageCount = Math.max(
    1,
    Math.ceil(advances.length / PAGE_SIZE),
  );

  const expensePageCount = Math.max(
    1,
    Math.ceil(expenses.length / PAGE_SIZE),
  );

  const paginatedAdvances = useMemo(() => {
    const start = (advancePage - 1) * PAGE_SIZE;
    return advances.slice(start, start + PAGE_SIZE);
  }, [advances, advancePage]);

  const paginatedExpenses = useMemo(() => {
    const start = (expensePage - 1) * PAGE_SIZE;
    return expenses.slice(start, start + PAGE_SIZE);
  }, [expenses, expensePage]);

  async function loadReferenceData() {
    const [driversRes, vehiclesRes] = await Promise.all([
      supabase
        .from("drivers")
        .select("driver_id, full_name, driver_code")
        .eq("is_active", true)
        .order("full_name"),
      supabase
        .from("vehicles")
        .select("vehicle_id, vehicle_number")
        .eq("is_active", true)
        .order("vehicle_number"),
    ]);

    if (driversRes.error) {
      throw new Error(driversRes.error.message);
    }

    if (vehiclesRes.error) {
      throw new Error(vehiclesRes.error.message);
    }

    setDrivers((driversRes.data || []) as Driver[]);
    setVehicles((vehiclesRes.data || []) as Vehicle[]);
  }

  async function loadAdvanceData() {
    const { data, error } = await supabase
      .from("driver_direct_advances")
      .select(
        "advance_id, advance_date, driver_id, amount_inr, advance_type, payment_mode, reference_remarks, is_settled, settled_at, created_at",
      )
      .order("advance_date", { ascending: false })
      .limit(200);

    if (error) {
      throw new Error(error.message);
    }

    setAdvances((data || []) as DriverAdvance[]);
  }

  async function loadExpenseData() {
    const { data, error } = await supabase
      .from("expenses")
      .select(
        "expense_id, expense_date, category, amount, description, vehicle_id, created_at",
      )
      .order("expense_date", { ascending: false })
      .limit(200);

    if (error) {
      throw new Error(error.message);
    }

    setExpenses((data || []) as Expense[]);
  }

  async function loadAccountsData() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      await Promise.all([
        loadReferenceData(),
        loadAdvanceData(),
        loadExpenseData(),
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load Accounts data.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAccountsData();
  }, []);

  function resetAdvanceForm() {
    setAdvanceDate(today());
    setAdvanceDriverId("");
    setAdvanceAmount("");
    setAdvanceType("GENERAL_ADVANCE");
    setPaymentMode("CASH");
    setAdvanceRemarks("");
  }

  function openWorkspace(nextWorkspace: Exclude<AccountWorkspace, null>) {
    setErrorMessage("");
    setWorkspace(nextWorkspace);
  }

  async function handleCreateAdvance(event: React.FormEvent) {
    event.preventDefault();

    const amount = Number(advanceAmount);

    if (!advanceDriverId) {
      alert("Please select a driver.");
      return;
    }

    if (!amount || amount <= 0) {
      alert("Please enter a valid advance amount.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const { error } = await supabase.rpc("save_driver_advance_atomic", {
        p_advance_date: advanceDate,
        p_driver_id: Number(advanceDriverId),
        p_amount_inr: amount,
        p_advance_type: advanceType,
        p_payment_mode: paymentMode,
        p_reference_remarks: advanceRemarks.trim() || undefined,
      });

      if (error) {
        throw new Error(error.message);
      }

      await loadAdvanceData();

      resetAdvanceForm();
      setShowAdvanceDialog(false);
      alert("Driver advance recorded successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to record driver advance.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateExpense(event: React.FormEvent) {
    event.preventDefault();

    const amount = Number(expenseAmount);

    if (!expenseDate) {
      setErrorMessage("Please select an expense date.");
      return;
    }

    if (!expenseCategory) {
      setErrorMessage("Please select an expense category.");
      return;
    }

    if (!amount || amount <= 0) {
      setErrorMessage("Please enter a valid expense amount.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const { error } = await supabase.rpc("save_general_expense_atomic", {
        p_expense_date: expenseDate,
        p_category: expenseCategory,
        p_amount: amount,
        p_vehicle_id: expenseVehicleId
          ? Number(expenseVehicleId)
          : null,
        p_description: expenseDescription.trim() || null,
      });

      if (error) {
        throw new Error(error.message);
      }

      await loadExpenseData();

      setExpenseDate(today());
      setExpenseCategory("OFFICE_ADMIN");
      setExpenseAmount("");
      setExpenseVehicleId("");
      setExpenseDescription("");
      setShowExpenseDialog(false);

      alert("General expense recorded successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to record general expense.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function renderWorkspaceHeader(title: string, description: string) {
    return (
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
            Accounts Workspace
          </p>
          <h3 className="text-xl font-semibold tracking-tight text-fg">
            {title}
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-secondary">
            {description}
          </p>
        </div>

        <Button
          type="button"
          variant="glass"
          className="self-start"
          onClick={() => setWorkspace(null)}
        >
          Back to Accounts
        </Button>
      </div>
    );
  }

  function renderAdvancesWorkspace() {
    return (
      <section>
        {renderWorkspaceHeader(
          "Driver Advances",
          "Manage off-trip advances issued directly to drivers.",
        )}

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="liquid-glass rounded-xl border border-border p-4">
            <p className="kss-eyebrow text-fg-secondary">
              Outstanding
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-fg">
              {formatMoney(outstandingAmount)}
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              {outstandingAdvances.length} unsettled advance
              {outstandingAdvances.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="liquid-glass rounded-xl border border-border p-4">
            <p className="kss-eyebrow text-fg-secondary">
              Recent Advances
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-fg">
              {advances.length}
            </p>
            <p className="mt-1 text-xs text-fg-muted">Latest 200 records</p>
          </div>

          <div className="liquid-glass rounded-xl border border-border p-4">
            <p className="kss-eyebrow text-fg-secondary">
              Recorded Value
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-fg">
              {formatMoney(totalAdvanceAmount)}
            </p>
            <p className="mt-1 text-xs text-fg-muted">Loaded advance history</p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => setShowAdvanceDialog(true)}
          >
            New Driver Advance
          </Button>

          <Button
            type="button"
            variant="glass"
            onClick={() => void loadAdvanceData()}
          >
            Refresh
          </Button>
        </div>

        <div className="liquid-glass overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border px-5 py-4">
            <h4 className="font-semibold text-fg">Advance Ledger</h4>
            <p className="mt-1 text-xs text-fg-muted">
              Direct driver advances only. Trip cash advances and Bata remain
              part of the trip workflow.
            </p>
          </div>

          {isLoading ? (
            <div className="px-5 py-10 text-center text-sm text-fg-secondary">
              Loading advances…
            </div>
          ) : advances.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-fg-secondary">
              No driver advances recorded.
            </div>
          ) : (
            <>
              <div className="w-full overflow-hidden">
              <Table className="w-full table-fixed">
              <colgroup>
                <col className="w-[110px]" />
                <col className="w-[190px]" />
                <col className="w-[140px]" />
                <col className="w-[130px]" />
                <col className="w-[130px]" />
                <col className="w-[120px]" />
                <col className="w-[260px]" />
              </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAdvances.map((advance) => (
                    <TableRow
                    key={advance.advance_id}
                    className="border-border/70 hover:bg-glass-bg-hover"
                  >
                      <TableCell className="text-fg">
                        {formatDate(advance.advance_date)}
                      </TableCell>
                      <TableCell className="text-fg">
                        {driverNameById.get(advance.driver_id) ||
                          `Driver #${advance.driver_id}`}
                      </TableCell>
                      <TableCell className="text-fg-secondary">
                        {advance.advance_type || "—"}
                      </TableCell>
                      <TableCell className="text-fg-secondary">
                        {advance.payment_mode || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-fg">
                        {formatMoney(advance.amount_inr)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            advance.is_settled
                              ? "status-badge status-success"
                              : "status-badge status-warning"
                          }
                        >
                          {advance.is_settled ? "Settled" : "Outstanding"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate text-fg-secondary">
                        {advance.reference_remarks || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {advances.length > PAGE_SIZE && (
              <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-fg-secondary">
                  Showing{" "}
                  <span className="font-medium text-fg">
                    {(advancePage - 1) * PAGE_SIZE + 1}
                  </span>
                  {" "}–{" "}
                  <span className="font-medium text-fg">
                    {Math.min(advancePage * PAGE_SIZE, advances.length)}
                  </span>
                  {" "}of{" "}
                  <span className="font-medium text-fg">
                    {advances.length}
                  </span>
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="glass"
                    size="sm"
                    disabled={advancePage === 1}
                    onClick={() =>
                      setAdvancePage((page) => Math.max(1, page - 1))
                    }
                  >
                    Previous
                  </Button>

                  <span className="min-w-20 text-center text-xs font-medium text-fg-secondary">
                    Page {advancePage} of {advancePageCount}
                  </span>

                  <Button
                    type="button"
                    variant="glass"
                    size="sm"
                    disabled={advancePage >= advancePageCount}
                    onClick={() =>
                      setAdvancePage((page) =>
                        Math.min(advancePageCount, page + 1),
                      )
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </section>
    );
  }

  function renderExpensesWorkspace() {
    return (
      <section>
        {renderWorkspaceHeader(
          "General Expenses",
          "General company expenses that do not belong to Workshop, Fuel, Trips, or Driver Settlement.",
        )}

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="liquid-glass rounded-xl border border-border p-4">
            <p className="kss-eyebrow text-fg-secondary">
              Recorded Expenses
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-fg">
              {expenses.length}
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              Latest 200 records
            </p>
          </div>

          <div className="liquid-glass rounded-xl border border-border p-4">
            <p className="kss-eyebrow text-fg-secondary">
              Recorded Value
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-fg">
              {formatMoney(totalExpenseAmount)}
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              Loaded expense history
            </p>
          </div>

          <div className="liquid-glass rounded-xl border border-border p-4">
            <p className="kss-eyebrow text-fg-secondary">
              Entry Status
            </p>
            <p className="mt-2 text-lg font-semibold text-fg">
              Ready
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              General expense entry is available through the secured transaction path.
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <Button
            type="button"
            variant="glass"
            onClick={() => {
              setErrorMessage("");
              setShowExpenseDialog(true);
            }}
            className="group h-auto min-h-24 w-full justify-between rounded-xl border border-border p-4 text-left hover:bg-glass-bg-hover"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-secondary">
                Transaction
              </p>
              <p className="mt-1 text-base font-semibold text-fg">
                New Expense
              </p>
              <p className="mt-1 text-xs leading-5 text-fg-muted">
                Prepare a general company expense entry for Accounts.
              </p>
            </div>

            <span className="ml-4 shrink-0 text-lg text-fg-muted transition-transform group-hover:translate-x-1">
              →
            </span>
          </Button>

          <Button
            type="button"
            variant="glass"
            onClick={() => setShowExpenseHistory(true)}
            className="group h-auto min-h-24 w-full justify-between rounded-xl border border-border p-4 text-left hover:bg-glass-bg-hover"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-secondary">
                Records
              </p>
              <p className="mt-1 text-base font-semibold text-fg">
                Expense History
              </p>
              <p className="mt-1 text-xs leading-5 text-fg-muted">
                Review recorded company-level expenses.
              </p>
            </div>

            <span className="ml-4 shrink-0 text-lg text-fg-muted transition-transform group-hover:translate-x-1">
              →
            </span>
          </Button>
        </div>

        <div className="liquid-glass rounded-xl border border-border p-4">
          <p className="kss-eyebrow text-fg-secondary">
            Expense Entry
          </p>
          <p className="mt-2 text-sm leading-6 text-fg-secondary">
            Create general company expenses using the New Expense action.
            Entries are submitted through the secured Accounts transaction RPC.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {!workspace ? (
        <div className="liquid-glass w-full rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-5">
            <div>
              <p className="kss-eyebrow text-accent">Accounts · Finance</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-fg">
                Accounts
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-secondary">
                Financial transaction entry and account-level records.
              </p>
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
                {errorMessage}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <Button
                type="button"
                variant="glass"
                onClick={() => openWorkspace("advances")}
                className="group h-auto min-h-24 w-full justify-between rounded-xl border border-border p-4 text-left hover:bg-glass-bg-hover"
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-secondary">
                    Transaction
                  </p>
                  <p className="mt-1 text-base font-semibold text-fg">
                    Driver Advances
                  </p>
                  <p className="mt-1 text-xs leading-5 text-fg-muted">
                    Record direct advances issued to drivers outside trip dispatch.
                  </p>
                </div>

                <span className="ml-4 shrink-0 text-lg text-fg-muted transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Button>

              <Button
                type="button"
                variant="glass"
                onClick={() => openWorkspace("expenses")}
                className="group h-auto min-h-24 w-full justify-between rounded-xl border border-border p-4 text-left hover:bg-glass-bg-hover"
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-secondary">
                    Transaction
                  </p>
                  <p className="mt-1 text-base font-semibold text-fg">
                    General Expenses
                  </p>
                  <p className="mt-1 text-xs leading-5 text-fg-muted">
                    Review general company expenses without mixing other modules.
                  </p>
                </div>

                <span className="ml-4 shrink-0 text-lg text-fg-muted transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Button>
            </div>
          </div>
        </div>
      ) : workspace === "advances" ? (
        renderAdvancesWorkspace()
      ) : (
        renderExpensesWorkspace()
      )}

      <Dialog
        open={showExpenseDialog}
        onOpenChange={(open) => {
          setShowExpenseDialog(open);
          if (!open) {
            setExpenseDate(today());
            setExpenseCategory("OFFICE_ADMIN");
            setExpenseAmount("");
            setExpenseVehicleId("");
            setExpenseDescription("");
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>New General Expense</DialogTitle>
            <DialogDescription>
              Record a company-level expense that is not directly attributable to
              a trip, fuel issue, workshop repair, or driver settlement.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            {errorMessage && (
              <div className="mb-5 rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
                {errorMessage}
              </div>
            )}

            <form
              id="general-expense-form"
              onSubmit={handleCreateExpense}
              className="grid gap-5 md:grid-cols-2"
            >
              <FormField id="expense-date" label="Date" required>
                <Input
                  type="date"
                  value={expenseDate}
                  onChange={(event) => setExpenseDate(event.target.value)}
                  required
                />
              </FormField>

              <FormField id="expense-category" label="Category" required>
                <Select
                  value={expenseCategory}
                  onChange={(event) =>
                    setExpenseCategory(event.target.value)
                  }
                  required
                >
                  {EXPENSE_CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField id="expense-amount" label="Amount (₹)" required>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={expenseAmount}
                  onChange={(event) =>
                    setExpenseAmount(
                      event.target.value === ""
                        ? ""
                        : Number(event.target.value),
                    )
                  }
                  placeholder="0.00"
                  required
                />
              </FormField>

              <FormField id="expense-vehicle" label="Vehicle">
                <Select
                  value={expenseVehicleId}
                  onChange={(event) =>
                    setExpenseVehicleId(event.target.value)
                  }
                >
                  <option value="">General / No Vehicle</option>
                  {vehicles.map((vehicle) => (
                    <option
                      key={vehicle.vehicle_id}
                      value={vehicle.vehicle_id}
                    >
                      {vehicle.vehicle_number ||
                        `Vehicle #${vehicle.vehicle_id}`}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField
                id="expense-description"
                label="Description"
                className="md:col-span-2"
              >
                <Textarea
                  value={expenseDescription}
                  onChange={(event) =>
                    setExpenseDescription(event.target.value)
                  }
                  placeholder="Enter expense details, reference or remarks"
                  aria-label="Description"
                />
              </FormField>
            </form>

            <div className="mt-5 rounded-xl border border-border bg-white/[0.02] p-4">
              <p className="kss-eyebrow text-fg-secondary">
                Expense Entry
              </p>
              <p className="mt-2 text-sm font-medium text-fg">
                Ready to record
              </p>
              <p className="mt-1 text-xs leading-5 text-fg-muted">
                Save submits the entry through the secured Accounts expense
                transaction RPC.
              </p>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="glass"
              onClick={() => setShowExpenseDialog(false)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={isSaving}
              onClick={() => {
                const form = document.getElementById("general-expense-form");
                if (form instanceof HTMLFormElement) {
                  form.requestSubmit();
                }
              }}
            >
              {isSaving ? "Saving..." : "Save Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showExpenseHistory}
        onOpenChange={setShowExpenseHistory}
      >
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>Expense History</DialogTitle>
            <DialogDescription>
              Recorded general expenses. Ten records are shown per page.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            {expenses.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-fg-secondary">
                No expense history available.
              </div>
            ) : (
              <div className="liquid-glass overflow-hidden rounded-xl border border-border">
                <div className="w-full overflow-hidden">
                  <Table className="w-full table-fixed">
                    <colgroup>
                      <col className="w-[120px]" />
                      <col className="w-[220px]" />
                      <col className="w-[180px]" />
                      <col className="w-[150px]" />
                      <col className="w-[280px]" />
                    </colgroup>

                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-fg-secondary">
                          Date
                        </TableHead>
                        <TableHead className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-fg-secondary">
                          Category
                        </TableHead>
                        <TableHead className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-fg-secondary">
                          Vehicle
                        </TableHead>
                        <TableHead className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-fg-secondary">
                          Amount
                        </TableHead>
                        <TableHead className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-fg-secondary">
                          Description
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {paginatedExpenses.map((expense) => (
                        <TableRow
                          key={expense.expense_id}
                          className="border-border/70 hover:bg-glass-bg-hover"
                        >
                          <TableCell className="text-fg">
                            {formatDate(expense.expense_date)}
                          </TableCell>

                          <TableCell className="text-fg-secondary">
                            {expense.category}
                          </TableCell>

                          <TableCell className="text-fg-secondary">
                            {expense.vehicle_id
                              ? vehicleNumberById.get(expense.vehicle_id) ||
                                `Vehicle #${expense.vehicle_id}`
                              : "General"}
                          </TableCell>

                          <TableCell className="text-right font-medium text-fg">
                            {formatMoney(expense.amount)}
                          </TableCell>

                          <TableCell className="max-w-[360px] truncate text-fg-secondary">
                            {expense.description || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {expenses.length > PAGE_SIZE && (
                  <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-fg-secondary">
                      Showing{" "}
                      <span className="font-medium text-fg">
                        {(expensePage - 1) * PAGE_SIZE + 1}
                      </span>{" "}
                      –{" "}
                      <span className="font-medium text-fg">
                        {Math.min(
                          expensePage * PAGE_SIZE,
                          expenses.length,
                        )}
                      </span>{" "}
                      of{" "}
                      <span className="font-medium text-fg">
                        {expenses.length}
                      </span>
                    </p>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="glass"
                        size="sm"
                        disabled={expensePage === 1}
                        onClick={() =>
                          setExpensePage((page) => Math.max(1, page - 1))
                        }
                      >
                        Previous
                      </Button>

                      <span className="min-w-20 text-center text-xs font-medium text-fg-secondary">
                        Page {expensePage} of {expensePageCount}
                      </span>

                      <Button
                        type="button"
                        variant="glass"
                        size="sm"
                        disabled={expensePage >= expensePageCount}
                        onClick={() =>
                          setExpensePage((page) =>
                            Math.min(expensePageCount, page + 1),
                          )
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="glass"
              onClick={() => setShowExpenseHistory(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showAdvanceDialog}
        onOpenChange={(open) => {
          setShowAdvanceDialog(open);
          if (!open) resetAdvanceForm();
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>New Driver Advance</DialogTitle>
            <DialogDescription>
              Record an off-trip advance issued directly to a driver.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAdvance}>
            <DialogBody>
              {errorMessage && (
                <div className="mb-5 rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
                  {errorMessage}
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                <FormField id="advance-date" label="Date" required>
                  <Input
                    type="date"
                    value={advanceDate}
                    onChange={(event) => setAdvanceDate(event.target.value)}
                    required
                  />
                </FormField>

                <FormField id="advance-driver" label="Driver" required>
                  <Select
                    value={advanceDriverId}
                    onChange={(event) => setAdvanceDriverId(event.target.value)}
                    required
                  >
                    <option value="">Select driver</option>
                    {drivers.map((driver) => (
                      <option key={driver.driver_id} value={driver.driver_id}>
                        {driver.full_name ||
                          driver.driver_code ||
                          `Driver #${driver.driver_id}`}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField id="advance-amount" label="Amount (₹)" required>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={advanceAmount}
                    onChange={(event) =>
                      setAdvanceAmount(
                        event.target.value === ""
                          ? ""
                          : Number(event.target.value),
                      )
                    }
                    placeholder="0.00"
                    required
                  />
                </FormField>

                <FormField id="advance-type" label="Advance Type">
                  <Select
                    value={advanceType}
                    onChange={(event) => setAdvanceType(event.target.value)}
                  >
                    {ADVANCE_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField id="advance-payment-mode" label="Payment Mode">
                  <Select
                    value={paymentMode}
                    onChange={(event) => setPaymentMode(event.target.value)}
                  >
                    {PAYMENT_MODES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField
                  id="advance-remarks"
                  label="Remarks"
                  className="md:col-span-2"
                >
                  <Textarea
                    value={advanceRemarks}
                    onChange={(event) => setAdvanceRemarks(event.target.value)}
                    placeholder="Optional reference or remarks"
                    aria-label="Remarks"
                  />
                </FormField>
              </div>

              <div className="mt-5 rounded-xl border border-glass-border bg-white/[0.02] p-4 text-xs leading-5 text-fg-secondary">
                This screen is for direct/off-trip driver advances. Trip cash
                advances and Bata must continue through the Trip workflow.
              </div>
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="glass"
                onClick={() => setShowAdvanceDialog(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving…" : "Record Advance"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
