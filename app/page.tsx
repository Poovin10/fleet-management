"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Modular Components
import { TripForm } from "@/components/TripForm";
import { PodClosure } from "@/components/PodClosure";
import { ModifyTrips } from "@/components/ModifyTrips";
import { FuelAdvanceModule } from "@/components/FuelAdvanceModule";
import { FinancialsModule } from "@/components/FinancialsModule";
import { ProfitLossModule } from "@/components/ProfitLossModule";
import { WorkshopModule } from "@/components/WorkshopModule";
import { SetupModule } from "@/components/SetupModule";
import { FleetTable } from "@/components/FleetTable";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ApprovalQueue } from "@/components/ApprovalQueue";
import { DriverPortal } from "@/components/DriverPortal";

const KssLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="200" height="200" fill="#FF5A00" />
    <rect x="15" y="15" width="170" height="170" fill="#FFFFFF" />
    <path d="M 50 35 L 50 165" stroke="#FF5A00" strokeWidth="24" strokeLinecap="square" />
    <path d="M 50 110 L 140 35" stroke="#FF5A00" strokeWidth="24" strokeLinecap="square" />
    <path d="M 85 85 C 130 95, 145 130, 145 165" stroke="#FF5A00" strokeWidth="24" fill="none" />
  </svg>
);

export default function SaaS_ERPDashboard() {
  const supabase = createClient();

  // --- DRIVER PORTAL ROUTING STATE ---
  const [isDriverRoute, setIsDriverRoute] = useState(false);
  const [isCheckingRoute, setIsCheckingRoute] = useState(true);

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<"ADMIN" | "VIEWER">("VIEWER");
  const [showLoginScreen, setShowLoginScreen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
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
  
  const [expiringDocs, setExpiringDocs] = useState<any[]>([]);
  
  const [statusCounts, setStatusCounts] = useState({
    "Plant Loading": 0,
    "In Transit": 0,
    "Workshop / Repairs": 0,
    "No Driver / Leave": 0
  });

  const [qsTruckId, setQsTruckId] = useState("");
  const [qsStatus, setQsStatus] = useState("WAITING_FOR_LOAD");
  const [qsRemarks, setQsRemarks] = useState("");

  const opTabs = ["Trips", "POD Closure", "Modify Trips", "Quick Status", "Driver Approvals"];

  const formatAmt = (amt: number) => {
    return (Number(amt) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // --- CHECK URL FOR DRIVER ROUTE ON LOAD ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.pathname.startsWith('/driver')) {
        setIsDriverRoute(true);
      }
    }
    setIsCheckingRoute(false);
  }, []);

  useEffect(() => {
    const auth = sessionStorage.getItem("kss_auth");
    const role = sessionStorage.getItem("kss_role");
    if (auth === "true" && role === "ADMIN") {
      setIsAuthenticated(true);
      setUserRole("ADMIN");
    } else {
      setUserRole("VIEWER");
    }
    setIsAuthLoading(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUser.trim() || !loginPass.trim()) return;

    setIsLoggingIn(true);
    setLoginError("");

    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', loginUser.trim().toLowerCase())
        .eq('password', loginPass.trim())
        .single();

      if (error || !data) {
        setLoginError("Invalid username or password.");
      } else {
        sessionStorage.setItem("kss_auth", "true");
        sessionStorage.setItem("kss_role", data.role);
        sessionStorage.setItem("kss_username", data.username);
        setIsAuthenticated(true);
        setUserRole(data.role as "ADMIN" | "VIEWER");
        setShowLoginScreen(false);
        setLoginUser("");
        setLoginPass("");
      }
    } catch (err) {
      setLoginError("Database authentication error. Please try again.");
    }
    setIsLoggingIn(false);
  };

  const executeLogout = () => {
    sessionStorage.removeItem("kss_auth");
    sessionStorage.removeItem("kss_role");
    sessionStorage.removeItem("kss_username");
    setIsAuthenticated(false);
    setUserRole("VIEWER");
    setLoginUser("");
    setLoginPass("");
    setActiveTab("Dashboard");
    setIsLogoutModalOpen(false);
  };

  const extractStatus = (v: any) => String(v.status || v.current_status || v.vehicle_status || v.STATUS || "").trim().toUpperCase();

  const fetchDashboardData = async () => {
    const { data: vehiclesData } = await supabase.from('vehicles').select('*').eq('is_active', true);
    if (vehiclesData && vehiclesData.length > 0) {
      setLiveVehicles(vehiclesData);
      setStatusCounts({
        "Plant Loading": vehiclesData.filter(v => extractStatus(v) === 'WAITING_FOR_LOAD' || extractStatus(v) === 'AVAILABLE_FOR_LOAD').length,
        "In Transit": vehiclesData.filter(v => extractStatus(v) === 'IN_TRANSIT').length,
        "Workshop / Repairs": vehiclesData.filter(v => extractStatus(v) === 'WORKSHOP_MAINTENANCE').length,
        "No Driver / Leave": vehiclesData.filter(v => extractStatus(v) === 'DRIVER_UNAVAILABLE').length
      });
    }

    const { count: activeCount } = await supabase.from('trips').select('*', { count: 'exact', head: true }).neq('trip_status', 'COMPLETED');
    setActiveTripCount(activeCount || 0);

    const { count: driverPendingCount } = await supabase
      .from('driver_pending_entries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');
    
    setPendingDriverCount(driverPendingCount || 0);

    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const alerts: any[] = [];

    const { data: drivers } = await supabase.from('drivers').select('driver_code, full_name, expiry_date').eq('is_active', true);
    if (drivers) {
      drivers.forEach(d => {
        if (d.expiry_date && new Date(d.expiry_date) <= thirtyDaysFromNow) {
          alerts.push({ name: `${d.driver_code} - ${d.full_name}`, doc: "Driving License", date: d.expiry_date });
        }
      });
    }

    const { data: vehicles } = await supabase.from('vehicles').select('vehicle_number, truck_type, fc_expiry_date, insurance_expiry_date, qtax_expiry_date, puc_expiry_date, np_expiry_date, state_permit_expiry_date, tank_cert_expiry_date').eq('is_active', true);
    if (vehicles) {
      vehicles.forEach(v => {
        const checkDoc = (docName: string, dateVal: string) => {
          if (dateVal && new Date(dateVal) <= thirtyDaysFromNow) {
            alerts.push({ name: `Truck ${v.vehicle_number}`, doc: docName, date: dateVal });
          }
        };
        checkDoc("FC Test", v.fc_expiry_date);
        checkDoc("Insurance", v.insurance_expiry_date);
        checkDoc("Quarterly Tax", v.qtax_expiry_date);
        checkDoc("PUC Certificate", v.puc_expiry_date);
        checkDoc("National Permit", v.np_expiry_date);
        checkDoc("State Permit", v.state_permit_expiry_date);
        if (String(v.truck_type).toUpperCase().includes("BULK")) {
          checkDoc("Tank / Pressure Cert", v.tank_cert_expiry_date);
        }
      });
    }

    setExpiringDocs(alerts);

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

      monthTrips.forEach(t => {
        totalFreight += Number(t.freight_revenue) || 0;
        nonFuelExpenses += (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0) + (Number(t.enroute_repairs_maintenance) || 0);
      });
      monthDiesel.forEach(d => { totalDieselCost += Number(d.total_fuel_cost) || 0; });

      setMonthFreight(totalFreight);
      setMonthDieselCost(totalDieselCost);
      setMonthNetRetention(totalFreight - totalDieselCost - nonFuelExpenses);
    }
  };

  useEffect(() => {
    setCurrentMonthText(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
    fetchDashboardData();
  }, [activeTab]);

  const getDrillDownData = (statusLabel: string) => {
    const statusMap: Record<string, string[]> = {
      "Plant Loading": ["WAITING_FOR_LOAD", "AVAILABLE_FOR_LOAD"],
      "In Transit": ["IN_TRANSIT"],
      "Workshop / Repairs": ["WORKSHOP_MAINTENANCE"],
      "No Driver / Leave": ["DRIVER_UNAVAILABLE"]
    };
    const dbStatuses = statusMap[statusLabel] || [];
    return liveVehicles.filter(v => dbStatuses.includes(extractStatus(v)));
  };

  const currentDrillDownData = selectedStatus ? getDrillDownData(selectedStatus) : [];

  const handleQuickStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qsTruckId) return alert("Please select a truck.");
    
    const { error } = await supabase.from('vehicles')
      .update({ 
        current_status: qsStatus, 
        status_remarks: qsRemarks,
        status_updated_at: new Date().toISOString()
      })
      .eq('vehicle_id', qsTruckId);

    if (error) alert("Error updating status: " + error.message);
    else {
      alert("Vehicle status updated successfully!");
      setQsTruckId(""); setQsRemarks("");
      fetchDashboardData();
    }
  };

  // ==========================================
  // VIEW 1: PUBLIC DRIVER PORTAL
  // ==========================================
  if (isCheckingRoute) return <div className="min-h-screen bg-slate-900" />;
  
  if (isDriverRoute) {
    return (
      <div className="min-h-screen bg-slate-900 py-6 px-4" style={{ colorScheme: 'light' }}>
        <div className="max-w-md mx-auto mb-6 text-center">
          <h1 className="text-xl font-black text-white">KSS Roadways</h1>
          <p className="text-xs text-[#FF5A00] uppercase tracking-widest font-bold">Driver Highway Portal</p>
        </div>
        <DriverPortal />
      </div>
    );
  }

  // ==========================================
  // VIEW 2: LOGIN GATE
  // ==========================================
  if (isAuthLoading) return null;

  if (showLoginScreen && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#FF5A00]/30 rounded-full mix-blend-screen filter blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="relative bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl w-full max-w-md p-10 border border-white/20">
          <div className="text-center mb-10">
            <div className="mx-auto mb-6 w-24 h-24 shadow-md rounded-2xl overflow-hidden border border-slate-200">
               <KssLogo className="w-full h-full" />
            </div>
            <div className="inline-block bg-slate-900 px-4 py-2 rounded-xl shadow-sm mb-3">
              <h1 className="text-2xl sm:text-3xl font-black text-[#FF5A00] tracking-tight leading-none">KSS Roadways</h1>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Database Secure Login</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2 ml-1">Username</label>
              <input type="text" value={loginUser} onChange={e => setLoginUser(e.target.value)} className="w-full text-base p-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#FF5A00] font-semibold bg-slate-50 transition-all hover:bg-white" required />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2 ml-1">Password</label>
              <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full text-base p-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-[#FF5A00] font-semibold bg-slate-50 transition-all hover:bg-white" required />
            </div>
            {loginError && <p className="text-sm font-bold text-rose-500 text-center bg-rose-50 p-3 rounded-xl">{loginError}</p>}
            
            <div className="pt-2">
              <button type="submit" disabled={isLoggingIn} className="w-full py-4 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-lg rounded-2xl transition-all shadow-[0_8px_30px_rgba(255,90,0,0.3)] active:scale-95 disabled:bg-slate-300">
                {isLoggingIn ? "Verifying..." : "Log In"}
              </button>
              <button type="button" onClick={() => setShowLoginScreen(false)} className="w-full py-4 text-slate-500 hover:text-slate-900 font-bold text-sm transition-colors mt-2">
                &larr; Back to Public Dashboard
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: MAIN ERP DASHBOARD
  // ==========================================
  const allNavItems = ["Dashboard", "Operations", "Fuel & Adv", "Workshop & Tyres", "Financials", "P&L Statement", "Setup"];
  const navItems = userRole === "ADMIN" ? allNavItems : ["Dashboard", "Financials", "P&L Statement"];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-[#FF5A00]/20 selection:text-[#FF5A00] relative">
      <ConfirmModal 
        isOpen={isLogoutModalOpen}
        title="Secure Sign Out"
        message="Are you sure you want to log out of the KSS Roadways ERP system?"
        isDanger={true}
        confirmText="Log Out Now"
        onConfirm={executeLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
      />

      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl shadow-sm border border-slate-100 overflow-hidden flex-shrink-0">
               <KssLogo className="w-full h-full" />
            </div>
            <div className="bg-slate-900 px-3 py-1.5 rounded-lg shadow-sm">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-[#FF5A00] hidden sm:block leading-none">KSS Roadways Pvt Ltd</h1>
              <h1 className="text-base font-black tracking-tight text-[#FF5A00] sm:hidden leading-none">KSS Roadways</h1>
            </div>
            <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[9px] sm:text-[11px] font-black bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-widest whitespace-nowrap">
              Cochin
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs sm:text-sm font-bold text-slate-500 hidden md:block">Fleet: <span className="text-slate-900">{liveVehicles.length}</span></span>
            <div className="h-5 w-px bg-slate-200 hidden md:block"></div>
            
            {isAuthenticated ? (
              <button 
                onClick={() => setIsLogoutModalOpen(true)}
                className="flex items-center gap-2 text-sm font-black text-slate-600 hover:text-rose-700 hover:bg-rose-50 px-5 py-2.5 rounded-xl transition-all border border-slate-200 hover:border-rose-200 shadow-sm"
              >
                <span>Sign out</span>
              </button>
            ) : (
              <button 
                onClick={() => setShowLoginScreen(true)}
                className="flex items-center gap-2 text-sm font-black text-white hover:bg-[#e04f00] bg-[#FF5A00] px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
              >
                <span>Admin Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <nav className="flex flex-wrap space-x-1 space-y-1 sm:space-y-0 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shadow-sm w-fit">
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => setActiveTab(item)}
              className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ease-out ${
                activeTab === item ? "bg-white text-[#FF5A00] shadow-sm ring-1 ring-slate-900/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out">
          
          {activeTab === "Dashboard" && (
            <div className="space-y-6">
              
              {pendingDriverCount > 0 && (
                <div className="bg-amber-50 border-l-4 border-amber-500 rounded-2xl shadow-sm p-5 animate-in slide-in-from-top-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📥</span>
                    <div>
                      <h3 className="text-sm font-black text-amber-900 uppercase tracking-wide">Pending Driver Approvals</h3>
                      <p className="text-xs text-amber-700 mt-0.5">There are <span className="font-black">{pendingDriverCount}</span> fuel bills waiting for manager review in Operations.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setActiveTab("Operations"); setOpSubTab("Driver Approvals"); }} 
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition-colors shadow-sm"
                  >
                    Review Queue &rarr;
                  </button>
                </div>
              )}

              {expiringDocs.length > 0 && (
                <div className="bg-rose-50 border-l-4 border-rose-500 rounded-2xl shadow-sm p-5 animate-in slide-in-from-top-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">🚨</span>
                    <h3 className="text-sm font-black text-rose-900 uppercase tracking-wide">Action Required: Compliance Alerts</h3>
                  </div>
                  <div className="overflow-x-auto w-full">
                    <table className="min-w-full text-xs text-left whitespace-nowrap">
                      <thead className="text-rose-700 uppercase font-bold">
                        <tr><th className="pb-2 pr-4">Asset / Entity</th><th className="pb-2 pr-4">Document / Permit</th><th className="pb-2">Expiry Date</th></tr>
                      </thead>
                      <tbody className="divide-y divide-rose-200/50">
                        {expiringDocs.map((d, idx) => {
                          const isExpired = new Date(d.date) < new Date();
                          return (
                            <tr key={idx}>
                              <td className="py-2 pr-4 font-bold text-slate-900">{d.name}</td>
                              <td className="py-2 pr-4 font-semibold text-slate-700">{d.doc}</td>
                              <td className={`py-2 font-black ${isExpired ? 'text-rose-600' : 'text-amber-600'}`}>
                                {d.date} {isExpired ? '(EXPIRED)' : '(Expiring Soon)'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Operations Summary</h3>
                  <span className="px-3 py-1 bg-[#FF5A00]/10 text-[#FF5A00] text-xs font-bold rounded-full border border-[#FF5A00]/20">
                    {currentMonthText.toUpperCase()}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Trips</p>
                      <p className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 mt-1 sm:mt-2">{monthTripsCount}</p>
                    </div>
                  </div>
                  
                  <div className="p-3 sm:p-4 rounded-xl bg-rose-50 border border-rose-200 flex flex-col justify-between">
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-bold text-rose-700 uppercase tracking-wider">PODs Pending</p>
                      <p className="text-lg sm:text-2xl lg:text-3xl font-black text-rose-900 mt-1 sm:mt-2">{activeTripCount}</p>
                    </div>
                  </div>
                  
                  <div className="p-3 sm:p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col justify-between">
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Freight Gen.</p>
                      <p className="text-[15px] sm:text-xl lg:text-2xl font-black text-emerald-700 mt-1 sm:mt-2 tracking-tight">
                        ₹{formatAmt(monthFreight)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-3 sm:p-4 rounded-xl bg-slate-900 text-white shadow-md flex flex-col justify-between">
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Retention</p>
                      <p className="text-[15px] sm:text-xl lg:text-2xl font-black text-[#FF5A00] mt-1 sm:mt-2 tracking-tight">
                        ₹{formatAmt(monthNetRetention)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* LIVE VEHICLE STATUS MONITOR */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 mt-6">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-6">Live Vehicle Status Monitor</h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div 
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedStatus === 'Plant Loading' ? 'border-[#FF5A00] ring-2 ring-[#FF5A00]/20 bg-[#FF5A00]/5' : 'border-slate-200 hover:border-[#FF5A00]/50'}`}
                    onClick={() => setSelectedStatus(selectedStatus === 'Plant Loading' ? null : 'Plant Loading')}
                  >
                    <p className="text-3xl sm:text-4xl font-black text-slate-900">{statusCounts["Plant Loading"]}</p>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Plant Loading</p>
                  </div>
                  
                  <div 
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedStatus === 'In Transit' ? 'border-[#FF5A00] ring-2 ring-[#FF5A00]/20 bg-[#FF5A00]/5' : 'border-slate-200 hover:border-[#FF5A00]/50'}`}
                    onClick={() => setSelectedStatus(selectedStatus === 'In Transit' ? null : 'In Transit')}
                  >
                    <p className="text-3xl sm:text-4xl font-black text-slate-900">{statusCounts["In Transit"]}</p>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">In Transit</p>
                  </div>
                  
                  <div 
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedStatus === 'Workshop / Repairs' ? 'border-[#FF5A00] ring-2 ring-[#FF5A00]/20 bg-[#FF5A00]/5' : 'border-slate-200 hover:border-[#FF5A00]/50'}`}
                    onClick={() => setSelectedStatus(selectedStatus === 'Workshop / Repairs' ? null : 'Workshop / Repairs')}
                  >
                    <p className="text-3xl sm:text-4xl font-black text-slate-900">{statusCounts["Workshop / Repairs"]}</p>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Workshop</p>
                  </div>
                  
                  <div 
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedStatus === 'No Driver / Leave' ? 'border-[#FF5A00] ring-2 ring-[#FF5A00]/20 bg-[#FF5A00]/5' : 'border-slate-200 hover:border-[#FF5A00]/50'}`}
                    onClick={() => setSelectedStatus(selectedStatus === 'No Driver / Leave' ? null : 'No Driver / Leave')}
                  >
                    <p className="text-3xl sm:text-4xl font-black text-slate-900">{statusCounts["No Driver / Leave"]}</p>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">No Driver</p>
                  </div>
                </div>

                {selectedStatus && (
                  <div className="mt-6 border-t border-slate-200 pt-6 animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-xs font-black text-[#FF5A00] uppercase tracking-wider">
                        {selectedStatus} Details
                      </h4>
                      <button onClick={() => setSelectedStatus(null)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors">CLOSE</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {currentDrillDownData.map(v => (
                        <div key={v.vehicle_id} className="p-3 border border-slate-200 rounded-lg bg-slate-50 flex justify-between items-center">
                          <div>
                            <p className="text-sm font-black text-slate-900">{v.vehicle_number}</p>
                            <p className="text-[10px] font-bold text-slate-500">{v.truck_type}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-bold px-2 py-1 bg-white border border-slate-200 rounded text-slate-600 shadow-sm">
                              {v.carrying_capacity_tons} MT
                            </span>
                          </div>
                        </div>
                      ))}
                      {currentDrillDownData.length === 0 && (
                        <p className="text-sm text-slate-500 font-medium col-span-full">No vehicles currently in this status.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6" style={{ colorScheme: 'light' }}>
            {activeTab === "Operations" && userRole === "ADMIN" && (
              <div className="p-6 min-h-[60vh]">
                <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4 mb-6">
                  {opTabs.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setOpSubTab(sub)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        opSubTab === sub 
                          ? "bg-[#FF5A00] text-white shadow-sm ring-1 ring-[#FF5A00]" 
                          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
                
                {opSubTab === "Trips" && <TripForm onSuccess={() => fetchDashboardData()} />}
                {opSubTab === "POD Closure" && <PodClosure onSuccess={() => fetchDashboardData()} />}
                {opSubTab === "Modify Trips" && <ModifyTrips onSuccess={() => fetchDashboardData()} />}
                {opSubTab === "Driver Approvals" && <ApprovalQueue />}
                
                {opSubTab === "Quick Status" && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm max-w-2xl animate-in fade-in duration-300">
                    <h3 className="text-sm font-black text-slate-900 mb-6 uppercase tracking-wider border-b border-slate-200 pb-2">Manual Status Override</h3>
                    <form onSubmit={handleQuickStatusSubmit} className="space-y-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Select Truck</label>
                        <select 
                          value={qsTruckId} 
                          onChange={(e) => setQsTruckId(e.target.value)} 
                          className="w-full text-sm p-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-[#FF5A00] outline-none font-bold"
                        >
                          <option value="">Select a vehicle...</option>
                          {liveVehicles.map(v => (
                            <option key={v.vehicle_id} value={v.vehicle_id}>
                              {v.vehicle_number} ({v.carrying_capacity_tons}MT {v.truck_type})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">New Operational Status</label>
                        <select 
                          value={qsStatus} 
                          onChange={(e) => setQsStatus(e.target.value)} 
                          className="w-full text-sm p-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-[#FF5A00] outline-none font-bold"
                        >
                          <option value="WAITING_FOR_LOAD">Plant Loading</option>
                          <option value="IN_TRANSIT">In Transit</option>
                          <option value="WORKSHOP_MAINTENANCE">Workshop / Repairs</option>
                          <option value="DRIVER_UNAVAILABLE">No Driver / Leave</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Location / Breakdown Details</label>
                        <input 
                          type="text" 
                          value={qsRemarks} 
                          onChange={(e) => setQsRemarks(e.target.value)} 
                          placeholder="e.g. Broken Down near Erode Toll" 
                          className="w-full text-sm p-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-[#FF5A00] outline-none font-semibold" 
                        />
                      </div>
                      <button type="submit" className="mt-4 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black py-3 px-6 rounded-lg transition-colors shadow-sm">
                        Update Status
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === "Fuel & Adv" && userRole === "ADMIN" && <div className="p-6"><FuelAdvanceModule /></div>}
            {activeTab === "Workshop & Tyres" && userRole === "ADMIN" && <div className="p-6"><WorkshopModule /></div>}
            {activeTab === "Financials" && <div className="p-6"><FinancialsModule /></div>}
            {activeTab === "P&L Statement" && <div className="p-6"><ProfitLossModule /></div>}
            {activeTab === "Setup" && userRole === "ADMIN" && <div className="p-6"><SetupModule /></div>}
          </div>
        </div>
      </main>
    </div>
  );
}
