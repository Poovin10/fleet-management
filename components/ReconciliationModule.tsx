"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ReconcileView =
  | "trip-outstanding"
  | "advance-outstanding"
  | "pending-entries"
  | null;

type TripRecord = {
  trip_id: number;
  driver_bata: number | null;
  halt_bata: number | null;
  cash_advance_issued: number | null;
  settlement_status: string | null;
  primary_driver_id: number | null;
  trip_start_date: string | null;
  trip_number: string | null;
};

type DirectAdvance = {
  advance_id: number;
  driver_id: number;
  advance_date: string;
  amount_inr: number;
  advance_type: string | null;
  payment_mode: string | null;
  reference_remarks: string | null;
  is_settled: boolean | null;
  settled_at: string | null;
};

type PendingEntry = {
  entry_id: number;
  entry_type: string;
  amount_inr: number;
  litres: number | null;
  odometer_km: number | null;
  driver_code: string | null;
  vehicle_id: number | null;
  status: string | null;
  rejection_reason: string | null;
  receipt_remarks: string | null;
  submitted_at: string | null;
};

type Driver = {
  driver_id: number;
  driver_name: string;
  driver_code: string | null;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const dateDisplay = (value: string | null) => {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

export function ReconciliationModule() {
  const supabase = createClient();

  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [advances, setAdvances] = useState<DirectAdvance[]>([]);
  const [pendingEntries, setPendingEntries] = useState<PendingEntry[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const [showReconciliationWorkspace, setShowReconciliationWorkspace] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeView, setActiveView] = useState<ReconcileView>(null);

  const loadReconciliation = useCallback(async () => {
    setLoading(true);

    try {
      const [
        { data: tripData, error: tripError },
        { data: advanceData, error: advanceError },
        { data: pendingData, error: pendingError },
        { data: driverData, error: driverError },
      ] = await Promise.all([
        supabase
          .from("trips")
          .select(
            "trip_id, driver_bata, halt_bata, cash_advance_issued, settlement_status, primary_driver_id, trip_start_date, trip_number"
          )
          .or("settlement_status.is.null,settlement_status.neq.SETTLED")
          .order("trip_start_date", { ascending: false }),

        supabase
          .from("driver_direct_advances")
          .select(
            "advance_id, driver_id, advance_date, amount_inr, advance_type, payment_mode, reference_remarks, is_settled, settled_at"
          )
          .or("is_settled.is.null,is_settled.eq.false")
          .order("advance_date", { ascending: false }),

        supabase
          .from("driver_pending_entries")
          .select(
            "entry_id, entry_type, amount_inr, litres, odometer_km, driver_code, vehicle_id, status, rejection_reason, receipt_remarks, submitted_at"
          )
          .order("submitted_at", { ascending: false }),

        supabase
          .from("drivers")
          .select("driver_id, driver_name, driver_code")
          .order("driver_name", { ascending: true }),
      ]);

      if (tripError) throw new Error(`Trips: ${tripError.message}`);
      if (advanceError) throw new Error(`Advances: ${advanceError.message}`);
      if (pendingError) throw new Error(`Pending entries: ${pendingError.message}`);
      if (driverError) throw new Error(`Drivers: ${driverError.message}`);

      setTrips((tripData ?? []) as TripRecord[]);
      setAdvances((advanceData ?? []) as DirectAdvance[]);
      setPendingEntries((pendingData ?? []) as PendingEntry[]);
      setDrivers((driverData ?? []) as Driver[]);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Reconciliation load failed:", error);
      setTrips([]);
      setAdvances([]);
      setPendingEntries([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadReconciliation();
  }, [loadReconciliation]);

  const driverName = (driverId: number | null) => {
    if (!driverId) return "Unassigned";
    const driver = drivers.find((item) => item.driver_id === driverId);
    return driver?.driver_name || `Driver #${driverId}`;
  };

  const outstandingTripValue = useMemo(
    () =>
      trips.reduce(
        (total, trip) =>
          total +
          (Number(trip.driver_bata) || 0) +
          (Number(trip.halt_bata) || 0) +
          (Number(trip.cash_advance_issued) || 0),
        0
      ),
    [trips]
  );

  const outstandingAdvanceValue = useMemo(
    () =>
      advances.reduce(
        (total, advance) => total + (Number(advance.amount_inr) || 0),
        0
      ),
    [advances]
  );

  const pendingEntryValue = useMemo(
    () =>
      pendingEntries.reduce(
        (total, entry) => total + (Number(entry.amount_inr) || 0),
        0
      ),
    [pendingEntries]
  );

  const unresolvedCount =
    trips.length + advances.length + pendingEntries.length;

  const getViewTitle = () => {
    switch (activeView) {
      case "trip-outstanding":
        return "Outstanding Trip Settlements";
      case "advance-outstanding":
        return "Outstanding Direct Advances";
      case "pending-entries":
        return "Driver Pending Entries";
      default:
        return "";
    }
  };

  return (
    <>
      {!showReconciliationWorkspace ? (
        <div className="liquid-glass w-full rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="kss-eyebrow text-accent">Accounts · Financial Control</p>
              <h2 className="mt-1 text-xl font-semibold text-fg">
                Reconciliation
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-secondary">
                Review unresolved trips, advances, and pending driver entries
                through the financial control center.
              </p>
            </div>

            <Button
              type="button"
              size="lg"
              className="min-h-11 shrink-0 sm:min-w-48"
              onClick={() => setShowReconciliationWorkspace(true)}
            >
              Open Reconciliation
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-6">
        <div className="liquid-glass overflow-hidden p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                Financial Control Center
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
                Reconciliation
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-secondary">
                Review unresolved financial records without changing the
                underlying accounting or settlement workflow.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => void loadReconciliation()}
              disabled={loading}
              className="rounded-xl"
            >
              {loading ? "Refreshing..." : "Refresh Control Center"}
            </Button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="kss-surface-raised border border-border p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                Unresolved Records
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold text-fg">
                {unresolvedCount}
              </p>
            </div>

            <div className="kss-surface-raised border border-border p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                Trip Records
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold text-fg">
                {trips.length}
              </p>
              <p className="mt-1 text-xs text-fg-muted">
                ₹{money(outstandingTripValue)}
              </p>
            </div>

            <div className="kss-surface-raised border border-border p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                Direct Advances
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold text-fg">
                {advances.length}
              </p>
              <p className="mt-1 text-xs text-fg-muted">
                ₹{money(outstandingAdvanceValue)}
              </p>
            </div>

            <div className="kss-surface-raised border border-border p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                Pending Entries
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold text-fg">
                {pendingEntries.length}
              </p>
              <p className="mt-1 text-xs text-fg-muted">
                ₹{money(pendingEntryValue)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveView("trip-outstanding")}
            className="group rounded-2xl border border-border bg-surface/40 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-surface-raised"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Settlement Control
            </span>
            <h3 className="mt-2 text-base font-semibold text-fg">
              Trip Settlement
            </h3>
            <p className="mt-2 text-xs leading-5 text-fg-muted">
              Trips that are not currently marked SETTLED.
            </p>
            <div className="mt-5 flex items-end justify-between">
              <span className="font-mono text-2xl font-semibold text-fg">
                {trips.length}
              </span>
              <span className="text-xs font-semibold text-accent">
                Open details →
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("advance-outstanding")}
            className="group rounded-2xl border border-border bg-surface/40 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-surface-raised"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Advance Control
            </span>
            <h3 className="mt-2 text-base font-semibold text-fg">
              Direct Advances
            </h3>
            <p className="mt-2 text-xs leading-5 text-fg-muted">
              Direct driver advances that are not currently settled.
            </p>
            <div className="mt-5 flex items-end justify-between">
              <span className="font-mono text-2xl font-semibold text-fg">
                {advances.length}
              </span>
              <span className="text-xs font-semibold text-accent">
                Open details →
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("pending-entries")}
            className="group rounded-2xl border border-border bg-surface/40 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-surface-raised"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Exception Control
            </span>
            <h3 className="mt-2 text-base font-semibold text-fg">
              Driver Pending Entries
            </h3>
            <p className="mt-2 text-xs leading-5 text-fg-muted">
              Review driver-submitted financial, fuel, and odometer entries.
            </p>
            <div className="mt-5 flex items-end justify-between">
              <span className="font-mono text-2xl font-semibold text-fg">
                {pendingEntries.length}
              </span>
              <span className="text-xs font-semibold text-accent">
                Open details →
              </span>
            </div>
          </button>
        </div>

        <div className="liquid-glass border border-border p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-fg">
                Reconciliation status
              </p>
              <p className="mt-1 text-xs leading-5 text-fg-muted">
                This workspace is intentionally read-only. Settlement remains
                controlled by the existing settlement workflow.
              </p>
            </div>

            <p className="text-[10px] font-medium text-fg-muted">
              {lastRefresh
                ? `Last refresh ${lastRefresh.toLocaleTimeString()}`
                : "Loading control data..."}
            </p>
          </div>
        </div>
      </div>

      <Dialog
        open={activeView !== null}
        onOpenChange={(open) => {
          if (!open) setActiveView(null);
        }}
      >
        <DialogContent layout="modal" size="full">
          <DialogHeader>
            <DialogTitle>{getViewTitle()}</DialogTitle>
            <p className="mt-1 text-sm leading-5 text-fg-secondary">
              Review records from the existing accounting sources. No financial
              records are changed from this workspace.
            </p>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {activeView === "trip-outstanding" && (
              <>
                {trips.length === 0 ? (
                  <div className="kss-surface-raised p-8 text-center">
                    <p className="text-sm font-semibold text-fg">
                      No outstanding trip settlements
                    </p>
                    <p className="mt-1 text-xs text-fg-muted">
                      All currently loaded trips are marked SETTLED.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-border">
                    <table className="w-full min-w-[850px] text-left text-xs">
                      <thead className="border-b border-border bg-surface-raised">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Trip
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Date
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Driver
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Bata
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Trip Advance
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {trips.map((trip) => (
                          <tr
                            key={trip.trip_id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-4 py-3 font-medium text-fg">
                              {trip.trip_number || `Trip #${trip.trip_id}`}
                            </td>
                            <td className="px-4 py-3 text-fg-secondary">
                              {dateDisplay(trip.trip_start_date)}
                            </td>
                            <td className="px-4 py-3 text-fg-secondary">
                              {driverName(trip.primary_driver_id)}
                            </td>
                            <td className="px-4 py-3 font-mono text-fg">
                              ₹
                              {money(
                                (Number(trip.driver_bata) || 0) +
                                  (Number(trip.halt_bata) || 0)
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-fg">
                              ₹{money(Number(trip.cash_advance_issued) || 0)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-fg-secondary">
                                {trip.settlement_status || "UNSET"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {activeView === "advance-outstanding" && (
              <>
                {advances.length === 0 ? (
                  <div className="kss-surface-raised p-8 text-center">
                    <p className="text-sm font-semibold text-fg">
                      No outstanding direct advances
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-border">
                    <table className="w-full min-w-[900px] text-left text-xs">
                      <thead className="border-b border-border bg-surface-raised">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Advance
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Date
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Driver
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Type
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Amount
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Remarks
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {advances.map((advance) => (
                          <tr
                            key={advance.advance_id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-4 py-3 font-medium text-fg">
                              #{advance.advance_id}
                            </td>
                            <td className="px-4 py-3 text-fg-secondary">
                              {dateDisplay(advance.advance_date)}
                            </td>
                            <td className="px-4 py-3 text-fg-secondary">
                              {driverName(advance.driver_id)}
                            </td>
                            <td className="px-4 py-3 text-fg-secondary">
                              {advance.advance_type || "-"}
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-fg">
                              ₹{money(Number(advance.amount_inr) || 0)}
                            </td>
                            <td className="max-w-[280px] truncate px-4 py-3 text-fg-muted">
                              {advance.reference_remarks || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {activeView === "pending-entries" && (
              <>
                {pendingEntries.length === 0 ? (
                  <div className="kss-surface-raised p-8 text-center">
                    <p className="text-sm font-semibold text-fg">
                      No driver pending entries
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-border">
                    <table className="w-full min-w-[1000px] text-left text-xs">
                      <thead className="border-b border-border bg-surface-raised">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Entry
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Type
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Driver
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Vehicle
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Amount
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Litres
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Odometer
                          </th>
                          <th className="px-4 py-3 font-semibold text-fg-muted">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingEntries.map((entry) => (
                          <tr
                            key={entry.entry_id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-4 py-3 font-medium text-fg">
                              #{entry.entry_id}
                            </td>
                            <td className="px-4 py-3 text-fg-secondary">
                              {entry.entry_type}
                            </td>
                            <td className="px-4 py-3 text-fg-secondary">
                              {entry.driver_code || "-"}
                            </td>
                            <td className="px-4 py-3 text-fg-secondary">
                              {entry.vehicle_id
                                ? `Vehicle #${entry.vehicle_id}`
                                : "-"}
                            </td>
                            <td className="px-4 py-3 font-mono text-fg">
                              ₹{money(Number(entry.amount_inr) || 0)}
                            </td>
                            <td className="px-4 py-3 font-mono text-fg">
                              {entry.litres ?? "-"}
                            </td>
                            <td className="px-4 py-3 font-mono text-fg">
                              {entry.odometer_km ?? "-"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-fg-secondary">
                                {entry.status || "UNSET"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </DialogBody>
        </DialogContent>
        </Dialog>
        </>
      )}
    </>
  );
}
