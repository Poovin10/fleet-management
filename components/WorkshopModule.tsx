"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal"; 

export function WorkshopModule() {
  const supabase = createClient();
  const [wTab, setWTab] = useState("Tyre Management");
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modals
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: "", message: "", isDanger: false, confirmText: "Confirm", action: async () => {} });
  const triggerModal = (title: string, message: string, isDanger: boolean, confirmText: string, action: () => Promise<void>) => setModalConfig({ isOpen: true, title, message, isDanger, confirmText, action });
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  // Lifecycle Action Modal
  const [actionModal, setActionModal] = useState({ isOpen: false, tyre: null as any, mode: "" });
  const [nextState, setNextState] = useState("IN_STORE");
  const [actionOdo, setActionOdo] = useState<number|"">("");
  const [actionNsd, setActionNsd] = useState<number|"">("");
  const [actionTruckId, setActionTruckId] = useState("");
  const [actionPos, setActionPos] = useState("FRONT_LEFT");

  // Registration States
  const [regMode, setRegMode] = useState("IN_STORE"); // IN_STORE or MOUNTED
  const [truckId, setTruckId] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [brand, setBrand] = useState("");
  const [position, setPosition] = useState("FRONT_LEFT");
  const [condition, setCondition] = useState("NEW");
  const [nsdMm, setNsdMm] = useState<number | "">(15.0);
  const [mountOdo, setMountOdo] = useState<number | "">("");

  // Data Lists
  const [activeTyres, setActiveTyres] = useState<any[]>([]);
  const [activeBills, setActiveBills] = useState<any[]>([]);

  // Spares States
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [wsTruckId, setWsTruckId] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");

  // Helper to format dates from YYYY-MM-DD to DD/MM/YYYY
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    if (!dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const fetchData = async () => {
    const { data: vData } = await supabase.from('vehicles').select('*').eq('is_active', true).order('vehicle_number');
    if (vData) setVehicles(vData);

    const { data: tData } = await supabase.from('fleet_tyres').select('*, vehicles(vehicle_number)').order('mounted_date', { ascending: false });
    if (tData) setActiveTyres(tData);

    const { data: bData } = await supabase.from('workshop_spares_bills').select('*, vehicles(vehicle_number)').order('bill_date', { ascending: false });
    if (bData) setActiveBills(bData);
  };

  useEffect(() => { fetchData(); }, []);

  // --- 1. REGISTER NEW TYRE ---
  const handleRegisterTyre = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNo.trim()) return;
    if (regMode === "MOUNTED" && (!truckId || !mountOdo)) return alert("Truck and Odometer required to mount directly.");

    triggerModal("Register Tyre", `Add ${serialNo.toUpperCase()} to ${regMode === 'IN_STORE' ? 'Inventory' : 'Fleet'}?`, false, "Register", async () => {
      setIsProcessing(true);
      await supabase.from('fleet_tyres').insert([{
        vehicle_id: regMode === "MOUNTED" ? Number(truckId) : null,
        serial_number: serialNo.toUpperCase().trim(),
        brand_model: brand.toUpperCase().trim(),
        placement_position: regMode === "MOUNTED" ? position : null,
        tyre_condition: condition,
        nsd_depth_mm: Number(nsdMm) || 0,
        mounted_date: new Date().toISOString().split('T')[0],
        tyre_status: regMode,
        total_km_run: 0,
        last_mount_odo: regMode === "MOUNTED" ? Number(mountOdo) : 0
      }]);
      setSerialNo(""); setBrand(""); setMountOdo(""); fetchData(); setIsProcessing(false); closeModal();
    });
  };

  // --- 2. EXECUTE LIFECYCLE ACTION ---
  const executeLifecycleAction = async () => {
    setIsProcessing(true);
    const t = actionModal.tyre;
    
    try {
      if (actionModal.mode === "UNMOUNT") {
        if (!actionOdo) { alert("Odometer reading required to calculate KM run."); setIsProcessing(false); return; }
        const kmRunThisStint = Math.max(0, Number(actionOdo) - (Number(t.last_mount_odo) || 0));
        const newTotalKm = (Number(t.total_km_run) || 0) + kmRunThisStint;
        
        await supabase.from('fleet_tyres').update({
          tyre_status: nextState, vehicle_id: null, placement_position: null,
          total_km_run: newTotalKm, nsd_depth_mm: actionNsd || t.nsd_depth_mm
        }).eq('tyre_id', t.tyre_id);
      } 
      else if (actionModal.mode === "MOUNT") {
        if (!actionTruckId || !actionOdo) { alert("Truck and Odo required."); setIsProcessing(false); return; }
        await supabase.from('fleet_tyres').update({
          tyre_status: 'MOUNTED', vehicle_id: Number(actionTruckId), placement_position: actionPos,
          last_mount_odo: Number(actionOdo), mounted_date: new Date().toISOString().split('T')[0]
        }).eq('tyre_id', t.tyre_id);
      }
      else if (actionModal.mode === "RECEIVE_RETREAD") {
        await supabase.from('fleet_tyres').update({
          tyre_status: 'IN_STORE', tyre_condition: 'RETREADED', nsd_depth_mm: actionNsd || t.nsd_depth_mm
        }).eq('tyre_id', t.tyre_id);
      }
      else if (actionModal.mode === "SCRAP_FROM_STORE") {
        await supabase.from('fleet_tyres').update({ tyre_status: nextState }).eq('tyre_id', t.tyre_id);
      }

      setActionModal({ isOpen: false, tyre: null, mode: "" });
      fetchData();
    } catch (err: any) {
      alert("Error: Make sure 'tyre_status', 'total_km_run', and 'last_mount_odo' columns exist in Supabase!");
    }
    setIsProcessing(false);
  };

  const handleSaveBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsTruckId || !vendor.trim() || Number(amount) <= 0) return;
    triggerModal("Record Service Bill", `Log ₹${amount} expense from ${vendor}?`, false, "Save Bill", async () => {
      setIsProcessing(true);
      await supabase.from('workshop_spares_bills').insert([{
        bill_date: billDate, vehicle_id: Number(wsTruckId), vendor_name: vendor.trim(), service_description: description.trim(), bill_amount: Number(amount)
      }]);
      setVendor(""); setDescription(""); setAmount(""); fetchData(); setIsProcessing(false); closeModal();
    });
  };

  // Filter Tyres
  const mountedTyres = activeTyres.filter(t => t.tyre_status === 'MOUNTED' || (!t.tyre_status && t.vehicle_id));
  const storeTyres = activeTyres.filter(t => t.tyre_status === 'IN_STORE' || t.tyre_status === 'RETREADING' || (!t.tyre_status && !t.vehicle_id));
  const scrapTyres = activeTyres.filter(t => t.tyre_status === 'SCRAPPED' || t.tyre_status === 'REJECTED');

  return (
    <div className="space-y-6 animate-in fade-in duration-300" style={{ colorScheme: 'light' }}>
      <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} isDanger={modalConfig.isDanger} confirmText={modalConfig.confirmText} onConfirm={modalConfig.action} onCancel={closeModal} isProcessing={isProcessing} />

      {/* CUSTOM LIFECYCLE MODAL */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5 border-b border-border pb-3">
              <h3 className="text-lg font-bold text-fg">
                {actionModal.mode === "UNMOUNT" && "Unmount Tyre"}
                {actionModal.mode === "MOUNT" && "Mount to Truck"}
                {actionModal.mode === "RECEIVE_RETREAD" && "Receive from Retread"}
                {actionModal.mode === "SCRAP_FROM_STORE" && "Dispose Tyre"}
              </h3>
              <button onClick={() => setActionModal({ isOpen: false, tyre: null, mode: "" })} className="text-fg-muted hover:text-rose-500 font-bold">✕</button>
            </div>
            
            <div className="bg-app p-3 rounded-lg border border-border mb-5">
              <p className="text-xs font-bold text-fg-secondary uppercase">Selected Tyre</p>
              <p className="text-sm font-bold text-[#FF5A00]">{actionModal.tyre?.serial_number} <span className="text-fg-secondary font-semibold ml-2">({actionModal.tyre?.brand_model})</span></p>
            </div>

            <div className="space-y-4">
              {actionModal.mode === "UNMOUNT" && (
                <>
                  <div><label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Truck Odo at Unmount (KM) *</label><input type="number" value={actionOdo} onChange={e=>setActionOdo(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-border-strong focus:ring-2 focus:ring-[#FF5A00] font-bold outline-none bg-surface text-fg" placeholder={`Was mounted at ${actionModal.tyre?.last_mount_odo || 0} KM`} /></div>
                  <div><label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Current NSD (mm)</label><input type="number" step="0.1" value={actionNsd} onChange={e=>setActionNsd(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-border-strong focus:ring-2 focus:ring-[#FF5A00] font-semibold outline-none bg-surface text-fg" placeholder={`${actionModal.tyre?.nsd_depth_mm || 0} mm`} /></div>
                  <div>
                    <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Next Destination</label>
                    <select value={nextState} onChange={e=>setNextState(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-border-strong focus:ring-2 focus:ring-[#FF5A00] font-bold outline-none bg-surface text-fg">
                      <option value="IN_STORE">Store / Inventory</option><option value="RETREADING">Send to Retreading</option><option value="SCRAPPED">Scrap Yard</option><option value="REJECTED">Rejected / Burst</option>
                    </select>
                  </div>
                </>
              )}

              {actionModal.mode === "MOUNT" && (
                <>
                  <div><label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Assign to Truck *</label><select value={actionTruckId} onChange={e=>setActionTruckId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-border-strong focus:ring-2 focus:ring-[#FF5A00] font-bold outline-none bg-surface text-fg"><option value="">-- SELECT TRUCK --</option>{vehicles.map(v => <option key={v.vehicle_id} value={String(v.vehicle_id)}>{v.vehicle_number}</option>)}</select></div>
                  <div><label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Position *</label><select value={actionPos} onChange={e=>setActionPos(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-border-strong focus:ring-2 focus:ring-[#FF5A00] font-semibold outline-none bg-surface text-fg"><option value="FRONT_LEFT">FRONT_LEFT</option><option value="FRONT_RIGHT">FRONT_RIGHT</option><option value="DRIVE">DRIVE AXLE</option><option value="STEPNEY">STEPNEY</option></select></div>
                  <div><label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Truck Odo at Mount (KM) *</label><input type="number" value={actionOdo} onChange={e=>setActionOdo(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-border-strong focus:ring-2 focus:ring-[#FF5A00] font-bold outline-none bg-surface text-fg" placeholder="0" /></div>
                </>
              )}

              {actionModal.mode === "RECEIVE_RETREAD" && (
                <div><label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">New Retreaded NSD (mm)</label><input type="number" step="0.1" value={actionNsd} onChange={e=>setActionNsd(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-border-strong focus:ring-2 focus:ring-[#FF5A00] font-bold outline-none bg-surface text-fg" placeholder="e.g. 14.0" /></div>
              )}

              {actionModal.mode === "SCRAP_FROM_STORE" && (
                <div>
                  <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Reason for Disposal</label>
                  <select value={nextState} onChange={e=>setNextState(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-border-strong focus:ring-2 focus:ring-[#FF5A00] font-bold outline-none bg-surface text-fg">
                    <option value="SCRAPPED">Scrapped (End of Life)</option><option value="REJECTED">Rejected / Failed</option>
                  </select>
                </div>
              )}

              <button onClick={executeLifecycleAction} disabled={isProcessing} className="w-full py-3.5 mt-2 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95 disabled:bg-slate-300">
                {isProcessing ? "Processing..." : "Confirm Action"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {["Tyre Lifecycle Management", "Spares & Service Bills"].map((tab) => (
          <button key={tab} onClick={() => setWTab(tab)} className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${wTab === tab ? "bg-[#FF5A00] text-white shadow-sm ring-1 ring-[#FF5A00]" : "bg-surface text-fg-secondary hover:bg-surface-raised border border-border"}`}>{tab}</button>
        ))}
      </div>

      {wTab === "Tyre Management" && (
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm animate-in slide-in-from-bottom-4">
          
          <div className="border border-border bg-app rounded-2xl p-5 mb-8">
            <h3 className="text-sm font-bold text-fg uppercase border-b border-border pb-3 mb-4 flex items-center gap-2"><span>➕</span> Add New Tyre to Database</h3>
            <form onSubmit={handleRegisterTyre} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Destination *</label>
                  <select value={regMode} onChange={e => setRegMode(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold bg-surface text-fg">
                    <option value="IN_STORE">Add to Store / Inventory</option>
                    <option value="MOUNTED">Mount Directly to Truck</option>
                  </select>
                </div>
                <div className="md:col-span-1"><label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Serial Number *</label><input type="text" value={serialNo} onChange={e => setSerialNo(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-border-strong uppercase outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold bg-surface text-fg" required /></div>
                <div className="md:col-span-1"><label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Brand / Model</label><input type="text" value={brand} onChange={e => setBrand(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-border-strong uppercase outline-none focus:ring-2 focus:ring-[#FF5A00] font-semibold bg-surface text-fg" /></div>
                <div className="md:col-span-1"><label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Initial NSD (MM)</label><input type="number" step="0.1" value={nsdMm} onChange={e => setNsdMm(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold bg-surface text-fg" /></div>
              </div>

              {regMode === "MOUNTED" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in p-4 bg-surface border border-[#FF5A00]/20 rounded-xl">
                  <div>
                    <label className="block text-[10px] font-bold text-[#FF5A00] uppercase mb-1">Select Truck *</label>
                    <select value={truckId} onChange={e => setTruckId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold bg-surface text-fg">
                      <option value="">-- SELECT TRUCK --</option>
                      {vehicles.map(v => <option key={v.vehicle_id} value={String(v.vehicle_id)}>{v.vehicle_number}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#FF5A00] uppercase mb-1">Position</label>
                    <select value={position} onChange={e => setPosition(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] font-semibold bg-surface text-fg"><option value="FRONT_LEFT">FRONT_LEFT</option><option value="FRONT_RIGHT">FRONT_RIGHT</option><option value="DRIVE">DRIVE AXLE</option><option value="STEPNEY">STEPNEY</option></select>
                  </div>
                  <div><label className="block text-[10px] font-bold text-[#FF5A00] uppercase mb-1">Mounting ODO (KM) *</label><input type="number" value={mountOdo} onChange={e => setMountOdo(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold bg-surface text-fg" /></div>
                </div>
              )}
              <div className="flex justify-end pt-2"><button type="submit" disabled={isProcessing} className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95">Save Tyre Data</button></div>
            </form>
          </div>

          {/* ACTIVE MOUNTED TYRES */}
          <div className="mb-8">
            <h4 className="text-xs font-bold text-fg uppercase mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Currently Mounted on Fleet</h4>
            <div className="overflow-x-auto rounded-xl border border-border w-full max-h-[400px]">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-left whitespace-nowrap">
                <thead className="bg-app sticky top-0"><tr className="font-bold text-fg-secondary uppercase"><th className="px-4 py-3">Truck</th><th className="px-4 py-3">Serial & Brand</th><th className="px-4 py-3">Position</th><th className="px-4 py-3">Mounted Date</th><th className="px-4 py-3">Current KM Run</th><th className="px-4 py-3 text-center">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100 bg-surface">
                  {mountedTyres.map(t => (
                    <tr key={t.tyre_id} className="hover:bg-app">
                      <td className="px-4 py-2 font-bold text-fg">{t.vehicles?.vehicle_number}</td>
                      <td className="px-4 py-2 font-mono font-bold text-fg">{t.serial_number} <br/><span className="font-sans font-normal text-[10px] text-fg-muted">{t.brand_model}</span></td>
                      <td className="px-4 py-2 text-fg-secondary font-semibold">{t.placement_position}</td>
                      <td className="px-4 py-2 text-fg-secondary">{formatDate(t.mounted_date)}</td>
                      <td className="px-4 py-2 font-bold text-indigo-600">{t.total_km_run || 0} km</td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => { setNextState("IN_STORE"); setActionOdo(""); setActionNsd(""); setActionModal({ isOpen: true, tyre: t, mode: "UNMOUNT" }); }} className="px-3 py-1.5 bg-surface-raised hover:bg-surface-raised text-fg font-bold rounded-lg transition-colors border border-border">Unmount / Update</button>
                      </td>
                    </tr>
                  ))}
                  {mountedTyres.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-fg-muted">No mounted tyres.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* STORE & RETREADING */}
          <div className="mb-8">
            <h4 className="text-xs font-bold text-fg uppercase mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500"></span> In Store / Retreading</h4>
            <div className="overflow-x-auto rounded-xl border border-border w-full max-h-[400px]">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-left whitespace-nowrap">
                <thead className="bg-app sticky top-0"><tr className="font-bold text-fg-secondary uppercase"><th className="px-4 py-3">Status</th><th className="px-4 py-3">Serial & Brand</th><th className="px-4 py-3">Condition</th><th className="px-4 py-3">Total Run (KM)</th><th className="px-4 py-3 text-center">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100 bg-surface">
                  {storeTyres.map(t => (
                    <tr key={t.tyre_id} className="hover:bg-app">
                      <td className="px-4 py-2"><span className={`px-2 py-1 rounded text-[10px] font-bold ${t.tyre_status === 'RETREADING' ? 'bg-amber-100 text-amber-700' : 'bg-surface-raised text-fg'}`}>{t.tyre_status || 'IN_STORE'}</span></td>
                      <td className="px-4 py-2 font-mono font-bold text-fg">{t.serial_number} <br/><span className="font-sans font-normal text-[10px] text-fg-muted">{t.brand_model}</span></td>
                      <td className="px-4 py-2 text-fg-secondary font-semibold">{t.tyre_condition}</td>
                      <td className="px-4 py-2 font-bold text-indigo-600">{t.total_km_run || 0} km</td>
                      <td className="px-4 py-2 text-center">
                        {t.tyre_status === 'RETREADING' ? (
                          <button onClick={() => { setActionNsd(""); setActionModal({ isOpen: true, tyre: t, mode: "RECEIVE_RETREAD" }); }} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-emerald-200">Receive Retread</button>
                        ) : (
                          <div className="flex justify-center gap-2">
                            <button onClick={() => { setActionTruckId(""); setActionOdo(""); setActionModal({ isOpen: true, tyre: t, mode: "MOUNT" }); }} className="px-3 py-1.5 bg-[#FF5A00]/10 hover:bg-[#FF5A00]/20 text-[#FF5A00] font-bold rounded-lg border border-[#FF5A00]/20">Mount to Truck</button>
                            <button onClick={() => { setNextState("SCRAPPED"); setActionModal({ isOpen: true, tyre: t, mode: "SCRAP_FROM_STORE" }); }} className="px-3 py-1.5 bg-surface-raised hover:bg-surface-raised text-fg-secondary font-bold rounded-lg border border-border">Dispose</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {storeTyres.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-fg-muted">Inventory is empty.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* SCRAP YARD */}
          <div>
            <h4 className="text-xs font-bold text-fg uppercase mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Disposed / Scrap Yard</h4>
            <div className="overflow-x-auto rounded-xl border border-border w-full max-h-[300px]">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-left whitespace-nowrap">
                <thead className="bg-app sticky top-0"><tr className="font-bold text-fg-secondary uppercase"><th className="px-4 py-3">Serial & Brand</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Total Lifetime Run (KM)</th></tr></thead>
                <tbody className="divide-y divide-slate-100 bg-surface">
                  {scrapTyres.map(t => (
                    <tr key={t.tyre_id} className="hover:bg-app">
                      <td className="px-4 py-2 font-mono font-bold text-fg">{t.serial_number} <br/><span className="font-sans font-normal text-[10px] text-fg-muted">{t.brand_model}</span></td>
                      <td className="px-4 py-2"><span className="px-2 py-1 rounded text-[10px] font-bold bg-rose-100 text-rose-700">{t.tyre_status}</span></td>
                      <td className="px-4 py-2 font-bold text-fg">{t.total_km_run || 0} km</td>
                    </tr>
                  ))}
                  {scrapTyres.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-fg-muted">No scrapped tyres.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {wTab === "Spares & Service Bills" && (
        <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm max-w-4xl mx-auto animate-in slide-in-from-bottom-4">
          <h3 className="text-sm font-bold text-fg uppercase border-b border-border pb-3 mb-6">Log Service Bill</h3>
          <form onSubmit={handleSaveBill} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Bill Date *</label><input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] bg-surface text-fg" required /></div>
              <div>
                <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Select Truck *</label>
                <select value={wsTruckId} onChange={e => setWsTruckId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold bg-surface text-fg" required>
                  <option value="">-- SELECT TRUCK --</option>
                  {vehicles.map(v => <option key={v.vehicle_id} value={String(v.vehicle_id)}>{v.vehicle_number}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Vendor / Workshop Name *</label><input type="text" value={vendor} onChange={e => setVendor(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] font-semibold bg-surface text-fg" required /></div>
              <div><label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Total Bill Amount (₹) *</label><input type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold text-rose-600 bg-surface" required /></div>
            </div>
            <div><label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Parts & Service Description</label><input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Engine oil change, 2 brake pads" className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] bg-surface text-fg" /></div>
            <button type="submit" disabled={isProcessing} className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95">Save Service Record</button>
          </form>

          <div className="mt-8 pt-6 border-t border-border w-full">
            <h4 className="text-xs font-bold text-fg uppercase mb-3">Recent Workshop Bills</h4>
            <div className="overflow-x-auto rounded-xl border border-border w-full max-h-[400px]">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-left whitespace-nowrap">
                <thead className="bg-app sticky top-0"><tr className="font-bold text-fg-secondary uppercase"><th className="px-4 py-2">Date</th><th className="px-4 py-2">Truck</th><th className="px-4 py-2">Vendor & Details</th><th className="px-4 py-2 text-right">Amount (₹)</th></tr></thead>
                <tbody className="divide-y divide-slate-100 bg-surface">
                  {activeBills.map(b => (
                    <tr key={b.bill_id} className="hover:bg-app">
                      <td className="px-4 py-2 font-semibold text-fg">{formatDate(b.bill_date)}</td><td className="px-4 py-2 font-bold text-fg">{b.vehicles?.vehicle_number}</td><td className="px-4 py-2 text-fg-secondary">{b.vendor_name} <br/><span className="text-[10px] text-fg-muted">{b.service_description}</span></td><td className="px-4 py-2 text-right font-bold text-rose-600">₹{(b.bill_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    </tr>
                  ))}
                  {activeBills.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-fg-muted">No service bills recorded.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
