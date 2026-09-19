"use client";

import TelemetryHUD from "./TelemetryHUD";
import { useState, useEffect } from "react";
import { LogoutButton } from "@/components/LogoutButton";
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
    <rect width="200" height="200" fill="#FF9F0A" />
    <rect x="15" y="15" width="170" height="170" fill="#020203" />
    <path d="M 50 35 L 50 165" stroke="#FF9F0A" strokeWidth="24" strokeLinecap="square" />
    <path d="M 50 110 L 140 35" stroke="#FF9F0A" strokeWidth="24" strokeLinecap="square" />
    <path d="M 85 85 C 130 95, 145 130, 145 165" stroke="#FF9F0A" strokeWidth="24" fill="none" />
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

    const firstDay = "2026-09-01"; 

    const [tripsRes, dieselRes, workshopRes] = await Promise.all([
      supabase.from('trips').select('freight_revenue, driver_bata, halt_bata, enroute_repairs_maintenance').gte('trip_start_date', firstDay),
      supabase.from('diesel_fuel_logs').select('total_fuel_cost').gte('fuel_date', firstDay),
      supabase.from('workshop_spares_bills').select('bill_amount').gte('bill_date', firstDay)
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

  if (isCheckingRoute || isAuthLoading || !supabase) return <div className="min-h-screen bg-[#020203]" />;

  if (isDriverRoute) {
    return (
      <div className="min-h-screen bg-[#020203] text-white relative font-sans overflow-x-hidden">
        <div className="fixed top-[-10%] right-[-5%] w-[50vw] h-[50vw] bg-[#FF9F0A]/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen z-0 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="fixed bottom-[-10%] left-[-5%] w-[60vw] h-[60vw] bg-[#FFB340]/10 rounded-full blur-[150px] pointer-events-none mix-blend-screen z-0 animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="relative z-10">
          <div className="max-w-md mx-auto mb-6 text-center mt-8">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">KSS Roadways</h1>
            <p className="text-xs text-[#FF9F0A] tracking-wide font-medium mt-1">Driver Highway Portal</p>
          </div>
          <DriverPortal/>
        </div>
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
    <div className="min-h-screen bg-[#020203] text-slate-100 font-sans selection:bg-[#FF9F0A]/30 selection:text-[#FF9F0A] relative overflow-hidden">
      
      {/* Global Ambient Refraction for Liquid Glass */}
      <div className="fixed top-[-15%] right-[-10%] w-[60vw] h-[60vw] bg-[#FF9F0A]/15 rounded-full blur-[140px] pointer-events-none mix-blend-screen z-0 animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="fixed bottom-[-15%] left-[-10%] w-[70vw] h-[70vw] bg-[#FFB340]/10 rounded-full blur-[160px] pointer-events-none mix-blend-screen z-0 animate-pulse" style={{ animationDuration: '14s' }} />
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none z-0" />

      <div className="relative z-10">
        <ConfirmModal isOpen={isLogoutModalOpen} title="Secure Sign Out" message="Terminate active secure session?" isDanger={true} confirmText="Sign Out" onConfirm={executeLogout} onCancel={() => setIsLogoutModalOpen(false)} />

        {/* Hyper-Modern Floating Glass Header */}
        <header className="sticky top-4 z-50 max-w-[1600px] mx-auto px-6">
          <div className="liquid-glass rounded-3xl px-6 py-4 flex items-center justify-between shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#121622] to-[#080A10] border border-white/[0.1] flex items-center justify-center shadow-inner">
                <KssLogo className="w-5 h-5"/>
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-wide text-white">KSS Roadways</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]"></span>
                  <span className="text-[10px] font-medium text-white/60 tracking-wide">Cochin Node {liveVehicles.length} Active Units</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl liquid-glass text-[11px] font-semibold font-mono border-white/[0.05]">
                <span className="text-white/40">ROLE:</span>
                <span className="text-[#FF9F0A] font-bold">{userRole}</span>
              </div>
              <button onClick={() => setIsLogoutModalOpen(true)} className="btn-glass px-5 py-2 rounded-xl text-xs font-semibold">
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">

          {/* Sleek Minimalist Glass Navigation Bar */}
          <div className="flex flex-col lg:flex-row gap-3 p-2 liquid-glass rounded-[28px]">
            {allowedCategories.map((group) => (
              <div key={group.category} className="flex-1 flex flex-col xl:flex-row xl:items-center gap-2 p-1.5 bg-white/[0.02] rounded-2xl border border-white/[0.03]">
                <span className="text-[10px] font-semibold text-white/40 px-3 hidden xl:inline uppercase tracking-widest">{group.category}</span>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {group.items.map((item) => (
                    <button key={item} onClick={() => setActiveTab(item)} className={`flex-1 px-4 py-2.5 text-[11.5px] rounded-xl transition-all tracking-wide ios-spring ${activeTab === item ? "bg-gradient-to-r from-[#FFB340] to-[#FF9F0A] text-black shadow-[0_4px_15px_rgba(255,159,10,0.4)] font-bold" : "text-white/70 hover:text-white hover:bg-white/[0.06] font-medium"}`}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="ios-spring">
            {activeTab === "Dashboard" && <TelemetryHUD />}

            {activeTab === "Operations" && (userRole === "ADMIN" || userRole === "SUPERADMIN") && (
              <div className="liquid-glass rounded-[32px] p-6 sm:p-8 min-h-[60vh]">
                <div className="flex flex-wrap gap-2 border-b border-white/[0.08] pb-6 mb-8">
                  {opTabs.map((sub) => (
                    <button key={sub} onClick={() => setOpSubTab(sub)} className={`px-5 py-2.5 rounded-xl text-xs transition-all ios-spring ${opSubTab === sub ? "bg-gradient-to-r from-[#FFB340] to-[#FF9F0A] text-black shadow-[0_4px_15px_rgba(255,159,10,0.4)] font-bold" : "text-white/60 hover:text-white hover:bg-white/[0.06] font-semibold"}`}>
                      {sub}
                    </button>
                  ))}
                </div>
                
                {opSubTab === "Trips" && <TripForm />}
                {opSubTab === "POD Closure" && <PodClosure />}
                {opSubTab === "Modify Trips" && <ModifyTrips />}
                {opSubTab === "Driver Approvals" && <ApprovalQueue/>}
                {opSubTab === "Quick Status" && (
                  <div className="liquid-glass rounded-3xl p-8 max-w-xl border border-white/[0.1]">
                    <h3 className="text-sm font-semibold text-white mb-6 tracking-wide border-b border-white/[0.08] pb-4">Manual Status Override</h3>
                    <form onSubmit={async (e) => {
                      e.preventDefault(); if (!supabase || !qsTruckId) return;
                      const { error } = await supabase.from('trucks').update({ current_status: qsStatus, status_remarks: qsRemarks, status_updated_at: new Date().toISOString() }).eq('id', qsTruckId);
                      if (error) alert("Error: " + error.message); else { alert("Status updated!"); setQsTruckId(""); setQsRemarks(""); fetchDashboardData(); }
                    }} className="space-y-5">
                      <div>
                        <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Select Truck</label>
                        <select value={qsTruckId} onChange={(e) => setQsTruckId(e.target.value)} className="w-full liquid-input">
                          <option value="" className="bg-[#020203]">Select vehicle...</option>
                          {liveVehicles.map(v => (<option key={v.id} value={v.id} className="bg-[#020203]">{v.vehicle_number} ({v.carrying_capacity_tons}MT)</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Status</label>
                        <select value={qsStatus} onChange={(e) => setQsStatus(e.target.value)} className="w-full liquid-input">
                          <option value="WAITING_FOR_LOAD" className="bg-[#020203]">Plant Loading</option>
                          <option value="IN_TRANSIT" className="bg-[#020203]">In Transit</option>
                          <option value="WORKSHOP_MAINTENANCE" className="bg-[#020203]">Workshop / Repairs</option>
                          <option value="DRIVER_UNAVAILABLE" className="bg-[#020203]">No Driver / Leave</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Remarks</label>
                        <input type="text" value={qsRemarks} onChange={(e) => setQsRemarks(e.target.value)} placeholder="Location or repair notes" className="w-full liquid-input" />
                      </div>
                      <button type="submit" className="w-full py-4 btn-orange-glow rounded-2xl text-[14px] mt-4">Update Fleet Status</button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {activeTab === "Driver Settlement" && <div className="liquid-glass rounded-[32px] p-6 sm:p-8"><DriverSettlementModule /></div>}
            {activeTab === "Accounts" && <div className="liquid-glass rounded-[32px] p-6 sm:p-8"><AccountsModule /></div>}
            {activeTab === "Fuel" && <div className="liquid-glass rounded-[32px] p-6 sm:p-8"><FuelAdvanceModule /></div>}
            {activeTab === "Workshop & Tyres" && <div className="liquid-glass rounded-[32px] p-6 sm:p-8"><WorkshopModule /></div>}
            {activeTab === "Fleet Analytics" && <div className="liquid-glass rounded-[32px] p-6 sm:p-8"><FinancialsModule /></div>}
            {activeTab === "P&L Statement" && <div className="liquid-glass rounded-[32px] p-6 sm:p-8"><ProfitLossModule /></div>}
            {activeTab === "Insights" && <div className="liquid-glass rounded-[32px] p-6 sm:p-8"><AiInsightsDashboard /></div>}
            {activeTab === "Master" && <div className="liquid-glass rounded-[32px] p-6 sm:p-8"><SetupModule /></div>}
          </div>
        </main>
      </div>
    </div>
  );
}
