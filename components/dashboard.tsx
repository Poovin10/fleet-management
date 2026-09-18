"use client";

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
    <rect x="15" y="15" width="170" height="170" fill="#050608" />
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
  const [expiringDocs, setExpiringDocs] = useState<Record<string, any[]>>({});
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

    const { data: authListener } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (session) { setIsAuthenticated(true); } else if (event === 'SIGNED_OUT' && !isDriverRoute) { router.replace("/auth/login"); }
    });

    return () => { authListener.subscription.unsubscribe(); };
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

    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const tenDaysFromNow = new Date(today); tenDaysFromNow.setDate(today.getDate() + 10);

    const alerts: Record<string, any[]> = {};
    const checkDoc = (docName: string, entityName: string, dateVal: string) => {
      if (!dateVal) return; const expDate = new Date(dateVal); expDate.setHours(0,0,0,0);
      if (expDate <= tenDaysFromNow) {
        const isUrgent = expDate <= tomorrow; if (!alerts[docName]) alerts[docName] = [];
        const cleanName = entityName.replace("Truck ", ""); alerts[docName].push({ name: cleanName, date: dateVal, isUrgent, expDate });
      }
    };

    const { data: drivers } = await supabase.from('drivers').select('driver_code, full_name, license_expiry_date');
    if (drivers) drivers.forEach((d: any) => checkDoc("Driving License", `${d.driver_code} - ${d.full_name}`, d.license_expiry_date));

    const { data: vehicles } = await supabase.from('trucks').select('vehicle_number, truck_type, fc_expiry_date, insurance_expiry_date, qtax_expiry_date, puc_expiry_date, np_expiry_date, state_permit_expiry_date, tank_cert_expiry_date');
    if (vehicles) {
      vehicles.forEach((v: any) => {
        const tName = `Truck ${v.vehicle_number}`;
        checkDoc("FC Test", tName, v.fc_expiry_date); checkDoc("Insurance", tName, v.insurance_expiry_date); checkDoc("Quarterly Tax", tName, v.qtax_expiry_date);
        checkDoc("PUC Certificate", tName, v.puc_expiry_date); checkDoc("National Permit", tName, v.np_expiry_date); checkDoc("State Permit", tName, v.state_permit_expiry_date);
        if (String(v.truck_type).toUpperCase().includes("BULK")) checkDoc("Tank Cert", tName, v.tank_cert_expiry_date);
      });
    }

    Object.keys(alerts).forEach(k => alerts[k].sort((a, b) => a.expDate.getTime() - b.expDate.getTime()));
    setExpiringDocs(alerts);

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
      const syncInterval = setInterval(fetchDashboardData, 15000);
      return () => clearInterval(syncInterval);
    }
  }, [activeTab, opSubTab, isAuthenticated, supabase]);

  const getDrillDownData = (statusLabel: string) => {
    const statusMap: Record<string, string[]> = { "Plant Loading": ["WAITING_FOR_LOAD", "AVAILABLE_FOR_LOAD"], "In Transit": ["IN_TRANSIT"], "Workshop / Repairs": ["WORKSHOP_MAINTENANCE"], "No Driver / Leave": ["DRIVER_UNAVAILABLE"] };
    return liveVehicles.filter((v: any) => (statusMap[statusLabel] || []).includes(extractStatus(v)));
  };

  const currentDrillDownData = selectedStatus ? getDrillDownData(selectedStatus) : [];

  const handleQuickStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!supabase) return; if (!qsTruckId) return alert("Please select a truck.");
    const { error } = await supabase.from('trucks').update({ current_status: qsStatus, status_remarks: qsRemarks, status_updated_at: new Date().toISOString() }).eq('id', qsTruckId);
    if (error) alert("Error updating status: " + error.message);
    else { alert("Vehicle status updated successfully!"); setQsTruckId(""); setQsRemarks(""); fetchDashboardData(); }
  };

  if (isCheckingRoute || isAuthLoading || !supabase) return <div className="min-h-screen bg-[#050608]" />;

  if (isDriverRoute) {
    return (
      <div className="min-h-screen bg-[#050608] py-6 px-4" style={{ colorScheme: 'dark' }}>
        <div className="max-w-md mx-auto mb-6 text-center">
          <h1 className="text-xl font-black text-white">KSS Roadways</h1>
          <p className="text-xs text-[#FF5A00] uppercase tracking-widest font-bold">Driver Highway Portal</p>
        </div>
        <DriverPortal/>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const erpNavigation = [
    { category: "Overview & Dispatch", items: ["Dashboard", "Operations", "Fuel", "Workshop & Tyres"] },
    { category: "Finance & Accounting", items: ["Driver Settlement", "Accounts", "Fleet Analytics", "P&L Statement"] },
    { category: "Administration", items: ["Insights", "Master"] }
  ];

  const allowedCategories = (userRole === "ADMIN" || userRole === "SUPERADMIN") 
    ? erpNavigation 
    : [ { category: "Overview", items: ["Dashboard"] }, { category: "Finance", items: ["Fleet Analytics", "P&L Statement", "Insights"] } ];

  return (
    <div className="min-h-screen bg-[#050608] text-white font-sans selection:bg-[#FF5A00]/20 selection:text-[#FF5A00] relative overflow-x-hidden">
      <ConfirmModal isOpen={isLogoutModalOpen} title="Secure Sign Out" message="Are you sure you want to log out of the KSS Roadways ERP system?" isDanger={true} confirmText="Log Out Now" onConfirm={executeLogout} onCancel={() => setIsLogoutModalOpen(false)} />

      {/* Tier-1 Command Navigation Shell */}
      <header className="sticky top-0 z-40 bg-[#050608]/85 backdrop-blur-xl border-b border-white/[0.06] shadow-2xl">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#0B0D13] border border-white/[0.08] flex items-center justify-center shadow-inner">
              <KssLogo className="w-7 h-7"/>
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white uppercase">KSS Roadways Pvt Ltd</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cochin Node • Active Fleet: {liveVehicles.length}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-[#0B0D13] border border-white/[0.06] text-xs font-bold text-slate-300">
              <span className="text-slate-400 font-semibold">Session:</span>
              <span className="text-white font-black uppercase">{userRole}</span>
            </div>
            <button onClick={() => setIsLogoutModalOpen(true)} className="px-4 py-2 text-xs font-extrabold text-slate-300 hover:text-white bg-[#0B0D13] hover:bg-rose-950/40 border border-white/[0.06] hover:border-rose-900/50 rounded-xl transition-all">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-8 animate-slide-up">
        
        {/* Categorized Enterprise Module Selector */}
        <nav className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {allowedCategories.map((group) => (
            <div key={group.category} className="erp-card rounded-2xl p-3 flex flex-col justify-between">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 pt-1 pb-2">{group.category}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item) => (
                  <button key={item} onClick={() => setActiveTab(item)} className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all ${activeTab === item ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/30 ring-1 ring-[#FF5A00]" : "text-slate-400 hover:text-white hover:bg-white/[0.04]"}`}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div>
          {activeTab === "Dashboard" && (
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="flex-1 space-y-8 min-w-0">

                {pendingDriverCount > 0 && (
                  <div className="erp-card rounded-2xl p-5 border-l-4 border-l-amber-500 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider">Pending Driver Approvals</h3>
                      <p className="text-xs text-slate-300 mt-1"><span className="font-black text-white">{pendingDriverCount}</span> fuel bills are waiting for review in Operations.</p>
                    </div>
                    <button onClick={() => { setActiveTab("Operations"); setOpSubTab("Driver Approvals"); }} className="erp-button-primary px-4 py-2 text-xs uppercase">
                      Review Queue &rarr;
                    </button>
                  </div>
                )}

                <div className="erp-card rounded-3xl p-6 sm:p-8">
                  <div className="flex justify-between items-center mb-6 border-b border-white/[0.06] pb-4">
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Operations Command Summary</h3>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">Real-time financial and trip throughput metrics</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                      <span className="px-3 py-1 bg-[#FF5A00]/15 text-[#FF5A00] text-xs font-black rounded-lg border border-[#FF5A00]/30 uppercase tracking-wider">
                        {currentMonthText}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-[#0B0D13] border border-white/[0.06] rounded-2xl p-5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Trips</p>
                      <p className="text-3xl font-black text-white mt-2">{monthTripsCount}</p>
                    </div>
                    <div className="bg-[#0B0D13] border border-white/[0.06] rounded-2xl p-5">
                      <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">PODs Pending</p>
                      <p className="text-3xl font-black text-rose-300 mt-2">{activeTripCount}</p>
                    </div>
                    <div className="bg-[#0B0D13] border border-white/[0.06] rounded-2xl p-5">
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Freight Revenue</p>
                      <p className="text-2xl sm:text-3xl font-black text-emerald-300 mt-2 truncate">₹{formatAmt(monthFreight)}</p>
                    </div>
                    <div className="bg-[#0B0D13] border border-white/[0.06] rounded-2xl p-5">
                      <p className="text-[10px] font-black text-[#FF5A00] uppercase tracking-widest">Net Retention</p>
                      <p className="text-2xl sm:text-3xl font-black text-[#FF5A00] mt-2 truncate">₹{formatAmt(monthNetRetention)}</p>
                    </div>
                  </div>
                </div>

                <div className="erp-card rounded-3xl p-6 sm:p-8">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider mb-6">Live Fleet Telemetry & Status Monitor</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {["Plant Loading", "In Transit", "Workshop / Repairs", "No Driver / Leave"].map(status => (
                      <div key={status} onClick={() => setSelectedStatus(selectedStatus === status ? null : status)} className={`p-4 rounded-2xl border cursor-pointer transition-all ${selectedStatus === status ? 'border-[#FF5A00] bg-[#FF5A00]/10 ring-2 ring-[#FF5A00]/30' : 'border-white/[0.06] bg-[#0B0D13] hover:border-white/[0.12]'}`}>
                        <p className="text-3xl font-black text-white tracking-tight">{statusCounts[status as keyof typeof statusCounts]}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{status}</p>
                      </div>
                    ))}
                  </div>

                  {selectedStatus && (
                    <div className="mt-6 border-t border-white/[0.06] pt-6 animate-slide-up">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs font-black text-[#FF5A00] uppercase tracking-wider">{selectedStatus} Fleet Units</h4>
                        <button onClick={() => setSelectedStatus(null)} className="text-[10px] font-bold text-slate-400 hover:text-white bg-white/[0.06] px-3 py-1 rounded-lg">Close</button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {currentDrillDownData.map((v: any) => (
                          <div key={v.id} className="p-3.5 border border-white/[0.06] rounded-xl bg-[#0B0D13] flex justify-between items-center">
                            <div><p className="text-sm font-black text-white">{v.vehicle_number}</p><p className="text-[10px] font-bold text-slate-500 uppercase">{v.truck_type}</p></div>
                            <span className="text-[10px] font-black px-2 py-1 bg-white/[0.04] border border-white/[0.06] rounded-md text-slate-300">{v.carrying_capacity_tons} MT</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
              <div className="w-full lg:w-[400px] shrink-0"><LiveAlertsWidget/></div>
            </div>
          )}

          {activeTab === "Operations" && (userRole === "ADMIN" || userRole === "SUPERADMIN") && (
            <div className="erp-card rounded-3xl p-6 sm:p-8 min-h-[60vh]">
              <div className="flex flex-wrap gap-2 border-b border-white/[0.06] pb-5 mb-6">
                {opTabs.map((sub) => (
                  <button key={sub} onClick={() => setOpSubTab(sub)} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${opSubTab === sub ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/30 ring-1 ring-[#FF5A00]" : "text-slate-400 hover:text-white hover:bg-white/[0.04]"}`}>
                    {sub}
                  </button>
                ))}
              </div>
              {opSubTab === "Trips" && <TripForm onSuccess={() => fetchDashboardData()} />}
              {opSubTab === "POD Closure" && <PodClosure onSuccess={() => fetchDashboardData()} />}
              {opSubTab === "Modify Trips" && <ModifyTrips />}
              {opSubTab === "Driver Approvals" && <ApprovalQueue/>}
              {opSubTab === "Quick Status" && (
                <div className="erp-card rounded-2xl p-6 max-w-xl">
                  <h3 className="text-sm font-black text-white mb-6 uppercase tracking-wider border-b border-white/[0.06] pb-3">Manual Status Override</h3>
                  <form onSubmit={handleQuickStatusSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Select Truck</label>
                      <select value={qsTruckId} onChange={(e) => setQsTruckId(e.target.value)} className="w-full text-sm p-3.5 rounded-xl border border-white/[0.08] bg-[#0B0D13] focus:border-[#FF5A00] outline-none font-bold text-white">
                        <option value="">Select vehicle...</option>
                        {liveVehicles.map(v => (<option key={v.id} value={v.id}>{v.vehicle_number} ({v.carrying_capacity_tons}MT {v.truck_type})</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">New Operational Status</label>
                      <select value={qsStatus} onChange={(e) => setQsStatus(e.target.value)} className="w-full text-sm p-3.5 rounded-xl border border-white/[0.08] bg-[#0B0D13] focus:border-[#FF5A00] outline-none font-bold text-white">
                        <option value="WAITING_FOR_LOAD">Plant Loading</option><option value="IN_TRANSIT">In Transit</option><option value="WORKSHOP_MAINTENANCE">Workshop / Repairs</option><option value="DRIVER_UNAVAILABLE">No Driver / Leave</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">Breakdown / Location Remarks</label>
                      <input type="text" value={qsRemarks} onChange={(e) => setQsRemarks(e.target.value)} placeholder="e.g. Workshop maintenance at Cochin" className="w-full text-sm p-3.5 rounded-xl border border-white/[0.08] bg-[#0B0D13] focus:border-[#FF5A00] outline-none font-semibold text-white" />
                    </div>
                    <button type="submit" className="erp-button-primary w-full py-4 mt-2 uppercase tracking-wider text-xs">Update Fleet Status</button>
                  </form>
                </div>
              )}
            </div>
          )}

          {activeTab === "Driver Settlement" && <div className="erp-card rounded-3xl p-6"><DriverSettlementModule /></div>}
          {activeTab === "Accounts" && <div className="erp-card rounded-3xl p-6"><AccountsModule /></div>}
          {activeTab === "Fuel" && <div className="erp-card rounded-3xl p-6"><FuelAdvanceModule /></div>}
          {activeTab === "Workshop & Tyres" && <div className="erp-card rounded-3xl p-6"><WorkshopModule /></div>}
          {activeTab === "Fleet Analytics" && <div className="erp-card rounded-3xl p-6"><FinancialsModule /></div>}
          {activeTab === "P&L Statement" && <div className="erp-card rounded-3xl p-6"><ProfitLossModule /></div>}
          {activeTab === "Insights" && <div className="erp-card rounded-3xl p-6"><AiInsightsDashboard /></div>}
          {activeTab === "Master" && <div className="erp-card rounded-3xl p-6"><SetupModule /></div>}
        </div>

      </main>
    </div>
  );
}
