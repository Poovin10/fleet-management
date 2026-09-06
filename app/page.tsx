'use client';

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { TripForm } from "@/components/TripForm";
import { FleetTable } from "@/components/FleetTable";
import { PodClosure } from "@/components/PodClosure";
import { SetupModule } from "@/components/SetupModule";
import { FuelAdvanceModule } from "@/components/FuelAdvanceModule";
import { FinancialsModule } from "@/components/FinancialsModule";
import { WorkshopModule } from "@/components/WorkshopModule";

export default function ERPDashboard() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [opSubTab, setOpSubTab] = useState("Trip Dispatch");

  // Fiscal Month Metrics States
  const [fleetCount, setFleetCount] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [monthlyTripsCount, setMonthlyTripsCount] = useState(0);
  const [monthlyDieselCost, setMonthlyDieselCost] = useState(0);
  const [monthlyNetProfit, setMonthlyNetProfit] = useState(0);

  const supabase = createClient();

  useEffect(() => {
    async function fetchFiscalMonthData() {
      // 1. Fetch total active vehicles
      const { count: vCount } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (vCount !== null) setFleetCount(vCount);

      // 2. Get current fiscal year/month start & end dates (e.g. September 2026)
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // 3. Fetch trips created in the current calendar/fiscal month
      const { data: monthTrips } = await supabase
        .from('trips')
        .select('freight_revenue, fuel_expense, driver_bata, trip_start_date')
        .gte('trip_start_date', firstDayOfMonth);

      if (monthTrips) {
        setMonthlyTripsCount(monthTrips.length);

        let rev = 0;
        let diesel = 0;
        let expenses = 0;

        monthTrips.forEach(t => {
          const r = Number(t.freight_revenue) || 0;
          const d = Number(t.fuel_expense) || 0;
          const b = Number(t.driver_bata) || 0;
          rev += r;
          diesel += d;
          expenses += (d + b);
        });

        setMonthlyRevenue(rev);
        setMonthlyDieselCost(diesel);
        setMonthlyNetProfit(rev - expenses);
      }
    }

    fetchFiscalMonthData();
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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">KSS Roadways ERP</h1>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Fleet Operations Portal</p>
          </div>
          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md">Master Role</span>
        </div>

        {/* Navigation Bar */}
        <div className="flex flex-wrap gap-3 border-b pb-4">
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => setActiveTab(item)}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm ${
                activeTab === item
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-800 text-white shadow-indigo-200 shadow-md -translate-y-0.5"
                  : "bg-white text-slate-700 border border-slate-200 hover:-translate-y-0.5 hover:border-indigo-500"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === "Dashboard" && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-extrabold uppercase text-slate-900">Current Fiscal Month Performance</h3>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                  {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="border border-slate-100 rounded-lg p-4 bg-white shadow-sm">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Fleet Size</p>
                  <p className="text-2xl font-extrabold text-slate-900">{fleetCount} Trucks</p>
                </div>
                <div className="border border-slate-100 rounded-lg p-4 bg-white shadow-sm">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Month Dispatches</p>
                  <p className="text-2xl font-extrabold text-slate-900">{monthlyTripsCount} Trips</p>
                </div>
                <div className="border border-emerald-100 rounded-lg p-4 bg-emerald-50 shadow-sm">
                  <p className="text-xs font-bold text-emerald-700 uppercase mb-2">Freight Revenue</p>
                  <p className="text-2xl font-extrabold text-emerald-900">₹{monthlyRevenue.toLocaleString()}</p>
                </div>
                <div className="border border-indigo-100 rounded-lg p-4 bg-indigo-50 shadow-sm">
                  <p className="text-xs font-bold text-indigo-700 uppercase mb-2">Net Month Profit</p>
                  <p className="text-2xl font-extrabold text-indigo-900">₹{monthlyNetProfit.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <FleetTable />
          </div>
        )}

        {/* Operations Tab */}
        {activeTab === "Operations" && (
          <div className="space-y-6">
            <div className="flex gap-2 bg-slate-100 p-1 rounded-lg w-fit">
              {["Trip Dispatch", "POD Receive & Close"].map((sub) => (
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

            {opSubTab === "Trip Dispatch" && (
              <div>
                <TripForm onSuccess={() => {}} />
              </div>
            )}

            {opSubTab === "POD Receive & Close" && (
              <div>
                <PodClosure onSuccess={() => {}} />
              </div>
            )}
          </div>
        )}

        {/* Fuel & Adv Tab */}
        {activeTab === "Fuel & Adv" && (
          <FuelAdvanceModule />
        )}

        {/* Financials Tab */}
        {activeTab === "Financials" && (
          <FinancialsModule />
        )}

        {/* Workshop & Tyres Tab */}
        {activeTab === "Workshop & Tyres" && (
          <WorkshopModule />
        )}

        {/* Setup Tab */}
        {activeTab === "Setup" && (
          <SetupModule />
        )}

      </div>
    </div>
  );
}
