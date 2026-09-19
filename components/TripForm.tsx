"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export function TripForm() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Core Data States
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [historicalSources, setHistoricalSources] = useState<string[]>([]);
  const [historicalDestinations, setHistoricalDestinations] = useState<string[]>([]);

  // Trip Form States
  const [tripDate, setTripDate] = useState(new Date().toISOString().split("T")[0]);
  const [lrNumber, setLrNumber] = useState("");
  const [cargoType, setCargoType] = useState("BULK");
  const [truckId, setTruckId] = useState("");
  
  // Driver States
  const [driverMode, setDriverMode] = useState<"select" | "manual">("select");
  const [driverId, setDriverId] = useState("");
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newDriverLicense, setNewDriverLicense] = useState("");
  const [newDriverExpiry, setNewDriverExpiry] = useState("");

  // Location States
  const [sourceMode, setSourceMode] = useState<"select" | "manual">("select");
  const [source, setSource] = useState("");
  const [destMode, setDestMode] = useState<"select" | "manual">("select");
  const [destination, setDestination] = useState("");

  // Operational & Financial States
  const [tonnage, setTonnage] = useState("");
  const [freightRevenue, setFreightRevenue] = useState("");
  const [driverBata, setDriverBata] = useState("");
  const [advance, setAdvance] = useState("");
  const [dieselIssued, setDieselIssued] = useState("");
  const [tankFull, setTankFull] = useState(false);

  // KM Tracking States
  const [startKm, setStartKm] = useState("");
  const [previousKm, setPreviousKm] = useState<number | null>(null);

  useEffect(() => {
    async function fetchFormContext() {
      const { data: vData } = await supabase.from("vehicles").select("*").eq("is_active", true);
      if (vData) setVehicles(vData);

      const { data: dData } = await supabase.from("drivers").select("*").eq("is_active", true);
      if (dData) setDrivers(dData);

      const { data: tData } = await supabase.from("trips").select("source, destination").order("created_at", { ascending: false }).limit(300);
      if (tData) {
        const uniqueS = Array.from(new Set(tData.map(t => t.source).filter(Boolean))) as string[];
        const uniqueD = Array.from(new Set(tData.map(t => t.destination).filter(Boolean))) as string[];
        setHistoricalSources(uniqueS.length ? uniqueS : ["Kochi", "Erode", "Chennai"]);
        setHistoricalDestinations(uniqueD.length ? uniqueD : ["Kochi", "Erode", "Chennai"]);
      }
    }
    fetchFormContext();
  }, [supabase]);

  // Fetch the latest End KM for the selected truck
  useEffect(() => {
    async function getPreviousKm() {
      if (!truckId) {
        setPreviousKm(null);
        setStartKm("");
        return;
      }
      const { data } = await supabase.from("trips")
        .select("end_km")
        .eq("vehicle_id", truckId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && data.end_km) {
        setPreviousKm(Number(data.end_km));
        setStartKm(String(data.end_km)); // Pre-fill with previous KM for convenience
      } else {
        setPreviousKm(0);
      }
    }
    getPreviousKm();
  }, [truckId, supabase]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const type = (v.truck_type || v.cargo_type || "").toUpperCase();
      return type.includes(cargoType) || type === ""; 
    });
  }, [vehicles, cargoType]);

  // Input safeguard to block scrolling and arrow key adjustments
  const strictNumberProps = {
    min: "0",
    onWheel: (e: any) => e.currentTarget.blur(),
    onKeyDown: (e: any) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setSuccess(false);

    // 0. Strict Math Validation
    if (Number(startKm) < 0 || Number(tonnage) < 0 || Number(freightRevenue) < 0 || Number(driverBata) < 0 || Number(advance) < 0 || Number(dieselIssued) < 0) {
      alert("SECURITY BLOCK: Negative values are strictly prohibited.");
      setLoading(false);
      return;
    }

    if (previousKm !== null && Number(startKm) <= previousKm) {
      alert(`SECURITY BLOCK: Starting KM (${startKm}) must be strictly LARGER than the previous recorded end KM (${previousKm}).`);
      setLoading(false);
      return;
    }

    // 1. Validate Duplicate LR Number
    if (lrNumber) {
      const { data: existingLR } = await supabase.from("trips").select("lr_number").eq("lr_number", lrNumber).maybeSingle();
      if (existingLR) {
        alert(`SECURITY BLOCK: The LR Number "${lrNumber}" already exists in the system. Duplicates are not allowed.`);
        setLoading(false);
        return;
      }
    }

    // 2. Handle Manual Driver Creation if active
    let finalDriverId = driverId;
    if (driverMode === "manual") {
      const { data: newDriver, error: driverErr } = await supabase.from("drivers").insert([{
        name: newDriverName,
        phone_number: newDriverPhone, 
        license_number: newDriverLicense,
        license_expiry: newDriverExpiry,
        is_active: true
      }]).select().single();
      
      if (driverErr) {
        alert("Failed to register new driver to database. Error: " + driverErr.message);
        setLoading(false);
        return;
      }
      finalDriverId = newDriver.id || newDriver.driver_id;
    }

    // 3. Construct and Dispatch Trip
    const tripData = {
      trip_start_date: tripDate,
      lr_number: lrNumber.toUpperCase(),
      cargo_type: cargoType,
      vehicle_id: truckId,
      primary_driver_id: finalDriverId,
      source: source,
      destination: destination,
      tonnage_loaded: Number(tonnage),
      freight_revenue: Number(freightRevenue),
      driver_bata: Number(driverBata),
      cash_advance_issued: Number(advance),
      diesel_issued: Number(dieselIssued),
      start_km: Number(startKm),
      is_tank_full: tankFull,
      trip_status: "WAITING_FOR_LOAD"
    };

    const { error } = await supabase.from("trips").insert([tripData]);
    
    if (!error) {
      setSuccess(true);
      setLrNumber(""); setTruckId(""); setDriverId(""); setSource(""); setDestination(""); 
      setTonnage(""); setFreightRevenue(""); setDriverBata(""); setAdvance(""); setDieselIssued("");
      setStartKm(""); setTankFull(false);
      if (driverMode === "manual") {
        setNewDriverName(""); setNewDriverPhone(""); setNewDriverLicense(""); setNewDriverExpiry(""); setDriverMode("select");
      }
    } else {
      alert("Error dispatching trip: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-white/[0.08] pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">Dispatch New Trip</h2>
          <p className="text-xs text-white/50 mt-1">Unified strict-validation logistics console</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* ROW 1: Date & LR Number */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Trip Date</label>
            <input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} className="w-full liquid-input" required />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">LR Number (Unique)</label>
            <input type="text" value={lrNumber} onChange={(e) => setLrNumber(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))} placeholder="e.g. KSS10024" className="w-full liquid-input uppercase" required pattern="[A-Za-z0-9]+" title="Only letters and numbers allowed" />
          </div>
        </div>

        {/* ROW 2: Cargo Type & Truck */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Cargo Type</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setCargoType("BULK"); setTruckId(""); setPreviousKm(null); setStartKm(""); }} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ios-spring ${cargoType === "BULK" ? "bg-gradient-to-r from-[#FFB340] to-[#FF9F0A] text-black shadow-[0_4px_15px_rgba(255,159,10,0.4)]" : "bg-white/[0.03] text-white/60 border border-white/[0.08]"}`}>
                BULK CARGO
              </button>
              <button type="button" onClick={() => { setCargoType("BAG"); setTruckId(""); setPreviousKm(null); setStartKm(""); }} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ios-spring ${cargoType === "BAG" ? "bg-gradient-to-r from-[#FFB340] to-[#FF9F0A] text-black shadow-[0_4px_15px_rgba(255,159,10,0.4)]" : "bg-white/[0.03] text-white/60 border border-white/[0.08]"}`}>
                BAG CARGO
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Assign Truck</label>
            <select value={truckId} onChange={(e) => setTruckId(e.target.value)} className="w-full liquid-input bg-[#020203]" required>
              <option value="" className="text-white/40">Select an available truck...</option>
              {filteredVehicles.map(v => (
                <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number} ({v.carrying_capacity_tons} MT)</option>
              ))}
            </select>
          </div>
        </div>

        {/* ROW 3: Driver Management */}
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex justify-between items-center mb-4">
            <label className="block text-[11px] font-semibold text-white/60 uppercase tracking-wider">Pilot / Driver Assignment</label>
            <button type="button" onClick={() => setDriverMode(prev => prev === "select" ? "manual" : "select")} className="btn-glass px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-wider">
              {driverMode === "select" ? "+ ADD NEW DRIVER" : "≡ SELECT EXISTING"}
            </button>
          </div>

          {driverMode === "select" ? (
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="w-full liquid-input bg-[#020203]" required>
              <option value="">Select active driver...</option>
              {drivers.map(d => (
                <option key={d.driver_id || d.id} value={d.driver_id || d.id}>{d.name} ({d.phone_number || d.contact_number || "No Phone"})</option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-tab-focus">
              <input type="text" placeholder="Full Name" value={newDriverName} onChange={e => setNewDriverName(e.target.value)} className="liquid-input text-sm" required={driverMode === "manual"} />
              <input type="tel" placeholder="Phone Number" value={newDriverPhone} onChange={e => setNewDriverPhone(e.target.value)} className="liquid-input text-sm" required={driverMode === "manual"} />
              <input type="text" placeholder="License Number" value={newDriverLicense} onChange={e => setNewDriverLicense(e.target.value.toUpperCase())} className="liquid-input text-sm uppercase" required={driverMode === "manual"} />
              <input type="date" value={newDriverExpiry} onChange={e => setNewDriverExpiry(e.target.value)} className="liquid-input text-sm" required={driverMode === "manual"} title="License Expiry Date" />
            </div>
          )}
        </div>

        {/* ROW 4: Routing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Origin</label>
            <div className="flex gap-2">
              {sourceMode === "select" ? (
                <select value={source} onChange={(e) => setSource(e.target.value)} className="flex-1 liquid-input bg-[#020203]" required>
                  <option value="">Select origin...</option>
                  {historicalSources.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Type new origin..." className="flex-1 liquid-input" required />
              )}
              <button type="button" onClick={() => setSourceMode(prev => prev === "select" ? "manual" : "select")} className="btn-glass px-4 rounded-xl text-xl font-bold pb-1" title="Toggle Manual Entry">{sourceMode === "select" ? "+" : "≡"}</button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Destination</label>
            <div className="flex gap-2">
              {destMode === "select" ? (
                <select value={destination} onChange={(e) => setDestination(e.target.value)} className="flex-1 liquid-input bg-[#020203]" required>
                  <option value="">Select destination...</option>
                  {historicalDestinations.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              ) : (
                <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Type new destination..." className="flex-1 liquid-input" required />
              )}
              <button type="button" onClick={() => setDestMode(prev => prev === "select" ? "manual" : "select")} className="btn-glass px-4 rounded-xl text-xl font-bold pb-1" title="Toggle Manual Entry">{destMode === "select" ? "+" : "≡"}</button>
            </div>
          </div>
        </div>

        {/* ROW 5: Operational Telemetry (KM & Fuel) */}
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
          <label className="block text-[11px] font-semibold text-[#FF9F0A] uppercase tracking-wider mb-2">Telemetry & Fuel Logging</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-[10px] font-semibold text-white/50 mb-1.5 uppercase">Starting KM (Prev: {previousKm ?? "N/A"})</label>
              <input type="number" {...strictNumberProps} value={startKm} onChange={(e) => setStartKm(e.target.value)} className="w-full liquid-input font-mono" placeholder="0" required />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-white/50 mb-1.5 uppercase">Diesel Issued (Litres)</label>
              <input type="number" {...strictNumberProps} step="0.01" value={dieselIssued} onChange={(e) => setDieselIssued(e.target.value)} className="w-full liquid-input font-mono" placeholder="0.00" required />
            </div>
            <div className="flex items-center h-[52px]">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={tankFull} onChange={(e) => setTankFull(e.target.checked)} className="w-6 h-6 rounded-md bg-black/40 border border-white/20 text-[#FF9F0A] focus:ring-[#FF9F0A] focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer appearance-none checked:bg-[#FF9F0A] checked:border-[#FF9F0A] transition-all ios-spring flex items-center justify-center relative after:content-[''] after:w-1.5 after:h-3 after:border-r-2 after:border-b-2 after:border-black after:rotate-45 after:absolute after:hidden checked:after:block after:-mt-1" />
                <span className="text-xs font-bold text-white/80 uppercase tracking-wide">Tank Full Marker</span>
              </label>
            </div>
          </div>
        </div>

        {/* ROW 6: Cargo Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Tonnage (MT)</label>
            <input type="number" {...strictNumberProps} step="0.01" value={tonnage} onChange={(e) => setTonnage(e.target.value)} className="w-full liquid-input" placeholder="0.00" required />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Freight Rate (₹)</label>
            <input type="number" {...strictNumberProps} value={freightRevenue} onChange={(e) => setFreightRevenue(e.target.value)} className="w-full liquid-input" placeholder="0.00" required />
          </div>
        </div>

        {/* ROW 7: Allowances */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Driver Bata (₹)</label>
            <input type="number" {...strictNumberProps} value={driverBata} onChange={(e) => setDriverBata(e.target.value)} className="w-full liquid-input" placeholder="0.00" required />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Advance Issued (₹)</label>
            <input type="number" {...strictNumberProps} value={advance} onChange={(e) => setAdvance(e.target.value)} className="w-full liquid-input" placeholder="0.00" required />
          </div>
        </div>

        {success && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center font-bold animate-pulse">
            Trip successfully registered and dispatched!
          </div>
        )}

        <button type="submit" disabled={loading} className="w-full btn-orange-glow py-4 rounded-xl text-sm font-bold tracking-wide mt-4">
          {loading ? "Validating & Dispatching..." : "Confirm & Dispatch Trip"}
        </button>
      </form>
    </div>
  );
}
