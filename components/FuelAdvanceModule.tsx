"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

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
 const [showFuelRecords, setShowFuelRecords] = useState(false);
 const [showDieselWorkspace, setShowDieselWorkspace] = useState(false);
 const [adblueLogs, setAdblueLogs] = useState<any[]>([]);
 const [adblueVendors, setAdblueVendors] = useState<any[]>([]);
 const [adblueSearch, setAdblueSearch] = useState("");
 const [showAdblueRecords, setShowAdblueRecords] = useState(false);
 const [showAdblueWorkspace, setShowAdblueWorkspace] = useState(false);
 const [adblueEditId, setAdblueEditId] = useState<number | null>(null);
 const [adblueDate, setAdblueDate] = useState(new Date().toISOString().split('T')[0]);
 const [adblueVehicleId, setAdblueVehicleId] = useState("");
 const [adblueTripId, setAdblueTripId] = useState("");
 const [adblueLrNo, setAdblueLrNo] = useState("");
 const [adblueLitres, setAdblueLitres] = useState<number | "">("");
 const [adblueRate, setAdblueRate] = useState<number | "">("");
 const [adblueFillingKm, setAdblueFillingKm] = useState<number | "">("");
 const [adblueCurrentOdometer, setAdblueCurrentOdometer] = useState<number | null>(null);
 const [adblueFillingKmError, setAdblueFillingKmError] = useState("");
 const [adblueVendorId, setAdblueVendorId] = useState("");
 const [adbluePaymentMode, setAdbluePaymentMode] = useState("CASH");
 const [adblueInvoiceNumber, setAdblueInvoiceNumber] = useState("");
 const [adblueDueDate, setAdblueDueDate] = useState("");
 const [adbluePaymentReference, setAdbluePaymentReference] = useState("");
 const [adblueIsTankFull, setAdblueIsTankFull] = useState(false);
 const [adblueRemarks, setAdblueRemarks] = useState("");

 
 // Search used to find existing records for operational edits.
 const [recentSearch, setRecentSearch] = useState("");

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
 const [currentOdometer, setCurrentOdometer] = useState<number | null>(null);
 const [fillingKmError, setFillingKmError] = useState("");
 const [fLitres, setFLitres] = useState<number | "">("");
 const [fDieselRate, setFDieselRate] = useState<number | "">(95.0);
 const [fIsTankFull, setFIsTankFull] = useState(false);


 const formatDate = (dateStr: string) => {
 if (!dateStr) return 'N/A';
 if (!dateStr.includes('-')) return dateStr;
 const parts = dateStr.split('T')[0].split('-');
 if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
 return dateStr;
 };

 const fetchData = async () => {
 setIsLoading(true);
 const [vehRes, fuelRes, dieselRateRes, scansRes, adblueRes, vendorRes] = await Promise.all([
 supabase.from('vehicles').select('*').eq('is_active', true).order('vehicle_number'),
 supabase.from('diesel_fuel_logs').select('*, vehicles(vehicle_number)').order('fuel_date', { ascending: false }).order('fuel_log_id', { ascending: false }).limit(200),
 supabase.from('diesel_fuel_logs').select('diesel_rate_per_litre').order('fuel_date', { ascending: false }).order('fuel_log_id', { ascending: false }).limit(1),
 supabase.from("pending_scans").select("*").eq("document_type", "FUEL_SLIP").eq("status", "PENDING").order("created_at", { ascending: false }),
 supabase.from('adblue_logs').select('*, vehicles(vehicle_number), vendors(vendor_name, vendor_type)').order('adblue_date', { ascending: false }).order('adblue_log_id', { ascending: false }).limit(200),
 supabase.from('vendors').select('*').eq('is_active', true).order('vendor_name')
 ]);

 if (vehRes.data) setVehicles(vehRes.data);
 if (fuelRes.data) setRecentFuelLogs(fuelRes.data);
 if (scansRes.data) setPendingScans(scansRes.data);
 if (adblueRes.data) setAdblueLogs(adblueRes.data);
 if (vendorRes.data) {
   setAdblueVendors(
     vendorRes.data.filter((v: any) =>
       ["ADBLUE", "GENERAL"].includes(String(v.vendor_type || "").toUpperCase())
     )
   );
 }

 if (dieselRateRes.data && dieselRateRes.data.length > 0 && dieselRateRes.data[0].diesel_rate_per_litre) {
 const latestRate = Number(dieselRateRes.data[0].diesel_rate_per_litre);
 setDieselRate(latestRate);
 if (!editLogId) setFDieselRate(latestRate);
 }
 setIsLoading(false);
 };

 useEffect(() => {
 fetchData();
 }, [faNav]);

 useEffect(() => {
 if (!fVehicleId) {
 setCurrentOdometer(null);
 setFillingKmError("");
 return;
 }

 const fetchCurrentOdometer = async () => {
 const { data, error } = await supabase.rpc(
 "get_vehicle_current_odometer",
 { p_vehicle_id: Number(fVehicleId) }
 );

 if (error) {
 console.error("Failed to fetch authoritative odometer:", error);
 setCurrentOdometer(null);
 setFillingKmError("Unable to verify the truck's current odometer.");
 return;
 }

 const odo = Number(data || 0);
 setCurrentOdometer(odo > 0 ? odo : null);
 setFillingKmError("");
 };

 fetchCurrentOdometer();
 }, [fVehicleId, supabase]);

 useEffect(() => {
   if (!adblueVehicleId) {
     setAdblueCurrentOdometer(null);
     setAdblueFillingKmError("");
     return;
   }

   const fetchAdblueOdometer = async () => {
     const { data, error } = await supabase.rpc(
       "get_vehicle_current_odometer",
       { p_vehicle_id: Number(adblueVehicleId) }
     );

     if (error) {
       console.error("Failed to fetch authoritative AdBlue odometer:", error);
       setAdblueCurrentOdometer(null);
       setAdblueFillingKmError("Unable to verify the truck's current odometer.");
       return;
     }

     const odo = Number(data || 0);
     setAdblueCurrentOdometer(odo > 0 ? odo : null);
     setAdblueFillingKmError("");
   };

   fetchAdblueOdometer();
 }, [adblueVehicleId, supabase]);

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
 setFVehicleId(String(matchedTruck.vehicle_id));
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
 const fillingKm = Number(fFillingKm) || 0;

 if (!isUpdate && !fDate) return alert("Please select the fuel date.");
 if (!isUpdate && fillingKm <= 0) return alert("Please enter a valid Filling KM greater than 0.");

 triggerModal(
 isUpdate ? "Update Diesel Record" : "Record Diesel Entry",
 isUpdate
   ? "Update fuel details? The authoritative fuel odometer cannot be changed here."
   : `Issue ${fLitres}L of diesel? This will record the fuel entry and authoritative odometer together.`,
 false,
 isUpdate ? "Update Record" : "Record Diesel",
 async () => {
 setIsProcessing(true);

 try {
   if (isUpdate) {
     // Fuel odometer, vehicle and trip linkage are immutable through normal editing.
     // The RPC updates editable fuel fields and linked trip fuel totals atomically.
     const { error } = await supabase.rpc("update_fuel_atomic", {
       p_fuel_log_id: Number(editLogId),
       p_fuel_date: fDate,
       p_diesel_category: fCategory,
       p_litres_filled: Number(fLitres),
       p_diesel_rate_per_litre: Number(fDieselRate),
       p_total_fuel_cost: cost,
       p_lr_number: fLrNo.toUpperCase().trim() || "SUNDRY",
       p_fuel_station_vendor: null,
       p_remarks: null,
       p_is_tank_full: fIsTankFull
     });

     if (error) {
       alert("Error: " + error.message);
       return;
     }

   } else {
     const { error } = await supabase.rpc("record_fuel_atomic", {
       p_vehicle_id: Number(fVehicleId),
       p_fuel_date: fDate,
       p_diesel_category: fCategory,
       p_litres_filled: Number(fLitres),
       p_diesel_rate_per_litre: Number(fDieselRate),
       p_total_fuel_cost: cost,
       p_filling_odometer_km: fillingKm > 0 ? fillingKm : null,
       p_trip_id: editTripId || null,
       p_lr_number: fLrNo.toUpperCase().trim() || "SUNDRY",
       p_fuel_station_vendor: null,
       p_remarks: null,
       p_is_tank_full: fIsTankFull,
       p_reading_at: new Date().toISOString(),
       p_entered_by: "FuelAdvanceModule"
     });

     if (error) {
       alert("Error: " + error.message);
       return;
     }

     if (activeScanId) {
       await supabase
         .from("pending_scans")
         .update({ status: 'PROCESSED' })
         .eq("scan_id", activeScanId);

       setPendingScans(prev => prev.filter(s => s.scan_id !== activeScanId));
     }
   }

   clearFuelForm();
   await fetchData();
   closeModal();
 } catch (err: any) {
   alert("Unexpected error: " + (err?.message || String(err)));
 } finally {
   setIsProcessing(false);
 }
 }
 );
 };

 const handleDeleteFuel = (id: string) => {
 triggerModal("Delete Fuel Record", "Warning: Permanently delete this fuel log? This action cannot be reversed.", true, "Delete Log", async () => {
 setIsProcessing(true); 
 const { error } = await supabase.rpc("delete_fuel_atomic", {
   p_fuel_log_id: Number(id)
 });
 if (error) alert("Error: " + error.message);
 clearFuelForm(); fetchData();
 setIsProcessing(false); closeModal();
 });
 };

 const clearAdblueForm = () => {
   setAdblueEditId(null);
   setAdblueDate(new Date().toISOString().split('T')[0]);
   setAdblueVehicleId("");
   setAdblueTripId("");
   setAdblueLrNo("");
   setAdblueLitres("");
   setAdblueRate("");
   setAdblueFillingKm("");
   setAdblueCurrentOdometer(null);
   setAdblueFillingKmError("");
   setAdblueVendorId("");
   setAdbluePaymentMode("CASH");
   setAdblueInvoiceNumber("");
   setAdblueDueDate("");
   setAdbluePaymentReference("");
   setAdblueIsTankFull(false);
   setAdblueRemarks("");
 };

 const handleEditAdblue = (log: any) => {
   setFaNav(" AdBlue");
   setAdblueEditId(Number(log.adblue_log_id));
   setAdblueDate(log.adblue_date || "");
   setAdblueVehicleId(String(log.vehicle_id || ""));
   setAdblueTripId(log.trip_id ? String(log.trip_id) : "");
   setAdblueLrNo(log.lr_number || "");
   setAdblueLitres(log.litres_filled ?? "");
   setAdblueRate(log.adblue_rate_per_litre ?? "");
   setAdblueFillingKm(log.filling_odometer_km ?? "");
   setAdblueVendorId(log.vendor_id ? String(log.vendor_id) : "");
   setAdbluePaymentMode("CASH");
   setAdblueInvoiceNumber("");
   setAdblueDueDate("");
   setAdbluePaymentReference("");
   setAdblueIsTankFull(Boolean(log.is_tank_full));
   setAdblueRemarks(log.remarks || "");
   window.scrollTo({ top: 0, behavior: "smooth" });
 };

 const handleSaveAdblue = (e: React.FormEvent) => {
   e.preventDefault();

   const litres = Number(adblueLitres);
   const rate = Number(adblueRate);
   const fillingKm = Number(adblueFillingKm);
   const vendorId = adblueVendorId ? Number(adblueVendorId) : null;
   const tripId = adblueTripId ? Number(adblueTripId) : null;
   const paymentMode = adbluePaymentMode.toUpperCase();

   if (!adblueVehicleId) {
     alert("Please select a truck.");
     return;
   }

   if (!adblueDate) {
     alert("Please select the AdBlue date.");
     return;
   }

   if (!Number.isFinite(litres) || litres <= 0) {
     alert("AdBlue litres must be greater than zero.");
     return;
   }

   if (!Number.isFinite(rate) || rate <= 0) {
     alert("AdBlue rate must be greater than zero.");
     return;
   }

   if (!adblueEditId) {
     if (!Number.isFinite(fillingKm) || fillingKm <= 0) {
       alert("Please enter a valid Filling KM greater than zero.");
       return;
     }

     if (
       adblueCurrentOdometer !== null &&
       fillingKm <= adblueCurrentOdometer
     ) {
       alert(
         `Filling KM must be greater than the authoritative odometer (${adblueCurrentOdometer} km).`
       );
       return;
     }
   }

   if (!adblueEditId && paymentMode === "CREDIT") {
     if (!vendorId) {
       alert("Vendor is required for a credit AdBlue purchase.");
       return;
     }

     if (!adblueInvoiceNumber.trim()) {
       alert("Invoice number is required for a credit AdBlue purchase.");
       return;
     }

     if (!adblueDueDate) {
       alert("Due date is required for a credit AdBlue purchase.");
       return;
     }
   }

   if (adblueEditId && paymentMode === "CREDIT") {
     alert("Payment mode cannot be changed while editing an existing AdBlue record.");
     return;
   }

   const estimatedCost =
     Math.round(litres * rate * 100) / 100;

   triggerModal(
     adblueEditId ? "Update AdBlue Record" : "Record AdBlue Purchase",
     adblueEditId
       ? "Update the editable AdBlue details? Vehicle, trip and authoritative odometer remain protected."
       : paymentMode === "CREDIT"
         ? `Record ${litres} L of AdBlue for ₹${estimatedCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })} on vendor credit?`
         : `Record ${litres} L of AdBlue for ₹${estimatedCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}?`,
     false,
     adblueEditId ? "Update Record" : "Record AdBlue",
     async () => {
       setIsProcessing(true);

       try {
         if (adblueEditId) {
           const { error } = await supabase.rpc(
             "update_adblue_atomic",
             {
               p_adblue_log_id: adblueEditId,
               p_adblue_date: adblueDate,
               p_litres_filled: litres,
               p_adblue_rate_per_litre: rate,
               p_vendor_id: vendorId,
               p_lr_number: adblueLrNo.trim().toUpperCase() || null,
               p_is_tank_full: adblueIsTankFull,
               p_remarks: adblueRemarks.trim() || null
             }
           );

           if (error) {
             alert("Error: " + error.message);
             return;
           }
         } else if (paymentMode === "CREDIT") {
           const { error } = await supabase.rpc(
             "record_adblue_credit_atomic",
             {
               p_vehicle_id: Number(adblueVehicleId),
               p_adblue_date: adblueDate,
               p_litres_filled: litres,
               p_adblue_rate_per_litre: rate,
               p_filling_odometer_km: fillingKm,
               p_vendor_id: vendorId,
               p_trip_id: tripId,
               p_lr_number: adblueLrNo.trim().toUpperCase() || null,
               p_invoice_number: adblueInvoiceNumber.trim() || null,
               p_due_date: adblueDueDate || null,
               p_is_tank_full: adblueIsTankFull,
               p_remarks: adblueRemarks.trim() || null,
               p_created_by: "FuelAdvanceModule",
               p_reading_at: new Date().toISOString()
             }
           );

           if (error) {
             alert("Error: " + error.message);
             return;
           }
         } else {
           const { error } = await supabase.rpc(
             "record_adblue_filling_atomic",
             {
               p_vehicle_id: Number(adblueVehicleId),
               p_adblue_date: adblueDate,
               p_litres_filled: litres,
               p_adblue_rate_per_litre: rate,
               p_filling_odometer_km: fillingKm,
               p_vendor_id: vendorId,
               p_trip_id: tripId,
               p_lr_number: adblueLrNo.trim().toUpperCase() || null,
               p_is_tank_full: adblueIsTankFull,
               p_remarks:
                 [
                   adblueRemarks.trim(),
                   adbluePaymentReference.trim()
                     ? `Payment Ref: ${adbluePaymentReference.trim()}`
                     : ""
                 ]
                   .filter(Boolean)
                   .join(" | ") || null,
               p_reading_at: new Date().toISOString(),
               p_entered_by: "FuelAdvanceModule"
             }
           );

           if (error) {
             alert("Error: " + error.message);
             return;
           }
         }

         clearAdblueForm();
         await fetchData();
         closeModal();
       } catch (err: any) {
         alert(
           "Unexpected error: " +
             (err?.message || String(err))
         );
       } finally {
         setIsProcessing(false);
       }
     }
   );
 };

 const handleDeleteAdblue = (id: number) => {
   triggerModal(
     "Delete AdBlue Record",
     "This can only be deleted when no later authoritative odometer event exists for this truck.",
     true,
     "Delete Record",
     async () => {
       setIsProcessing(true);

       try {
         const { error } = await supabase.rpc(
           "delete_adblue_atomic",
           {
             p_adblue_log_id: Number(id)
           }
         );

         if (error) {
           alert("Error: " + error.message);
           return;
         }

         clearAdblueForm();
         await fetchData();
         closeModal();
       } catch (err: any) {
         alert(
           "Unexpected error: " +
             (err?.message || String(err))
         );
       } finally {
         setIsProcessing(false);
       }
     }
   );
 };

 const filteredRecent = recentFuelLogs.filter(l =>
   (l.vehicles?.vehicle_number || "").toLowerCase().includes(recentSearch.toLowerCase()) ||
   (l.lr_number || "").toLowerCase().includes(recentSearch.toLowerCase())
 );

 return (
 <div className="space-y-6 animate-in fade-in duration-300">
 <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} isDanger={modalConfig.isDanger} confirmText={modalConfig.confirmText} onConfirm={modalConfig.action} onCancel={closeModal} isProcessing={isProcessing} />

 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
 <div>
 <h2 className="text-xl font-semibold text-fg  tracking-tight">Fuel & Mileage</h2>
 <p className="text-xs text-fg-secondary mt-0.5">Record diesel and AdBlue entries with odometer validation.</p>
 </div>
 <div className="flex flex-wrap gap-2">
 {[" Issue Diesel", " AdBlue"].map((tab) => (
 <Button
  key={tab}
  type="button"
  onClick={() => {
   setFaNav(tab);
   if (tab === " Issue Diesel") {
     setShowDieselWorkspace(true);
   }
 }}
  variant={faNav === tab ? "default" : "glass"}
  className={`px-4 py-2.5 rounded-xl text-xs font-bold ${
    faNav === tab
      ? "shadow-orange"
      : "text-fg-secondary hover:text-fg hover:bg-surface-raised/50"
  }`}
>
  {tab}
</Button>
 ))}
 </div>
 </div>

 {faNav === " Issue Diesel" && !showDieselWorkspace && (
 <div className="grid grid-cols-1 gap-6 animate-in slide-in-from-bottom-4">
   <div className="liquid-glass p-6 shadow-xl">
     <h3 className="text-sm font-semibold text-fg">Diesel</h3>
     <p className="mt-1 text-xs text-fg-muted">
       Record a new diesel issue or find an existing diesel entry.
     </p>
     <div className="mt-4 flex flex-wrap gap-3">
       <Button type="button" variant="default" onClick={() => setShowDieselWorkspace(true)}>
         Issue Diesel
       </Button>
       <Button type="button" variant="glass" onClick={() => setShowFuelRecords(true)}>
         Find Existing Diesel Entry
       </Button>
     </div>
   </div>
 </div>
)}

{faNav === " Issue Diesel" && showDieselWorkspace && (
 <Dialog
   open={showDieselWorkspace}
   onOpenChange={(open) => {
     if (!open) {
       setShowDieselWorkspace(false);
       if (!editLogId) clearFuelForm();
     }
   }}
 >
   <DialogContent
     layout="modal"
     size="full"
     className="flex h-[94dvh] max-h-[94dvh] flex-col overflow-hidden p-0"
   >
     <DialogHeader className="px-5 py-4 sm:px-6">
       <DialogTitle className="text-lg">
         {editLogId ? "Edit Diesel Log" : "Record Fuel Bill"}
       </DialogTitle>
       <p className="text-xs text-fg-muted">
         Record diesel with authoritative odometer validation.
       </p>
     </DialogHeader>
     <DialogBody className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
       <div className="mx-auto w-full max-w-[1450px]">
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
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Select Truck *</label><Select value={fVehicleId} onChange={e => setFVehicleId(e.target.value)} className="text-fg font-bold" required disabled={isLoading}><option value="">-- SELECT TRUCK --</option>{vehicles.map(v => <option key={v.vehicle_id} value={String(v.vehicle_id)}>{v.vehicle_number}</option>)}</Select></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Category *</label><Select value={fCategory} onChange={e => setFCategory(e.target.value)} className="text-fg font-semibold"><option value="TRIP_DIESEL">TRIP_DIESEL</option><option value="SUNDRY_DIESEL">SUNDRY_DIESEL</option></Select></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Trip LR No (Optional)</label><Input type="text" maxLength={20} value={fLrNo} onChange={e => setFLrNo(e.target.value.toUpperCase())} placeholder="e.g. 40080069852" className="text-fg font-semibold" /></div>
 
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 <div>
 <label className="block text-[10px] font-bold text-fg-secondary mb-1">Filling KM</label>
 <Input
  type="number"
  min="0"
  max="9999999"
  value={fFillingKm}
  onChange={e => {
   const value = e.target.value === "" ? "" : parseFloat(e.target.value);
   setFFillingKm(value);

   if (editLogId || value === "") {
    setFillingKmError("");
   } else if (Number(value) <= 0) {
    setFillingKmError("Filling KM must be greater than 0.");
   } else if (currentOdometer !== null && Number(value) <= currentOdometer) {
    setFillingKmError(`Enter a Filling KM greater than ${currentOdometer}.`);
   } else {
    setFillingKmError("");
   }
  }}
  placeholder={currentOdometer !== null ? `> ${currentOdometer}` : "0.0"}
  className={`text-fg font-semibold ${fillingKmError ? "border-danger focus:border-danger" : ""}`}
 />
 {currentOdometer !== null && !editLogId && (
  <p className="text-[10px] text-fg-muted mt-1">
   Current authoritative odometer: <span className="font-bold text-fg">{currentOdometer} km</span>
  </p>
 )}
 {fillingKmError && !editLogId && (
  <p className="text-[10px] text-danger font-semibold mt-1">{fillingKmError}</p>
 )}
 </div>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Litres *</label><Input type="number" step="0.1" min="0.1" max="2000" value={fLitres} onChange={e => setFLitres(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.0" className="font-semibold text-accent" required /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Rate () *</label><Input type="number" step="0.1" min="0.1" max="200" value={fDieselRate} onChange={e => setFDieselRate(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.00" className="text-fg font-bold" required /></div>
 </div>

 <div className="flex justify-between items-center kss-surface-raised p-4 rounded-lg border border-border mt-2">
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
   disabled={
    !fVehicleId ||
    Number(fLitres) <= 0 ||
    (!editLogId && (Number(fFillingKm) <= 0 || fillingKmError !== "")) ||
    isProcessing
   }
   className="flex-[2]"
 >
   {editLogId ? "Update Record" : "Record Diesel"}
 </Button>
 </div>
 </form>
 </div>

       </div>
       </div>
     </DialogBody>
   </DialogContent>
 </Dialog>
 )}

 {faNav === " AdBlue" && !showAdblueWorkspace && (
 <div className="space-y-6 animate-in slide-in-from-bottom-4">
   <div className="liquid-glass p-6 shadow-xl">
     <div className="flex flex-col gap-4">
       <div>
         <h3 className="text-sm font-semibold text-fg tracking-wide">
           AdBlue Management
         </h3>
         <p className="text-[10px] text-fg-muted mt-1">
           Record a new AdBlue purchase or find an existing entry.
         </p>
       </div>
       <div className="flex flex-wrap gap-3">
         <Button
           type="button"
           variant="glass"
           onClick={() => setShowAdblueWorkspace(true)}
         >
           AdBlue Filling & Purchase
         </Button>
         <Button
           type="button"
           variant="glass"
           onClick={() => setShowAdblueRecords(true)}
         >
           Find Existing AdBlue Entry
         </Button>
       </div>
     </div>
   </div>
 </div>
)}

{faNav === " AdBlue" && showAdblueWorkspace && (
 <Dialog
   open={showAdblueWorkspace}
   onOpenChange={(open) => {
     if (!open) {
       setShowAdblueWorkspace(false);
       if (!adblueEditId) clearAdblueForm();
     }
   }}
 >
   <DialogContent
     layout="modal"
     size="full"
     className="flex h-[94dvh] max-h-[94dvh] flex-col overflow-hidden p-0"
   >
     <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
       <DialogTitle>
         {adblueEditId ? "Edit AdBlue Record" : "AdBlue Filling & Purchase"}
       </DialogTitle>
       <p className="text-xs text-fg-muted">
         Record AdBlue with authoritative odometer validation.
       </p>
     </DialogHeader>

     <DialogBody className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
       <div className="mx-auto w-full max-w-[1450px]">

   <div className="liquid-glass p-6 shadow-xl">
     <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-border pb-4 mb-6">
       <div>
         <h3 className="text-sm font-semibold text-fg tracking-wide">
           {adblueEditId ? "Edit AdBlue Record" : "AdBlue Filling & Purchase"}
         </h3>
         <p className="text-[10px] text-fg-muted mt-1">
           Authoritative odometer protection is applied before every new filling.
         </p>
       </div>

       {adblueCurrentOdometer !== null && adblueVehicleId && !adblueEditId && (
         <div className="px-3 py-2 rounded-xl border border-accent/30 bg-accent/5">
           <div className="text-[9px] uppercase tracking-wider font-bold text-fg-muted">
             Current authoritative KM
           </div>
           <div className="text-sm font-black text-accent">
             {adblueCurrentOdometer.toLocaleString("en-IN")} km
           </div>
         </div>
       )}
     </div>

     <form onSubmit={handleSaveAdblue} className="space-y-6">

       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

         <div>
           <label className="block text-[10px] font-bold text-fg-secondary mb-1">
             AdBlue Date *
           </label>
           <Input
             type="date"
             value={adblueDate}
             onChange={e => setAdblueDate(e.target.value)}
             className="text-fg font-semibold"
             required
           />
         </div>

         <div>
           <label className="block text-[10px] font-bold text-fg-secondary mb-1">
             Truck *
           </label>
           <Select
             value={adblueVehicleId}
             onChange={e => setAdblueVehicleId(e.target.value)}
             className="text-fg font-bold"
             disabled={!!adblueEditId}
             required
           >
             <option value="">Select Truck</option>
             {vehicles.map(v => (
               <option key={v.vehicle_id} value={v.vehicle_id}>
                 {v.vehicle_number}
               </option>
             ))}
           </Select>
         </div>

         <div>
           <label className="block text-[10px] font-bold text-fg-secondary mb-1">
             Trip ID
           </label>
           <Input
             type="number"
             min="1"
             value={adblueTripId}
             onChange={e => setAdblueTripId(e.target.value)}
             disabled={!!adblueEditId}
             placeholder="Optional"
             className="text-fg font-semibold"
           />
         </div>

         <div>
           <label className="block text-[10px] font-bold text-fg-secondary mb-1">
             LR Number
           </label>
           <Input
             value={adblueLrNo}
             onChange={e => setAdblueLrNo(e.target.value.toUpperCase())}
             placeholder="Optional"
             className="text-fg font-semibold uppercase"
           />
         </div>

       </div>

       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

         <div>
           <label className="block text-[10px] font-bold text-fg-secondary mb-1">
             Filling Odometer KM *
           </label>
           <Input
             type="number"
             min="0"
             step="0.1"
             value={adblueFillingKm}
             onChange={e => {
               const value = e.target.value === "" ? "" : Number(e.target.value);
               setAdblueFillingKm(value);

               if (
                 !adblueEditId &&
                 adblueCurrentOdometer !== null &&
                 value !== "" &&
                 Number(value) <= adblueCurrentOdometer
               ) {
                 setAdblueFillingKmError(
                   `Must be greater than ${adblueCurrentOdometer} km`
                 );
               } else {
                 setAdblueFillingKmError("");
               }
             }}
             disabled={!!adblueEditId}
             placeholder={adblueCurrentOdometer !== null ? String(adblueCurrentOdometer + 1) : "KM"}
             className={`text-fg font-bold ${
               adblueFillingKmError
                 ? "border-danger ring-1 ring-danger/30"
                 : ""
             }`}
             required={!adblueEditId}
           />
           {adblueFillingKmError && (
             <p className="text-[10px] text-danger font-bold mt-1">
               {adblueFillingKmError}
             </p>
           )}
         </div>

         <div>
           <label className="block text-[10px] font-bold text-fg-secondary mb-1">
             AdBlue Litres *
           </label>
           <Input
             type="number"
             min="0.01"
             step="0.01"
             value={adblueLitres}
             onChange={e =>
               setAdblueLitres(
                 e.target.value === "" ? "" : Number(e.target.value)
               )
             }
             placeholder="Litres"
             className="text-fg font-semibold"
             required
           />
         </div>

         <div>
           <label className="block text-[10px] font-bold text-fg-secondary mb-1">
             Rate / Litre *
           </label>
           <Input
             type="number"
             min="0.01"
             step="0.01"
             value={adblueRate}
             onChange={e =>
               setAdblueRate(
                 e.target.value === "" ? "" : Number(e.target.value)
               )
             }
             placeholder="₹ / L"
             className="text-fg font-semibold"
             required
           />
         </div>

         <div>
           <label className="block text-[10px] font-bold text-fg-secondary mb-1">
             Vendor
           </label>
           <Select
             value={adblueVendorId}
             onChange={e => setAdblueVendorId(e.target.value)}
             className="text-fg font-semibold"
           >
             <option value="">No Vendor</option>
             {adblueVendors.map(v => (
               <option key={v.vendor_id} value={v.vendor_id}>
                 {v.vendor_name}
               </option>
             ))}
           </Select>
         </div>

       </div>

       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

         <div>
           <label className="block text-[10px] font-bold text-fg-secondary mb-1">
             Payment Mode *
           </label>
           <Select
             value={adbluePaymentMode}
             onChange={e => setAdbluePaymentMode(e.target.value)}
             disabled={!!adblueEditId}
             className="text-fg font-bold"
           >
             <option value="CASH">CASH</option>
             <option value="UPI">UPI</option>
             <option value="BANK_TRANSFER">BANK TRANSFER</option>
             <option value="CREDIT">CREDIT</option>
           </Select>
         </div>

         {adbluePaymentMode === "CREDIT" && !adblueEditId && (
           <>
             <div>
               <label className="block text-[10px] font-bold text-fg-secondary mb-1">
                 Invoice Number *
               </label>
               <Input
                 value={adblueInvoiceNumber}
                 onChange={e => setAdblueInvoiceNumber(e.target.value)}
                 placeholder="Supplier invoice"
                 className="text-fg font-semibold"
                 required
               />
             </div>

             <div>
               <label className="block text-[10px] font-bold text-fg-secondary mb-1">
                 Due Date *
               </label>
               <Input
                 type="date"
                 value={adblueDueDate}
                 onChange={e => setAdblueDueDate(e.target.value)}
                 className="text-fg font-semibold"
                 required
               />
             </div>
           </>
         )}

         {adbluePaymentMode !== "CREDIT" && !adblueEditId && (
           <div>
             <label className="block text-[10px] font-bold text-fg-secondary mb-1">
               Payment Reference
             </label>
             <Input
               value={adbluePaymentReference}
               onChange={e => setAdbluePaymentReference(e.target.value)}
               placeholder="UPI / bank reference"
               className="text-fg font-semibold"
             />
           </div>
         )}

         <div className="flex items-end">
           <label className="flex items-center gap-2 h-10 px-3 rounded-xl border border-border bg-surface-raised/30 cursor-pointer w-full">
             <input
               type="checkbox"
               checked={adblueIsTankFull}
               onChange={e => setAdblueIsTankFull(e.target.checked)}
               className="accent-accent"
             />
             <span className="text-xs font-bold text-fg">
               Tank Full
             </span>
           </label>
         </div>

       </div>

       <div>
         <label className="block text-[10px] font-bold text-fg-secondary mb-1">
           Remarks
         </label>
         <Input
           value={adblueRemarks}
           onChange={e => setAdblueRemarks(e.target.value)}
           placeholder="Optional remarks"
           className="text-fg font-semibold"
         />
       </div>

       {Number(adblueLitres) > 0 && Number(adblueRate) > 0 && (
         <div className="flex items-center justify-between rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
           <div>
             <div className="text-[9px] uppercase tracking-wider font-bold text-fg-muted">
               Estimated AdBlue Cost
             </div>
             <div className="text-[10px] text-fg-muted">
               Final cost is calculated and validated server-side.
             </div>
           </div>
           <div className="text-lg font-black text-accent">
             ₹{(Number(adblueLitres) * Number(adblueRate)).toLocaleString("en-IN", {
               minimumFractionDigits: 2,
               maximumFractionDigits: 2
             })}
           </div>
         </div>
       )}

       <div className="flex flex-wrap justify-end gap-3">
         {adblueEditId && (
           <Button
             type="button"
             variant="glass"
             onClick={clearAdblueForm}
             disabled={isProcessing}
           >
             Cancel Edit
           </Button>
         )}

         <Button
           type="submit"
           disabled={
             isProcessing ||
             Boolean(
               !adblueEditId &&
               adblueFillingKmError
             )
           }
           className="px-6"
         >
           {isProcessing
             ? "Processing..."
             : adblueEditId
               ? "Update AdBlue"
               : "Record AdBlue"}
         </Button>
       </div>

     </form>
   </div>

       </div>
     </DialogBody>
   </DialogContent>
 </Dialog>
 )}


 <Dialog
   open={showFuelRecords}
   onOpenChange={(open) => {
     if (!open) setShowFuelRecords(false);
   }}
 >
   <DialogContent
     layout="modal"
     size="lg"
     className="flex max-h-[88dvh] flex-col overflow-hidden p-0"
   >
     <DialogHeader className="px-5 py-4 sm:px-6">
       <DialogTitle className="text-lg">Find Existing Diesel Entry</DialogTitle>
       <p className="text-xs text-fg-muted">
         Select a record to edit it, or use its delete action.
       </p>
     </DialogHeader>

     <DialogBody className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
       <Input
         value={recentSearch}
         onChange={e => setRecentSearch(e.target.value)}
         placeholder="Search truck or LR number"
         className="mb-4 text-fg font-semibold"
       />

       <div className="overflow-auto rounded-xl border border-border">
         <Table className="min-w-full whitespace-nowrap">
           <TableHeader>
             <TableRow>
               <TableHead>Date</TableHead>
               <TableHead>Truck</TableHead>
               <TableHead>Category / LR</TableHead>
               <TableHead className="text-right">Litres</TableHead>
               <TableHead className="text-right">Cost</TableHead>
               <TableHead className="text-right">Actions</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>
             {filteredRecent.map(log => (
               <TableRow key={log.fuel_log_id}>
                 <TableCell>{formatDate(log.fuel_date)}</TableCell>
                 <TableCell>{log.vehicles?.vehicle_number}</TableCell>
                 <TableCell>
                   {log.diesel_category}
                   <br />
                   <span className="text-[9px] text-fg-muted">{log.lr_number}</span>
                 </TableCell>
                 <TableCell className="text-right">{log.litres_filled} L</TableCell>
                 <TableCell className="text-right">
                   {(log.total_fuel_cost || 0).toLocaleString("en-IN", {
                     minimumFractionDigits: 2
                   })}
                 </TableCell>
                 <TableCell className="text-right">
                   <div className="flex justify-end gap-2">
                     <Button
                       type="button"
                       variant="glass"
                       onClick={() => {
                         handleEditClick(log);
                         setShowFuelRecords(false);
                       }}
                     >
                       Edit
                     </Button>
                     <Button
                       type="button"
                       variant="glass"
                       className="text-danger"
                       disabled={isProcessing}
                       onClick={() => handleDeleteFuel(String(log.fuel_log_id))}
                     >
                       Delete
                     </Button>
                   </div>
                 </TableCell>
               </TableRow>
             ))}
             {filteredRecent.length === 0 && (
               <TableRow>
                 <TableCell colSpan={6} className="p-8 text-center text-fg-muted">
                   No diesel entries found.
                 </TableCell>
               </TableRow>
             )}
           </TableBody>
         </Table>
       </div>
     </DialogBody>
   </DialogContent>
 </Dialog>

 <Dialog
   open={showAdblueRecords}
   onOpenChange={(open) => {
     if (!open) setShowAdblueRecords(false);
   }}
 >
   <DialogContent
     layout="modal"
     size="lg"
     className="flex max-h-[88dvh] flex-col overflow-hidden p-0"
   >
     <DialogHeader className="px-5 py-4 sm:px-6">
       <DialogTitle className="text-lg">Find Existing AdBlue Entry</DialogTitle>
       <p className="text-xs text-fg-muted">
         Select a record to edit it, or use its delete action.
       </p>
     </DialogHeader>

     <DialogBody className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
       <Input
         value={adblueSearch}
         onChange={e => setAdblueSearch(e.target.value)}
         placeholder="Search truck, LR or vendor"
         className="mb-4 text-fg font-semibold"
       />

       <div className="overflow-auto rounded-xl border border-border">
         <Table className="min-w-full whitespace-nowrap">
           <TableHeader>
             <TableRow>
               <TableHead>Date</TableHead>
               <TableHead>Truck</TableHead>
               <TableHead>LR / Vendor</TableHead>
               <TableHead className="text-right">Litres</TableHead>
               <TableHead className="text-right">Cost</TableHead>
               <TableHead className="text-right">Actions</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>
             {adblueLogs.filter(log => {
               const q = adblueSearch.trim().toLowerCase();
               return !q || [
                 log.adblue_date,
                 log.vehicles?.vehicle_number,
                 log.lr_number,
                 log.vendors?.vendor_name,
                 log.remarks
               ].filter(Boolean).some(value =>
                 String(value).toLowerCase().includes(q)
               );
             }).map(log => (
               <TableRow key={log.adblue_log_id}>
                 <TableCell>{log.adblue_date}</TableCell>
                 <TableCell>{log.vehicles?.vehicle_number || "—"}</TableCell>
                 <TableCell>
                   {log.lr_number || "—"}
                   <br />
                   <span className="text-[9px] text-fg-muted">
                     {log.vendors?.vendor_name || log.adblue_vendor || "No vendor"}
                   </span>
                 </TableCell>
                 <TableCell className="text-right">
                   {Number(log.litres_filled || 0).toFixed(2)} L
                 </TableCell>
                 <TableCell className="text-right">
                   ₹{Number(log.total_adblue_cost || 0).toLocaleString("en-IN", {
                     minimumFractionDigits: 2
                   })}
                 </TableCell>
                 <TableCell className="text-right">
                   <div className="flex justify-end gap-2">
                     <Button
                       type="button"
                       variant="glass"
                       onClick={() => {
                         handleEditAdblue(log);
                         setShowAdblueRecords(false);
                       }}
                     >
                       Edit
                     </Button>
                     <Button
                       type="button"
                       variant="glass"
                       className="text-danger"
                       disabled={isProcessing}
                       onClick={() => handleDeleteAdblue(Number(log.adblue_log_id))}
                     >
                       Delete
                     </Button>
                   </div>
                 </TableCell>
               </TableRow>
             ))}
           </TableBody>
         </Table>
       </div>
     </DialogBody>
   </DialogContent>
 </Dialog>

 </div>
 );
}
