"use client";

import { useState, useEffect, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

interface DashboardProps {
  onNavigate?: (tab: string, subTab?: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
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

    // Parallel Telemetry Fetching
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
      supabase.from("trucks").select("*").order("vehicle_number"),
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

    // Calculate Status Breakdown
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

    // Counts
    setTotalTripsCount(allTripsCountRes.count || 0);
    setPendingPodsCount(pendingPodsRes.count || 0);
    setPendingApprovalsCount(pendingQueueRes.count || 0);

    // Financial Telemetry
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

    // Build Live Notifications
    const alerts: any[] = [];

    // License expiry check (next 30 days)
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
    (driversRes.data || []).forEach((d: any) => {
      if (d.license_expiry_date) {
        const exp = new Date(d.license_expiry_date);
        if (exp <= thirtyDaysAhead) {
          alerts.push({
            id: `lic-${d.driver_code}`,
            type: "EXPIRY",
            title: "DRIVER LICENSE EXPIRING",
            desc: `${d.full_name} (${d.driver_code}) license expires on ${d.license_expiry_date}.`,
            severity: "HIGH",
            time: "Immediate Action",
          });
        }
      }
    });

    if (pendingPodsRes.count && pendingPodsRes.count > 0) {
      alerts.push({
        id: "pod-backlog",
        type: "POD",
        title: "UNSETTLED POD CLOSURES",
        desc: `${pendingPodsRes.count} Waybills require physical POD verification & closure.`,
        severity: "MEDIUM",
        time: "Active Queue",
      });
    }

    if (pendingQueueRes.count && pendingQueueRes.count > 0) {
      alerts.push({
        id: "driver-approvals",
        type: "APPROVAL",
        title: "PENDING DRIVER ADVANCES",
        desc: `${pendingQueueRes.count} direct expense submissions awaiting manager sign-off.`,
        severity: "URGENT",
        time: "Real-time",
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
      .from("trucks")
      .update({
        current_status: overrideStatus,
        status_remarks: overrideRemarks || null,
        status_updated_at: new Date().toISOString(),
      })
      .eq("id", selectedTruckId);

    setIsUpdatingStatus(false);
    if (error) {
      alert("Status update failed: " + error.message);
    } else {
      alert("Fleet unit status successfully synced!");
      setOverrideRemarks("");
      fetchDashboardData();
    }
  };

  const currentMonthName = new Date().toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
  const retentionMargin =
    monthlyRevenue > 0
      ? ((netRetention / monthlyRevenue) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-8 animate-fade-in font-sans selection:bg-[#FF5A00] selection:text-white">
      {/* Top Banner: Node Info & Quick Refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0C101A] via-[#0A0D14] to-[#080A10] border border-white/[0.08] p-6 rounded-3xl backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF5A00]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF5A00] to-[#C93B00] flex items-center justify-center shadow-[0_0_24px_rgba(255,90,0,0.35)]">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-lg font-black text-white uppercase tracking-wider">COCHIN HUB COMMAND CENTER</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                {vehicles.length} Units Online
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Active Fleet Telemetry & Real-Time Logistics Operations Hub
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">Current Operating Cycle</span>
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">{currentMonthName}</span>
          </div>
          <button
            onClick={() => fetchDashboardData()}
            className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-black text-white uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
          >
            <svg className="w-3.5 h-3.5 text-[#FF5A00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync Data
          </button>
        </div>
      </div>

      {/* OPERATIONS TELEMETRY CARDS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-3.5 bg-[#FF5A00] rounded-sm inline-block" />
            OPERATIONS TELEMETRY
          </h3>
          <span className="text-[10px] font-black tracking-widest text-[#FF5A00] uppercase bg-[#FF5A00]/10 px-2.5 py-1 rounded-md border border-[#FF5A00]/20">
            {currentMonthName}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Trips */}
          <div className="bg-[#080A10]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 relative overflow-hidden group hover:border-[#FF5A00]/40 transition-all shadow-xl">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Completed Trips</span>
              <span className="p-2 rounded-xl bg-white/[0.03] text-[#FF5A00] border border-white/[0.05]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-white font-mono tracking-tight">{totalTripsCount}</span>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Dispatches Logged This Cycle</p>
            </div>
          </div>

          {/* Card 2: PODs Pending */}
          <div className="bg-[#080A10]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 relative overflow-hidden group hover:border-rose-500/40 transition-all shadow-xl">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">PODs Pending Closure</span>
              <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-rose-400 font-mono tracking-tight">{pendingPodsCount}</span>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Awaiting Physical Sign-Off</p>
            </div>
          </div>

          {/* Card 3: Freight Revenue */}
          <div className="bg-[#080A10]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/40 transition-all shadow-xl">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gross Freight Revenue</span>
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">₹{formatINR(monthlyRevenue)}</span>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Total Billed Tonnage Income</p>
            </div>
          </div>

          {/* Card 4: Net Retention */}
          <div className="bg-[#080A10]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 relative overflow-hidden group hover:border-[#FF5A00]/50 transition-all shadow-xl">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Net Operating Margin</span>
              <span className="px-2 py-1 rounded-md text-[9px] font-black bg-[#FF5A00]/15 text-[#FF5A00] border border-[#FF5A00]/30 font-mono">
                {retentionMargin}% Margin
              </span>
            </div>
            <div className="mt-4">
              <span className="text-2xl sm:text-3xl font-black text-[#FF5A00] font-mono tracking-tight">₹{formatINR(netRetention)}</span>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">OPEX: ₹{formatINR(monthlyExpenses)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* MID-SECTION: FLEET STATUS GRID & LIVE NOTIFICATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: FLEET STATUS GRID */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-3.5 bg-[#FF5A00] rounded-sm inline-block" />
            FLEET STATUS DEPLOYMENT
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#080A10]/90 border border-white/[0.06] rounded-2xl p-5 hover:border-amber-500/40 transition-all">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Plant Loading</span>
              </div>
              <p className="text-3xl font-black text-white font-mono mt-3">{statusDistribution.plantLoading}</p>
              <span className="text-[9px] text-slate-500 font-bold uppercase">At Terminal / Siding</span>
            </div>

            <div className="bg-[#080A10]/90 border border-white/[0.06] rounded-2xl p-5 hover:border-sky-500/40 transition-all">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">In Transit</span>
              </div>
              <p className="text-3xl font-black text-sky-400 font-mono mt-3">{statusDistribution.inTransit}</p>
              <span className="text-[9px] text-slate-500 font-bold uppercase">Highway En-Route</span>
            </div>

            <div className="bg-[#080A10]/90 border border-white/[0.06] rounded-2xl p-5 hover:border-rose-500/40 transition-all">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Workshop Repairs</span>
              </div>
              <p className="text-3xl font-black text-rose-400 font-mono mt-3">{statusDistribution.workshop}</p>
              <span className="text-[9px] text-slate-500 font-bold uppercase">Maintenance Bay</span>
            </div>

            <div className="bg-[#080A10]/90 border border-white/[0.06] rounded-2xl p-5 hover:border-emerald-500/40 transition-all">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Available / Ready</span>
              </div>
              <p className="text-3xl font-black text-emerald-400 font-mono mt-3">{statusDistribution.waitingForLoad}</p>
              <span className="text-[9px] text-slate-500 font-bold uppercase">Ready For Dispatch</span>
            </div>
          </div>

          {/* QUICK STATUS OVERRIDE TOOL */}
          <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 shadow-xl">
            <h4 className="text-xs font-black text-white uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>RAPID FLEET STATUS OVERRIDE</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase">Synchronizes Real-Time GPS Tracking</span>
            </h4>
            <form onSubmit={handleUpdateStatus} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Select Vehicle</label>
                <select
                  value={selectedTruckId}
                  onChange={(e) => setSelectedTruckId(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-white/[0.08] bg-[#030407] text-white font-bold outline-none focus:border-[#FF5A00]"
                  required
                >
                  <option value="">Choose truck...</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} [{v.current_status || "WAITING"}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">New Movement Status</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-white/[0.08] bg-[#030407] text-white font-bold outline-none focus:border-[#FF5A00]"
                >
                  <option value="PLANT_LOADING">Plant Loading</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="WORKSHOP_MAINTENANCE">Workshop / Repairs</option>
                  <option value="WAITING_FOR_LOAD">Waiting For Load</option>
                  <option value="NO_DRIVER">No Driver / Leave</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Movement Remarks</label>
                <input
                  type="text"
                  value={overrideRemarks}
                  onChange={(e) => setOverrideRemarks(e.target.value)}
                  placeholder="e.g. Dispatched to Coimbatore"
                  className="w-full text-xs p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] text-white font-medium outline-none focus:border-[#FF5A00]"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="w-full py-3 bg-gradient-to-r from-[#FF5A00] to-[#E04F00] hover:brightness-110 text-white font-black text-xs rounded-xl uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(255,90,0,0.3)] cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isUpdatingStatus ? "Syncing..." : "Update Status"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right 1 Col: TELEMETRY NOTIFICATIONS & AUDIT RADAR */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-rose-500 rounded-sm inline-block" />
              LIVE TELEMETRY RADAR
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
              {liveAlerts.length} Active
            </span>
          </div>

          <div className="bg-[#080A10]/90 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 shadow-xl space-y-3.5 max-h-[420px] overflow-y-auto">
            {liveAlerts.length === 0 ? (
              <div className="text-center py-12">
                <span className="inline-block p-3 rounded-full bg-emerald-950/30 text-emerald-400 mb-2 border border-emerald-800/30">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <p className="text-xs font-black text-white uppercase">All Systems Operating Clean</p>
                <p className="text-[10px] text-slate-500 mt-1">Zero pending compliance alerts or unapproved transactions.</p>
              </div>
            ) : (
              liveAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.12] transition-all relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          alert.severity === "URGENT"
                            ? "bg-rose-500 animate-ping"
                            : alert.severity === "HIGH"
                            ? "bg-amber-400 animate-pulse"
                            : "bg-sky-400"
                        }`}
                      />
                      <span className="text-[10px] font-black text-white uppercase tracking-wider">{alert.title}</span>
                    </div>
                    <span className="text-[8px] font-mono text-slate-500 uppercase">{alert.time}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-2 leading-relaxed">{alert.desc}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
