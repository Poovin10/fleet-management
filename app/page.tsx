"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

import { TripForm } from "@/components/TripForm";
import { PodClosure } from "@/components/PodClosure";
import { DriverSettlementModule } from "@/components/DriverSettlementModule";
import { FuelAdvanceModule } from "@/components/FuelAdvanceModule";
import { FinancialsModule } from "@/components/FinancialsModule";
import { WorkshopModule } from "@/components/WorkshopModule";
import { SetupModule } from "@/components/SetupModule";
import { FleetTable } from "@/components/FleetTable";

export default function SaaS_ERPDashboard() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [opSubTab, setOpSubTab] = useState("Trips");
  
  // Interactive Dashboard States
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);

  // Data States
  const [currentMonthText, setCurrentMonthText] = useState("");
  const [currentDateText, setCurrentDateText] = useState("");
  const [liveVehicles, setLiveVehicles] = useState<any[]>([]);
  
  const [statusCounts, setStatusCounts] = useState({
    "In Transit": 0,
    "Ready / Available": 0,
    "Plant Loading": 0,
    "Workshop / Repairs": 0,
    "No Driver / Leave": 0
  });

  const navItems = ["Dashboard", "Operations", "Fuel & Adv", "Workshop & Tyres", "Financials", "Setup"];
  
  // Added "Modify Trips" and "Quick Status" back to Operations
  const opTabs = ["Trips", "POD Closure", "Modify Trips", "Quick Status", "Settlements"];

  useEffect(() => {
    setCurrentMonthText(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
    setCurrentDateText(new Date().toLocaleDateString());

    async function fetchDashboardData() {
      const supabase = createClient();
      
      // Fetch live vehicle data to power the dashboard monitor
      const { data: vehicles } = await supabase.from('vehicles').select('*');
      
      if (vehicles) {
        setLiveVehicles(vehicles);
        
        // Calculate dynamic counts based on real Supabase data
        setStatusCounts({
          "In Transit": vehicles.filter(v => v.status === 'IN_TRANSIT').length,
          "Ready / Available": vehicles.filter(v => v.status === 'AVAILABLE_FOR_LOAD').length,
          "Plant Loading": vehicles.filter(v => v.status === 'PLANT_LOADING').length,
          "Workshop / Repairs": vehicles.filter(v => v.status === 'WORKSHOP_MAINTENANCE').length,
          "No Driver / Leave": vehicles.filter(v => v.status === 'NO_DRIVER').length
        });
      }
    }
    fetchDashboardData();
  }, []);

  // Helper function to map UI labels to Database statuses for the drill-down
  const getDrillDownData = (statusLabel: string) => {
    const statusMap: Record<string, string> = {
      "In Transit": "IN_TRANSIT",
      "Ready / Available": "AVAILABLE_FOR_LOAD",
      "Plant Loading": "PLANT_LOADING",
      "Workshop / Repairs": "WORKSHOP_MAINTENANCE",
      "No Driver / Leave": "NO_DRIVER"
    };
    const dbStatus = statusMap[statusLabel];
    return liveVehicles.filter(v => v.status === dbStatus);
  };

  const currentDrillDownData = selectedStatus ? getDrillDownData(selectedStatus) : [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* SaaS Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-inner">
              <span className="text-white font-bold text-sm tracking-tighter">KS</span>
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">KSS Roadways</h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wide">
              Production
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-700">Active Fleet: 26 Units</span>
            <div className="h-4 w-px bg-slate-200"></div>
            <button className="text-sm font-semibold text-slate-700 hover:text-indigo-600 transition-colors">Sign out</button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Navigation Bar */}
        <nav className="flex space-x-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shadow-sm w-fit">
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => setActiveTab(item)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ease-out ${
                activeTab === item ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
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
                  <h3 className="text-sm font-bold text-slate-900">Operations Summary</h3>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100">
                    {currentMonthText || "Current Month"} Only
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Trips Initiated</p>
                    <p className="text-3xl font-black text-slate-900 mt-2">14</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tonnage Dispatched</p>
                    <p className="text-3xl font-black text-indigo-600 mt-2">485.5 <span className="text-lg text-indigo-400">MT</span></p>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 relative overflow-hidden">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Freight Generated</p>
                    <p className="text-3xl font-black text-emerald-900 mt-2">₹1,82,450</p>
                  </div>
                </div>
              </div>

              {/* VEHICLE STATUS INTERACTIVE MONITOR */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Live Vehicle Status Monitor</h3>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: "In Transit", count: statusCounts["In Transit"], color: "bg-blue-50 text-blue-700 border-blue-200" },
                    { label: "Ready / Available", count: statusCounts["Ready / Available"], color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                    { label: "Plant Loading", count: statusCounts["Plant Loading"], color: "bg-amber-50 text-amber-700 border-amber-200" },
                    { label: "Workshop / Repairs", count: statusCounts["Workshop / Repairs"], color: "bg-rose-50 text-rose-700 border-rose-200" },
                    { label: "No Driver / Leave", count: statusCounts["No Driver / Leave"], color: "bg-slate-100 text-slate-700 border-slate-300" }
                  ].map((status) => (
                    <button
                      key={status.label}
                      onClick={() => setSelectedStatus(selectedStatus === status.label ? null : status.label)}
                      className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                        selectedStatus === status.label ? `ring-2 ring-offset-2 ring-slate-900 ${status.color}` : `bg-white hover:bg-slate-50 ${status.color.replace('bg-', 'hover:bg-').split(' ')[0]} border-slate-200`
                      }`}
                    >
                      <p className="text-3xl font-black mb-1">{status.count}</p>
                      <p className="text-xs font-bold uppercase tracking-wider opacity-80">{status.label}</p>
                    </button>
                  ))}
                </div>

                {/* DYNAMIC DRILL-DOWN TABLE */}
                {selectedStatus && (
                  <div className="mt-6 border-t border-slate-100 pt-6 animate-in slide-in-from-top-4 fade-in duration-300">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold text-slate-900">
                        Trucks currently in: <span className="text-indigo-600">{selectedStatus}</span>
                      </h4>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Truck No.</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Type / Capacity</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {currentDrillDownData.map((truck, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{truck.vehicle_no}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{truck.variant} ({truck.capacity_tons} MT)</td>
                              <td className="px-6 py-4 text-sm text-slate-500">{truck.remarks || "-"}</td>
                            </tr>
                          ))}
                          {currentDrillDownData.length === 0 && (
                            <tr><td colSpan={3} className="px-6 py-8 text-center text-sm text-slate-500">No detailed records found for this status.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Open Full Report Button */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                  <button 
                    onClick={() => setShowFullReport(true)}
                    className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    View Detailed Truck Status Report 
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RENDER OTHER MODULES */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6">
            {activeTab === "Operations" && (
              <div className="p-6 min-h-[60vh]">
                <div className="flex flex-wrap gap-6 border-b border-slate-200 mb-6">
                  {opTabs.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setOpSubTab(sub)}
                      className={`pb-3 text-sm font-bold transition-all duration-200 border-b-2 ${opSubTab === sub ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-900"}`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
                
                {opSubTab === "Trips" && <TripForm onSuccess={() => {}} />}
                {opSubTab === "POD Closure" && <PodClosure onSuccess={() => {}} />}
                {opSubTab === "Settlements" && <DriverSettlementModule />}
                
                {/* NEW: Modify Trips Placeholder */}
                {opSubTab === "Modify Trips" && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900 mb-2">Modify Active Trips</h3>
                    <p className="text-sm text-slate-500">Search and edit in-transit trip details.</p>
                  </div>
                )}

                {/* NEW: Quick Status Form */}
                {opSubTab === "Quick Status" && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm max-w-2xl">
                    <h3 className="text-sm font-bold text-slate-900 mb-6 uppercase tracking-wider border-b border-slate-200 pb-2">Manual Status Override</h3>
                    <form className="space-y-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Select Truck</label>
                        <select className="w-full text-sm p-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                          <option>Select a vehicle...</option>
                          {liveVehicles.map(v => (
                            <option key={v.vehicle_no} value={v.vehicle_no}>
                              {v.vehicle_no} ({v.capacity_tons}MT {v.variant})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">New Operational Status</label>
                        <select className="w-full text-sm p-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                          <option>Ready / Available</option>
                          <option>In Transit</option>
                          <option>Plant Loading</option>
                          <option>Workshop / Repairs</option>
                          <option>No Driver / Leave</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Location / Breakdown Details</label>
                        <input type="text" placeholder="e.g. Trip 40080069852: POTTANERI -> PARAMATHI VELUR" className="w-full text-sm p-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </div>
                      <button type="button" className="mt-4 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-sm">
                        Update Status
                      </button>
                    </form>
                  </div>
                )}

              </div>
            )}
            
            {activeTab === "Fuel & Adv" && <div className="p-6"><FuelAdvanceModule /></div>}
            {activeTab === "Workshop & Tyres" && <div className="p-6"><WorkshopModule /></div>}
            {activeTab === "Financials" && <div className="p-6"><FinancialsModule /></div>}
            {activeTab === "Setup" && <div className="p-6"><SetupModule /></div>}
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
                <p className="text-sm text-slate-500 mt-1">Full fleet overview as of {currentDateText}</p>
              </div>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-sm rounded-lg transition-colors">
                  Excel
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-sm rounded-lg transition-colors">
                  PDF
                </button>
                <div className="h-6 w-px bg-slate-200 mx-2"></div>
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
