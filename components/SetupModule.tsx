"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function SetupModule() {
  const supabase = createClient();
  const [setupNav, setSetupNav] = useState("🚚 Trucks");
  const [isLoading, setIsLoading] = useState(true);

  // Master Data Lists
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [freightRates, setFreightRates] = useState<any[]>([]);
  const [bataRates, setBataRates] = useState<any[]>([]);

  // TRUCK FORM STATES
  const [tNo, setTNo] = useState("");
  const [tVariant, setTVariant] = useState("Bulker (16-Wheel)");
  const [tCap, setTCap] = useState<number>(35.0);
  const [tOdo, setTOdo] = useState(true);

  // DRIVER FORM STATES
  const [dCode, setDCode] = useState("");
  const [dName, setDName] = useState("");
  const [dPhone, setDPhone] = useState("");
  const [dLicense, setDLicense] = useState("");

  // SLAB FORM STATES
  const [sCargo, setSCargo] = useState("BULK");
  const [sOrigin, setSOrigin] = useState("COCHIN");
  const [sDest, setSDest] = useState("");
  const [sCap, setSCap] = useState<number>(35.0);
  const [sRate, setSRate] = useState<number | "">("");
  const [sKm, setSKm] = useState<number | "">("");

  // BATA FORM STATES
  const [bOrigin, setBOrigin] = useState("COCHIN");
  const [bDest, setBDest] = useState("");
  const [bCargo, setBCargo] = useState("BULK");
  const [bCap, setBCap] = useState<number>(35.0);
  const [bAmount, setBAmount] = useState<number | "">("");

  const STANDARD_SOURCES = ["COCHIN", "POTTANERI", "METTUR", "UDUPPI", "COCHIN-ACC", "TUTICORIN"];

  const fetchData = async () => {
    setIsLoading(true);
    if (setupNav === "🚚 Trucks") {
      const { data } = await supabase.from('vehicles').select('*').order('vehicle_number');
      if (data) setVehicles(data);
    } else if (setupNav === "👨‍✈️ Drivers") {
      const { data } = await supabase.from('drivers').select('*').order('full_name');
      if (data) {
        setDrivers(data);
        // Auto-generate next driver code
        if (dCode === "") setDCode(`DRV-${String(data.length + 1).padStart(3, '0')}`);
      }
    } else if (setupNav === "🛣️ Slabs") {
      const { data } = await supabase.from('destinations_freight_master').select('*').order('destination_name');
      if (data) setFreightRates(data);
    } else if (setupNav === "💰 Bata") {
      const { data } = await supabase.from('driver_bata_master').select('*').order('destination_name');
      if (data) setBataRates(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [setupNav]);

  // --- HANDLERS ---

  const handleSaveTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('vehicles').insert([{
      vehicle_number: tNo.toUpperCase(), truck_type: tVariant, carrying_capacity_tons: tCap, 
      current_status: 'AVAILABLE_FOR_LOAD', odometer_working: tOdo, is_active: true
    }]);
    if (error) alert("Error: " + error.message);
    else { alert("Truck Saved!"); setTNo(""); fetchData(); }
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('drivers').insert([{
      driver_code: dCode.toUpperCase(), full_name: dName, phone_number: dPhone, 
      license_number: dLicense.toUpperCase(), is_active: true, branch_id: 1
    }]);
    if (error) alert("Error: " + error.message);
    else { alert("Driver Saved!"); setDName(""); setDPhone(""); setDLicense(""); fetchData(); }
  };

  const handleSaveSlab = async (e: React.FormEvent) => {
    e.preventDefault();
    // Legacy Streamlit Logic: If BAG, auto-insert for 25 and 30 MT
    const capacitiesToInsert = sCargo === "BAG" ? [25.0, 30.0] : [sCap];
    
    const inserts = capacitiesToInsert.map(cap => ({
      cargo_type: sCargo, origin: sOrigin, destination_name: sDest.toUpperCase(),
      capacity_tons: cap, freight_rate_per_ton: Number(sRate), standard_km: Number(sKm), is_active: true
    }));

    const { error } = await supabase.from('destinations_freight_master').insert(inserts);
    if (error) alert("Error: " + error.message);
    else { alert("Route Slab(s) Saved!"); setSDest(""); setSRate(""); setSKm(""); fetchData(); }
  };

  const handleSaveBata = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('driver_bata_master').insert([{
      origin: bOrigin, destination_name: bDest.toUpperCase(), cargo_type: bCargo, 
      capacity_tons: bCap, standard_bata_inr: Number(bAmount)
    }]);
    if (error) alert("Error: " + error.message);
    else { alert("Bata Rule Saved!"); setBDest(""); setBAmount(""); fetchData(); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Sub-Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {["🚚 Trucks", "👨‍✈️ Drivers", "🛣️ Slabs", "💰 Bata", "📋 System Audit"].map((tab) => (
          <button
            key={tab}
            onClick={() => setSetupNav(tab)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              setupNav === tab ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT PANEL: Form */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3 mb-5">
            Add New {setupNav.split(" ")[1]}
          </h3>

          {setupNav === "🚚 Trucks" && (
            <form onSubmit={handleSaveTruck} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Truck No *</label>
                <input type="text" value={tNo} onChange={e => setTNo(e.target.value)} placeholder="e.g. TN 56 F 0452" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 uppercase outline-none focus:ring-2 focus:ring-indigo-500 font-bold" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Variant</label>
                <select value={tVariant} onChange={e => setTVariant(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>Bulker (16-Wheel)</option><option>Bulker (14-Wheel)</option><option>Bulker</option><option>Body Truck</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Capacity (MT)</label>
                <select value={tCap} onChange={e => setTCap(Number(e.target.value))} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value={25.0}>25.0 MT</option><option value={30.0}>30.0 MT</option><option value={35.0}>35.0 MT</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input type="checkbox" checked={tOdo} onChange={e => setTOdo(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                <span className="text-xs font-bold text-slate-700">✅ Odometer Working</span>
              </label>
              <button type="submit" className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm">Save Truck</button>
            </form>
          )}

          {setupNav === "👨‍✈️ Drivers" && (
            <form onSubmit={handleSaveDriver} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Driver Code *</label>
                <input type="text" value={dCode} onChange={e => setDCode(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 uppercase outline-none focus:ring-2 focus:ring-indigo-500 font-bold" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name *</label>
                <input type="text" value={dName} onChange={e => setDName(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number *</label>
                <input type="text" value={dPhone} onChange={e => setDPhone(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">License No</label>
                <input type="text" value={dLicense} onChange={e => setDLicense(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 uppercase outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <button type="submit" className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm">Save Driver</button>
            </form>
          )}

          {setupNav === "🛣️ Slabs" && (
            <form onSubmit={handleSaveSlab} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cargo Type</label>
                <select value={sCargo} onChange={e => setSCargo(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="BULK">BULK</option><option value="BAG">BAG</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Origin</label>
                <select value={sOrigin} onChange={e => setSOrigin(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500">
                  {STANDARD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Destination *</label>
                <input type="text" value={sDest} onChange={e => setSDest(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 uppercase outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Class (MT)</label>
                <select value={sCap} onChange={e => setSCap(Number(e.target.value))} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500" disabled={sCargo === "BAG"}>
                  <option value={25.0}>25.0</option><option value={30.0}>30.0</option><option value={35.0}>35.0</option>
                </select>
                {sCargo === "BAG" && <p className="text-[9px] text-slate-400 mt-1">BAG slabs auto-save for both 25MT and 30MT.</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rate/MT (₹) *</label>
                  <input type="number" step="0.01" value={sRate} onChange={e => setSRate(parseFloat(e.target.value))} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-emerald-700" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Std KM</label>
                  <input type="number" value={sKm} onChange={e => setSKm(parseFloat(e.target.value))} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <button type="submit" className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm">Save Route</button>
            </form>
          )}

          {setupNav === "💰 Bata" && (
            <form onSubmit={handleSaveBata} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Origin</label>
                <select value={bOrigin} onChange={e => setBOrigin(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500">
                  {STANDARD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Destination *</label>
                <input type="text" value={bDest} onChange={e => setBDest(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 uppercase outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cargo</label>
                  <select value={bCargo} onChange={e => setBCargo(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="BULK">BULK</option><option value="BAG">BAG</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Capacity</label>
                  <select value={bCap} onChange={e => setBCap(Number(e.target.value))} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value={25.0}>25.0 MT</option><option value={30.0}>30.0 MT</option><option value={35.0}>35.0 MT</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Standard Bata (₹) *</label>
                <input type="number" value={bAmount} onChange={e => setBAmount(parseFloat(e.target.value))} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700" required />
              </div>
              <button type="submit" className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm">Save Bata Rule</button>
            </form>
          )}

        </div>

        {/* RIGHT PANEL: Database Table */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3 mb-5">
            Database Records
          </h3>
          
          <div className="overflow-x-auto flex-1 max-h-[600px] overflow-y-auto">
            {setupNav === "🚚 Trucks" && (
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="font-bold text-slate-500 uppercase"><th className="px-4 py-2">Truck No</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">MT</th><th className="px-4 py-2">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vehicles.map(v => <tr key={v.vehicle_id} className="hover:bg-slate-50"><td className="px-4 py-3 font-bold text-slate-900">{v.vehicle_number}</td><td className="px-4 py-3 text-slate-600">{v.truck_type}</td><td className="px-4 py-3 text-slate-600">{v.carrying_capacity_tons}</td><td className="px-4 py-3 text-slate-600">{v.current_status}</td></tr>)}
                </tbody>
              </table>
            )}

            {setupNav === "👨‍✈️ Drivers" && (
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="font-bold text-slate-500 uppercase"><th className="px-4 py-2">Code</th><th className="px-4 py-2">Name</th><th className="px-4 py-2">Phone</th><th className="px-4 py-2">License</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {drivers.map(d => <tr key={d.driver_id} className="hover:bg-slate-50"><td className="px-4 py-3 font-bold text-slate-900">{d.driver_code}</td><td className="px-4 py-3 text-slate-800">{d.full_name}</td><td className="px-4 py-3 text-slate-600">{d.phone_number}</td><td className="px-4 py-3 text-slate-600">{d.license_number || "-"}</td></tr>)}
                </tbody>
              </table>
            )}

            {setupNav === "🛣️ Slabs" && (
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="font-bold text-slate-500 uppercase"><th className="px-4 py-2">Cargo</th><th className="px-4 py-2">Route</th><th className="px-4 py-2 text-center">MT</th><th className="px-4 py-2 text-right">Rate/MT (₹)</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {freightRates.map(r => <tr key={r.id} className="hover:bg-slate-50"><td className="px-4 py-3 text-slate-600">{r.cargo_type}</td><td className="px-4 py-3 font-bold text-slate-900">{r.origin} ➔ {r.destination_name}</td><td className="px-4 py-3 text-center text-slate-600">{r.capacity_tons}</td><td className="px-4 py-3 text-right font-black text-emerald-600">{r.freight_rate_per_ton}</td></tr>)}
                </tbody>
              </table>
            )}

            {setupNav === "💰 Bata" && (
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="font-bold text-slate-500 uppercase"><th className="px-4 py-2">Route</th><th className="px-4 py-2">Cargo Class</th><th className="px-4 py-2 text-right">Bata (₹)</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bataRates.map(b => <tr key={b.id || Math.random()} className="hover:bg-slate-50"><td className="px-4 py-3 font-bold text-slate-900">{b.origin} ➔ {b.destination_name}</td><td className="px-4 py-3 text-slate-600">{b.capacity_tons}MT {b.cargo_type}</td><td className="px-4 py-3 text-right font-black text-indigo-600">{b.standard_bata_inr}</td></tr>)}
                </tbody>
              </table>
            )}

            {setupNav === "📋 System Audit" && (
              <div className="text-center p-12">
                <p className="text-slate-500 font-medium">System Audit (Hard Delete functionality) will be integrated here.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
