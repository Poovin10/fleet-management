"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function TelemetryHUD() {
 const supabase = createClient();

 // Telemetry & Metrics State
 const [totalTripsCount, setTotalTripsCount] = useState(0);
 const [pendingPodsCount, setPendingPodsCount] = useState(0);
 const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
 const [monthlyRevenue, setMonthlyRevenue] = useState(0);
 const [monthlyExpenses, setMonthlyExpenses] = useState(0);
 const [netRetention, setNetRetention] = useState(0);

 // Fleet Units Breakdown State
 const [vehicles, setVehicles] = useState<any[]>([]);
 const [statusDistribution, setStatusDistribution] = useState({
 plantLoading: 0,
 inTransit: 0,
 workshop: 0,
 noDriver: 0,
 waitingForLoad: 0,
 });

 // Fleet Deployment Drill-Down State
 const [selectedFleetStatus, setSelectedFleetStatus] = useState<string | null>(null);

 // Live Alerts & Feed State
 const [liveAlerts, setLiveAlerts] = useState<any[]>([]);

 // Formatters
 const formatINR = (val: number) =>
 (Number(val) || 0).toLocaleString("en-IN", {
 minimumFractionDigits: 2,
 maximumFractionDigits: 2,
 });

 const fetchDashboardData = async () => {
 const today = new Date();
 const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
 .toISOString()
 .split("T")[0];
 const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
 .toISOString()
 .split("T")[0];

 const [
 trucksRes,
 allTripsCountRes,
 pendingPodsRes,
 pendingQueueRes,
 tripsFinRes,
 fuelFinRes,
 sparesFinRes,
 driversRes,
 ] = await Promise.all([
 supabase.from('vehicles').select("*").order("vehicle_number"),
 supabase
 .from("trips")
 .select("*", { count: "exact", head: true })
 .gte("trip_start_date", firstDay)
 .lte("trip_start_date", lastDay),
 supabase
 .from("trips")
 .select("*", { count: "exact", head: true })
 .neq("trip_status", "COMPLETED"),
 supabase
 .from("driver_pending_entries")
 .select("*", { count: "exact", head: true })
 .eq("status", "PENDING"),
 supabase
 .from("trips")
 .select("freight_revenue, driver_bata, halt_bata, enroute_repairs_maintenance")
 .gte("trip_start_date", firstDay)
 .lte("trip_start_date", lastDay),
 supabase
 .from("diesel_fuel_logs")
 .select("total_fuel_cost")
 .gte("fuel_date", firstDay)
 .lte("fuel_date", lastDay),
 supabase
 .from("workshop_spares_bills")
 .select("bill_amount")
 .gte("bill_date", firstDay)
 .lte("bill_date", lastDay),
 supabase
 .from("drivers")
 .select("driver_code, full_name, license_expiry_date")
 .eq("is_active", true),
 ]);

 const trucks = trucksRes.data || [];
 setVehicles(trucks);

 const dist = {
 plantLoading: 0,
 inTransit: 0,
 workshop: 0,
 noDriver: 0,
 waitingForLoad: 0,
 };

 trucks.forEach((t: any) => {
 const s = (t.current_status || "WAITING_FOR_LOAD").toUpperCase();
 if (s.includes("PLANT") || s.includes("LOADING")) dist.plantLoading++;
 else if (s.includes("TRANSIT")) dist.inTransit++;
 else if (s.includes("WORKSHOP") || s.includes("REPAIR")) dist.workshop++;
 else if (s.includes("LEAVE") || s.includes("NO_DRIVER")) dist.noDriver++;
 else dist.waitingForLoad++;
 });
 setStatusDistribution(dist);

 setTotalTripsCount(allTripsCountRes.count || 0);
 setPendingPodsCount(pendingPodsRes.count || 0);
 setPendingApprovalsCount(pendingQueueRes.count || 0);

 let grossRev = 0;
 let otherOpex = 0;
 (tripsFinRes.data || []).forEach((tr: any) => {
 grossRev += Number(tr.freight_revenue) || 0;
 otherOpex +=
 (Number(tr.driver_bata) || 0) +
 (Number(tr.halt_bata) || 0) +
 (Number(tr.enroute_repairs_maintenance) || 0);
 });

 let dieselCost = 0;
 (fuelFinRes.data || []).forEach((f: any) => {
 dieselCost += Number(f.total_fuel_cost) || 0;
 });

 let workshopCost = 0;
 (sparesFinRes.data || []).forEach((w: any) => {
 workshopCost += Number(w.bill_amount) || 0;
 });

 const totalExp = otherOpex + dieselCost + workshopCost;
 setMonthlyRevenue(grossRev);
 setMonthlyExpenses(totalExp);
 setNetRetention(grossRev - totalExp);

 const alerts: any[] = [];
 const thirtyDaysAhead = new Date();
 thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
 
 (driversRes.data || []).forEach((d: any) => {
 if (d.license_expiry_date) {
 const exp = new Date(d.license_expiry_date);
 if (exp <= thirtyDaysAhead) {
 alerts.push({
 id: `lic-${d.driver_code}`,
 type: "EXPIRY",
 title: "License Expiring",
 desc: `${d.full_name} (${d.driver_code}) - ${d.license_expiry_date}`,
 severity: "HIGH",
 });
 }
 }
 });

 if (pendingPodsRes.count && pendingPodsRes.count > 0) {
 alerts.push({
 id: "pod-backlog",
 type: "POD",
 title: "Unsettled PODs",
 desc: `${pendingPodsRes.count} Waybills require closure.`,
 severity: "MEDIUM",
 });
 }

 setLiveAlerts(alerts);
 };

 useEffect(() => {
 fetchDashboardData();
 }, [supabase]);

 const currentMonthName = new Date().toLocaleString("default", { month: "long", year: "numeric" });
 const retentionMargin = monthlyRevenue > 0 ? ((netRetention / monthlyRevenue) * 100).toFixed(1) : "0.0";

 const fleetStatusConfig = [
 { key: "inTransit", label: "In Transit", shortLabel: "Transit", color: "info", match: (s: string) => s.includes("TRANSIT") },
 { key: "plantLoading", label: "Plant Loading", shortLabel: "Loading", color: "warning", match: (s: string) => s.includes("PLANT") || s.includes("LOADING") },
 { key: "waitingForLoad", label: "Ready For Dispatch", shortLabel: "Ready", color: "success", match: (s: string) => !s.includes("TRANSIT") && !s.includes("PLANT") && !s.includes("LOADING") && !s.includes("WORKSHOP") && !s.includes("REPAIR") && !s.includes("LEAVE") && !s.includes("NO_DRIVER") },
 { key: "workshop", label: "Workshop Repairs", shortLabel: "Workshop", color: "danger", match: (s: string) => s.includes("WORKSHOP") || s.includes("REPAIR") },
 { key: "noDriver", label: "Driver Unavailable", shortLabel: "No Driver", color: "warning", match: (s: string) => s.includes("LEAVE") || s.includes("NO_DRIVER") },
 ] as const;

 const selectedFleet = fleetStatusConfig.find(
 (item) => item.key === selectedFleetStatus
 );

 const selectedVehicles = selectedFleet
 ? vehicles.filter((vehicle) => {
 const status = String(vehicle.current_status || "WAITING_FOR_LOAD").toUpperCase();
 return selectedFleet.match(status);
 })
 : [];

 return (
  <div className="kss-page-enter space-y-6 text-fg">

    {/* Command Header */}
    <section className="liquid-glass relative overflow-hidden rounded-2xl border border-glass-border p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-accent-soft blur-3xl" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="kss-status-dot bg-success" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
                  Live Operations
                </span>
              </div>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">
                Cochin Hub Command Center
              </h2>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-[10px] font-semibold text-success">
              <span className="kss-status-dot bg-success" />
              {vehicles.length} Units Online
            </span>
          </div>

          <p className="mt-2 max-w-2xl text-xs leading-5 text-fg-muted sm:text-sm">
            Enterprise fleet telemetry and real-time logistics operations.
          </p>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden border-l border-border-subtle pl-4 sm:block">
            <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-fg-muted">
              Operating Cycle
            </div>
            <div className="mt-1 text-sm font-semibold text-fg">
              {currentMonthName}
            </div>
          </div>

          <Button
            type="button"
            variant="glass"
            onClick={() => fetchDashboardData()}
            className="h-9 rounded-xl px-3.5 text-xs sm:px-4"
          >
            <svg
              className="mr-2 h-3.5 w-3.5 text-fg-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Sync
          </Button>
        </div>
      </div>
    </section>

    {/* KPI Layer */}
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {/* Trips */}
      <div className="kss-surface kss-interactive group rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
              Fleet Activity
            </div>
            <div className="mt-1 text-sm font-medium text-fg-secondary">
              Completed Trips
            </div>
          </div>

          <div className="rounded-xl border border-info/15 bg-info/10 p-2 text-info">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8-9 9-4-4-6 6" />
            </svg>
          </div>
        </div>

        <div className="mt-7">
          <div className="text-3xl font-semibold tracking-tight text-fg">
            {totalTripsCount}
          </div>
          <div className="mt-1 text-[11px] text-fg-muted">
            Dispatches logged this cycle
          </div>
        </div>
      </div>

      {/* POD */}
      <div className="kss-surface kss-interactive group rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
              Closure Queue
            </div>
            <div className="mt-1 text-sm font-medium text-fg-secondary">
              PODs Pending
            </div>
          </div>

          <div className="rounded-xl border border-danger/15 bg-danger/10 p-2 text-danger">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          </div>
        </div>

        <div className="mt-7">
          <div className={`text-3xl font-semibold tracking-tight ${pendingPodsCount > 0 ? "text-danger" : "text-success"}`}>
            {pendingPodsCount}
          </div>
          <div className="mt-1 text-[11px] text-fg-muted">
            {pendingPodsCount > 0 ? "Waybills require closure" : "No closure backlog"}
          </div>
        </div>
      </div>

      {/* Revenue */}
      <div className="kss-surface kss-interactive group rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
              Revenue
            </div>
            <div className="mt-1 text-sm font-medium text-fg-secondary">
              Gross Freight
            </div>
          </div>

          <div className="rounded-xl border border-success/15 bg-success/10 p-2 text-success">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2m8-4a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
            </svg>
          </div>
        </div>

        <div className="mt-7">
          <div className="truncate text-2xl font-semibold tracking-tight text-success sm:text-3xl">
            ₹{formatINR(monthlyRevenue)}
          </div>
          <div className="mt-1 text-[11px] text-fg-muted">
            Total billed tonnage income
          </div>
        </div>
      </div>

      {/* Retention */}
      <div className="kss-surface kss-interactive group rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
              Operating Result
            </div>
            <div className="mt-1 text-sm font-medium text-fg-secondary">
              Net Retention
            </div>
          </div>

          <span className="rounded-full border border-accent/20 bg-accent-soft px-2.5 py-1 text-[10px] font-semibold text-accent">
            {retentionMargin}%
          </span>
        </div>

        <div className="mt-7">
          <div className="truncate text-2xl font-semibold tracking-tight text-accent sm:text-3xl">
            ₹{formatINR(netRetention)}
          </div>
          <div className="mt-1 truncate text-[11px] text-fg-muted">
            OPEX: ₹{formatINR(monthlyExpenses)}
          </div>
        </div>
      </div>
    </section>

    {/* Operations */}
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.8fr)]">

      {/* Fleet Deployment */}
      <div className="min-w-0 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
              Fleet Deployment
            </div>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-fg">
              Current Unit Distribution
            </h3>
            <p className="mt-1 text-xs text-fg-muted">
              Select a fleet state to inspect the actual vehicles currently assigned to it.
            </p>
          </div>

          {selectedFleet && (
            <button
              type="button"
              onClick={() => setSelectedFleetStatus(null)}
              className="self-start rounded-lg px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-glass-hover hover:text-fg sm:self-auto"
            >
              Clear selection
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {fleetStatusConfig.map((item) => {
            const count = statusDistribution[item.key];
            const isSelected = selectedFleetStatus === item.key;

            const statusTone =
              item.color === "info"
                ? {
                    dot: "bg-info",
                    icon: "text-info",
                    iconBg: "bg-info/10",
                    border: "border-info/25",
                    selected: "bg-info/10",
                  }
                : item.color === "success"
                  ? {
                      dot: "bg-success",
                      icon: "text-success",
                      iconBg: "bg-success/10",
                      border: "border-success/25",
                      selected: "bg-success/10",
                    }
                  : item.color === "danger"
                    ? {
                        dot: "bg-danger",
                        icon: "text-danger",
                        iconBg: "bg-danger/10",
                        border: "border-danger/25",
                        selected: "bg-danger/10",
                      }
                    : {
                        dot: "bg-warning",
                        icon: "text-warning",
                        iconBg: "bg-warning/10",
                        border: "border-warning/25",
                        selected: "bg-warning/10",
                      };

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedFleetStatus(isSelected ? null : item.key)}
                aria-pressed={isSelected}
                className={`group rounded-2xl border p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                  isSelected
                    ? `${statusTone.selected} ${statusTone.border} shadow-raised`
                    : "kss-surface border-border-subtle hover:border-border-strong hover:bg-glass-hover"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`h-2 w-2 rounded-full ${statusTone.dot}`} />
                  <span className={`rounded-lg p-1.5 ${statusTone.iconBg} ${statusTone.icon}`}>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                </div>

                <div className="mt-4 text-2xl font-semibold tracking-tight text-fg">
                  {count}
                </div>

                <div className="mt-1 text-[11px] font-medium leading-4 text-fg-secondary">
                  <span className="sm:hidden">{item.shortLabel}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </div>

                <div className="mt-2 text-[10px] text-fg-muted">
                  {isSelected ? "Selected" : "Inspect"}
                </div>
              </button>
            );
          })}
        </div>

        {selectedFleet && (
          <div className="liquid-glass overflow-hidden rounded-2xl border border-glass-border animate-fade-up">
            <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`kss-status-dot ${
                      selectedFleet.color === "info"
                        ? "bg-info"
                        : selectedFleet.color === "success"
                          ? "bg-success"
                          : selectedFleet.color === "danger"
                            ? "bg-danger"
                            : "bg-warning"
                    }`}
                  />
                  <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-fg">
                    {selectedFleet.label}
                  </h4>
                </div>

                <p className="mt-1 text-[11px] text-fg-muted">
                  {selectedVehicles.length}{" "}
                  {selectedVehicles.length === 1 ? "vehicle" : "vehicles"} in this state
                </p>
              </div>

              <div className="rounded-full border border-border-subtle bg-surface/60 px-2.5 py-1 text-[10px] font-medium text-fg-muted">
                Live fleet snapshot
              </div>
            </div>

            {selectedVehicles.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-success/15 bg-success/10 text-success">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m5 12 4 4L19 6" />
                  </svg>
                </div>
                <div className="mt-3 text-sm font-medium text-fg-secondary">
                  No vehicles in this state
                </div>
                <div className="mt-1 text-[11px] text-fg-muted">
                  The fleet snapshot is currently clear.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {selectedVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="px-5 py-4 transition-colors hover:bg-glass-hover"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-sm font-semibold tracking-tight text-fg">
                            {vehicle.vehicle_number || "Unnamed vehicle"}
                          </span>

                          <span className="rounded-md border border-border-subtle bg-surface/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                            {vehicle.vehicle_type || "Fleet Unit"}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-muted">
                          <span>
                            Status:{" "}
                            <span className="text-fg-secondary">
                              {vehicle.current_status || "WAITING_FOR_LOAD"}
                            </span>
                          </span>

                          {vehicle.status_remarks && (
                            <span className="min-w-0">
                              Note:{" "}
                              <span className="text-fg-secondary">
                                {vehicle.status_remarks}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      {vehicle.status_updated_at && (
                        <div className="shrink-0 text-[10px] text-fg-muted sm:text-right">
                          Updated{" "}
                          {new Date(vehicle.status_updated_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Alerts */}
      <div className="min-w-0 space-y-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
            Telemetry Radar
          </div>
          <div className="mt-1 flex items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-fg">
              Active Alerts
            </h3>
            {liveAlerts.length > 0 && (
              <span className="rounded-full border border-danger/20 bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger">
                {liveAlerts.length}
              </span>
            )}
          </div>
        </div>

        <div className="liquid-glass overflow-hidden rounded-2xl border border-glass-border">
          {liveAlerts.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-success/15 bg-success/10 text-success">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m5 12 4 4L19 6" />
                </svg>
              </div>

              <div className="mt-3 text-sm font-medium text-fg-secondary">
                No active alerts
              </div>

              <div className="mt-1 text-[11px] leading-5 text-fg-muted">
                All monitored systems are currently clear.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {liveAlerts.map((alert) => {
                const isHigh =
                  alert.severity === "HIGH" || alert.severity === "URGENT";

                return (
                  <div
                    key={alert.id}
                    className="flex gap-3 px-4 py-4 transition-colors hover:bg-glass-hover sm:px-5"
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        isHigh
                          ? "bg-danger/10 text-danger"
                          : "bg-warning/10 text-warning"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${isHigh ? "bg-danger" : "bg-warning"}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[13px] font-semibold text-fg">
                          {alert.title}
                        </div>

                        <span
                          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                            isHigh
                              ? "border-danger/20 bg-danger/10 text-danger"
                              : "border-warning/20 bg-warning/10 text-warning"
                          }`}
                        >
                          {alert.severity}
                        </span>
                      </div>

                      <div className="mt-1 text-[11px] leading-5 text-fg-muted">
                        {alert.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  </div>
 )

}
