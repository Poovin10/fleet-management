"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export function TripForm() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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

  useEffect(() => {
    async function getPreviousKm() {
      if (!truckId) {
        setPreviousKm(null); setStartKm(""); return;
      }
      const { data } = await supabase.from("trips")
        .select("end_km")
        .eq("vehicle_id", truckId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && data.end_km) {
        setPreviousKm(Number(data.end_km));
        setStartKm(String(data.end_km));
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

  const strictNumberProps = {
    min: "0",
    onWheel: (e: any) => e.currentTarget.blur(),
    onKeyDown: (e: any) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
    }
  };

  const compactInput = "w-full bg-white/[0.02] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-[#FF9F0A]/50 focus:bg-white/[0.05] transition-all outline-none font-medium";

  // Financial Calculations
  const totalRevenue = Number(freightRevenue || 0);
  const totalExpense = Number(driverBata || 0) + Number(advance || 0);
  const netMargin = totalRevenue - totalExpense;

  const handleClear = () => {
    setLrNumber(""); setTruckId(""); setDriverId(""); setSource(""); setDestination(""); 
    setTonnage(""); setFreightRevenue(""); setDriverBata(""); setAdvance(""); setDieselIssued("");
    setStartKm(""); setTankFull(false); setSuccess(false);
    if (driverMode === "manual") {
      setNewDriverName(""); setNewDriverPhone(""); setNewDriverLicense(""); setNewDriverExpiry(""); setDriverMode("select");
    }
  };

  // Step 1: Validate custom rules, then show confirmation modal
  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault(); // Native HTML5 validates empty fields first
    setLoading(true); setSuccess(false);

    if (Number(startKm) < 0 || Number(tonnage) < 0 || Number(freightRevenue) < 0 || Number(driverBata) < 0 || Number(advance) < 0 || Number(dieselIssued) < 0) {
      alert("SECURITY BLOCK: Negative values are strictly prohibited."); setLoading(false); return;
    }
    if (previousKm !== null && Number(startKm) <= previousKm) {
      alert(`SECURITY BLOCK: Starting KM (${startKm}) must be strictly LARGER than the previous recorded end KM (${previousKm}).`); setLoading(false); return;
    }
    if (lrNumber) {
      const { data: existingLR } = await supabase.from("trips").select("lr_number").eq("lr_number", lrNumber).maybeSingle();
      if (existingLR) {
        alert(`SECURITY BLOCK: The LR Number "${lrNumber}" already exists.`); setLoading(false); return;
      }
    }
    
    setLoading(false);
    setShowConfirm(true);
  };

  // Step 2: Final dispatch after confirmation
  const confirmDispatch = async () => {
    setLoading(true);
    let finalDriverId = driverId;
    if (driverMode === "manual") {
      const { data: newDriver, error: driverErr } = await supabase.from("drivers").insert([{
        name: newDriverName, phone_number: newDriverPhone, license_number: newDriverLicense, license_expiry: newDriverExpiry, is_active: true
      }]).select().single();
      
      if (driverErr) { alert("Failed to register new driver. Error: " + driverErr.message); setLoading(false); setShowConfirm(false); return; }
      finalDriverId = newDriver.id || newDriver.driver_id;
    }

    const tripData = {
      trip_start_date: tripDate, lr_number: lrNumber.toUpperCase(), cargo_type: cargoType, vehicle_id: truckId,
      primary_driver_id: finalDriverId, source: source, destination: destination, tonnage_loaded: Number(tonnage),
      freight_revenue: Number(freightRevenue), driver_bata: Number(driverBata), cash_advance_issued: Number(advance),
      diesel_issued: Number(dieselIssued), start_km: Number(startKm), is_tank_full: tankFull, trip_status: "WAITING_FOR_LOAD"
    };

    const { error } = await supabase.from("trips").insert([tripData]);
    
    if (!error) {
      setSuccess(true);
      setShowConfirm(false);
      handleClear();
    } else {
      alert("Error dispatching trip: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 relative">
      
      {/* Liquid Glass Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
          <div className="liquid-glass rounded-3xl p-6 sm:p-8 w-full max-w-md border border-white/[0.1] shadow-2xl scale-in-center">
            <h3 className="text-lg font-bold text-white mb-2">Confirm Trip Dispatch</h3>
            <p className="text-xs text-white/60 mb-6">You are about to lock this trip into the live operations log. Please verify the financials.</p>
            
            <div className="space-y-3 mb-8 bg-black/30 p-4 rounded-xl border border-white/[0.05]">
              <div className="flex justify-between text-xs">
                <span className="text-white/50 uppercase tracking-wider font-semibold">LR Number:</span>
                <span className="text-white font-bold">{lrNumber.toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/50 uppercase tracking-wider font-semibold">Route:</span>
                <span className="text-white font-bold text-right">{source} <br/>↓<br/> {destination}</span>
              </div>
              <div className="flex justify-between text-xs pt-2 border-t border-white/[0.05]">
                <span className="text-white/50 uppercase tracking-wider font-semibold">Expected Revenue:</span>
                <span className="text-emerald-400 font-bold">₹{totalRevenue.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/50 uppercase tracking-wider font-semibold">Total Cash Issued:</span>
                <span className="text-rose-400 font-bold">₹{totalExpense.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowConfirm(false)} className="px-5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/70 font-bold hover:bg-white/[0.08] transition-all text-xs">Cancel</button>
              <button onClick={confirmDispatch} disabled={loading} className="btn-orange-glow px-6 py-2.5 rounded-xl text-xs font-bold tracking-wide">
                {loading ? "Dispatching..." : "Confirm & Dispatch"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-wide">Dispatch New Trip</h2>
          <p className="text-[11px] text-white/50 mt-0.5">Unified strict-validation logistics console</p>
        </div>
      </div>

      <form onSubmit={handleReview} className="space-y-4">
        
        {/* ROW 1: Core Identifiers */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <label className="block text-[10px] font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Trip Date</label>
            <input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} className={compactInput} required />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[10px] font-semibold text-white/50 mb-1.5 uppercase tracking-wider">LR Number</label>
            <input type="text" value={lrNumber} onChange={(e) => setLrNumber(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))} placeholder="KSS..." className={`${compactInput} uppercase font-mono`} required pattern="[A-Za-z0-9]+" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[10px] font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Cargo Type</label>
            <div className="flex gap-1">
              <button type="button" onClick={() => { setCargoType("BULK"); setTruckId(""); setPreviousKm(null); setStartKm(""); }} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ios-spring ${cargoType === "BULK" ? "bg-[#FF9F0A] text-black" : "bg-white/[0.02] text-white/50 border border-white/[0.06]"}`}>BULK</button>
              <button type="button" onClick={() => { setCargoType("BAG"); setTruckId(""); setPreviousKm(null); setStartKm(""); }} className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ios-spring ${cargoType === "BAG" ? "bg-[#FF9F0A] text-black" : "bg-white/[0.02] text-white/50 border border-white/[0.06]"}`}>BAG</button>
            </div>
          </div>
          <div className="md:col-span-3">
            <label className="block text-[10px] font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Assign Truck</label>
            <select value={truckId} onChange={(e) => setTruckId(e.target.value)} className={`${compactInput} bg-[#020203]`} required>
              <option value="" className="text-white/40">Select...</option>
              {filteredVehicles.map(v => (
                <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ROW 2: Routing & Driver */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 rounded-2xl bg-white/[0.01] border border-white/[0.04]">
          <div className="md:col-span-4">
            <label className="block text-[10px] font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Origin</label>
            <div className="flex gap-1.5">
              {sourceMode === "select" ? (
                <select value={source} onChange={(e) => setSource(e.target.value)} className={`${compactInput} flex-1 bg-[#020203]`} required>
                  <option value="">Select...</option>
                  {historicalSources.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Type..." className={`${compactInput} flex-1`} required />
              )}
              <button type="button" onClick={() => setSourceMode(prev => prev === "select" ? "manual" : "select")} className="px-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/60 font-bold hover:bg-white/[0.08]" title="Toggle Manual">+</button>
            </div>
          </div>

          <div className="md:col-span-4">
            <label className="block text-[10px] font-semibold text-white/50 mb-1.5 uppercase tracking-wider">Destination</label>
            <div className="flex gap-1.5">
              {destMode === "select" ? (
                <select value={destination} onChange={(e) => setDestination(e.target.value)} className={`${compactInput} flex-1 bg-[#020203]`} required>
                  <option value="">Select...</option>
                  {historicalDestinations.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              ) : (
                <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Type..." className={`${compactInput} flex-1`} required />
              )}
              <button type="button" onClick={() => setDestMode(prev => prev === "select" ? "manual" : "select")} className="px-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/60 font-bold hover:bg-white/[0.08]" title="Toggle Manual">+</button>
            </div>
          </div>

          <div className="md:col-span-4">
            <div className="flex justify-between items-end mb-1.5">
              <label className="block text-[10px] font-semibold text-[#FF9F0A] uppercase tracking-wider">Pilot</label>
              <button type="button" onClick={() => setDriverMode(prev => prev === "select" ? "manual" : "select")} className="text-[9px] font-bold text-white/50 hover:text-white transition-all uppercase">{driverMode === "select" ? "+ New" : "≡ List"}</button>
            </div>
            {driverMode === "select" ? (
              <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className={`${compactInput} bg-[#020203]`} required>
                <option value="">Select driver...</option>
                {drivers.map(d => (
                  <option key={d.driver_id || d.id} value={d.driver_id || d.id}>{d.name}</option>
                ))}
              </select>
            ) : (
              <div className="flex gap-2">
                <input type="text" placeholder="Name" value={newDriverName} onChange={e => setNewDriverName(e.target.value)} className={compactInput} required />
                <input type="tel" placeholder="Phone" value={newDriverPhone} onChange={e => setNewDriverPhone(e.target.value)} className={compactInput} required />
              </div>
            )}
          </div>
        </div>

        {/* ROW 3: Financials & Telemetry */}
        <div className="grid grid-cols-2 md:grid-cols-12 gap-3">
          <div className="md:col-span-2">
            <label className="block text-[9px] font-semibold text-white/40 mb-1.5 uppercase tracking-wider">Tonnage (MT)</label>
            <input type="number" {...strictNumberProps} step="0.01" value={tonnage} onChange={(e) => setTonnage(e.target.value)} className={compactInput} placeholder="0.00" required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[9px] font-semibold text-white/40 mb-1.5 uppercase tracking-wider">Freight (₹)</label>
            <input type="number" {...strictNumberProps} value={freightRevenue} onChange={(e) => setFreightRevenue(e.target.value)} className={compactInput} placeholder="0.00" required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[9px] font-semibold text-white/40 mb-1.5 uppercase tracking-wider">Bata (₹)</label>
            <input type="number" {...strictNumberProps} value={driverBata} onChange={(e) => setDriverBata(e.target.value)} className={compactInput} placeholder="0.00" required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[9px] font-semibold text-white/40 mb-1.5 uppercase tracking-wider">Advance (₹)</label>
            <input type="number" {...strictNumberProps} value={advance} onChange={(e) => setAdvance(e.target.value)} className={compactInput} placeholder="0.00" required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[9px] font-semibold text-[#FF9F0A] mb-1.5 uppercase tracking-wider" title={`Previous: ${previousKm ?? 'N/A'}`}>Start KM</label>
            <input type="number" {...strictNumberProps} value={startKm} onChange={(e) => setStartKm(e.target.value)} className={`${compactInput} font-mono border-[#FF9F0A]/30`} placeholder={previousKm ? String(previousKm) : "0"} required />
          </div>
          <div className="md:col-span-2 relative">
            <label className="block text-[9px] font-semibold text-[#FF9F0A] mb-1.5 uppercase tracking-wider">Diesel (L)</label>
            <div className="relative">
              <input type="number" {...strictNumberProps} step="0.01" value={dieselIssued} onChange={(e) => setDieselIssued(e.target.value)} className={`${compactInput} font-mono border-[#FF9F0A]/30 pr-8`} placeholder="0.00" required />
              <label className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer flex items-center" title="Tank Full Marker">
                <input type="checkbox" checked={tankFull} onChange={(e) => setTankFull(e.target.checked)} className="w-4 h-4 rounded-sm bg-black/40 border border-[#FF9F0A]/50 text-[#FF9F0A] focus:ring-0 cursor-pointer appearance-none checked:bg-[#FF9F0A] flex items-center justify-center relative after:content-[''] after:w-1 after:h-2 after:border-r-2 after:border-b-2 after:border-black after:rotate-45 after:absolute after:hidden checked:after:block after:-mt-0.5" />
              </label>
            </div>
          </div>
        </div>

        {/* Live Calculation & Controls Bar */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          <div className="flex items-center gap-6 overflow-x-auto pb-2 md:pb-0">
            <div>
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-0.5">Total Revenue</p>
              <p className="text-sm font-bold text-emerald-400">₹{totalRevenue.toLocaleString('en-IN')}</p>
            </div>
            <div className="w-px h-8 bg-white/[0.08]"></div>
            <div>
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-0.5">Trip Expense (Cash)</p>
              <p className="text-sm font-bold text-rose-400">₹{totalExpense.toLocaleString('en-IN')}</p>
            </div>
            <div className="w-px h-8 bg-white/[0.08]"></div>
            <div>
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-0.5">Expected Margin</p>
              <p className="text-sm font-bold text-white">₹{netMargin.toLocaleString('en-IN')}</p>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 w-full md:w-auto">
            <button type="button" onClick={handleClear} className="px-5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/70 font-bold hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 transition-all text-xs ios-spring">
              Clear
            </button>
            <button type="submit" disabled={loading} className="btn-orange-glow px-6 py-2.5 rounded-xl text-xs font-bold tracking-wide shadow-[0_0_15px_rgba(255,159,10,0.3)]">
              Review & Dispatch
            </button>
          </div>
        </div>

        {success && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center font-bold">
            Trip successfully registered and dispatched to live telemetry!
          </div>
        )}
      </form>
    </div>
  );
}
