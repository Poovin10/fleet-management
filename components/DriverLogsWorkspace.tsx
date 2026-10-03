"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DriverLog = {
  entry_id: number;
  driver_code: string | null;
  vehicle_id: number | null;
  entry_type: string;
  amount_inr: number;
  litres: number | null;
  odometer_km: number | null;
  receipt_remarks: string | null;
  rejection_reason: string | null;
  status: string | null;
  submitted_at: string | null;
  driver_name?: string;
  vehicle_number?: string;
};

export function DriverLogsWorkspace() {
  const supabase = createClient();

  const [logs, setLogs] = useState<DriverLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const fetchLogs = async () => {
    setIsLoading(true);
    setErrorMessage("");

    const { data: logData, error: logError } = await supabase
      .from("driver_pending_entries")
      .select(
        "entry_id, driver_code, vehicle_id, entry_type, amount_inr, litres, odometer_km, receipt_remarks, rejection_reason, status, submitted_at"
      )
      .order("submitted_at", { ascending: false })
      .limit(200);

    if (logError) {
      console.error("Driver Logs fetch failed:", logError);
      setErrorMessage(logError.message);
      setLogs([]);
      setIsLoading(false);
      return;
    }

    const rows = (logData || []) as DriverLog[];

    const driverCodes = Array.from(
      new Set(rows.map((row) => row.driver_code).filter(Boolean))
    ) as string[];

    const vehicleIds = Array.from(
      new Set(
        rows
          .map((row) => row.vehicle_id)
          .filter((id): id is number => typeof id === "number")
      )
    );

    const [{ data: driverData }, { data: vehicleData }] = await Promise.all([
      driverCodes.length
        ? supabase
            .from("drivers")
            .select("driver_code, full_name")
            .in("driver_code", driverCodes)
        : Promise.resolve({ data: [] as { driver_code: string; full_name: string }[] }),
      vehicleIds.length
        ? supabase
            .from("vehicles")
            .select("vehicle_id, vehicle_number")
            .in("vehicle_id", vehicleIds)
        : Promise.resolve({ data: [] as { vehicle_id: number; vehicle_number: string }[] }),
    ]);

    const driverMap = new Map(
      (driverData || []).map((driver) => [driver.driver_code, driver.full_name])
    );

    const vehicleMap = new Map(
      (vehicleData || []).map((vehicle) => [
        vehicle.vehicle_id,
        vehicle.vehicle_number,
      ])
    );

    setLogs(
      rows.map((row) => ({
        ...row,
        driver_name: row.driver_code
          ? driverMap.get(row.driver_code) || "Unknown driver"
          : "Unknown driver",
        vehicle_number:
          row.vehicle_id != null
            ? vehicleMap.get(row.vehicle_id) || `Vehicle ${row.vehicle_id}`
            : "—",
      }))
    );

    setIsLoading(false);
  };

  useEffect(() => {
    void fetchLogs();
  }, []);

  const counts = useMemo(() => {
    return {
      total: logs.length,
      pending: logs.filter((row) => row.status === "PENDING").length,
      approved: logs.filter((row) => row.status === "APPROVED").length,
      rejected: logs.filter((row) => row.status === "REJECTED").length,
    };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return logs;

    return logs.filter((row) =>
      [
        row.driver_code,
        row.driver_name,
        row.vehicle_number,
        row.entry_type,
        row.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [logs, search]);

  const formatDate = (value: string | null) => {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAmount = (value: number | null | undefined) =>
    Number(value || 0).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    });

  const statusClass = (status: string | null) => {
    switch (status) {
      case "APPROVED":
        return "text-success bg-success/10 border-success/20";
      case "REJECTED":
        return "text-danger bg-danger/10 border-danger/20";
      case "PENDING":
        return "text-warning bg-warning/10 border-warning/20";
      default:
        return "text-fg-muted bg-surface-raised border-border";
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Total", counts.total, "text-fg"],
          ["Pending", counts.pending, "text-warning"],
          ["Approved", counts.approved, "text-success"],
          ["Rejected", counts.rejected, "text-danger"],
        ].map(([label, value, color]) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-surface/50 p-4"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
              {label}
            </p>
            <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-fg">Recent driver activity</p>
          <p className="mt-1 text-xs text-fg-muted">
            Read-only activity from the existing driver submission ledger.
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search driver, truck or activity"
            className="w-full md:w-72"
          />
          <Button
            type="button"
            variant="glass"
            onClick={() => void fetchLogs()}
            disabled={isLoading}
            className="shrink-0"
          >
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">
          Unable to load driver activity: {errorMessage}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface/30">
        <div className="max-h-[52dvh] overflow-auto">
          <table className="min-w-[980px] w-full text-xs">
            <thead className="sticky top-0 z-10 border-b border-border bg-surface-raised/95 backdrop-blur">
              <tr className="text-[10px] uppercase tracking-wider text-fg-muted">
                <th className="px-4 py-3 text-left">Submitted</th>
                <th className="px-4 py-3 text-left">Driver</th>
                <th className="px-4 py-3 text-left">Truck</th>
                <th className="px-4 py-3 text-left">Activity</th>
                <th className="px-4 py-3 text-right">Odometer</th>
                <th className="px-4 py-3 text-right">Litres</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {filteredLogs.map((row) => (
                <tr
                  key={row.entry_id}
                  className="transition-colors hover:bg-surface-raised/40"
                >
                  <td className="px-4 py-3 text-left text-fg-secondary">
                    {formatDate(row.submitted_at)}
                  </td>

                  <td className="px-4 py-3 text-left">
                    <div className="font-semibold text-fg">
                      {row.driver_name}
                    </div>
                    <div className="mt-0.5 text-[10px] text-fg-muted">
                      {row.driver_code || "—"}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-left font-semibold text-fg">
                    {row.vehicle_number}
                  </td>

                  <td className="px-4 py-3 text-left">
                    <span className="font-semibold text-fg">
                      {row.entry_type}
                    </span>
                    {row.receipt_remarks && (
                      <span className="mt-0.5 block max-w-[220px] truncate text-[10px] text-fg-muted">
                        {row.receipt_remarks}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-fg-secondary">
                    {row.odometer_km != null
                      ? `${formatAmount(row.odometer_km)} KM`
                      : "—"}
                  </td>

                  <td className="px-4 py-3 text-right text-fg-secondary">
                    {row.litres != null ? `${formatAmount(row.litres)} L` : "—"}
                  </td>

                  <td className="px-4 py-3 text-right font-semibold text-fg">
                    ₹{formatAmount(row.amount_inr)}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider ${statusClass(
                        row.status
                      )}`}
                    >
                      {row.status || "UNKNOWN"}
                    </span>
                  </td>
                </tr>
              ))}

              {!isLoading && filteredLogs.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-xs text-fg-muted"
                  >
                    {search
                      ? "No driver activity matches your search."
                      : "No driver activity has been submitted yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-fg-muted">
        Showing up to the latest 200 driver activity entries.
      </p>
    </div>
  );
}
