"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal"; 

export function WorkshopModule() {
  const supabase = createClient();
  const [wTab, setWTab] = useState("Tyre Management");
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal State
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: "", message: "", isDanger: false, confirmText: "Confirm", action: async () => {} });
  const triggerModal = (title: string, message: string, isDanger: boolean, confirmText: string, action: () => Promise<void>) => setModalConfig({ isOpen: true, title, message, isDanger, confirmText, action });
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  // Tyre States
  const [truckId, setTruckId] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [brand, setBrand] = useState("");
  const [position, setPosition] = useState("FRONT_LEFT");
  const [condition, setCondition] = useState("NEW");
  const [nsdMm, setNsdMm] = useState<number | "">(15.0);
  const [activeTyres, setActiveTyres] = useState<any[]>([]);

  // Spares States
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [wsTruckId, setWsTruckId] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [activeBills, setActiveBills] = useState<any[]>([]);

  const fetchData = async () => {
    const { data: vData } = await supabase.from('vehicles').select('*').eq('is_active', true).order('vehicle_number');
    if (vData) setVehicles(vData);

    const { data: tData } = await supabase.from('fleet_tyres').select('*, vehicles(vehicle_number)').order('mounted_date', { ascending: false });
    if (tData) setActiveTyres(tData);

    const { data: bData } = await supabase.from('workshop_spares_bills').select('*, vehicles(vehicle_number)').order('bill_date', { ascending: false });
    if (bData) setActiveBills(bData);
  };

  useEffect(() => { fetchData(); }, []);

  const handleMountTyre = (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckId || !serialNo.trim()) return;

    triggerModal("Mount New Tyre", `Register tyre ${serialNo.toUpperCase()} to this vehicle?`, false, "Register Tyre", async () => {
      setIsProcessing(true);
      await supabase.from('fleet_tyres').insert([{
        vehicle_id: Number(truckId), serial_number: serialNo.toUpperCase().trim(), brand_model: brand.toUpperCase().trim(),
        placement_position: position, tyre_condition: condition, nsd_depth_mm: Number(nsdMm) || 0, mounted_date: new Date().toISOString().split('T')[0]
      }]);
      setSerialNo(""); setBrand(""); fetchData(); setIsProcessing(false); closeModal();
    });
  };

  const handleSaveBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsTruckId || !vendor.trim() || Number(amount) <= 0) return;

    triggerModal("Record Service Bill", `Log ₹${amount} expense from ${vendor}?`, false, "Save Bill", async () => {
      setIsProcessing(true);
      await supabase.from('workshop_spares_bills').insert([{
        bill_date: billDate, vehicle_id: Number(wsTruckId), vendor_name: vendor.trim(),
        service_description: description.trim(), bill_amount: Number(amount)
      }]);
      setVendor(""); setDescription(""); setAmount(""); fetchData(); setIsProcessing(false); closeModal();
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} isDanger={modalConfig.isDanger} confirmText={modalConfig.confirmText} onConfirm={modalConfig.action} onCancel={closeModal} isProcessing={isProcessing} />

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {["Tyre Management", "Spares & Service Bills"].map((tab) => (
          <button key={tab} onClick={() => setWTab(tab)} className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${wTab === tab ? "bg-[#FF5A00] text-white shadow-sm ring-1 ring-[#FF5A00]" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"}`}>{tab}</button>
        ))}
      </div>

      {wTab === "Tyre Management" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm max-w-4xl mx-auto animate-in slide-in-from-bottom-4">
          <h3 className="text-sm font-black text-slate-900 uppercase border-b border-slate-100 pb-3 mb-6">Register / Mount Tyre</h3>
          <form onSubmit={handleMountTyre} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Truck *</label>
              <select value={truckId} onChange={e => setTruckId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold" required>
                <option value="">-- SELECT TRUCK --</option>
                {vehicles.map(v => <option key={v.vehicle_id} value={String(v.vehicle_id)}>{v.vehicle_number}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Serial Number *</label><input type="text" value={serialNo} onChange={e => setSerialNo(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 uppercase outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold" required /></div>
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Brand / Model</label><input type="text" value={brand} onChange={e => setBrand(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 uppercase outline-none focus:ring-2 focus:ring-[#FF5A00] font-semibold" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Position</label>
                <select value={position} onChange={e => setPosition(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-semibold"><option value="FRONT_LEFT">FRONT_LEFT</option><option value="FRONT_RIGHT">FRONT_RIGHT</option><option value="DRIVE">DRIVE AXLE</option><option value="STEPNEY">STEPNEY</option></select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Condition</label>
                <select value={condition} onChange={e => setCondition(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-semibold"><option value="NEW">NEW</option><option value="RETREADED">RETREADED</option></select>
              </div>
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">NSD (MM)</label><input type="number" step="0.1" value={nsdMm} onChange={e => setNsdMm(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold" /></div>
            </div>
            <button type="submit" disabled={isProcessing} className="w-full py-3.5 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-sm rounded-xl transition-all shadow-sm active:scale-95">Mount & Register Tyre</button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <h4 className="text-xs font-black text-slate-900 uppercase mb-3">Active Fleet Tyres</h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                <thead className="bg-slate-50"><tr className="font-bold text-slate-500 uppercase"><th className="px-4 py-2">Truck</th><th className="px-4 py-2">Serial / Brand</th><th className="px-4 py-2">Position</th><th className="px-4 py-2 text-right">NSD</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {activeTyres.map(t => (
                    <tr key={t.tyre_id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-bold">{t.vehicles?.vehicle_number}</td><td className="px-4 py-2 font-mono">{t.serial_number} <span className="text-slate-400 text-[10px]">{t.brand_model}</span></td><td className="px-4 py-2 text-slate-600">{t.placement_position}</td><td className="px-4 py-2 text-right font-bold text-[#FF5A00]">{t.nsd_depth_mm} mm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {wTab === "Spares & Service Bills" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm max-w-4xl mx-auto animate-in slide-in-from-bottom-4">
          <h3 className="text-sm font-black text-slate-900 uppercase border-b border-slate-100 pb-3 mb-6">Log Service Bill</h3>
          <form onSubmit={handleSaveBill} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bill Date *</label><input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]" required /></div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Truck *</label>
                <select value={wsTruckId} onChange={e => setWsTruckId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold" required>
                  <option value="">-- SELECT TRUCK --</option>
                  {vehicles.map(v => <option key={v.vehicle_id} value={String(v.vehicle_id)}>{v.vehicle_number}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vendor / Workshop Name *</label><input type="text" value={vendor} onChange={e => setVendor(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-semibold" required /></div>
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Bill Amount (₹) *</label><input type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold text-rose-600" required /></div>
            </div>
            <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Parts & Service Description</label><input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Engine oil change, 2 brake pads" className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]" /></div>
            <button type="submit" disabled={isProcessing} className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm rounded-xl transition-all shadow-sm active:scale-95">Save Service Record</button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <h4 className="text-xs font-black text-slate-900 uppercase mb-3">Recent Workshop Bills</h4>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                <thead className="bg-slate-50"><tr className="font-bold text-slate-500 uppercase"><th className="px-4 py-2">Date</th><th className="px-4 py-2">Truck</th><th className="px-4 py-2">Vendor & Details</th><th className="px-4 py-2 text-right">Amount (₹)</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {activeBills.map(b => (
                    <tr key={b.bill_id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-semibold text-slate-700">{b.bill_date}</td><td className="px-4 py-2 font-bold text-slate-900">{b.vehicles?.vehicle_number}</td><td className="px-4 py-2 text-slate-600">{b.vendor_name} <br/><span className="text-[10px] text-slate-400">{b.service_description}</span></td><td className="px-4 py-2 text-right font-black text-rose-600">₹{b.bill_amount}</td>
                    </tr>
                  ))}
                  {activeBills.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">No service bills recorded.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
