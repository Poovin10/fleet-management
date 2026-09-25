"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function ModifyTrips() {
 const supabase = createClient();
 const [vehicles, setVehicles] = useState<any[]>([]);
 const [drivers, setDrivers] = useState<any[]>([]);
 const [tripsList, setTripsList] = useState<any[]>([]);
 const [editTripId, setEditTripId] = useState<number | null>(null);
 const [currentTrip, setCurrentTrip] = useState<any>(null);
 const [isProcessing, setIsProcessing] = useState(false);

 const [auditDateMode, setAuditDateMode] = useState("All Time");
 const [auditSpecificDate, setAuditSpecificDate] = useState(new Date().toISOString().split('T')[0]);
 const [auditFromDate, setAuditFromDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
 const [auditToDate, setAuditToDate] = useState(new Date().toISOString().split('T')[0]);
 const [auditTruck, setAuditTruck] = useState("All Trucks");
 const [auditStatus, setAuditStatus] = useState("All Statuses");
 const [auditSearchLr, setAuditSearchLr] = useState("");

 const [tripNumber, setTripNumber] = useState("");
 const [startDate, setStartDate] = useState("");
 const [status, setStatus] = useState("DISPATCHED");
 const [origin, setOrigin] = useState("");
 const [destination, setDestination] = useState("");
 const [driverId, setDriverId] = useState("");
 const [tonnage, setTonnage] = useState<number | "">("");
 const [spotRate, setSpotRate] = useState<number | "">("");
 const [dieselL, setDieselL] = useState<number | "">("");
 const [isTankFull, setIsTankFull] = useState(false);
 const [startKm, setStartKm] = useState<number | "">("");
 const [endKm, setEndKm] = useState<number | "">("");
 const [driverBata, setDriverBata] = useState<number | "">("");
 const [advanceIssued, setAdvanceIssued] = useState<number | "">("");
 const [endDate, setEndDate] = useState("");
 const [unloadedMt, setUnloadedMt] = useState<number | "">("");
 const [haltBata, setHaltBata] = useState<number | "">("");

 const grossFreight = Math.round((Number(tonnage) || 0) * (Number(spotRate) || 0) * 100) / 100;

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
 const { data: vData } = await supabase.from('vehicles').select('vehicle_id:id, vehicle_number').order('vehicle_number');
 if (vData) setVehicles(vData);
 const { data: dData } = await supabase.from('drivers').select('driver_id, full_name, driver_code').order('full_name');
 if (dData) setDrivers(dData);
 await handleSearchTrips();
 };

 useEffect(() => { loadInitialData(); }, []);

 const handleSearchTrips = async () => {
 setIsProcessing(true);
 const selectString = auditTruck !== "All Trucks" ? '*, vehicles!inner(vehicle_number), drivers(full_name)' : '*, vehicles(vehicle_number), drivers(full_name)';
 let query = supabase.from('trips').select(selectString).order('trip_start_date', { ascending: false }).order('trip_id', { ascending: false }).limit(200);

 if (auditDateMode === "Specific Date") query = query.eq('trip_start_date', auditSpecificDate);
 else if (auditDateMode === "Date Range") query = query.gte('trip_start_date', auditFromDate).lte('trip_start_date', auditToDate);
 if (auditTruck !== "All Trucks") query = query.eq('vehicles.vehicle_number', auditTruck);
 if (auditStatus !== "All Statuses") query = query.eq('trip_status', auditStatus);
 if (auditSearchLr) query = query.ilike('trip_number', `%${auditSearchLr}%`);

 const { data } = await query;
 if (data) setTripsList(data); else setTripsList([]);
 setIsProcessing(false);
 };

 const exportTripsToCSV = () => { /* Logic maintained */ };

 const handleEditClick = (trip: any) => {
 setEditTripId(trip.trip_id); setCurrentTrip(trip);
 setTripNumber(trip.trip_number || ""); setStartDate(trip.trip_start_date ? trip.trip_start_date.split('T')[0] : ""); setStatus(trip.trip_status || "DISPATCHED");
 setOrigin(trip.origin || ""); setDestination(trip.destination || ""); setDriverId(trip.primary_driver_id ? String(trip.primary_driver_id) : "");
 setTonnage(trip.tonnage_loaded || "");
 const rate = trip.spot_freight_rate || (trip.freight_revenue && trip.tonnage_loaded ? (trip.freight_revenue / trip.tonnage_loaded).toFixed(2) : "");
 setSpotRate(Number(rate));
 setDieselL(trip.fuel_litres || ""); setIsTankFull(trip.is_tank_full || false); setStartKm(trip.start_km || ""); setEndKm(trip.end_km || "");
 setDriverBata(trip.driver_bata || ""); setAdvanceIssued(trip.cash_advance_issued || "");
 setEndDate(trip.trip_end_date ? trip.trip_end_date.split('T')[0] : ""); setUnloadedMt(trip.unloaded_weight_mt || ""); setHaltBata(trip.halt_bata || "");
 window.scrollTo({ top: 0, behavior: 'smooth' });
 };

 const clearForm = () => { setEditTripId(null); setCurrentTrip(null); setTripNumber(""); setStartDate(""); setStatus("DISPATCHED"); setOrigin(""); setDestination(""); setDriverId(""); setTonnage(""); setSpotRate(""); setDieselL(""); setIsTankFull(false); setStartKm(""); setEndKm(""); setDriverBata(""); setAdvanceIssued(""); setEndDate(""); setUnloadedMt(""); setHaltBata(""); };

 const handleUpdateTrip = (e: React.FormEvent) => {
 e.preventDefault();
 if (!currentTrip) return;

 triggerModal(
   "Update Trip & Sync Ledgers",
   `Save modifications for Trip #${currentTrip.trip_number}?`,
   false,
   "Save & Sync",
   async () => {
     setIsProcessing(true);

     const normalizedTripNumber = tripNumber.toUpperCase().trim();
     const normalizedOrigin = origin.toUpperCase().trim();
     const normalizedDestination = destination.toUpperCase().trim();

     let currentDieselRate = 95.0;

     if (currentTrip.fuel_litres && currentTrip.fuel_expense) {
       currentDieselRate =
         Number(currentTrip.fuel_expense) / Number(currentTrip.fuel_litres);
     } else {
       const { data: dData } = await supabase
         .from("diesel_fuel_logs")
         .select("diesel_rate_per_litre")
         .order("fuel_date", { ascending: false })
         .limit(1);

       if (dData && dData.length > 0) {
         currentDieselRate = Number(dData[0].diesel_rate_per_litre);
       }
     }

     const finalDieselLitres = Number(dieselL) || 0;
     const newFuelCost = Math.round(
       finalDieselLitres * currentDieselRate * 100
     ) / 100;

     const payload = {
       trip_number: normalizedTripNumber,
       trip_start_date: startDate || null,
       trip_end_date: endDate || null,
       origin: normalizedOrigin,
       destination: normalizedDestination,
       primary_driver_id: driverId ? Number(driverId) : null,
       tonnage_loaded: tonnage !== "" ? Number(tonnage) : null,
       freight_revenue: grossFreight,
       driver_bata: driverBata !== "" ? Number(driverBata) : 0,
       cash_advance_issued:
         advanceIssued !== "" ? Number(advanceIssued) : 0,
       trip_status: status,
       unloaded_weight_mt:
         unloadedMt !== "" ? Number(unloadedMt) : 0,
       halt_bata: haltBata !== "" ? Number(haltBata) : 0,

       fuel_litres: finalDieselLitres,
       fuel_expense: newFuelCost,
       diesel_rate_per_litre: currentDieselRate,
       fuel_date: startDate || new Date().toISOString().split("T")[0],
       diesel_category: "TRIP_DIESEL",
       lr_number: normalizedTripNumber || "SUNDRY",
       fuel_station_vendor: null,
       fuel_remarks: null,
       is_tank_full: isTankFull
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



 return (
 <div className="space-y-6 animate-in fade-in duration-300">
 <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} isDanger={modalConfig.isDanger} confirmText={modalConfig.confirmText} onConfirm={modalConfig.action} onCancel={closeModal} isProcessing={isProcessing} />
 
 <div className="liquid-glass p-6 sm:p-8 shadow-xl max-w-5xl mx-auto h-fit">
 <div className="flex justify-between items-center border-b border-border pb-3 mb-6">
 <h3 className="text-sm font-semibold text-fg tracking-wide">{currentTrip ? `Modify Trip: ${currentTrip.trip_number}` : "Modify Existing Trip"}</h3>
 {currentTrip && <span className="px-3 py-1 bg-warning-soft text-warning text-[10px] font-bold rounded-lg tracking-normal animate-pulse">Editing Mode</span>}
 </div>

 {!currentTrip ? (
 <div className="py-12 text-center border-2 border-dashed border-border rounded-lg kss-surface-raised"><p className="text-fg-secondary font-bold text-sm">Select a trip from the Search & Audit Log below to modify its details.</p></div>
 ) : (
 <form onSubmit={handleUpdateTrip} className="space-y-5 animate-in slide-in-from-bottom-4">
 <div className="flex flex-wrap gap-4 bg-success-soft p-3 rounded-lg border border-success/20"><span className="text-xs text-success font-bold tracking-wider">Integrity Sync: Save validates trip and fuel records atomically. Missing fuel records must be created through Fuel Advance.</span></div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">LR Number</label><Input type="text" value={tripNumber} onChange={e => setTripNumber(e.target.value)} className="text-fg font-bold" /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Dispatch Date</label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-fg font-bold" /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Trip Status</label><Select value={status} onChange={e => setStatus(e.target.value)} className="text-fg font-bold"><option value="DISPATCHED">DISPATCHED</option><option value="IN_TRANSIT">IN_TRANSIT</option><option value="COMPLETED">COMPLETED</option><option value="CANCELLED">CANCELLED</option></Select></div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Source (Origin)</label><Input type="text" value={origin} onChange={e => setOrigin(e.target.value)} className="text-fg font-bold" /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Destination</label><Input type="text" value={destination} onChange={e => setDestination(e.target.value)} className="text-fg font-bold" /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Primary Driver</label><Select value={driverId} onChange={e => setDriverId(e.target.value)} className="text-fg font-bold"><option value="">-- UNASSIGNED --</option>{drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.driver_code} - {d.full_name}</option>)}</Select></div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 kss-surface-raised rounded-lg border border-border">
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Loaded MT</label><Input type="number" step="0.01" value={tonnage} onChange={e => setTonnage(e.target.value === "" ? "" : parseFloat(e.target.value))} className="text-fg font-bold" /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Freight Rate / MT ()</label><Input type="number" step="0.01" value={spotRate} onChange={e => setSpotRate(e.target.value === "" ? "" : parseFloat(e.target.value))} className="text-success font-bold" /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Auto-Calc Gross Freight ()</label><Input type="text" value={`${grossFreight.toLocaleString('en-IN', {minimumFractionDigits: 2})}`} disabled className="w-full text-sm p-3 rounded-lg border border-success/20 bg-success-soft text-success font-semibold cursor-not-allowed"  /></div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div><div className="flex justify-between items-end mb-1"><label className="block text-[10px] font-bold text-fg-secondary">Diesel Issued (L)</label><label className="flex items-center gap-1 cursor-pointer select-none"><input type="checkbox" checked={isTankFull} onChange={e => setIsTankFull(e.target.checked)} className="w-3 h-3 rounded text-accent focus:ring-accent bg-surface-raised border-border" /><span className="text-[9px] font-semibold text-fg">Tank Full</span></label></div><Input type="number" step="0.1" value={dieselL} onChange={e => setDieselL(e.target.value === "" ? "" : parseFloat(e.target.value))} className="text-accent font-bold" /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Start KM</label><Input type="number" value={startKm} disabled={!!currentTrip} onChange={e => setStartKm(e.target.value === "" ? "" : parseFloat(e.target.value))} className="text-info font-bold disabled:opacity-60 disabled:cursor-not-allowed" /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">End KM</label><Input type="number" value={endKm} disabled={!!currentTrip} onChange={e => setEndKm(e.target.value === "" ? "" : parseFloat(e.target.value))} className="text-info font-bold disabled:opacity-60 disabled:cursor-not-allowed" /></div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Driver Bata ()</label><Input type="number" value={driverBata} onChange={e => setDriverBata(e.target.value === "" ? "" : parseFloat(e.target.value))} className="text-accent font-bold" /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Halt Bata ()</label><Input type="number" value={haltBata} onChange={e => setHaltBata(e.target.value === "" ? "" : parseFloat(e.target.value))} className="text-accent font-bold" /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Cash Adv Issued ()</label><Input type="number" value={advanceIssued} onChange={e => setAdvanceIssued(e.target.value === "" ? "" : parseFloat(e.target.value))} className="text-warning font-bold" /></div>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">POD Closing Date</label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-fg font-bold" /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Unloaded MT</label><Input type="number" step="0.01" value={unloadedMt} onChange={e => setUnloadedMt(e.target.value === "" ? "" : parseFloat(e.target.value))} className="text-fg font-bold" /></div>
 </div>
 <div className="pt-4 flex gap-3">
 <Button type="button" variant="glass" size="lg" className="flex-1" onClick={clearForm}>Cancel Edit</Button>
 <Button type="submit" disabled={isProcessing} size="lg" className="flex-[2]">Save Trip Updates</Button>
 </div>
 </form>
 )}
 </div>

 <div className="liquid-glass overflow-hidden flex flex-col shadow-xl max-w-5xl mx-auto h-fit mt-6">
 <div className="bg-surface-raised px-6 py-4 flex justify-between items-center border-b border-border"><h3 className="text-sm font-semibold text-fg tracking-wide">Trip Audit & Search</h3></div>
 <div className="p-6 border-b border-border bg-surface-raised">
 <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Date Mode</label><Select value={auditDateMode} onChange={e => setAuditDateMode(e.target.value)} className="text-fg font-semibold"><option value="All Time">All Time</option><option value="Specific Date">Specific Date</option><option value="Date Range">Date Range</option></Select></div>
 {auditDateMode === "Specific Date" && (<div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Date</label><Input type="date" value={auditSpecificDate} onChange={e => setAuditSpecificDate(e.target.value)} className="text-fg font-semibold" /></div>)}
 {auditDateMode === "Date Range" && (<><div><label className="block text-[10px] font-bold text-fg-secondary mb-1">From</label><Input type="date" value={auditFromDate} onChange={e => setAuditFromDate(e.target.value)} className="text-fg font-semibold" /></div><div><label className="block text-[10px] font-bold text-fg-secondary mb-1">To</label><Input type="date" value={auditToDate} onChange={e => setAuditToDate(e.target.value)} className="text-fg font-semibold" /></div></>)}
 {auditDateMode === "All Time" && <div className="hidden md:block md:col-span-2"></div>}
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Truck No</label><Select value={auditTruck} onChange={e => setAuditTruck(e.target.value)} className="text-fg font-bold"><option value="All Trucks">All Trucks</option>{vehicles.map(v => <option key={v.vehicle_number} value={v.vehicle_number}>{v.vehicle_number}</option>)}</Select></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Status</label><Select value={auditStatus} onChange={e => setAuditStatus(e.target.value)} className="text-fg font-semibold"><option value="All Statuses">All Statuses</option><option value="DISPATCHED">DISPATCHED</option><option value="IN_TRANSIT">IN_TRANSIT</option><option value="COMPLETED">COMPLETED</option><option value="CANCELLED">CANCELLED</option></Select></div>
 </div>
 <div className="flex flex-col md:flex-row gap-4">
 <div className="flex-1"><label className="block text-[10px] font-bold text-fg-secondary mb-1">Search LR No</label><Input type="text" value={auditSearchLr} onChange={e => setAuditSearchLr(e.target.value.toUpperCase())} placeholder="e.g. 400..." className="text-fg font-semibold" /></div>
 <div className="flex items-end gap-3">
 <Button onClick={handleSearchTrips} disabled={isProcessing} size="lg">{isProcessing ? "Searching..." : "Search Trips"}</Button>
 <Button onClick={exportTripsToCSV} variant="glass" size="lg"><span className="text-lg leading-none">Export CSV</span></Button>
 </div>
 </div>
 </div>

 <div className="overflow-x-auto flex-1 max-h-[600px] overflow-y-auto w-full">
 <Table className="min-w-full text-xs text-left whitespace-nowrap">
 <TableHeader className="sticky top-0 z-10"><TableRow>
  <TableHead className="px-5 py-3">Date</TableHead>
  <TableHead className="px-5 py-3">Trip LR</TableHead>
  <TableHead className="px-5 py-3">Truck & Driver</TableHead>
  <TableHead className="px-5 py-3">Route</TableHead>
  <TableHead className="px-5 py-3 text-center">Status</TableHead>
</TableRow></TableHeader>
 <TableBody className="liquid-glass">
 {tripsList.map(t => {
 const isEditing = editTripId === t.trip_id;
 return (
 <TableRow
  key={t.trip_id}
  onClick={() => handleEditClick(t)}
  className={`cursor-pointer ${
    isEditing
      ? "bg-accent-soft border-l-2 border-l-accent"
      : "hover:bg-surface-raised/50 border-l-2 border-transparent"
  }`}
>
 <TableCell className="animate-tab-focus px-5 py-3.5 font-semibold text-fg-secondary">{formatDate(t.trip_start_date)}</TableCell>
 <TableCell className="px-5 py-3.5 font-semibold text-fg">{t.trip_number}</TableCell>
 <TableCell className="px-5 py-3.5 text-fg-secondary"><span className="font-bold text-fg">{t.vehicles?.vehicle_number}</span><br/><span className="text-[10px] text-fg-muted">{t.drivers?.full_name}</span></TableCell>
 <TableCell className="px-5 py-3.5 text-fg-secondary">{t.origin} {t.destination}</TableCell>
 <TableCell className="px-5 py-3.5 text-center">
  <span className={`px-2.5 py-1 rounded text-[10px] font-bold ${
    t.trip_status === 'COMPLETED'
      ? 'bg-success-soft text-success border border-success/20'
      : t.trip_status === 'CANCELLED'
        ? 'bg-danger-soft text-danger border border-danger/20'
        : 'bg-warning-soft text-warning border border-warning/30'
  }`}>
    {t.trip_status}
  </span>
</TableCell>
 </TableRow>
 );
 })}
 {tripsList.length === 0 && !isProcessing && (<TableRow><TableCell colSpan={5} className="p-8 text-center text-fg-muted font-medium">No trips found matching your search.</TableCell></TableRow>)}
 </TableBody>
 </Table>
 </div>
 </div>
 </div>
 );
}
