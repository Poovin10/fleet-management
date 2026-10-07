"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Button } from "@/components/ui/button";
import { BackgroundGeolocation } from "@capgo/background-geolocation";
import { generateUniversalPdf } from "@/lib/exportUniversalPdf";

const TRIP_ACTIONS = [
 { id: "START_TRIP", label: "Start Trip" },
 { id: "REACHED", label: "Reached Dest." },
 { id: "UNLOADED", label: "Unloaded" },
 { id: "RETURNING", label: "Returning" },
 { id: "WAITING_FOR_LOAD", label: "Complete Trip" },
 { id: "BREAKDOWN", label: "Breakdown" },
 { id: "FUEL", label: "Fuel Log" }
];

const KssLogo = ({ className }: { className?: string }) => (
 <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
 <rect width="200" height="200" fill="var(--accent)" />
 <rect x="15" y="15" width="170" height="170" fill="#FFFFFF" />
 <path d="M 50 35 L 50 165" stroke="var(--accent)" strokeWidth="24" strokeLinecap="square" />
 <path d="M 50 110 L 140 35" stroke="var(--accent)" strokeWidth="24" strokeLinecap="square" />
 <path d="M 85 85 C 130 95, 145 130, 145 165" stroke="var(--accent)" strokeWidth="24" fill="none" />
 </svg>
);

const FingerprintIcon = ({ className }: { className?: string }) => (
 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 0 0 4.5 10.5a7.464 7.464 0 0 1-1.15 3.993m1.989 3.559A11.209 11.209 0 0 0 8.25 10.5a3.75 3.75 0 1 1 7.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 0 1-3.6 9.75m6.633-4.596a18.666 18.666 0 0 1-2.485 5.33" />
 </svg>
);

export function DriverPortal() {
 const [supabase, setSupabase] = useState<any>(null);

 useEffect(() => {
 try { setSupabase(createClient()); } catch (err) { console.warn("Supabase init failed", err); }
 }, []);

 const [vehicles, setVehicles] = useState<any[]>([]);
 const [drivers, setDrivers] = useState<any[]>([]);
 const [activeTrips, setActiveTrips] = useState<any[]>([]);
 const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: "", message: "", type: "info" as "success" | "error" | "info" });
 const [cancelRequestId, setCancelRequestId] = useState<number | null>(null);
 const [isCancellingRequest, setIsCancellingRequest] = useState(false);
 const [isSwitchDriverConfirmOpen, setIsSwitchDriverConfirmOpen] = useState(false);
 const [isSwitchingDriver, setIsSwitchingDriver] = useState(false);
 const [savedDriverCode, setSavedDriverCode] = useState("");
 const [driverSessionToken, setDriverSessionToken] = useState("");
 const [enrolledBiometricDriver, setEnrolledBiometricDriver] = useState("");
 const [isDriverLocked, setIsDriverLocked] = useState(false);
 const [activeTab, setActiveTab] = useState<"STATUS" | "LEDGER">("STATUS");
 const [selectedTruckId, setSelectedTruckId] = useState("");
 const [driverCode, setDriverCode] = useState("");
 const [driverPin, setDriverPin] = useState("");
 const [actionType, setActionType] = useState("START_TRIP");
 const [odometer, setOdometer] = useState<number | "">("");
 const [lastOdometer, setLastOdometer] = useState<number | "">("");
 const [fuelLitres, setFuelLitres] = useState<number | "">("");
 const [remarks, setRemarks] = useState("");
 const [unloadedMt, setUnloadedMt] = useState<number | "">("");
 const [damagedBags, setDamagedBags] = useState<number | "">("");
 const [noWeighment, setNoWeighment] = useState(false);
 const [pendingRequests, setPendingRequests] = useState<any[]>([]);
 const [currentMonthTrips, setCurrentMonthTrips] = useState<any[]>([]);
 const [currentMonthAdvances, setCurrentMonthAdvances] = useState<any[]>([]);
 const [isSubmitting, setIsSubmitting] = useState(false);

 const formatDateTime = (dateStr: string) => {
 if (!dateStr) return 'N/A';
 try {
 const d = new Date(dateStr);
 if (isNaN(d.getTime())) return dateStr;
 return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
 } catch { return dateStr; }
 };

 const formatDate = (dateStr: string) => {
 if (!dateStr) return 'N/A';
 if (!dateStr.includes('-')) return dateStr;
 const parts = dateStr.split('T')[0].split('-');
 if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
 return dateStr;
 };

 const fetchPortalData = async () => {
 if (!supabase || !driverSessionToken) return;

 const { data, error } = await supabase.rpc("get_driver_portal_data", {
   p_session_token: driverSessionToken
 });

 if (error) {
   console.error("Failed to fetch driver portal data:", error);
   return;
 }

 setVehicles(data?.vehicles || []);
 setActiveTrips(data?.active_trips || []);
 };
 const fetchDriverCurrentMonthReports = async () => {
 if (!supabase || !driverSessionToken) return;

 const now = new Date();
 const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

 const { data, error } = await supabase.rpc("get_driver_monthly_reports", {
   p_session_token: driverSessionToken,
   p_month_start: firstDay
 });

 if (error) {
   console.error("Failed to fetch driver monthly reports:", error);
   return;
 }

 setPendingRequests(data?.pending_requests || []);
 setCurrentMonthTrips(data?.trips || []);
 setCurrentMonthAdvances(data?.advances || []);
 };
 useEffect(() => {
 if (!supabase) return;
 fetchPortalData();
 const enrolledBioDriver = localStorage.getItem("kss_biometric_enrolled_driver");
 if (enrolledBioDriver) setEnrolledBiometricDriver(enrolledBioDriver);
 }, [supabase]);

 const activeDriverObj = drivers.find(d => d.driver_code === savedDriverCode);
 const selectedTruckObj = vehicles.find(v => String(v.vehicle_id) === String(selectedTruckId));

 const sortedTrips = [...activeTrips].sort((a, b) => b.trip_id - a.trip_id);
 const latestAssignedTrip = sortedTrips.find(
   t =>
     String(t.vehicle_id) === String(selectedTruckId) &&
     String(t.primary_driver_id) === String(activeDriverObj?.driver_id)
 );
 const currentTrip = latestAssignedTrip || null;

 useEffect(() => {
 if (isDriverLocked && drivers.length > 0 && activeDriverObj) {
   const activeTrip = [...activeTrips]
     .filter(
       t =>
         String(t.primary_driver_id) === String(activeDriverObj.driver_id) &&
         String(t.vehicle_id) !== ""
     )
     .sort((a, b) => b.trip_id - a.trip_id)[0];

   if (activeTrip) setSelectedTruckId(String(activeTrip.vehicle_id));

   fetchDriverCurrentMonthReports();
 }
 }, [isDriverLocked, drivers, activeTrips, savedDriverCode, activeTab, activeDriverObj, driverSessionToken]);

 useEffect(() => {
if (selectedTruckId && supabase) {
const fetchLastOdo = async () => {
const { data, error } = await supabase.rpc(
"get_vehicle_current_odometer",
{ p_vehicle_id: Number(selectedTruckId) }
);

if (error) {
console.error("Failed to fetch authoritative odometer:", error);
setLastOdometer("");
return;
}

const currentOdo = Number(data || 0);
setLastOdometer(currentOdo > 0 ? currentOdo : "");
};

fetchLastOdo();
} else {
setLastOdometer("");
}
}, [selectedTruckId, supabase]);


 const displayDriverName = activeDriverObj ? `${activeDriverObj.full_name} (${activeDriverObj.driver_code})` : savedDriverCode;
 const isBulk = selectedTruckObj ? String(selectedTruckObj.truck_type).toUpperCase().includes("BULK") : true;

 const monthEarnedBata = currentMonthTrips.reduce((sum, t) => sum + (Number(t.driver_bata) || 0), 0);
 const monthHaltBata = currentMonthTrips.reduce((sum, t) => sum + (Number(t.halt_bata) || 0), 0);
 const monthTripAdvances = currentMonthTrips.reduce((sum, t) => sum + (Number(t.cash_advance_issued) || 0), 0);
 const monthDirectAdvances = currentMonthAdvances.reduce((sum, a) => sum + (Number(a.amount_inr) || 0), 0);
 const totalMonthEarnings = monthEarnedBata + monthHaltBata;
 const totalMonthDeductions = monthTripAdvances + monthDirectAdvances;
 const currentMonthNetBalance = totalMonthEarnings - totalMonthDeductions;

 const handleDownloadPortalLedger = () => {
 const headers = ["LR Number", "Date", "Route", "Bata ()", "Halt ()", "Trip Adv ()"];

 const rows = currentMonthTrips.map(t => [
 t.trip_number || '-',
 formatDate(t.trip_start_date),
 `${t.origin || 'N/A'} -> ${t.destination || 'N/A'}`,
 `Rs. ${Number(t.driver_bata || 0).toLocaleString('en-IN')}`,
 `Rs. ${Number(t.halt_bata || 0).toLocaleString('en-IN')}`,
 `Rs. ${Number(t.cash_advance_issued || 0).toLocaleString('en-IN')}`
 ]);

 const now = new Date();
 const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

 generateUniversalPdf(
 `Driver Statement: ${activeDriverObj?.full_name || savedDriverCode} (${savedDriverCode})`,
 `Monthly Period: ${currentMonthStr} | Net Balance: Rs. ${currentMonthNetBalance.toLocaleString('en-IN', {minimumFractionDigits: 2})}`,
 headers,
 rows,
 `Ledger_${savedDriverCode}_${currentMonthStr}`
 );
 };

 const handleManualFingerprint = async () => {
 setAlertConfig({
 isOpen: true,
 title: "PIN Login Required",
 message: "Biometric login will be available after secure driver session authentication is enabled.",
 type: "info"
 });
 };

 const handleLockDriver = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!supabase) return;

 const normalizedCode = driverCode.trim().toUpperCase();
 const normalizedPin = driverPin.trim();

 if (!normalizedCode) {
 return setAlertConfig({ isOpen: true, title: "Driver Code Required", message: "Enter your driver code.", type: "error" });
 }

 if (!/^\\d{4}$/.test(normalizedPin)) {
 return setAlertConfig({ isOpen: true, title: "Invalid PIN", message: "PIN must be exactly 4 digits.", type: "error" });
 }

 setIsSubmitting(true);

 const { data, error } = await supabase.rpc("authenticate_driver_session", {
 p_driver_code: normalizedCode,
 p_pin: normalizedPin
 });

 setIsSubmitting(false);

 if (error || !data || !data.length) {
 console.error("Driver authentication failed:", error);
 return setAlertConfig({
 title: "Login Failed",
 message: error?.message || "Invalid driver credentials.",
 type: "error",
 isOpen: true
 });
 }

 const authenticatedDriver = data[0];

 if (!authenticatedDriver.session_token) {
   console.error("Driver authentication succeeded without a session token");
   return setAlertConfig({
     title: "Login Failed",
     message: "Secure driver session could not be created.",
     type: "error",
     isOpen: true
   });
 }

 setDriverSessionToken(authenticatedDriver.session_token);
 setDrivers([authenticatedDriver]);
 setDriverCode(authenticatedDriver.driver_code);
 setSavedDriverCode(authenticatedDriver.driver_code);
 setIsDriverLocked(true);
 setDriverPin("");
 setEnrolledBiometricDriver("");

 await fetchDriverCurrentMonthReports();
 };

 const handleResetDriver = () => {
   if (!driverSessionToken) return;
   setIsSwitchDriverConfirmOpen(true);
 };

 const executeResetDriver = async () => {
 setIsSwitchingDriver(true);

 const sessionToken = driverSessionToken;

 if (supabase && sessionToken) {
 const { error } = await supabase.rpc("revoke_driver_session", {
   p_session_token: sessionToken
 });

 if (error) {
   console.error("Failed to revoke driver session:", error);
 }
 }

 setDriverSessionToken("");
 setIsDriverLocked(false);
 setSavedDriverCode("");
 setDrivers([]);
 setActiveTrips([]);
 setPendingRequests([]);
 setCurrentMonthTrips([]);
 setCurrentMonthAdvances([]);
 setSelectedTruckId("");
 setDriverCode("");
 setDriverPin("");
 setIsSwitchingDriver(false);
 setIsSwitchDriverConfirmOpen(false);
 };

 const handleDriverSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!supabase) return;
 if (!selectedTruckId) return setAlertConfig({ isOpen: true, title: "Truck Required", message: "Select active Truck.", type: "error" });

 setIsSubmitting(true);
 const timestamp = new Date().toISOString();

 if (actionType === "START_TRIP" && currentTrip) {
 const enteredOdometer = Number(odometer) || 0;

 const { error: tripError } = await supabase.rpc("start_driver_existing_trip_session_atomic", {
   p_session_token: driverSessionToken,
   p_trip_id: Number(currentTrip.trip_id),
   p_start_km: enteredOdometer > 0 ? enteredOdometer : null,
   p_reading_at: timestamp
 });

 if (tripError) {
   setIsSubmitting(false);
   return setAlertConfig({
     isOpen: true,
     title: "Trip Start Failed",
     message: tripError.message,
     type: "error"
   });
 }

 setAlertConfig({
   isOpen: true,
   title: "Trip Started",
   message: `${currentTrip.trip_number} is now in transit.`,
   type: "success"
 });

 setOdometer("");
 setRemarks("");
 setIsSubmitting(false);
 await fetchPortalData();
 return;
 }

 if (!currentTrip && actionType === "START_TRIP") {
 const draftLr = `DRAFT-${Math.floor(Date.now() / 1000)}`;

 const { error: tripError } = await supabase.rpc("start_driver_draft_trip_session_atomic", {
   p_session_token: driverSessionToken,
   p_trip_number: draftLr,
   p_vehicle_id: Number(selectedTruckId),
   p_trip_start_date: timestamp.split('T')[0],
   p_start_km: Number(odometer) || 0,
   p_reading_at: timestamp
 });
 if (tripError) { setIsSubmitting(false); return setAlertConfig({ isOpen: true, title: "Trip Error", message: tripError.message, type: "error" }); }

 setAlertConfig({ isOpen: true, title: "Trip Started", message: "Draft trip created! The office will attach paperwork later.", type: "success" });
 setOdometer(""); setRemarks(""); setIsSubmitting(false); await fetchPortalData();
 return;
 }

 if (!currentTrip && actionType === "FUEL") {
 const { error } = await supabase.rpc("submit_driver_fuel_pending_atomic", {
   p_session_token: driverSessionToken,
   p_vehicle_id: Number(selectedTruckId),
   p_litres: Number(fuelLitres),
   p_odometer_km: Number(odometer) || 0,
   p_receipt_remarks: `[LR: PRE-DISPATCH] ${remarks} [Truck: ${selectedTruckObj?.vehicle_number}]`.trim()
 });
 if (error) setAlertConfig({ isOpen: true, title: "Failed", message: error.message, type: "error" });
 else setAlertConfig({ isOpen: true, title: "Success", message: "Fuel request sent to dispatch!", type: "success" });
 setOdometer(""); setFuelLitres(""); setRemarks(""); setIsSubmitting(false); return;
 }

 if (!currentTrip) {
 setIsSubmitting(false);
 return setAlertConfig({ isOpen: true, title: "Action Not Allowed", message: "No active trip. You can only Start Trip or Log Fuel.", type: "error" });
 }

 if (actionType === "FUEL") {
 const { error } = await supabase.rpc("submit_driver_fuel_pending_atomic", {
   p_session_token: driverSessionToken,
   p_vehicle_id: Number(selectedTruckId),
   p_litres: Number(fuelLitres),
   p_odometer_km: Number(odometer) || 0,
   p_receipt_remarks: `[LR: ${currentTrip.trip_number}] ${remarks} [Truck: ${selectedTruckObj?.vehicle_number}]`.trim()
 });
 if (error) setAlertConfig({ isOpen: true, title: "Failed", message: error.message, type: "error" });
 else setAlertConfig({ isOpen: true, title: "Success", message: "Fuel request sent to dispatch!", type: "success" });
 }
 else {
 let updatePayload: any = {}; let finalRemarks = remarks; let vehicleStatusUpdate = "IN_TRANSIT"; let statusRemarksText = "";

 if (actionType === "REACHED") {
 updatePayload.reached_at = timestamp; updatePayload.trip_status = "REACHED_DESTINATION";
 vehicleStatusUpdate = "WAITING_FOR_UNLOAD";
 statusRemarksText = `Reached ${currentTrip.destination} — waiting for unload`;
 }
 else if (actionType === "UNLOADED") {
 updatePayload.unloaded_at = timestamp; updatePayload.trip_status = "UNLOADED";
 vehicleStatusUpdate = "UNLOADED";
 if (isBulk) {
 if (noWeighment) finalRemarks = `[NO WEIGHMENT] ${finalRemarks}`;
 else {
 updatePayload.unloaded_weight_mt = Number(unloadedMt);
 const loaded = Number(currentTrip.loaded_weight_mt) || 0;
 const shortage = Math.max(0, loaded - Number(unloadedMt));
 updatePayload.shortage_mt = shortage;
 if (shortage > 0.15) finalRemarks = ` [HIGH SHORTAGE: ${shortage.toFixed(3)} MT] ${finalRemarks}`;
 }
 } else finalRemarks = `[DAMAGED BAGS: ${damagedBags || 0}] ${finalRemarks}`;
 statusRemarksText = `Unloaded at ${currentTrip.destination}`;
 }
 else if (actionType === "RETURNING") {
 updatePayload.returning_at = timestamp; updatePayload.trip_status = "RETURNING";
 vehicleStatusUpdate = "RETURNING";
 statusRemarksText = `Returning from ${currentTrip.destination}`;
 }
 else if (actionType === "WAITING_FOR_LOAD") {
 const closingKm = Number(odometer) || 0;

 if (closingKm <= 0) {
   setIsSubmitting(false);
   return setAlertConfig({
     isOpen: true,
     title: "Closing KM Required",
     message: "Enter a valid closing odometer reading to complete the trip.",
     type: "error"
   });
 }

 const { error: closeTripError } = await supabase.rpc("close_driver_trip_session_atomic", {
   p_session_token: driverSessionToken,
   p_trip_id: Number(currentTrip.trip_id),
   p_end_km: closingKm,
   p_reading_at: timestamp
 });

 if (closeTripError) {
   setIsSubmitting(false);
   return setAlertConfig({
     isOpen: true,
     title: "Trip Closing Blocked",
     message: closeTripError.message,
     type: "error"
   });
 }

 vehicleStatusUpdate = "WAITING_FOR_LOAD";
 statusRemarksText = `Reached plant, waiting for load (${formatDateTime(timestamp)})`;
 updatePayload = {};
 }
 else if (actionType === "BREAKDOWN") {
 const breakdownKm = Number(odometer) || 0;

 const { error: breakdownError } = await supabase.rpc("record_driver_breakdown_session_atomic", {
   p_session_token: driverSessionToken,
   p_trip_id: Number(currentTrip.trip_id),
   p_vehicle_id: Number(selectedTruckId),
   p_odometer_km: breakdownKm,
   p_reading_at: timestamp,
   p_breakdown_remarks: finalRemarks || "Enroute Breakdown"
 });

 if (breakdownError) {
   setIsSubmitting(false);
   return setAlertConfig({
     isOpen: true,
     title: "Breakdown Update Blocked",
     message: breakdownError.message,
     type: "error"
   });
 }

 setAlertConfig({
   isOpen: true,
   title: "Breakdown Reported",
   message: "Breakdown recorded with authoritative odometer reading.",
   type: "success"
 });

 setOdometer("");
 setFuelLitres("");
 setRemarks("");
 setUnloadedMt("");
 setDamagedBags("");
 setIsSubmitting(false);
 await fetchPortalData();
 return;
 }

 const finalVehicleRemarks = (finalRemarks && (actionType === "UNLOADED" || actionType === "BREAKDOWN")) ? finalRemarks : statusRemarksText;

 if (actionType !== "WAITING_FOR_LOAD") {
   const { error: statusError } = await supabase.rpc("update_driver_trip_status_session_atomic", {
     p_session_token: driverSessionToken,
     p_trip_id: Number(currentTrip.trip_id),
     p_action: actionType,
     p_unloaded_weight_mt:
       actionType === "UNLOADED" && isBulk && !noWeighment
         ? Number(unloadedMt)
         : null,
     p_remarks: finalVehicleRemarks,
     p_reading_at: timestamp
   });

   if (statusError) {
     setIsSubmitting(false);
     return setAlertConfig({
       isOpen: true,
       title: "Status Update Blocked",
       message: statusError.message,
       type: "error"
     });
   }
 }

 if (actionType === "WAITING_FOR_LOAD") {
  setAlertConfig({
    isOpen: true,
    title: "Trip Completed",
    message: `Trip completed successfully. Vehicle is now available for the next load.`,
    type: "success"
  });
} else {
  setAlertConfig({
    isOpen: true,
    title: "Status Updated",
    message: `Trip status successfully updated!`,
    type: "success"
  });
}
 }

 setOdometer(""); setFuelLitres(""); setRemarks(""); setUnloadedMt(""); setDamagedBags(""); setIsSubmitting(false); await fetchPortalData();
 };

 const handleCancelRequest = (id: number) => {
   if (!supabase || !driverSessionToken) return;
   setCancelRequestId(id);
 };

 const executeCancelRequest = async () => {
   if (!supabase || !driverSessionToken || cancelRequestId === null) return;

   setIsCancellingRequest(true);

   const { error } = await supabase.rpc("cancel_driver_pending_entry_atomic", {
     p_session_token: driverSessionToken,
     p_entry_id: cancelRequestId
   });

   if (error) {
     setIsCancellingRequest(false);
     setCancelRequestId(null);
     setAlertConfig({
       isOpen: true,
       title: "Cancellation Failed",
       message: error.message,
       type: "error"
     });
     return;
   }

   await fetchDriverCurrentMonthReports();

   setIsCancellingRequest(false);
   setCancelRequestId(null);
   setAlertConfig({
     isOpen: true,
     title: "Cancelled",
     message: "Request cancelled.",
     type: "success"
   });
 };

 const inputStyle = "flex h-10 w-full rounded-md border border-border bg-app/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:border-accent";
 const labelStyle = "text-xs font-bold text-fg-secondary  tracking-wide leading-none mb-1";
 const numProps = { onWheel: (e: React.WheelEvent<HTMLInputElement>) => { e.preventDefault(); e.currentTarget.blur(); } };

 return (
 <div className="kss-driver-portal w-full max-w-sm rounded-2xl border border-border bg-surface shadow-lg relative mx-auto mt-4 overflow-hidden mb-10" style={{ colorScheme: "light" }}>

 <div className="bg-[var(--portal-dark)] px-6 py-4 flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm bg-surface"><KssLogo className="w-full h-full" /></div>
 <div><h1 className="text-sm font-bold text-[var(--portal-text-on-dark)] tracking-tight leading-none">KSS Roadways</h1><p className="text-[9px] text-accent font-bold  tracking-normal mt-0.5">Driver Portal</p></div>
 </div>
 </div>

 <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} />

 <ConfirmModal
   isOpen={cancelRequestId !== null}
   title="Cancel Request"
   message="Are you sure you want to cancel this request? This action cannot be undone."
   isDanger={true}
   confirmText="Yes, Cancel"
   onConfirm={executeCancelRequest}
   onCancel={() => {
     if (!isCancellingRequest) setCancelRequestId(null);
   }}
   isProcessing={isCancellingRequest}
 />

 <ConfirmModal
   isOpen={isSwitchDriverConfirmOpen}
   title="Switch Driver"
   message="Are you sure you want to sign out and switch to another driver?"
   confirmText="Yes, Switch Driver"
   onConfirm={executeResetDriver}
   onCancel={() => {
     if (!isSwitchingDriver) setIsSwitchDriverConfirmOpen(false);
   }}
   isProcessing={isSwitchingDriver}
 />

 {!isDriverLocked ? (
 <form onSubmit={handleLockDriver} className="flex flex-col">
 <div className="flex flex-col p-6 space-y-1">
 <h3 className="font-bold tracking-tight text-xl">Secure Driver Login</h3>
 <p className="text-sm text-fg-secondary">Enter your driver code and 4-digit security PIN.</p>
 </div>
 <div className="p-6 pt-0 grid gap-5">
 <div className="grid gap-1.5">
 <label className={labelStyle}>Driver Code</label>
 <input
 type="text"
 value={driverCode}
 onChange={e => setDriverCode(e.target.value.toUpperCase())}
 placeholder="e.g. DRV001"
 className={inputStyle}
 autoCapitalize="characters"
 autoComplete="username"
 required
 />
 </div>

 {driverCode && driverCode === enrolledBiometricDriver && (
 <div className="flex flex-col items-center justify-center py-2">
 <Button type="button" variant="ghost" onClick={handleManualFingerprint} className="relative flex items-center justify-center w-16 h-16 rounded-full group focus:outline-none transition-transform active:scale-95 p-0">
 <div className="absolute inset-0 rounded-full bg-accent/30 animate-ping opacity-75" style={{ animationDuration: '2.5s' }}></div>
 <div className="absolute inset-1.5 rounded-full bg-accent/10 group-hover:bg-accent/20 border border-accent/20 transition-all duration-300 shadow-[0_0_15px_var(--accent-glow)]"></div>
 <FingerprintIcon className="w-8 h-8 text-accent relative z-10 drop-shadow-sm group-hover:scale-105 transition-transform" />
 </Button>
 </div>
 )}

 <div className="grid gap-1.5 relative mt-2">
 <label className={labelStyle}>Security PIN</label>
 <input
 type="password"
 inputMode="numeric"
 pattern="[0-9]*"
 maxLength={4}
 value={driverPin}
 onChange={e => setDriverPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
 placeholder="••••"
 className={inputStyle}
 autoComplete="current-password"
 required
 />
 </div>

 <Button type="submit" variant="default" disabled={isSubmitting} className="w-full mt-2 h-10 rounded-lg text-sm font-bold bg-[var(--portal-accent)] text-[var(--portal-text-on-dark)] shadow-md hover:bg-[var(--portal-accent-hover)] disabled:opacity-50">
 {isSubmitting ? "Authenticating..." : "Verify & Login"}
 </Button>
 </div>
 </form>
 ) : (
 <div className="flex flex-col pb-4">
 <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-app">
 <div><p className="text-[10px] text-fg-secondary font-bold ">Active Driver</p><span className="text-sm font-bold text-fg">{displayDriverName}</span></div>
 <Button type="button" variant="ghost" size="xs" onClick={handleResetDriver} className="text-xs font-bold text-[var(--portal-accent)] hover:text-[var(--portal-accent-hover)] underline transition-colors p-0 h-auto">Switch</Button>
 </div>

 <div className="flex border-b border-border">
 <Button type="button" variant="ghost" onClick={() => setActiveTab("STATUS")} className={`flex-1 rounded-none py-3 h-auto text-[13px] font-bold ${activeTab === "STATUS" ? "border-b-2 border-accent text-accent" : "text-fg-muted hover:text-fg"}`}>Status</Button>
 <Button type="button" variant="ghost" onClick={() => setActiveTab("LEDGER")} className={`flex-1 rounded-none py-3 h-auto text-[13px] font-bold ${activeTab === "LEDGER" ? "border-b-2 border-accent text-accent" : "text-fg-muted hover:text-fg"}`}>Ledger</Button>
 </div>

 {activeTab === "STATUS" && (
 <form onSubmit={handleDriverSubmit} className="p-6 grid gap-5 animate-in fade-in">
 <div className="grid gap-1.5">
 <label className={labelStyle}>Active Truck</label>
 <select value={selectedTruckId} onChange={e => setSelectedTruckId(e.target.value)} className={inputStyle} required>
 <option value="">Select assigned vehicle...</option>
 {vehicles.map(v => (<option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number} ({v.truck_type})</option>))}
 </select>
 </div>

 {currentTrip ? (
 <div className="p-4 bg-[var(--portal-surface-accent)] border border-[var(--portal-border-accent)] rounded-2xl space-y-2">
 <div className="flex justify-between items-center"><span className="text-xs font-bold text-[var(--portal-accent-strong)]">Active LR: {currentTrip.trip_number}</span><span className="text-[10px] font-bold px-2 py-0.5 bg-[var(--portal-accent-soft)] text-[var(--portal-accent-strong)] rounded-full">{currentTrip.trip_status}</span></div>
 <p className="text-xs font-bold text-fg">{currentTrip.origin} {currentTrip.destination}</p>
 </div>
 ) : (
 <div className="p-4 bg-[var(--portal-surface-muted)] border border-[var(--portal-border)] rounded-2xl text-center">
 <p className="text-xs font-bold text-[var(--portal-text-on-dark)]/40">No active trip dispatched by office.</p>
 <p className="text-[11px] font-bold text-accent mt-1">You can start an unplanned trip from this truck.</p>
 </div>
 )}

 <div className="grid gap-1.5">
 <label className={labelStyle}>Update Lifecycle Status</label>
 <div className="grid grid-cols-2 gap-2">
 {TRIP_ACTIONS.map((item, idx, arr) => {
 const isStarted = item.id === "START_TRIP" && currentTrip?.trip_status === "IN_TRANSIT";
 return (
 <Button
 type="button" key={item.id} onClick={() => !isStarted && setActionType(item.id)} disabled={isStarted}
 className={`inline-flex items-center justify-center rounded-lg text-xs font-bold transition-all h-10 px-2 text-center border ${isStarted ? 'opacity-40 cursor-not-allowed bg-surface text-fg-muted border-border' : actionType === item.id ? 'bg-accent border-accent text-[var(--portal-text-on-dark)] shadow-md' : 'bg-surface text-fg border-border hover:bg-app'} ${idx === arr.length - 1 ? 'col-span-2' : ''}`}
 >
 {isStarted ? "Started" : item.label}
 </Button>
 );
 })}
 </div>
 </div>

 <div className="space-y-4">
 {(actionType === "START_TRIP" || actionType === "WAITING_FOR_LOAD" || actionType === "FUEL" || actionType === "BREAKDOWN") && (
 <div className="grid gap-1.5"><label className={labelStyle}>Odometer (KM)</label><input type="number" min={lastOdometer ? lastOdometer : 0} value={odometer} onChange={e => setOdometer(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder={lastOdometer ? `Previous: ${lastOdometer}` : "e.g. 145230"} className={inputStyle} required {...numProps}/></div>
 )}
 {actionType === "FUEL" && <div className="grid gap-1.5"><label className={labelStyle}>Litres Filled</label><input type="number" step="any" min="0.1" value={fuelLitres} onChange={e => setFuelLitres(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.0" className={inputStyle} required {...numProps}/></div>}
 {actionType === "UNLOADED" && (
 <div className="bg-[var(--portal-surface-accent)] border border-[var(--portal-border-accent)] p-3 rounded-xl space-y-3">
 {isBulk ? (
 <><div className="grid gap-1.5"><label className="text-xs font-bold text-[var(--portal-accent-strong)] ">Unloaded Weight (MT)</label><input type="number" step="any" min="0" value={unloadedMt} onChange={e => setUnloadedMt(e.target.value === "" ? "" : parseFloat(e.target.value))} disabled={noWeighment} placeholder={noWeighment ? "N/A" : "e.g. 30.50"} className={inputStyle} required={!noWeighment} {...numProps}/></div>
 <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={noWeighment} onChange={(e) => setNoWeighment(e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent border-border-strong" /><span className="text-xs font-bold text-warning">No weighment facility</span></label></>
 ) : ( <div className="grid gap-1.5"><label className="text-xs font-bold text-[var(--portal-accent-strong)] ">Damaged Bags Count</label><input type="number" min="0" value={damagedBags} onChange={e => setDamagedBags(e.target.value === "" ? "" : parseInt(e.target.value))} placeholder="0" className={inputStyle} required {...numProps}/></div> )}
 </div>
 )}
 {(actionType === "BREAKDOWN" || actionType === "UNLOADED") && <div className="grid gap-1.5"><label className={labelStyle}>Remarks</label><input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional details..." className={inputStyle} required={actionType === "BREAKDOWN"} /></div>}
 <Button type="submit" variant="default" disabled={isSubmitting} className="w-full mt-2 h-12 rounded-lg text-sm font-bold bg-[var(--portal-accent)] text-[var(--portal-text-on-dark)] shadow-md hover:bg-[var(--portal-accent-hover)] disabled:opacity-50">
 {isSubmitting
  ? "Processing..."
  : actionType === "WAITING_FOR_LOAD"
    ? "Complete Trip"
    : "Confirm Status Update"}
 </Button>
 </div>
 </form>
 )}

 {activeTab === "LEDGER" && (
 <div className="p-6 grid gap-6 bg-app min-h-[400px] animate-in fade-in">
 <div className="p-4 bg-[var(--portal-dark)] text-[var(--portal-text-on-dark)] rounded-2xl shadow-sm space-y-3">
 <div>
 <p className="text-[10px] font-bold  tracking-normal text-[var(--portal-dark-muted)]">Current Month Net Balance</p>
 <div className="flex justify-between items-baseline mt-1"><span className={`text-2xl font-bold ${currentMonthNetBalance >= 0 ? 'text-[var(--portal-success)]' : 'text-[var(--portal-danger)]'}`}>{currentMonthNetBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span><span className="text-[10px] text-[var(--portal-dark-muted)]">{currentMonthNetBalance >= 0 ? 'Net Payable' : 'Deficit'}</span></div>
 </div>
 <div className="pt-3 border-t border-[var(--portal-dark-border)] grid grid-cols-2 text-[11px] text-[var(--portal-dark-muted)]">
 <div>Earned Bata: <strong className="text-[var(--portal-text-on-dark)]">{monthEarnedBata}</strong></div><div>Halt Bata (Exp): <strong className="text-[var(--portal-warning)]">{monthHaltBata}</strong></div>
 <div className="col-span-2 mt-1">Total Deductions (Advances): <strong className="text-[var(--portal-danger)]">{totalMonthDeductions}</strong></div>
 </div>

 <Button
 type="button"
 onClick={handleDownloadPortalLedger}
 className="w-full mt-2 bg-[var(--portal-accent)] hover:bg-[var(--portal-accent-hover)] text-[var(--portal-text-on-dark)] font-bold text-xs py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2  tracking-wide"
 >
 Download Statement PDF
 </Button>
 </div>

 {pendingRequests.length > 0 && (
 <div>
 <h4 className="text-xs font-bold text-fg  mb-3">Pending Requests</h4>
 <div className="space-y-3">
 {pendingRequests.map(r => (
 <div key={r.entry_id} className="p-3 bg-surface border border-border rounded-xl shadow-sm">
 <div className="flex justify-between items-start mb-1">
 <span className="text-xs font-bold text-fg">{r.entry_type} - {r.entry_type === 'FUEL' ? `${r.litres}L` : r.entry_type === 'START_TRIP' ? `${r.odometer_km} KM` : `${r.amount_inr}`}</span>
 <span className="text-[9px] font-bold  px-2 py-0.5 rounded bg-[var(--portal-accent-soft)] text-[var(--portal-accent-strong)]">{r.status}</span>
 </div>
 <div className="flex justify-end mt-2"><Button type="button" variant="ghost" size="xs" onClick={() => handleCancelRequest(r.entry_id)} className="px-2.5 py-1 h-auto text-[10px] font-bold text-[var(--portal-danger)] bg-[var(--portal-surface)] border border-[var(--portal-border)] rounded-lg transition-colors">Cancel Request</Button></div>
 </div>
 ))}
 </div>
 </div>
 )}

 <div>
 <h4 className="text-xs font-bold text-fg  mb-3">Current Month Tripwise Ledger</h4>
 {currentMonthTrips.length === 0 ? (
 <p className="text-xs text-fg-secondary italic">No trips logged this month yet.</p>
 ) : (
 <div className="space-y-3">
 {currentMonthTrips.map(t => {
 const tripBata = Number(t.driver_bata) || 0; const halt = Number(t.halt_bata) || 0; const adv = Number(t.cash_advance_issued) || 0;
 return (
 <div key={t.trip_id} className="animate-tab-focus p-3 bg-surface border border-border rounded-xl shadow-sm space-y-2">
 <div className="flex justify-between items-start border-b border-border pb-2">
 <div><p className="text-sm font-bold text-fg">{t.trip_number}</p><p className="text-[10px] font-bold text-fg-secondary truncate max-w-[150px]">{t.origin} {t.destination}</p></div>
 <span className="text-[10px] font-bold px-2 py-0.5 bg-surface-raised text-fg rounded">{formatDate(t.trip_start_date)}</span>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 text-[11px] text-fg-secondary">
 <div>Bata: <strong className="text-[var(--portal-success)]">{tripBata}</strong></div><div>Halt: <strong className="text-[var(--portal-warning)]">{halt}</strong></div><div>Adv: <strong className="text-[var(--portal-danger)]">{adv}</strong></div>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 );
}
