"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/components/ui/usePagination";

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
 const [historyOpen, setHistoryOpen] = useState(false);

 // Data Lists
 const [activeTyres, setActiveTyres] = useState<any[]>([]);

 // Spares States
 const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
 const [showServiceBillWorkspace, setShowServiceBillWorkspace] = useState(false);
 const [showServiceBillHistory, setShowServiceBillHistory] = useState(false);
 const [serviceBills, setServiceBills] = useState<any[]>([]);
 const [serviceBillSearch, setServiceBillSearch] = useState("");
 const [wsTruckId, setWsTruckId] = useState("");
 const [vendor, setVendor] = useState("");
 const [description, setDescription] = useState("");
 const [amount, setAmount] = useState<number | "">("");

 // Spare Parts Inventory States
 const [inventoryItems, setInventoryItems] = useState<any[]>([]);
 const [inventoryStock, setInventoryStock] = useState<any[]>([]);
 const [inventoryStockHistory, setInventoryStockHistory] = useState<any[]>([]);
 const [inventorySearch, setInventorySearch] = useState("");
 const [inventoryStockSearch, setInventoryStockSearch] = useState("");
 const [inventoryLowStockSearch, setInventoryLowStockSearch] = useState("");
 const [showInventoryItems, setShowInventoryItems] = useState(false);
 const [showInventoryPurchase, setShowInventoryPurchase] = useState(false);
 const [showInventoryIssue, setShowInventoryIssue] = useState(false);
 const [showInventoryHistory, setShowInventoryHistory] = useState(false);
 const [showInventoryLowStock, setShowInventoryLowStock] = useState(false);
 const [showInventoryAddItem, setShowInventoryAddItem] = useState(false);
 const [inventoryItemCode, setInventoryItemCode] = useState("");
 const [inventoryItemName, setInventoryItemName] = useState("");
 const [inventoryCategory, setInventoryCategory] = useState("");
 const [inventoryUnit, setInventoryUnit] = useState("PCS");
 const [inventoryMinimumStock, setInventoryMinimumStock] = useState<number | "">(0);
 const [inventoryIssueItemId, setInventoryIssueItemId] = useState("");
 const [inventoryIssueQuantity, setInventoryIssueQuantity] = useState<number | "">("");
 const [inventoryIssueVehicleId, setInventoryIssueVehicleId] = useState("");
 const [inventoryIssueReason, setInventoryIssueReason] = useState("");
 const [inventoryPurchaseDate, setInventoryPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
const [inventoryPurchaseInvoiceDate, setInventoryPurchaseInvoiceDate] = useState("");
const [inventoryPurchaseInvoiceNumber, setInventoryPurchaseInvoiceNumber] = useState("");
const [inventoryPurchaseVendorId, setInventoryPurchaseVendorId] = useState("");
const [inventoryPurchasePaymentStatus, setInventoryPurchasePaymentStatus] = useState("PAID");
const [inventoryPurchaseTax, setInventoryPurchaseTax] = useState<number | "">(0);
const [inventoryPurchaseRemarks, setInventoryPurchaseRemarks] = useState("");
const [inventoryPurchaseLines, setInventoryPurchaseLines] = useState<
  { itemId: string; quantity: number | ""; unitAmount: number | "" }[]
>([
  { itemId: "", quantity: "", unitAmount: "" },
]);


 const formatDate = (dateStr: string) => {
 if (!dateStr) return 'N/A';
 if (!dateStr.includes('-')) return dateStr;
 const parts = dateStr.split('T')[0].split('-');
 if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
 return dateStr;
 };

 const fetchData = async () => {
 const { data: vData } = await supabase.from('vehicles').select('*').eq('is_active', true).order('vehicle_number');
 if (vData) setVehicles(vData);

 const { data: vendorData } = await supabase
   .from('vendors')
   .select('*')
   .eq('is_active', true)
   .order('vendor_name');
 if (vendorData) setVendors(vendorData);

 const { data: tData } = await supabase.from('fleet_tyres').select('*, vehicles(vehicle_number)').order('recorded_date', { ascending: false });
 if (tData) setActiveTyres(tData);

 const { data: billData } = await supabase
   .from('workshop_spares_bills')
   .select('*, vehicles(vehicle_number)')
   .order('bill_date', { ascending: false })
   .order('bill_id', { ascending: false });
 if (billData) setServiceBills(billData);

 const { data: inventoryItemData } = await supabase
   .from("inventory_items")
   .select("*")
   .eq("is_active", true)
   .order("item_name");

 if (inventoryItemData) {
   setInventoryItems(inventoryItemData);
 }

 const { data: inventoryStockData } = await supabase
   .from("inventory_stock_balance")
   .select("*")
   .order("item_name");

 if (inventoryStockData) {
   setInventoryStock(inventoryStockData);
 }

 const { data: inventoryStockHistoryData } = await supabase
   .from("inventory_stock_movements")
   .select(`
    *,
    inventory_items(item_code, item_name),
    vehicles(vehicle_number)
   `)
   .order("created_at", { ascending: false })
   .order("movement_id", { ascending: false });

 if (inventoryStockHistoryData) {
   setInventoryStockHistory(inventoryStockHistoryData);
 }

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

 const filteredServiceBills = serviceBills.filter((bill: any) => {
   const q = serviceBillSearch.trim().toLowerCase();
   if (!q) return true;
   return [
     bill.bill_id,
     bill.bill_date,
     bill.vehicles?.vehicle_number,
     bill.vendor_name,
     bill.invoice_number,
     bill.spare_parts_details,
     bill.total_bill_amount,
   ].some((value) => String(value ?? "").toLowerCase().includes(q));
 });

 const inventoryPurchaseSubtotal = inventoryPurchaseLines.reduce(
  (sum, line) => {
   const quantity = Number(line.quantity);
   const unitAmount = Number(line.unitAmount);

   if (!Number.isFinite(quantity) || !Number.isFinite(unitAmount)) {
    return sum;
   }

   return sum + quantity * unitAmount;
  },
  0
 );

 const inventoryPurchaseTaxAmount = Number(inventoryPurchaseTax) || 0;
 const inventoryPurchaseTotal = inventoryPurchaseSubtotal + inventoryPurchaseTaxAmount;

 const filteredInventoryItems = inventoryItems.filter((item: any) => {
   const q = inventorySearch.trim().toLowerCase();
   if (!q) return true;
   return [
     item.item_code,
     item.item_name,
     item.category,
     item.unit,
   ].some((value) => String(value ?? "").toLowerCase().includes(q));
 });

 const historyPagination = usePagination(filteredScrap, { pageSize: 10 });
 const serviceBillPagination = usePagination(filteredServiceBills, { pageSize: 10 });
 const inventoryPagination = usePagination(filteredInventoryItems, { pageSize: 10 });

 const filteredInventoryStockHistory = inventoryStockHistory.filter((movement: any) => {
  const q = inventoryStockSearch.trim().toLowerCase();

  if (!q) return true;

  return [
   movement.inventory_items?.item_code,
   movement.inventory_items?.item_name,
   movement.movement_type,
   movement.reason,
   movement.reference_type,
   movement.reference_id,
   movement.vehicles?.vehicle_number,
  ].some((value) =>
   String(value ?? "").toLowerCase().includes(q)
  );
 });

 const inventoryHistoryPagination = usePagination(
  filteredInventoryStockHistory,
  { pageSize: 10 }
 );

 const filteredInventoryLowStock = inventoryStock.filter((item: any) => {
  const current = Number(item.current_stock ?? 0);
  const minimum = Number(item.minimum_stock ?? 0);

  if (current > minimum) return false;

  const q = inventoryLowStockSearch.trim().toLowerCase();

  if (!q) return true;

  return [
   item.item_code,
   item.item_name,
   item.category,
   item.unit,
  ].some((value) =>
   String(value ?? "").toLowerCase().includes(q)
  );
 });

 const inventoryLowStockPagination = usePagination(
  filteredInventoryLowStock,
  { pageSize: 10 }
 );

 return (
 <div className="animate-tab-focus space-y-6 animate-in fade-in duration-300 text-fg">
 <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} isDanger={modalConfig.isDanger} confirmText={modalConfig.confirmText} onConfirm={modalConfig.action} onCancel={closeModal} isProcessing={isProcessing} />

 {historyOpen && (
  <Dialog
   open={historyOpen}
   onOpenChange={(open) => {
    if (!open) setHistoryOpen(false);
   }}
  >
   <DialogContent
    layout="modal"
    size="lg"
    className="flex max-h-[88dvh] flex-col overflow-hidden p-0"
   >
    <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
     <DialogTitle>Tyre History</DialogTitle>
     <p className="text-xs text-fg-muted">{filteredScrap.length} disposed tyres</p>
    </DialogHeader>
    <DialogBody className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
     <div className="space-y-4">
      <Input value={scrapSearch} onChange={event => setScrapSearch(event.target.value)} placeholder="Search by tyre serial..." aria-label="Search tyre history" className="w-full max-w-lg" />
      <div className="max-h-[62vh] overflow-auto rounded-xl border border-border">
       <Table className="min-w-[560px] text-xs text-left whitespace-nowrap">
        <TableHeader className="sticky top-0 z-10 bg-surface-raised">
         <TableRow className="font-bold text-fg-secondary text-[10px]">
          <TableHead className="px-5 py-3.5">Serial & Brand</TableHead>
          <TableHead className="px-5 py-3.5">Status</TableHead>
          <TableHead className="px-5 py-3.5">Total Lifetime Run (KM)</TableHead>
         </TableRow>
        </TableHeader>
        <TableBody>
         {historyPagination.paginatedItems.map((t: any) => (
          <TableRow key={t.tyre_id}>
           <TableCell className="px-5 py-3.5 font-mono font-bold text-fg">
            {t.serial_number}<br/>
            <span className="font-sans font-semibold text-[10px] text-fg-secondary">{t.brand_model}</span>
           </TableCell>
           <TableCell className="px-5 py-3.5">
            <span className="rounded border border-danger/20 bg-danger/10 px-2 py-1 text-[10px] font-semibold text-danger">{t.tyre_status}</span>
           </TableCell>
           <TableCell className="px-5 py-3.5 font-semibold text-fg-secondary">{t.total_km_run || 0} km</TableCell>
          </TableRow>
         ))}
         {filteredScrap.length === 0 && (
          <TableRow>
           <TableCell colSpan={3} className="p-8 text-center text-fg-muted">No disposed tyres match your search.</TableCell>
          </TableRow>
         )}
        </TableBody>
       </Table>
      </div>
      <Pagination page={historyPagination.page} totalPages={historyPagination.totalPages} onPageChange={historyPagination.setPage} />
     </div>
    </DialogBody>
   </DialogContent>
  </Dialog>
 )}

 {/* CUSTOM LIFECYCLE MODAL */}
 {actionModal.isOpen && (
 <Dialog
  open={actionModal.isOpen}
  onOpenChange={(open) => {
   if (!open) {
    setActionModal({ isOpen: false, tyre: null, mode: "" });
   }
  }}
 >
  <DialogContent
   layout="modal"
   size="md"
   className="flex max-h-[88dvh] flex-col overflow-hidden p-0"
  >
   <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
    <DialogTitle>
     {actionModal.mode === "UNMOUNT" && "Unmount Tyre"}
     {actionModal.mode === "MOUNT" && "Mount to Truck"}
     {actionModal.mode === "RECEIVE_RETREAD" && "Receive from Retread"}
     {actionModal.mode === "BURST_TYRE" && "Record Tyre Burst"}
     {actionModal.mode === "SCRAP_FROM_STORE" && "Dispose Tyre"}
    </DialogTitle>
   </DialogHeader>
   <DialogBody className="min-h-0 flex-1 overflow-y-auto px-6 py-6">

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
   </DialogBody>
  </DialogContent>
 </Dialog>
 )}

 {/* Main Tabs */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
 <div>
 <h2 className="text-xl font-semibold text-fg  tracking-tight">Workshop & Inventory</h2>
 <p className="text-xs text-fg-secondary mt-0.5">Manage tyre lifecycles, retreading, spares, and service billing.</p>
 </div>
 <div className="flex flex-wrap gap-2">
 {["Tyre Management", "Spares & Service Bills", "Spare Parts Inventory"].map((tab) => (
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

 {/* Historical disposed tyre records are available from the Workshop History popup. */}
 <div className="flex justify-end"><Button type="button" variant="glass" onClick={() => setHistoryOpen(true)}>Tyre History ({scrapTyres.length})</Button></div>
 </div>
 )}

 {showInventoryIssue && (
  <Dialog
   open={showInventoryIssue}
   onOpenChange={(open) => {
    setShowInventoryIssue(open);
    if (!open) {
     setInventoryIssueItemId("");
     setInventoryIssueQuantity("");
     setInventoryIssueVehicleId("");
     setInventoryIssueReason("");
    }
   }}
  >
   <DialogContent layout="modal" size="md">
    <DialogHeader>
     <DialogTitle>Issue Spare Part</DialogTitle>
     <p className="text-xs text-fg-muted">
      Issue stock from the workshop store to a vehicle or workshop activity.
     </p>
    </DialogHeader>

    <DialogBody>
     <form
      className="space-y-5"
      onSubmit={async (e) => {
       e.preventDefault();

       const itemId = Number(inventoryIssueItemId);
       const quantity = Number(inventoryIssueQuantity);
       const vehicleId = inventoryIssueVehicleId
        ? Number(inventoryIssueVehicleId)
        : null;
       const reason = inventoryIssueReason.trim();

       if (!Number.isInteger(itemId) || itemId <= 0) {
        alert("Please select a valid spare part.");
        return;
       }

       if (!Number.isFinite(quantity) || quantity <= 0) {
        alert("Issue quantity must be greater than zero.");
        return;
       }

       if (vehicleId !== null && (!Number.isInteger(vehicleId) || vehicleId <= 0)) {
        alert("Please select a valid vehicle.");
        return;
       }

       if (!reason) {
        alert("Issue reason is required.");
        return;
       }

       if (
        !window.confirm(
         `Issue ${quantity} unit(s) of the selected spare part from stock?`
        )
       ) {
        return;
       }

       setIsProcessing(true);

       const { error } = await supabase.rpc("issue_inventory_stock", {
        p_item_id: itemId,
        p_quantity: quantity,
        p_vehicle_id: vehicleId,
        p_reason: reason,
       });

       if (error) {
        alert("Failed to issue stock: " + error.message);
       } else {
        alert("Stock issued successfully.");

        setInventoryIssueItemId("");
        setInventoryIssueQuantity("");
        setInventoryIssueVehicleId("");
        setInventoryIssueReason("");
        setShowInventoryIssue(false);

        await fetchData();
       }

       setIsProcessing(false);
      }}
     >
      <div className="space-y-1.5">
       <label className="text-xs font-semibold text-fg-secondary">
        Spare Part *
       </label>
       <Select
        value={inventoryIssueItemId}
        onChange={(e) => setInventoryIssueItemId(e.target.value)}
        required
       >
        <option value="">Select item</option>
        {inventoryItems.map((item: any) => (
         <option key={item.item_id} value={item.item_id}>
          {item.item_code} — {item.item_name}
         </option>
        ))}
       </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
       <div className="space-y-1.5">
        <label className="text-xs font-semibold text-fg-secondary">
         Quantity *
        </label>
        <Input
         type="number"
         min="0.01"
         step="0.01"
         value={inventoryIssueQuantity}
         onChange={(e) => {
          const value = e.target.value;
          setInventoryIssueQuantity(value === "" ? "" : Number(value));
         }}
         required
        />
       </div>

       <div className="space-y-1.5">
        <label className="text-xs font-semibold text-fg-secondary">
         Vehicle
        </label>
        <Select
         value={inventoryIssueVehicleId}
         onChange={(e) => setInventoryIssueVehicleId(e.target.value)}
        >
         <option value="">Workshop / General</option>
         {vehicles.map((vehicle: any) => (
          <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
           {vehicle.vehicle_number}
          </option>
         ))}
        </Select>
       </div>
      </div>

      <div className="space-y-1.5">
       <label className="text-xs font-semibold text-fg-secondary">
        Issue Reason *
       </label>
       <Input
        value={inventoryIssueReason}
        onChange={(e) => setInventoryIssueReason(e.target.value)}
        placeholder="e.g. Brake replacement / service repair"
        maxLength={300}
        required
       />
      </div>

      <div className="rounded-2xl border border-border px-4 py-3 text-xs text-fg-muted">
       Stock availability is checked again by the database when the issue is
       recorded. The stock ledger cannot be edited or deleted from this screen.
      </div>

      <div className="flex justify-end gap-3 border-t border-border pt-4">
       <Button
        type="button"
        variant="glass"
        onClick={() => setShowInventoryIssue(false)}
        disabled={isProcessing}
       >
        Cancel
       </Button>

       <Button type="submit" disabled={isProcessing}>
        {isProcessing ? "Issuing..." : "Issue Stock"}
       </Button>
      </div>
     </form>
    </DialogBody>
   </DialogContent>
  </Dialog>
 )}


 {showInventoryHistory && (
  <Dialog
   open={showInventoryHistory}
   onOpenChange={(open) => {
    setShowInventoryHistory(open);
    if (!open) {
     setInventoryStockSearch("");
    }
   }}
  >
   <DialogContent
    layout="modal"
    size="full"
    className="max-h-[92dvh] overflow-hidden"
   >
    <DialogHeader>
     <DialogTitle>Stock History</DialogTitle>
     <p className="text-xs text-fg-muted">
      Read-only inventory movement ledger. Purchases, issues, returns,
      adjustments, and reversals are recorded here.
     </p>
    </DialogHeader>

    <DialogBody>
     <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
       <Input
        value={inventoryStockSearch}
        onChange={(e) => setInventoryStockSearch(e.target.value)}
        placeholder="Search item, movement, vehicle, reason..."
        className="sm:max-w-md"
       />

       <div className="text-xs text-fg-muted">
        {filteredInventoryStockHistory.length} movement
        {filteredInventoryStockHistory.length === 1 ? "" : "s"}
       </div>
      </div>

      <div className="max-h-[62vh] overflow-auto rounded-2xl border border-border">
       <Table className="min-w-[1100px] text-xs">
        <TableHeader className="sticky top-0 z-10 bg-surface-raised">
         <TableRow>
          <TableHead>Date / Time</TableHead>
          <TableHead>Item</TableHead>
          <TableHead>Movement</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Vehicle</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Reference</TableHead>
         </TableRow>
        </TableHeader>

        <TableBody>
         {inventoryHistoryPagination.paginatedItems.length === 0 ? (
          <TableRow>
           <TableCell
            colSpan={7}
            className="py-12 text-center text-sm text-fg-muted"
           >
            No stock movement history found.
           </TableCell>
          </TableRow>
         ) : (
          inventoryHistoryPagination.paginatedItems.map((movement: any) => (
           <TableRow key={movement.movement_id}>
            <TableCell className="whitespace-nowrap text-xs">
             {movement.created_at
              ? new Date(movement.created_at).toLocaleString()
              : "—"}
            </TableCell>

            <TableCell>
             <div className="min-w-[180px]">
              <div className="font-medium text-fg">
               {movement.inventory_items?.item_name ?? "Unknown item"}
              </div>
              <div className="text-[11px] text-fg-muted">
               {movement.inventory_items?.item_code ?? "—"}
              </div>
             </div>
            </TableCell>

            <TableCell>
             <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-fg-secondary">
              {movement.movement_type ?? "—"}
             </span>
            </TableCell>

            <TableCell className="font-semibold tabular-nums">
             {Number(movement.quantity ?? 0).toFixed(2)}
             {" "}
             {movement.inventory_items?.unit ?? ""}
            </TableCell>

            <TableCell className="whitespace-nowrap">
             {movement.vehicles?.vehicle_number ?? "Workshop / General"}
            </TableCell>

            <TableCell className="min-w-[240px] text-xs text-fg-secondary">
             {movement.reason ?? "—"}
            </TableCell>

            <TableCell className="whitespace-nowrap text-xs text-fg-muted">
             {movement.reference_type
              ? `${movement.reference_type}${movement.reference_id ? ` #${movement.reference_id}` : ""}`
              : "—"}
            </TableCell>
           </TableRow>
          ))
         )}
        </TableBody>
       </Table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
       <p className="text-xs text-fg-muted">
        This ledger is immutable. Corrections must be recorded as new
        movements rather than editing historical entries.
       </p>

       <Pagination
        page={inventoryHistoryPagination.page}
        totalPages={inventoryHistoryPagination.totalPages}
        onPageChange={inventoryHistoryPagination.setPage}
       />
      </div>
     </div>
    </DialogBody>
   </DialogContent>
  </Dialog>
 )}

 {showInventoryLowStock && (
  <Dialog
   open={showInventoryLowStock}
   onOpenChange={(open) => {
    setShowInventoryLowStock(open);
    if (!open) {
     setInventoryLowStockSearch("");
    }
   }}
  >
   <DialogContent
    layout="modal"
    size="lg"
    className="max-h-[92dvh] overflow-hidden"
   >
    <DialogHeader>
     <DialogTitle>Low Stock</DialogTitle>
     <p className="text-xs text-fg-muted">
      Spare parts currently at or below their minimum stock level.
     </p>
    </DialogHeader>

    <DialogBody>
     <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
       <Input
        value={inventoryLowStockSearch}
        onChange={(e) => setInventoryLowStockSearch(e.target.value)}
        placeholder="Search item, code, category..."
        className="sm:max-w-md"
       />

       <div className="text-xs text-fg-muted">
        {filteredInventoryLowStock.length} low-stock item
        {filteredInventoryLowStock.length === 1 ? "" : "s"}
       </div>
      </div>

      <div className="max-h-[58vh] overflow-auto rounded-2xl border border-border">
       <Table className="min-w-[760px] text-xs">
        <TableHeader className="sticky top-0 z-10 bg-surface-raised">
         <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Item</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead className="text-right">Current Stock</TableHead>
          <TableHead className="text-right">Minimum Stock</TableHead>
          <TableHead className="text-center">Status</TableHead>
         </TableRow>
        </TableHeader>

        <TableBody>
         {inventoryLowStockPagination.paginatedItems.length === 0 ? (
          <TableRow>
           <TableCell
            colSpan={7}
            className="py-12 text-center text-sm text-fg-muted"
           >
            No low-stock items found.
           </TableCell>
          </TableRow>
         ) : (
          inventoryLowStockPagination.paginatedItems.map((item: any) => {
           const current = Number(item.current_stock ?? 0);
           const minimum = Number(item.minimum_stock ?? 0);

           return (
            <TableRow key={item.item_id}>
             <TableCell className="font-mono font-semibold text-fg">
              {item.item_code || "—"}
             </TableCell>

             <TableCell className="font-semibold text-fg">
              {item.item_name || "—"}
             </TableCell>

             <TableCell className="text-fg-secondary">
              {item.category || "—"}
             </TableCell>

             <TableCell className="text-fg-secondary">
              {item.unit || "—"}
             </TableCell>

             <TableCell className="text-right font-semibold tabular-nums text-danger">
              {current}
             </TableCell>

             <TableCell className="text-right font-semibold tabular-nums text-fg-secondary">
              {minimum}
             </TableCell>

             <TableCell className="text-center">
              <span className="inline-flex rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[10px] font-semibold text-warning">
               LOW STOCK
              </span>
             </TableCell>
            </TableRow>
           );
          })
         )}
        </TableBody>
       </Table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
       <p className="text-xs text-fg-muted">
        Low-stock status is calculated from the current immutable stock
        movement balance and each item's minimum-stock setting.
       </p>

       <Pagination
        page={inventoryLowStockPagination.page}
        totalPages={inventoryLowStockPagination.totalPages}
        onPageChange={inventoryLowStockPagination.setPage}
       />
      </div>
     </div>
    </DialogBody>
   </DialogContent>
  </Dialog>
 )}

 {showInventoryPurchase && (
  <Dialog
   open={showInventoryPurchase}
   onOpenChange={(open) => {
    setShowInventoryPurchase(open);
    if (!open) {
     setInventoryPurchaseInvoiceDate("");
     setInventoryPurchaseInvoiceNumber("");
     setInventoryPurchaseVendorId("");
     setInventoryPurchasePaymentStatus("PAID");
     setInventoryPurchaseTax(0);
     setInventoryPurchaseRemarks("");
     setInventoryPurchaseLines([{ itemId: "", quantity: "", unitAmount: "" }]);
    }
   }}
  >
   <DialogContent
    layout="modal"
    size="lg"
    className="max-h-[92dvh] overflow-hidden"
   >
    <DialogHeader>
     <DialogTitle>Purchase Spare Parts</DialogTitle>
     <p className="text-xs text-fg-muted">
      Record purchased stock and receive it into the workshop store.
     </p>
    </DialogHeader>

    <DialogBody>
     <form
      className="space-y-5"
      onSubmit={async (e) => {
       e.preventDefault();

       if (!inventoryPurchaseDate) {
        alert("Purchase date is required.");
        return;
       }

       const vendorId = Number(inventoryPurchaseVendorId);

       if (!Number.isInteger(vendorId) || vendorId <= 0) {
        alert("Please select a valid vendor.");
        return;
       }

       if (!["PAID", "CREDIT"].includes(inventoryPurchasePaymentStatus)) {
        alert("Invalid payment status.");
        return;
       }

       if (inventoryPurchaseLines.length === 0) {
        alert("Add at least one purchase item.");
        return;
       }

       const seenItems = new Set<number>();
       const purchaseItems = [];

       for (const line of inventoryPurchaseLines) {
        const itemId = Number(line.itemId);
        const quantity = Number(line.quantity);
        const unitAmount = Number(line.unitAmount);

        if (!Number.isInteger(itemId) || itemId <= 0) {
         alert("Every purchase line must have a valid item.");
         return;
        }

        if (seenItems.has(itemId)) {
         alert("The same item cannot be entered more than once in the same purchase.");
         return;
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
         alert("Every purchase line must have a quantity greater than zero.");
         return;
        }

        if (!Number.isFinite(unitAmount) || unitAmount < 0) {
         alert("Unit amount cannot be negative.");
         return;
        }

        seenItems.add(itemId);

        purchaseItems.push({
         item_id: itemId,
         quantity,
         unit_amount: unitAmount,
        });
       }

       const taxAmount = Number(inventoryPurchaseTax) || 0;

       if (!Number.isFinite(taxAmount) || taxAmount < 0) {
        alert("Tax amount cannot be negative.");
        return;
       }

       if (inventoryPurchaseSubtotal <= 0) {
        alert("Purchase subtotal must be greater than zero.");
        return;
       }

       const calculatedTotal = Number(
        (inventoryPurchaseSubtotal + taxAmount).toFixed(2)
       );

       if (calculatedTotal <= 0) {
        alert("Purchase total must be greater than zero.");
        return;
       }

       if (
        !window.confirm(
         `Save purchase of ₹${calculatedTotal.toFixed(2)} and receive the stock into inventory?`
        )
       ) {
        return;
       }

       setIsProcessing(true);

       const { error } = await supabase.rpc("create_inventory_purchase_atomic", {
        p_bill_date: inventoryPurchaseDate,
        p_invoice_date: inventoryPurchaseInvoiceDate || undefined,
        p_invoice_number: inventoryPurchaseInvoiceNumber.trim() || undefined,
        p_vendor_id: vendorId,
        p_payment_status: inventoryPurchasePaymentStatus,
        p_remarks: inventoryPurchaseRemarks.trim() || undefined,
        p_subtotal_amount: Number(inventoryPurchaseSubtotal.toFixed(2)),
        p_tax_amount: Number(taxAmount.toFixed(2)),
        p_total_bill_amount: calculatedTotal,
        p_items: purchaseItems,
       });

       if (error) {
        alert("Failed to save purchase: " + error.message);
       } else {
        alert("Purchase recorded and stock received successfully.");

        setInventoryPurchaseInvoiceDate("");
        setInventoryPurchaseInvoiceNumber("");
        setInventoryPurchaseVendorId("");
        setInventoryPurchasePaymentStatus("PAID");
        setInventoryPurchaseTax(0);
        setInventoryPurchaseRemarks("");
        setInventoryPurchaseLines([
         { itemId: "", quantity: "", unitAmount: "" },
        ]);

        setShowInventoryPurchase(false);
        await fetchData();
       }

       setIsProcessing(false);
      }}
     >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
       <div className="space-y-1.5">
        <label className="text-xs font-semibold text-fg-secondary">
         Purchase Date *
        </label>
        <Input
         type="date"
         value={inventoryPurchaseDate}
         onChange={(e) => setInventoryPurchaseDate(e.target.value)}
         required
        />
       </div>

       <div className="space-y-1.5">
        <label className="text-xs font-semibold text-fg-secondary">
         Invoice Date
        </label>
        <Input
         type="date"
         value={inventoryPurchaseInvoiceDate}
         onChange={(e) => setInventoryPurchaseInvoiceDate(e.target.value)}
        />
       </div>

       <div className="space-y-1.5">
        <label className="text-xs font-semibold text-fg-secondary">
         Invoice Number
        </label>
        <Input
         value={inventoryPurchaseInvoiceNumber}
         onChange={(e) => setInventoryPurchaseInvoiceNumber(e.target.value)}
         placeholder="Invoice / Bill No."
         maxLength={100}
        />
       </div>

       <div className="space-y-1.5">
        <label className="text-xs font-semibold text-fg-secondary">
         Payment Status *
        </label>
        <Select
         value={inventoryPurchasePaymentStatus}
         onChange={(e) => setInventoryPurchasePaymentStatus(e.target.value)}
        >
         <option value="PAID">PAID</option>
         <option value="CREDIT">CREDIT</option>
        </Select>
       </div>
      </div>

      <div className="space-y-1.5">
       <label className="text-xs font-semibold text-fg-secondary">
        Vendor *
       </label>
       <Select
        value={inventoryPurchaseVendorId}
        onChange={(e) => setInventoryPurchaseVendorId(e.target.value)}
        required
       >
        <option value="">Select vendor</option>
        {vendors.map((item: any) => (
         <option key={item.vendor_id} value={item.vendor_id}>
          {item.vendor_name}
         </option>
        ))}
       </Select>

       {vendors.length === 0 && (
        <p className="text-[11px] text-warning">
         No active vendors found. Add an active vendor before recording a purchase.
        </p>
       )}
      </div>

      <div className="space-y-3">
       <div className="flex items-center justify-between">
        <div>
         <p className="text-sm font-semibold text-fg">Purchase Items</p>
         <p className="text-[11px] text-fg-muted">
          Each line increases stock when the purchase is saved.
         </p>
        </div>

        <Button
         type="button"
         variant="glass"
         onClick={() =>
          setInventoryPurchaseLines((lines) => [
           ...lines,
           { itemId: "", quantity: "", unitAmount: "" },
          ])
         }
        >
         + Add Line
        </Button>
       </div>

       <div className="space-y-3">
        {inventoryPurchaseLines.map((line, index) => (
         <div
          key={index}
          className="grid grid-cols-1 gap-3 rounded-2xl border border-border p-4 sm:grid-cols-[minmax(0,1fr)_140px_160px_auto]"
         >
          <div className="space-y-1.5">
           <label className="text-[11px] font-semibold text-fg-muted">
            Item
           </label>
           <Select
            value={line.itemId}
            onChange={(e) => {
             const value = e.target.value;
             setInventoryPurchaseLines((lines) =>
              lines.map((current, currentIndex) =>
               currentIndex === index
                ? { ...current, itemId: value }
                : current
              )
             );
            }}
            required
           >
            <option value="">Select item</option>
            {inventoryItems.map((item: any) => (
             <option key={item.item_id} value={item.item_id}>
              {item.item_code} — {item.item_name}
             </option>
            ))}
           </Select>
          </div>

          <div className="space-y-1.5">
           <label className="text-[11px] font-semibold text-fg-muted">
            Quantity
           </label>
           <Input
            type="number"
            min="0.01"
            step="0.01"
            value={line.quantity}
            onChange={(e) => {
             const value = e.target.value;
             setInventoryPurchaseLines((lines) =>
              lines.map((current, currentIndex) =>
               currentIndex === index
                ? { ...current, quantity: value === "" ? "" : Number(value) }
                : current
              )
             );
            }}
            required
           />
          </div>

          <div className="space-y-1.5">
           <label className="text-[11px] font-semibold text-fg-muted">
            Unit Amount
           </label>
           <Input
            type="number"
            min="0"
            step="0.01"
            value={line.unitAmount}
            onChange={(e) => {
             const value = e.target.value;
             setInventoryPurchaseLines((lines) =>
              lines.map((current, currentIndex) =>
               currentIndex === index
                ? { ...current, unitAmount: value === "" ? "" : Number(value) }
                : current
              )
             );
            }}
            required
           />
          </div>

          <div className="flex items-end justify-end">
           <Button
            type="button"
            variant="glass"
            disabled={inventoryPurchaseLines.length === 1}
            onClick={() =>
             setInventoryPurchaseLines((lines) =>
              lines.filter((_, currentIndex) => currentIndex !== index)
             )
            }
           >
            Remove
           </Button>
          </div>

          <div className="sm:col-span-full text-right text-xs text-fg-muted">
           Line Total: ₹
           {(
            Number(line.quantity || 0) * Number(line.unitAmount || 0)
           ).toFixed(2)}
          </div>
         </div>
        ))}
       </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
       <div className="space-y-1.5">
        <label className="text-xs font-semibold text-fg-secondary">
         Tax Amount
        </label>
        <Input
         type="number"
         min="0"
         step="0.01"
         value={inventoryPurchaseTax}
         onChange={(e) => {
          const value = e.target.value;
          setInventoryPurchaseTax(value === "" ? "" : Number(value));
         }}
        />
       </div>

       <div className="rounded-2xl border border-border px-4 py-3">
        <p className="text-[11px] text-fg-muted">Subtotal</p>
        <p className="mt-1 text-lg font-semibold text-fg">
         ₹{inventoryPurchaseSubtotal.toFixed(2)}
        </p>
       </div>

       <div className="rounded-2xl border border-border px-4 py-3">
        <p className="text-[11px] text-fg-muted">Grand Total</p>
        <p className="mt-1 text-lg font-semibold text-fg">
         ₹{inventoryPurchaseTotal.toFixed(2)}
        </p>
       </div>
      </div>

      <div className="space-y-1.5">
       <label className="text-xs font-semibold text-fg-secondary">
        Remarks
       </label>
       <Input
        value={inventoryPurchaseRemarks}
        onChange={(e) => setInventoryPurchaseRemarks(e.target.value)}
        placeholder="Optional purchase remarks"
        maxLength={500}
       />
      </div>

      <div className="flex justify-end gap-3 border-t border-border pt-4">
       <Button
        type="button"
        variant="glass"
        onClick={() => setShowInventoryPurchase(false)}
       >
        Cancel
       </Button>

       <Button type="submit">
        Save Purchase
       </Button>
      </div>
     </form>
    </DialogBody>
   </DialogContent>
  </Dialog>
 )}

 {showInventoryAddItem && (
  <Dialog
   open={showInventoryAddItem}
   onOpenChange={(open) => {
    setShowInventoryAddItem(open);
    if (!open) {
     setInventoryItemCode("");
     setInventoryItemName("");
     setInventoryCategory("");
     setInventoryUnit("PCS");
     setInventoryMinimumStock(0);
    }
   }}
  >
   <DialogContent layout="modal" size="md">
    <DialogHeader>
     <DialogTitle>Add Spare Part</DialogTitle>
     <p className="text-xs text-fg-muted">
      Create a new active spare-part master item.
     </p>
    </DialogHeader>

    <DialogBody>
     <form
      className="space-y-5"
      onSubmit={async (e) => {
       e.preventDefault();

       const code = inventoryItemCode.trim().toUpperCase();
       const name = inventoryItemName.trim();
       const category = inventoryCategory.trim();
       const minimumStock = Number(inventoryMinimumStock);

       if (!code || !name) {
        alert("Item code and item name are required.");
        return;
       }

       if (!inventoryUnit) {
        alert("Unit is required.");
        return;
       }

       if (!Number.isFinite(minimumStock) || minimumStock < 0) {
        alert("Minimum stock must be zero or greater.");
        return;
       }

       setIsProcessing(true);

       const { error } = await supabase.rpc("create_inventory_item", {
        p_item_code: code,
        p_item_name: name,
        p_category: category,
        p_unit: inventoryUnit,
        p_minimum_stock: minimumStock,
       });

       if (error) {
        alert("Failed to create item: " + error.message);
       } else {
        alert("Spare part added successfully.");
        setInventoryItemCode("");
        setInventoryItemName("");
        setInventoryCategory("");
        setInventoryUnit("PCS");
        setInventoryMinimumStock(0);
        setShowInventoryAddItem(false);
        await fetchData();
       }

       setIsProcessing(false);
      }}
     >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
       <div className="space-y-1.5">
        <label className="text-xs font-semibold text-fg-secondary">
         Item Code *
        </label>
        <Input
         value={inventoryItemCode}
         onChange={(e) => setInventoryItemCode(e.target.value.toUpperCase())}
         placeholder="e.g. BRK-PAD-001"
         maxLength={50}
         required
        />
       </div>

       <div className="space-y-1.5">
        <label className="text-xs font-semibold text-fg-secondary">
         Unit *
        </label>
        <Select
         value={inventoryUnit}
         onChange={(e) => setInventoryUnit(e.target.value)}
        >
         <option value="PCS">PCS</option>
         <option value="NOS">NOS</option>
         <option value="SET">SET</option>
         <option value="LTR">LTR</option>
         <option value="KG">KG</option>
         <option value="BOX">BOX</option>
        </Select>
       </div>
      </div>

      <div className="space-y-1.5">
       <label className="text-xs font-semibold text-fg-secondary">
        Item Name *
       </label>
       <Input
        value={inventoryItemName}
        onChange={(e) => setInventoryItemName(e.target.value)}
        placeholder="e.g. Front Brake Pad"
        maxLength={150}
        required
       />
      </div>

      <div className="space-y-1.5">
       <label className="text-xs font-semibold text-fg-secondary">
        Category
       </label>
       <Input
        value={inventoryCategory}
        onChange={(e) => setInventoryCategory(e.target.value)}
        placeholder="e.g. Brake, Engine, Electrical"
        maxLength={100}
       />
      </div>

      <div className="space-y-1.5">
       <label className="text-xs font-semibold text-fg-secondary">
        Minimum Stock
       </label>
       <Input
        type="number"
        min="0"
        step="0.01"
        value={inventoryMinimumStock}
        onChange={(e) => {
         const value = e.target.value;
         setInventoryMinimumStock(value === "" ? "" : Number(value));
        }}
       />
       <p className="text-[11px] text-fg-muted">
        Low-stock alerts trigger when current stock is at or below this level.
       </p>
      </div>

      <div className="flex justify-end gap-3 border-t border-border pt-4">
       <Button
        type="button"
        variant="glass"
        onClick={() => setShowInventoryAddItem(false)}
        disabled={isProcessing}
       >
        Cancel
       </Button>

       <Button type="submit" disabled={isProcessing}>
        {isProcessing ? "Saving..." : "Create Item"}
       </Button>
      </div>
     </form>
    </DialogBody>
   </DialogContent>
  </Dialog>
 )}

 {showInventoryItems && (
  <Dialog
   open={showInventoryItems}
   onOpenChange={(open) => {
    setShowInventoryItems(open);
    if (!open) setInventorySearch("");
   }}
  >
   <DialogContent
    layout="modal"
    size="full"
    className="flex h-[92dvh] max-h-[92dvh] flex-col overflow-hidden p-0"
   >
    <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
     <DialogTitle>Spare Parts Store Items</DialogTitle>
     <p className="text-xs text-fg-muted">
      {filteredInventoryItems.length} matching active items
     </p>
    </DialogHeader>

    <DialogBody className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
     <div className="mx-auto max-w-[1450px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
       <Input
        value={inventorySearch}
        onChange={(e) => setInventorySearch(e.target.value)}
        placeholder="Search code, item, category or unit..."
        className="input-glass sm:max-w-md"
       />

       <Button
        type="button"
        variant="glass"
        onClick={() => setShowInventoryAddItem(true)}
       >
        Add Item
       </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
       <Table className="text-xs text-left whitespace-nowrap">
        <TableHeader className="sticky top-0 z-10">
         <TableRow className="font-bold text-fg-secondary tracking-wider text-[10px]">
          <TableHead className="px-5 py-3.5">Code</TableHead>
          <TableHead className="px-5 py-3.5">Item</TableHead>
          <TableHead className="px-5 py-3.5">Category</TableHead>
          <TableHead className="px-5 py-3.5">Unit</TableHead>
          <TableHead className="px-5 py-3.5 text-right">Current Stock</TableHead>
          <TableHead className="px-5 py-3.5 text-right">Minimum Stock</TableHead>
          <TableHead className="px-5 py-3.5 text-center">Status</TableHead>
         </TableRow>
        </TableHeader>

        <TableBody>
         {inventoryPagination.paginatedItems.map((item: any) => {
          const current = Number(item.current_stock ?? 0);
          const minimum = Number(item.minimum_stock ?? 0);
          const isLow = current <= minimum;

          return (
           <TableRow key={item.item_id}>
            <TableCell className="px-5 py-3.5 font-mono font-semibold text-fg">
             {item.item_code || "-"}
            </TableCell>

            <TableCell className="px-5 py-3.5 font-semibold text-fg">
             {item.item_name || "-"}
            </TableCell>

            <TableCell className="px-5 py-3.5 text-fg-secondary">
             {item.category || "-"}
            </TableCell>

            <TableCell className="px-5 py-3.5 text-fg-secondary">
             {item.unit || "-"}
            </TableCell>

            <TableCell className="px-5 py-3.5 text-right font-semibold text-fg">
             {current}
            </TableCell>

            <TableCell className="px-5 py-3.5 text-right text-fg-secondary">
             {minimum}
            </TableCell>

            <TableCell className="px-5 py-3.5 text-center">
             <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold border ${
              isLow
               ? "bg-warning/10 text-warning border-warning/30"
               : "bg-success/10 text-success border-success/20"
             }`}>
              {isLow ? "LOW STOCK" : "OK"}
             </span>
            </TableCell>
           </TableRow>
          );
         })}

         {filteredInventoryItems.length === 0 && (
          <TableRow>
           <TableCell colSpan={7} className="p-10 text-center text-fg-muted font-medium">
            No inventory items found.
           </TableCell>
          </TableRow>
         )}
        </TableBody>
       </Table>
      </div>

      <div className="flex justify-end">
       <Pagination
        page={inventoryPagination.page}
        totalPages={inventoryPagination.totalPages}
        onPageChange={inventoryPagination.setPage}
       />
      </div>
     </div>
    </DialogBody>
   </DialogContent>
  </Dialog>
 )}

 {wTab === "Spare Parts Inventory" && (
 <div className="liquid-glass p-6 sm:p-8 shadow-xl max-w-6xl mx-auto animate-in slide-in-from-bottom-4">
  <div className="max-w-4xl mx-auto text-center py-8">
   <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Workshop Store</p>
   <h3 className="mt-2 text-xl font-semibold text-fg">Spare Parts Inventory</h3>
   <p className="mt-2 text-sm text-fg-secondary">
    Manage spare-part masters, purchases, issues, stock history, and low-stock items without keeping lists open on the main workspace.
   </p>

   <div className="mt-7 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
    <Button type="button" variant="default" onClick={() => setShowInventoryItems(true)}>
     Store Items
    </Button>

    <Button type="button" variant="glass" onClick={() => setShowInventoryAddItem(true)}>
     Add Item
    </Button>

    <Button type="button" variant="glass" onClick={() => setShowInventoryPurchase(true)}>
     Purchase Stock
    </Button>

    <Button type="button" variant="glass" onClick={() => setShowInventoryIssue(true)}>
     Issue Stock
    </Button>

    <Button type="button" variant="glass" onClick={() => setShowInventoryHistory(true)}>
     Stock History
    </Button>

    <Button type="button" variant="glass" onClick={() => setShowInventoryLowStock(true)}>
     Low Stock
    </Button>
   </div>

   <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
    <div className="kss-surface-raised rounded-xl border border-border p-4">
     <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Active Items</p>
     <p className="mt-1 text-2xl font-semibold text-fg">{inventoryItems.length}</p>
    </div>

    <div className="kss-surface-raised rounded-xl border border-border p-4">
     <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Stock Lines</p>
     <p className="mt-1 text-2xl font-semibold text-fg">{inventoryStock.length}</p>
    </div>

    <div className="kss-surface-raised rounded-xl border border-border p-4">
     <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Low Stock</p>
     <p className="mt-1 text-2xl font-semibold text-warning">
      {inventoryStock.filter((item) =>
       Number(item.current_stock ?? 0) <= Number(item.minimum_stock ?? 0)
      ).length}
     </p>
    </div>
   </div>
  </div>
 </div>
 )}

 {wTab === "Spares & Service Bills" && (
 <div className="liquid-glass p-6 sm:p-8 shadow-xl max-w-5xl mx-auto animate-in slide-in-from-bottom-4">
  <div className="max-w-3xl mx-auto text-center py-8">
   <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Workshop Accounts</p>
   <h3 className="mt-2 text-xl font-semibold text-fg">Spares & Service Bills</h3>
   <p className="mt-2 text-sm text-fg-secondary">Record workshop service expenses without keeping the full entry form open on the main workspace.</p>
   <div className="mt-6 flex flex-wrap justify-center gap-3">
    <Button type="button" variant="default" onClick={() => setShowServiceBillWorkspace(true)}>
     Log Service Bill
    </Button>
    <Button
     type="button"
     variant="glass"
     onClick={() => {
       setServiceBillSearch("");
       setShowServiceBillHistory(true);
     }}
    >
     Find Existing Bills ({serviceBills.length})
    </Button>
   </div>
  </div>
 </div>
 )}

 <Dialog
  open={showServiceBillHistory}
  onOpenChange={(open) => {
    setShowServiceBillHistory(open);
    if (!open) setServiceBillSearch("");
  }}
 >
  <DialogContent
   layout="modal"
   size="full"
   className="flex h-[92dvh] max-h-[92dvh] flex-col overflow-hidden p-0"
  >
   <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
    <DialogTitle>Workshop Service Bill History</DialogTitle>
    <p className="text-xs text-fg-muted">{filteredServiceBills.length} matching records</p>
   </DialogHeader>
   <DialogBody className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
    <div className="mx-auto max-w-[1450px] space-y-4">
     <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Input
       value={serviceBillSearch}
       onChange={(e) => setServiceBillSearch(e.target.value)}
       placeholder="Search bill no, truck, vendor, invoice, description or amount..."
       className="input-glass text-fg sm:max-w-xl"
      />
      <Button
       type="button"
       variant="glass"
       onClick={() => setShowServiceBillHistory(false)}
      >
       Close
      </Button>
     </div>

     <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
       <TableHeader>
        <TableRow>
         <TableHead>Bill No.</TableHead>
         <TableHead>Date</TableHead>
         <TableHead>Truck</TableHead>
         <TableHead>Vendor / Workshop</TableHead>
         <TableHead>Invoice</TableHead>
         <TableHead>Parts / Service</TableHead>
         <TableHead className="text-right">Amount</TableHead>
        </TableRow>
       </TableHeader>
       <TableBody>
        {serviceBillPagination.paginatedItems.map((bill: any) => (
         <TableRow key={bill.bill_id}>
          <TableCell className="font-mono font-semibold text-fg">#{bill.bill_id}</TableCell>
          <TableCell>{formatDate(bill.bill_date || "")}</TableCell>
          <TableCell className="font-semibold text-fg">{bill.vehicles?.vehicle_number || "-"}</TableCell>
          <TableCell>{bill.vendor_name || "-"}</TableCell>
          <TableCell>{bill.invoice_number || "-"}</TableCell>
          <TableCell className="min-w-[280px]">{bill.spare_parts_details || "-"}</TableCell>
          <TableCell className="text-right font-semibold text-danger">
           ₹{Number(bill.total_bill_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </TableCell>
         </TableRow>
        ))}
        {filteredServiceBills.length === 0 && (
         <TableRow>
          <TableCell colSpan={7} className="p-10 text-center text-fg-muted">
           No workshop service bills match your search.
          </TableCell>
         </TableRow>
        )}
       </TableBody>
      </Table>
     </div>

     <Pagination
      page={serviceBillPagination.page}
      totalPages={serviceBillPagination.totalPages}
      onPageChange={serviceBillPagination.setPage}
     />
    </div>
   </DialogBody>
  </DialogContent>
 </Dialog>

 <Dialog
  open={showServiceBillWorkspace}
  onOpenChange={setShowServiceBillWorkspace}
 >
  <DialogContent
   layout="modal"
   size="lg"
   className="flex max-h-[88dvh] flex-col overflow-hidden p-0"
  >
   <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
    <DialogTitle>Log Service Bill</DialogTitle>
   </DialogHeader>
   <DialogBody className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
    <form onSubmit={handleSaveBill} className="mx-auto max-w-3xl space-y-5">
     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Bill Date *</label><Input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="input-glass text-fg" required /></div>
      <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Select Truck *</label><Select value={wsTruckId} onChange={e => setWsTruckId(e.target.value)} className="input-glass text-fg" required><option value="">-- SELECT TRUCK --</option>{vehicles.map(v => <option key={v.vehicle_id} value={String(v.vehicle_id)}>{v.vehicle_number}</option>)}</Select></div>
     </div>
     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Vendor / Workshop Name *</label><Input type="text" maxLength={60} value={vendor} onChange={e => setVendor(e.target.value.toUpperCase())} className="input-glass text-fg" required /></div>
      <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Total Bill Amount *</label><Input type="number" min="1" max="1000000" value={amount} onChange={e => setAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} className="input-glass text-fg font-semibold text-danger" required /></div>
     </div>
     <div><label className="block text-[10px] font-bold text-fg-secondary mb-1">Parts & Service Description</label><Input type="text" maxLength={150} value={description} onChange={e => setDescription(e.target.value.toUpperCase())} placeholder="e.g. Engine oil change, 2 brake pads" className="input-glass text-fg" /></div>
     <Button type="submit" variant="default" disabled={isProcessing} className="w-full py-3.5 text-xs disabled:bg-surface-raised">
      {isProcessing ? "Saving..." : "Save Service Record"}
     </Button>
    </form>
   </DialogBody>
  </DialogContent>
 </Dialog>
 </div>
 );
}
