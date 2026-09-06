"use client";

import { useState } from "react";
// Corrected: Added curly braces for Named Exports
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
  
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);

  const navItems = ["Dashboard", "Operations", "Fuel & Adv", "Workshop & Tyres", "Financials", "Setup"];
  const opTabs = ["Trips", "POD Closure", "Settlements"];

  const currentMonthText = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  const truckStatusDetails = {
    "Workshop / Repairs": [
      { id: "TN 56 F 0452", driver: "Unassigned", days: 3, issue: "Clutch Plate Replacement" },
      { id: "TN 34 A 8821", driver: "Murugan", days: 1, issue: "Tyre Puncture & Alignment" }
    ],
    "No Driver / Leave": [
      { id: "KL 45 B 1122", driver: "Suresh (Leave)", days: 2, issue: "Personal Leave" }
    ]
  };

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
                    {currentMonthText} Only
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
                    { label: "In Transit", count: 8, color: "bg-blue-50 text-blue-700 border-blue-200" },
                    { label: "Ready / Available", count: 15, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                    { label: "Plant Loading", count: 1, color: "bg-amber-50 text-amber-700 border-amber-200" },
                    { label: "Workshop / Repairs", count: 2, color: "bg-rose-50 text-rose-700 border-rose-200" },
                    { label: "No Driver / Leave", count: 0, color: "bg-slate-100 text-slate-700 border-slate-300" }
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

                {/* DRILL-DOWN TABLE (Reveals on click) */}
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
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Driver</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Days in Status</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {(truckStatusDetails[selectedStatus as keyof typeof truckStatusDetails] || []).map((truck, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{truck.id}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{truck.driver}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-md">{truck.days} Days</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{truck.issue}</td>
                            </tr>
                          ))}
                          {!(truckStatusDetails[selectedStatus as keyof typeof truckStatusDetails]) && (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">No detailed records found for this status.</td></tr>
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
                <div className="flex space-x-6 border-b border-slate-200 mb-6">
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
                {opSubTab === "Trips" && <TripForm />}
                {opSubTab === "POD Closure" && <PodClosure />}
                {opSubTab === "Settlements" && <DriverSettlementModule />}
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
                <p className="text-sm text-slate-500 mt-1">Full fleet overview as of {new Date().toLocaleDateString()}</p>
              </div>
              
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-sm rounded-lg transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Excel
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-sm rounded-lg transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  PDF
                </button>
                <div className="h-6 w-px bg-slate-200 mx-2"></div>
                <button 
                  onClick={() => setShowFullReport(false)}
                  className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
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
