"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function TripForm({ onSuccess }: { onSuccess?: () => void }) {
  const [cargoType, setCargoType] = useState("BULK");
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchVehicles() {
      setIsLoading(true);
      const supabase = createClient();
      // Fetch all vehicles (you can later add .eq('status', 'AVAILABLE_FOR_LOAD') to only show ready trucks)
      const { data } = await supabase.from('vehicles').select('*');
      
      if (data) setVehicles(data);
      setIsLoading(false);
    }
    fetchVehicles();
  }, []);

  // 1. DYNAMIC FILTER: Show only trucks that match the selected Cargo Type
  const filteredVehicles = vehicles.filter((v) => {
    const variant = String(v.variant || v.type || "").toUpperCase();
    if (cargoType === "BULK") {
      return variant.includes("BULK");
    } 
    if (cargoType === "BAGS") {
      return variant.includes("BAG") || variant.includes("BODY");
    }
    return true; 
  });

  // 2. CLEAN TEXT EXTRACTOR: Gets just the license plate, no capacity/type info
  const getCleanTruckNo = (v: any) => {
    return String(v.vehicle_no || v.truck_no || v.reg_no || v.id || "").trim();
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm max-w-3xl animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">New Trip Dispatch</h3>
          <p className="text-xs text-slate-500 mt-1">Initialize a new trip and assign an available asset.</p>
        </div>
      </div>

      <form className="space-y-6">
        {/* ROW 1: Cargo Type & Truck Assignment */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Cargo Type</label>
            <div className="flex bg-white rounded-lg border border-slate-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setCargoType("BULK")}
                className={`flex-1 py-2.5 text-sm font-bold transition-colors ${cargoType === "BULK" ? "bg-indigo-50 text-indigo-700 shadow-inner" : "text-slate-500 hover:bg-slate-50"}`}
              >
                BULK
              </button>
              <div className="w-px bg-slate-300"></div>
              <button
                type="button"
                onClick={() => setCargoType("BAGS")}
                className={`flex-1 py-2.5 text-sm font-bold transition-colors ${cargoType === "BAGS" ? "bg-indigo-50 text-indigo-700 shadow-inner" : "text-slate-500 hover:bg-slate-50"}`}
              >
                BAGS
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Assign Truck (Filtered)</label>
            <select 
              className="w-full text-sm p-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100"
              disabled={isLoading}
            >
              <option value="">{isLoading ? "Loading fleet..." : `Select a ${cargoType} truck...`}</option>
              {filteredVehicles.map((v, i) => {
                const cleanNo = getCleanTruckNo(v);
                return (
                  <option key={v.id || i} value={cleanNo}>
                    {cleanNo}
                  </option>
                );
              })}
            </select>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold">{filteredVehicles.length} matching vehicles found</p>
          </div>
        </div>

        {/* ROW 2: Routing Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Origin Source</label>
            <select className="w-full text-sm p-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
              <option>COCHIN</option>
              <option>COCHIN-ACC</option>
              <option>POTTANERI</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Destination Name</label>
            <input type="text" placeholder="e.g. ALAPPUZHA" className="w-full text-sm p-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none uppercase" />
          </div>
        </div>

        {/* ROW 3: Driver & Tonnage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Driver Name</label>
            <input type="text" placeholder="Driver Name" className="w-full text-sm p-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Expected Tonnage (MT)</label>
            <input type="number" step="0.01" placeholder="0.00" className="w-full text-sm p-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-200">
          <button 
            type="button" 
            className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm active:scale-95 flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            Dispatch Trip
          </button>
        </div>
      </form>
    </div>
  );
}
