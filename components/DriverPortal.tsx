"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";
import { NativeBiometric } from "capacitor-native-biometric";

const KssLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="200" height="200" fill="#FF5A00" />
    <rect x="15" y="15" width="170" height="170" fill="#FFFFFF" />
    <path d="M 50 35 L 50 165" stroke="#FF5A00" strokeWidth="24" strokeLinecap="square" />
    <path d="M 50 110 L 140 35" stroke="#FF5A00" strokeWidth="24" strokeLinecap="square" />
    <path d="M 85 85 C 130 95, 145 130, 145 165" stroke="#FF5A00" strokeWidth="24" fill="none" />
  </svg>
);

export function DriverPortal() {
  const supabase = createClient();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: "", message: "", type: "info" as "success" | "error" | "info" });

  const [savedDriverCode, setSavedDriverCode] = useState("");
  const [isDriverLocked, setIsDriverLocked] = useState(false);
  const [activeTab, setActiveTab] = useState<"STATUS" | "LEDGER">("STATUS");

  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [driverCode, setDriverCode] = useState("");
  const [driverPin, setDriverPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);
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

  const [complianceWarnings, setComplianceWarnings] = useState<any[]>([]);

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
    const [vRes, dRes, tRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('is_active', true),
      supabase.from('drivers').select('*').eq('is_active', true),
      supabase.from('trips').select('trip_id, vehicle_id, trip_number, origin, destination, primary_driver_id, loaded_weight_mt, trip_status, trip_start_date, reached_at, unloaded_at, returning_at, start_km').neq('trip_status', 'COMPLETED')
    ]);

    if (vRes.data) setVehicles(vRes.data);
    if (dRes.data) setDrivers(dRes.data);
    if (tRes.data) setActiveTrips(tRes.data);
  };

  const fetchDriverCurrentMonthReports = async (drvCode: string, drvId: number) => {
    const now = new Date();
    const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const [reqRes, tripRes, advRes] = await Promise.all([
      supabase.from('driver_pending_entries').select('*').eq('driver_code', drvCode).order('submitted_at', { ascending: false }).limit(10),
      supabase.from('trips').select('*').eq('primary_driver_id', drvId).gte('trip_start_date', firstDay).order('trip_start_date', { ascending: false }),
      supabase.from('driver_direct_advances').select('*').eq('driver_id', drvId).gte('advance_date', firstDay).order('advance_date', { ascending: false })
    ]);

    if (reqRes.data) setPendingRequests(reqRes.data);
    if (tripRes.data) setCurrentMonthTrips(tripRes.data);
    if (advRes.data) setCurrentMonthAdvances(advRes.data);
  };

  useEffect(() => {
    fetchPortalData();
    const storedDriver = localStorage.getItem("kss_device_driver");
    if (storedDriver) {
      setSavedDriverCode(storedDriver);
      setDriverCode(storedDriver);
      setIsDriverLocked(true);
    }
  }, []);

  const activeDriverObj = drivers.find(d => d.driver_code === savedDriverCode);
  const selectedTruckObj = vehicles.find(v => String(v.vehicle_id) === String(selectedTruckId));
  const currentTrip = activeTrips.find(t => String(t.vehicle_id) === String(selectedTruckId));

  useEffect(() => {
    if (isDriverLocked && drivers.length > 0 && activeDriverObj) {
      if (activeTrips.length > 0) {
        const activeTrip = activeTrips.find(t => String(t.primary_driver_id) === String(activeDriverObj.driver_id));
        if (activeTrip) setSelectedTruckId(String(activeTrip.vehicle_id));
      }
      fetchDriverCurrentMonthReports(savedDriverCode, activeDriverObj.driver_id);
    }
  }, [isDriverLocked, drivers, activeTrips, savedDriverCode, activeTab, activeDriverObj]);

  useEffect(() => {
    if (selectedTruckId) {
      const fetchLastOdo = async () => {
        const [tripData, fuelData, pendingData] = await Promise.all([
          supabase.from("trips").select("end_km, start_km").eq("vehicle_id", selectedTruckId).order("trip_id", { ascending: false }).limit(1),
          supabase.from("diesel_fuel_logs").select("filling_odometer_km").eq("vehicle_id", selectedTruckId).order("fuel_log_id", { ascending: false }).limit(1),
          supabase.from("driver_pending_entries").select("odometer_km").eq("vehicle_id", selectedTruckId).order("submitted_at", { ascending: false }).limit(1)
        ]);
        
        let maxOdo = 0;
        if (tripData.data && tripData.data.length > 0) maxOdo = Math.max(maxOdo, Number(tripData.data[0].end_km || 0), Number(tripData.data[0].start_km || 0));
        if (fuelData.data && fuelData.data.length > 0) maxOdo = Math.max(maxOdo, Number(fuelData.data[0].filling_odometer_km || 0));
        if (pendingData.data && pendingData.data.length > 0) maxOdo = Math.max(maxOdo, Number(pendingData.data[0].odometer_km || 0));
        
        setLastOdometer(maxOdo > 0 ? maxOdo : "");
      };
      fetchLastOdo();
    } else {
      setLastOdometer("");
    }
  }, [selectedTruckId, activeTrips, pendingRequests]);

  useEffect(() => {
    const isStartPending = pendingRequests.some(r => r.entry_type === "START_TRIP" && r.status === "PENDING" && String(r.vehicle_id) === String(selectedTruckId));
    const isStarted = (currentTrip && currentTrip.start_km > 0) || isStartPending;
    
    if (isStarted && actionType === "START_TRIP") {
       if (currentTrip?.trip_status === "IN_TRANSIT") setActionType("REACHED");
       else if (currentTrip?.trip_status === "REACHED_DESTINATION") setActionType("UNLOADED");
       else if (currentTrip?.trip_status === "UNLOADED") setActionType("RETURNING");
       else if (currentTrip?.trip_status === "RETURNING") setActionType("WAITING_FOR_LOAD");
       else setActionType("FUEL");
    } else if (!isStarted && !currentTrip) {
       setActionType("START_TRIP");
    }
  }, [currentTrip, pendingRequests, selectedTruckId, actionType]);

  useEffect(() => {
    const warnings: any[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tenDaysFromNow = new Date(today); tenDaysFromNow.setDate(today.getDate() + 10);

    const checkWarning = (name: string, docName: string, dateVal: string) => {
      if (!dateVal) return;
      const expDate = new Date(dateVal); expDate.setHours(0, 0, 0, 0);
      if (expDate <= tenDaysFromNow) warnings.push({ name, docName, date: dateVal, isUrgent: expDate <= today });
    };

    if (activeDriverObj) checkWarning("Your", "Driving License", activeDriverObj.license_expiry_date);
    if (selectedTruckObj) {
      const tName = `Truck ${selectedTruckObj.vehicle_number}`;
      checkWarning(tName, "FC", selectedTruckObj.fc_expiry_date);
      checkWarning(tName, "Insurance", selectedTruckObj.insurance_expiry_date);
      checkWarning(tName, "Q-Tax", selectedTruckObj.qtax_expiry_date);
      checkWarning(tName, "PUC", selectedTruckObj.puc_expiry_date);
      checkWarning(tName, "NP", selectedTruckObj.np_expiry_date);
      checkWarning(tName, "State Permit", selectedTruckObj.state_permit_expiry_date);
      if (String(selectedTruckObj.truck_type).toUpperCase().includes("BULK")) checkWarning(tName, "Tank Cert", selectedTruckObj.tank_cert_expiry_date);
    }
    setComplianceWarnings(warnings);
  }, [activeDriverObj, selectedTruckObj]);

  const handleDriverChange = (code: string) => {
    setDriverCode(code); setDriverPin(""); setConfirmPin("");
    if (code) {
      const drv = drivers.find(d => d.driver_code === code);
      setIsFirstTimeSetup(!drv || !drv.pin || drv.pin.trim() === "");
    } else setIsFirstTimeSetup(false);
  };

  const displayDriverName = activeDriverObj ? `${activeDriverObj.full_name} (${activeDriverObj.driver_code})` : savedDriverCode;
  const isBulk = selectedTruckObj ? String(selectedTruckObj.truck_type).toUpperCase().includes("BULK") : true;

  const monthEarnedBata = currentMonthTrips.reduce((sum, t) => sum + (Number(t.driver_bata) || 0), 0);
  const monthHaltBata = currentMonthTrips.reduce((sum, t) => sum + (Number(t.halt_bata) || 0), 0);
  const monthTripAdvances = currentMonthTrips.reduce((sum, t) => sum + (Number(t.cash_advance_issued) || 0), 0);
  const monthDirectAdvances = currentMonthAdvances.reduce((sum, a) => sum + (Number(a.amount_inr) || 0), 0);
  
  const totalMonthEarnings = monthEarnedBata + monthHaltBata;
  const totalMonthDeductions = monthTripAdvances + monthDirectAdvances;
  const currentMonthNetBalance = totalMonthEarnings - totalMonthDeductions;

  // Fingerprint / Biometric Login Verification
  const handleFingerprintLogin = async () => {
    if (!driverCode) return setAlertConfig({ isOpen: true, title: "Missing Detail", message: "Please select your profile first.", type: "error" });
    const selectedDrv = drivers.find(d => d.driver_code === driverCode);
    if (!selectedDrv) return;

    try {
      const result = await NativeBiometric.verifyIdentity({
        reason: "Verify your identity to log in to KSS Roadways",
        title: "Driver Authentication",
        subtitle: "Use fingerprint to login securely",
        description: "Touch the sensor to confirm your profile",
      });

      if (result) {
        localStorage.setItem("kss_device_driver", driverCode.toUpperCase().trim());
        setSavedDriverCode(driverCode.toUpperCase().trim());
        setIsDriverLocked(true); 
        setDriverPin(""); 
        setConfirmPin("");
        setAlertConfig({ isOpen: true, title: "Success", message: "Fingerprint verified successfully!", type: "success" });
      }
    } catch (error) {
      console.error("Biometric authentication failed:", error);
      setAlertConfig({ isOpen: true, title: "Authentication Failed", message: "Fingerprint verification cancelled or failed. Use PIN instead.", type: "error" });
    }
  };

  const handleLockDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverCode) return setAlertConfig({ isOpen: true, title: "Missing Detail", message: "Please select your profile.", type: "error" });
    const selectedDrv = drivers.find(d => d.driver_code === driverCode);
    if (!selectedDrv) return;

    if (isFirstTimeSetup) {
      if (driverPin.length !== 4) return setAlertConfig({ isOpen: true, title: "Invalid PIN", message: "PIN must be exactly 4 digits.", type: "error" });
      if (driverPin !== confirmPin) return setAlertConfig({ isOpen: true, title: "Mismatch", message: "PINs do not match.", type: "error" });

      const { error } = await supabase.from('drivers').update({ pin: driverPin }).eq('driver_id', selectedDrv.driver_id);
      if (error) return setAlertConfig({ isOpen: true, title: "Setup Failed", message: error.message, type: "error" });
      setAlertConfig({ isOpen: true, title: "PIN Saved!", message: "Your security PIN has been successfully set.", type: "success" });
      await fetchPortalData();
    } else {
      if (driverPin.trim() !== (selectedDrv.pin || "").toString().trim()) return setAlertConfig({ isOpen: true, title: "Invalid PIN", message: "Incorrect PIN.", type: "error" });
    }

    localStorage.setItem("kss_device_driver", driverCode.toUpperCase().trim());
    setSavedDriverCode(driverCode.toUpperCase().trim());
    setIsDriverLocked(true); setDriverPin(""); setConfirmPin("");
  };

  const handleResetDriver = () => {
    if (confirm("Switch driver profile on this device?")) {
      localStorage.removeItem("kss_device_driver");
      setIsDriverLocked(false); setSavedDriverCode(""); setSelectedTruckId(""); setDriverPin(""); setConfirmPin("");
    }
  };

  const executeStatusUpdate = async () => {
    setIsSubmitting(true);
    const timestamp = new Date().toISOString();
    const truckNumberText = selectedTruckObj ? selectedTruckObj.vehicle_number : "Unknown";

    if (!currentTrip && actionType !== "FUEL" && actionType !== "START_TRIP") {
      setIsSubmitting(false);
      return setAlertConfig({ 
        isOpen: true, title: "No Active Trip", 
        message: "The office has not dispatched a trip for this truck yet. You can only log Fuel or Start Trip.", 
        type: "error" 
      });
    }

    if (actionType === "FUEL" || (!currentTrip && actionType === "START_TRIP")) {
      const activeLr = currentTrip ? currentTrip.trip_number : "PRE-DISPATCH";
      
      const payloadObj = {
        vehicle_id: Number(selectedTruckId),
        driver_code: savedDriverCode || "DRV-MOBILE",
        entry_type: actionType,
        litres: actionType === "FUEL" ? Number(fuelLitres) : null,
        amount_inr: 0,
        odometer_km: Number(odometer) || 0,
        receipt_remarks: `[LR: ${activeLr}] ${remarks} [Truck: ${truckNumberText}]`.trim(),
        status: 'PENDING'
      };

      const { error } = await supabase.from('driver_pending_entries').insert([payloadObj]);

      if (error) {
        setAlertConfig({ isOpen: true, title: "Failed", message: error.message, type: "error" });
      } else {
        const msg = actionType === "FUEL" ? "Fuel fill request sent to dispatch!" : "Start Odometer logged! Waiting for office dispatch.";
        setAlertConfig({ isOpen: true, title: "Success", message: msg, type: "success" });
      }
    } 
    else if (currentTrip) {
        let updatePayload: any = {}; let finalRemarks = remarks; let vehicleStatusUpdate = "IN_TRANSIT"; let statusRemarksText = "";

        if (actionType === "START_TRIP") { 
          updatePayload.trip_status = "IN_TRANSIT"; updatePayload.start_km = Number(odometer) || 0; statusRemarksText = `Started trip from ${currentTrip.origin} at ${formatDateTime(timestamp)}`;
        }
        else if (actionType === "REACHED") { 
          updatePayload.reached_at = timestamp; updatePayload.trip_status = "REACHED_DESTINATION"; statusRemarksText = `Reached ${currentTrip.destination} at ${formatDateTime(timestamp)}`;
        }
        else if (actionType === "UNLOADED") { 
          updatePayload.unloaded_at = timestamp; updatePayload.trip_status = "UNLOADED"; 
          if (isBulk) {
            if (noWeighment) finalRemarks = `[NO WEIGHMENT] ${finalRemarks}`;
            else {
              updatePayload.unloaded_weight_mt = Number(unloadedMt);
              const loaded = Number(currentTrip.loaded_weight_mt) || 0;
              const shortage = Math.max(0, loaded - Number(unloadedMt));
              updatePayload.shortage_mt = shortage;
              if (shortage > 0.15) finalRemarks = `🚨 [HIGH SHORTAGE: ${shortage.toFixed(3)} MT] ${finalRemarks}`;
            }
          } else finalRemarks = `[DAMAGED BAGS: ${damagedBags || 0}] ${finalRemarks}`;
          statusRemarksText = `Unloaded at ${currentTrip.destination}`;
        }
        else if (actionType === "RETURNING") { 
          updatePayload.returning_at = timestamp; updatePayload.trip_status = "RETURNING"; statusRemarksText = `Returning from ${currentTrip.destination}`;
        }
        else if (actionType === "WAITING_FOR_LOAD") {
          updatePayload.trip_status = "WAITING_FOR_LOAD"; updatePayload.end_km = Number(odometer) || 0;
          const startKm = Number(currentTrip.start_km) || 0;
          if (startKm > 0 && Number(odometer) > startKm) updatePayload.total_km_run = Number(odometer) - startKm;
          vehicleStatusUpdate = "WAITING_FOR_LOAD"; statusRemarksText = `Reached plant, waiting for load (${formatDateTime(timestamp)})`;
        }
        else if (actionType === "BREAKDOWN") { 
          updatePayload.breakdown_remarks = `${finalRemarks} [Odo: ${odometer}]`; updatePayload.trip_status = "BREAKDOWN"; 
          vehicleStatusUpdate = "WORKSHOP_MAINTENANCE"; statusRemarksText = `Enroute Breakdown`;
        }

        if (finalRemarks && (actionType === "UNLOADED" || actionType === "BREAKDOWN")) updatePayload.status_remarks = finalRemarks;
        else updatePayload.status_remarks = statusRemarksText;

        const { error: rpcError } = await supabase.rpc('update_trip_status_atomic', {
          p_trip_id: currentTrip.trip_id, p_vehicle_id: selectedTruckId, p_payload: updatePayload, p_vehicle_status: vehicleStatusUpdate, p_vehicle_remarks: statusRemarksText
        });
        if (rpcError) { setIsSubmitting(false); return setAlertConfig({ isOpen: true, title: "Failed", message: rpcError.message, type: "error" }); }
        
        setAlertConfig({ isOpen: true, title: "Status Updated", message: `Trip status successfully updated!`, type: "success" });
    }

    setOdometer(""); setFuelLitres(""); setRemarks(""); setUnloadedMt(""); setDamagedBags(""); setIsSubmitting(false); await fetchPortalData(); 
  };

  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTruckId) return setAlertConfig({ isOpen: true, title: "Truck Required", message: "Select active Truck.", type: "error" });

    // Enforce Biometric Authentication for High-Priority Actions (Breakdown or Unloaded or Start)
    if (actionType === "BREAKDOWN" || actionType === "UNLOADED" || actionType === "START_TRIP") {
      try {
        const bioResult = await NativeBiometric.verifyIdentity({
          reason: `Authorize ${actionType.replace('_', ' ')} action securely`,
          title: "Driver Verification",
          subtitle: "Confirm action with fingerprint",
          description: "Touch the sensor to submit update",
        });
        if (bioResult) {
          await executeStatusUpdate();
        }
      } catch (err) {
        setAlertConfig({ isOpen: true, title: "Verification Cancelled", message: "Fingerprint verification is required to submit this milestone.", type: "error" });
      }
    } else {
      await executeStatusUpdate();
    }
  };

  const handleCancelRequest = async (id: number) => {
    if (!confirm("Delete this request?")) return;
    await supabase.from('driver_pending_entries').delete().eq('entry_id', id);
    if (activeDriverObj) fetchDriverCurrentMonthReports(savedDriverCode, activeDriverObj.driver_id);
    setAlertConfig({ isOpen: true, title: "Deleted", message: "Request cancelled.", type: "success" });
  };

  const inputStyle = "flex h-10 w-full rounded-md border border-border bg-app/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5A00] focus-visible:border-[#FF5A00]";
  const labelStyle = "text-xs font-bold text-fg-secondary uppercase tracking-wide leading-none mb-1";
  const numProps = { onWheel: (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur() };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-surface text-slate-950 shadow-lg relative mx-auto mt-4 overflow-hidden mb-10" style={{ colorScheme: 'light' }}>
      <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm bg-surface"><KssLogo className="w-full h-full" /></div>
          <div><h1 className="text-sm font-bold text-white tracking-tight leading-none">KSS Roadways</h1><p className="text-[9px] text-[#FF5A00] font-bold uppercase tracking-widest mt-0.5">Driver Portal</p></div>
        </div>
      </div>

      <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} />

      {!isDriverLocked ? (
        <form onSubmit={handleLockDriver} className="flex flex-col">
          <div className="flex flex-col p-6 space-y-1">
            <h3 className="font-bold tracking-tight text-xl">{isFirstTimeSetup ? "First-Time PIN Setup" : "Secure Login"}</h3>
            <p className="text-sm text-fg-secondary">{isFirstTimeSetup ? "Create a 4-digit security PIN for your account. Keep it safe!" : "Select your profile and enter your PIN or use fingerprint."}</p>
          </div>
          <div className="p-6 pt-0 grid gap-5">
            <div className="grid gap-1.5">
              <label className={labelStyle}>Driver Name</label>
              <select value={driverCode} onChange={e => handleDriverChange(e.target.value)} className={inputStyle} required>
                <option value="">Select your profile...</option>
                {drivers.map(d => (<option key={d.driver_id} value={d.driver_code}>{d.full_name} ({d.driver_code})</option>))}
              </select>
            </div>
            
            {!isFirstTimeSetup && (
              <button 
                type="button" 
                onClick={handleFingerprintLogin}
                className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:bg-slate-800 transition-all"
              >
                🔓 Tap to Login with Fingerprint
              </button>
            )}

            <div className="grid gap-1.5">
              <label className={labelStyle}>{isFirstTimeSetup ? "Create 4-Digit PIN" : "Or Enter Security PIN"}</label>
              <input type="password" maxLength={4} value={driverPin} onChange={e => setDriverPin(e.target.value)} placeholder="••••" className={inputStyle} required={isFirstTimeSetup} />
            </div>
            {isFirstTimeSetup && (
              <div className="grid gap-1.5"><label className={labelStyle}>Confirm 4-Digit PIN</label><input type="password" maxLength={4} value={confirmPin} onChange={e => setConfirmPin(e.target.value)} placeholder="••••" className={inputStyle} required /></div>
            )}
            {!isFirstTimeSetup && driverCode && <p className="text-[11px] text-fg-muted italic">Forgot your PIN? Contact office Admin to reset it.</p>}
            <button type="submit" className="inline-flex items-center justify-center rounded-lg text-sm font-bold bg-[#FF5A00] text-white shadow-md hover:bg-[#e04f00] h-10 px-4 py-2 w-full mt-2">
              {isFirstTimeSetup ? "Save & Lock Device" : "Verify & Login with PIN"}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col pb-4">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-app">
            <div><p className="text-[10px] text-fg-secondary font-bold uppercase">Active Driver</p><span className="text-sm font-bold text-fg">{displayDriverName}</span></div>
            <button type="button" onClick={handleResetDriver} className="text-xs font-bold text-[#FF5A00] hover:text-[#e04f00] underline transition-colors">Switch</button>
          </div>

          <div className="flex border-b border-border">
            <button onClick={() => setActiveTab("STATUS")} className={`flex-1 py-3 text-sm font-bold ${activeTab === "STATUS" ? "border-b-2 border-[#FF5A00] text-[#FF5A00]" : "text-fg-muted hover:text-fg"}`}>🚀 Trip Status</button>
            <button onClick={() => setActiveTab("LEDGER")} className={`flex-1 py-3 text-sm font-bold ${activeTab === "LEDGER" ? "border-b-2 border-[#FF5A00] text-[#FF5A00]" : "text-fg-muted hover:text-fg"}`}>📊 Month Ledger</button>
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

              {complianceWarnings.length > 0 && (
                <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded-xl space-y-1 mb-2 animate-in slide-in-from-top-2">
                  <h4 className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-1">⚠️ Compliance Warnings</h4>
                  {complianceWarnings.map((w, i) => (
                    <p key={i} className={`text-[11px] font-bold ${w.isUrgent ? 'text-rose-400' : 'text-amber-400'}`}>
                      • {w.name} {w.docName} expiring on {w.date}
                    </p>
                  ))}
                </div>
              )}

              {currentTrip ? (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center"><span className="text-xs font-bold text-orange-900">Active LR: {currentTrip.trip_number}</span><span className="text-[10px] font-bold px-2 py-0.5 bg-orange-200 text-orange-900 rounded-full">{currentTrip.trip_status}</span></div>
                  <p className="text-xs font-bold text-fg">{currentTrip.origin} ➔ {currentTrip.destination}</p>
                  <p className="text-[11px] text-fg-secondary pt-1 border-t border-orange-200/60">Started: {formatDateTime(currentTrip.trip_start_date)}</p>
                </div>
              ) : (
                <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl">
                  <p className="text-xs font-bold text-slate-500 text-center">No active trip dispatched for this truck yet.</p>
                </div>
              )}

              <div className="grid gap-1.5">
                <label className={labelStyle}>Update Lifecycle Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {[ { id: "START_TRIP", label: "🚀 Start Trip" }, { id: "REACHED", label: "📍 Reached Dest." }, { id: "UNLOADED", label: "📦 Unloaded" }, { id: "RETURNING", label: "🔄 Returning" }, { id: "WAITING_FOR_LOAD", label: "🏭 Reached Plant" }, { id: "BREAKDOWN", label: "⚠️ Breakdown" }, { id: "FUEL", label: "⛽ Fuel Fill Request" } ].map((item, idx, arr) => {
                    
                    const isStartPending = pendingRequests.some(r => r.entry_type === "START_TRIP" && r.status === "PENDING" && String(r.vehicle_id) === String(selectedTruckId));
                    const alreadyStarted = item.id === "START_TRIP" && ((currentTrip && currentTrip.start_km > 0) || isStartPending);

                    return (
                      <button 
                        type="button" 
                        key={item.id} 
                        onClick={() => !alreadyStarted && setActionType(item.id)} 
                        disabled={alreadyStarted}
                        className={`inline-flex items-center justify-center rounded-lg text-xs font-bold transition-all h-10 px-2 text-center border 
                          ${alreadyStarted ? 'opacity-40 cursor-not-allowed bg-surface text-fg-muted border-border' : 
                            actionType === item.id ? 'bg-[#FF5A00] border-[#FF5A00] text-white shadow-md' : 'bg-surface text-fg border-border hover:bg-app'} 
                          ${idx === arr.length - 1 ? 'col-span-2' : ''}`}
                      >
                        {alreadyStarted ? "✅ Started" : item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                {(actionType === "START_TRIP" || actionType === "WAITING_FOR_LOAD" || actionType === "FUEL" || actionType === "BREAKDOWN") && (
                  <div className="grid gap-1.5">
                    <label className={labelStyle}>Odometer (KM)</label>
                    <input 
                      type="number" 
                      min={lastOdometer ? lastOdometer : 0} 
                      value={odometer} 
                      onChange={e => setOdometer(e.target.value === "" ? "" : parseFloat(e.target.value))} 
                      placeholder={lastOdometer ? `Previous KM: ${lastOdometer}` : "e.g. 145230"} 
                      className={inputStyle} 
                      required 
                      {...numProps}
                    />
                  </div>
                )}
                {actionType === "FUEL" && (
                  <div className="grid gap-1.5"><label className={labelStyle}>Litres Filled</label><input type="number" step="any" min="0.1" value={fuelLitres} onChange={e => setFuelLitres(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.0" className={inputStyle} required {...numProps}/></div>
                )}
                {actionType === "UNLOADED" && (
                  <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl space-y-3">
                    {isBulk ? (
                      <>
                        <div className="grid gap-1.5"><label className="text-xs font-bold text-orange-900 uppercase">Unloaded Weight (MT)</label><input type="number" step="any" min="0" value={unloadedMt} onChange={e => setUnloadedMt(e.target.value === "" ? "" : parseFloat(e.target.value))} disabled={noWeighment} placeholder={noWeighment ? "N/A" : "e.g. 30.50"} className={inputStyle} required={!noWeighment} {...numProps}/></div>
                        <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={noWeighment} onChange={(e) => setNoWeighment(e.target.checked)} className="w-4 h-4 rounded text-[#FF5A00] focus:ring-[#FF5A00] border-orange-300" /><span className="text-xs font-bold text-orange-800">No weighment facility</span></label>
                      </>
                    ) : (
                      <div className="grid gap-1.5"><label className="text-xs font-bold text-orange-900 uppercase">Damaged Bags Count</label><input type="number" min="0" value={damagedBags} onChange={e => setDamagedBags(e.target.value === "" ? "" : parseInt(e.target.value))} placeholder="0" className={inputStyle} required {...numProps}/></div>
                    )}
                  </div>
                )}
                {(actionType === "BREAKDOWN" || actionType === "UNLOADED") && (
                  <div className="grid gap-1.5"><label className={labelStyle}>{actionType === "BREAKDOWN" ? "Breakdown Details" : "Additional Remarks"}</label><input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder={actionType === "BREAKDOWN" ? "Describe issue & location" : "Any damages or notes?"} className={inputStyle} required={actionType === "BREAKDOWN"} /></div>
                )}
                <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center rounded-lg text-sm font-bold transition-colors bg-[#FF5A00] text-white shadow-md hover:bg-[#e04f00] h-12 px-4 py-2 w-full mt-2 disabled:opacity-50">
                  {isSubmitting ? "Updating..." : `Confirm Status Update (Biometric 🔒)`}
                </button>
              </div>
            </form>
          )}

          {activeTab === "LEDGER" && (
            <div className="p-6 grid gap-6 bg-app min-h-[400px] animate-in fade-in">
              <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-fg-muted">Current Month Net Balance</p>
                <div className="flex justify-between items-baseline mt-1">
                  <span className={`text-2xl font-bold ${currentMonthNetBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>₹{currentMonthNetBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  <span className="text-[10px] text-fg-muted">{currentMonthNetBalance >= 0 ? 'Net Payable' : 'Deficit'}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 text-[11px] text-slate-300">
                  <div>Earned Bata: <strong className="text-white">₹{monthEarnedBata}</strong></div><div>Halt Bata (Exp): <strong className="text-amber-400">₹{monthHaltBata}</strong></div>
                  <div className="col-span-2 mt-1">Total Deductions (Advances): <strong className="text-rose-400">₹{totalMonthDeductions}</strong></div>
                </div>
              </div>

              {pendingRequests.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-fg uppercase mb-3">Pending Requests</h4>
                  <div className="space-y-3">
                    {pendingRequests.map(r => (
                      <div key={r.entry_id} className="p-3 bg-surface border border-border rounded-xl shadow-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold text-fg">{r.entry_type} - {r.entry_type === 'FUEL' ? `${r.litres}L` : r.entry_type === 'START_TRIP' ? `${r.odometer_km} KM` : `₹${r.amount_inr}`}</span>
                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">{r.status}</span>
                        </div>
                        <div className="flex justify-end mt-2"><button onClick={() => handleCancelRequest(r.entry_id)} className="px-2.5 py-1 text-[10px] font-bold text-rose-600 bg-surface border border-rose-200 rounded-lg">Cancel Request ❌</button></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold text-fg uppercase mb-3">Current Month Tripwise Ledger</h4>
                {currentMonthTrips.length === 0 ? (
                  <p className="text-xs text-fg-secondary italic">No trips logged this month yet.</p>
                ) : (
                  <div className="space-y-3">
                    {currentMonthTrips.map(t => {
                      const tripBata = Number(t.driver_bata) || 0; const halt = Number(t.halt_bata) || 0; const adv = Number(t.cash_advance_issued) || 0;
                      return (
                        <div key={t.trip_id} className="p-3 bg-surface border border-border rounded-xl shadow-sm space-y-2">
                          <div className="flex justify-between items-start border-b border-border pb-2">
                            <div><p className="text-sm font-bold text-fg">{t.trip_number}</p><p className="text-[10px] font-bold text-fg-secondary truncate max-w-[150px]">{t.origin} ➔ {t.destination}</p></div>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-surface-raised text-fg rounded">{formatDate(t.trip_start_date)}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 text-[11px] text-fg-secondary">
                            <div>Bata: <strong className="text-emerald-600">₹{tripBata}</strong></div><div>Halt: <strong className="text-amber-600">₹{halt}</strong></div><div>Adv: <strong className="text-rose-600">₹{adv}</strong></div>
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
