"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { exportToCSV } from "@/lib/utils/exportManager";

export function FuelAdvanceModule() {
 const supabase = createClient();
 const [faNav, setFaNav] = useState(" Issue Diesel");
 const [isLoading, setIsLoading] = useState(true);
 const [isProcessing, setIsProcessing] = useState(false);

 const [modalConfig, setModalConfig] = useState({
 isOpen: false, title: "", message: "", confirmText: "Confirm", isDanger: false, action: async () => {}
 });

 const triggerModal = (title: string, message: string, isDanger: boolean, confirmText: string, action: () => Promise<void>) => {
 setModalConfig({ isOpen: true, title, message, isDanger, confirmText, action });
 };
 const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

 const [vehicles, setVehicles] = useState<any[]>([]);
 const [dieselRate, setDieselRate] = useState<number>(95.0);
 const [recentFuelLogs, setRecentFuelLogs] = useState<any[]>([]);
 
 // Search States
 const [recentSearch, setRecentSearch] = useState("");
 const [auditSearch, setAuditSearch] = useState("");
 const [kmplSearch, setKmplSearch] = useState("");

 // INBOX STATES
 const [pendingScans, setPendingScans] = useState<any[]>([]);
 const [activeScanId, setActiveScanId] = useState<string | null>(null);

 // STRICT FORM STATES
 const [editLogId, setEditLogId] = useState<string | null>(null);
 const [editTripId, setEditTripId] = useState<number | null>(null);
 const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0]);
 const [fVehicleId, setFVehicleId] = useState("");
 const [fCategory, setFCategory] = useState("TRIP_DIESEL");
 const [fLrNo, setFLrNo] = useState("");
 const [fFillingKm, setFFillingKm] = useState<number | "">("");
 const [fLitres, setFLitres] = useState<number | "">("");
 const [fDieselRate, setFDieselRate] = useState<number | "">(95.0);
 const [fIsTankFull, setFIsTankFull] = useState(false);

 const [auditDateMode, setAuditDateMode] = useState("All Time");
 const [auditSpecificDate, setAuditSpecificDate] = useState(new Date().toISOString().split('T')[0]);
 const [auditFromDate, setAuditFromDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
 const [auditToDate, setAuditToDate] = useState(new Date().toISOString().split('T')[0]);
 const [auditTruck, setAuditTruck] = useState("All Trucks");
 const [auditCategory, setAuditCategory] = useState("All Categories");
 const [auditResults, setAuditResults] = useState<any[]>([]);

 // KMPL TRACKER STATES
 const [kmplTruckId, setKmplTruckId] = useState("");
 const [kmplSpans, setKmplSpans] = useState<any[]>([]);
 const [ongoingKmplSpan, setOngoingKmplSpan] = useState<any>(null);

 const formatDate = (dateStr: string) => {
 if (!dateStr) return 'N/A';
 if (!dateStr.includes('-')) return dateStr;
 const parts = dateStr.split('T')[0].split('-');
 if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
 return dateStr;
 };

 const fetchData = async () => {
 setIsLoading(true);
 const [vehRes, fuelRes, dieselRateRes, scansRes] = await Promise.all([
 supabase.from('vehicles').select('*').eq('is_active', true).order('vehicle_number'),
 supabase.from('diesel_fuel_logs').select('*, vehicles(vehicle_number)').order('fuel_date', { ascending: false }).order('fuel_log_id', { ascending: false }).limit(200),
 supabase.from('diesel_fuel_logs').select('diesel_rate_per_litre').order('fuel_date', { ascending: false }).order('fuel_log_id', { ascending: false }).limit(1),
 supabase.from("pending_scans").select("*").eq("document_type", "FUEL_SLIP").eq("status", "PENDING").order("created_at", { ascending: false })
 ]);

 if (vehRes.data) setVehicles(vehRes.data);
 if (fuelRes.data) setRecentFuelLogs(fuelRes.data);
 if (scansRes.data) setPendingScans(scansRes.data);

 if (dieselRateRes.data && dieselRateRes.data.length > 0 && dieselRateRes.data[0].diesel_rate_per_litre) {
 const latestRate = Number(dieselRateRes.data[0].diesel_rate_per_litre);
 setDieselRate(latestRate);
 if (!editLogId) setFDieselRate(latestRate);
 }
 setIsLoading(false);
 };

 useEffect(() => {
 fetchData();
 if (faNav === " Fuel Audit") handleRunAudit();
 }, [faNav]);

 useEffect(() => {
 if (faNav === " Mileage Tracker" && kmplTruckId) {
 calculateKMPLHistory(kmplTruckId);
 }
 }, [faNav, kmplTruckId]);

 const clearFuelForm = () => {
 setEditLogId(null); setEditTripId(null); setFDate(new Date().toISOString().split('T')[0]);
 setFVehicleId(""); setFCategory("TRIP_DIESEL"); setFLrNo(""); setFFillingKm("");
 setFLitres(""); setFDieselRate(dieselRate); setFIsTankFull(false); setActiveScanId(null);
 };

 const applyScanData = (scan: any) => {
 setActiveScanId(scan.scan_id);
 const data = scan.raw_json_result || {};
 let matched = false;
 if (data.truckNo && data.truckNo !== "UNKNOWN") {
 const aiTruck = String(data.truckNo).replace(/[^A-Z0-9]/g, '').toUpperCase();
 const matchedTruck = vehicles.find(v => {
 const dbTruck = String(v.vehicle_number).replace(/[^A-Z0-9]/g, '').toUpperCase();
 return dbTruck === aiTruck || dbTruck.includes(aiTruck) || aiTruck.includes(dbTruck);
 });
 if (matchedTruck) {
 setFVehicleId(String(matchedTruck.id));
 matched = true;
 }
 }
 if (data.litres) setFLitres(Number(data.litres));
 if (data.rate) setFDieselRate(Number(data.rate));
 else setFDieselRate(dieselRate);
 if (!matched) alert(`️ Could not auto-match the Truck Number from this entry (Detected: ${data.truckNo || "None"}). Please select the Truck from the dropdown below.`);
 };

 const handleEditClick = (log: any) => {
 setFaNav(" Issue Diesel"); setEditLogId(log.fuel_log_id); setEditTripId(log.trip_id || null);
 setFDate(log.fuel_date || ""); setFVehicleId(String(log.vehicle_id) || ""); setFCategory(log.diesel_category || "TRIP_DIESEL");
 setFLrNo(log.lr_number === "SUNDRY" ? "" : (log.lr_number || "")); setFFillingKm(log.filling_odometer_km || "");
 setFLitres(log.litres_filled || ""); setFDieselRate(log.diesel_rate_per_litre || dieselRate); setFIsTankFull(log.is_tank_full || false);
 setActiveScanId(null); window.scrollTo({ top: 0, behavior: 'smooth' });
 };

 const handleSaveDiesel = (e: React.FormEvent) => {
 e.preventDefault();
 if (!fVehicleId || Number(fLitres) <= 0 || Number(fDieselRate) <= 0) return alert("Invalid inputs.");
 const isUpdate = editLogId !== null;
 const cost = Math.round((Number(fLitres) * Number(fDieselRate)) * 100) / 100;

 const payload = {
 fuel_date: fDate, vehicle_id: Number(fVehicleId), lr_number: fLrNo.toUpperCase().trim() || "SUNDRY",
 diesel_category: fCategory, litres_filled: Number(fLitres), diesel_rate_per_litre: Number(fDieselRate),
 total_fuel_cost: cost, filling_odometer_km: Number(fFillingKm) || 0, is_tank_full: fIsTankFull
 };

 triggerModal(
 isUpdate ? "Update Diesel Record" : "Record Diesel Entry",
 isUpdate ? "Edit this fuel log? Trip expenses will recalculate." : `Issue ${fLitres}L of diesel? This updates expenses immediately.`,
 false, isUpdate ? "Update Record" : "Record Diesel",
 async () => {
 setIsProcessing(true);
 if (isUpdate) {
 const { error } = await supabase.from('diesel_fuel_logs').update(payload).eq('fuel_log_id', editLogId);
 if (error) { alert("Error: " + error.message); setIsProcessing(false); return; }
 if (editTripId) {
 const { data: trip } = await supabase.from('trips').select('start_km').eq('trip_id', editTripId).single();
 let updatePayload: any = { fuel_litres: Number(fLitres), fuel_expense: cost };
 if (trip && (trip.start_km === 0 || trip.start_km === null)) updatePayload.start_km = Number(fFillingKm);
 await supabase.from('trips').update(updatePayload).eq('trip_id', editTripId);
 }
 } else {
 const { error } = await supabase.from('diesel_fuel_logs').insert([payload]);
 if (error) { alert("Error: " + error.message); setIsProcessing(false); return; }
 if (activeScanId) {
 await supabase.from("pending_scans").update({ status: 'PROCESSED' }).eq("scan_id", activeScanId);
 setPendingScans(prev => prev.filter(s => s.scan_id !== activeScanId));
 }
 }
 clearFuelForm(); fetchData(); setIsProcessing(false); closeModal();
 }
 );
 };

 const handleDeleteFuel = (id: string) => {
 triggerModal("Delete Fuel Record", "Warning: Permanently delete this fuel log? This action cannot be reversed.", true, "Delete Log", async () => {
 setIsProcessing(true); 
 const { error } = await supabase.from('diesel_fuel_logs').delete().eq('fuel_log_id', id);
 if (error) alert("Error: " + error.message);
 clearFuelForm(); fetchData(); if (faNav === " Fuel Audit") handleRunAudit(); 
 setIsProcessing(false); closeModal();
 });
 };

 const handleRunAudit = async () => {
 setIsProcessing(true);
 let query = supabase.from('diesel_fuel_logs').select('*, trucks!inner(vehicle_number)').order('fuel_date', { ascending: false }).order('fuel_log_id', { ascending: false });
 
 if (auditDateMode === "Specific Date") query = query.eq('fuel_date', auditSpecificDate);
 else if (auditDateMode === "Date Range") query = query.gte('fuel_date', auditFromDate).lte('fuel_date', auditToDate);
 
 if (auditTruck !== "All Trucks") query = query.eq('trucks.vehicle_number', auditTruck);
 if (auditCategory !== "All Categories") query = query.eq('diesel_category', auditCategory);

 const { data, error } = await query;
 if (error) alert("Error fetching audit: " + error.message);
 setAuditResults(data || []);
 setIsProcessing(false);
 };

 // KMPL ALGORITHM
 const calculateKMPLHistory = async (truckId: string) => {
 setIsProcessing(true);
 const { data: logs } = await supabase.from('diesel_fuel_logs').select('*').eq('vehicle_id', truckId).gt('filling_odometer_km', 0).order('filling_odometer_km', { ascending: true });

 if (!logs || logs.length === 0) {
 setKmplSpans([]); setOngoingKmplSpan(null); setIsProcessing(false); return;
 }

 const spans: any[] = [];
 let currentSpan: any = null;

 for (const log of logs) {
 if (!currentSpan) {
 if (log.is_tank_full) currentSpan = { start_date: log.fuel_date, start_odo: Number(log.filling_odometer_km), accumulated_litres: 0, accumulated_cost: 0, logs_count: 0 };
 } else {
 currentSpan.accumulated_litres += Number(log.litres_filled);
 currentSpan.accumulated_cost += Number(log.total_fuel_cost);
 currentSpan.logs_count += 1;

 if (log.is_tank_full) {
 const end_odo = Number(log.filling_odometer_km);
 const distance = end_odo - currentSpan.start_odo;

 if (distance > 0 && currentSpan.accumulated_litres > 0) {
 spans.push({
 start_date: currentSpan.start_date, end_date: log.fuel_date, start_odo: currentSpan.start_odo, end_odo: end_odo,
 distance: distance, consumed_litres: currentSpan.accumulated_litres, total_cost: currentSpan.accumulated_cost,
 kmpl: (distance / currentSpan.accumulated_litres).toFixed(2), cost_per_km: (currentSpan.accumulated_cost / distance).toFixed(2),
 logs_count: currentSpan.logs_count
 });
 }
 currentSpan = { start_date: log.fuel_date, start_odo: end_odo, accumulated_litres: 0, accumulated_cost: 0, logs_count: 0 };
 }
 }
 }
 setKmplSpans(spans.reverse()); setOngoingKmplSpan(currentSpan); setIsProcessing(false);
 };

 // --- PREMIUM EXPORT MAPPINGS ---
 const filteredRecent = recentFuelLogs.filter(l => 
 (l.vehicles?.vehicle_number || "").toLowerCase().includes(recentSearch.toLowerCase()) ||
 (l.lr_number || "").toLowerCase().includes(recentSearch.toLowerCase())
 );
 const exportRecent = filteredRecent.map(l => ({
 "Date": formatDate(l.fuel_date), "Truck": l.vehicles?.vehicle_number, "Category": l.diesel_category, "LR No": l.lr_number || "-",
 "Litres": l.litres_filled, "Total Cost (INR)": l.total_fuel_cost, "Tank Full": l.is_tank_full ? "Yes" : "No"
 }));

 const filteredAudit = auditResults.filter(l => 
 (l.vehicles?.vehicle_number || "").toLowerCase().includes(auditSearch.toLowerCase()) ||
 (l.lr_number || "").toLowerCase().includes(auditSearch.toLowerCase())
 );
 const exportAudit = filteredAudit.map(l => ({
 "Log ID": l.fuel_log_id, "Date": formatDate(l.fuel_date), "Truck": l.vehicles?.vehicle_number || "Unknown",
 "Category": l.diesel_category, "LR Number": l.lr_number || "-", "Odometer": l.filling_odometer_km || 0,
 "Litres": l.litres_filled || 0, "Cost (INR)": l.total_fuel_cost || 0, "Tank Full": l.is_tank_full ? "Yes" : "No"
 }));

 const filteredKmpl = kmplSpans.filter(s => 
 formatDate(s.start_date).includes(kmplSearch) || formatDate(s.end_date).includes(kmplSearch)
 );
 const exportKmpl = filteredKmpl.map(s => ({
 "Span": `${formatDate(s.start_date)} to ${formatDate(s.end_date)}`, "Odo Start": s.start_odo, "Odo End": s.end_odo,
 "Distance (KM)": s.distance, "Consumed (L)": s.consumed_litres.toFixed(1), "KMPL": s.kmpl, "Cost/KM (INR)": s.cost_per_km
 }));

 return (
 <div className="space-y-6 animate-in fade-in duration-300">
 <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} isDanger={modalConfig.isDanger} confirmText={modalConfig.confirmText} onConfirm={modalConfig.action} onCancel={closeModal} isProcessing={isProcessing} />

 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
 <div>
 <h2 className="text-xl font-semibold text-fg  tracking-tight">Fuel & Mileage</h2>
 <p className="text-xs text-fg-secondary mt-0.5">Manage diesel logs, full-to-full KMPL tracking, and fuel expense audits.</p>
 </div>
 <div className="flex flex-wrap gap-2">
 {[" Issue Diesel", " Fuel Audit", " Mileage Tracker"].map((tab) => (
 <Button
  key={tab}
  type="button"
  onClick={() => setFaNav(tab)}
  variant={faNav === tab ? "default" : "glass"}
  className={`px-4 py-2.5 rounded-xl text-xs font-bold ${
    faNav === tab
      ? "shadow-lg shadow-orange"
      : "text-fg-secondary hover:text-fg hover:bg-surface-raised/50"
  }`}
>
  {tab}
</Button>
 ))}
 </div>
 </div>

 {faNav === " Issue Diesel" && (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
 <div className="lg:col-span-4 liquid-glass p-6 shadow-xl h-fit">
 
 {/* Inbox UI */}
 {!editLogId && pendingScans.length > 0 && (
 <div className="mb-6 p-4 input-glass">
 <h4 className="text-xs font-semibold text-info  tracking-wider flex items-center gap-2 mb-3"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-info opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-info"></span></span>Pending Fuel Slips ({pendingScans.length})</h4>
 <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
 {pendingScans.map(scan => {
 const data = scan.raw_json_result || {};
 return (
 <button key={scan.scan_id} type="button" onClick={() => applyScanData(scan)} className={`min-w-[200px] text-left p-3 rounded-lg border transition-all snap-start ${activeScanId === scan.scan_id ? 'border-info bg-info-soft ring-1 ring-info' : 'border-border hover:border-border-strong input-glass'}`}>
 <div className="animate-tab-focus flex justify-between items-start gap-4">
 <div>
 <p className="text-[10px] text-fg-secondary font-bold mb-1">Truck: <span className="text-fg">{data.truckNo || "UNKNOWN"}</span></p>
 <p className="text-xs font-semibold text-fg truncate">{data.litres || 0} L <span className="text-fg-muted font-medium">@ {data.rate || '?'}</span></p>
 </div>
 </div>
 </button>
 );
 })}
 </div>
 </div>
 )}

 <div className="flex justify-between items-center border-b border-border pb-3 mb-5">
 <h3 className="text-sm font-semibold text-fg  tracking-wide">{editLogId ? "Edit Diesel Log" : "Record Fuel Bill"}</h3>
 {editLogId && <span className="px-3 py-1 bg-warning-soft text-warning text-[10px] font-bold rounded-lg  tracking-normal animate-pulse">Editing Mode</span>}
 </div>

 <form onSubmit={handleSaveDiesel} className="space-y-4">
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Fuel Date *</label><Input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="text-fg font-semibold" required /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Select Truck *</label><Select value={fVehicleId} onChange={e => setFVehicleId(e.target.value)} className="text-fg font-bold" required disabled={isLoading}><option value="">-- SELECT TRUCK --</option>{vehicles.map(v => <option key={v.id} value={String(v.id)}>{v.vehicle_number}</option>)}</Select></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Category *</label><Select value={fCategory} onChange={e => setFCategory(e.target.value)} className="text-fg font-semibold"><option value="TRIP_DIESEL">TRIP_DIESEL</option><option value="SUNDRY_DIESEL">SUNDRY_DIESEL</option></Select></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Trip LR No (Optional)</label><Input type="text" maxLength={20} value={fLrNo} onChange={e => setFLrNo(e.target.value.toUpperCase())} placeholder="e.g. 40080069852" className="text-fg font-semibold" /></div>
 
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Filling KM</label><Input type="number" min="0" max="9999999" value={fFillingKm} onChange={e => setFFillingKm(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.0" className="text-fg font-semibold" /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Litres *</label><Input type="number" step="0.1" min="0.1" max="2000" value={fLitres} onChange={e => setFLitres(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.0" className="font-semibold text-accent" required /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Rate () *</label><Input type="number" step="0.1" min="0.1" max="200" value={fDieselRate} onChange={e => setFDieselRate(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.00" className="text-fg font-bold" required /></div>
 </div>

 <div className="flex justify-between items-center input-glass p-4 rounded-xl border border-border mt-2">
 <label className="flex items-center gap-3 cursor-pointer select-none">
 <input type="checkbox" checked={fIsTankFull} onChange={e => setFIsTankFull(e.target.checked)} className="w-4 h-4 rounded text-accent input-glass border-border focus:ring-accent" />
 <span className="text-xs font-semibold text-fg "> Tank Full</span>
 </label>
 <div className="text-right">
 <span className="text-[10px] font-bold text-fg-muted  mr-3">Cost:</span>
 <span className="text-lg font-semibold text-danger">{((Number(fLitres) || 0) * (Number(fDieselRate) || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
 </div>
 </div>

 <div className="flex gap-3 pt-4 border-t border-border">
 {editLogId && (
 <>
 <Button
   type="button"
   variant="destructive"
   size="lg"
   onClick={() => handleDeleteFuel(editLogId)}
   aria-label="Delete fuel record"
 >
   Delete
 </Button>
 <Button
   type="button"
   variant="glass"
   size="lg"
   onClick={clearFuelForm}
   className="flex-1"
 >
   Cancel
 </Button>
</>
 )}
 <Button
   type="submit"
   variant="default"
   size="lg"
   disabled={!fVehicleId || Number(fLitres) <= 0 || isProcessing}
   className="flex-[2]"
 >
   {editLogId ? "Update Record" : "Record Diesel"}
 </Button>
 </div>
 </form>
 </div>

 <div className="lg:col-span-8 liquid-glass overflow-hidden flex flex-col shadow-xl h-fit">
 <TableToolbar title="Recent Fuel Entries" searchQuery={recentSearch} setSearchQuery={setRecentSearch} exportData={exportRecent} exportFilename="Recent_Fuel_Logs" />
 <div className="overflow-x-auto flex-1 max-h-[600px] overflow-y-auto w-full">
 <Table className="min-w-full whitespace-nowrap">
 <TableHeader className="sticky top-0 z-10">
   <TableRow>
     <TableHead className="px-5 py-3 text-left">Date</TableHead>
     <TableHead className="px-5 py-3 text-left">Truck</TableHead>
     <TableHead className="px-5 py-3 text-left">Category / LR</TableHead>
     <TableHead className="px-5 py-3 text-right">Litres</TableHead>
     <TableHead className="px-5 py-3 text-right">Cost ()</TableHead>
   </TableRow>
 </TableHeader>

 <TableBody>
   {filteredRecent.map((log) => (
     <TableRow
       key={log.fuel_log_id}
       onClick={() => handleEditClick(log)}
       className={`cursor-pointer border-l-2 ${
         editLogId === log.fuel_log_id
           ? "border-l-accent bg-accent/10"
           : "border-l-transparent"
       }`}
     >
       <TableCell className="px-5 py-3.5 font-semibold text-fg-secondary">
         {formatDate(log.fuel_date)}
       </TableCell>

       <TableCell className="px-5 py-3.5 font-semibold text-fg">
         {log.vehicles?.vehicle_number}
       </TableCell>

       <TableCell className="px-5 py-3.5 text-fg-secondary">
         {log.diesel_category}
         <br />
         <span className="text-[9px] text-fg-muted">
           {log.lr_number}
         </span>
       </TableCell>

       <TableCell className="px-5 py-3.5 text-right font-semibold text-accent">
         {log.litres_filled} L{" "}
         {log.is_tank_full && (
           <span title="Tank Full" className="ml-1 text-sm"></span>
         )}
       </TableCell>

       <TableCell className="px-5 py-3.5 text-right font-bold text-danger">
         {(log.total_fuel_cost || 0).toLocaleString("en-IN", {
           minimumFractionDigits: 2,
         })}
       </TableCell>
     </TableRow>
   ))}

   {filteredRecent.length === 0 && (
     <TableRow>
       <TableCell
         colSpan={5}
         className="p-8 text-center font-medium text-fg-muted"
       >
         No logs found.
       </TableCell>
     </TableRow>
   )}
 </TableBody>
 </Table>
 </div>
 </div>
 </div>
 )}

 {faNav === " Fuel Audit" && (
 <div className="liquid-glass p-6 shadow-xl animate-in slide-in-from-bottom-4">
 <h3 className="text-sm font-semibold text-fg  tracking-wide border-b border-border pb-3 mb-5">Advanced Fuel Audit Engine</h3>
 
 <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Date Mode</label><Select value={auditDateMode} onChange={e => setAuditDateMode(e.target.value)} className="text-fg font-semibold"><option value="All Time">All Time</option><option value="Specific Date">Specific Date</option><option value="Date Range">Date Range</option></Select></div>
 {auditDateMode === "Specific Date" && <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Date</label><Input type="date" value={auditSpecificDate} onChange={e => setAuditSpecificDate(e.target.value)} className="text-fg font-semibold" /></div>}
 {auditDateMode === "Date Range" && <><div className="col-span-1"><label className="block text-[10px] font-bold text-fg-secondary  mb-1">From</label><Input type="date" value={auditFromDate} onChange={e => setAuditFromDate(e.target.value)} className="text-fg font-semibold" /></div><div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">To</label><Input type="date" value={auditToDate} onChange={e => setAuditToDate(e.target.value)} className="text-fg font-semibold" /></div></>}
 {auditDateMode === "All Time" && <div className="hidden md:block md:col-span-2"></div>}
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Truck No</label><Select value={auditTruck} onChange={e => setAuditTruck(e.target.value)} className="text-fg font-bold"><option value="All Trucks">All Trucks</option>{vehicles.map(v => <option key={v.id} value={v.vehicle_number}>{v.vehicle_number}</option>)}</Select></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Category</label><Select value={auditCategory} onChange={e => setAuditCategory(e.target.value)} className="text-fg font-semibold"><option value="All Categories">All Categories</option><option value="TRIP_DIESEL">TRIP_DIESEL</option><option value="SUNDRY_DIESEL">SUNDRY_DIESEL</option></Select></div>
 </div>

 <div className="flex justify-end mb-6">
 <Button
   type="button"
   variant="default"
   size="lg"
   onClick={handleRunAudit}
 >
   Fetch Database Records
 </Button>
 </div>

 <div className="border border-border rounded-xl overflow-hidden">
 <TableToolbar title="Audit Results" searchQuery={auditSearch} setSearchQuery={setAuditSearch} exportData={exportAudit} exportFilename="Fuel_Audit_Report" />
 <div className="overflow-x-auto w-full max-h-[500px] overflow-y-auto">
 <Table className="min-w-full whitespace-nowrap text-xs">
 <TableHeader className="sticky top-0 z-10">
   <TableRow>
     <TableHead className="px-5 py-4 text-left">Log ID</TableHead>
     <TableHead className="px-5 py-4 text-left">Date</TableHead>
     <TableHead className="px-5 py-4 text-left">Truck</TableHead>
     <TableHead className="px-5 py-4 text-left">Category</TableHead>
     <TableHead className="px-5 py-4 text-left">LR No</TableHead>
     <TableHead className="px-5 py-4 text-right">Odometer</TableHead>
     <TableHead className="px-5 py-4 text-right">Litres</TableHead>
     <TableHead className="px-5 py-4 text-right">Cost ()</TableHead>
   </TableRow>
 </TableHeader>

 <TableBody>
   {filteredAudit.map((l) => (
     <TableRow
       key={l.fuel_log_id}
       onClick={() => handleEditClick(l)}
       className="cursor-pointer"
     >
       <TableCell className="px-5 py-3 font-bold text-fg-muted">
         #{l.fuel_log_id}
       </TableCell>

       <TableCell className="px-5 py-3 font-semibold text-fg-secondary">
         {formatDate(l.fuel_date)}
       </TableCell>

       <TableCell className="px-5 py-3 font-semibold text-fg">
         {l.vehicles?.vehicle_number}
       </TableCell>

       <TableCell className="px-5 py-3 text-fg-secondary">
         {l.diesel_category}
       </TableCell>

       <TableCell className="px-5 py-3 font-bold text-accent">
         {l.lr_number}
       </TableCell>

       <TableCell className="px-5 py-3 text-right text-fg-secondary">
         {l.filling_odometer_km}
       </TableCell>

       <TableCell className="px-5 py-3 text-right font-semibold text-accent">
         {l.litres_filled} L{" "}
         {l.is_tank_full && (
           <span title="Tank Full" className="ml-1 text-sm"></span>
         )}
       </TableCell>

       <TableCell className="px-5 py-3 text-right font-bold text-danger">
         {(l.total_fuel_cost || 0).toLocaleString("en-IN", {
           minimumFractionDigits: 2,
         })}
       </TableCell>
     </TableRow>
   ))}

   {filteredAudit.length === 0 && (
     <TableRow>
       <TableCell
         colSpan={8}
         className="p-8 text-center font-medium text-fg-muted"
       >
         No audit records found.
       </TableCell>
     </TableRow>
   )}
 </TableBody>
 </Table>
 </div>
 </div>
 </div>
 )}

 {faNav === " Mileage Tracker" && (
 <div className="liquid-glass p-6 shadow-xl animate-in slide-in-from-bottom-4">
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-border pb-4 mb-6 gap-4">
 <div><h3 className="text-sm font-semibold text-fg  tracking-wide">Vehicle Mileage (KMPL) Tracker</h3><p className="text-xs text-fg-secondary mt-1">Calculates true mileage using the "Full-to-Full" standard formula.</p></div>
 <div className="w-full md:w-64"><Select value={kmplTruckId} onChange={e => setKmplTruckId(e.target.value)}><option value="">-- SELECT TRUCK --</option>{vehicles.map(v => (<option key={v.id} value={v.id}>{v.vehicle_number}</option>))}</Select></div>
 </div>

 {!kmplTruckId ? (
 <div className="p-12 text-center input-glass"><span className="text-4xl mb-4"></span><p className="text-sm font-bold text-fg-muted">Select a truck above to view its automated full-to-full mileage history.</p></div>
 ) : isProcessing ? (
 <div className="p-12 text-center"><p className="text-sm font-bold text-accent animate-pulse">Calculating algorithms...</p></div>
 ) : (
 <div className="space-y-6">
 {ongoingKmplSpan && (
 <div className="bg-info-soft border border-info p-5 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
 <div><h4 className="text-[10px] font-semibold text-info  tracking-normal mb-1">Current Ongoing Span (Awaiting Next Tank Full)</h4><p className="text-sm font-semibold text-fg-secondary">Started at Odo <span className="font-semibold text-fg">{ongoingKmplSpan.start_odo} KM</span> on {formatDate(ongoingKmplSpan.start_date)}</p></div>
 <div className="text-right"><p className="text-2xl font-semibold text-info">{ongoingKmplSpan.accumulated_litres.toFixed(1)} L</p><p className="text-[10px] font-bold text-info ">Accumulated so far</p></div>
 </div>
 )}
 <div className="overflow-x-auto rounded-xl border border-border w-full">
 <TableToolbar title="KMPL History" searchQuery={kmplSearch} setSearchQuery={setKmplSearch} exportData={exportKmpl} exportFilename="KMPL_Report" />
 <Table className="min-w-full whitespace-nowrap text-xs">
 <TableHeader className="sticky top-0 z-10">
   <TableRow>
     <TableHead className="px-5 py-4 text-left">Period</TableHead>
     <TableHead className="px-5 py-4 text-right">Odo Start</TableHead>
     <TableHead className="px-5 py-4 text-right">Odo End</TableHead>
     <TableHead className="px-5 py-4 text-right">Distance</TableHead>
     <TableHead className="px-5 py-4 text-right">Fuel Used</TableHead>
     <TableHead className="px-5 py-4 text-right">KMPL</TableHead>
     <TableHead className="px-5 py-4 text-right">Cost / KM</TableHead>
     <TableHead className="px-5 py-4 text-right">Logs</TableHead>
   </TableRow>
 </TableHeader>

 <TableBody>
   {filteredKmpl.map((s) => (
     <TableRow key={`${s.start_date}-${s.end_date}-${s.start_odo}`}>
       <TableCell className="px-5 py-3 font-semibold text-fg">
         {formatDate(s.start_date)} → {formatDate(s.end_date)}
       </TableCell>

       <TableCell className="px-5 py-3 text-right text-fg-secondary">
         {s.start_odo}
       </TableCell>

       <TableCell className="px-5 py-3 text-right text-fg-secondary">
         {s.end_odo}
       </TableCell>

       <TableCell className="px-5 py-3 text-right font-semibold text-fg-secondary">
         {s.distance}
       </TableCell>

       <TableCell className="px-5 py-3 text-right text-fg-secondary">
         {s.consumed_litres.toFixed(1)} L
       </TableCell>

       <TableCell className="px-5 py-3 text-right font-bold text-accent">
         {s.kmpl}
       </TableCell>

       <TableCell className="px-5 py-3 text-right font-semibold text-fg-secondary">
         {s.cost_per_km}
       </TableCell>

       <TableCell className="px-5 py-3 text-right text-fg-muted">
         {s.logs_count}
       </TableCell>
     </TableRow>
   ))}

   {filteredKmpl.length === 0 && (
     <TableRow>
       <TableCell
         colSpan={8}
         className="p-8 text-center font-medium text-fg-muted"
       >
         No KMPL records found.
       </TableCell>
     </TableRow>
   )}
 </TableBody>
 </Table>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 );
}
