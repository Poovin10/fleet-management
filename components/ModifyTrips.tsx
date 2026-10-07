"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/Pagination";

export function ModifyTrips() {
 const supabase = createClient();
 const [vehicles, setVehicles] = useState<any[]>([]);
 const [drivers, setDrivers] = useState<any[]>([]);
 const [tripsList, setTripsList] = useState<any[]>([]);
 const [tripsPage, setTripsPage] = useState(1);
 const [tripsTotalItems, setTripsTotalItems] = useState(0);
 const [isSearchingTrips, setIsSearchingTrips] = useState(false);
 const [showTripPicker, setShowTripPicker] = useState(false);
 const [showModifyModal, setShowModifyModal] = useState(false);
 const [editTripId, setEditTripId] = useState<number | null>(null);
 const [currentTrip, setCurrentTrip] = useState<any>(null);
 const [isLrEditing, setIsLrEditing] = useState(false);
 const [isProcessing, setIsProcessing] = useState(false);

 const tripsPageSize = 10;
 const tripsTotalPages = Math.max(1, Math.ceil(tripsTotalItems / tripsPageSize));
 const tripSearchRequest = useRef(0);
 const tripSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

 const [auditDateMode, setAuditDateMode] = useState("All Time");
 const [auditSpecificDate, setAuditSpecificDate] = useState(new Date().toISOString().split('T')[0]);
 const [auditFromDate, setAuditFromDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
 const [auditToDate, setAuditToDate] = useState(new Date().toISOString().split('T')[0]);
 const [auditTruck, setAuditTruck] = useState("All Trucks");
 const [auditStatus, setAuditStatus] = useState("All Statuses");
 const [auditSearchLr, setAuditSearchLr] = useState("");

 const [tripNumber, setTripNumber] = useState("");
 const [startDate, setStartDate] = useState("");
 const [origin, setOrigin] = useState("");
 const [destination, setDestination] = useState("");
 const [driverId, setDriverId] = useState("");
 const [tonnage, setTonnage] = useState<number | "">("");
 const [historicalFreight, setHistoricalFreight] = useState<number | "">("");
 const [historicalFreightRate, setHistoricalFreightRate] = useState<number | "">("");
 const [historicalDriverBata, setHistoricalDriverBata] = useState<number | "">("");
 const [historicalCashAdvance, setHistoricalCashAdvance] = useState<number | "">("");
 const [historicalHaltBata, setHistoricalHaltBata] = useState<number | "">("");
 const [endDate, setEndDate] = useState("");

 const [modalConfig, setModalConfig] = useState({ isOpen: false, title: "", message: "", isDanger: false, confirmText: "Confirm", action: async () => {} });
 const triggerModal = (title: string, message: string, isDanger: boolean, confirmText: string, action: () => Promise<void>) => setModalConfig({ isOpen: true, title, message, isDanger, confirmText, action });
 const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

 const formatDate = (dateStr: string) => {
 if (!dateStr) return 'N/A';
 if (!dateStr.includes('-')) return dateStr;
 const parts = dateStr.split('T')[0].split('-');
 if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
 return dateStr;
 };

 const loadInitialData = async () => {
 setIsProcessing(true);
 const { data: vData } = await supabase.from('vehicles').select('vehicle_id, vehicle_number').order('vehicle_number');
 if (vData) setVehicles(vData);
 const { data: dData } = await supabase.from('drivers').select('driver_id, full_name, driver_code').order('full_name');
 if (dData) setDrivers(dData);
 setIsProcessing(false);
 };

 useEffect(() => { loadInitialData(); }, []);

 type TripSearchFilters = {
   dateMode: string;
   specificDate: string;
   fromDate: string;
   toDate: string;
   truck: string;
   status: string;
   searchLr: string;
 };

 const currentTripSearchFilters = (): TripSearchFilters => ({
   dateMode: auditDateMode,
   specificDate: auditSpecificDate,
   fromDate: auditFromDate,
   toDate: auditToDate,
   truck: auditTruck,
   status: auditStatus,
   searchLr: auditSearchLr,
 });

 const invalidateTripSearch = () => {
   tripSearchRequest.current += 1;
   if (tripSearchTimer.current) clearTimeout(tripSearchTimer.current);
   setTripsPage(1);
   setTripsTotalItems(0);
   setTripsList([]);
   setIsSearchingTrips(true);
 };

 const handleSearchTrips = async (requestedPage = 1, filters = currentTripSearchFilters()) => {
   const requestId = ++tripSearchRequest.current;
   setIsSearchingTrips(true);
   setTripsPage(requestedPage);
   setTripsList([]);

   try {
     const selectString = filters.truck !== "All Trucks"
       ? '*, vehicles!inner(vehicle_number), drivers(full_name)'
       : '*, vehicles(vehicle_number), drivers(full_name)';
     let query: any = (supabase.from('trips') as any)
       .select(selectString, { count: "exact" })
       .order('trip_start_date', { ascending: false })
       .order('trip_id', { ascending: false });

     if (filters.dateMode === "Specific Date") query = query.eq('trip_start_date', filters.specificDate);
     else if (filters.dateMode === "Date Range") query = query.gte('trip_start_date', filters.fromDate).lte('trip_start_date', filters.toDate);
     if (filters.truck !== "All Trucks") query = query.eq('vehicles.vehicle_number', filters.truck);
     if (filters.status !== "All Statuses") query = query.eq('trip_status', filters.status);
     if (filters.searchLr.trim()) query = query.ilike('trip_number', `%${filters.searchLr.trim()}%`);

     const from = (requestedPage - 1) * tripsPageSize;
     const { data, error, count } = await query.range(from, from + tripsPageSize - 1);
     if (requestId !== tripSearchRequest.current) return;
     if (error) throw error;

     const matchingCount = count ?? data?.length ?? 0;
     const lastPage = Math.max(1, Math.ceil(matchingCount / tripsPageSize));
     if (requestedPage > lastPage) {
       setTripsPage(lastPage);
       void handleSearchTrips(lastPage, filters);
       return;
     }
     setTripsList(data || []);
     setTripsTotalItems(matchingCount);
   } catch (error) {
     if (requestId !== tripSearchRequest.current) return;
     console.error("Trip search error:", error);
     setTripsList([]);
     setTripsTotalItems(0);
   } finally {
     if (requestId === tripSearchRequest.current) setIsSearchingTrips(false);
   }
 };

 useEffect(() => {
   if (!showTripPicker) return;

   tripSearchRequest.current += 1;
   setTripsPage(1);
   setTripsTotalItems(0);
   setTripsList([]);
   setIsSearchingTrips(true);
   if (tripSearchTimer.current) clearTimeout(tripSearchTimer.current);

   const filters = currentTripSearchFilters();
   tripSearchTimer.current = setTimeout(() => {
     void handleSearchTrips(1, filters);
   }, filters.searchLr ? 250 : 0);

   return () => {
     if (tripSearchTimer.current) clearTimeout(tripSearchTimer.current);
   };
 }, [showTripPicker, auditDateMode, auditSpecificDate, auditFromDate, auditToDate, auditTruck, auditStatus, auditSearchLr]);

 const clearForm = () => {
   setEditTripId(null);
   setCurrentTrip(null);
   setIsLrEditing(false);
   setTripNumber("");
   setStartDate("");
   setOrigin("");
   setDestination("");
   setDriverId("");
   setTonnage("");
   setHistoricalFreight("");
   setHistoricalFreightRate("");
   setHistoricalDriverBata("");
   setHistoricalCashAdvance("");
   setHistoricalHaltBata("");
   setEndDate("");
 };

 const handleSearchByLr = async () => {
   const searchLr = tripNumber.trim().toUpperCase();

   if (!searchLr) {
     alert("Please enter an LR number.");
     return;
   }

   setIsSearchingTrips(true);
   setCurrentTrip(null);
   setEditTripId(null);
   setAuditSearchLr(searchLr);

   try {
     const { data, error } = await (supabase.from("trips") as any)
       .select('*, vehicles(vehicle_number), drivers(full_name)')
       .eq("trip_number", searchLr)
       .maybeSingle();

     if (error) throw error;

     if (!data) {
       alert("LR Number not found.");
       return;
     }

     handleEditClick(data);
   } catch (error: any) {
     console.error("LR lookup error:", error);
     alert(error?.message ? `LR search failed: ${error.message}` : "LR search failed.");
   } finally {
     setIsSearchingTrips(false);
   }
 };

 const handleEditClick = (trip: any) => {
   setShowTripPicker(false);
   setEditTripId(trip.trip_id);
   setCurrentTrip(trip);
   setIsLrEditing(false);
   setShowModifyModal(true);

   setTripNumber(trip.trip_number || "");
   setStartDate(trip.trip_start_date ? trip.trip_start_date.split('T')[0] : "");
    setOrigin(trip.origin || "");
   setDestination(trip.destination || "");
   setDriverId(trip.primary_driver_id ? String(trip.primary_driver_id) : "");
   setTonnage(trip.tonnage_loaded || "");

   const historicalRate =
     trip.freight_rate_used !== null &&
     trip.freight_rate_used !== undefined
       ? Number(trip.freight_rate_used)
       : "";

   setHistoricalFreightRate(
     historicalRate === "" ? "" : Number(historicalRate)
   );

   setHistoricalFreight(
     trip.freight_revenue !== null &&
     trip.freight_revenue !== undefined
       ? Number(trip.freight_revenue)
       : ""
   );


   setHistoricalDriverBata(
     trip.bata_amount_used !== null &&
     trip.bata_amount_used !== undefined
       ? Number(trip.bata_amount_used)
       : Number(trip.driver_bata || 0)
   );
   setHistoricalCashAdvance(
     trip.cash_advance_issued !== null &&
     trip.cash_advance_issued !== undefined
       ? Number(trip.cash_advance_issued)
       : ""
   );
   setEndDate(trip.trip_end_date ? trip.trip_end_date.split('T')[0] : "");

   setHistoricalHaltBata(
     trip.halt_bata !== null &&
     trip.halt_bata !== undefined
       ? Number(trip.halt_bata)
       : ""
   );
 };

 const handleUpdateTrip = async (e: React.FormEvent) => {
   e.preventDefault();

   if (!currentTrip?.trip_id) {
     alert("Please search and load a trip first.");
     return;
   }

   const normalizedTripNumber = tripNumber.trim().toUpperCase();
   const normalizedOrigin = origin.trim();
   const normalizedDestination = destination.trim();

   if (!normalizedTripNumber || !normalizedOrigin || !normalizedDestination) {
     alert("LR number, source and destination are required.");
     return;
   }

   setIsProcessing(true);

   triggerModal(
     "Confirm Trip Update",
     `Save the changes made to LR ${normalizedTripNumber}?`,
     false,
     "Save Updates",
     async () => {
       let currentDieselRate = Number(currentTrip?.diesel_rate_per_litre) || 0;

       if (!currentDieselRate && Number(currentTrip?.fuel_litres) > 0) {
         currentDieselRate =
           Number(currentTrip?.fuel_expense || 0) /
           Number(currentTrip?.fuel_litres || 1);
       }

       if (!currentDieselRate) {
         const { data: dData } = await (supabase.from("diesel_fuel_logs") as any)
           .select("diesel_rate_per_litre")
           .order("fuel_date", { ascending: false })
           .limit(1);

         if (dData?.[0]?.diesel_rate_per_litre) {
           currentDieselRate = Number(dData[0].diesel_rate_per_litre);
         }
       }

       if (!currentDieselRate) currentDieselRate = 95;

       const payload = {
         trip_number: normalizedTripNumber,
         trip_start_date: startDate || null,
         trip_end_date: endDate || null,
         origin: normalizedOrigin,
         destination: normalizedDestination,
         primary_driver_id: driverId ? Number(driverId) : null,
         tonnage_loaded: tonnage !== "" ? Number(tonnage) : null
       };

       const { error } = await supabase.rpc("modify_trip_atomic", {
         p_trip_id: Number(currentTrip.trip_id),
         p_payload: payload
       });

       if (error) {
         const message = error.message || "";

         if (message.includes("TRIP_VEHICLE_REQUIRED")) {
           alert(
             "This historical trip has no assigned vehicle and cannot be modified in the new integrity workflow."
           );
         } else if (
           message.includes("FUEL_RECORD_REQUIRED_USE_FUEL_ADVANCE")
         ) {
           alert(
             "No fuel record exists for this trip. Please create the fuel entry through Fuel Advance before modifying diesel details."
           );
         } else {
           alert("Trip update blocked: " + message);
         }

         setIsProcessing(false);
         closeModal();
         return;
       }

       await handleSearchTrips();
       clearForm();
       setIsProcessing(false);
       closeModal();
     }
   );
 };

 const renderEditWorkspace = () => (
   <form onSubmit={handleUpdateTrip} className="space-y-5 animate-in slide-in-from-bottom-4">
     <div className="flex flex-wrap gap-4 rounded-lg border border-success/20 bg-success-soft p-3">
       <span className="text-xs font-bold tracking-wider text-success">
         Integrity Sync: Save validates trip and fuel records atomically. Missing fuel records must be created through Fuel Advance.
       </span>
     </div>

     <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
       <div>
         <div className="mb-1 flex items-center justify-between">
           <label className="block text-[10px] font-bold text-fg-secondary">LR Number</label>
           <button
             type="button"
             onClick={() => setIsLrEditing((value) => !value)}
             className="text-[10px] font-bold text-accent hover:underline"
           >
             {isLrEditing ? "Lock LR" : "Edit LR"}
           </button>
         </div>
         <Input
           type="text"
           value={tripNumber}
           disabled={!isLrEditing}
           onChange={e => setTripNumber(e.target.value.toUpperCase())}
           className="text-fg font-bold disabled:cursor-not-allowed disabled:opacity-60"
         />
       </div>

       <div>
         <label className="mb-1 block text-[10px] font-bold text-fg-secondary">Dispatch Date</label>
         <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-fg font-bold" />
       </div>

     </div>

     <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
       <div>
         <label className="mb-1 block text-[10px] font-bold text-fg-secondary">Source (Origin)</label>
         <Input type="text" value={origin} onChange={e => setOrigin(e.target.value)} className="text-fg font-bold" />
       </div>
       <div>
         <label className="mb-1 block text-[10px] font-bold text-fg-secondary">Destination</label>
         <Input type="text" value={destination} onChange={e => setDestination(e.target.value)} className="text-fg font-bold" />
       </div>
       <div>
         <label className="mb-1 block text-[10px] font-bold text-fg-secondary">Primary Driver</label>
         <Select value={driverId} onChange={e => setDriverId(e.target.value)} className="text-fg font-bold">
           <option value="">-- UNASSIGNED --</option>
           {drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.driver_code} - {d.full_name}</option>)}
         </Select>
       </div>
     </div>

     <div className="grid grid-cols-1 gap-4 rounded-lg border border-border p-3 kss-surface-raised md:grid-cols-3">
       <div>
         <label className="mb-1 block text-[10px] font-bold text-fg-secondary">Loaded MT</label>
         <Input type="number" step="0.01" value={tonnage} onChange={e => setTonnage(e.target.value === "" ? "" : parseFloat(e.target.value))} className="text-fg font-bold" />
       </div>
       <div>
         <label className="mb-1 block text-[10px] font-bold text-fg-secondary">Historical Freight Rate / MT</label>
         <Input
           type="text"
           value={
             historicalFreightRate === ""
               ? "—"
               : Number(historicalFreightRate).toLocaleString("en-IN", {
                   minimumFractionDigits: 2,
                 })
           }
           disabled
           className="w-full cursor-not-allowed rounded-lg border border-success/20 bg-success-soft p-3 text-sm font-semibold text-success opacity-90"
         />
       </div>
       <div>
         <label className="mb-1 block text-[10px] font-bold text-fg-secondary">Historical Gross Freight</label>
         <Input
           type="text"
           value={
             historicalFreight === ""
               ? "—"
               : Number(historicalFreight).toLocaleString("en-IN", {
                   minimumFractionDigits: 2,
                 })
           }
           disabled
           className="w-full cursor-not-allowed rounded-lg border border-success/20 bg-success-soft p-3 text-sm font-semibold text-success opacity-90"
         />
       </div>
     </div>

     <div className="rounded-lg border border-info/20 bg-info-soft p-3">
       <div className="text-[10px] font-bold uppercase tracking-wider text-info">
         Fuel & Odometer Protected
       </div>
       <p className="mt-1 text-xs text-fg-secondary">
         Diesel, tank status and odometer readings are controlled by their dedicated
         workflows and cannot be changed from Modify Trip.
       </p>
     </div>

     <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
       <div>
         <label className="mb-1 block text-[10px] font-bold text-fg-secondary">Historical Driver Bata</label>
         <Input
           type="text"
           value={
             historicalDriverBata === ""
               ? "—"
               : Number(historicalDriverBata).toLocaleString("en-IN", {
                   minimumFractionDigits: 2,
                 })
           }
           disabled
           className="cursor-not-allowed border border-accent/20 bg-accent-soft p-3 font-bold text-accent opacity-90"
         />
       </div>
       <div>
         <label className="mb-1 block text-[10px] font-bold text-fg-secondary">Historical Halt Bata</label>
         <Input
           type="text"
           value={
             historicalHaltBata === ""
               ? "—"
               : Number(historicalHaltBata).toLocaleString("en-IN", {
                   minimumFractionDigits: 2,
                 })
           }
           disabled
           className="cursor-not-allowed border border-accent/20 bg-accent-soft p-3 font-bold text-accent opacity-90"
         />
       </div>
       <div>
         <label className="mb-1 block text-[10px] font-bold text-fg-secondary">Cash Advance Recorded</label>
         <Input
           type="text"
           value={
             historicalCashAdvance === ""
               ? "—"
               : Number(historicalCashAdvance).toLocaleString("en-IN", {
                   minimumFractionDigits: 2,
                 })
           }
           disabled
           className="cursor-not-allowed border border-warning/20 bg-warning-soft p-3 font-bold text-warning opacity-90"
         />
       </div>
     </div>

     <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
       <div>
         <label className="mb-1 block text-[10px] font-bold text-fg-secondary">Trip End Date</label>
         <Input
           type="date"
           value={endDate}
           onChange={e => setEndDate(e.target.value)}
           className="text-fg font-bold"
         />
       </div>
     </div>

     <div className="flex gap-3 pt-4">
       <Button type="button" variant="glass" size="lg" className="flex-1" onClick={clearForm}>Cancel Edit</Button>
       <Button type="submit" disabled={isProcessing} size="lg" className="flex-[2]">Save Trip Updates</Button>
     </div>
   </form>
 );

 return (
   <div className="min-h-full animate-in fade-in duration-300">
     {!showModifyModal ? (
       <div className="liquid-glass w-full rounded-2xl p-5 sm:p-6">
         <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
           <div>
             <p className="kss-eyebrow text-accent">Operations Â· Trip Control</p>
             <h2 className="mt-1 text-xl font-semibold text-fg">Modify Trip</h2>
             <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-secondary">
               Search an existing LR and make authorised operational corrections
               without exposing the edit workspace until requested.
             </p>
           </div>

           <Button
             type="button"
             size="lg"
             className="min-h-11 shrink-0 sm:min-w-48"
             onClick={() => setShowModifyModal(true)}
           >
             Open Modify Trip
           </Button>
         </div>
       </div>
     ) : null}

     <ConfirmModal
       isOpen={modalConfig.isOpen}
       title={modalConfig.title}
       message={modalConfig.message}
       isDanger={modalConfig.isDanger}
       confirmText={modalConfig.confirmText}
       onConfirm={modalConfig.action}
       onCancel={closeModal}
       isProcessing={isProcessing}
     />

     <Dialog
       open={showModifyModal}
       onOpenChange={(open) => {
         setShowModifyModal(open);
         if (!open) {
           clearForm();
         }
       }}
     >
       <DialogContent
         layout="modal"
         size="full"
         className="flex h-[96dvh] max-h-[96dvh] flex-col overflow-hidden p-0"
       >
         <DialogHeader>
           <div className="flex items-center gap-3">
             <div>
               <DialogTitle>Modify Trip</DialogTitle>
               <DialogDescription>
                 Search by LR number to load the trip and edit its operational details.
               </DialogDescription>
             </div>
             {currentTrip ? (
               <span className="ml-auto mr-8 rounded-lg border border-accent-border bg-accent-soft px-3 py-1 text-[10px] font-bold tracking-wide text-accent">
                 EDITING {currentTrip.trip_number}
               </span>
             ) : null}
           </div>
         </DialogHeader>

         <DialogBody className="min-h-0 flex-1 overflow-y-auto">
           <div className="w-full space-y-5">
             <div className="border-b border-border-subtle pb-5">
               <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
                 <div className="min-w-0">
                   <label className="mb-1 block text-[10px] font-bold tracking-wide text-fg-secondary">
                     LR NUMBER
                   </label>
                   <Input
                     type="text"
                     value={tripNumber}
                     onChange={(e) => setTripNumber(e.target.value.toUpperCase())}
                     placeholder="Enter LR number and search"
                     className="h-11 text-fg font-bold"
                     autoFocus
                   />
                 </div>

                 <Button
                   type="button"
                   size="lg"
                   className="lg:min-w-36"
                   onClick={() => void handleSearchByLr()}
                   disabled={isSearchingTrips || !tripNumber.trim()}
                 >
                   {isSearchingTrips ? "Searching..." : "Search LR"}
                 </Button>

                 <Button
                   type="button"
                   variant="glass"
                   size="lg"
                   className="lg:min-w-28"
                   onClick={() => setIsLrEditing((value) => !value)}
                   disabled={!currentTrip}
                 >
                   {isLrEditing ? "Lock LR" : "Edit LR"}
                 </Button>
               </div>

               <p className="mt-3 text-xs text-fg-muted">
                 Enter an LR number to load its existing trip details into this form. The LR remains locked unless Edit LR is enabled.
               </p>
             </div>

             <div className="pt-1">
               <div className="mb-5 flex justify-end border-b border-border pb-4">
                 {currentTrip ? (
                   <span className="rounded-lg border border-accent-border bg-accent-soft px-3 py-1 text-[10px] font-bold tracking-wide text-accent">
                     LOADED Â· {currentTrip.trip_number}
                   </span>
                 ) : (
                   <span className="rounded-lg bg-surface-raised px-3 py-1 text-[10px] font-bold tracking-wide text-fg-muted">
                     AWAITING LR SEARCH
                   </span>
                 )}
               </div>

               {renderEditWorkspace()}
             </div>
           </div>
         </DialogBody>
       </DialogContent>
     </Dialog>
   </div>
 );
}
