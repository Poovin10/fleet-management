"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal";
import { TableToolbar } from "@/components/ui/TableToolbar";

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
 const [regMode, setRegMode] = useState("IN_STORE");
 const [truckId, setTruckId] = useState("");
 const [serialNo, setSerialNo] = useState("");
 const [brand, setBrand] = useState("");
 const [position, setPosition] = useState("FRONT_LEFT");
 const [condition, setCondition] = useState("NEW");
 const [nsdMm, setNsdMm] = useState<number | "">(15.0);
 const [mountOdo, setMountOdo] = useState<number | "">("");

 // Search States
 const [mountedSearch, setMountedSearch] = useState("");
 const [storeSearch, setStoreSearch] = useState("");
 const [scrapSearch, setScrapSearch] = useState("");
 const [billsSearch, setBillsSearch] = useState("");

 // Data Lists
 const [activeTyres, setActiveTyres] = useState<any[]>([]);
 const [activeBills, setActiveBills] = useState<any[]>([]);

 // Spares States
 const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
 const [wsTruckId, setWsTruckId] = useState("");
 const [vendor, setVendor] = useState("");
 const [description, setDescription] = useState("");
 const [amount, setAmount] = useState<number | "">("");

 const formatDate = (dateStr: string) => {
 if (!dateStr) return 'N/A';
 if (!dateStr.includes('-')) return dateStr;
 const parts = dateStr.split('T')[0].split('-');
 if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
 return dateStr;
 };

 const fetchData = async () => {
 const { data: vData } = await supabase.from('trucks').select('*').order('vehicle_number');
 if (vData) setVehicles(vData);

 const { data: tData } = await supabase.from('fleet_tyres').select('*, trucks(vehicle_number)').order('mounted_date', { ascending: false });
 if (tData) setActiveTyres(tData);

 const { data: bData } = await supabase.from('workshop_spares_bills').select('*, trucks(vehicle_number)').order('bill_date', { ascending: false });
 if (bData) setActiveBills(bData);
 };

 useEffect(() => { fetchData(); }, []);

 // --- 1. REGISTER NEW TYRE ---
 const handleRegisterTyre = (e: React.FormEvent) => {
 e.preventDefault();
 if (!serialNo.trim()) return alert("Serial Number is required.");
 if (regMode === "MOUNTED" && (!truckId || !mountOdo)) return alert("Truck and Odometer required to mount directly.");

 triggerModal("Register Tyre", `Add ${serialNo.toUpperCase()} to ${regMode === 'IN_STORE' ? 'Inventory' : 'Fleet'}?`, false, "Register", async () => {
 setIsProcessing(true);
 const { error: tyreError } = await supabase.from('fleet_tyres').insert([{
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
 
 if (tyreError) alert("Error: " + tyreError.message);
 else { setSerialNo(""); setBrand(""); setMountOdo(""); fetchData(); }
 setIsProcessing(false); closeModal();
 });
 };

 // --- 2. EXECUTE LIFECYCLE ACTION ---
 const executeLifecycleAction = async () => {
 setIsProcessing(true);
 const t = actionModal.tyre;
 try {
 if (actionModal.mode === "UNMOUNT") {
 if (!actionOdo || Number(actionOdo) < 0) { alert("Valid Odometer reading required."); setIsProcessing(false); return; }
 const kmRunThisStint = Math.max(0, Number(actionOdo) - (Number(t.last_mount_odo) || 0));
 const newTotalKm = (Number(t.total_km_run) || 0) + kmRunThisStint;
 await supabase.from('fleet_tyres').update({
 tyre_status: nextState, vehicle_id: null, placement_position: null,
 total_km_run: newTotalKm, nsd_depth_mm: actionNsd || t.nsd_depth_mm
 }).eq('tyre_id', t.tyre_id);
 }
 else if (actionModal.mode === "MOUNT") {
 if (!actionTruckId || !actionOdo || Number(actionOdo) < 0) { alert("Valid Truck and Odo required."); setIsProcessing(false); return; }
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
 } catch (err: any) { alert("Database Error: " + err.message); }
 setIsProcessing(false);
 };

 const handleSaveBill = (e: React.FormEvent) => {
 e.preventDefault();
 if (!wsTruckId || !vendor.trim() || Number(amount) <= 0) return alert("Invalid inputs.");
 triggerModal("Record Service Bill", `Log ${amount} expense from ${vendor}?`, false, "Save Bill", async () => {
 setIsProcessing(true);
 const { error: billError } = await supabase.from('workshop_spares_bills').insert([{
 bill_date: billDate, vehicle_id: Number(wsTruckId), vendor_name: vendor.trim(), service_description: description.trim(), bill_amount: Number(amount)
 }]);
 if (billError) alert("Failed to save bill: " + billError.message);
 else { alert("Service bill recorded successfully!"); setVendor(""); setDescription(""); setAmount(""); fetchData(); }
 setIsProcessing(false); closeModal();
 });
 };

 // --- FILTER & EXPORT LOGIC ---
 const mountedTyres = activeTyres.filter(t => t.tyre_status === 'MOUNTED' || (!t.tyre_status && t.vehicle_id));
 const storeTyres = activeTyres.filter(t => t.tyre_status === 'IN_STORE' || t.tyre_status === 'RETREADING' || (!t.tyre_status && !t.vehicle_id));
 const scrapTyres = activeTyres.filter(t => t.tyre_status === 'SCRAPPED' || t.tyre_status === 'REJECTED');

 const filteredMounted = mountedTyres.filter(t => (t.serial_number || "").toLowerCase().includes(mountedSearch.toLowerCase()) || (t.trucks?.vehicle_number || "").toLowerCase().includes(mountedSearch.toLowerCase()));
 const exportMounted = filteredMounted.map(t => ({ "Truck": t.trucks?.vehicle_number || "-", "Serial": t.serial_number, "Brand": t.brand_model, "Position": t.placement_position, "Mounted Date": formatDate(t.mounted_date), "Current KM Run": t.total_km_run || 0 }));

 const filteredStore = storeTyres.filter(t => (t.serial_number || "").toLowerCase().includes(storeSearch.toLowerCase()) || (t.brand_model || "").toLowerCase().includes(storeSearch.toLowerCase()));
 const exportStore = filteredStore.map(t => ({ "Serial": t.serial_number, "Brand": t.brand_model, "Status": t.tyre_status || "IN_STORE", "Condition": t.tyre_condition, "Total Lifetime KM": t.total_km_run || 0 }));

 const filteredScrap = scrapTyres.filter(t => (t.serial_number || "").toLowerCase().includes(scrapSearch.toLowerCase()));
 const exportScrap = filteredScrap.map(t => ({ "Serial": t.serial_number, "Brand": t.brand_model, "Status": t.tyre_status, "Total Lifetime KM": t.total_km_run || 0 }));

 const filteredBills = activeBills.filter(b => (b.vendor_name || "").toLowerCase().includes(billsSearch.toLowerCase()) || (b.trucks?.vehicle_number || "").toLowerCase().includes(billsSearch.toLowerCase()));
 const exportBills = filteredBills.map(b => ({ "Date": formatDate(b.bill_date), "Truck": b.trucks?.vehicle_number || "GENERAL", "Vendor": b.vendor_name, "Description": b.service_description, "Amount (INR)": b.bill_amount }));

 return (
 <div className="animate-tab-focus space-y-6 animate-in fade-in duration-300 text-white">
 <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} isDanger={modalConfig.isDanger} confirmText={modalConfig.confirmText} onConfirm={modalConfig.action} onCancel={closeModal} isProcessing={isProcessing} />

 {/* CUSTOM LIFECYCLE MODAL */}
 {actionModal.isOpen && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0F1117]/80 backdrop-blur-sm animate-in fade-in">
 <div className="bg-[#161922] border border-[#272B36] rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
 <div className="flex justify-between items-center mb-5 border-b border-[#272B36] pb-3">
 <h3 className="text-lg font-semibold text-white  tracking-tight">
 {actionModal.mode === "UNMOUNT" && "Unmount Tyre"}
 {actionModal.mode === "MOUNT" && "Mount to Truck"}
 {actionModal.mode === "RECEIVE_RETREAD" && "Receive from Retread"}
 {actionModal.mode === "SCRAP_FROM_STORE" && "Dispose Tyre"}
 </h3>
 <button onClick={() => setActionModal({ isOpen: false, tyre: null, mode: "" })} className="text-white/40 hover:text-rose-500 font-bold transition-colors"></button>
 </div>

 <div className="bg-[#0F1117] p-4 rounded-xl border border-[#272B36] mb-5">
 <p className="text-xs font-bold text-white/40 ">Selected Tyre</p>
 <p className="text-sm font-semibold text-[#FF5A00]">{actionModal.tyre?.serial_number} <span className="text-white/60 font-semibold ml-2">({actionModal.tyre?.brand_model})</span></p>
 </div>

 <div className="space-y-4">
 {actionModal.mode === "UNMOUNT" && (
 <>
 <div><label className="block text-[10px] font-bold text-white/60  mb-1">Truck Odo at Unmount (KM) *</label><input type="number" min="0" value={actionOdo} onChange={e=>setActionOdo(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#12141C] text-white focus:border-[#FF5A00] outline-none font-bold" placeholder={`Was mounted at ${actionModal.tyre?.last_mount_odo || 0} KM`} /></div>
 <div><label className="block text-[10px] font-bold text-white/60  mb-1">Current NSD (mm)</label><input type="number" step="0.1" min="0" max="30" value={actionNsd} onChange={e=>setActionNsd(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#12141C] text-white focus:border-[#FF5A00] outline-none font-bold" placeholder={`${actionModal.tyre?.nsd_depth_mm || 0} mm`} /></div>
 <div><label className="block text-[10px] font-bold text-white/60  mb-1">Next Destination</label><select value={nextState} onChange={e=>setNextState(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#12141C] text-white focus:border-[#FF5A00] outline-none font-bold"><option value="IN_STORE">Store / Inventory</option><option value="RETREADING">Send to Retreading</option><option value="SCRAPPED">Scrap Yard</option><option value="REJECTED">Rejected / Burst</option></select></div>
 </>
 )}
 {actionModal.mode === "MOUNT" && (
 <>
 <div><label className="block text-[10px] font-bold text-white/60  mb-1">Assign to Truck *</label><select value={actionTruckId} onChange={e=>setActionTruckId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#12141C] text-white focus:border-[#FF5A00] outline-none font-bold"><option value="">-- SELECT TRUCK --</option>{vehicles.map(v => <option key={v.id} value={String(v.id)}>{v.vehicle_number}</option>)}</select></div>
 <div><label className="block text-[10px] font-bold text-white/60  mb-1">Position *</label><select value={actionPos} onChange={e=>setActionPos(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#12141C] text-white focus:border-[#FF5A00] outline-none font-bold"><option value="FRONT_LEFT">FRONT_LEFT</option><option value="FRONT_RIGHT">FRONT_RIGHT</option><option value="DRIVE">DRIVE AXLE</option><option value="STEPNEY">STEPNEY</option></select></div>
 <div><label className="block text-[10px] font-bold text-white/60  mb-1">Truck Odo at Mount (KM) *</label><input type="number" min="0" value={actionOdo} onChange={e=>setActionOdo(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#12141C] text-white focus:border-[#FF5A00] outline-none font-bold" placeholder="0" /></div>
 </>
 )}
 {actionModal.mode === "RECEIVE_RETREAD" && (
 <div><label className="block text-[10px] font-bold text-white/60  mb-1">New Retreaded NSD (mm)</label><input type="number" step="0.1" min="0" max="30" value={actionNsd} onChange={e=>setActionNsd(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#12141C] text-white focus:border-[#FF5A00] outline-none font-bold" placeholder="e.g. 14.0" /></div>
 )}
 {actionModal.mode === "SCRAP_FROM_STORE" && (
 <div><label className="block text-[10px] font-bold text-white/60  mb-1">Reason for Disposal</label><select value={nextState} onChange={e=>setNextState(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#12141C] text-white focus:border-[#FF5A00] outline-none font-bold"><option value="SCRAPPED">Scrapped (End of Life)</option><option value="REJECTED">Rejected / Failed</option></select></div>
 )}
 <button onClick={executeLifecycleAction} disabled={isProcessing} className="w-full py-3.5 mt-2 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20 active:scale-95 disabled:bg-slate-700">
 {isProcessing ? "Processing..." : "Confirm Action"}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Main Tabs */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#272B36] pb-4">
 <div>
 <h2 className="text-xl font-semibold text-white  tracking-tight">Workshop & Inventory</h2>
 <p className="text-xs text-white/60 mt-0.5">Manage tyre lifecycles, retreading, spares, and service billing.</p>
 </div>
 <div className="flex flex-wrap gap-2">
 {["Tyre Management", "Spares & Service Bills"].map((tab) => (
 <button key={tab} onClick={() => setWTab(tab)} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${wTab === tab ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/20" : "bg-[#161922] text-white/60 hover:text-white hover:bg-[#1E222D] border border-[#272B36]"}`}>{tab}</button>
 ))}
 </div>
 </div>

 {wTab === "Tyre Management" && (
 <div className="space-y-8">
 {/* Tyre Registration Form */}
 <div className="bg-[#161922] border border-[#272B36] rounded-2xl p-6 shadow-xl animate-in slide-in-from-bottom-4">
 <h3 className="text-sm font-semibold text-white  border-b border-[#272B36] pb-3 mb-4 flex items-center gap-2"><span></span> Add New Tyre to Database</h3>
 <form onSubmit={handleRegisterTyre} className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <div className="md:col-span-1"><label className="block text-[10px] font-bold text-white/60  mb-1">Destination *</label><select value={regMode} onChange={e => setRegMode(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white focus:border-[#FF5A00] outline-none font-bold"><option value="IN_STORE">Add to Store / Inventory</option><option value="MOUNTED">Mount Directly to Truck</option></select></div>
 <div className="md:col-span-1"><label className="block text-[10px] font-bold text-white/60  mb-1">Serial Number *</label><input type="text" maxLength={30} value={serialNo} onChange={e => setSerialNo(e.target.value.toUpperCase())} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white focus:border-[#FF5A00] outline-none font-bold " required /></div>
 <div className="md:col-span-1"><label className="block text-[10px] font-bold text-white/60  mb-1">Brand / Model</label><input type="text" maxLength={40} value={brand} onChange={e => setBrand(e.target.value.toUpperCase())} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white focus:border-[#FF5A00] outline-none font-semibold " /></div>
 <div className="md:col-span-1"><label className="block text-[10px] font-bold text-white/60  mb-1">Initial NSD (MM)</label><input type="number" step="0.1" min="0" max="30" value={nsdMm} onChange={e => setNsdMm(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white focus:border-[#FF5A00] outline-none font-bold" /></div>
 </div>
 {regMode === "MOUNTED" && (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#0F1117] border border-[#FF5A00]/20 rounded-xl">
 <div><label className="block text-[10px] font-bold text-[#FF5A00]  mb-1">Select Truck *</label><select value={truckId} onChange={e => setTruckId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#12141C] text-white focus:border-[#FF5A00] outline-none font-bold"><option value="">-- SELECT TRUCK --</option>{vehicles.map(v => <option key={v.id} value={String(v.id)}>{v.vehicle_number}</option>)}</select></div>
 <div><label className="block text-[10px] font-bold text-[#FF5A00]  mb-1">Position</label><select value={position} onChange={e => setPosition(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#12141C] text-white focus:border-[#FF5A00] outline-none font-semibold"><option value="FRONT_LEFT">FRONT_LEFT</option><option value="FRONT_RIGHT">FRONT_RIGHT</option><option value="DRIVE">DRIVE AXLE</option><option value="STEPNEY">STEPNEY</option></select></div>
 <div><label className="block text-[10px] font-bold text-[#FF5A00]  mb-1">Mounting ODO (KM) *</label><input type="number" min="0" value={mountOdo} onChange={e => setMountOdo(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#12141C] text-white focus:border-[#FF5A00] outline-none font-bold" /></div>
 </div>
 )}
 <div className="flex justify-end pt-2"><button type="submit" disabled={isProcessing} className="px-8 py-3 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20 active:scale-95 disabled:bg-slate-700">Save Tyre Data</button></div>
 </form>
 </div>

 {/* ACTIVE MOUNTED TYRES */}
 <div className="bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden shadow-xl">
 <TableToolbar title=" Currently Mounted on Fleet" searchQuery={mountedSearch} setSearchQuery={setMountedSearch} exportData={exportMounted} exportFilename="Mounted_Tyres" />
 <div className="overflow-x-auto w-full max-h-[400px]">
 <table className="min-w-full divide-y divide-[#272B36] text-xs text-left whitespace-nowrap">
 <thead className="bg-[#0F1117] sticky top-0 z-10"><tr className="font-bold text-white/60  tracking-wider text-[10px]"><th className="px-5 py-3.5">Truck</th><th className="px-5 py-3.5">Serial & Brand</th><th className="px-5 py-3.5">Position</th><th className="px-5 py-3.5">Mounted Date</th><th className="px-5 py-3.5">Current KM Run</th><th className="px-5 py-3.5 text-center">Action</th></tr></thead>
 <tbody className="divide-y divide-[#272B36] bg-[#161922]">
 {filteredMounted.map(t => (
 <tr key={t.tyre_id} className="hover:bg-[#1E222D]">
 <td className="px-5 py-3.5 font-semibold text-white">{t.trucks?.vehicle_number || "UNKNOWN"}</td>
 <td className="px-5 py-3.5 font-mono font-bold text-white">{t.serial_number} <br/><span className="font-sans font-semibold text-[10px] text-white/60">{t.brand_model}</span></td>
 <td className="px-5 py-3.5 text-slate-300 font-bold">{t.placement_position}</td>
 <td className="px-5 py-3.5 text-white/60">{formatDate(t.mounted_date)}</td>
 <td className="px-5 py-3.5 font-semibold text-emerald-400">{t.total_km_run || 0} km</td>
 <td className="px-5 py-3.5 text-center"><button onClick={() => { setNextState("IN_STORE"); setActionOdo(""); setActionNsd(""); setActionModal({ isOpen: true, tyre: t, mode: "UNMOUNT" }); }} className="px-3 py-1.5 bg-[#0F1117] hover:bg-[#272B36] text-white font-bold rounded-lg transition-colors border border-[#272B36]">Unmount</button></td>
 </tr>
 ))}
 {filteredMounted.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-white/40 font-medium">No mounted tyres found.</td></tr>}
 </tbody>
 </table>
 </div>
 </div>

 {/* STORE & RETREADING */}
 <div className="bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden shadow-xl">
 <TableToolbar title=" In Store / Retreading" searchQuery={storeSearch} setSearchQuery={setStoreSearch} exportData={exportStore} exportFilename="Store_Tyres" />
 <div className="overflow-x-auto w-full max-h-[400px]">
 <table className="min-w-full divide-y divide-[#272B36] text-xs text-left whitespace-nowrap">
 <thead className="bg-[#0F1117] sticky top-0 z-10"><tr className="font-bold text-white/60  tracking-wider text-[10px]"><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5">Serial & Brand</th><th className="px-5 py-3.5">Condition</th><th className="px-5 py-3.5">Lifetime KM</th><th className="px-5 py-3.5 text-center">Action</th></tr></thead>
 <tbody className="divide-y divide-[#272B36] bg-[#161922]">
 {filteredStore.map(t => (
 <tr key={t.tyre_id} className="hover:bg-[#1E222D]">
 <td className="px-5 py-3.5"><span className={`px-2 py-1 rounded text-[10px] font-semibold ${t.tyre_status === 'RETREADING' ? 'bg-amber-950/50 text-amber-500 border border-amber-900' : 'bg-[#0F1117] text-white border border-[#272B36]'}`}>{t.tyre_status || 'IN_STORE'}</span></td>
 <td className="px-5 py-3.5 font-mono font-bold text-white">{t.serial_number} <br/><span className="font-sans font-semibold text-[10px] text-white/60">{t.brand_model}</span></td>
 <td className="px-5 py-3.5 text-slate-300 font-bold">{t.tyre_condition}</td>
 <td className="px-5 py-3.5 font-semibold text-sky-400">{t.total_km_run || 0} km</td>
 <td className="px-5 py-3.5 text-center">
 {t.tyre_status === 'RETREADING' ? (
 <button onClick={() => { setActionNsd(""); setActionModal({ isOpen: true, tyre: t, mode: "RECEIVE_RETREAD" }); }} className="px-3 py-1.5 bg-emerald-950/40 text-emerald-400 font-bold rounded-lg border border-emerald-900/50">Receive</button>
 ) : (
 <div className="flex justify-center gap-2">
 <button onClick={() => { setActionTruckId(""); setActionOdo(""); setActionModal({ isOpen: true, tyre: t, mode: "MOUNT" }); }} className="px-3 py-1.5 bg-[#FF5A00]/10 hover:bg-[#FF5A00]/20 text-[#FF5A00] font-bold rounded-lg border border-[#FF5A00]/20">Mount</button>
 <button onClick={() => { setNextState("SCRAPPED"); setActionModal({ isOpen: true, tyre: t, mode: "SCRAP_FROM_STORE" }); }} className="px-3 py-1.5 bg-[#0F1117] hover:bg-[#272B36] text-white/60 font-bold rounded-lg border border-[#272B36]">Dispose</button>
 </div>
 )}
 </td>
 </tr>
 ))}
 {filteredStore.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-white/40 font-medium">Inventory is empty.</td></tr>}
 </tbody>
 </table>
 </div>
 </div>

 {/* SCRAP YARD */}
 <div className="bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden shadow-xl">
 <TableToolbar title=" Disposed / Scrap Yard" searchQuery={scrapSearch} setSearchQuery={setScrapSearch} exportData={exportScrap} exportFilename="Scrapped_Tyres" />
 <div className="overflow-x-auto w-full max-h-[300px]">
 <table className="min-w-full divide-y divide-[#272B36] text-xs text-left whitespace-nowrap">
 <thead className="bg-[#0F1117] sticky top-0 z-10"><tr className="font-bold text-white/60  tracking-wider text-[10px]"><th className="px-5 py-3.5">Serial & Brand</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5">Total Lifetime Run (KM)</th></tr></thead>
 <tbody className="divide-y divide-[#272B36] bg-[#161922]">
 {filteredScrap.map(t => (
 <tr key={t.tyre_id} className="hover:bg-[#1E222D]">
 <td className="px-5 py-3.5 font-mono font-bold text-white">{t.serial_number} <br/><span className="font-sans font-semibold text-[10px] text-white/60">{t.brand_model}</span></td>
 <td className="px-5 py-3.5"><span className="px-2 py-1 rounded text-[10px] font-semibold bg-rose-950/40 text-rose-500 border border-rose-900/50">{t.tyre_status}</span></td>
 <td className="px-5 py-3.5 font-semibold text-slate-300">{t.total_km_run || 0} km</td>
 </tr>
 ))}
 {filteredScrap.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-white/40 font-medium">No scrapped tyres.</td></tr>}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 )}

 {wTab === "Spares & Service Bills" && (
 <div className="bg-[#161922] border border-[#272B36] rounded-2xl p-6 sm:p-8 shadow-xl max-w-5xl mx-auto animate-in slide-in-from-bottom-4">
 <h3 className="text-sm font-semibold text-white  border-b border-[#272B36] pb-3 mb-6">Log Service Bill</h3>
 <form onSubmit={handleSaveBill} className="space-y-5">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div><label className="block text-[10px] font-bold text-white/60  mb-1">Bill Date *</label><input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white focus:border-[#FF5A00] outline-none font-bold" required /></div>
 <div><label className="block text-[10px] font-bold text-white/60  mb-1">Select Truck *</label><select value={wsTruckId} onChange={e => setWsTruckId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white focus:border-[#FF5A00] outline-none font-bold" required><option value="">-- SELECT TRUCK --</option>{vehicles.map(v => <option key={v.id} value={String(v.id)}>{v.vehicle_number}</option>)}</select></div>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div><label className="block text-[10px] font-bold text-white/60  mb-1">Vendor / Workshop Name *</label><input type="text" maxLength={60} value={vendor} onChange={e => setVendor(e.target.value.toUpperCase())} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white focus:border-[#FF5A00] outline-none font-bold " required /></div>
 <div><label className="block text-[10px] font-bold text-white/60  mb-1">Total Bill Amount () *</label><input type="number" min="1" max="1000000" value={amount} onChange={e => setAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] focus:border-[#FF5A00] outline-none font-semibold text-rose-500" required /></div>
 </div>
 <div><label className="block text-[10px] font-bold text-white/60  mb-1">Parts & Service Description</label><input type="text" maxLength={150} value={description} onChange={e => setDescription(e.target.value.toUpperCase())} placeholder="e.g. Engine oil change, 2 brake pads" className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white focus:border-[#FF5A00] outline-none font-semibold " /></div>
 <button type="submit" disabled={isProcessing} className="w-full py-3.5 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-semibold text-sm rounded-xl transition-all shadow-lg active:scale-95 disabled:bg-slate-700">Save Service Record</button>
 </form>

 <div className="mt-10 border border-[#272B36] rounded-2xl overflow-hidden w-full">
 <TableToolbar title="Recent Workshop Bills" searchQuery={billsSearch} setSearchQuery={setBillsSearch} exportData={exportBills} exportFilename="Workshop_Spares_Bills" />
 <div className="overflow-x-auto w-full max-h-[400px]">
 <table className="min-w-full divide-y divide-[#272B36] text-xs text-left whitespace-nowrap">
 <thead className="bg-[#0F1117] sticky top-0 z-10"><tr className="font-bold text-white/60  tracking-wider text-[10px]"><th className="px-5 py-3.5">Date</th><th className="px-5 py-3.5">Truck</th><th className="px-5 py-3.5">Vendor & Details</th><th className="px-5 py-3.5 text-right">Amount ()</th></tr></thead>
 <tbody className="divide-y divide-[#272B36] bg-[#161922]">
 {filteredBills.map(b => (
 <tr key={b.bill_id} className="hover:bg-[#1E222D]">
 <td className="px-5 py-4 font-semibold text-slate-300">{formatDate(b.bill_date)}</td>
 <td className="px-5 py-4 font-semibold text-white">{b.trucks?.vehicle_number || "UNKNOWN"}</td>
 <td className="px-5 py-4 text-slate-300 font-bold">{b.vendor_name} <br/><span className="text-[10px] text-white/40 font-normal">{b.service_description}</span></td>
 <td className="px-5 py-4 text-right font-semibold text-rose-500">{(b.bill_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
 </tr>
 ))}
 {filteredBills.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-white/40 font-medium">No service bills match your search.</td></tr>}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
