"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export function WorkshopModule() {
 const supabase = createClient();
 const [wTab, setWTab] = useState("Tyre Management");
 const [vehicles, setVehicles] = useState<any[]>([]);
 const [vendors, setVendors] = useState<any[]>([]);
 const [isProcessing, setIsProcessing] = useState(false);

 // Modals
 const [modalConfig, setModalConfig] = useState({ isOpen: false, title: "", message: "", isDanger: false, confirmText: "Confirm", action: async () => {} });
 const triggerModal = (title: string, message: string, isDanger: boolean, confirmText: string, action: () => Promise<void>) => setModalConfig({ isOpen: true, title, message, isDanger, confirmText, action });
 const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

 // Lifecycle Action Modal
 const [actionModal, setActionModal] = useState({ isOpen: false, tyre: null as any, mode: "" });
 const [actionOdo, setActionOdo] = useState<number|"">("");
 const [actionNsd, setActionNsd] = useState<number|"">("");
 const [actionTruckId, setActionTruckId] = useState("");
 const [actionPos, setActionPos] = useState("FRONT_LEFT");
 const [actionVendorId, setActionVendorId] = useState("");
 const [actionAmount, setActionAmount] = useState<number | "">("");
 const [actionRecoveryAmount, setActionRecoveryAmount] = useState<number | "">(0);
 const [actionResult, setActionResult] = useState<"RETREAD_RETURNED" | "RETREAD_REJECTED">("RETREAD_RETURNED");
 const [actionDisposition, setActionDisposition] = useState<"IN_STORE" | "MOUNTED">("IN_STORE");
 const [actionBuyerVendorId, setActionBuyerVendorId] = useState("");

 // Registration States
 const [regMode, setRegMode] = useState("IN_STORE");
 const [truckId, setTruckId] = useState("");
 const [serialNo, setSerialNo] = useState("");
 const [brand, setBrand] = useState("");
 const [position, setPosition] = useState("FRONT_LEFT");
 const [condition, setCondition] = useState("NEW");
 const [nsdMm, setNsdMm] = useState<number | "">(15.0);
 const [mountOdo, setMountOdo] = useState<number | "">("");
 const [purchaseVendorId, setPurchaseVendorId] = useState("");
 const [purchaseUnitAmount, setPurchaseUnitAmount] = useState<number | "">(0);

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
 const { data: vData } = await supabase.from('vehicles').select('*').order('vehicle_number');
 if (vData) setVehicles(vData);

 const { data: vendorData } = await supabase
   .from('vendors')
   .select('*')
   .eq('is_active', true)
   .order('vendor_name');
 if (vendorData) setVendors(vendorData);

 const { data: tData } = await supabase.from('fleet_tyres').select('*, vehicles(vehicle_number)').order('recorded_date', { ascending: false });
 if (tData) setActiveTyres(tData);

 const { data: bData } = await supabase.from('workshop_spares_bills').select('*, vehicles(vehicle_number)').order('bill_date', { ascending: false });
 if (bData) setActiveBills(bData);
 };

 useEffect(() => { fetchData(); }, []);


 const getWheelPositions = (vehicle: any) => {
   if (!vehicle) return [];

   const capacity = Number(vehicle.carrying_capacity_tons);
   const type = String(vehicle.truck_type || "").toLowerCase();

   const positions = [
     "FRONT_LEFT",
     "FRONT_RIGHT",
   ];

   if (capacity === 25 && type.includes("bags")) {
     positions.push("AXLE2_LEFT", "AXLE2_RIGHT");
   } else if (capacity === 25 && type.includes("bulk")) {
     positions.push("LIFT_LEFT", "LIFT_RIGHT");
   } else if (capacity === 30) {
     positions.push(
       "AXLE2_LEFT",
       "AXLE2_RIGHT",
       "LIFT_LEFT",
       "LIFT_RIGHT"
     );
   } else if (capacity === 35 && type.includes("bulk")) {
     positions.push(
       "AXLE2_LEFT",
       "AXLE2_RIGHT",
       "LIFT_LEFT_INNER",
       "LIFT_LEFT_OUTER",
       "LIFT_RIGHT_INNER",
       "LIFT_RIGHT_OUTER"
     );
   }

   positions.push(
     "DRIVE_LEFT_OUTER",
     "DRIVE_LEFT_INNER",
     "DRIVE_RIGHT_INNER",
     "DRIVE_RIGHT_OUTER",
     "DUMMY_LEFT_OUTER",
     "DUMMY_LEFT_INNER",
     "DUMMY_RIGHT_INNER",
     "DUMMY_RIGHT_OUTER",
     "STEPNEY"
   );

   return positions;
 };

 const getPositionLabel = (positionName: string) => {
   const labels: Record<string, string> = {
     FRONT_LEFT: "Front — Left",
     FRONT_RIGHT: "Front — Right",
     AXLE2_LEFT: "2nd Axle — Left",
     AXLE2_RIGHT: "2nd Axle — Right",
     LIFT_LEFT: "Lift Axle — Left",
     LIFT_RIGHT: "Lift Axle — Right",
     LIFT_LEFT_INNER: "Lift Axle — Left Inner",
     LIFT_LEFT_OUTER: "Lift Axle — Left Outer",
     LIFT_RIGHT_INNER: "Lift Axle — Right Inner",
     LIFT_RIGHT_OUTER: "Lift Axle — Right Outer",
     DRIVE_LEFT_OUTER: "Drive — Left Outer",
     DRIVE_LEFT_INNER: "Drive — Left Inner",
     DRIVE_RIGHT_INNER: "Drive — Right Inner",
     DRIVE_RIGHT_OUTER: "Drive — Right Outer",
     DUMMY_LEFT_OUTER: "Dummy — Left Outer",
     DUMMY_LEFT_INNER: "Dummy — Left Inner",
     DUMMY_RIGHT_INNER: "Dummy — Right Inner",
     DUMMY_RIGHT_OUTER: "Dummy — Right Outer",
     STEPNEY: "Stepney — Spare",
   };

   return labels[positionName] || positionName;
 };

 const getVendorsByType = (...types: string[]) =>
   vendors.filter(v => types.includes(v.vendor_type));

 const getTyreVendors = () =>
   getVendorsByType("TYRE", "GENERAL");

 const getRetreadVendors = () =>
   getVendorsByType("RETREAD", "TYRE", "GENERAL");

 // --- 1. REGISTER NEW TYRE ---
 const handleRegisterTyre = (e: React.FormEvent) => {
 e.preventDefault();

 if (!serialNo.trim()) return alert("Serial Number is required.");
 if (!purchaseVendorId) return alert("Tyre purchase vendor is required.");

 const unitAmount = Number(purchaseUnitAmount) || 0;

 if (unitAmount < 0) {
   return alert("Purchase amount cannot be negative.");
 }

 const selectedVehicle =
   regMode === "MOUNTED"
     ? vehicles.find(v => String(v.vehicle_id) === String(truckId))
     : null;

 if (regMode === "MOUNTED") {
   if (!selectedVehicle || !mountOdo) {
     return alert("Truck and mounting odometer are required.");
   }

   if (!getWheelPositions(selectedVehicle).includes(position)) {
     return alert("Selected wheel position is not valid for this truck.");
   }
 }

 triggerModal(
   "Register Tyre",
   `Purchase ${serialNo.toUpperCase()} from the selected vendor and ${
     regMode === "IN_STORE" ? "place it in inventory" : "mount it directly to the selected truck"
   }?`,
   false,
   "Register",
   async () => {
     setIsProcessing(true);

     try {
       const { error } = await supabase.rpc("create_tyre_purchase_atomic", {
         p_vendor_id: Number(purchaseVendorId),
         p_bill_date: new Date().toISOString().split("T")[0],
         p_invoice_number: null,
         p_invoice_date: null,
         p_subtotal_amount: unitAmount,
         p_tax_amount: 0,
         p_total_bill_amount: unitAmount,
         p_remarks: "Tyre purchase",
         p_created_by: "WorkshopModule",
         p_items: [{
           serial_number: serialNo.toUpperCase().trim(),
           brand_model: brand.toUpperCase().trim() || null,
           tyre_type: null,
           condition_status: condition,
           initial_status: regMode,
           placement_position: regMode === "MOUNTED" ? position : null,
           vehicle_id: regMode === "MOUNTED" ? Number(truckId) : null,
           nsd_measurement: Number(nsdMm) || 0,
           unit_amount: unitAmount,
           mount_odo: regMode === "MOUNTED" ? Number(mountOdo) : null,
           reason: "Initial tyre purchase",
         }],
       });

       if (error) {
         alert("Failed to register tyre: " + error.message);
         return;
       }

       alert("Tyre registered successfully.");

       setSerialNo("");
       setBrand("");
       setMountOdo("");
       setPurchaseUnitAmount(0);
       fetchData();
       closeModal();
     } catch (err: any) {
       alert("Database Error: " + err.message);
     } finally {
       setIsProcessing(false);
     }
   }
 );
 };

 // --- 2. EXECUTE LIFECYCLE ACTION ---
 const executeLifecycleAction = async () => {
   setIsProcessing(true);
   const t = actionModal.tyre;

   try {
     if (!t?.tyre_id) {
       throw new Error("No tyre selected.");
     }

     let error: any = null;

     if (actionModal.mode === "UNMOUNT") {
       if (!actionOdo || Number(actionOdo) <= 0) {
         throw new Error("Valid unmount odometer is required.");
       }

       const result = await supabase.rpc("unmount_tyre_to_store_atomic", {
         p_tyre_id: Number(t.tyre_id),
         p_unmount_odo: Number(actionOdo),
         p_nsd_measurement:
           actionNsd === "" ? null : Number(actionNsd),
         p_event_date: new Date().toISOString().split("T")[0],
         p_reason: "Tyre unmounted to store",
         p_created_by: "WorkshopModule",
       });

       error = result.error;
     }

     else if (actionModal.mode === "MOUNT") {
       if (!actionTruckId || !actionOdo) {
         throw new Error("Truck and mounting odometer are required.");
       }

       const selectedVehicle = vehicles.find(
         v => String(v.vehicle_id) === String(actionTruckId)
       );

       if (!selectedVehicle) {
         throw new Error("Selected vehicle was not found.");
       }

       if (!getWheelPositions(selectedVehicle).includes(actionPos)) {
         throw new Error("Selected wheel position is not valid for this truck.");
       }

       const result = await supabase.rpc("mount_tyre_atomic", {
         p_tyre_id: Number(t.tyre_id),
         p_vehicle_id: Number(actionTruckId),
         p_placement_position: actionPos,
         p_mount_odo: Number(actionOdo),
         p_event_date: new Date().toISOString().split("T")[0],
         p_reason: "Tyre mounted from store",
         p_created_by: "WorkshopModule",
       });

       error = result.error;
     }

     else if (actionModal.mode === "SEND_RETREAD") {
       if (!actionVendorId) {
         throw new Error("Retread vendor is required.");
       }

       if (!actionOdo) {
         throw new Error("Vehicle odometer at retread removal is required.");
       }

       const result = await supabase.rpc("send_tyre_for_retread_atomic", {
         p_tyre_id: Number(t.tyre_id),
         p_vendor_id: Number(actionVendorId),
         p_odometer_km: Number(actionOdo),
         p_nsd_measurement:
           actionNsd === "" ? null : Number(actionNsd),
         p_event_date: new Date().toISOString().split("T")[0],
         p_invoice_number: null,
         p_reason: "Sent for retreading",
         p_created_by: "WorkshopModule",
       });

       error = result.error;
     }

     else if (actionModal.mode === "RECEIVE_RETREAD") {
       if (!actionVendorId) {
         throw new Error("Retread vendor is required.");
       }

       const isMounted = actionDisposition === "MOUNTED";
       const isRejected = actionResult === "RETREAD_REJECTED";

       let selectedVehicle = null as any;

       if (isMounted) {
         if (!actionTruckId) {
           throw new Error("Truck is required when mounting the returned tyre.");
         }

         if (!actionOdo || Number(actionOdo) <= 0) {
           throw new Error("Valid mounting odometer is required.");
         }

         selectedVehicle = vehicles.find(
           v => String(v.vehicle_id) === String(actionTruckId)
         );

         if (!selectedVehicle) {
           throw new Error("Selected vehicle was not found.");
         }

         const allowedPositions = getWheelPositions(selectedVehicle);

         if (!allowedPositions.includes(actionPos)) {
           throw new Error("Selected wheel position is not valid for this truck.");
         }

         if (isRejected && !actionPos.startsWith("LIFT_")) {
           throw new Error(
             "A retread-rejected tyre can only be refitted to a lift axle."
           );
         }
       }

       const result = await supabase.rpc("complete_tyre_retread_atomic", {
         p_tyre_id: Number(t.tyre_id),
         p_result: actionResult,
         p_vendor_id: Number(actionVendorId),
         p_result_date: new Date().toISOString().split("T")[0],
         p_returned_nsd_measurement:
           actionNsd === "" ? null : Number(actionNsd),
         p_disposition: actionDisposition,
         p_vehicle_id: isMounted ? Number(actionTruckId) : null,
         p_placement_position: isMounted ? actionPos : null,
         p_mount_odo: isMounted ? Number(actionOdo) : null,
         p_retread_amount: Number(actionAmount) || 0,
         p_invoice_number: null,
         p_reason: isRejected
           ? (
               isMounted
                 ? "Retread vendor rejected casing; refitted on lift axle"
                 : "Retread vendor rejected casing; retained in store"
             )
           : (
               isMounted
                 ? "Retread completed; tyre refitted"
                 : "Retread completed; tyre returned to store"
             ),
         p_created_by: "WorkshopModule",
       });

       error = result.error;
     }

     else if (actionModal.mode === "BURST_TYRE") {
       if (!actionOdo || Number(actionOdo) <= 0) {
         throw new Error("Valid burst odometer is required.");
       }

       if (Number(actionRecoveryAmount) < 0) {
         throw new Error("Recovery amount cannot be negative.");
       }

       if (Number(actionRecoveryAmount) > 0 && !actionBuyerVendorId) {
         throw new Error("Buyer / recovery vendor is required when recovery amount is entered.");
       }

       const result = await supabase.rpc("dispose_tyre_atomic", {
         p_tyre_id: Number(t.tyre_id),
         p_disposition: "BURST",
         p_event_date: new Date().toISOString().split("T")[0],
         p_odometer_km: Number(actionOdo),
         p_recovery_amount: Number(actionRecoveryAmount) || 0,
         p_buyer_vendor_id: actionBuyerVendorId
           ? Number(actionBuyerVendorId)
           : null,
         p_invoice_number: null,
         p_reason: "Tyre burst during operation",
         p_created_by: "WorkshopModule",
       });

       error = result.error;
     }

     else if (actionModal.mode === "SCRAP_FROM_STORE") {
       const result = await supabase.rpc("dispose_tyre_atomic", {
         p_tyre_id: Number(t.tyre_id),
         p_disposition: "SCRAPPED",
         p_event_date: new Date().toISOString().split("T")[0],
         p_odometer_km: null,
         p_recovery_amount: Number(actionRecoveryAmount) || 0,
         p_buyer_vendor_id: actionBuyerVendorId
           ? Number(actionBuyerVendorId)
           : null,
         p_invoice_number: null,
         p_reason: "Tyre scrapped from store",
         p_created_by: "WorkshopModule",
       });

       error = result.error;
     }

     if (error) {
       throw new Error(error.message);
     }

     alert("Tyre lifecycle action completed successfully.");

     setActionModal({ isOpen: false, tyre: null, mode: "" });
     setActionOdo("");
     setActionNsd("");
     setActionTruckId("");
     setActionVendorId("");
     setActionAmount("");
     setActionRecoveryAmount(0);
     setActionBuyerVendorId("");
     fetchData();
   } catch (err: any) {
     alert("Database Error: " + err.message);
   } finally {
     setIsProcessing(false);
   }
 };

 const handleSaveBill = (e: React.FormEvent) => {
 e.preventDefault();
 if (!wsTruckId || !vendor.trim() || Number(amount) <= 0) return alert("Invalid inputs.");
 triggerModal("Record Service Bill", `Log ${amount} expense from ${vendor}?`, false, "Save Bill", async () => {
 setIsProcessing(true);
   const { error: billError } = await supabase.rpc("create_workshop_bill_atomic", {
   p_bill_date: billDate,
   p_vehicle_id: Number(wsTruckId),
   p_vendor_name: vendor.trim(),
   p_invoice_number: null,
   p_spare_parts_details: description.trim() || "Workshop Service",
   p_total_bill_amount: Number(amount),
 });
 if (billError) alert("Failed to save bill: " + billError.message);
 else { alert("Service bill recorded successfully!"); setVendor(""); setDescription(""); setAmount(""); fetchData(); }
 setIsProcessing(false); closeModal();
 });
 };

 // --- FILTER & EXPORT LOGIC ---
 const mountedTyres = activeTyres.filter(t => t.tyre_status === 'MOUNTED' || (!t.tyre_status && t.vehicle_id));
 const storeTyres = activeTyres.filter(t =>
   t.tyre_status === 'IN_STORE' ||
   t.tyre_status === 'RETREADING' ||
   t.tyre_status === 'REJECTED' ||
   (!t.tyre_status && !t.vehicle_id)
 );
 const scrapTyres = activeTyres.filter(t => t.tyre_status === 'SCRAPPED');

 const filteredMounted = mountedTyres.filter(t => (t.serial_number || "").toLowerCase().includes(mountedSearch.toLowerCase()) || (t.vehicles?.vehicle_number || "").toLowerCase().includes(mountedSearch.toLowerCase()));
 const exportMounted = filteredMounted.map(t => ({ "Truck": t.vehicles?.vehicle_number || "-", "Serial": t.serial_number, "Brand": t.brand_model, "Position": t.placement_position, "Mounted Date": formatDate(t.recorded_date), "Current KM Run": t.total_km_run || 0 }));

 const filteredStore = storeTyres.filter(t => (t.serial_number || "").toLowerCase().includes(storeSearch.toLowerCase()) || (t.brand_model || "").toLowerCase().includes(storeSearch.toLowerCase()));
 const exportStore = filteredStore.map(t => ({ "Serial": t.serial_number, "Brand": t.brand_model, "Status": t.tyre_status || "IN_STORE", "Condition": t.condition_status, "Total Lifetime KM": t.total_km_run || 0 }));

 const filteredScrap = scrapTyres.filter(t => (t.serial_number || "").toLowerCase().includes(scrapSearch.toLowerCase()));
 const exportScrap = filteredScrap.map(t => ({ "Serial": t.serial_number, "Brand": t.brand_model, "Status": t.tyre_status, "Total Lifetime KM": t.total_km_run || 0 }));

 const filteredBills = activeBills.filter(b => (b.vendor_name || "").toLowerCase().includes(billsSearch.toLowerCase()) || (b.vehicles?.vehicle_number || "").toLowerCase().includes(billsSearch.toLowerCase()));
 const exportBills = filteredBills.map(b => ({ "Date": formatDate(b.bill_date), "Truck": b.vehicles?.vehicle_number || "GENERAL", "Vendor": b.vendor_name, "Description": b.spare_parts_details, "Amount (INR)": b.total_bill_amount }));

 return (
 <div className="animate-tab-focus space-y-6 animate-in fade-in duration-300 text-fg">
 <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} isDanger={modalConfig.isDanger} confirmText={modalConfig.confirmText} onConfirm={modalConfig.action} onCancel={closeModal} isProcessing={isProcessing} />

 {/* CUSTOM LIFECYCLE MODAL */}
 {actionModal.isOpen && (
 <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl animate-in fade-in">
 <div className="liquid-glass shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
 <div className="flex justify-between items-center mb-5 border-b border-border pb-3">
 <h3 className="text-lg font-semibold text-fg  tracking-tight">
 {actionModal.mode === "UNMOUNT" && "Unmount Tyre"}
 {actionModal.mode === "MOUNT" && "Mount to Truck"}
 {actionModal.mode === "RECEIVE_RETREAD" && "Receive from Retread"}
 {actionModal.mode === "BURST_TYRE" && "Record Tyre Burst"}
 {actionModal.mode === "SCRAP_FROM_STORE" && "Dispose Tyre"}
 </h3>
 <Button type="button" variant="ghost" onClick={() => setActionModal({ isOpen: false, tyre: null, mode: "" })} className="text-fg-muted hover:text-danger font-bold transition-colors"></Button>
 </div>

 <div className="kss-surface-raised p-4 rounded-lg border border-border mb-5">
 <p className="text-xs font-bold text-fg-muted ">Selected Tyre</p>
 <p className="text-sm font-semibold text-accent">{actionModal.tyre?.serial_number} <span className="text-fg-secondary font-semibold ml-2">({actionModal.tyre?.brand_model})</span></p>
 </div>

 <div className="space-y-4">
 {actionModal.mode === "UNMOUNT" && (
 <>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Truck Odo at Unmount (KM) *</label><Input type="number" min="0" value={actionOdo} onChange={e=>setActionOdo(parseFloat(e.target.value))} className="input-glass" placeholder={`Was mounted at ${actionModal.tyre?.last_mount_odo || 0} KM`} /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Current NSD (mm)</label><Input type="number" step="0.1" min="0" max="30" value={actionNsd} onChange={e=>setActionNsd(parseFloat(e.target.value))} className="input-glass" placeholder={`${actionModal.tyre?.nsd_measurement || 0} mm`} /></div>
 <div>
 <div className="text-[10px] font-bold text-fg-secondary mb-1">Next Destination</div>
 <div className="px-3 py-2 rounded-md border border-border bg-surface-raised text-xs text-fg">
   Store / Inventory
 </div>
 <p className="text-[9px] text-fg-muted mt-1">
   Retreading or disposal must be recorded as a separate lifecycle event.
 </p>
</div>
 </>
 )}
 {actionModal.mode === "MOUNT" && (
 <>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Assign to Truck *</label><Select value={actionTruckId} onChange={e=>{ setActionTruckId(e.target.value); setActionPos(""); }} className="input-glass"><option value="">-- SELECT TRUCK --</option>{vehicles.map(v => <option key={v.vehicle_id} value={String(v.vehicle_id)}>{v.vehicle_number}</option>)}</Select></div>
 <div>
<label className="block text-[10px] font-bold text-fg-secondary mb-1">Position *</label>
<Select
 value={actionPos}
 onChange={e=>setActionPos(e.target.value)}
 className="input-glass"
>
 <option value="">-- SELECT POSITION --</option>
 {(vehicles.find(v => String(v.vehicle_id) === String(actionTruckId))
   ? getWheelPositions(vehicles.find(v => String(v.vehicle_id) === String(actionTruckId)))
   : []
 ).map(pos => (
   <option key={pos} value={pos}>{getPositionLabel(pos)}</option>
 ))}
</Select>
</div>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Truck Odo at Mount (KM) *</label><Input type="number" min="0" value={actionOdo} onChange={e=>setActionOdo(parseFloat(e.target.value))} className="input-glass" placeholder="0" /></div>
 </>
 )}
 {actionModal.mode === "SEND_RETREAD" && (
 <>
 <div>
  <label className="block text-[10px] font-bold text-fg-secondary mb-1">Retread Vendor *</label>
  <Select value={actionVendorId} onChange={e=>setActionVendorId(e.target.value)} className="input-glass">
   <option value="">-- SELECT RETREAD VENDOR --</option>
   {getRetreadVendors().map(v => <option key={v.vendor_id} value={String(v.vendor_id)}>{v.vendor_name}</option>)}
  </Select>
 </div>
 <div>
  <label className="block text-[10px] font-bold text-fg-secondary mb-1">Truck Odo at Removal (KM) *</label>
  <Input type="number" min="1" value={actionOdo} onChange={e=>setActionOdo(e.target.value === "" ? "" : parseFloat(e.target.value))} className="input-glass" />
 </div>
 <div>
  <label className="block text-[10px] font-bold text-fg-secondary mb-1">Current NSD (mm)</label>
  <Input type="number" step="0.1" min="0" max="30" value={actionNsd} onChange={e=>setActionNsd(e.target.value === "" ? "" : parseFloat(e.target.value))} className="input-glass" />
 </div>
 </>
 )}

 {actionModal.mode === "RECEIVE_RETREAD" && (
 <>
 <div>
  <label className="block text-[10px] font-bold text-fg-secondary mb-1">Retread Vendor *</label>
  <Select value={actionVendorId} onChange={e=>setActionVendorId(e.target.value)} className="input-glass">
   <option value="">-- SELECT RETREAD VENDOR --</option>
   {getRetreadVendors().map(v => <option key={v.vendor_id} value={String(v.vendor_id)}>{v.vendor_name}</option>)}
  </Select>
 </div>

 <div>
  <label className="block text-[10px] font-bold text-fg-secondary mb-1">Retread Result *</label>
  <Select
   value={actionResult}
   onChange={e => {
     const value = e.target.value as "RETREAD_RETURNED" | "RETREAD_REJECTED";
     setActionResult(value);
     if (value === "RETREAD_REJECTED") {
       setActionPos("");
     }
   }}
   className="input-glass"
  >
   <option value="RETREAD_RETURNED">Returned / Accepted</option>
   <option value="RETREAD_REJECTED">Rejected by Retread Vendor</option>
  </Select>
 </div>

 <div>
  <label className="block text-[10px] font-bold text-fg-secondary mb-1">After Receiving *</label>
  <Select
   value={actionDisposition}
   onChange={e => {
     setActionDisposition(e.target.value as "IN_STORE" | "MOUNTED");
     setActionTruckId("");
     setActionPos("");
     setActionOdo("");
   }}
   className="input-glass"
  >
   <option value="IN_STORE">Keep in Store</option>
   <option value="MOUNTED">Mount on Truck</option>
  </Select>
 </div>

 {actionDisposition === "MOUNTED" && (
  <>
   <div>
    <label className="block text-[10px] font-bold text-fg-secondary mb-1">Assign to Truck *</label>
    <Select
     value={actionTruckId}
     onChange={e => {
       setActionTruckId(e.target.value);
       setActionPos("");
      }}
     className="input-glass"
    >
     <option value="">-- SELECT TRUCK --</option>
     {vehicles.map(v => (
      <option key={v.vehicle_id} value={String(v.vehicle_id)}>
       {v.vehicle_number}
      </option>
     ))}
    </Select>
   </div>

   <div>
    <label className="block text-[10px] font-bold text-fg-secondary mb-1">
     Position *
    </label>
    <Select
     value={actionPos}
     onChange={e => setActionPos(e.target.value)}
     className="input-glass"
    >
     <option value="">-- SELECT POSITION --</option>
     {(vehicles.find(v => String(v.vehicle_id) === String(actionTruckId))
       ? getWheelPositions(
           vehicles.find(v => String(v.vehicle_id) === String(actionTruckId))
         ).filter(pos =>
           actionResult === "RETREAD_REJECTED"
             ? pos.startsWith("LIFT_")
             : true
         )
       : []
     ).map(pos => (
      <option key={pos} value={pos}>
       {getPositionLabel(pos)}
      </option>
     ))}
    </Select>
    {actionResult === "RETREAD_REJECTED" && (
     <p className="text-[9px] text-warning mt-1">
      Rejected retread tyres may only be refitted to lift axle positions.
     </p>
    )}
   </div>

   <div>
    <label className="block text-[10px] font-bold text-fg-secondary mb-1">
     Truck Odo at Mount (KM) *
    </label>
    <Input
     type="number"
     min="1"
     value={actionOdo}
     onChange={e =>
       setActionOdo(
         e.target.value === "" ? "" : parseFloat(e.target.value)
       )
     }
     className="input-glass"
     placeholder="0"
    />
   </div>
  </>
 )}

 <div>
  <label className="block text-[10px] font-bold text-fg-secondary mb-1">
   Returned NSD (mm)
  </label>
  <Input
   type="number"
   step="0.1"
   min="0"
   max="30"
   value={actionNsd}
   onChange={e =>
     setActionNsd(
       e.target.value === "" ? "" : parseFloat(e.target.value)
     )
   }
   className="input-glass"
  />
 </div>

 <div>
  <label className="block text-[10px] font-bold text-fg-secondary mb-1">
   Retread Bill Amount
  </label>
  <Input
   type="number"
   min="0"
   step="0.01"
   value={actionAmount}
   onChange={e =>
     setActionAmount(
       e.target.value === "" ? "" : parseFloat(e.target.value)
     )
   }
   className="input-glass"
  />
 </div>
 </>
 )}
 {actionModal.mode === "BURST_TYRE" && (
 <>
 <div className="p-3 rounded-lg border border-danger/30 bg-danger/5">
  <p className="text-xs font-bold text-danger">Burst Tyre</p>
  <p className="text-[10px] text-fg-secondary mt-1">
   This will remove the tyre from the vehicle and record it as BURST.
  </p>
 </div>

 <div>
  <label className="block text-[10px] font-bold text-fg-secondary mb-1">
   Truck Odo at Burst (KM) *
  </label>
  <Input
   type="number"
   min="1"
   value={actionOdo}
   onChange={e =>
     setActionOdo(
       e.target.value === "" ? "" : parseFloat(e.target.value)
     )
   }
   className="input-glass"
   placeholder="Current vehicle odometer"
  />
 </div>

 <div>
  <label className="block text-[10px] font-bold text-fg-secondary mb-1">
   Recovery Amount
  </label>
  <Input
   type="number"
   min="0"
   step="0.01"
   value={actionRecoveryAmount}
   onChange={e =>
     setActionRecoveryAmount(
       e.target.value === "" ? "" : parseFloat(e.target.value)
     )
   }
   className="input-glass"
  />
 </div>

 {Number(actionRecoveryAmount) > 0 && (
  <div>
   <label className="block text-[10px] font-bold text-fg-secondary mb-1">
    Buyer / Recovery Vendor *
   </label>
   <Select
    value={actionBuyerVendorId}
    onChange={e => setActionBuyerVendorId(e.target.value)}
    className="input-glass"
   >
    <option value="">-- SELECT BUYER --</option>
    {vendors.map(v => (
     <option key={v.vendor_id} value={String(v.vendor_id)}>
      {v.vendor_name}
     </option>
    ))}
   </Select>
  </div>
 )}
 </>
 )}

 {actionModal.mode === "SCRAP_FROM_STORE" && (
 <>
 <div className="p-3 rounded-lg border border-danger/30 bg-danger/5">
  <p className="text-xs font-bold text-danger">Scrap Tyre</p>
  <p className="text-[10px] text-fg-secondary mt-1">
   This permanently removes the tyre from active inventory and records it as SCRAPPED.
  </p>
 </div>
 <div>
  <label className="block text-[10px] font-bold text-fg-secondary mb-1">Recovery Amount</label>
  <Input type="number" min="0" step="0.01" value={actionRecoveryAmount} onChange={e=>setActionRecoveryAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} className="input-glass" />
 </div>
 {Number(actionRecoveryAmount) > 0 && (
  <div>
   <label className="block text-[10px] font-bold text-fg-secondary mb-1">Buyer / Recovery Vendor *</label>
   <Select value={actionBuyerVendorId} onChange={e=>setActionBuyerVendorId(e.target.value)} className="input-glass">
    <option value="">-- SELECT BUYER --</option>
    {vendors.map(v => <option key={v.vendor_id} value={String(v.vendor_id)}>{v.vendor_name}</option>)}
   </Select>
  </div>
 )}
 </>
 )}
 <Button type="button" variant="default" onClick={executeLifecycleAction} disabled={isProcessing} className="w-full py-3.5 mt-2 text-xs disabled:bg-surface-raised">
 {isProcessing ? "Processing..." : "Confirm Action"}
 </Button>
 </div>
 </div>
 </div>
 )}

 {/* Main Tabs */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
 <div>
 <h2 className="text-xl font-semibold text-fg  tracking-tight">Workshop & Inventory</h2>
 <p className="text-xs text-fg-secondary mt-0.5">Manage tyre lifecycles, retreading, spares, and service billing.</p>
 </div>
 <div className="flex flex-wrap gap-2">
 {["Tyre Management", "Spares & Service Bills"].map((tab) => (
 <Button type="button" variant="ghost" key={tab} onClick={() => setWTab(tab)} className={`px-4 py-2.5 rounded-xl text-xs font-bold ${wTab === tab ? "bg-accent text-accent-fg shadow-orange" : "bg-surface-raised text-fg-secondary hover:text-fg hover:bg-surface-elevated border border-border-strong"}`}>{tab}</Button>
 ))}
 </div>
 </div>

 {wTab === "Tyre Management" && (
 <div className="space-y-8">
 {/* Tyre Registration Form */}
 <div className="liquid-glass p-6 shadow-xl animate-in slide-in-from-bottom-4">
 <h3 className="text-sm font-semibold text-fg  border-b border-border pb-3 mb-4 flex items-center gap-2"><span></span> Add New Tyre to Database</h3>
 <form onSubmit={handleRegisterTyre} className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <div className="md:col-span-1"><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Destination *</label><Select value={regMode} onChange={e => setRegMode(e.target.value)} className="input-glass text-fg"><option value="IN_STORE">Add to Store / Inventory</option><option value="MOUNTED">Mount Directly to Truck</option></Select></div>
 <div className="md:col-span-1"><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Serial Number *</label><Input type="text" maxLength={30} value={serialNo} onChange={e => setSerialNo(e.target.value.toUpperCase())} className="input-glass text-fg " required /></div>
 <div className="md:col-span-1"><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Brand / Model</label><Input type="text" maxLength={40} value={brand} onChange={e => setBrand(e.target.value.toUpperCase())} className="input-glass text-fg " /></div>
 <div className="md:col-span-1"><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Initial NSD (MM)</label><Input type="number" step="0.1" min="0" max="30" value={nsdMm} onChange={e => setNsdMm(e.target.value === "" ? "" : parseFloat(e.target.value))} className="input-glass text-fg" /></div>
 <div className="md:col-span-1">
 <label className="block text-[10px] font-bold text-fg-secondary mb-1">Purchase Vendor *</label>
 <Select value={purchaseVendorId} onChange={e => setPurchaseVendorId(e.target.value)} className="input-glass" required>
   <option value="">-- SELECT TYRE VENDOR --</option>
   {getTyreVendors().map(v => (
     <option key={v.vendor_id} value={String(v.vendor_id)}>{v.vendor_name}</option>
   ))}
 </Select>
 </div>
 <div className="md:col-span-1">
 <label className="block text-[10px] font-bold text-fg-secondary mb-1">Purchase Amount</label>
 <Input type="number" min="0" step="0.01" value={purchaseUnitAmount} onChange={e => setPurchaseUnitAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} className="input-glass text-fg" />
 </div>
 </div>
 {regMode === "MOUNTED" && (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 kss-surface-raised border border-accent-border rounded-lg">
 <div><label className="block text-[10px] font-bold text-accent  mb-1">Select Truck *</label><Select value={truckId} onChange={e => { setTruckId(e.target.value); setPosition(""); }} className="input-glass"><option value="">-- SELECT TRUCK --</option>{vehicles.map(v => <option key={v.vehicle_id} value={String(v.vehicle_id)}>{v.vehicle_number}</option>)}</Select></div>
 <div>
<label className="block text-[10px] font-bold text-accent mb-1">Position *</label>
<Select
 value={position}
 onChange={e => setPosition(e.target.value)}
 className="input-glass"
>
 <option value="">-- SELECT POSITION --</option>
 {(vehicles.find(v => String(v.vehicle_id) === String(truckId))
   ? getWheelPositions(vehicles.find(v => String(v.vehicle_id) === String(truckId)))
   : []
 ).map(pos => (
   <option key={pos} value={pos}>{getPositionLabel(pos)}</option>
 ))}
</Select>
</div>
 <div><label className="block text-[10px] font-bold text-accent  mb-1">Mounting ODO (KM) *</label><Input type="number" min="0" value={mountOdo} onChange={e => setMountOdo(e.target.value === "" ? "" : parseFloat(e.target.value))} className="input-glass" /></div>
 </div>
 )}
 <div className="flex justify-end pt-2"><Button type="submit" variant="default" disabled={isProcessing} className="px-8 py-3 text-xs disabled:bg-surface-raised">Save Tyre Data</Button></div>
 </form>
 </div>

 {/* ACTIVE MOUNTED TYRES */}
 <div className="liquid-glass overflow-hidden shadow-xl">
 <TableToolbar title=" Currently Mounted on Fleet" searchQuery={mountedSearch} setSearchQuery={setMountedSearch} exportData={exportMounted} exportFilename="Mounted_Tyres" />
 <div className="overflow-x-auto w-full max-h-[400px]">
 <Table className="text-xs text-left whitespace-nowrap">
 <TableHeader className="sticky top-0 z-10"><TableRow className="font-bold text-fg-secondary  tracking-wider text-[10px]"><TableHead className="px-5 py-3.5">Truck</TableHead><TableHead className="px-5 py-3.5">Serial & Brand</TableHead><TableHead className="px-5 py-3.5">Position</TableHead><TableHead className="px-5 py-3.5">Mounted Date</TableHead><TableHead className="px-5 py-3.5">Current KM Run</TableHead><TableHead className="px-5 py-3.5 text-center">Action</TableHead></TableRow></TableHeader>
 <TableBody className="">
 {filteredMounted.map(t => (
 <TableRow key={t.tyre_id} className="">
 <TableCell className="px-5 py-3.5 font-semibold text-fg">{t.vehicles?.vehicle_number || "UNKNOWN"}</TableCell>
 <TableCell className="px-5 py-3.5 font-mono font-bold text-fg">{t.serial_number} <br/><span className="font-sans font-semibold text-[10px] text-fg-secondary">{t.brand_model}</span></TableCell>
 <TableCell className="px-5 py-3.5 text-fg-secondary font-bold">{t.placement_position}</TableCell>
 <TableCell className="px-5 py-3.5 text-fg-secondary">{formatDate(t.recorded_date)}</TableCell>
 <TableCell className="px-5 py-3.5 font-semibold text-success">{t.total_km_run || 0} km</TableCell>
 <TableCell className="px-5 py-3.5 text-center">
 <div className="flex justify-center gap-2">
  <Button type="button" variant="ghost" onClick={() => {
   setActionOdo("");
   setActionNsd("");
   setActionModal({ isOpen: true, tyre: t, mode: "UNMOUNT" });
  }} className="px-3 py-1.5">Unmount</Button>
  <Button type="button" variant="secondary" onClick={() => {
   setActionOdo("");
   setActionNsd("");
   setActionVendorId("");
   setActionModal({ isOpen: true, tyre: t, mode: "SEND_RETREAD" });
  }} className="px-3 py-1.5">Retread</Button>
  <Button type="button" variant="ghost" onClick={() => {
   setActionOdo("");
   setActionRecoveryAmount(0);
   setActionBuyerVendorId("");
   setActionModal({ isOpen: true, tyre: t, mode: "BURST_TYRE" });
  }} className="px-3 py-1.5 text-danger hover:text-danger">Burst</Button>
 </div>
 </TableCell>
 </TableRow>
 ))}
 {filteredMounted.length === 0 && <TableRow><TableCell colSpan={6} className="p-8 text-center text-fg-muted font-medium">No mounted tyres found.</TableCell></TableRow>}
 </TableBody>
 </Table>
 </div>
 </div>

 {/* STORE & RETREADING */}
 <div className="liquid-glass overflow-hidden shadow-xl">
 <TableToolbar title=" In Store / Retreading" searchQuery={storeSearch} setSearchQuery={setStoreSearch} exportData={exportStore} exportFilename="Store_Tyres" />
 <div className="overflow-x-auto w-full max-h-[400px]">
 <Table className="text-xs text-left whitespace-nowrap">
 <TableHeader className="sticky top-0 z-10"><TableRow className="font-bold text-fg-secondary  tracking-wider text-[10px]"><TableHead className="px-5 py-3.5">Status</TableHead><TableHead className="px-5 py-3.5">Serial & Brand</TableHead><TableHead className="px-5 py-3.5">Condition</TableHead><TableHead className="px-5 py-3.5">Lifetime KM</TableHead><TableHead className="px-5 py-3.5 text-center">Action</TableHead></TableRow></TableHeader>
 <TableBody className="">
 {filteredStore.map(t => (
 <TableRow key={t.tyre_id} className="">
 <TableCell className="px-5 py-3.5"><span className={`px-2 py-1 rounded text-[10px] font-semibold ${t.tyre_status === 'RETREADING' ? 'bg-warning/10 text-warning border border-warning/30' : 'bg-surface-raised text-fg border border-border'}`}>{t.tyre_status || 'IN_STORE'}</span></TableCell>
 <TableCell className="px-5 py-3.5 font-mono font-bold text-fg">{t.serial_number} <br/><span className="font-sans font-semibold text-[10px] text-fg-secondary">{t.brand_model}</span></TableCell>
 <TableCell className="px-5 py-3.5 text-fg-secondary font-bold">{t.condition_status}</TableCell>
 <TableCell className="px-5 py-3.5 font-semibold text-info">{t.total_km_run || 0} km</TableCell>
 <TableCell className="px-5 py-3.5 text-center">
 {t.tyre_status === 'RETREADING' ? (
 <Button type="button" variant="secondary" onClick={() => {
  setActionNsd("");
  setActionAmount("");
  setActionVendorId("");
  setActionResult("RETREAD_RETURNED");
  setActionDisposition("IN_STORE");
  setActionTruckId("");
  setActionPos("");
  setActionOdo("");
  setActionModal({ isOpen: true, tyre: t, mode: "RECEIVE_RETREAD" });
 }} className="px-3 py-1.5 bg-success/10 text-success border border-success/20">Receive</Button>
 ) : (
 <div className="flex justify-center gap-2">
 <Button type="button" variant="default" onClick={() => { setActionTruckId(""); setActionPos(""); setActionOdo(""); setActionVendorId(""); setActionModal({ isOpen: true, tyre: t, mode: "MOUNT" }); }} className="px-3 py-1.5 bg-accent-soft hover:bg-accent/15 text-accent border border-accent-border">Mount</Button>
 <Button type="button" variant="ghost" onClick={() => {
   setActionRecoveryAmount(0);
   setActionBuyerVendorId("");
   setActionModal({ isOpen: true, tyre: t, mode: "SCRAP_FROM_STORE" });
  }} className="px-3 py-1.5">Dispose</Button>
 </div>
 )}
 </TableCell>
 </TableRow>
 ))}
 {filteredStore.length === 0 && <TableRow><TableCell colSpan={5} className="p-8 text-center text-fg-muted font-medium">Inventory is empty.</TableCell></TableRow>}
 </TableBody>
 </Table>
 </div>
 </div>

 {/* SCRAP YARD */}
 <div className="liquid-glass overflow-hidden shadow-xl">
 <TableToolbar title=" Disposed / Scrap Yard" searchQuery={scrapSearch} setSearchQuery={setScrapSearch} exportData={exportScrap} exportFilename="Scrapped_Tyres" />
 <div className="overflow-x-auto w-full max-h-[300px]">
 <Table className="text-xs text-left whitespace-nowrap">
 <TableHeader className="sticky top-0 z-10"><TableRow className="font-bold text-fg-secondary  tracking-wider text-[10px]"><TableHead className="px-5 py-3.5">Serial & Brand</TableHead><TableHead className="px-5 py-3.5">Status</TableHead><TableHead className="px-5 py-3.5">Total Lifetime Run (KM)</TableHead></TableRow></TableHeader>
 <TableBody className="">
 {filteredScrap.map(t => (
 <TableRow key={t.tyre_id} className="">
 <TableCell className="px-5 py-3.5 font-mono font-bold text-fg">{t.serial_number} <br/><span className="font-sans font-semibold text-[10px] text-fg-secondary">{t.brand_model}</span></TableCell>
 <TableCell className="px-5 py-3.5"><span className="px-2 py-1 rounded text-[10px] font-semibold bg-danger/10 text-danger border border-danger/20">{t.tyre_status}</span></TableCell>
 <TableCell className="px-5 py-3.5 font-semibold text-fg-secondary">{t.total_km_run || 0} km</TableCell>
 </TableRow>
 ))}
 {filteredScrap.length === 0 && <TableRow><TableCell colSpan={3} className="p-8 text-center text-fg-muted font-medium">No scrapped tyres.</TableCell></TableRow>}
 </TableBody>
 </Table>
 </div>
 </div>
 </div>
 )}

 {wTab === "Spares & Service Bills" && (
 <div className="liquid-glass p-6 sm:p-8 shadow-xl max-w-5xl mx-auto animate-in slide-in-from-bottom-4">
 <h3 className="text-sm font-semibold text-fg  border-b border-border pb-3 mb-6">Log Service Bill</h3>
 <form onSubmit={handleSaveBill} className="space-y-5">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Bill Date *</label><Input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="input-glass text-fg" required /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Select Truck *</label><Select value={wsTruckId} onChange={e => setWsTruckId(e.target.value)} className="input-glass text-fg" required><option value="">-- SELECT TRUCK --</option>{vehicles.map(v => <option key={v.vehicle_id} value={String(v.vehicle_id)}>{v.vehicle_number}</option>)}</Select></div>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Vendor / Workshop Name *</label><Input type="text" maxLength={60} value={vendor} onChange={e => setVendor(e.target.value.toUpperCase())} className="input-glass text-fg " required /></div>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Total Bill Amount () *</label><Input type="number" min="1" max="1000000" value={amount} onChange={e => setAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} className="input-glass text-fg font-semibold text-danger" required /></div>
 </div>
 <div><label className="block text-[10px] font-bold text-fg-secondary  mb-1">Parts & Service Description</label><Input type="text" maxLength={150} value={description} onChange={e => setDescription(e.target.value.toUpperCase())} placeholder="e.g. Engine oil change, 2 brake pads" className="input-glass text-fg " /></div>
 <Button type="submit" variant="default" disabled={isProcessing} className="w-full py-3.5 text-xs disabled:bg-surface-raised">Save Service Record</Button>
 </form>

 <div className="mt-10 kss-surface overflow-hidden w-full">
 <TableToolbar title="Recent Workshop Bills" searchQuery={billsSearch} setSearchQuery={setBillsSearch} exportData={exportBills} exportFilename="Workshop_Spares_Bills" />
 <div className="overflow-x-auto w-full max-h-[400px]">
 <Table className="text-xs text-left whitespace-nowrap">
 <TableHeader className="sticky top-0 z-10"><TableRow className="font-bold text-fg-secondary  tracking-wider text-[10px]"><TableHead className="px-5 py-3.5">Date</TableHead><TableHead className="px-5 py-3.5">Truck</TableHead><TableHead className="px-5 py-3.5">Vendor & Details</TableHead><TableHead className="px-5 py-3.5 text-right">Amount ()</TableHead></TableRow></TableHeader>
 <TableBody className="">
 {filteredBills.map(b => (
 <TableRow key={b.bill_id} className="">
 <TableCell className="px-5 py-4 font-semibold text-fg-secondary">{formatDate(b.bill_date)}</TableCell>
 <TableCell className="px-5 py-4 font-semibold text-fg">{b.vehicles?.vehicle_number || "UNKNOWN"}</TableCell>
 <TableCell className="px-5 py-4 text-fg-secondary font-bold">{b.vendor_name} <br/><span className="text-[10px] text-fg-muted font-normal">{b.spare_parts_details}</span></TableCell>
 <TableCell className="px-5 py-4 text-right font-semibold text-danger">{(b.total_bill_amount || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</TableCell>
 </TableRow>
 ))}
 {filteredBills.length === 0 && <TableRow><TableCell colSpan={4} className="p-8 text-center text-fg-muted font-medium">No service bills match your search.</TableCell></TableRow>}
 </TableBody>
 </Table>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
