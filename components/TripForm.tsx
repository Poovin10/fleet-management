"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export function TripForm() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Data states
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [historicalSources, setHistoricalSources] = useState<string[]>([]);
  const [historicalDestinations, setHistoricalDestinations] = useState<string[]>([]);

  // Form states
  const [cargoType, setCargoType] = useState("BULK");
  const [truckSearch, setTruckSearch] = useState("");
  
  const [sourceMode, setSourceMode] = useState<"select" | "manual">("select");
  const [source, setSource] = useState("");
  
  const [destMode, setDestMode] = useState<"select" | "manual">("select");
  const [destination, setDestination] = useState("");

  const [freightRevenue, setFreightRevenue] = useState("");
  const [driverBata, setDriverBata] = useState("");

  useEffect(() => {
    async function fetchFormContext() {
      // 1. Fetch active vehicles (all 21 units)
      const { data: vData } = await supabase.from("vehicles").select("*").eq("is_active", true);
      if (vData) setVehicles(vData);

      // 2. Fetch unique historical locations for dropdowns
      const { data: tData } = await supabase.from("trips").select("source, destination").order("created_at", { ascending: false }).limit(300);
      if (tData) {
        const uniqueS = Array.from(new Set(tData.map(t => t.source).filter(Boolean))) as string[];
        const uniqueD = Array.from(new Set(tData.map(t => t.destination).filter(Boolean))) as string[];
        // Fallback to primary routes if database is sparse
        setHistoricalSources(uniqueS.length ? uniqueS : ["Kochi", "Erode", "Chennai", "Coimbatore"]);
        setHistoricalDestinations(uniqueD.length ? uniqueD : ["Kochi", "Erode", "Chennai", "Coimbatore"]);
      }
    }
    fetchFormContext();
  }, [supabase]);

  // Filter trucks based on Cargo Type (Ready for your specific Bag/Bulk logic)
  const filteredVehicles = useMemo(() => {
    return vehicles; 
  }, [vehicles, cargoType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setSuccess(false);

    // Map the typed truck number back to the database vehicle_id
    const selectedVehicle = vehicles.find(v => v.vehicle_number === truckSearch);
    if (!selectedVehicle) {
      alert("Please select a valid truck number from the search list.");
      setLoading(false);
      return;
    }

    const tripData = {
      vehicle_id: selectedVehicle.vehicle_id,
      cargo_type: cargoType,
      source: source,
      destination: destination,
      freight_revenue: Number(freightRevenue),
      driver_bata: Number(driverBata),
      trip_start_date: new Date().toISOString(),
      trip_status: "IN_TRANSIT"
    };

    const { error } = await supabase.from("trips").insert([tripData]);
    
    if (!error) {
      setSuccess(true);
      setTruckSearch(""); setSource(""); setDestination(""); setFreightRevenue(""); setDriverBata("");
    } else {
      alert("Error dispatching trip: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-white/[0.08] pb-4">
        <h2 className="text-lg font-bold text-white tracking-wide">Dispatch New Trip</h2>
        <p className="text-xs text-white/50 mt-1">Unified single-screen logistics console</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Cargo Type Toggle */}
        <div>
          <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Cargo Type</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setCargoType("BULK")} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ios-spring ${cargoType === "BULK" ? "bg-gradient-to-r from-[#FFB340] to-[#FF9F0A] text-black shadow-[0_4px_15px_rgba(255,159,10,0.4)]" : "bg-white/[0.03] text-white/60 border border-white/[0.08]"}`}>
              BULK CARGO
            </button>
            <button type="button" onClick={() => setCargoType("BAG")} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ios-spring ${cargoType === "BAG" ? "bg-gradient-to-r from-[#FFB340] to-[#FF9F0A] text-black shadow-[0_4px_15px_rgba(255,159,10,0.4)]" : "bg-white/[0.03] text-white/60 border border-white/[0.08]"}`}>
              BAG CARGO
            </button>
          </div>
        </div>

        {/* 2. Searchable Truck Select */}
        <div>
          <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Truck Number (Filtered by {cargoType})</label>
          <input 
            list="trucks-datalist" 
            placeholder="Search or select truck (e.g. TN...)" 
            className="w-full liquid-input"
            value={truckSearch}
            onChange={(e) => setTruckSearch(e.target.value)}
            required
          />
          <datalist id="trucks-datalist">
            {filteredVehicles.map(v => (
              <option key={v.vehicle_id} value={v.vehicle_number}>
                {v.vehicle_number} ({v.carrying_capacity_tons} MT)
              </option>
            ))}
          </datalist>
        </div>

        {/* 3. Source Selection */}
        <div>
          <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Origin / Source</label>
          <div className="flex gap-2">
            {sourceMode === "select" ? (
              <select value={source} onChange={(e) => setSource(e.target.value)} className="flex-1 liquid-input bg-[#020203]">
                <option value="">Select historical source...</option>
                {historicalSources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Type new source manually..." className="flex-1 liquid-input" />
            )}
            <button type="button" onClick={() => setSourceMode(prev => prev === "select" ? "manual" : "select")} className="btn-glass px-4 rounded-xl text-xl font-bold pb-1" title="Toggle Manual Entry">
              {sourceMode === "select" ? "+" : "≡"}
            </button>
          </div>
        </div>

        {/* 4. Destination Selection */}
        <div>
          <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Destination</label>
          <div className="flex gap-2">
            {destMode === "select" ? (
              <select value={destination} onChange={(e) => setDestination(e.target.value)} className="flex-1 liquid-input bg-[#020203]">
                <option value="">Select historical destination...</option>
                {historicalDestinations.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            ) : (
              <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Type new destination manually..." className="flex-1 liquid-input" />
            )}
            <button type="button" onClick={() => setDestMode(prev => prev === "select" ? "manual" : "select")} className="btn-glass px-4 rounded-xl text-xl font-bold pb-1" title="Toggle Manual Entry">
              {destMode === "select" ? "+" : "≡"}
            </button>
          </div>
        </div>

        {/* Financials - Single Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Freight Revenue (₹)</label>
            <input type="number" value={freightRevenue} onChange={(e) => setFreightRevenue(e.target.value)} className="w-full liquid-input" placeholder="0.00" required />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Driver Bata (₹)</label>
            <input type="number" value={driverBata} onChange={(e) => setDriverBata(e.target.value)} className="w-full liquid-input" placeholder="0.00" required />
          </div>
        </div>

        {success && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center font-bold">
            Trip successfully dispatched!
          </div>
        )}

        <button type="submit" disabled={loading} className="w-full btn-orange-glow py-4 rounded-xl text-sm font-bold tracking-wide mt-4">
          {loading ? "Registering Trip..." : "Dispatch Trip"}
        </button>
      </form>
    </div>
  );
}
