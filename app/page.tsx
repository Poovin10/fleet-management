"use client";

import { useState } from "react";
// Import your existing modules here
import TripForm from "@/components/TripForm";
import PodClosure from "@/components/PodClosure";
import DriverSettlementModule from "@/components/DriverSettlementModule";
import FuelAdvanceModule from "@/components/FuelAdvanceModule";
import FinancialsModule from "@/components/FinancialsModule";
import WorkshopModule from "@/components/WorkshopModule";
import SetupModule from "@/components/SetupModule";
import FleetTable from "@/components/FleetTable";

export default function ERPDashboard() {
  const [activeTab, setActiveTab] = useState("Dashboard");

  // Tab definitions matching your Streamlit layout exactly
  const navItems = [
    { name: "Dashboard", icon: "🔴" },
    { name: "Operations", icon: "🚛" },
    { name: "Fuel & Adv", icon: "⛽" },
    { name: "Workshop & Tyres", icon: "🛠️" },
    { name: "Financials", icon: "📊" },
    { name: "Setup", icon: "⚙️" }
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 p-4 sm:p-6 md:p-8 font-sans selection:bg-rose-100">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Row */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">KSS Roadways</h1>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded-md shadow-sm border border-amber-200 uppercase tracking-wider">
              Master
            </span>
          </div>
          <button className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 text-sm font-semibold rounded-md shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-95">
            Logout
          </button>
        </div>

        {/* Modern Snappy Tabs */}
        <div className="flex flex-wrap items-center gap-3 pb-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 ease-in-out border active:scale-95 ${
                  isActive
                    ? "bg-rose-50 text-rose-700 border-rose-200 shadow-sm ring-1 ring-rose-100"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 shadow-sm"
                }`}
              >
                <span>{item.icon}</span>
                {item.name}
              </button>
            );
          })}
        </div>

        {/* Dynamic Content Area (Clean White Canvas) */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 min-h-[60vh] transition-all duration-300 ease-in-out animate-in fade-in zoom-in-95">
          {activeTab === "Dashboard" && <FleetTable />}
          
          {activeTab === "Operations" && (
             <div className="space-y-8">
               {/* Mount your sub-modules sequentially or add a sub-tab menu here later */}
               <TripForm />
               <hr className="border-slate-100" />
               <PodClosure />
               <hr className="border-slate-100" />
               <DriverSettlementModule />
             </div>
          )}
          
          {activeTab === "Fuel & Adv" && <FuelAdvanceModule />}
          {activeTab === "Workshop & Tyres" && <WorkshopModule />}
          {activeTab === "Financials" && <FinancialsModule />}
          {activeTab === "Setup" && <SetupModule />}
        </div>

      </div>
    </div>
  );
}
