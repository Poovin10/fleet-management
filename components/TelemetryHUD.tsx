"use client";

import { useState, useEffect, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export default function TelemetryHUD() {
 const supabase = createClient();
 const [isPending, startTransition] = useTransition();

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

 // Quick Status Override Modal State
 const [selectedTruckId, setSelectedTruckId] = useState("");
 const [overrideStatus, setOverrideStatus] = useState("WAITING_FOR_LOAD");
 const [overrideRemarks, setOverrideRemarks] = useState("");
 const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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

 const handleUpdateStatus = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedTruckId) return alert("Select a vehicle to update.");
 setIsUpdatingStatus(true);
 const { error } = await supabase
 .from('vehicles')
 .update({
 current_status: overrideStatus,
 status_remarks: overrideRemarks || null,
 status_updated_at: new Date().toISOString(),
 })
 .eq("id", selectedTruckId);

 setIsUpdatingStatus(false);
 if (error) alert("Status update failed: " + error.message);
 else {
 setOverrideRemarks("");
 fetchDashboardData();
 }
 };

 const currentMonthName = new Date().toLocaleString("default", { month: "long", year: "numeric" });
 const retentionMargin = monthlyRevenue > 0 ? ((netRetention / monthlyRevenue) * 100).toFixed(1) : "0.0";

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
 {/* Fleet Status Distribution */}
 <div className="lg:col-span-2 space-y-4">
 <h3 className="text-sm font-medium text-fg tracking-tight">Fleet Status Deployment</h3>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
 <div className="bg-surface border border-border-subtle rounded-xl p-4 flex flex-col items-start hover:border-border-strong transition-colors">
 <span className="w-2 h-2 rounded-full bg-warning mb-2" />
 <div className="text-xl font-semibold text-fg tracking-tight">{statusDistribution.plantLoading}</div>
 <div className="text-[11px] font-medium text-fg-secondary mt-1">Plant Loading</div>
 </div>
 <div className="bg-surface border border-border-subtle rounded-xl p-4 flex flex-col items-start hover:border-border-strong transition-colors">
 <span className="w-2 h-2 rounded-full bg-info mb-2" />
 <div className="text-xl font-semibold text-fg tracking-tight">{statusDistribution.inTransit}</div>
 <div className="text-[11px] font-medium text-fg-secondary mt-1">In Transit</div>
 </div>
 <div className="bg-surface border border-border-subtle rounded-xl p-4 flex flex-col items-start hover:border-border-strong transition-colors">
 <span className="w-2 h-2 rounded-full bg-danger mb-2" />
 <div className="text-xl font-semibold text-fg tracking-tight">{statusDistribution.workshop}</div>
 <div className="text-[11px] font-medium text-fg-secondary mt-1">Workshop Repairs</div>
 </div>
 <div className="bg-surface border border-border-subtle rounded-xl p-4 flex flex-col items-start hover:border-border-strong transition-colors">
 <span className="w-2 h-2 rounded-full bg-success mb-2" />
 <div className="text-xl font-semibold text-fg tracking-tight">{statusDistribution.waitingForLoad}</div>
 <div className="text-[11px] font-medium text-fg-secondary mt-1">Ready For Dispatch</div>
 </div>
 </div>

 {/* Quick Override Tool */}
 <div className="bg-surface border border-border-subtle rounded-xl p-5 mt-4">
 <h4 className="text-sm font-medium text-fg tracking-tight mb-4">Rapid Status Override</h4>
 <form onSubmit={handleUpdateStatus} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
 <div className="sm:col-span-1">
 <label className="block text-[11px] font-medium text-fg-secondary mb-1.5">Vehicle</label>
 <Select
 value={selectedTruckId}
 onChange={(e) => setSelectedTruckId(e.target.value)}
 required
 >
 <option value="">Select...</option>
 {vehicles.map((v) => (
 <option key={v.id} value={v.id}>{v.vehicle_number}</option>
 ))}
 </Select>
 </div>
 <div className="sm:col-span-1">
 <label className="block text-[11px] font-medium text-fg-secondary mb-1.5">Status</label>
 <Select
 value={overrideStatus}
 onChange={(e) => setOverrideStatus(e.target.value)}
 >
 <option value="PLANT_LOADING">Plant Loading</option>
 <option value="IN_TRANSIT">In Transit</option>
 <option value="WORKSHOP_MAINTENANCE">Workshop / Repairs</option>
 <option value="WAITING_FOR_LOAD">Ready For Load</option>
 </Select>
 </div>
 <div className="sm:col-span-1">
 <label className="block text-[11px] font-medium text-fg-secondary mb-1.5">Remarks</label>
 <Input
 type="text"
 value={overrideRemarks}
 onChange={(e) => setOverrideRemarks(e.target.value)}
 placeholder="Optional note"
 className="h-auto rounded-lg px-3 py-2.5"
 />
 </div>
 <div className="sm:col-span-1 flex items-end">
 <Button
 type="submit"
 variant="default"
 disabled={isUpdatingStatus}
 className="w-full h-auto rounded-lg py-2.5 text-sm"
 >
 {isUpdatingStatus ? "Updating..." : "Apply Status"}
 </Button>
 </div>
 </form>
 </div>
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
