"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { TripForm } from "@/components/TripForm";
import { PodClosure } from "@/components/PodClosure";
import { ModifyTrips } from "@/components/ModifyTrips";
import { FuelAdvanceModule } from "@/components/FuelAdvanceModule";
import { FinancialsModule } from "@/components/FinancialsModule";
import { ProfitLossModule } from "@/components/ProfitLossModule";
import { WorkshopModule } from "@/components/WorkshopModule";
import { SetupModule } from "@/components/SetupModule";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ApprovalQueue } from "@/components/ApprovalQueue";
import { DriverPortal } from "@/components/DriverPortal";
import { LiveAlertsWidget } from "@/components/LiveAlertsWidget";

const KssLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="200" height="200" fill="#FF5A00" />
    <rect x="15" y="15" width="170" height="170" fill="#050507" />
    <path d="M 50 35 L 50 165" stroke="#FF5A00" strokeWidth="24" strokeLinecap="square" />
    <path d="M 50 110 L 140 35" stroke="#FF5A00" strokeWidth="24" strokeLinecap="square" />
    <path d="M 85 85 C 130 95, 145 130, 145 165" stroke="#FF5A00" strokeWidth="24" fill="none" />
  </svg>
);

export default function SaaS_ERPDashboard() {
  const supabase = createClient();
  const router = useRouter();

  const [isDriverRoute, setIsDriverRoute] = useState(false);
  const [isCheckingRoute, setIsCheckingRoute] = useState(true);

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
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
  
  const [statusCounts, setStatusCounts] = useState({
    "Plant Loading": 0, "In Transit": 0, "Workshop / Repairs": 0, "No Driver / Leave": 0
  });

  const [qsTruckId, setQsTruckId] = useState("");
  const [qsStatus, setQsStatus] = useState("WAITING_FOR_LOAD");
  const [qsRemarks, setQsRemarks] = useState("");

  const opTabs = ["Trips", "POD Closure", "Modify Trips", "Quick Status", "Driver Approvals"];

  const formatAmt = (amt: number) => (Number(amt) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.pathname.startsWith('/driver')) setIsDriverRoute(true);
    }
    setIsCheckingRoute(false);
  }, []);

  // SECURE AUTHENTICATION BARRIER
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsAuthenticated(true);
        setIsAuthLoading(false);
      } else {
        // If not authenticated, force them to the login screen immediately
        router.replace("/auth/login");
      }
    };

    if (!isDriverRoute) {
      checkAuth();
    } else {
      setIsAuthLoading(false); // Driver portal handles its own auth
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsAuthenticated(true);
      } else if (!isDriverRoute) {
        router.replace("/auth/login");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router, supabase.auth, isDriverRoute]);

  const executeLogout = async () => {
    await supabase.auth.signOut();
    setIsLogoutModalOpen(false);
    router.replace("/auth/login");
  };

  const extractStatus = (v: any) => String(v.status || v.current_status || v.vehicle_status || v.STATUS || "").trim().toUpperCase();

  const fetchDashboardData = async () => {
    const { data: vehiclesData } = await supabase.from('vehicles').select('*').eq('is_active', true);
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

    // --- 10-DAY COMPLIANCE LOGIC ---
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tenDaysFromNow = new Date(today);
    tenDaysFromNow.setDate(today.getDate() + 10);

    const alerts: Record<string, any[]> = {};
    const checkDoc = (docName: string, entityName: string, dateVal: string) => {
      if (!dateVal) return;
      const expDate = new Date(dateVal);
      expDate.setHours(0,0,0,0);
      
      if (expDate <= tenDaysFromNow) {
        const isUrgent = expDate <= tomorrow; 
        if (!alerts[docName]) alerts[docName] = [];
        const cleanName = entityName.replace("Truck ", "");
        alerts[docName].push({ name: cleanName, date: dateVal, isUrgent, expDate });
      }
    };

    const { data: drivers } = await supabase.from('drivers').select('driver_code, full_name, license_expiry_date').eq('is_active', true);
    if (drivers) drivers.forEach((d: any) => checkDoc("Driving License", `${d.driver_code} - ${d.full_name}`, d.license_expiry_date));

    const { data: vehicles } = await supabase.from('vehicles').select('vehicle_number, truck_type, fc_expiry_date, insurance_expiry_date, qtax_expiry_date, puc_expiry_date, np_expiry_date, state_permit_expiry_date, tank_cert_expiry_date').eq('is_active', true);
    if (vehicles) {
      vehicles.forEach((v: any) => {
        const tName = `Truck ${v.vehicle_number}`;
        checkDoc("FC Test", tName, v.fc_expiry_date);
        checkDoc("Insurance", tName, v.insurance_expiry_date);
        checkDoc("Quarterly Tax", tName, v.qtax_expiry_date);
        checkDoc("PUC Certificate", tName, v.puc_expiry_date);
        checkDoc("National Permit", tName, v.np_expiry_date);
        checkDoc("State Permit", tName, v.state_permit_expiry_date);
        if (String(v.truck_type).toUpperCase().includes("BULK")) checkDoc("Tank Cert", tName, v.tank_cert_expiry_date);
      });
    }

    Object.keys(alerts).forEach(k => alerts[k].sort((a, b) => a.expDate.getTime() - b.expDate.getTime()));
    setExpiringDocs(alerts);

    // --- FINANCES ---
    const now = new Date();
    const year = now.getFullYear();
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const firstDay = `${year}-${monthStr}-01`;
    const lastDayObj = new Date(year, now.getMonth() + 1, 0);
    const lastDay = `${year}-${monthStr}-${String(lastDayObj.getDate()).padStart(2, '0')}`;

    const { data: monthTrips } = await supabase.from('trips').select('freight_revenue, driver_bata, halt_bata, enroute_repairs_maintenance').gte('trip_start_date', firstDay).lte('trip_start_date', lastDay);
    const { data: monthDiesel } = await supabase.from('diesel_fuel_logs').select('total_fuel_cost').gte('fuel_date', firstDay).lte('fuel_date', lastDay);

    if (monthTrips && monthDiesel) {
      setMonthTripsCount(monthTrips.length);
      let totalFreight = 0; let nonFuelExpenses = 0; let totalDieselCost = 0;
      monthTrips.forEach((t: any) => {
        totalFreight += Number(t.freight_revenue) || 0;
        nonFuelExpenses += (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0) + (Number(t.enroute_repairs_maintenance) || 0);
      });
      monthDiesel.forEach((d: any) => { totalDieselCost += Number(d.total_fuel_cost) || 0; });
      setMonthFreight(totalFreight);
      setMonthDieselCost(totalDieselCost);
      setMonthNetRetention(totalFreight - totalDieselCost - nonFuelExpenses);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      setCurrentMonthText(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
      fetchDashboardData();
    }
  }, [activeTab, isAuthenticated]);

  const getDrillDownData = (statusLabel: string) => {
    const statusMap: Record<string, string[]> = {
      "Plant Loading": ["WAITING_FOR_LOAD", "AVAILABLE_FOR_LOAD"], "In Transit": ["IN_TRANSIT"], "Workshop / Repairs": ["WORKSHOP_MAINTENANCE"], "No Driver / Leave": ["DRIVER_UNAVAILABLE"]
    };
    return liveVehicles.filter((v: any) => (statusMap[statusLabel] || []).includes(extractStatus(v)));
  };

  const currentDrillDownData = selectedStatus ? getDrillDownData(selectedStatus) : [];

  const handleQuickStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qsTruckId) return alert("Please select a truck.");
    const { error } = await supabase.from('vehicles').update({ current_status: qsStatus, status_remarks: qsRemarks, status_updated_at: new Date().toISOString() }).eq('vehicle_id', qsTruckId);
    if (error) alert("Error updating status: " + error.message);
    else { alert("Vehicle status updated successfully!"); setQsTruckId(""); setQsRemarks(""); fetchDashboardData(); }
  };

  // Render a blank screen while verifying authentication to prevent flashing the dashboard
  if (isCheckingRoute || isAuthLoading) return <div className="min-h-screen bg-[#050507]" />;

  if (isDriverRoute) {
    return (
      <div className="min-h-screen bg-[#050507] py-6 px-4" style={{ colorScheme: 'dark' }}>
        <div className="max-w-md mx-auto mb-6 text-center">
          <h1 className="text-xl font-black text-white">KSS Roadways</h1>
          <p className="text-xs text-[#FF5A00] uppercase tracking-widest font-bold">Driver Highway Portal</p>
        </div>
        <DriverPortal/>
      </div>
    );
  }

  // Double check: if they somehow bypassed the redirect, don't render the secure UI
  if (!isAuthenticated) return null;

  // All tabs available to authorized users
  const navItems = ["Dashboard", "Operations", "Fuel & Adv", "Workshop & Tyres", "Financials", "P&L Statement", "Setup"];

  return (
    <div className="min-h-screen bg-[#050507] text-white font-sans selection:bg-[#FF5A00]/20 selection:text-[#FF5A00] relative overflow-x-hidden">
      <ConfirmModal isOpen={isLogoutModalOpen} title="Secure Sign Out" message="Are you sure you want to log out of the KSS Roadways ERP system?" isDanger={true} confirmText="Log Out Now" onConfirm={executeLogout} onCancel={() => setIsLogoutModalOpen(false)} />

      <header className="sticky top-0 z-40 bg-[#050507]/90 backdrop-blur-md border-b border-[#222634] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl shadow-sm border border-[#222634] overflow-hidden flex-shrink-0 bg-[#0F1117] flex items-center justify-center"><KssLogo className="w-8 h-8 sm:w-10 sm:h-10"/></div>
            <div className="bg-[#12141C] px-3 py-1.5 rounded-lg border border-[#222634] truncate">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-[#FF5A00] hidden sm:block leading-none">KSS Roadways Pvt Ltd</h1>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-[#FF5A00] sm:hidden leading-none truncate">KSS Roadways</h1>
            </div>
            <span className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-black bg-[#161A23] text-slate-400 border border-[#222634] uppercase tracking-widest whitespace-nowrap">Cochin</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <span className="text-xs sm:text-sm font-bold text-slate-500 hidden md:block">Fleet: <span className="text-white">{liveVehicles.length}</span></span>
            <div className="h-5 w-px bg-[#222634] hidden md:block"></div>
            <button onClick={() => setIsLogoutModalOpen(true)} className="flex items-center gap-2 text-xs sm:text-sm font-black text-slate-300 hover:text-rose-400 hover:bg-rose-950/50 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-all border border-[#222634] hover:border-rose-900 shadow-sm"><span>Sign out</span></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <nav className="flex flex-wrap gap-1.5 bg-[#12141C] p-1.5 rounded-2xl border border-[#222634] shadow-sm">
          {navItems.map((item) => (
            <button key={item} onClick={() => setActiveTab(item)} className={`px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 ease-out whitespace-nowrap ${activeTab === item ? "bg-[#FF5A00] text-white shadow-sm ring-1 ring-[#FF5A00]" : "text-slate-400 hover:text-white hover:bg-[#1A1F2C]"}`}>
              {item}
            </button>
          ))}
        </nav>

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out">
          {activeTab === "Dashboard" && (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 space-y-6 min-w-0">
                
                {pendingDriverCount > 0 && (
                  <div className="bg-amber-950/30 border-l-4 border-amber-500 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📥</span>
                      <div>
                        <h3 className="text-xs sm:text-sm font-black text-amber-400 uppercase tracking-wide">Pending Driver Approvals</h3>
                        <p className="text-xs text-amber-200 mt-0.5">There are <span className="font-black">{pendingDriverCount}</span> fuel bills waiting for manager review in Operations.</p>
                      </div>
                    </div>
                    <button onClick={() => { setActiveTab("Operations"); setOpSubTab("Driver Approvals"); }} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition-colors shadow-sm whitespace-nowrap">
                      Review Queue &rarr;
                    </button>
                  </div>
                )}

                {Object.keys(expiringDocs).length > 0 && (
                  <div className="bg-[#12141C] border border-[#222634] rounded-2xl shadow-sm p-4 sm:p-6 animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-3 mb-5">
                      <span className="text-xl">🚨</span>
                      <h3 className="text-xs sm:text-sm font-black text-rose-400 uppercase tracking-wide">Compliance Alerts (10 Days)</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(expiringDocs).map(([docType, items]) => (
                        <div key={docType} className="bg-[#1A1F2C] border border-[#2B3142] rounded-xl p-4">
                          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3 border-b border-[#222634] pb-2">
                            {docType.toUpperCase()}
                          </h4>
                          <div className="space-y-2.5">
                            {(items as any[]).map((item, idx) => (
                              <div key={idx} className={`text-xs font-bold ${item.isUrgent ? 'text-rose-500' : 'text-amber-500'}`}>
                                {idx + 1}. {item.name} - {item.date}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-[#12141C] border border-[#222634] rounded-2xl shadow-sm p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wide">Operations Summary</h3>
                    <span className="px-3 py-1 bg-[#FF5A00]/20 text-[#FF5A00] text-[10px] sm:text-xs font-bold rounded-full border border-[#FF5A00]/30 whitespace-nowrap">
                      {currentMonthText.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                    <div className="p-4 rounded-xl bg-[#1A1F2C] border border-[#2B3142] flex flex-col justify-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Trips</p>
                      <p className="text-3xl font-black text-white mt-1 leading-none">{monthTripsCount}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/50 flex flex-col justify-center">
                      <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">PODs Pending</p>
                      <p className="text-3xl font-black text-rose-300 mt-1 leading-none">{activeTripCount}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/50 flex flex-col sm:flex-row sm:items-center justify-between">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1 sm:mb-0">Freight Generated</p>
                      <p className="text-2xl sm:text-3xl font-black text-emerald-300 leading-none">₹{formatAmt(monthFreight)}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#0F1117] border border-[#222634] shadow-md flex flex-col sm:flex-row sm:items-center justify-between">
                      <div className="mb-1 sm:mb-0">
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Retention</p>
                         {monthFreight > 0 && <p className="text-[10px] font-bold text-emerald-500 mt-1">{((monthNetRetention/monthFreight)*100).toFixed(1)}% Margin</p>}
                      </div>
                      <p className="text-2xl sm:text-3xl font-black text-[#FF5A00] leading-none">₹{formatAmt(monthNetRetention)}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-900/50 flex flex-col sm:flex-row sm:items-center justify-between">
                      <div className="mb-1 sm:mb-0">
                        <p className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">Diesel Expense</p>
                        {monthFreight > 0 && <p className="text-[10px] font-bold text-sky-500 mt-1">{((monthDieselCost/monthFreight)*100).toFixed(1)}% of Freight</p>}
                      </div>
                      <p className="text-2xl sm:text-3xl font-black text-sky-300 leading-none">₹{formatAmt(monthDieselCost)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#12141C] border border-[#222634] rounded-2xl shadow-sm p-4 sm:p-6 mt-6">
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wide mb-6">Live Vehicle Status Monitor</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {["Plant Loading", "In Transit", "Workshop / Repairs", "No Driver / Leave"].map(status => (
                      <div key={status} onClick={() => setSelectedStatus(selectedStatus === status ? null : status)} className={`p-3 sm:p-4 rounded-xl border cursor-pointer transition-all min-w-0 ${selectedStatus === status ? 'border-[#FF5A00] ring-2 ring-[#FF5A00]/30 bg-[#FF5A00]/10' : 'border-[#2B3142] hover:border-[#FF5A00]/50 bg-[#1A1F2C]'}`}>
                        <p className="text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-black text-white tracking-tighter truncate">{statusCounts[status as keyof typeof statusCounts]}</p>
                        <p className="text-[9px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider mt-1 truncate">{status.split(' /')[0]}</p>
                      </div>
                    ))}
                  </div>

                  {selectedStatus && (
                    <div className="mt-6 border-t border-[#222634] pt-6 animate-in slide-in-from-top-2">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs font-black text-[#FF5A00] uppercase tracking-wider">{selectedStatus} Details</h4>
                        <button onClick={() => setSelectedStatus(null)} className="text-[10px] font-bold text-slate-400 hover:text-white bg-[#222634] px-3 py-1.5 rounded-lg transition-colors">CLOSE</button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {currentDrillDownData.map((v: any) => (
                          <div key={v.vehicle_id} className="p-3 border border-[#2B3142] rounded-lg bg-[#161922] flex justify-between items-center">
                            <div><p className="text-sm font-black text-white">{v.vehicle_number}</p><p className="text-[10px] font-bold text-slate-500">{v.truck_type}</p></div>
                            <div className="text-right"><span className="text-[9px] font-bold px-2 py-1 bg-[#1A1F2C] border border-[#2B3142] rounded text-slate-300 shadow-sm">{v.carrying_capacity_tons} MT</span></div>
                          </div>
                        ))}
                        {currentDrillDownData.length === 0 && <p className="text-sm text-slate-500 font-medium col-span-full">No vehicles currently in this status.</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="w-full lg:w-[380px] shrink-0"><LiveAlertsWidget/></div>
            </div>
          )}

          {activeTab === "Operations" && (
            <div className="bg-[#12141C] border border-[#222634] rounded-2xl shadow-sm p-4 sm:p-6 min-h-[60vh] mt-6">
              <div className="flex flex-wrap gap-2 border-b border-[#222634] pb-4 mb-6">
                {opTabs.map((sub) => (
                  <button key={sub} onClick={() => setOpSubTab(sub)} className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${opSubTab === sub ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/20 ring-1 ring-[#FF5A00]" : "bg-[#161922] text-slate-400 hover:text-white hover:bg-[#1A1F2C] border border-[#222634]"}`}>
                    {sub}
                  </button>
                ))}
              </div>
              
              {opSubTab === "Trips" && <TripForm onSuccess={() => fetchDashboardData()} />}
              {opSubTab === "POD Closure" && <PodClosure onSuccess={() => fetchDashboardData()} />}
              {opSubTab === "Modify Trips" && <ModifyTrips />}
              {opSubTab === "Driver Approvals" && <ApprovalQueue/>}
              
              {opSubTab === "Quick Status" && (
                <div className="bg-[#161922] border border-[#222634] rounded-xl p-4 sm:p-6 shadow-sm max-w-2xl animate-in fade-in duration-300">
                  <h3 className="text-xs sm:text-sm font-black text-white mb-6 uppercase tracking-wider border-b border-[#222634] pb-2">Manual Status Override</h3>
                  <form onSubmit={handleQuickStatusSubmit} className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Select Truck</label>
                      <select value={qsTruckId} onChange={(e) => setQsTruckId(e.target.value)} className="w-full text-sm p-3 rounded-lg border border-[#2B3142] bg-[#1A1F2C] focus:border-[#FF5A00] outline-none font-bold text-white">
                        <option value="">Select a vehicle...</option>
                        {liveVehicles.map(v => (<option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number} ({v.carrying_capacity_tons}MT {v.truck_type})</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">New Operational Status</label>
                      <select value={qsStatus} onChange={(e) => setQsStatus(e.target.value)} className="w-full text-sm p-3 rounded-lg border border-[#2B3142] bg-[#1A1F2C] focus:border-[#FF5A00] outline-none font-bold text-white">
                        <option value="WAITING_FOR_LOAD">Plant Loading</option><option value="IN_TRANSIT">In Transit</option><option value="WORKSHOP_MAINTENANCE">Workshop / Repairs</option><option value="DRIVER_UNAVAILABLE">No Driver / Leave</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Location / Breakdown Details</label>
                      <input type="text" value={qsRemarks} onChange={(e) => setQsRemarks(e.target.value)} placeholder="e.g. Broken Down near Erode Toll" className="w-full text-sm p-3 rounded-lg border border-[#2B3142] bg-[#1A1F2C] focus:border-[#FF5A00] outline-none font-semibold text-white" />
                    </div>
                    <button type="submit" className="mt-4 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black py-3 px-6 rounded-lg transition-colors shadow-sm">Update Status</button>
                  </form>
                </div>
              )}
            </div>
          )}
          
          {activeTab === "Fuel & Adv" && <div className="p-4 sm:p-6 mt-6"><FuelAdvanceModule/></div>}
          {activeTab === "Workshop & Tyres" && <div className="p-6 mt-6"><WorkshopModule/></div>}
          {activeTab === "Financials" && <div className="p-6 mt-6"><FinancialsModule/></div>}
          {activeTab === "P&L Statement" && <div className="p-6 mt-6"><ProfitLossModule/></div>}
          {activeTab === "Setup" && <div className="p-6 mt-6"><SetupModule/></div>}
        </div>
      </main>
    </div>
  );
}
