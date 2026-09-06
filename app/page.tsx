"tsx"
"use client";

import { useState } from "react";
import TripForm from "@/components/TripForm";
import PodClosure from "@/components/PodClosure";
import FuelAdvanceModule from "@/components/FuelAdvanceModule";
import DriverSettlementModule from "@/components/DriverSettlementModule";
import FinancialsModule from "@/components/FinancialsModule";
import WorkshopModule from "@/components/WorkshopModule";
import SetupModule from "@/components/SetupModule";
import FleetTable from "@/components/FleetTable";

export default function Home() {
  const [activeTab, setActiveTab] = useState("fleet");

  const tabs = [
    { id: "fleet", label: "Fleet Status" },
    { id: "trips", label: "Trip Management" },
    { id: "fuel", label: "Fuel & Advances" },
    { id: "settlements", label: "Driver Settlements" },
    { id: "pod", label: "POD Closure" },
    { id: "workshop", label: "Workshop & Repairs" },
    { id: "financials", label: "Financials & Margins" },
    { id: "setup", label: "System Setup" },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-blue-400">
            KSS Roadways Private Limited
          </h1>
          <p className="text-xs text-slate-400">Logistics ERP & Fleet Control System</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
            ● Active Fleet: 26 Units
          </span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-slate-900/60 border-b border-slate-800 px-4 overflow-x-auto">
        <div className="flex space-x-2 py-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Dynamic Module Content Area */}
      <section className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
        {activeTab === "fleet" && <FleetTable />}
        {activeTab === "trips" && <TripForm />}
        {activeTab === "fuel" && <FuelAdvanceModule />}
        {activeTab === "settlements" && <DriverSettlementModule />}
        {activeTab === "pod" && <PodClosure />}
        {activeTab === "workshop" && <WorkshopModule />}
        {activeTab === "financials" && <FinancialsModule />}
        {activeTab === "setup" && <SetupModule />}
      </section>
    </main>
  );
}
