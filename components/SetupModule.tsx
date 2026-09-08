"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal"; 

export function SetupModule() {
  const supabase = createClient();
  const [sTab, setSTab] = useState("Trucks");
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal State
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: "", message: "", isDanger: false, confirmText: "Confirm", action: async () => {} });
  const triggerModal = (title: string, message: string, isDanger: boolean, confirmText: string, action: () => Promise<void>) => setModalConfig({ isOpen: true, title, message, isDanger, confirmText, action });
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  // Data Lists
  const [trucksList, setTrucksList] = useState<any[]>([]);
  const [driversList, setDriversList] = useState<any[]>([]);
  const [slabsList, setSlabsList] = useState<any[]>([]);
  const [bataList, setBataList] = useState<any[]>([]);

  // Form States
  const [truckNo, setTruckNo] = useState(""); const [variant, setVariant] = useState("Bulker (16-Wheel)"); const [capacity, setCapacity] = useState("35.0 MT");
  
  const [driverName, setDriverName] = useState(""); const [driverCode, setDriverCode] = useState("");
  
  const STANDARD_SOURCES = ["COCHIN", "POTTANERI", "METTUR", "UDUPPI", "COCHIN-ACC", "TUTICORIN"];
  const [src, setSrc] = useState("COCHIN"); const [dest, setDest] = useState(""); const [cType, setCType] = useState("BULK"); const [cap, setCap] = useState("35");
  const [fRate, setFRate] = useState<number|"">(""); const [bataAmt, setBataAmt] = useState<number|"">("");

  const fetchData = async () => {
    const [v, d, s, b] = await Promise.all([
      supabase.from('vehicles').select('*').order('vehicle_number'),
      supabase.from('drivers').select('*').order('full_name'),
      supabase.from('destinations_freight_master').select('*').order('destination_name'),
      supabase.from('driver_bata_master').select('*').order('destination_name')
    ]);
    if (v.data) setTrucksList(v.data); if (d.data) setDriversList(d.data);
    if (s.data) setSlabsList(s.data); if (b.data) setBataList(b.data);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveTruck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckNo.trim()) return;
    triggerModal("Add Truck", `Register ${truckNo.toUpperCase()} to the fleet?`, false, "Save Truck", async () => {
      setIsProcessing(true);
      await supabase.from('vehicles').insert([{ vehicle_number: truckNo.toUpperCase().trim(), truck_type: variant, carrying_capacity_tons: parseFloat(capacity), current_status: "WAITING_FOR_LOAD", is_active: true }]);
      setTruckNo(""); fetchData(); setIsProcessing(false); closeModal();
    });
  };

  const handleSaveDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim() || !driverCode.trim()) return;
    triggerModal("Add Driver", `Register ${driverName} (${driverCode}) to the master list?`, false, "Save Driver", async () => {
      setIsProcessing(true);
      await supabase.from('drivers').insert([{ driver_code: driverCode.toUpperCase().trim(), full_name: driverName.toUpperCase().trim(), is_active: true }]);
      setDriverName(""); setDriverCode(""); fetchData(); setIsProcessing(false); closeModal();
    });
  };

  const handleSaveSlab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dest.trim() || !fRate) return;
    triggerModal("Add Freight Slab", `Lock in ₹${fRate}/MT for ${src} to ${dest}?`, false, "Save Slab", async () => {
      setIsProcessing(true);
      await supabase.from('destinations_freight_master').insert([{ origin: src, destination_name: dest.toUpperCase().trim(), cargo_type: cType, capacity_tons: Number(cap), freight_rate_per_ton: Number(fRate), is_active: true }]);
      setDest(""); setFRate(""); fetchData(); setIsProcessing(false); closeModal();
    });
  };

  const handleSaveBata = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dest.trim() || !bataAmt) return;
    triggerModal("Add Bata Master", `Set ₹${bataAmt} default Bata for ${src} to ${dest}?`, false, "Save Bata", async () => {
      setIsProcessing(true);
      await supabase.from('driver_bata_master').insert([{ origin: src, destination_name: dest.toUpperCase().trim(), cargo_type: cType, capacity_tons: Number(cap), standard_bata_inr: Number(bataAmt) }]);
      setDest(""); setBataAmt(""); fetchData(); setIsProcessing(false); closeModal();
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} isDanger={modalConfig.isDanger} confirmText={modalConfig.confirmText} onConfirm={modalConfig.action} onCancel={closeModal} isProcessing={isProcessing} />

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {[{ label: "Trucks", icon: "🚛" }, { label: "Drivers", icon: "👨‍✈️" }, { label: "Slabs", icon: "🛣️" }, { label: "Bata", icon: "💰" }].map((tab) => (
          <button key={tab.label} onClick={() => setSTab(tab.label)} className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${sTab === tab.label ? "bg-[#FF5A00] text-white shadow-sm ring-1 ring-[#FF5A00]" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"}`}>
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm max-w-4xl mx-auto animate-in slide-in-from-bottom-4">
        
        {/* TRUCKS */}
        {sTab === "Trucks" && (
          <>
            <h3 className="text-sm font-black text-slate-900 uppercase border-b border-slate-100 pb-3 mb-6">Add New Truck</h3>
            <form onSubmit={handleSaveTruck} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Truck No *</label><input type="text" value={truckNo} onChange={e=>setTruckNo(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold uppercase" required /></div>
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Variant</label><select value={variant} onChange={e=>setVariant(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none"><option>Bulker (16-Wheel)</option><option>Open Body (10-Wheel)</option></select></div>
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Capacity</label><select value={capacity} onChange={e=>setCapacity(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none"><option>35.0 MT</option><option>30.0 MT</option><option>25.0 MT</option></select></div>
              <button type="submit" disabled={isProcessing} className="w-full py-3 bg-[#FF5A00] text-white font-black rounded-xl hover:bg-[#e04f00] transition-colors shadow-sm">Save Truck</button>
            </form>
            <div className="mt-8 border-t border-slate-100 pt-6">
              <h4 className="text-xs font-black text-slate-900 uppercase mb-3">Registered Fleet</h4>
              <div className="flex flex-wrap gap-2">{trucksList.map(t => <span key={t.vehicle_id} className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-md border border-slate-200">{t.vehicle_number}</span>)}</div>
            </div>
          </>
        )}

        {/* DRIVERS */}
        {sTab === "Drivers" && (
          <>
            <h3 className="text-sm font-black text-slate-900 uppercase border-b border-slate-100 pb-3 mb-6">Add New Driver</h3>
            <form onSubmit={handleSaveDriver} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Driver Code *</label><input type="text" value={driverCode} onChange={e=>setDriverCode(e.target.value)} placeholder="e.g. DRV-001" className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold uppercase" required /></div>
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name *</label><input type="text" value={driverName} onChange={e=>setDriverName(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold uppercase" required /></div>
              <button type="submit" disabled={isProcessing} className="w-full py-3 bg-[#FF5A00] text-white font-black rounded-xl hover:bg-[#e04f00] transition-colors shadow-sm">Save Driver</button>
            </form>
            <div className="mt-8 border-t border-slate-100 pt-6">
              <h4 className="text-xs font-black text-slate-900 uppercase mb-3">Registered Drivers</h4>
              <div className="flex flex-wrap gap-2">{driversList.map(d => <span key={d.driver_id} className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-md border border-slate-200">{d.driver_code} - {d.full_name}</span>)}</div>
            </div>
          </>
        )}

        {/* SLABS */}
        {sTab === "Slabs" && (
          <>
            <h3 className="text-sm font-black text-slate-900 uppercase border-b border-slate-100 pb-3 mb-6">Add Freight Slab</h3>
            <form onSubmit={handleSaveSlab} className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
              <div className="col-span-1"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Source</label><select value={src} onChange={e=>setSrc(e.target.value)} className="w-full text-xs p-3 rounded-xl border border-slate-300 outline-none font-bold">{STANDARD_SOURCES.map(s=><option key={s}>{s}</option>)}</select></div>
              <div className="col-span-2"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Destination *</label><input type="text" value={dest} onChange={e=>setDest(e.target.value)} className="w-full text-xs p-3 rounded-xl border border-slate-300 outline-none uppercase font-bold" required /></div>
              <div className="col-span-1"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cargo</label><select value={cType} onChange={e=>setCType(e.target.value)} className="w-full text-xs p-3 rounded-xl border border-slate-300 outline-none"><option>BULK</option><option>BAG</option></select></div>
              <div className="col-span-1"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cap (MT)</label><select value={cap} onChange={e=>setCap(e.target.value)} className="w-full text-xs p-3 rounded-xl border border-slate-300 outline-none"><option>35</option><option>30</option><option>25</option></select></div>
              <div className="col-span-1"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rate(₹)</label><input type="number" value={fRate} onChange={e=>setFRate(parseFloat(e.target.value))} className="w-full text-xs p-3 rounded-xl border border-slate-300 outline-none font-black text-emerald-600" required /></div>
              <button type="submit" disabled={isProcessing} className="col-span-6 py-3 bg-[#FF5A00] text-white font-black rounded-xl hover:bg-[#e04f00] transition-colors mt-2">Save Freight Rule</button>
            </form>
            <div className="mt-8 border-t border-slate-100 pt-6 overflow-auto max-h-64">
              <table className="min-w-full text-xs text-left"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-2">Route</th><th className="p-2">Type</th><th className="p-2">Rate/MT</th></tr></thead><tbody className="divide-y divide-slate-100">{slabsList.map(s => <tr key={s.id}><td className="p-2 font-bold">{s.origin} ➔ {s.destination_name}</td><td className="p-2">{s.capacity_tons}MT {s.cargo_type}</td><td className="p-2 font-black text-emerald-600">₹{s.freight_rate_per_ton}</td></tr>)}</tbody></table>
            </div>
          </>
        )}

        {/* BATA */}
        {sTab === "Bata" && (
          <>
            <h3 className="text-sm font-black text-slate-900 uppercase border-b border-slate-100 pb-3 mb-6">Add Bata Rule</h3>
            <form onSubmit={handleSaveBata} className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
              <div className="col-span-1"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Source</label><select value={src} onChange={e=>setSrc(e.target.value)} className="w-full text-xs p-3 rounded-xl border border-slate-300 outline-none font-bold">{STANDARD_SOURCES.map(s=><option key={s}>{s}</option>)}</select></div>
              <div className="col-span-2"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Destination *</label><input type="text" value={dest} onChange={e=>setDest(e.target.value)} className="w-full text-xs p-3 rounded-xl border border-slate-300 outline-none uppercase font-bold" required /></div>
              <div className="col-span-1"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cargo</label><select value={cType} onChange={e=>setCType(e.target.value)} className="w-full text-xs p-3 rounded-xl border border-slate-300 outline-none"><option>BULK</option><option>BAG</option></select></div>
              <div className="col-span-1"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cap (MT)</label><select value={cap} onChange={e=>setCap(e.target.value)} className="w-full text-xs p-3 rounded-xl border border-slate-300 outline-none"><option>35</option><option>30</option><option>25</option></select></div>
              <div className="col-span-1"><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bata(₹)</label><input type="number" value={bataAmt} onChange={e=>setBataAmt(parseFloat(e.target.value))} className="w-full text-xs p-3 rounded-xl border border-slate-300 outline-none font-black text-indigo-600" required /></div>
              <button type="submit" disabled={isProcessing} className="col-span-6 py-3 bg-[#FF5A00] text-white font-black rounded-xl hover:bg-[#e04f00] transition-colors mt-2">Save Bata Rule</button>
            </form>
            <div className="mt-8 border-t border-slate-100 pt-6 overflow-auto max-h-64">
              <table className="min-w-full text-xs text-left"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-2">Route</th><th className="p-2">Type</th><th className="p-2">Bata Amt</th></tr></thead><tbody className="divide-y divide-slate-100">{bataList.map(b => <tr key={b.id}><td className="p-2 font-bold">{b.origin} ➔ {b.destination_name}</td><td className="p-2">{b.capacity_tons}MT {b.cargo_type}</td><td className="p-2 font-black text-indigo-600">₹{b.standard_bata_inr}</td></tr>)}</tbody></table>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
