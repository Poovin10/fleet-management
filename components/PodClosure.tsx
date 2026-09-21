"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// --- CUSTOM SEARCHABLE SELECT COMPONENT ---
function SearchableSelect({ options, value, onChange, placeholder, disabled }: { options: {label: string, value: string}[], value: string, onChange: (val: string) => void, placeholder: string, disabled?: boolean }) {
 const [isOpen, setIsOpen] = useState(false);
 const [search, setSearch] = useState("");
 const containerRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 const handleClickOutside = (e: MouseEvent) => {
 if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
 };
 document.addEventListener("mousedown", handleClickOutside);
 return () => document.removeEventListener("mousedown", handleClickOutside);
 }, []);

 const selectedOption = options.find(o => String(o.value) === String(value));

 return (
 <div ref={containerRef} className="relative w-full">
 <div 
 className={`w-full text-sm p-3 rounded-xl border ${isOpen ? 'border-accent ring-1 ring-accent' : 'border-border'} input-glass text-fg flex justify-between items-center cursor-pointer font-bold ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
 onClick={() => !disabled && setIsOpen(!isOpen)}
 >
 <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
 <span className="text-[10px] text-fg-secondary">▼</span>
 </div>
 {isOpen && (
 <div className="absolute z-50 w-full mt-1 input-glass border border-border rounded-xl shadow-2xl max-h-60 overflow-y-auto">
 <div className="p-2 sticky top-0 input-glass bg-surface-raised">
 <Input
 type="text"
 className="text-xs p-2.5"
 placeholder="Search LR..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 onClick={(e) => e.stopPropagation()}
 autoFocus
 />
 </div>
 <div className="pb-2 px-2">
 {options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).map(o => (
 <div 
 key={o.value} 
 className="p-2.5 text-xs font-bold text-fg-secondary hover:bg-accent/20 hover:text-fg rounded-lg cursor-pointer truncate"
 onClick={() => { onChange(o.value); setIsOpen(false); setSearch(""); }}
 >
 {o.label}
 </div>
 ))}
 {options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).length === 0 && (
 <div className="p-3 text-xs text-fg-muted text-center font-bold">No matches found</div>
 )}
 </div>
 </div>
 )}
 </div>
 );
}

export function PodClosure({ onSuccess }: { onSuccess?: () => void }) {
 const supabase = createClient();
 const [isLoading, setIsLoading] = useState(true);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [dieselRate, setDieselRate] = useState<number>(95.0);

 const [alertConfig, setAlertConfig] = useState({
 isOpen: false, title: "", message: "", type: "info" as "success" | "error" | "info"
 });

 const [activeTrips, setActiveTrips] = useState<any[]>([]);
 const [selectedLr, setSelectedLr] = useState<string>("");
 const [currentTrip, setCurrentTrip] = useState<any>(null);

 // INBOX STATES
 const [pendingScans, setPendingScans] = useState<any[]>([]); 
 const [activeScanId, setActiveScanId] = useState<string | null>(null);
 const [scannedShortageKg, setScannedShortageKg] = useState<number | null>(null);

 const [podNo, setPodNo] = useState("");
 const [closingDate, setClosingDate] = useState(new Date().toISOString().split("T")[0]);
 const [unloadedMt, setUnloadedMt] = useState<number | "">("");
 const [closingKm, setClosingKm] = useState<number | "">("");
 const [haltBata, setHaltBata] = useState<number | "">("");
 const [claims, setClaims] = useState<number | "">("");
 const [closingDiesel, setClosingDiesel] = useState<number | "">("");
 const [isTankFull, setIsTankFull] = useState(false);
 
 const [complianceWarnings, setComplianceWarnings] = useState<any[]>([]);

 const formatDate = (dateStr: string) => {
 if (!dateStr) return 'N/A';
 if (!dateStr.includes('-')) return dateStr;
 const parts = dateStr.split('T')[0].split('-');
 if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
 return dateStr;
 };

 const fetchActiveTrips = async () => {
 setIsLoading(true);
 const [tripsRes, dieselRes, scansRes] = await Promise.all([
 supabase.from("trips").select(`
 trip_id, trip_number, trip_start_date, origin, destination, loaded_weight_mt, start_km, fuel_litres, vehicle_id, primary_driver_id,
 vehicles ( vehicle_number, truck_type, fc_expiry_date, insurance_expiry_date, qtax_expiry_date, puc_expiry_date, np_expiry_date, state_permit_expiry_date, tank_cert_expiry_date ),
 drivers ( full_name, phone_number, driver_code, license_expiry_date )
 `).neq("trip_status", "COMPLETED").order("trip_start_date", { ascending: true }),
 supabase.from("diesel_fuel_logs").select("diesel_rate_per_litre").order("fuel_date", { ascending: false }).order("fuel_log_id", { ascending: false }).limit(1),
 supabase.from("pending_scans").select("*").eq("document_type", "POD_CLOSURE").eq("status", "PENDING").order("created_at", { ascending: false })
 ]);

 if (tripsRes.data) setActiveTrips(tripsRes.data);
 if (dieselRes.data && dieselRes.data.length > 0 && dieselRes.data[0].diesel_rate_per_litre) setDieselRate(Number(dieselRes.data[0].diesel_rate_per_litre));
 if (scansRes.data) setPendingScans(scansRes.data);
 setIsLoading(false);
 };

 useEffect(() => { fetchActiveTrips(); }, []);

 // DELETE INBOX ENTRIES
 const handleDeleteScan = async (e: React.MouseEvent, scanId: string) => {
 e.stopPropagation();
 if (!confirm("Delete this entry permanently from the inbox?")) return;
 await supabase.from("pending_scans").delete().eq("scan_id", scanId);
 setPendingScans(prev => prev.filter(s => s.scan_id !== scanId));
 if (activeScanId === scanId) setActiveScanId(null);
 };

 // LOCAL PATTERN AUTO-FILL FUNCTION
 const applyScanData = (scan: any) => {
 setActiveScanId(scan.scan_id);
 const data = scan.raw_json_result || {};

 let matched = false;
 
 if (data.lrNo && data.lrNo !== "UNKNOWN") {
 const cleanLr = String(data.lrNo).toUpperCase().replace(/[^A-Z0-9]/g, '');
 const matchedLr = activeTrips.find(t => {
 const dbLr = String(t.trip_number).toUpperCase().replace(/[^A-Z0-9]/g, '');
 return dbLr === cleanLr || dbLr.includes(cleanLr) || cleanLr.includes(dbLr);
 });
 if (matchedLr) {
 setSelectedLr(matchedLr.trip_number);
 matched = true;
 }
 }
 
 if (data.deliveryDate) setClosingDate(data.deliveryDate);
 if (data.shortageKg) setScannedShortageKg(Number(data.shortageKg));
 else setScannedShortageKg(null);

 if (!matched) {
 setAlertConfig({
 isOpen: true,
 title: "Manual Selection Required ⚠️",
 message: `Could not auto-match the LR number from this entry (Detected: ${data.lrNo || "None"}). Please manually select the Active LR from the dropdown below.`,
 type: "info"
 });
 }
 };

 useEffect(() => {
 if (selectedLr) {
 const trip = activeTrips.find((t) => t.trip_number === selectedLr);
 if (trip) {
 setCurrentTrip(trip);
 if (scannedShortageKg !== null && trip.loaded_weight_mt) {
 const finalWeight = Number(trip.loaded_weight_mt) - (scannedShortageKg / 1000);
 setUnloadedMt(Number(finalWeight.toFixed(3)));
 } else {
 setUnloadedMt(trip.loaded_weight_mt || 0);
 }
 setClosingKm(""); setHaltBata(""); setClaims(""); setClosingDiesel(""); setIsTankFull(false);
 }
 } else {
 setCurrentTrip(null);
 setScannedShortageKg(null);
 }
 }, [selectedLr, activeTrips, scannedShortageKg]);

 useEffect(() => {
 if (!currentTrip) { setComplianceWarnings([]); return; }
 
 const warnings: any[] = [];
 const today = new Date(); today.setHours(0, 0, 0, 0);
 const tenDaysFromNow = new Date(today); tenDaysFromNow.setDate(today.getDate() + 10);

 const checkWarning = (name: string, docName: string, dateVal: string) => {
 if (!dateVal) return;
 const expDate = new Date(dateVal); expDate.setHours(0, 0, 0, 0);
 if (expDate <= tenDaysFromNow) warnings.push({ name, docName, date: dateVal, isUrgent: expDate <= today });
 };

 const d = currentTrip.drivers;
 if (d) checkWarning(`Driver ${d.driver_code}`, "License", d.license_expiry_date);

 const v = currentTrip.vehicles;
 if (v) {
 const tName = `Truck ${v.vehicle_number}`;
 checkWarning(tName, "FC", v.fc_expiry_date);
 checkWarning(tName, "Insurance", v.insurance_expiry_date);
 checkWarning(tName, "Q-Tax", v.qtax_expiry_date);
 checkWarning(tName, "PUC", v.puc_expiry_date);
 checkWarning(tName, "NP", v.np_expiry_date);
 checkWarning(tName, "State Permit", v.state_permit_expiry_date);
 if (String(v.truck_type).toUpperCase().includes("BULK")) checkWarning(tName, "Tank Cert", v.tank_cert_expiry_date);
 }
 setComplianceWarnings(warnings);
 }, [currentTrip]);

 const getDaysPending = (startDateStr: string) => {
 if (!startDateStr) return 0;
 const start = new Date(startDateStr).getTime();
 const today = new Date().getTime();
 return Math.max(0, Math.floor((today - start) / (1000 * 60 * 60 * 24)));
 };

 const handleSettlePod = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!currentTrip || !podNo.trim()) return setAlertConfig({ isOpen: true, title: "Missing Information", message: "Please enter a valid POD Number to proceed.", type: "error" });

 setIsSubmitting(true);
 const loadedMt = Number(currentTrip.loaded_weight_mt) || 0;
 const finalUnloadedMt = Number(unloadedMt) || 0;
 const shortageMt = Math.max(0, loadedMt - finalUnloadedMt);

 const startKm = Number(currentTrip.start_km) || 0;
 const endKm = Number(closingKm) || 0;
 const totalKmRun = endKm > startKm ? endKm - startKm : 0;

 const addDiesel = Number(closingDiesel) || 0;
 const addedDieselCost = Math.round(addDiesel * dieselRate * 100) / 100;

 const { error: tripUpdateError } = await supabase.from("trips").update({
 pod_number: podNo.trim().toUpperCase(), trip_end_date: closingDate, end_km: endKm, total_km_run: totalKmRun,
 unloaded_weight_mt: finalUnloadedMt, shortage_mt: shortageMt, halt_bata: Number(haltBata) || 0,
 enroute_repairs_maintenance: Number(claims) || 0, fuel_litres: (Number(currentTrip.fuel_litres) || 0) + addDiesel,
 trip_status: "COMPLETED", trip_closed_at: new Date().toISOString()
 }).eq("trip_id", currentTrip.trip_id);

 if (tripUpdateError) { setIsSubmitting(false); return setAlertConfig({ isOpen: true, title: "Closure Failed", message: "Error updating trip: " + tripUpdateError.message, type: "error" }); }

 if (addDiesel > 0) {
 await supabase.from("diesel_fuel_logs").insert([{
 fuel_date: closingDate, vehicle_id: currentTrip.id, trip_id: currentTrip.trip_id, lr_number: currentTrip.trip_number,
 diesel_category: "TRIP_DIESEL", litres_filled: addDiesel, diesel_rate_per_litre: dieselRate, total_fuel_cost: addedDieselCost,
 filling_odometer_km: endKm, is_tank_full: isTankFull
 }]);
 }

 await supabase.from('vehicles').update({ current_status: "AVAILABLE_FOR_LOAD", status_remarks: "Available (Auto-Closed on POD)" }).eq("vehicle_id", currentTrip.id);

 if (activeScanId) {
 await supabase.from("pending_scans").update({ status: 'PROCESSED' }).eq("scan_id", activeScanId);
 setPendingScans(prev => prev.filter(s => s.scan_id !== activeScanId)); 
 setActiveScanId(null);
 }

 setAlertConfig({ isOpen: true, title: "POD Settled!", message: `Trip ${currentTrip.trip_number} successfully closed and settled!`, type: "success" });
 setIsSubmitting(false); setSelectedLr(""); setPodNo(""); setCurrentTrip(null); setScannedShortageKg(null); fetchActiveTrips(); if (onSuccess) onSuccess();
 };

 const lrOptions = activeTrips.map((t) => ({ value: t.trip_number, label: `LR: ${t.trip_number} | Date: ${formatDate(t.trip_start_date)} | Truck: ${t.vehicles?.vehicle_number || "Unknown"}` }));
 const noSpinClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
 const numProps = { step: "any", onWheel: (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur() };

 return (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-300 relative">
 <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} />

 {/* LEFT PANEL: Settle POD Form */}
 <div className="lg:col-span-7 liquid-glass p-6 shadow-sm">
 
 {pendingScans.length > 0 && (
 <div className="mb-6 p-4 input-glass border border-border rounded-xl">
 <h4 className="text-xs font-semibold text-success tracking-wider flex items-center gap-2 mb-3">
 <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span></span>
 Pending POD Entries Inbox ({pendingScans.length})
 </h4>
 <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
 {pendingScans.map(scan => {
 const data = scan.raw_json_result || {};
 return (
 <button key={scan.scan_id} type="button" onClick={() => applyScanData(scan)} className={`min-w-[200px] text-left p-3 rounded-lg border transition-all snap-start ${activeScanId === scan.scan_id ? 'border-success bg-success/10 ring-1 ring-success' : 'border-border hover:border-border-strong input-glass'}`}>
 <div className="flex justify-between items-start gap-4">
 <div>
 <p className="text-[10px] text-fg-secondary font-bold mb-1">LR: <span className="text-fg">{data.lrNo || "UNKNOWN"}</span></p>
 <p className="text-xs font-semibold text-fg truncate">Shortage: <span className={data.shortageKg > 0 ? "text-danger" : "text-success"}>{data.shortageKg || 0} kg</span></p>
 </div>
 <div onClick={(e) => handleDeleteScan(e, scan.scan_id)} className="text-fg-muted hover:text-danger input-glass p-1.5 rounded border border-border transition-colors" title="Delete entry">🗑️</div>
 </div>
 </button>
 );
 })}
 </div>
 </div>
 )}

 <div className="border-b border-border pb-4 mb-6">
 <h3 className="text-base font-semibold text-fg tracking-tight">Record POD & Settle Trip</h3>
 <p className="text-xs text-fg-secondary mt-1">Select an active LR or pick a pending POD entry from the inbox to autofill.</p>
 </div>

 {activeTrips.length === 0 && !isLoading ? (
 <div className="p-8 text-center bg-success/10 border border-success/20 rounded-xl">
 <p className="text-sm font-bold text-success">All PODs are settled! No active trips pending closure.</p>
 </div>
 ) : (
 <form onSubmit={handleSettlePod} className="space-y-5">
 <div>
 <label className="block text-[10px] font-bold text-fg-secondary mb-1">Search & Select Active LR *</label>
 <SearchableSelect options={lrOptions} value={selectedLr} onChange={setSelectedLr} placeholder="-- SELECT LR TO CLOSE --" disabled={isLoading} />
 </div>

 {currentTrip && (
 <>
 <div className="p-4 input-glass border border-border rounded-xl flex flex-wrap gap-4 justify-between text-xs text-fg-secondary">
 <span><strong className="text-fg-muted">DRIVER:</strong> <br/><span className="font-bold text-fg">{currentTrip.drivers?.full_name || "Unassigned"}</span></span>
 <span><strong className="text-fg-muted">ROUTE:</strong> <br/><span className="font-bold text-fg">{currentTrip.origin} &rarr; {currentTrip.destination}</span></span>
 <span><strong className="text-fg-muted">DISPATCHED:</strong> <br/><span className="font-semibold text-accent">{currentTrip.loaded_weight_mt} MT</span></span>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="block text-[10px] font-bold text-fg-secondary mb-1">POD No *</label>
 <Input type="text" value={podNo} onChange={(e) => setPodNo(e.target.value)} placeholder="e.g. POD-8821" className="font-bold" required />
 </div>
 <div>
 <label className="block text-[10px] font-bold text-fg-secondary mb-1">Closing Date *</label>
 <Input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} className="font-semibold" required />
 </div>
 <div>
 <label className="block text-[10px] font-bold text-fg-secondary mb-1">Unloaded MT</label>
 <Input type="number" {...numProps} value={unloadedMt} onChange={(e) => setUnloadedMt(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.00" className={`font-semibold ${noSpinClass}`} />
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="block text-[10px] font-bold text-fg-secondary mb-1">Closing KM *</label>
 <Input type="number" {...numProps} value={closingKm} onChange={(e) => setClosingKm(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder={`Start: ${currentTrip.start_km || 0}`} className={`text-info font-bold ${noSpinClass}`} required />
 </div>
 <div>
 <label className="block text-[10px] font-bold text-fg-secondary mb-1">Halt Bata (₹)</label>
 <Input type="number" {...numProps} value={haltBata} onChange={(e) => setHaltBata(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.00" className={`text-accent font-semibold ${noSpinClass}`} />
 </div>
 <div>
 <label className="block text-[10px] font-bold text-fg-secondary mb-1">Claims / Repairs (₹)</label>
 <Input type="number" {...numProps} value={claims} onChange={(e) => setClaims(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.00" className={`text-danger font-semibold ${noSpinClass}`} />
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-5 items-center">
 <div>
 <label className="block text-[10px] font-bold text-fg-secondary mb-1">Closing Diesel Top-up (L)</label>
 <Input type="number" {...numProps} value={closingDiesel} onChange={(e) => setClosingDiesel(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.0 Litres" className={`text-accent font-semibold ${noSpinClass}`} />
 <span className="text-[10px] text-fg-muted font-bold mt-1 block">Valued at current rate: ₹{dieselRate}/L</span>
 </div>
 <div className="pt-2">
 <label className="flex items-center gap-3 cursor-pointer select-none input-glass p-3 rounded-xl border border-border w-fit">
 <input type="checkbox" checked={isTankFull} onChange={(e) => setIsTankFull(e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent input-glass border-border" />
 <span className="text-xs font-semibold text-fg">Mark Tank Full</span>
 </label>
 </div>
 </div>

 {complianceWarnings.length > 0 && (
 <div className="bg-danger/10 border border-danger/20 p-4 rounded-xl mt-4 mb-2">
 <h4 className="text-[10px] font-semibold text-danger mb-2 flex items-center gap-2">⚠️ Compliance Warnings (Closing Allowed)</h4>
 {complianceWarnings.map((w, i) => (
 <p key={i} className={`text-xs font-bold ${w.isUrgent ? 'text-danger' : 'text-warning'}`}>• {w.name} {w.docName} expiring on {w.date}</p>
 ))}
 </div>
 )}

 <div className="pt-6 border-t border-border flex justify-end">
 <Button
 type="submit"
 disabled={isSubmitting}
 variant="secondary"
 className="w-full md:w-auto px-8 py-3.5 rounded-xl text-sm bg-success hover:bg-success/90 text-fg border-success/40 shadow-none"
>
 {isSubmitting ? "Settling..." : "✅ Settle & Close POD"}
</Button>
 </div>
 </>
 )}
 </form>
 )}
 </div>

 {/* RIGHT PANEL: Pending POD List */}
 <div className="lg:col-span-5 liquid-glass overflow-hidden flex flex-col shadow-sm h-fit">
 <div className="px-5 py-4 flex justify-between items-center border-b border-border">
 <h4 className="text-xs font-semibold text-fg tracking-wider">Pending POD List ({activeTrips.length})</h4>
 <span className="text-[9px] font-bold px-2.5 py-1 bg-danger/10 text-danger border border-danger/20 rounded-lg tracking-normal">Awaiting</span>
 </div>
 <div className="overflow-x-auto overflow-y-auto max-h-[600px] w-full">
 <table className="w-full text-left border-collapse whitespace-nowrap">
 <thead className="input-glass bg-surface-raised sticky top-0 z-10">
 <tr>
 <th className="py-3 px-5 text-[10px] font-bold text-fg-muted tracking-wider border-b border-border">LR No</th>
 <th className="py-3 px-5 text-[10px] font-bold text-fg-muted tracking-wider border-b border-border">Date</th>
 <th className="py-3 px-5 text-[10px] font-bold text-fg-muted tracking-wider border-b border-border">Truck</th>
 <th className="py-3 px-5 text-[10px] font-bold text-fg-muted tracking-wider border-b border-border text-right">Aging</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border-subtle input-glass">
 {activeTrips.map((t) => {
 const days = getDaysPending(t.trip_start_date);
 const isSelected = selectedLr === t.trip_number;
 return (
 <tr key={t.trip_id} onClick={() => setSelectedLr(t.trip_number)} className={`cursor-pointer transition-all ${isSelected ? 'bg-accent/10 border-l-2 border-l-accent' : 'border-l-2 border-l-transparent hover:bg-surface-raised/50'}`}>
 <td className={`py-3.5 px-5 text-xs font-semibold ${isSelected ? 'text-accent' : 'text-fg'}`}>{t.trip_number}</td>
 <td className="py-3.5 px-5 text-xs font-semibold text-fg-secondary">{formatDate(t.trip_start_date)}</td>
 <td className="py-3.5 px-5 text-xs font-bold text-fg-secondary">{t.vehicles?.vehicle_number || "-"}</td>
 <td className={`py-3.5 px-5 text-xs font-semibold text-right ${days >= 2 ? 'text-danger' : 'text-warning'}`}>{days}d</td>
 </tr>
 );
 })}
 {activeTrips.length === 0 && (<tr><td colSpan={4} className="py-8 text-center text-fg-muted text-xs font-medium">No pending PODs found.</td></tr>)}
 </tbody>
 </table>
 </div>
 </div>

 </div>
 );
}
