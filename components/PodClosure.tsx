"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const supabase = createClient();
type PodClosureProps = {
  onSuccess?: () => void;
  initialOpen?: boolean;
};

export function PodClosure({
  onSuccess,
  initialOpen = false,
}: PodClosureProps) {
 const [isLoading, setIsLoading] = useState(true);
 const [isSubmitting, setIsSubmitting] = useState(false);

 const [alertConfig, setAlertConfig] = useState({
 isOpen: false, title: "", message: "", type: "info" as "success" | "error" | "info"
 });

 const [activeTrips, setActiveTrips] = useState<any[]>([]);
 const [selectedLr, setSelectedLr] = useState<string>("");
 const [podSearch, setPodSearch] = useState("");
 const [currentTrip, setCurrentTrip] = useState<any>(null);
 const [lrSearch, setLrSearch] = useState("");
 const [isSearchingLr, setIsSearchingLr] = useState(false);
 const [showPodWorkspace, setShowPodWorkspace] = useState(initialOpen);
 const [showPendingPodList, setShowPendingPodList] = useState(false);

 // INBOX STATES
 const [pendingScans, setPendingScans] = useState<any[]>([]); 
 const [activeScanId, setActiveScanId] = useState<string | null>(null);
 const [scannedShortageKg, setScannedShortageKg] = useState<number | null>(null);

 const [podNo, setPodNo] = useState("");
 const [closingDate, setClosingDate] = useState(new Date().toISOString().split("T")[0]);
 const [unloadedMt, setUnloadedMt] = useState<number | "">("");
 
 const [complianceWarnings, setComplianceWarnings] = useState<any[]>([]);

 const formatDate = (dateStr: string) => {
 if (!dateStr) return 'N/A';
 if (!dateStr.includes('-')) return dateStr;
 const parts = dateStr.split('T')[0].split('-');
 if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
 return dateStr;
 };

 const loadPendingPod = (trip: any) => {
   setSelectedLr(trip.trip_number);
   setCurrentTrip(trip);
   setLrSearch(trip.trip_number || "");
   setPodNo(trip.pod_number || "");
   setClosingDate(
     trip.pod_received_date
       ? String(trip.pod_received_date).split("T")[0]
       : new Date().toISOString().split("T")[0]
   );
   setUnloadedMt(trip.loaded_weight_mt || "");
   setScannedShortageKg(null);
   setActiveScanId(null);
   setShowPendingPodList(false);
 };

 const handleSearchByLr = async () => {
 const searchLr = lrSearch.trim().toUpperCase();

 if (!searchLr) {
   setAlertConfig({
     isOpen: true,
     title: "LR Number Required",
     message: "Please enter an LR number to search.",
     type: "error"
   });
   return;
 }

 setIsSearchingLr(true);
 setCurrentTrip(null);
 setSelectedLr("");

 try {
   const { data, error } = await supabase
     .from("trips")
     .select(`
       trip_id, trip_number, trip_start_date, origin, destination, loaded_weight_mt, start_km, fuel_litres, vehicle_id, primary_driver_id,
       trip_status, pod_status, pod_number, pod_received_date,
       vehicles ( vehicle_number, truck_type, fc_expiry_date, insurance_expiry_date, qtax_expiry_date, puc_expiry_date, np_expiry_date, state_permit_expiry_date, tank_cert_expiry_date ),
       drivers ( full_name, phone_number, driver_code, license_expiry_date )
     `)
     .eq("trip_number", searchLr)
     .eq("pod_status", "PENDING_SUBMISSION")
     .eq("trip_status", "COMPLETED")
     .maybeSingle();

   if (error) throw error;

   if (!data) {
     setAlertConfig({
       isOpen: true,
       title: "LR Number Not Found",
       message: "LR Number not found.",
       type: "error"
     });
     return;
   }

   setSelectedLr(data.trip_number);
   setCurrentTrip(data);
   setPodNo(data.pod_number || "");
   setClosingDate(
     data.pod_received_date
       ? String(data.pod_received_date).split("T")[0]
       : new Date().toISOString().split("T")[0]
   );
   setUnloadedMt(data.loaded_weight_mt || "");
   setScannedShortageKg(null);
   setActiveScanId(null);
 } catch (error: any) {
   console.error("LR lookup error:", error);
   setAlertConfig({
     isOpen: true,
     title: "LR Search Failed",
     message: error?.message || "Unable to search for the LR number.",
     type: "error"
   });
 } finally {
   setIsSearchingLr(false);
 }
 };

 const fetchActiveTrips = async () => {
 setIsLoading(true);
 const [tripsRes, scansRes] = await Promise.all([
 supabase.from("trips").select(`
 trip_id, trip_number, trip_start_date, origin, destination, loaded_weight_mt, start_km, vehicle_id, primary_driver_id,
 trip_status, pod_status, pod_number, pod_received_date,
 vehicles ( vehicle_number, truck_type, fc_expiry_date, insurance_expiry_date, qtax_expiry_date, puc_expiry_date, np_expiry_date, state_permit_expiry_date, tank_cert_expiry_date ),
 drivers ( full_name, phone_number, driver_code, license_expiry_date )
 `).eq("pod_status", "PENDING_SUBMISSION").eq("trip_status", "COMPLETED").order("trip_start_date", { ascending: true }),
 supabase.from("pending_scans").select("*").eq("document_type", "POD_CLOSURE").eq("status", "PENDING").order("created_at", { ascending: false })
 ]);

 if (tripsRes.data) setActiveTrips(tripsRes.data);
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

   if (!currentTrip || !podNo.trim()) {
     return setAlertConfig({
       isOpen: true,
       title: "Missing Information",
       message: "Please enter a valid POD Number to proceed.",
       type: "error"
     });
   }

   if (!closingDate) {
     return setAlertConfig({
       isOpen: true,
       title: "Missing Information",
       message: "Please enter the POD received date.",
       type: "error"
     });
   }

   if (unloadedMt === "" || Number(unloadedMt) < 0) {
     return setAlertConfig({
       isOpen: true,
       title: "Invalid Unloaded Weight",
       message: "Please enter a valid unloaded weight.",
       type: "error"
     });
   }

   setIsSubmitting(true);

   const { error } = await supabase.rpc("close_pod_atomic", {
     p_trip_id: Number(currentTrip.trip_id),
     p_pod_number: podNo.trim().toUpperCase(),
     p_closing_date: closingDate,
     p_unloaded_weight_mt: Number(unloadedMt),
     p_shortage_mt: null,
     p_halt_bata: 0,
     p_claims: 0,
     p_add_diesel: 0,
     p_diesel_rate_per_litre: 0,
     p_filling_odometer_km: null,
     p_is_tank_full: false,
     p_scan_id: activeScanId || null
   });

   if (error) {
     setIsSubmitting(false);

     const message = error.message || "Unable to close POD.";
     let title = "POD Closure Failed";

     if (message.includes("POD_ALREADY_PROCESSED")) title = "POD Already Processed";
     else if (message.includes("POD_NUMBER_REQUIRED")) title = "POD Number Required";
     else if (message.includes("TRIP_NOT_COMPLETED")) title = "Trip Not Completed";
     else if (message.includes("POD_NOT_PENDING")) title = "POD Already Processed";
     else if (message.includes("POD_DATE_IN_FUTURE")) title = "Invalid POD Date";
     else if (message.includes("POD_NUMBER_ALREADY_EXISTS")) title = "Duplicate POD Number";
     else if (message.includes("UNLOADED_WEIGHT_EXCEEDS_LOADED_WEIGHT")) title = "Invalid Unloaded Weight";

     return setAlertConfig({
       isOpen: true,
       title,
       message: message.replace(/^.*?:\s*/, ""),
       type: "error"
     });
   }

   if (activeScanId) {
     setPendingScans(prev => prev.filter(s => s.scan_id !== activeScanId));
     setActiveScanId(null);
   }

   setAlertConfig({
     isOpen: true,
     title: "POD Closed",
     message: `POD for ${currentTrip.trip_number} successfully recorded.`,
     type: "success"
   });

   setIsSubmitting(false);
   setSelectedLr("");
   setPodNo("");
   setUnloadedMt("");
   setClosingDate(new Date().toISOString().split("T")[0]);
   setScannedShortageKg(null);
   fetchActiveTrips();

   if (onSuccess) onSuccess();
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
   <>
     {!showPodWorkspace ? (
       <div className="liquid-glass w-full rounded-2xl p-5 sm:p-6">
         <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
           <div>
             <p className="kss-eyebrow text-accent">Operations · POD</p>
             <h2 className="mt-1 text-xl font-semibold text-fg">POD Closure</h2>
             <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-secondary">
               Search completed trips awaiting POD, review scanned POD information, and settle
               delivery closure details.
             </p>
           </div>

           <Button
             type="button"
             size="lg"
             className="min-h-11 shrink-0 sm:min-w-48"
             onClick={() => setShowPodWorkspace(true)}
           >
             Open POD Closure
           </Button>
         </div>
       </div>
     ) : (
 <div className="w-full kss-page-enter">
   <AlertModal
     isOpen={alertConfig.isOpen}
     title={alertConfig.title}
     message={alertConfig.message}
     type={alertConfig.type}
     onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
   />

   <Dialog open={showPodWorkspace} onOpenChange={setShowPodWorkspace}>
     <DialogContent
       layout="modal"
       size="full"
       className="flex h-[96dvh] max-h-[96dvh] flex-col overflow-hidden p-0"
     >
       <DialogHeader>
         <DialogTitle className="text-xl">POD Closure</DialogTitle>
         <p className="mt-1 text-xs text-fg-secondary">
           Search by LR number, verify delivery details and settle the POD.
         </p>
       </DialogHeader>

       <DialogBody className="min-h-0 flex-1 overflow-y-auto">
            <div className="w-full liquid-glass p-5 md:p-6 min-w-0">

     <div className="mb-5">
       <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
         <Input
           type="text"
           value={lrSearch}
           onChange={(e) => setLrSearch(e.target.value.toUpperCase())}
           onKeyDown={(e) => {
             if (e.key === "Enter") {
               e.preventDefault();
               void handleSearchByLr();
             }
           }}
           placeholder="Enter LR number..."
           className="h-11 text-sm font-semibold uppercase"
           autoComplete="off"
         />

         <Button
           type="button"
           variant="secondary"
           className="h-11 min-w-32 rounded-xl bg-accent text-accent-fg hover:bg-accent-hover"
           onClick={() => void handleSearchByLr()}
           disabled={isSearchingLr}
         >
           {isSearchingLr ? "Searching..." : "Search LR"}
         </Button>

         <Button
           type="button"
           variant="outline"
           className="h-11 min-w-36 rounded-xl border-accent-border bg-accent-soft text-accent hover:bg-accent/15"
           onClick={() => {
             setPodSearch("");
             setShowPendingPodList(true);
           }}
         >
           Pending PODs
           <span className="ml-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-fg">
             {activeTrips.length}
           </span>
         </Button>
       </div>

       {currentTrip && (
         <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
           <span className="rounded-lg border border-success/20 bg-success/10 px-2.5 py-1 font-semibold text-success">
             LR loaded
           </span>
           <span className="text-fg-muted">
             {currentTrip.trip_number} · {currentTrip.origin} → {currentTrip.destination}
           </span>
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

             {/* Delivery verification */}
             <section>
               <div className="flex items-center gap-3 mb-3">
                 <span className="text-[9px] font-semibold text-accent">02</span>
                 <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-secondary">Delivery verification</h4>
                 <div className="h-px flex-1 bg-border" />
               </div>

               <div className="rounded-xl border border-accent-border bg-accent-soft/40 p-4">
                 <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                   <div>
                     <p className="text-[9px] uppercase tracking-wider text-fg-muted font-semibold">Shortage</p>
                     <p className="text-xs text-fg-secondary mt-1">
                       Final shortage is calculated by the server from dispatched and unloaded weight.
                     </p>
                   </div>

                   <div className="text-left sm:text-right">
                     <p className="text-[9px] uppercase tracking-wider text-fg-muted font-semibold">Dispatched</p>
                     <p className="text-sm font-semibold text-fg">{currentTrip.loaded_weight_mt} MT</p>
                   </div>
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
               <p className="text-[10px] text-fg-muted">Review the POD details before recording delivery closure.</p>
               <Button
                 type="submit"
                 disabled={isSubmitting}
                 variant="secondary"
                 className="w-full sm:w-auto px-7 py-3 rounded-xl text-sm font-semibold bg-accent hover:bg-accent-hover text-accent-fg border-accent-border shadow-orange"
               >
                 {isSubmitting ? "Saving..." : "Close POD"}
               </Button>
             </div>
           </>
         )}
       </form>
   </div>


       </DialogBody>
     </DialogContent>
   </Dialog>

   <Dialog open={showPendingPodList} onOpenChange={setShowPendingPodList}>
     <DialogContent
       layout="modal"
       size="xl"
       className="flex max-h-[88dvh] flex-col overflow-hidden p-0"
     >
       <DialogHeader>
         <DialogTitle className="text-lg">Pending PODs</DialogTitle>
         <p className="mt-1 text-xs text-fg-secondary">
           Select any pending trip to load its complete POD closure form.
         </p>
       </DialogHeader>

       <DialogBody className="min-h-0 flex-1 overflow-y-auto">
         <div className="space-y-4">
           <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
             <Input
               type="text"
               value={podSearch}
               onChange={(e) => setPodSearch(e.target.value)}
               placeholder="Search LR, truck, destination or driver..."
               className="h-11 text-sm"
               autoComplete="off"
             />
             <div className="flex h-11 items-center justify-center rounded-xl border border-border bg-surface-raised/60 px-4 text-xs font-semibold text-fg-secondary">
               {filteredPodTrips.length} pending
             </div>
           </div>

           {filteredPodTrips.length === 0 ? (
             <div className="rounded-2xl border border-border bg-surface-raised/40 p-8 text-center">
               <p className="text-sm font-semibold text-fg">No pending PODs found</p>
               <p className="mt-1 text-xs text-fg-muted">
                 Try another LR, truck, destination or driver search.
               </p>
             </div>
           ) : (
             <div className="grid gap-3 md:grid-cols-2">
               {filteredPodTrips.map((trip: any) => (
                 <button
                   key={trip.trip_id}
                   type="button"
                   onClick={() => loadPendingPod(trip)}
                   className="group rounded-2xl border border-border bg-surface-raised/45 p-4 text-left transition-all hover:border-accent-border hover:bg-accent-soft"
                 >
                   <div className="flex items-start justify-between gap-4">
                     <div className="min-w-0">
                       <div className="flex items-center gap-2">
                         <span className="kss-status-dot bg-accent" />
                         <span className="text-base font-semibold text-fg">
                           LR {trip.trip_number}
                         </span>
                       </div>

                       <p className="mt-2 truncate text-xs font-medium text-fg-secondary">
                         {trip.origin} → {trip.destination}
                       </p>
                     </div>

                     <span className="shrink-0 rounded-lg border border-accent-border bg-accent-soft px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-accent">
                       Select
                     </span>
                   </div>

                   <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border-subtle pt-3">
                     <div className="min-w-0">
                       <p className="text-[9px] font-semibold uppercase tracking-wider text-fg-muted">
                         Truck
                       </p>
                       <p className="mt-1 truncate text-xs font-semibold text-fg">
                         {trip.vehicles?.vehicle_number || "UNASSIGNED"}
                       </p>
                     </div>

                     <div className="min-w-0">
                       <p className="text-[9px] font-semibold uppercase tracking-wider text-fg-muted">
                         Driver
                       </p>
                       <p className="mt-1 truncate text-xs font-semibold text-fg">
                         {trip.drivers?.full_name || "Unassigned"}
                       </p>
                     </div>

                     <div>
                       <p className="text-[9px] font-semibold uppercase tracking-wider text-fg-muted">
                         Loaded
                       </p>
                       <p className="mt-1 text-xs font-semibold text-accent">
                         {trip.loaded_weight_mt || 0} MT
                       </p>
                     </div>

                     <div>
                       <p className="text-[9px] font-semibold uppercase tracking-wider text-fg-muted">
                         Dispatched
                       </p>
                       <p className="mt-1 text-xs font-semibold text-fg">
                         {formatDate(trip.trip_start_date)}
                       </p>
                     </div>
                   </div>
                 </button>
               ))}
             </div>
           )}
         </div>
       </DialogBody>
     </DialogContent>
   </Dialog>
 </div>
     )}
   </>
 );
}
