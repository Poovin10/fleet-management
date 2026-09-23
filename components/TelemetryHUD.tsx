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
 <div className="animate-tab-focus space-y-6 text-fg">
 
 {/* Enterprise Header */}
 <div className="flex flex-col sm:flex-row sm:items-end justify-between pb-4 border-b border-border gap-4">
 <div>
 <h2 className="text-xl font-semibold text-fg tracking-tight flex items-center gap-3">
 Cochin Hub Command Center
 <span className="px-2 py-0.5 rounded-md bg-success/10 text-success text-[10px] font-medium tracking-wide border border-success/20">
 {vehicles.length} Units Online
 </span>
 </h2>
 <p className="text-sm text-fg-muted mt-1">Enterprise Fleet Telemetry & Real-Time Logistics Operations</p>
 </div>
 <div className="flex items-center gap-4">
 <div className="text-right hidden sm:block">
 <div className="text-[10px] font-medium text-fg-muted  tracking-normal">Operating Cycle</div>
 <div className="text-sm font-semibold text-fg tracking-wide">{currentMonthName}</div>
 </div>
 <Button
 type="button"
 variant="glass"
 onClick={() => fetchDashboardData()}
 className="h-auto rounded-lg px-4 py-2 text-xs"
 >
 <svg className="w-3.5 h-3.5 text-fg-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
 </svg>
 Sync
 </Button>
 </div>
 </div>

 {/* KPI Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 {/* Total Trips */}
 <div className="bg-surface border border-border-subtle rounded-xl p-5 flex flex-col justify-between h-32 hover:border-border-strong transition-colors">
 <div className="flex justify-between items-start">
 <span className="text-xs font-medium text-fg-secondary">Total Completed Trips</span>
 </div>
 <div>
 <div className="text-2xl font-semibold text-fg tracking-tight">{totalTripsCount}</div>
 <div className="text-[11px] text-fg-muted mt-0.5">Dispatches logged this cycle</div>
 </div>
 </div>

 {/* PODs Pending */}
 <div className="bg-surface border border-border-subtle rounded-xl p-5 flex flex-col justify-between h-32 hover:border-border-strong transition-colors">
 <div className="flex justify-between items-start">
 <span className="text-xs font-medium text-fg-secondary">PODs Pending Closure</span>
 </div>
 <div>
 <div className="text-2xl font-semibold text-danger tracking-tight">{pendingPodsCount}</div>
 <div className="text-[11px] text-fg-muted mt-0.5">Awaiting physical sign-off</div>
 </div>
 </div>

 {/* Freight Revenue */}
 <div className="bg-surface border border-border-subtle rounded-xl p-5 flex flex-col justify-between h-32 hover:border-border-strong transition-colors">
 <div className="flex justify-between items-start">
 <span className="text-xs font-medium text-fg-secondary">Gross Freight Revenue</span>
 </div>
 <div>
 <div className="text-2xl font-semibold text-success tracking-tight">{formatINR(monthlyRevenue)}</div>
 <div className="text-[11px] text-fg-muted mt-0.5">Total billed tonnage income</div>
 </div>
 </div>

 {/* Net Retention */}
 <div className="bg-surface border border-border-subtle rounded-xl p-5 flex flex-col justify-between h-32 hover:border-border-strong transition-colors">
 <div className="flex justify-between items-start">
 <span className="text-xs font-medium text-fg-secondary">Net Operating Margin</span>
 <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent border border-accent/20">
 {retentionMargin}%
 </span>
 </div>
 <div>
 <div className="text-2xl font-semibold text-accent tracking-tight">{formatINR(netRetention)}</div>
 <div className="text-[11px] text-fg-muted mt-0.5">OPEX: {formatINR(monthlyExpenses)}</div>
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
 {/* Fleet Status Deployment */}
 <div className="lg:col-span-2 space-y-4">
 <div className="flex items-end justify-between gap-4">
 <div>
 <h3 className="text-sm font-medium text-fg tracking-tight">Fleet Deployment</h3>
 <p className="text-[11px] text-fg-muted mt-1">Select a fleet state to inspect its vehicles.</p>
 </div>
 {selectedFleet && (
 <button
 type="button"
 onClick={() => setSelectedFleetStatus(null)}
 className="text-[11px] font-medium text-fg-muted hover:text-fg transition-colors"
 >
 Clear
 </button>
 )}
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
 {fleetStatusConfig.map((item) => {
 const count = statusDistribution[item.key];
 const isSelected = selectedFleetStatus === item.key;

 return (
 <button
 key={item.key}
 type="button"
 onClick={() => setSelectedFleetStatus(isSelected ? null : item.key)}
 aria-pressed={isSelected}
 className={`group text-left rounded-xl border p-4 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
 isSelected
 ? "bg-surface-raised border-accent/40 shadow-orange"
 : "bg-surface border-border-subtle hover:border-border-strong hover:bg-surface-raised"
 }`}
 >
 <div className="flex items-center justify-between gap-2">
 <span className={`kss-status-dot bg-${item.color}`} />
 <span className="text-[10px] text-fg-muted group-hover:text-fg-secondary transition-colors">View</span>
 </div>
 <div className="text-xl font-semibold text-fg tracking-tight mt-3">{count}</div>
 <div className="text-[11px] font-medium text-fg-secondary mt-1">{item.label}</div>
 </button>
 );
 })}
 </div>

 {selectedFleet && (
 <div className="liquid-glass rounded-2xl border border-glass-border overflow-hidden animate-fade-up">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-border-subtle">
 <div>
 <div className="flex items-center gap-2">
 <span className={`kss-status-dot bg-${selectedFleet.color}`} />
 <h4 className="text-sm font-semibold text-fg uppercase tracking-wide">
 {selectedFleet.label}
 </h4>
 </div>
 <p className="text-[11px] text-fg-muted mt-1">
 {selectedVehicles.length} {selectedVehicles.length === 1 ? "vehicle" : "vehicles"} in this state
 </p>
 </div>
 <div className="text-[11px] font-medium text-fg-muted">
 Live fleet snapshot
 </div>
 </div>

 {selectedVehicles.length === 0 ? (
 <div className="px-5 py-10 text-center">
 <div className="text-sm font-medium text-fg-secondary">No vehicles in this state</div>
 <div className="text-[11px] text-fg-muted mt-1">The fleet snapshot is currently clear.</div>
 </div>
 ) : (
 <div className="divide-y divide-border-subtle">
 {selectedVehicles.map((vehicle) => (
 <div
 key={vehicle.id}
 className="px-5 py-4 hover:bg-glass-hover transition-colors"
 >
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div className="min-w-0">
 <div className="flex items-center gap-3">
 <span className="text-sm font-semibold text-fg tracking-tight">
 {vehicle.vehicle_number || "Unnamed vehicle"}
 </span>
 <span className="text-[10px] font-medium text-fg-muted uppercase tracking-wide">
 {vehicle.vehicle_type || "Fleet Unit"}
 </span>
 </div>
 <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-fg-muted">
 <span>Status: <span className="text-fg-secondary">{vehicle.current_status || "WAITING_FOR_LOAD"}</span></span>
 {vehicle.status_remarks && (
 <span>Note: <span className="text-fg-secondary">{vehicle.status_remarks}</span></span>
 )}
 </div>
 </div>

 {vehicle.status_updated_at && (
 <div className="shrink-0 text-[10px] text-fg-muted">
 Updated {new Date(vehicle.status_updated_at).toLocaleString("en-IN", {
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

 {/* Telemetry Radar */}
 <div className="space-y-4">
 <h3 className="text-sm font-medium text-fg tracking-tight">Active Alerts</h3>
 <div className="bg-surface border border-border-subtle rounded-xl p-1 max-h-[340px] overflow-y-auto">
 {liveAlerts.length === 0 ? (
 <div className="p-6 text-center">
 <div className="text-[13px] font-medium text-fg-secondary">No active alerts</div>
 <div className="text-[11px] text-fg-muted mt-1">All systems operating normally</div>
 </div>
 ) : (
 <div className="flex flex-col gap-1 p-1">
 {liveAlerts.map((alert) => (
 <div key={alert.id} className="p-3 rounded-lg hover:bg-surface-raised/50 transition-colors flex items-start gap-3">
 <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${alert.severity === "HIGH" || alert.severity === "URGENT" ? "bg-danger" : "bg-warning"}`} />
 <div>
 <div className="text-[13px] font-medium text-fg">{alert.title}</div>
 <div className="text-[11px] text-fg-muted mt-0.5">{alert.desc}</div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
