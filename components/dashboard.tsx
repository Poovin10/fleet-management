"use client";
import TelemetryHUD from "./TelemetryHUD";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { TripForm } from "@/components/TripForm";
import { PodClosure } from "@/components/PodClosure";
import { ModifyTrips } from "@/components/ModifyTrips";
import { AccountsModule } from "@/components/AccountsModule";
import { FuelAdvanceModule } from "@/components/FuelAdvanceModule";
import { FinancialsModule } from "@/components/FinancialsModule";
import { ProfitLossModule } from "@/components/ProfitLossModule";
import { WorkshopModule } from "@/components/WorkshopModule";
import { SetupModule } from "@/components/SetupModule";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ApprovalQueue } from "@/components/ApprovalQueue";
import { DriverPortal } from "@/components/DriverPortal";
import { LiveAlertsWidget } from "@/components/LiveAlertsWidget";
import { AiInsightsDashboard } from "@/components/AiInsightsDashboard";
import { DriverSettlementModule } from "@/components/DriverSettlementModule";

const KssLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="200" height="200" fill="#FF5A00" />
    <rect x="15" y="15" width="170" height="170" fill="#030407" />
    <path d="M 50 35 L 50 165" stroke="#FF5A00" strokeWidth="24" strokeLinecap="square" />
    <path d="M 50 110 L 140 35" stroke="#FF5A00" strokeWidth="24" strokeLinecap="square" />
    <path d="M 85 85 C 130 95, 145 130, 145 165" stroke="#FF5A00" strokeWidth="24" fill="none" />
  </svg>
);

export default function Dashboard() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<any>(null);

  useEffect(() => { try { setSupabase(createClient()); } catch (err) { console.error(err); } }, []);

  const [isDriverRoute, setIsDriverRoute] = useState(false);
  const [isCheckingRoute, setIsCheckingRoute] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string>("VIEWER");
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState("Dashboard");
  const [opSubTab, setOpSubTab] = useState("Trips");

  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [currentMonthText, setCurrentMonthText] = useState("");
  const [liveVehicles, setLiveVehicles] = useState<any[]>([]);
  const [monthTripsCount, setMonthTripsCount] = useState<number>(0);
  const [monthFreight, setMonthFreight] = useState<number>(0);
  const [monthDieselCost, setMonthDieselCost] = useState<number>(0);
  const [monthNetRetention, setMonthNetRetention] = useState<number>(0);
  const [activeTripCount, setActiveTripCount] = useState<number>(0);
  const [pendingDriverCount, setPendingDriverCount] = useState<number>(0);
  const [statusCounts, setStatusCounts] = useState({ "Plant Loading": 0, "In Transit": 0, "Workshop / Repairs": 0, "No Driver / Leave": 0 });

  const [qsTruckId, setQsTruckId] = useState("");
  const [qsStatus, setQsStatus] = useState("WAITING_FOR_LOAD");
  const [qsRemarks, setQsRemarks] = useState("");

  const opTabs = ["Trips", "POD Closure", "Modify Trips", "Quick Status", "Driver Approvals"];
  const formatAmt = (amt: number) => (Number(amt) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  useEffect(() => {
    if (typeof window !== "undefined") { if (window.location.pathname.startsWith('/driver')) setIsDriverRoute(true); }
    setIsCheckingRoute(false);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const checkAuth = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (user && !error) {
        setIsAuthenticated(true);
        const sessionUsername = user.email?.split('@')[0];
        if (sessionUsername) {
          const { data: userData } = await supabase.from('app_users').select('role').eq('username', sessionUsername).maybeSingle();
          if (userData && userData.role) { setUserRole(userData.role.toUpperCase()); } else { setUserRole("ADMIN"); }
        }
        setIsAuthLoading(false);
      } else {
        setIsAuthenticated(false); setUserRole("VIEWER");
        if (!isDriverRoute) { router.replace("/auth/login"); }
      }
    };
    if (!isDriverRoute) { checkAuth(); } else { setIsAuthLoading(false); }
  }, [supabase, router, isDriverRoute]);

  const executeLogout = async () => {
    if (!supabase) return; await supabase.auth.signOut(); setIsLogoutModalOpen(false); router.replace("/auth/login");
  };

  const extractStatus = (v: any) => String(v.status || v.current_status || v.vehicle_status || v.STATUS || "").trim().toUpperCase();

  const fetchDashboardData = async () => {
    if (!supabase) return;
    const { data: vehiclesData } = await supabase.from('trucks').select('*');
    if (vehiclesData && vehiclesData.length > 0) {
      setLiveVehicles(vehiclesData);
      setStatusCounts({
        "Plant Loading": vehiclesData.filter((v: any) => extractStatus(v) === 'WAITING_FOR_LOAD' || extractStatus(v) === 'AVAILABLE_FOR_LOAD').length,
        "In Transit": vehiclesData.filter((v: any) => extractStatus(v) === 'IN_TRANSIT').length,
        "Workshop / Repairs": vehiclesData.filter((v: any) => extractStatus(v) === 'WORKSHOP_MAINTENANCE').length,
        "No Driver / Leave": vehiclesData.filter((v: any) => extractStatus(v) === 'DRIVER_UNAVAILABLE').length
      });
    }

    const { count: activeCount } = await supabase.from('trips').select('*', { count: 'exact', head: true }).neq('trip_status', 'COMPLETED');
    setActiveTripCount(activeCount || 0);

    const { count: driverPendingCount } = await supabase.from('driver_pending_entries').select('*', { count: 'exact', head: true }).eq('status', 'PENDING');
    setPendingDriverCount(driverPendingCount || 0);

    const now = new Date(); const year = now.getFullYear(); const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const firstDay = `${year}-${monthStr}-01`; const lastDayObj = new Date(year, now.getMonth() + 1, 0); const lastDay = `${year}-${monthStr}-${String(lastDayObj.getDate()).padStart(2, '0')}`;

    const [tripsRes, dieselRes, workshopRes] = await Promise.all([
      supabase.from('trips').select('freight_revenue, driver_bata, halt_bata, enroute_repairs_maintenance').gte('trip_start_date', firstDay).lte('trip_start_date', lastDay),
      supabase.from('diesel_fuel_logs').select('total_fuel_cost').gte('fuel_date', firstDay).lte('fuel_date', lastDay),
      supabase.from('workshop_spares_bills').select('bill_amount').gte('bill_date', firstDay).lte('bill_date', lastDay)
    ]);

    if (tripsRes.data && dieselRes.data) {
      setMonthTripsCount(tripsRes.data.length); 
      let totalFreight = 0; let nonFuelExpenses = 0; let totalDieselCost = 0; let totalWorkshop = 0;
      tripsRes.data.forEach((t: any) => { totalFreight += Number(t.freight_revenue) || 0; nonFuelExpenses += (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0) + (Number(t.enroute_repairs_maintenance) || 0); });
      dieselRes.data.forEach((d: any) => { totalDieselCost += Number(d.total_fuel_cost) || 0; });
      if (workshopRes.data) workshopRes.data.forEach((w: any) => { totalWorkshop += Number(w.bill_amount) || 0; });
      setMonthFreight(totalFreight); setMonthDieselCost(totalDieselCost); 
      setMonthNetRetention(totalFreight - totalDieselCost - nonFuelExpenses - totalWorkshop);
    }
  };

  useEffect(() => {
    if (isAuthenticated && supabase) { 
      setCurrentMonthText(new Date().toLocaleString('default', { month: 'long', year: 'numeric' })); 
      fetchDashboardData(); 
    }
  }, [activeTab, opSubTab, isAuthenticated, supabase]);

  if (isCheckingRoute || isAuthLoading || !supabase) return <div className="min-h-screen bg-[#030407]" />;

  if (isDriverRoute) {
    return (
      <div className="min-h-screen bg-[#030407] py-6 px-4">
        <div className="max-w-md mx-auto mb-6 text-center">
          <h1 className="text-xl font-black tracking-tighter text-white">KSS Roadways</h1>
          <p className="text-[10px] text-[#FF5A00] uppercase tracking-widest font-extrabold">Driver Highway Portal</p>
        </div>
        <DriverPortal/>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const erpNavigation = [
    { category: "Command & Operations", items: ["Dashboard", "Operations", "Fuel", "Workshop & Tyres"] },
    { category: "Finance & Analytics", items: ["Driver Settlement", "Accounts", "Fleet Analytics", "P&L Statement"] },
    { category: "System", items: ["Insights", "Master"] }
  ];

  const allowedCategories = (userRole === "ADMIN" || userRole === "SUPERADMIN") ? erpNavigation : [ { category: "Overview", items: ["Dashboard"] }, { category: "Finance", items: ["Fleet Analytics", "P&L Statement", "Insights"] } ];

  return (
    <div className="min-h-screen bg-[#030407] text-slate-100 font-sans selection:bg-[#FF5A00]/30 selection:text-[#FF5A00] relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-gradient-to-b from-[#FF5A00]/10 via-[#FF5A00]/3 to-transparent blur-[120px] pointer-events-none"></div>

      <ConfirmModal isOpen={isLogoutModalOpen} title="Secure Sign Out" message="Terminate active secure session?" isDanger={true} confirmText="Sign Out" onConfirm={executeLogout} onCancel={() => setIsLogoutModalOpen(false)} />

      {/* Hyper-Modern Floating Glass Header */}
      <header className="sticky top-4 z-50 max-w-[1600px] mx-auto px-6">
        <div className="bg-[#080A10]/70 backdrop-blur-2xl border border-white/[0.08] rounded-2xl px-6 py-4 flex items-center justify-between shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#121622] to-[#080A10] border border-white/[0.1] flex items-center justify-center shadow-inner">
              <KssLogo className="w-5 h-5"/>
            </div>
            <div>
              <h1 className="text-xs font-black tracking-wider text-white uppercase">KSS Roadways</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cochin Node • {liveVehicles.length} Active Units</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11px] font-semibold text-slate-300 font-mono">
              <span className="text-slate-500 uppercase">ROLE:</span>
              <span className="text-[#FF5A00] font-black">{userRole}</span>
            </div>
            <button onClick={() => setIsLogoutModalOpen(true)} className="px-3.5 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white bg-white/[0.04] hover:bg-rose-500/10 border border-white/[0.06] hover:border-rose-500/30 rounded-xl transition-all">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-6 relative z-10">
        
        {/* Sleek Minimalist Pill Navigation Bar */}
        <div className="flex flex-col lg:flex-row gap-3 p-1.5 bg-[#080A10]/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl">
          {allowedCategories.map((group) => (
            <div key={group.category} className="flex-1 flex items-center gap-1 p-1 bg-white/[0.01] rounded-xl border border-white/[0.03]">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-3 hidden xl:inline">{group.category}</span>
              <div className="flex flex-wrap gap-1 flex-1">
                {group.items.map((item) => (
                  <button key={item} onClick={() => setActiveTab(item)} className={`flex-1 px-3 py-2 text-[11px] font-bold rounded-lg transition-all tracking-tight ${activeTab === item ? "bg-gradient-to-r from-[#FF5A00] to-[#E04F00] text-white shadow-[0_0_20px_rgba(255,90,0,0.3)] font-black" : "text-slate-400 hover:text-white hover:bg-white/[0.04]"}`}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div>
          {activeTab === "Dashboard" && (
          <TelemetryHUD />
        )}

          {activeTab === "Operations" && (userRole === "ADMIN" || userRole === "SUPERADMIN") && (
            <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 sm:p-8 shadow-2xl min-h-[60vh]">
              <div className="flex flex-wrap gap-2 border-b border-white/[0.06] pb-5 mb-6">
                {opTabs.map((sub) => (
                  <button key={sub} onClick={() => setOpSubTab(sub)} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${opSubTab === sub ? "bg-[#FF5A00] text-white shadow-[0_0_20px_rgba(255,90,0,0.3)] font-black" : "text-slate-400 hover:text-white hover:bg-white/[0.04]"}`}>
                    {sub}
                  </button>
                ))}
              </div>
              {opSubTab === "Trips" && <TripForm />}
              {opSubTab === "POD Closure" && <PodClosure />}
              {opSubTab === "Modify Trips" && <ModifyTrips />}
              {opSubTab === "Driver Approvals" && <ApprovalQueue/>}
              {opSubTab === "Quick Status" && (
                <div className="bg-[#080A10] border border-white/[0.06] rounded-2xl p-6 max-w-xl">
                  <h3 className="text-xs font-black text-white mb-6 uppercase tracking-wider border-b border-white/[0.06] pb-3">Manual Status Override</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault(); if (!supabase || !qsTruckId) return;
                    const { error } = await supabase.from('trucks').update({ current_status: qsStatus, status_remarks: qsRemarks, status_updated_at: new Date().toISOString() }).eq('id', qsTruckId);
                    if (error) alert("Error: " + error.message); else { alert("Status updated!"); setQsTruckId(""); setQsRemarks(""); fetchDashboardData(); }
                  }} className="animate-tab-focus space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">Select Truck</label>
                      <select value={qsTruckId} onChange={(e) => setQsTruckId(e.target.value)} className="w-full text-xs p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] focus:border-[#FF5A00] outline-none font-bold text-white">
                        <option value="">Select vehicle...</option>
                        {liveVehicles.map(v => (<option key={v.id} value={v.id}>{v.vehicle_number} ({v.carrying_capacity_tons}MT)</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">Status</label>
                      <select value={qsStatus} onChange={(e) => setQsStatus(e.target.value)} className="w-full text-xs p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] focus:border-[#FF5A00] outline-none font-bold text-white">
                        <option value="WAITING_FOR_LOAD">Plant Loading</option><option value="IN_TRANSIT">In Transit</option><option value="WORKSHOP_MAINTENANCE">Workshop / Repairs</option><option value="DRIVER_UNAVAILABLE">No Driver / Leave</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">Remarks</label>
                      <input type="text" value={qsRemarks} onChange={(e) => setQsRemarks(e.target.value)} placeholder="Location or repair notes" className="w-full text-xs p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] focus:border-[#FF5A00] outline-none font-semibold text-white" />
                    </div>
                    <button type="submit" className="w-full py-3 bg-[#FF5A00] hover:bg-[#E04F00] text-white font-black text-xs rounded-xl uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(255,90,0,0.3)]">Update Fleet Status</button>
                  </form>
                </div>
              )}
            </div>
          )}

          {activeTab === "Driver Settlement" && <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-2xl"><DriverSettlementModule /></div>}
          {activeTab === "Accounts" && <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-2xl"><AccountsModule /></div>}
          {activeTab === "Fuel" && <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-2xl"><FuelAdvanceModule /></div>}
          {activeTab === "Workshop & Tyres" && <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-2xl"><WorkshopModule /></div>}
          {activeTab === "Fleet Analytics" && <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-2xl"><FinancialsModule /></div>}
          {activeTab === "P&L Statement" && <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-2xl"><ProfitLossModule /></div>}
          {activeTab === "Insights" && <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-2xl"><AiInsightsDashboard /></div>}
          {activeTab === "Master" && <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-2xl"><SetupModule /></div>}
        </div>

      </main>
    </div>
  );
}
