"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function TripForm({ onSuccess }: { onSuccess?: () => void }) {
  const [cargoType, setCargoType] = useState("BULK");
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [tripDate, setTripDate] = useState(new Date().toISOString().split('T')[0]);
  const [lrNo, setLrNo] = useState("");
  const [selectedTruck, setSelectedTruck] = useState("");
  const [origin, setOrigin] = useState("COCHIN");
  const [destination, setDestination] = useState("");
  const [driver, setDriver] = useState("");
  const [tonnage, setTonnage] = useState("");
  const [ratePerTon, setRatePerTon] = useState("");
  const [dieselAdvance, setDieselAdvance] = useState("");
  const [cashAdvance, setCashAdvance] = useState("");

  useEffect(() => {
    async function fetchVehicles() {
      setIsLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase.from('vehicles').select('*');
      
      if (data) {
        setVehicles(data);
      }
      setIsLoading(false);
    }
    fetchVehicles();
  }, []);

  // Universal truck number extractor that checks every possible column name
  const getCleanTruckNo = (v: any) => {
    if (!v) return "";
    return String(
      v.vehicle_no || 
      v.truck_no || 
      v.reg_no || 
      v.plate || 
      v.name || 
      v.number || 
      v.registration || 
      v.id || 
      ""
    ).trim();
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    
    const { error } = await supabase.from('trips').insert([
      {
        trip_date: tripDate,
        lr_no: lrNo,
        vehicle_no: selectedTruck,
        cargo_type: cargoType,
        origin: origin,
        destination: destination,
        driver_name: driver,
        tonnage: parseFloat(tonnage) || 0,
        rate_per_ton: parseFloat(ratePerTon) || 0,
        diesel_advance: parseFloat(dieselAdvance) || 0,
        cash_advance: parseFloat(cashAdvance) || 0,
        trip_status: 'IN_TRANSIT'
      }
    ]);

    if (!error) {
      alert("Trip Dispatched Successfully!");
      if (onSuccess) onSuccess();
    } else {
      alert("Error dispatching trip: " + error.message);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm max-w-4xl mx-auto animate-in fade-in duration-300">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Trip Dispatch Form</h3>
        <p className="text-xs text-slate-500 mt-1">Create a new transit record, allocate cargo slabs, and record initial advances.</p>
      </div>

      <form onSubmit={handleDispatch} className="space-y-6">
        
        {/* ROW 1: Date & LR Number */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Trip Date</label>
            <input 
              type="date" 
              value={tripDate}
              onChange={(e) => setTripDate(e.target.value)}
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white outline-none"
              required 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">LR / Invoice No *</label>
            <input 
              type="text" 
              value={lrNo}
              onChange={(e) => setLrNo(e.target.value)}
              placeholder="e.g. 40080069852" 
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white outline-none font-semibold uppercase"
              required 
            />
          </div>
        </div>

        {/* ROW 2: Cargo Type & Truck Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Cargo Type</label>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setCargoType("BULK")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${cargoType === "BULK" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
              >
                BULK
              </button>
              <button
                type="button"
                onClick={() => setCargoType("BAGS")}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${cargoType === "BAGS" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
              >
                BAGS
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
              Assigned Truck ({vehicles.length} Active Fleet Loaded)
            </label>
            <select 
              value={selectedTruck}
              onChange={(e) => setSelectedTruck(e.target.value)}
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900"
              required
              disabled={isLoading}
            >
              <option value="">{isLoading ? "Loading fleet..." : "-- SELECT TRUCK --"}</option>
              {vehicles.map((v, i) => {
                const truckNumber = getCleanTruckNo(v);
                return (
                  <option key={v.id || i} value={truckNumber}>
                    {truckNumber} {v.variant ? `(${v.variant})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* ROW 3: Origin & Destination */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Origin Source</label>
            <select 
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white outline-none"
            >
              <option>COCHIN</option>
              <option>COCHIN-ACC</option>
              <option>POTTANERI</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Destination Name *</label>
            <input 
              type="text" 
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. PARAMATHI VELUR" 
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white uppercase outline-none"
              required 
            />
          </div>
        </div>

        {/* ROW 4: Driver & Tonnage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Driver Name</label>
            <input 
              type="text" 
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
              placeholder="Enter driver full name" 
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white outline-none" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Tonnage Dispatched (MT)</label>
            <input 
              type="number" 
              step="0.01"
              value={tonnage}
              onChange={(e) => setTonnage(e.target.value)}
              placeholder="0.00" 
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white outline-none" 
            />
          </div>
        </div>

        {/* ROW 5: Rate & Advances */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Rate / MT (₹)</label>
            <input 
              type="number" 
              step="0.01"
              value={ratePerTon}
              onChange={(e) => setRatePerTon(e.target.value)}
              placeholder="0.00" 
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white outline-none" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Diesel Advance (₹)</label>
            <input 
              type="number" 
              value={dieselAdvance}
              onChange={(e) => setDieselAdvance(e.target.value)}
              placeholder="0.00" 
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white outline-none" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Cash Advance (₹)</label>
            <input 
              type="number" 
              value={cashAdvance}
              onChange={(e) => setCashAdvance(e.target.value)}
              placeholder="0.00" 
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white outline-none" 
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button 
            type="submit" 
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95"
          >
            Dispatch Trip
          </button>
        </div>

      </form>
    </div>
  );
}
