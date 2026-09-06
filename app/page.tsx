'client';

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { FleetTable } from "@/components/FleetTable";
import { TripForm } from "@/components/TripForm";
import { PodClosure } from "@/components/PodClosure";
import { DriverSettlementModule } from "@/components/DriverSettlementModule";
import { FuelAdvanceModule } from "@/components/FuelAdvanceModule";
import { FinancialsModule } from "@/components/FinancialsModule";
import { WorkshopModule } from "@/components/WorkshopModule";
import { SetupModule } from "@/components/SetupModule";

export default function ERPDashboard() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [opSubTab, setOpSubTab] = useState("Trip Dispatch");

  // Dashboard Metric States
  const [fleetCount, setFleetCount] = useState(21);
  const [activeTripsCount, setActiveTripsCount] = useState(2);
  const [pendingPodsCount, setPendingPodsCount] = useState(2);
  const [monthTonnage, setMonthTonnage] = useState(1424.9);
  const [monthFreight, setMonthFreight] = useState(560126.32);

  const supabase = createClient();

  useEffect(() => {
    async function fetchMetrics() {
      const { count: vCount } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      if (vCount !== null && vCount > 0) setFleetCount(vCount);

      const { data: activeTrips } = await supabase
        .from('trips')
        .select('trip_id')
        .in('trip_status', ['IN_TRANSIT', 'DISPATCHED']);

      if (activeTrips) {
        setActiveTripsCount(activeTrips.length);
        setPendingPodsCount(activeTrips.length);
      }
    }
    fetchMetrics();
  }, [supabase]);

  const navItems = [
    "Dashboard",
    "Operations",
    "Fuel & Adv",
    "Workshop & Tyres",
    "Financials",
    "Setup"
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* App Title & Logout Row */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">KSS Roadways</h1>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold rounded">Master</span>
          </div>
          <button className="px-3 py-1 border border-slate-300 text-slate-700 text-xs font-semibold rounded hover:bg-slate-50">
            Logout
          </button>
        </div>

        {/* Primary Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b pb-4">
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => setActiveTab(item)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                activeTab === item
                  ? "bg-rose-50 text-rose-700 border-rose-300 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {item === "Dashboard" && "🏠 "}
              {item === "Operations" && "🚛 "}
              {item === "Fuel & Adv" && "⛽ "}
              {item === "Workshop & Tyres" && "🛠️ "}
              {item === "Financials" && "📊 "}
              {item === "Setup" && "⚙️ "}
              {item}
            </button>
          ))}
        </div>

        {/* Dashboard Tab Content */}
        {activeTab === "Dashboard" && (
          <div className="space-y-6">
            
            {/* Operations Summary Box */}
            <div className="border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm bg-white">
              <h3 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">
                Operations Summary (September 2026)
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="border border-slate-200 rounded-lg p-4 bg-white">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Fleet Size</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{fleetCount}</p>
                </div>
                
                <div className="border border-slate-200 rounded-lg p-4 bg-white">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Active Trips</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{activeTripsCount}</p>
                </div>
                
                <div className="border border-indigo-200 bg-indigo-50/50 rounded-lg p-4">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase">Tonnage Dispatched</p>
                  <p className="text-2xl font-black text-indigo-950 mt-1">{monthTonnage.toLocaleString()} MT</p>
                </div>
                
                <div className="border border-rose-200 bg-rose-50/50 rounded-lg p-4">
                  <p className="text-[10px] font-bold text-rose-600 uppercase">Pending Pods</p>
                  <p className="text-2xl font-black text-rose-950 mt-1">{pendingPodsCount}</p>
                </div>
              </div>

              {/* Month Freight Generated Banner */}
              <div className="border border-rose-200 bg-rose-50/30 rounded-lg p-4 max-w-sm">
                <p className="text-[10px] font-bold text-rose-700 uppercase">Month Freight Generated</p>
                <p className="text-xl font-black text-rose-950 mt-1">
                  ₹{monthFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Vehicle Status Monitor */}
            <div className="border border-slate-200 rounded-xl p-5 space-y-3 bg-white shadow-sm">
              <h3 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">
                Vehicle Status Monitor
              </h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="border border-slate-200 rounded-lg p-3 text-center">
                  <span className="text-lg font-bold text-slate-900">2</span>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold mt-0.5">In Transit</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 text-center">
                  <span className="text-lg font-bold text-slate-900">0</span>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold mt-0.5">Plant Loading</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 text-center">
                  <span className="text-lg font-bold text-slate-900">0</span>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold mt-0.5">Site Unloading</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 text-center">
                  <span className="text-lg font-bold text-slate-900">17</span>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold mt-0.5">Ready / Available</p>
                </div>
                <div className="border border-slate-200 rounded-lg p-3 text-center">
                  <span className="text-lg font-bold text-slate-900">0</span>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold mt-0.5">No Driver / Leave</p>
                </div>
              </div>
            </div>

            {/* Workshop & Maintenance */}
            <div className="border border-slate-200 rounded-xl p-5 space-y-3 bg-white shadow-sm">
              <h3 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">
                Workshop & Maintenance
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between items-center border border-slate-100 p-3 rounded-lg bg-slate-50">
                  <span className="text-xs font-bold text-slate-600">Active Repairs</span>
                  <span className="text-sm font-black text-rose-600">2</span>
                </div>
                <div className="flex justify-between items-center border border-slate-100 p-3 rounded-lg bg-slate-50">
                  <span className="text-xs font-bold text-slate-600">Available Assets</span>
                  <span className="text-sm font-black text-indigo-600">19</span>
                </div>
              </div>
            </div>

            <FleetTable />
          </div>
        )}

        {/* Operations Tab Sub-navigation */}
        {activeTab === "Operations" && (
          <div className="space-y-6">
            <div className="flex gap-2 bg-slate-100 p-1 rounded-lg w-fit">
              {["Trip Dispatch", "POD Receive & Close", "Rate Slabs & Settlements"].map((sub) => (
                <button
                  key={sub}
                  onClick={() => setOpSubTab(sub)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                    opSubTab === sub ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>

            {opSubTab === "Trip Dispatch" && <TripForm onSuccess={() => {}} />}
            {opSubTab === "POD Receive & Close" && <PodClosure onSuccess={() => {}} />}
            {opSubTab === "Rate Slabs & Settlements" && <DriverSettlementModule />}
          </div>
        )}

        {/* Other Module Tabs */}
        {activeTab === "Fuel & Adv" && <FuelAdvanceModule />}
        {activeTab === "Workshop & Tyres" && <WorkshopModule />}
        {activeTab === "Financials" && <FinancialsModule />}
        {activeTab === "Setup" && <SetupModule />}

      </div>
    </div>
  );
}
