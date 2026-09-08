"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function WorkshopModule() {
  const supabase = createClient();
  const [wTab, setWTab] = useState("Tyre Management");
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Tyre Form States
  const [truckId, setTruckId] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [brand, setBrand] = useState("");
  const [position, setPosition] = useState("FRONT_LEFT");
  const [condition, setCondition] = useState("NEW");
  const [nsdMm, setNsdMm] = useState<number | "">(15.0);
  const [activeTyres, setActiveTyres] = useState<any[]>([]);

  useEffect(() => {
    async function loadVehicles() {
      const { data } = await supabase.from('vehicles').select('*').eq('is_active', true).order('vehicle_number');
      if (data) setVehicles(data);
    }
    loadVehicles();
  }, [supabase]);

  const fetchTyres = async () => {
    const { data } = await supabase.from('fleet_tyres').select('*, vehicles(vehicle_number)').order('mounted_date', { ascending: false });
    if (data) setActiveTyres(data);
  };

  useEffect(() => {
    fetchTyres();
  }, []);

  const handleMountTyre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckId || !serialNo.trim()) return alert("Vehicle and Serial Number are required.");
    setIsProcessing(true);

    const { error } = await supabase.from('fleet_tyres').insert([{
      vehicle_id: Number(truckId),
      serial_number: serialNo.toUpperCase().trim(),
      brand_model: brand.toUpperCase().trim(),
      placement_position: position,
      tyre_condition: condition,
      nsd_depth_mm: Number(nsdMm) || 0,
      mounted_date: new Date().toISOString().split('T')[0]
    }]);

    if (error) alert("Error mounting tyre: " + error.message);
    else {
      alert("Tyre registered successfully!");
      setSerialNo(""); setBrand("");
      fetchTyres();
    }
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Sub-Navigation (Uniform Orange Pills) */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {["Tyre Management", "Spares & Service Bills"].map((tab) => (
          <button
            key={tab}
            onClick={() => setWTab(tab)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              wTab === tab 
                ? "bg-orange-600 text-white shadow-sm ring-1 ring-orange-600" 
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {wTab === "Tyre Management" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm max-w-4xl mx-auto">
          <h3 className="text-sm font-black text-slate-900 uppercase border-b border-slate-100 pb-3 mb-6">Register / Mount Tyre</h3>
          
          <form onSubmit={handleMountTyre} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Truck *</label>
              <select value={truckId} onChange={e => setTruckId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-orange-500 font-bold" required>
                <option value="">-- SELECT TRUCK --</option>
                {vehicles.map(v => <option key={v.vehicle_id} value={String(v.vehicle_id)}>{v.vehicle_number} [{v.truck_type}]</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Serial Number *</label>
                <input type="text" value={serialNo} onChange={e => setSerialNo(e.target.value)} placeholder="Tyre Serial No" className="w-full text-sm p-3 rounded-xl border border-slate-300 uppercase outline-none focus:ring-2 focus:ring-orange-500 font-bold" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Brand / Model</label>
                <input type="text" value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. MRF / Apollo" className="w-full text-sm p-3 rounded-xl border border-slate-300 uppercase outline-none focus:ring-2 focus:ring-orange-500 font-semibold" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Placement Position</label>
                <select value={position} onChange={e => setPosition(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-orange-500 font-semibold">
                  <option value="FRONT_LEFT">FRONT_LEFT</option>
                  <option value="FRONT_RIGHT">FRONT_RIGHT</option>
                  <option value="DRIVE_OUTER_LEFT">DRIVE_OUTER_LEFT</option>
                  <option value="DRIVE_INNER_LEFT">DRIVE_INNER_LEFT</option>
                  <option value="DRIVE_OUTER_RIGHT">DRIVE_OUTER_RIGHT</option>
                  <option value="DRIVE_INNER_RIGHT">DRIVE_INNER_RIGHT</option>
                  <option value="STEPNEY">STEPNEY</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Condition</label>
                <select value={condition} onChange={e => setCondition(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-orange-500 font-semibold">
                  <option value="NEW">NEW</option>
                  <option value="RETREADED">RETREADED</option>
                  <option value="USED">USED</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">NSD (Non-Skid Depth MM)</label>
              <input type="number" step="0.1" value={nsdMm} onChange={e => setNsdMm(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-orange-500 font-bold" />
            </div>

            <div className="pt-2">
              <button type="submit" disabled={isProcessing} className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-black text-sm rounded-xl transition-all shadow-sm active:scale-95">
                {isProcessing ? "Mounting..." : "Mount & Register Tyre"}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <h4 className="text-xs font-black text-slate-900 uppercase mb-3">Active Fleet Tyres ({activeTyres.length})</h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr className="text-left font-bold text-slate-500 uppercase">
                    <th className="px-4 py-2">Truck</th>
                    <th className="px-4 py-2">Serial</th>
                    <th className="px-4 py-2">Position</th>
                    <th className="px-4 py-2 text-right">NSD (mm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeTyres.map(t => (
                    <tr key={t.tyre_id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-bold">{t.vehicles?.vehicle_number}</td>
                      <td className="px-4 py-2 font-mono">{t.serial_number}</td>
                      <td className="px-4 py-2 text-slate-600">{t.placement_position}</td>
                      <td className="px-4 py-2 text-right font-bold text-orange-600">{t.nsd_depth_mm}</td>
                    </tr>
                  ))}
                  {activeTyres.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">No tyres registered.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {wTab === "Spares & Service Bills" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-2xl mx-auto text-center py-12">
          <p className="text-sm font-bold text-slate-500">Spares & Service Bills interface mounted and aligned.</p>
        </div>
      )}

    </div>
  );
}
