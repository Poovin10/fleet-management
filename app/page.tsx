"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Modular Components
import { TripForm } from "@/components/TripForm";
import { PodClosure } from "@/components/PodClosure";
import { ModifyTrips } from "@/components/ModifyTrips";
import { FuelAdvanceModule } from "@/components/FuelAdvanceModule";
import { FinancialsModule } from "@/components/FinancialsModule";
import { WorkshopModule } from "@/components/WorkshopModule";
import { SetupModule } from "@/components/SetupModule";
import { FleetTable } from "@/components/FleetTable";

export default function SaaS_ERPDashboard() {
  // Authentication States
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<"ADMIN" | "VIEWER" | null>(null);
  
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");

  const [activeTab, setActiveTab] = useState("Dashboard");
  const [opSubTab, setOpSubTab] = useState("Trips");
  
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);

  const [currentMonthText, setCurrentMonthText] = useState("");
  const [currentDateText, setCurrentDateText] = useState("");
  const [liveVehicles, setLiveVehicles] = useState<any[]>([]);
  
  // Real-time KPI States (Current Month + Pending PODs)
  const [monthTripsCount, setMonthTripsCount] = useState<number>(0);
  const [monthFreight, setMonthFreight] = useState<number>(0);
  const [monthDieselCost, setMonthDieselCost] = useState<number>(0);
  const [monthNetRetention, setMonthNetRetention] = useState<number>(0);
  const [activeTripCount, setActiveTripCount] = useState<number>(0); 
  
  // 4 Core Operational Statuses
  const [statusCounts, setStatusCounts] = useState({
    "Plant Loading": 0,
    "In Transit": 0,
    "Workshop / Repairs": 0,
    "No Driver / Leave": 0
  });

  const [qsTruckId, setQsTruckId] = useState("");
  const [qsStatus, setQsStatus] = useState("WAITING_FOR_LOAD");
  const [qsRemarks, setQsRemarks] = useState("");

  // Re-added the missing opTabs array!
  const opTabs = ["Trips", "POD Closure", "Modify Trips", "Quick Status"];

  // Hydrate Authentication from Session Storage to survive reloads
  useEffect(() => {
    const auth = sessionStorage.getItem("kss_auth");
    const role = sessionStorage.getItem("kss_role");
    if (auth === "true" && role) {
      setIsAuthenticated(true);
      setUserRole(role as "ADMIN" | "VIEWER");
    }
    setIsAuthLoading(false);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginUser.toLowerCase() === "admin" && loginPass === "admin123") {
      sessionStorage.setItem("kss_auth", "true");
      sessionStorage.setItem("kss_role", "ADMIN");
      setIsAuthenticated(true);
      setUserRole("ADMIN");
    } else if (loginUser.toLowerCase() === "user" && loginPass === "user123") {
      sessionStorage.setItem("kss_auth", "true");
      sessionStorage.setItem("kss_role", "VIEWER");
      setIsAuthenticated(true);
      setUserRole("VIEWER");
    } else {
      setLoginError("Invalid username or password.");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("kss_auth");
    sessionStorage.removeItem("kss_role");
    setIsAuthenticated(false);
    setUserRole(null);
    setLoginUser("");
    setLoginPass("");
    setActiveTab("Dashboard");
  };

  const extractStatus = (v: any) => String(v.status || v.current_status || v.vehicle_status || v.STATUS || "").trim().toUpperCase();

  const findStringProp = (obj: any, hints: string[]) => {
    if (!obj) return null;
    const keys = Object.keys(obj);
    for (const hint of hints) {
      const foundKey = keys.find(k => k.toLowerCase().includes(hint.toLowerCase()) && k.toLowerCase() !== 'id' && !k.toLowerCase().endsWith('_id'));
      if (foundKey && obj[foundKey] !== null && obj[foundKey] !== '') return obj[foundKey];
    }
    return null;
  };

  const fetchDashboardData = async () => {
    if (!isAuthenticated) return;
    const supabase = createClient();
    
    // 1. Fetch Vehicles & Statuses
    const { data: vehicles } = await supabase.from('vehicles').select('*').eq('is_active', true);
    if (vehicles && vehicles.length > 0) {
      setLiveVehicles(vehicles);
      setStatusCounts({
        "Plant Loading": vehicles.filter(v => extractStatus(v) === 'WAITING_FOR_LOAD' || extractStatus(v) === 'AVAILABLE_FOR_LOAD').length,
        "In Transit": vehicles.filter(v => extractStatus(v) === 'IN_TRANSIT').length,
        "Workshop / Repairs": vehicles.filter(v => extractStatus(v) === 'WORKSHOP_MAINTENANCE').length,
        "No Driver / Leave": vehicles.filter(v => extractStatus(v) === 'DRIVER_UNAVAILABLE').length
      });
    }

    // 2. Fetch Pending PODs
    const { count: activeCount } = await supabase.from('trips').select('*', { count: 'exact', head: true }).neq('trip_status', 'COMPLETED');
    setActiveTripCount(activeCount || 0);

    // 3. Calculate Current Month Financials
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
    if (isAuthenticated) {
      setCurrentMonthText(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
      setCurrentDateText(new Date().toLocaleDateString());
      fetchDashboardData();
    }
  }, [activeTab, isAuthenticated]);

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
    
    const supabase = createClient();
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

  const dieselPct = monthFreight > 0 ? (monthDieselCost / monthFreight) * 100 : 0;
  const retentionPct = monthFreight > 0 ? (monthNetRetention / monthFreight) * 100 : 0;

  // --- RENDER LOGIN SCREEN ---
  if (isAuthLoading) return null; // Prevent hydration flash

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 border border-slate-200">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center shadow-inner mx-auto mb-4">
              <span className="text-white font-black text-xl tracking-tighter">KS</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">KSS Roadways Pvt Ltd</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">ERP Secure Login</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Username</label>
              <input type="text" value={loginUser} onChange={e => setLoginUser(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-orange-500 font-semibold" required />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Password</label>
              <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-orange-500 font-semibold" required />
            </div>
            {loginError && <p className="text-xs font-bold text-rose-500 text-center">{loginError}</p>}
            <button type="submit" className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-black text-sm rounded-xl transition-all shadow-md active:scale-95 mt-2">
              Access System
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Define Navigation based on Role
  const allNavItems = ["Dashboard", "Operations", "Fuel & Adv", "Workshop & Tyres", "Financials", "Setup"];
  const navItems = userRole === "ADMIN" ? allNavItems : ["Dashboard", "Financials"];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-orange-100 selection:text-orange-900">
      
      {/* SaaS Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center shadow-inner">
              <span className="text-white font-black text-sm tracking-tighter">KS</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-orange-600 hidden sm:block">KSS Roadways Pvt Ltd</h1>
            <h1 className="text-lg font-black tracking-tight text-orange-600 sm:hidden">KSS Roadways</h1>
            
            <span className="items-center px-2.5 py-1 rounded-md text-[9px] sm:text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wider">
              Cochin Branch
            </span>
            
            <span className={`hidden md:inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${userRole === 'ADMIN' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
              {userRole === 'ADMIN' ? '👑 Admin' : '👁️ Viewer'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm font-bold text-slate-500">Fleet: <span className="text-slate-900">{liveVehicles.length}</span></span>
            <div className="h-5 w-px bg-slate-200"></div>
            
            {/* Modern Signout Button */}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span className="hidden sm:block">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Navigation Bar */}
        <nav className="flex flex-wrap space-x-1 space-y-1 sm:space-y-0 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shadow-sm w-fit">
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => setActiveTab(item)}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 ease-out ${
                activeTab === item ? "bg-white text-orange-600 shadow-sm ring-1 ring-slate-900/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        {/* Dynamic Content Canvas */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out">
          
          {activeTab === "Dashboard" && (
            <div className="space-y-6">
              
              {/* CURRENT MONTH OPERATIONS SUMMARY */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Operations Summary</h3>
                  <span className="px-3 py-1 bg-orange-50 text-orange-700 text-xs font-bold rounded-full border border-orange-100">
                    {currentMonthText.toUpperCase()}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Trips Taken</p>
                      <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{monthTripsCount}</p>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">PODs Pending</p>
                      <p className="text-2xl sm:text-3xl font-black text-rose-900 mt-2">{activeTripCount}</p>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Freight Generated</p>
                      <p className="text-2xl sm:text-3xl font-black text-emerald-700 mt-2">
                        ₹ {monthFreight.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="mt-3">
                      <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-md">
                        Diesel Cost: ₹ {monthDieselCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({dieselPct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-xl bg-indigo-600 text-white shadow-md flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider">Net Retention (Margin)</p>
                      <p className="text-2xl sm:text-3xl font-black mt-2">
                        ₹ {monthNetRetention.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="mt-3">
                      <span className="inline-flex items-center text-[10px] font-bold text-white bg-indigo-500/80 px-2.5 py-1 rounded-md">
                        Retention: {retentionPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* VEHICLE STATUS INTERACTIVE MONITOR */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                <h3 className="text-sm font-black text-slate-900 mb-4 uppercase tracking-wide">Live Vehicle Status Monitor</h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Plant Loading", count: statusCounts["Plant Loading"], color: "bg-amber-50 text-amber-700 border-amber-200" },
                    { label: "In Transit", count: statusCounts["In Transit"], color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                    { label: "Workshop / Repairs", count: statusCounts["Workshop / Repairs"], color: "bg-rose-50 text-rose-700 border-rose-200" },
                    { label: "No Driver / Leave", count: statusCounts["No Driver / Leave"], color: "bg-slate-100 text-slate-700 border-slate-300" }
                  ].map((status) => (
                    <button
                      key={status.label}
                      onClick={() => setSelectedStatus(selectedStatus === status.label ? null : status.label)}
                      className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                        selectedStatus === status.label ? `ring-2 ring-offset-2 ring-orange-500 ${status.color}` : `bg-white hover:bg-slate-50 ${status.color.replace('bg-', 'hover:bg-').split(' ')[0]} border-slate-200`
                      }`}
                    >
                      <p className="text-4xl font-black mb-1">{status.count}</p>
                      <p className="text-xs font-bold uppercase tracking-wider opacity-80">{status.label}</p>
                    </button>
                  ))}
                </div>

                {/* DYNAMIC DRILL-DOWN TABLE WITH AGING/DAYS */}
                {selectedStatus && (
                  <div className="mt-6 border-t border-slate-100 pt-6 animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold text-slate-900">
                        Trucks currently in: <span className="text-orange-600">{selectedStatus}</span>
                      </h4>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase">Truck No.</th>
                            <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase">Remarks</th>
                            <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase">Aging</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {currentDrillDownData.map((truck, idx) => {
                            const truckNo = findStringProp(truck, ["veh", "truck", "reg", "plate", "number"]) || `Truck ${truck.id}`;
                            const remarks = truck.status_remarks || "-";
                            const targetDate = truck.status_updated_at || truck.updated_at || new Date();
                            const daysDiff = Math.floor((new Date().getTime() - new Date(targetDate).getTime()) / (1000 * 3600 * 24));
                            const daysText = daysDiff === 0 ? "Today" : `${daysDiff} Days`;
                            const badgeColor = daysDiff > 3 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700";

                            return (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{truckNo}</td>
                                <td className="px-6 py-4 text-sm font-semibold text-slate-500">{remarks}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span className={`px-3 py-1 rounded-md font-black text-[10px] uppercase ${badgeColor}`}>
                                    {daysText}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          {currentDrillDownData.length === 0 && (
                            <tr><td colSpan={3} className="px-6 py-8 text-center text-sm font-bold text-slate-500">No detailed records found for this status.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RENDER OTHER MODULES WITH ROLE PROTECTION */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6">
            
            {activeTab === "Operations" && userRole === "ADMIN" && (
              <div className="p-6 min-h-[60vh]">
                <div className="flex flex-wrap gap-6 border-b border-slate-200 mb-6">
                  {opTabs.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setOpSubTab(sub)}
                      className={`pb-3 text-sm font-bold transition-all duration-200 border-b-2 ${opSubTab === sub ? "border-orange-600 text-orange-600" : "border-transparent text-slate-500 hover:text-slate-900"}`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
                
                {opSubTab === "Trips" && <TripForm onSuccess={() => fetchDashboardData()} />}
                {opSubTab === "POD Closure" && <PodClosure onSuccess={() => fetchDashboardData()} />}
                {opSubTab === "Modify Trips" && <ModifyTrips onSuccess={() => fetchDashboardData()} />}
                
                {opSubTab === "Quick Status" && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm max-w-2xl">
                    <h3 className="text-sm font-black text-slate-900 mb-6 uppercase tracking-wider border-b border-slate-200 pb-2">Manual Status Override</h3>
                    <form onSubmit={handleQuickStatusSubmit} className="space-y-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Select Truck</label>
                        <select 
                          value={qsTruckId} 
                          onChange={(e) => setQsTruckId(e.target.value)} 
                          className="w-full text-sm p-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-orange-500 outline-none font-bold"
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
                          className="w-full text-sm p-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-orange-500 outline-none font-bold"
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
                          className="w-full text-sm p-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-orange-500 outline-none font-semibold" 
                        />
                      </div>
                      <button type="submit" className="mt-4 bg-orange-600 hover:bg-orange-700 text-white font-black py-3 px-6 rounded-lg transition-colors shadow-sm">
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
            {activeTab === "Setup" && userRole === "ADMIN" && <div className="p-6"><SetupModule /></div>}
            
          </div>
        </div>
      </main>

      {/* FULL SCREEN MODAL OVERLAY */}
      {showFullReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-black text-slate-900">Detailed Truck Status Report</h2>
                <p className="text-sm text-slate-500 mt-1 font-bold">Full fleet overview as of {currentDateText}</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowFullReport(false)} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <FleetTable />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
