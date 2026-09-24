"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const supabase = createClient();
export function PodClosure({ onSuccess }: { onSuccess?: () => void }) {
 const [isLoading, setIsLoading] = useState(true);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [dieselRate, setDieselRate] = useState<number>(95.0);

 const [alertConfig, setAlertConfig] = useState({
 isOpen: false, title: "", message: "", type: "info" as "success" | "error" | "info"
 });

 const [activeTrips, setActiveTrips] = useState<any[]>([]);
 const [selectedLr, setSelectedLr] = useState<string>("");
 const [podSearch, setPodSearch] = useState("");
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
 trip_status, pod_status, pod_number, pod_received_date,
 vehicles ( vehicle_number, truck_type, fc_expiry_date, insurance_expiry_date, qtax_expiry_date, puc_expiry_date, np_expiry_date, state_permit_expiry_date, tank_cert_expiry_date ),
 drivers ( full_name, phone_number, driver_code, license_expiry_date )
 `).eq("pod_status", "PENDING_SUBMISSION").order("trip_start_date", { ascending: true }),
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
 message: `Could not auto-match the LR number from this entry (Detected: ${data.lrNo || "None"}). Please manually select the pending POD/LR from the dropdown below.`,
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
 const finalUnloadedMt = unloadedMt === "" ? null : Number(unloadedMt);
 const scannedShortageMt = scannedShortageKg !== null ? scannedShortageKg / 1000 : null;
 const shortageMt = finalUnloadedMt !== null
   ? Math.max(0, loadedMt - finalUnloadedMt)
   : Math.max(0, scannedShortageMt ?? 0);

 const endKm = Number(closingKm) || 0;

 const addDiesel = Number(closingDiesel) || 0;
 const addedDieselCost = Math.round(addDiesel * dieselRate * 100) / 100;

 if (addDiesel > 0 && endKm <= 0) {
   setIsSubmitting(false);
   return setAlertConfig({
     isOpen: true,
     title: "Odometer Required",
     message: "Please enter the filling odometer KM when recording a diesel top-up.",
     type: "error"
   });
 }

 const { data: closedTrips, error: tripUpdateError } = await supabase.from("trips").update({
 pod_number: podNo.trim().toUpperCase(),
 pod_received_date: closingDate,
 pod_status: "VERIFIED_ACCEPTED",
 shortage_mt: shortageMt,
 halt_bata: Number(haltBata) || 0,
 enroute_repairs_maintenance: Number(claims) || 0,
 fuel_litres: (Number(currentTrip.fuel_litres) || 0) + addDiesel
 }).eq("trip_id", currentTrip.trip_id).eq("pod_status", "PENDING_SUBMISSION")
   .select("trip_id, pod_status, trip_status");

 if (tripUpdateError) {
   setIsSubmitting(false);
   return setAlertConfig({
     isOpen: true,
     title: "POD Update Failed",
     message: "Error updating POD: " + tripUpdateError.message,
     type: "error"
   });
 }

 if (!closedTrips || closedTrips.length !== 1) {
   setIsSubmitting(false);
   return setAlertConfig({
     isOpen: true,
     title: "POD Already Processed",
     message: "This POD was already closed or is no longer pending. Please refresh the pending POD list.",
     type: "error"
   });
 }

 if (addDiesel > 0) {
   const { error: dieselError } = await supabase.from("diesel_fuel_logs").insert([{
     fuel_date: closingDate,
     vehicle_id: currentTrip.vehicle_id,
     trip_id: currentTrip.trip_id,
     lr_number: currentTrip.trip_number,
     diesel_category: "TRIP_DIESEL",
     litres_filled: addDiesel,
     diesel_rate_per_litre: dieselRate,
     total_fuel_cost: addedDieselCost,
     filling_odometer_km: endKm,
     is_tank_full: isTankFull
   }]);

   if (dieselError) {
     console.error("Diesel log insertion failed after trip closure:", dieselError);
   }
 }

 if (activeScanId) {
 await supabase.from("pending_scans").update({ status: 'PROCESSED' }).eq("scan_id", activeScanId);
 setPendingScans(prev => prev.filter(s => s.scan_id !== activeScanId)); 
 setActiveScanId(null);
 }

 setAlertConfig({ isOpen: true, title: "POD Settled!", message: `POD for ${currentTrip.trip_number} successfully recorded and settled.`, type: "success" });
 setIsSubmitting(false); setSelectedLr(""); setPodNo(""); setCurrentTrip(null); setScannedShortageKg(null); fetchActiveTrips(); if (onSuccess) onSuccess();
 };

 const filteredPodTrips = activeTrips.filter((t: any) => {
 const q = podSearch.trim().toUpperCase();
 if (!q) return true;

 return [
   t.trip_number,
   t.vehicles?.vehicle_number,
   t.destination,
   t.origin,
   t.drivers?.full_name,
 ].some((value) =>
   String(value ?? "").toUpperCase().includes(q)
 );
 });


 const noSpinClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
 const numProps = { step: "any", onWheel: (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur() };

 return (
 <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start kss-page-enter relative">
   <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} />

   {/* LEFT PANEL: POD settlement workspace */}
   <div className="xl:col-span-7 liquid-glass p-5 md:p-6">

     <div className="flex items-start justify-between gap-4 pb-5 mb-5 border-b border-border">
       <div>
         <div className="flex items-center gap-2 mb-1.5">
           <span className="kss-status-dot bg-accent" />
           <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Operations</span>
         </div>
         <h3 className="text-lg font-semibold tracking-tight text-fg">POD Closure</h3>
         <p className="text-xs text-fg-secondary mt-1">Verify delivery, reconcile the trip and close the POD.</p>
       </div>

       {activeTrips.length > 0 && (
         <div className="shrink-0 px-3 py-2 rounded-xl border border-border bg-surface-raised/60 text-right">
           <p className="text-[9px] font-semibold uppercase tracking-wider text-fg-muted">Pending</p>
           <p className="text-lg font-semibold leading-none text-fg mt-1">{activeTrips.length}</p>
         </div>
       )}
     </div>

     {pendingScans.length > 0 && (
       <div className="mb-5 liquid-glass-soft p-4">
         <div className="flex items-center justify-between gap-3 mb-3">
           <div className="flex items-center gap-2">
             <span className="relative flex h-2 w-2">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
               <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
             </span>
             <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-success">POD Inbox</h4>
           </div>
           <span className="text-[10px] font-medium text-fg-muted">{pendingScans.length} pending scan{pendingScans.length === 1 ? "" : "s"}</span>
         </div>

         <div className="flex gap-3 overflow-x-auto pb-1 snap-x">
           {pendingScans.map(scan => {
             const data = scan.raw_json_result || {};
             return (
               <div
                 key={scan.scan_id}
                 role="button"
                 tabIndex={0}
                 onClick={() => applyScanData(scan)}
                 onKeyDown={(e) => {
                   if (e.key === "Enter" || e.key === " ") {
                     e.preventDefault();
                     applyScanData(scan);
                   }
                 }}
                 className={`min-w-[210px] text-left p-3.5 rounded-xl border transition-all duration-200 snap-start kss-interactive ${
                   activeScanId === scan.scan_id
                     ? "border-success/50 bg-success/10 kss-glow-accent"
                     : "border-border bg-surface-raised/50 hover:border-border-strong"
                 }`}
               >
                 <div className="flex justify-between items-start gap-4">
                   <div className="min-w-0">
                     <p className="text-[9px] uppercase tracking-wider text-fg-muted font-semibold mb-1">LR</p>
                     <p className="text-sm font-semibold text-fg truncate">{data.lrNo || "UNKNOWN"}</p>
                     <p className="text-[11px] font-medium text-fg-secondary mt-2">
                       Shortage{" "}
                       <span className={data.shortageKg > 0 ? "text-danger" : "text-success"}>
                         {data.shortageKg || 0} kg
                       </span>
                     </p>
                   </div>
                   <button
                     type="button"
                     onClick={(e) => handleDeleteScan(e, scan.scan_id)}
                     className="shrink-0 p-1.5 rounded-lg border border-border bg-surface/40 text-fg-muted hover:text-danger hover:border-danger/30 transition-colors"
                     title="Delete entry"
                   >
                     ×
                   </button>
                 </div>
               </div>
             );
           })}
         </div>
       </div>
     )}

     {activeTrips.length === 0 && !isLoading ? (
       <div className="kss-surface p-8 text-center">
         <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
           <span className="text-success text-lg">✓</span>
         </div>
         <p className="text-sm font-semibold text-fg">POD queue is clear</p>
         <p className="text-xs text-fg-secondary mt-1">There are no pending PODs awaiting settlement.</p>
       </div>
     ) : (
       <form onSubmit={handleSettlePod} className="space-y-5">

         {currentTrip && (
           <>
             {/* Trip snapshot */}
             <div className="kss-surface-raised p-4 md:p-5">
               <div className="flex items-center justify-between gap-4 mb-4">
                 <div>
                   <p className="text-[9px] uppercase tracking-[0.16em] text-fg-muted font-semibold">Trip snapshot</p>
                   <p className="text-base font-semibold text-fg mt-1">LR {currentTrip.trip_number}</p>
                 </div>
                 <span className="px-2.5 py-1 rounded-lg border border-accent-border bg-accent-soft text-[9px] font-semibold uppercase tracking-wider text-accent">
                   Awaiting POD
                 </span>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="min-w-0">
                   <p className="text-[9px] uppercase tracking-wider text-fg-muted font-semibold">Truck</p>
                   <p className={`text-xs font-semibold mt-1 truncate ${currentTrip.vehicles?.vehicle_number ? "text-fg" : "text-warning"}`}>
                     {currentTrip.vehicles?.vehicle_number || "UNASSIGNED"}
                   </p>
                 </div>
                 <div className="min-w-0">
                   <p className="text-[9px] uppercase tracking-wider text-fg-muted font-semibold">Driver</p>
                   <p className="text-xs font-semibold text-fg mt-1 truncate">{currentTrip.drivers?.full_name || "Unassigned"}</p>
                 </div>
                 <div className="min-w-0 md:col-span-2">
                   <p className="text-[9px] uppercase tracking-wider text-fg-muted font-semibold">Route</p>
                   <p className="text-xs font-semibold text-fg mt-1 truncate">{currentTrip.origin} <span className="text-fg-muted mx-1">→</span> {currentTrip.destination}</p>
                 </div>
               </div>

               <div className="mt-4 pt-4 border-t border-border-subtle flex items-center justify-between">
                 <span className="text-[9px] uppercase tracking-wider text-fg-muted font-semibold">Dispatched weight</span>
                 <span className="text-sm font-semibold text-accent">{currentTrip.loaded_weight_mt} MT</span>
               </div>
             </div>

             {/* POD details */}
             <section>
               <div className="flex items-center gap-3 mb-3">
                 <span className="text-[9px] font-semibold text-accent">01</span>
                 <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-secondary">POD details</h4>
                 <div className="h-px flex-1 bg-border" />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                 <div>
                   <label className="block text-[9px] uppercase tracking-wider font-semibold text-fg-muted mb-1.5">POD number *</label>
                   <Input type="text" value={podNo} onChange={(e) => setPodNo(e.target.value)} placeholder="e.g. POD-8821" className="font-semibold" required />
                 </div>
                 <div>
                   <label className="block text-[9px] uppercase tracking-wider font-semibold text-fg-muted mb-1.5">Closing date *</label>
                   <Input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} className="font-semibold" required />
                 </div>
                 <div>
                   <label className="block text-[9px] uppercase tracking-wider font-semibold text-fg-muted mb-1.5">Unloaded weight</label>
                   <Input type="number" {...numProps} value={unloadedMt} onChange={(e) => setUnloadedMt(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="Optional" className={`font-semibold ${noSpinClass}`} />
                 </div>
               </div>
             </section>

             {/* Odometer & fuel */}
             <section>
               <div className="flex items-center gap-3 mb-3">
                 <span className="text-[9px] font-semibold text-accent">02</span>
                 <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-secondary">Odometer & fuel</h4>
                 <div className="h-px flex-1 bg-border" />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                 <div>
                   <label className="block text-[9px] uppercase tracking-wider font-semibold text-fg-muted mb-1.5">Filling odometer KM</label>
                   <Input type="number" {...numProps} value={closingKm} onChange={(e) => setClosingKm(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="Only for diesel top-up" className={`text-info font-semibold ${noSpinClass}`} />
                 </div>
                 <div>
                   <label className="block text-[9px] uppercase tracking-wider font-semibold text-fg-muted mb-1.5">Diesel top-up (L)</label>
                   <Input type="number" {...numProps} value={closingDiesel} onChange={(e) => setClosingDiesel(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.0 Litres" className={`text-accent font-semibold ${noSpinClass}`} />
                   <span className="text-[9px] text-fg-muted font-medium mt-1.5 block">Current rate ₹{dieselRate}/L</span>
                 </div>
                 <div className="flex items-end">
                   <label className="flex items-center gap-3 cursor-pointer select-none input-glass rounded-xl px-3.5 py-2.5">
                     <input type="checkbox" checked={isTankFull} onChange={(e) => setIsTankFull(e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent bg-transparent border-border" />
                     <span className="text-xs font-semibold text-fg">Tank full</span>
                   </label>
                 </div>
               </div>
             </section>

             {/* Expenses */}
             <section>
               <div className="flex items-center gap-3 mb-3">
                 <span className="text-[9px] font-semibold text-accent">03</span>
                 <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-secondary">Trip expenses</h4>
                 <div className="h-px flex-1 bg-border" />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 <div>
                   <label className="block text-[9px] uppercase tracking-wider font-semibold text-fg-muted mb-1.5">Halt bata (₹)</label>
                   <Input type="number" {...numProps} value={haltBata} onChange={(e) => setHaltBata(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.00" className={`text-accent font-semibold ${noSpinClass}`} />
                 </div>
                 <div>
                   <label className="block text-[9px] uppercase tracking-wider font-semibold text-fg-muted mb-1.5">Claims / repairs (₹)</label>
                   <Input type="number" {...numProps} value={claims} onChange={(e) => setClaims(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.00" className={`text-danger font-semibold ${noSpinClass}`} />
                 </div>
               </div>
             </section>

             {complianceWarnings.length > 0 && (
               <div className="rounded-xl border border-danger/20 bg-danger/10 p-4">
                 <div className="flex items-start gap-3">
                   <span className="mt-0.5 text-danger text-sm">!</span>
                   <div className="min-w-0">
                     <h4 className="text-[9px] font-semibold uppercase tracking-[0.14em] text-danger">Compliance attention · closing allowed</h4>
                     <div className="mt-2 space-y-1">
                       {complianceWarnings.map((w, i) => (
                         <p key={i} className={`text-xs font-medium ${w.isUrgent ? "text-danger" : "text-warning"}`}>
                           {w.name} · {w.docName} · expires {w.date}
                         </p>
                       ))}
                     </div>
                   </div>
                 </div>
               </div>
             )}

             <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
               <p className="text-[10px] text-fg-muted">Review all values before closing this POD.</p>
               <Button
                 type="submit"
                 disabled={isSubmitting}
                 variant="secondary"
                 className="w-full sm:w-auto px-7 py-3 rounded-xl text-sm font-semibold bg-accent hover:bg-accent-hover text-accent-fg border-accent-border shadow-orange"
               >
                 {isSubmitting ? "Saving..." : "Settle POD"}
               </Button>
             </div>
           </>
         )}
       </form>
     )}
   </div>

   {/* RIGHT PANEL: Pending POD queue */}
   <div className="xl:col-span-5 liquid-glass overflow-hidden flex flex-col">
     <div className="px-5 py-5 border-b border-border">
       <div className="flex items-start justify-between gap-4 mb-4">
         <div>
           <div className="flex items-center gap-2 mb-1">
             <span className="kss-status-dot bg-warning" />
             <h4 className="text-sm font-semibold text-fg tracking-tight">Pending POD queue</h4>
           </div>
           <p className="text-[10px] text-fg-muted">Select a trip to load its settlement workspace.</p>
         </div>
         <span className="shrink-0 px-2.5 py-1 rounded-lg border border-warning/20 bg-warning/10 text-warning text-[9px] font-semibold uppercase tracking-wider">
           {filteredPodTrips.length} awaiting
         </span>
       </div>

       <Input
         type="text"
         value={podSearch}
         onChange={(e) => setPodSearch(e.target.value)}
         placeholder="Search LR, truck, destination or driver..."
         className="w-full !bg-[#11161e] !border-border !shadow-lg focus:!bg-[#11161e]"
       />
     </div>

     <div className="overflow-x-auto overflow-y-auto max-h-[680px] w-full">
       <table className="w-full text-left border-collapse">
         <thead className="bg-[#11161e] sticky top-0 z-20 border-b border-border shadow-lg">
           <tr>
             <th className="py-3 px-5 text-[9px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border">LR</th>
             <th className="py-3 px-5 text-[9px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border">Date</th>
             <th className="py-3 px-5 text-[9px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border">Truck</th>
             <th className="py-3 px-5 text-[9px] font-semibold uppercase tracking-wider text-fg-muted border-b border-border text-right">Age</th>
           </tr>
         </thead>

         <tbody className="divide-y divide-border-subtle">
           {filteredPodTrips.map((t) => {
             const days = getDaysPending(t.trip_start_date);
             const isSelected = selectedLr === t.trip_number;
             const hasTruck = Boolean(t.vehicles?.vehicle_number);

             return (
               <tr
                 key={t.trip_id}
                 onClick={() => setSelectedLr(t.trip_number)}
                 className={`cursor-pointer transition-all duration-150 border-l-2 ${
                   isSelected
                     ? "bg-accent/10 border-l-accent"
                     : "border-l-transparent hover:bg-surface-raised/60 hover:border-l-border-strong"
                 }`}
               >
                 <td className="py-3.5 px-5">
                   <span className={`text-xs font-semibold ${isSelected ? "text-accent" : "text-fg"}`}>{t.trip_number}</span>
                 </td>
                 <td className="py-3.5 px-5 text-xs font-medium text-fg-secondary">{formatDate(t.trip_start_date)}</td>
                 <td className="py-3.5 px-5">
                   {hasTruck ? (
                     <span className="text-xs font-semibold text-fg">{t.vehicles.vehicle_number}</span>
                   ) : (
                     <span className="inline-flex items-center px-2 py-1 rounded-md border border-warning/20 bg-warning/10 text-[9px] font-semibold uppercase tracking-wider text-warning">
                       Unassigned
                     </span>
                   )}
                 </td>
                 <td className={`py-3.5 px-5 text-xs font-semibold text-right ${days >= 2 ? "text-danger" : "text-warning"}`}>
                   {days}d
                 </td>
               </tr>
             );
           })}

           {filteredPodTrips.length === 0 && (
             <tr>
               <td colSpan={4} className="py-12 px-5 text-center">
                 <p className="text-sm font-semibold text-fg">{podSearch.trim() ? "No matches" : "No pending PODs"}</p>
                 <p className="text-xs text-fg-muted mt-1">
                   {podSearch.trim() ? `Nothing matches "${podSearch.trim()}".` : "The settlement queue is currently clear."}
                 </p>
               </td>
             </tr>
           )}
         </tbody>
       </table>
     </div>
   </div>
 </div>
 );
}
