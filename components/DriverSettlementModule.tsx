"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AlertModal } from "@/components/AlertModal";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AlertType = "success" | "error" | "info";

interface Driver {
  driver_id: number;
  driver_code: string | null;
  full_name: string | null;
  is_active: boolean | null;
}

interface DriverTrip {
  trip_id: number;
  driver_bata: number | null;
  halt_bata: number | null;
  cash_advance_issued: number | null;
  settlement_status: string | null;
}

interface DriverAdvance {
  advance_id: number;
  amount_inr: number | null;
  is_settled: boolean | null;
}

export function DriverSettlementModule() {
  const supabase = createClient();

  const [showSettlementWorkspace, setShowSettlementWorkspace] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [alertConfig, setAlertConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info" as AlertType,
  });

  const [isSettlementConfirmOpen, setIsSettlementConfirmOpen] = useState(false);
  const [isSettling, setIsSettling] = useState(false);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });

  const [toDate, setToDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [driverTrips, setDriverTrips] = useState<DriverTrip[]>([]);
  const [driverAdvances, setDriverAdvances] = useState<DriverAdvance[]>([]);

  const formatAmt = (amt: number) =>
    (Number(amt) || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const showAlert = (
    title: string,
    message: string,
    type: AlertType = "info"
  ) => {
    setAlertConfig({
      isOpen: true,
      title,
      message,
      type,
    });
  };

  const selectedDriver = drivers.find(
    (driver) => String(driver.driver_id) === selectedDriverId
  );

  const selectedDriverLabel = selectedDriver
    ? `${selectedDriver.driver_code || "DRIVER"} - ${selectedDriver.full_name || "Unnamed Driver"}`
    : "Selected driver";

  useEffect(() => {
    let isMounted = true;

    async function fetchDrivers() {
      const { data, error } = await supabase
        .from("drivers")
        .select("driver_id, driver_code, full_name, is_active")
        .eq("is_active", true)
        .order("full_name");

      if (!isMounted) return;

      if (error) {
        showAlert(
          "Driver Load Failed",
          error.message,
          "error"
        );
        return;
      }

      setDrivers((data ?? []) as Driver[]);
    }

    fetchDrivers();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const validatePeriod = () => {
    if (!selectedDriverId) {
      showAlert(
        "Driver Required",
        "Please select a driver first.",
        "error"
      );
      return false;
    }

    if (!fromDate || !toDate) {
      showAlert(
        "Date Range Required",
        "Please select both the From Date and To Date.",
        "error"
      );
      return false;
    }

    if (fromDate > toDate) {
      showAlert(
        "Invalid Date Range",
        "From Date cannot be later than To Date.",
        "error"
      );
      return false;
    }

    return true;
  };

  const generateSettlement = async () => {
    if (!validatePeriod()) return;

    setIsProcessing(true);
    setHasSearched(false);
    setDriverTrips([]);
    setDriverAdvances([]);

    try {
      const [
        { data: trips, error: tripsError },
        { data: advances, error: advancesError },
      ] = await Promise.all([
        supabase
          .from("trips")
          .select(
            "trip_id, driver_bata, halt_bata, cash_advance_issued, settlement_status"
          )
          .eq("primary_driver_id", selectedDriverId)
          .gte("trip_start_date", fromDate)
          .lte("trip_start_date", toDate)
          .order("trip_start_date", { ascending: true }),

        supabase
          .from("driver_direct_advances")
          .select("advance_id, amount_inr, is_settled")
          .eq("driver_id", selectedDriverId)
          .gte("advance_date", fromDate)
          .lte("advance_date", toDate)
          .order("advance_date", { ascending: true }),
      ]);

      if (tripsError) {
        showAlert(
          "Trip Records Load Failed",
          tripsError.message,
          "error"
        );
        return;
      }

      if (advancesError) {
        showAlert(
          "Advance Records Load Failed",
          advancesError.message,
          "error"
        );
        return;
      }

      setDriverTrips((trips ?? []) as DriverTrip[]);
      setDriverAdvances((advances ?? []) as DriverAdvance[]);
      setHasSearched(true);
    } catch (error) {
      showAlert(
        "Settlement Load Failed",
        error instanceof Error
          ? error.message
          : "Unable to load settlement records.",
        "error"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkSettled = () => {
    if (!hasSearched || isProcessing || isSettling) return;

    const totalRecords = driverTrips.length + driverAdvances.length;

    if (totalRecords === 0) {
      showAlert(
        "Nothing to Settle",
        "There are no trip or direct advance records in the selected period.",
        "info"
      );
      return;
    }

    setIsSettlementConfirmOpen(true);
  };

  const executeMarkSettled = async () => {
    if (!selectedDriverId || !hasSearched) return;

    setIsSettling(true);
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.rpc(
        "settle_driver_period_atomic",
        {
          p_driver_id: Number(selectedDriverId),
          p_from_date: fromDate,
          p_to_date: toDate,
        }
      );

      if (error) {
        setIsSettlementConfirmOpen(false);

        showAlert(
          "Settlement Failed",
          error.message,
          "error"
        );
        return;
      }

      setIsSettlementConfirmOpen(false);

      showAlert(
        "Settlement Completed",
        `Settlement completed. Trips settled: ${
          data?.trips_settled ?? 0
        }. Advances settled: ${
          data?.advances_settled ?? 0
        }.`,
        "success"
      );

      await generateSettlement();
    } catch (error) {
      setIsSettlementConfirmOpen(false);

      showAlert(
        "Settlement Failed",
        error instanceof Error
          ? error.message
          : "Unable to complete the settlement.",
        "error"
      );
    } finally {
      setIsSettling(false);
      setIsProcessing(false);
    }
  };

  const { grandTotalBata, grandTotalTripAdv } = driverTrips.reduce(
    (totals, trip) => ({
      grandTotalBata:
        totals.grandTotalBata +
        (Number(trip.driver_bata) || 0) +
        (Number(trip.halt_bata) || 0),

      grandTotalTripAdv:
        totals.grandTotalTripAdv +
        (Number(trip.cash_advance_issued) || 0),
    }),
    {
      grandTotalBata: 0,
      grandTotalTripAdv: 0,
    }
  );

  const directAdvTotal = driverAdvances.reduce(
    (total, advance) =>
      total + (Number(advance.amount_inr) || 0),
    0
  );

  const finalBalancePayable =
    grandTotalBata -
    grandTotalTripAdv -
    directAdvTotal;

  const settledTripCount = driverTrips.filter(
    (trip) => trip.settlement_status === "SETTLED"
  ).length;

  const pendingTripCount =
    driverTrips.length - settledTripCount;

  const settledAdvanceCount = driverAdvances.filter(
    (advance) => advance.is_settled === true
  ).length;

  const pendingAdvanceCount =
    driverAdvances.length - settledAdvanceCount;

  const totalRecords =
    driverTrips.length + driverAdvances.length;

  return (
    <>
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() =>
          setAlertConfig({
            ...alertConfig,
            isOpen: false,
          })
        }
      />

      <Dialog
        open={isSettlementConfirmOpen}
        onOpenChange={(open) => {
          if (!isSettling) {
            setIsSettlementConfirmOpen(open);
          }
        }}
      >
        <DialogContent layout="modal" size="md" showClose={!isSettling}>
          <DialogHeader>
            <DialogTitle>Finalize Driver Settlement</DialogTitle>
            <p className="mt-1 text-sm leading-5 text-fg-secondary">
              Review the settlement period before completing this financial action.
            </p>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="kss-surface-raised border border-border p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-secondary">
                Settlement Period
              </p>

              <p className="mt-1 text-sm font-semibold text-fg">
                {selectedDriverLabel}
              </p>

              <p className="mt-1 text-xs text-fg-muted">
                {fromDate} → {toDate}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="kss-surface border border-border p-4">
                <p className="text-[9px] font-semibold text-fg-secondary">
                  Trip Records
                </p>

                <p className="mt-1 font-mono text-lg font-semibold text-fg">
                  {driverTrips.length}
                </p>
              </div>

              <div className="kss-surface border border-border p-4">
                <p className="text-[9px] font-semibold text-fg-secondary">
                  Direct Advances
                </p>

                <p className="mt-1 font-mono text-lg font-semibold text-fg">
                  {driverAdvances.length}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-accent-border bg-accent-soft p-4">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-accent">
                Net Payable
              </p>

              <p className="mt-1 font-mono text-2xl font-semibold text-accent">
                ₹{formatAmt(finalBalancePayable)}
              </p>
            </div>

            <p className="text-xs leading-5 text-fg-secondary">
              Once confirmed, the settlement RPC will atomically close the
              selected driver period. Review the figures before continuing.
            </p>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsSettlementConfirmOpen(false)}
              disabled={isSettling}
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={executeMarkSettled}
              disabled={isSettling}
            >
              {isSettling ? "Settling..." : "Confirm Settlement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!showSettlementWorkspace ? (
        <div className="liquid-glass w-full rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="kss-eyebrow text-accent">Accounts · Settlement</p>
              <h2 className="mt-1 text-xl font-semibold text-fg">
                Driver Settlement
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-secondary">
                Calculate driver-period balances, review advances and bata,
                and close completed settlement periods.
              </p>
            </div>

            <Button
              type="button"
              size="lg"
              className="min-h-11 shrink-0 sm:min-w-48"
              onClick={() => setShowSettlementWorkspace(true)}
            >
              Open Settlement
            </Button>
          </div>
        </div>
      ) : (
      <div className="space-y-6">
        <div className="border-b border-border pb-4">
          <h2 className="text-xl font-semibold text-fg tracking-tight">
            Driver Accounting & Settlements
          </h2>

          <p className="mt-0.5 text-xs font-medium text-fg-secondary">
            Calculate driver-period settlement balances and close the
            settlement period. Detailed history is available in Reports.
          </p>
        </div>

        <div className="liquid-glass p-6 shadow-2xl sm:p-8">
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="mb-2 block text-[10px] font-semibold tracking-normal text-fg-secondary">
                Select Driver *
              </label>

              <Select
                value={selectedDriverId}
                onChange={(e) => {
                  setSelectedDriverId(e.target.value);
                  setHasSearched(false);
                  setDriverTrips([]);
                  setDriverAdvances([]);
                }}
                className="h-auto py-3.5 text-xs font-bold"
              >
                <option value="">-- SELECT DRIVER --</option>

                {drivers.map((driver) => (
                  <option
                    key={driver.driver_id}
                    value={driver.driver_id}
                  >
                    {driver.driver_code} - {driver.full_name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-semibold tracking-normal text-fg-secondary">
                From Date *
              </label>

              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setHasSearched(false);
                }}
                className="h-auto py-3.5 text-xs font-semibold"
              />
            </div>

            <div className="flex items-end">
              <div className="w-full">
                <label className="mb-2 block text-[10px] font-semibold tracking-normal text-fg-secondary">
                  To Date *
                </label>

                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setHasSearched(false);
                    }}
                    className="h-auto py-3.5 text-xs font-semibold"
                  />

                  <Button
                    type="button"
                    onClick={generateSettlement}
                    disabled={
                      isProcessing ||
                      isSettling ||
                      !selectedDriverId
                    }
                    size="lg"
                  >
                    {isProcessing ? "Loading..." : "Load"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {hasSearched && (
            <div className="animate-slide-up space-y-8">
              <div className="kss-surface border border-border p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-fg-secondary">
                      Settlement Period
                    </p>

                    <p className="mt-1 text-sm font-semibold text-fg">
                      {selectedDriverLabel}
                    </p>

                    <p className="mt-1 text-xs text-fg-muted">
                      {fromDate} → {toDate}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center sm:flex">
                    <div className="rounded-xl border border-border bg-surface/50 px-4 py-2">
                      <p className="text-[9px] font-semibold text-fg-secondary">
                        Trips
                      </p>
                      <p className="mt-1 text-sm font-semibold text-fg">
                        {driverTrips.length}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-surface/50 px-4 py-2">
                      <p className="text-[9px] font-semibold text-fg-secondary">
                        Advances
                      </p>
                      <p className="mt-1 text-sm font-semibold text-fg">
                        {driverAdvances.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="kss-surface-raised border border-border p-5">
                  <p className="text-[9px] font-semibold tracking-normal text-fg-secondary">
                    Total Trips
                  </p>

                  <p className="mt-2 font-mono text-2xl font-semibold text-fg">
                    {driverTrips.length}
                  </p>
                </div>

                <div className="kss-surface-raised border border-success/20 p-5">
                  <p className="text-[9px] font-semibold tracking-normal text-success">
                    Gross Bata Earned
                  </p>

                  <p className="mt-2 font-mono text-2xl font-semibold text-success">
                    {formatAmt(grandTotalBata)}
                  </p>
                </div>

                <div className="kss-surface-raised border border-danger/20 p-5">
                  <p className="text-[9px] font-semibold tracking-normal text-danger">
                    Total Deductions
                  </p>

                  <p className="mt-2 font-mono text-2xl font-semibold text-danger">
                    {formatAmt(
                      grandTotalTripAdv + directAdvTotal
                    )}
                  </p>
                </div>

                <div className="kss-surface-raised border border-accent-border p-5">
                  <p className="text-[9px] font-semibold tracking-normal text-accent">
                    Net Payable
                  </p>

                  <p className="mt-2 font-mono text-2xl font-semibold text-accent sm:text-3xl">
                    {formatAmt(finalBalancePayable)}
                  </p>
                </div>
              </div>

              <div className="kss-surface p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-fg">
                      Settlement Status
                    </h4>

                    <p className="mt-1 text-xs text-fg-muted">
                      Current status of the records loaded for this
                      period.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-success/20 bg-success-soft px-4 py-3">
                      <p className="text-[9px] font-semibold text-success">
                        Settled Trips
                      </p>
                      <p className="mt-1 text-sm font-semibold text-success">
                        {settledTripCount}
                      </p>
                    </div>

                    <div className="rounded-xl border border-warning/20 bg-warning-soft px-4 py-3">
                      <p className="text-[9px] font-semibold text-warning">
                        Pending Trips
                      </p>
                      <p className="mt-1 text-sm font-semibold text-warning">
                        {pendingTripCount}
                      </p>
                    </div>

                    <div className="rounded-xl border border-success/20 bg-success-soft px-4 py-3">
                      <p className="text-[9px] font-semibold text-success">
                        Settled Advances
                      </p>
                      <p className="mt-1 text-sm font-semibold text-success">
                        {settledAdvanceCount}
                      </p>
                    </div>

                    <div className="rounded-xl border border-warning/20 bg-warning-soft px-4 py-3">
                      <p className="text-[9px] font-semibold text-warning">
                        Pending Advances
                      </p>
                      <p className="mt-1 text-sm font-semibold text-warning">
                        {pendingAdvanceCount}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="kss-surface p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-fg">
                      Settlement period loaded
                    </h4>

                    <p className="mt-1 text-xs text-fg-muted">
                      {driverTrips.length} trip records and{" "}
                      {driverAdvances.length} direct advance records
                      loaded.
                    </p>

                    <p className="mt-1 text-xs text-fg-muted">
                      Detailed transaction history is available in
                      Reports.
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[9px] font-semibold text-fg-secondary">
                      Final Net Payable
                    </p>

                    <p className="font-mono text-xl font-semibold text-accent">
                      {formatAmt(finalBalancePayable)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
                <p className="text-xs text-fg-muted">
                  {totalRecords === 0
                    ? "No settlement records found for this period."
                    : "Review the settlement figures before closing the period."}
                </p>

                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={handleMarkSettled}
                  disabled={
                    isProcessing ||
                    isSettling ||
                    totalRecords === 0
                  }
                >
                  {isSettling
                    ? "Settling..."
                    : "Mark Period as Settled"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </>
  );
}
