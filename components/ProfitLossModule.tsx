"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database, Tables } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertModal } from "@/components/AlertModal";

interface TripRow {
  trip_id: number;
  trip_number: string;
  trip_start_date: string;
  freight_revenue: number | null;
  driver_bata: number | null;
  halt_bata: number | null;
  toll_fastag_expense: number | null;
  loading_unloading_expense: number | null;
  enroute_repairs_maintenance: number | null;
  misc_trip_expense: number | null;
  shortage_penalty_deduction: number | null;
}

interface FuelRow {
  fuel_log_id: number;
  fuel_date: string;
  litres_filled: number;
  total_fuel_cost: number;
}

interface SparesRow {
  bill_id: number;
  bill_date: string | null;
  total_bill_amount: number | null;
}

type AlertType = "success" | "error" | "info";

interface AlertConfig {
  isOpen: boolean;
  title: string;
  message: string;
  type: AlertType;
}

const formatCurrency = (value: number) =>
  `₹${Math.round(value).toLocaleString("en-IN")}`;

const formatDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const supabase = createClient() as SupabaseClient<Database>;

export function ProfitLossModule() {
  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10);
  const defaultFrom = new Date(
    today.getFullYear(),
    today.getMonth(),
    1,
  )
    .toISOString()
    .slice(0, 10);

  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const [trips, setTrips] = useState<TripRow[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelRow[]>([]);
  const [sparesBills, setSparesBills] = useState<SparesRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const showAlert = (
    title: string,
    message: string,
    type: AlertType = "info",
  ) => {
    setAlertConfig({
      isOpen: true,
      title,
      message,
      type,
    });
  };

  const fetchData = useCallback(
    async (initialLoad = false) => {
      if (!fromDate || !toDate) return;

      if (fromDate > toDate) {
        showAlert(
          "Invalid Reporting Period",
          "The From Date cannot be later than the To Date.",
          "error",
        );
        return;
      }

      if (initialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      type TripQueryRow = Pick<
        Tables<"trips">,
        | "trip_id"
        | "trip_number"
        | "trip_start_date"
        | "freight_revenue"
        | "driver_bata"
        | "halt_bata"
        | "toll_fastag_expense"
        | "loading_unloading_expense"
        | "enroute_repairs_maintenance"
        | "misc_trip_expense"
        | "shortage_penalty_deduction"
      >;

      type FuelQueryRow = Pick<
        Tables<"diesel_fuel_logs">,
        "fuel_log_id" | "fuel_date" | "litres_filled" | "total_fuel_cost"
      >;

      type SparesQueryRow = Pick<
        Tables<"workshop_spares_bills">,
        "bill_id" | "bill_date" | "total_bill_amount"
      >;

      const [tripsRes, fuelRes, workshopRes] = await Promise.all([
        supabase
          .from("trips")
          .select(
            "trip_id, trip_number, trip_start_date, freight_revenue, driver_bata, halt_bata, toll_fastag_expense, loading_unloading_expense, enroute_repairs_maintenance, misc_trip_expense, shortage_penalty_deduction",
          )
          .gte("trip_start_date", fromDate)
          .lte("trip_start_date", toDate)
          .overrideTypes<TripQueryRow[], { merge: false }>(),

        supabase
          .from("diesel_fuel_logs")
          .select(
            "fuel_log_id, fuel_date, litres_filled, total_fuel_cost",
          )
          .gte("fuel_date", fromDate)
          .lte("fuel_date", toDate)
          .overrideTypes<FuelQueryRow[], { merge: false }>(),

        supabase
          .from("workshop_spares_bills")
          .select("bill_id, bill_date, total_bill_amount")
          .gte("bill_date", fromDate)
          .lte("bill_date", toDate)
          .overrideTypes<SparesQueryRow[], { merge: false }>(),
      ]);

      const firstError =
        tripsRes.error || fuelRes.error || workshopRes.error;

      if (firstError) {
        setTrips([]);
        setFuelLogs([]);
        setSparesBills([]);

        if (initialLoad) {
          setLoading(false);
        } else {
          setIsRefreshing(false);
        }

        showAlert(
          "Unable to Load P&L",
          firstError.message,
          "error",
        );
        return;
      }

      const tripRows: TripRow[] = (tripsRes.data || []).map((row) => ({
        trip_id: Number(row.trip_id),
        trip_number: String(row.trip_number),
        trip_start_date: String(row.trip_start_date),
        freight_revenue: row.freight_revenue,
        driver_bata: row.driver_bata,
        halt_bata: row.halt_bata,
        toll_fastag_expense: row.toll_fastag_expense,
        loading_unloading_expense: row.loading_unloading_expense,
        enroute_repairs_maintenance: row.enroute_repairs_maintenance,
        misc_trip_expense: row.misc_trip_expense,
        shortage_penalty_deduction: row.shortage_penalty_deduction,
      }));

      const fuelRows: FuelRow[] = (fuelRes.data || []).map((row) => ({
        fuel_log_id: Number(row.fuel_log_id),
        fuel_date: String(row.fuel_date),
        litres_filled: Number(row.litres_filled || 0),
        total_fuel_cost: Number(row.total_fuel_cost || 0),
      }));

      const sparesRows: SparesRow[] = (workshopRes.data || []).map((row) => ({
        bill_id: Number(row.bill_id),
        bill_date: row.bill_date,
        total_bill_amount: row.total_bill_amount,
      }));

      setTrips(tripRows);
      setFuelLogs(fuelRows);
      setSparesBills(sparesRows);

      if (initialLoad) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    },
    [fromDate, toDate, supabase],
  );

  useEffect(() => {
    void fetchData(true);
  }, [fetchData]);

  const financials = useMemo(() => {
    const revenue = trips.reduce(
      (sum, trip) => sum + Number(trip.freight_revenue || 0),
      0,
    );

    const shortageDeductions = trips.reduce(
      (sum, trip) =>
        sum + Number(trip.shortage_penalty_deduction || 0),
      0,
    );

    const adjustedRevenue = revenue - shortageDeductions;

    const diesel = fuelLogs.reduce(
      (sum, fuel) => sum + Number(fuel.total_fuel_cost || 0),
      0,
    );

    const driverBata = trips.reduce(
      (sum, trip) => sum + Number(trip.driver_bata || 0),
      0,
    );

    const haltBata = trips.reduce(
      (sum, trip) => sum + Number(trip.halt_bata || 0),
      0,
    );

    const toll = trips.reduce(
      (sum, trip) => sum + Number(trip.toll_fastag_expense || 0),
      0,
    );

    const loadingUnloading = trips.reduce(
      (sum, trip) =>
        sum + Number(trip.loading_unloading_expense || 0),
      0,
    );

    const enrouteMaintenance = trips.reduce(
      (sum, trip) =>
        sum + Number(trip.enroute_repairs_maintenance || 0),
      0,
    );

    const misc = trips.reduce(
      (sum, trip) => sum + Number(trip.misc_trip_expense || 0),
      0,
    );

    const workshopSpares = sparesBills.reduce(
      (sum, bill) => sum + Number(bill.total_bill_amount || 0),
      0,
    );

    const totalOperatingExpenses =
      diesel +
      driverBata +
      haltBata +
      toll +
      loadingUnloading +
      enrouteMaintenance +
      misc +
      workshopSpares;

    const netOperatingResult =
      adjustedRevenue - totalOperatingExpenses;

    const grossMarginPct =
      adjustedRevenue > 0
        ? (netOperatingResult / adjustedRevenue) * 100
        : 0;

    return {
      revenue,
      shortageDeductions,
      adjustedRevenue,
      diesel,
      driverBata,
      haltBata,
      toll,
      loadingUnloading,
      enrouteMaintenance,
      misc,
      workshopSpares,
      totalOperatingExpenses,
      netOperatingResult,
      grossMarginPct,
    };
  }, [fuelLogs, sparesBills, trips]);

  const expenseRows = [
    ["Diesel", financials.diesel],
    ["Driver Bata", financials.driverBata],
    ["Halt Bata", financials.haltBata],
    ["Toll / FASTag", financials.toll],
    ["Loading / Unloading", financials.loadingUnloading],
    ["En-route Maintenance", financials.enrouteMaintenance],
    ["Workshop Spares", financials.workshopSpares],
    ["Miscellaneous", financials.misc],
  ] as const;

  const hasData =
    trips.length > 0 ||
    fuelLogs.length > 0 ||
    sparesBills.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-fg">
            Profit & Loss Statement
          </h2>
          <p className="mt-0.5 text-xs text-fg-secondary">
            Operating performance based on recorded ERP transactions.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-fg-secondary">
              From
            </label>
            <Input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="h-10 w-full sm:w-[150px]"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-fg-secondary">
              To
            </label>
            <Input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="h-10 w-full sm:w-[150px]"
            />
          </div>

          <Button
            type="button"
            variant="glass"
            className="h-10"
            disabled={loading || isRefreshing}
            onClick={() => void fetchData(false)}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="liquid-glass p-10 text-center text-sm text-fg-secondary">
          Computing financial statement...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="liquid-glass p-5">
              <div className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                Freight Revenue
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-success">
                {formatCurrency(financials.revenue)}
              </div>
              <div className="mt-1 text-xs text-fg-secondary">
                {trips.length.toLocaleString("en-IN")} trip
                {trips.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="liquid-glass p-5">
              <div className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                Operating Expenses
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-danger">
                {formatCurrency(financials.totalOperatingExpenses)}
              </div>
              <div className="mt-1 text-xs text-fg-secondary">
                Diesel + trip costs + workshop
              </div>
            </div>

            <div className="liquid-glass p-5">
              <div className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                Net Operating Result
              </div>
              <div
                className={`mt-2 font-mono text-2xl font-semibold ${
                  financials.netOperatingResult >= 0
                    ? "text-info"
                    : "text-warning"
                }`}
              >
                {formatCurrency(financials.netOperatingResult)}
              </div>
              <div className="mt-1 text-xs text-fg-secondary">
                {financials.grossMarginPct.toFixed(1)}% operating margin
              </div>
            </div>
          </div>

          <div className="liquid-glass overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-fg">
                  Statement Breakdown
                </h3>
                <p className="mt-0.5 text-xs text-fg-secondary">
                  {formatDate(fromDate)} — {formatDate(toDate)}
                </p>
              </div>

              <Button
                type="button"
                variant="glass"
                className="h-9"
                onClick={() => setShowBreakdown(true)}
              >
                View Details
              </Button>
            </div>

            <div className="divide-y divide-border">
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-fg-secondary">
                  Freight Revenue
                </span>
                <span className="font-mono text-sm font-medium text-success">
                  {formatCurrency(financials.revenue)}
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-fg-secondary">
                  Shortage Penalty Deduction
                </span>
                <span className="font-mono text-sm font-medium text-warning">
                  -{formatCurrency(financials.shortageDeductions)}
                </span>
              </div>

              <div className="flex items-center justify-between bg-surface/40 px-5 py-3">
                <span className="text-sm font-medium text-fg">
                  Adjusted Revenue
                </span>
                <span className="font-mono text-sm font-semibold text-fg">
                  {formatCurrency(financials.adjustedRevenue)}
                </span>
              </div>

              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-medium text-fg">
                  Total Operating Expenses
                </span>
                <span className="font-mono text-sm font-semibold text-danger">
                  -{formatCurrency(financials.totalOperatingExpenses)}
                </span>
              </div>

              <div className="flex items-center justify-between bg-surface/60 px-5 py-4">
                <span className="text-sm font-semibold text-fg">
                  Net Operating Result
                </span>
                <span
                  className={`font-mono text-base font-bold ${
                    financials.netOperatingResult >= 0
                      ? "text-info"
                      : "text-warning"
                  }`}
                >
                  {formatCurrency(financials.netOperatingResult)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-border p-5 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-surface/40 p-3">
                <div className="text-[11px] uppercase tracking-wider text-fg-secondary">
                  Trips
                </div>
                <div className="mt-1 text-lg font-semibold text-fg">
                  {trips.length}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface/40 p-3">
                <div className="text-[11px] uppercase tracking-wider text-fg-secondary">
                  Diesel Entries
                </div>
                <div className="mt-1 text-lg font-semibold text-fg">
                  {fuelLogs.length}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface/40 p-3">
                <div className="text-[11px] uppercase tracking-wider text-fg-secondary">
                  Workshop Bills
                </div>
                <div className="mt-1 text-lg font-semibold text-fg">
                  {sparesBills.length}
                </div>
              </div>
            </div>
          </div>

          {!hasData && (
            <div className="liquid-glass p-8 text-center">
              <p className="text-sm font-medium text-fg">
                No financial records found
              </p>
              <p className="mt-1 text-xs text-fg-secondary">
                Try a different reporting period.
              </p>
            </div>
          )}
        </>
      )}

      <Dialog open={showBreakdown} onOpenChange={setShowBreakdown}>
        <DialogContent layout="modal" size="md">
          <DialogHeader>
            <DialogTitle>Operating Expense Breakdown</DialogTitle>
          </DialogHeader>

          <DialogBody className="p-0">
            <div className="divide-y divide-border">
              {expenseRows.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between px-1 py-3"
                >
                  <span className="text-sm text-fg-secondary">
                    {label}
                  </span>
                  <span className="font-mono text-sm font-medium text-fg">
                    {formatCurrency(value)}
                  </span>
                </div>
              ))}

              <div className="flex items-center justify-between px-1 py-4">
                <span className="text-sm font-semibold text-fg">
                  Total Operating Expenses
                </span>
                <span className="font-mono text-sm font-bold text-danger">
                  {formatCurrency(financials.totalOperatingExpenses)}
                </span>
              </div>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() =>
          setAlertConfig((current) => ({
            ...current,
            isOpen: false,
          }))
        }
      />
    </div>
  );
}
