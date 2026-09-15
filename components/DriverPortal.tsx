"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";
import { BackgroundGeolocation } from "@capgo/background-geolocation";
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'; 

const KssLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="200" height="200" fill="#FF5A00" />
    <rect x="15" y="15" width="170" height="170" fill="#FFFFFF" />
    <path d="M 50 35 L 50 165" stroke="#FF5A00" strokeWidth="24" strokeLinecap="square" />
    <path d="M 50 110 L 140 35" stroke="#FF5A00" strokeWidth="24" strokeLinecap="square" />
    <path d="M 85 85 C 130 95, 145 130, 145 165" stroke="#FF5A00" strokeWidth="24" fill="none" />
  </svg>
);

const FingerprintIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 0 0 4.5 10.5a7.464 7.464 0 0 1-1.15 3.993m1.989 3.559A11.209 11.209 0 0 0 8.25 10.5a3.75 3.75 0 1 1 7.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 0 1-3.6 9.75m6.633-4.596a18.666 18.666 0 0 1-2.485 5.33" />
  </svg>
);

const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
};

// 🚀 ULTIMATE FIX: Force compress ANY image to < 300KB before sending to Vercel
const compressImageBase64 = (base64Str: string, maxWidth = 1000, quality = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = "data:image/jpeg;base64," + base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      if (width > height && width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      } else if (height > maxWidth) {
        width *= maxWidth / height;
        height = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
    };
    img.onerror = () => resolve(base64Str); // Fallback to original
  });
};

export function DriverPortal() {
  const [supabase, setSupabase] = useState<any>(null);

  useEffect(() => {
    try { setSupabase(createClient()); } catch (err) { console.warn("Supabase init failed", err); }
  }, []);

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: "", message: "", type: "info" as "success" | "error" | "info" });
  const [savedDriverCode, setSavedDriverCode] = useState("");
  const [enrolledBiometricDriver, setEnrolledBiometricDriver] = useState(""); 
  const [isDriverLocked, setIsDriverLocked] = useState(false);
  const [activeTab, setActiveTab] = useState<"STATUS" | "SCAN" | "LEDGER">("STATUS");
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
  const [activeWorkflow, setActiveWorkflow] = useState<string | null>(null);
  const [selectionModalFor, setSelectionModalFor] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') setIsMobile(/android|iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()));
  }, []);

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
    if (!supabase) return;
    const [vRes, dRes, tRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('is_active', true),
      supabase.from('drivers').select('*').eq('is_active', true),
      supabase.from('trips').select('trip_id, vehicle_id, trip_number, origin, destination, primary_driver_id, loaded_weight_mt, trip_status, trip_start_date, reached_at, unloaded_at, returning_at, start_km, destination_lat, destination_lng, origin_lat, origin_lng').neq('trip_status', 'COMPLETED')
    ]);
    setVehicles(vRes.data || []); setDrivers(dRes.data || []); setActiveTrips(tRes.data || []);
  };

  const fetchDriverCurrentMonthReports = async (drvCode: string, drvId: number) => {
    if (!supabase) return;
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
    if (!supabase) return;
    fetchPortalData();
    const storedDriver = localStorage.getItem("kss_device_driver");
    const enrolledBioDriver = localStorage.getItem("kss_biometric_enrolled_driver");
    if (enrolledBioDriver) setEnrolledBiometricDriver(enrolledBioDriver);
    if (storedDriver) { setSavedDriverCode(storedDriver); setDriverCode(storedDriver); setIsDriverLocked(true); }
  }, [supabase]);

  const activeDriverObj = drivers.find(d => d.driver_code === savedDriverCode);
  const selectedTruckObj = vehicles.find(v => String(v.vehicle_id) === String(selectedTruckId));
  
  const sortedTrips = [...activeTrips].sort((a, b) => b.trip_id - a.trip_id);
  const latestAssignedTrip = sortedTrips.find(t => String(t.vehicle_id) === String(selectedTruckId));
  const currentTrip = latestAssignedTrip?.trip_status === 'WAITING_FOR_LOAD' ? null : latestAssignedTrip;

  useEffect(() => {
    if (isDriverLocked && drivers.length > 0 && activeDriverObj) {
      if (activeTrips.length > 0) {
        const activeTrip = activeTrips.find(t => String(t.primary_driver_id) === String(activeDriverObj.driver_id) && t.trip_status !== 'WAITING_FOR_LOAD');
        if (activeTrip) setSelectedTruckId(String(activeTrip.vehicle_id));
      }
      fetchDriverCurrentMonthReports(savedDriverCode, activeDriverObj.driver_id);
    }
  }, [isDriverLocked, drivers, activeTrips, savedDriverCode, activeTab, activeDriverObj]);

  useEffect(() => {
    if (selectedTruckId && supabase) {
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
    } else setLastOdometer("");
  }, [selectedTruckId, activeTrips, pendingRequests, supabase]);

  useEffect(() => {
    const isStarted = currentTrip && currentTrip.start_km > 0;
    if (isStarted && actionType === "START_TRIP") {
       if (currentTrip?.trip_status === "IN_TRANSIT") setActionType("REACHED");
       else if (currentTrip?.trip_status === "REACHED_DESTINATION") setActionType("UNLOADED");
       else if (currentTrip?.trip_status === "UNLOADED") setActionType("RETURNING");
       else if (currentTrip?.trip_status === "RETURNING") setActionType("WAITING_FOR_LOAD");
       else setActionType("FUEL");
    } else if (!isStarted && !currentTrip) {
       setActionType("START_TRIP");
    }
  }, [currentTrip, selectedTruckId, actionType]);

  const handleDriverChange = (code: string) => {
    setDriverCode(code); setDriverPin(""); setConfirmPin("");
    if (code) { const drv = drivers.find(d => d.driver_code === code); setIsFirstTimeSetup(!drv || !drv.pin || drv.pin.trim() === ""); } 
    else setIsFirstTimeSetup(false);
  };

  const displayDriverName = activeDriverObj ? `${activeDriverObj.full_name} (${activeDriverObj.driver_code})` : savedDriverCode;
  const isBulk = selectedTruckObj ? String(selectedTruckObj.truck_type).toUpperCase().includes("BULK") : true;

  const monthEarnedBata = currentMonthTrips.reduce((sum, t) => sum + (Number(t.driver_bata) || 0), 0);
  const monthHaltBata = currentMonthTrips.reduce((sum, t) => sum + (Number(t.halt_bata) || 0), 0);
  const monthTripAdvances = currentMonthTrips.reduce((sum, t) => sum + (Number(t.cash_advance_issued) || 0), 0);
  const monthDirectAdvances = currentMonthAdvances.reduce((sum, a) => sum + (Number(a.amount_inr) || 0), 0);
  const currentMonthNetBalance = (monthEarnedBata + monthHaltBata) - (monthTripAdvances + monthDirectAdvances);

  const handleManualFingerprint = async () => {
    if (!driverCode) return setAlertConfig({ isOpen: true, title: "Select Driver", message: "Select your profile first.", type: "error" });
    if (driverCode !== enrolledBiometricDriver) return setAlertConfig({ isOpen: true, title: "Security Lock 🔒", message: "Log in with PIN to link fingerprint.", type: "error" });
    try {
      const { NativeBiometric } = await import("capacitor-native-biometric");
      await NativeBiometric.verifyIdentity({ reason: "Log in to KSS Roadways Driver Portal", title: "Driver Authentication" });
      localStorage.setItem("kss_device_driver", driverCode.toUpperCase().trim());
      setSavedDriverCode(driverCode.toUpperCase().trim()); setIsDriverLocked(true);
    } catch (error) { console.error("Biometric error:", error); }
  };

  const handleLockDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !driverCode) return;
    const selectedDrv = drivers.find(d => d.driver_code === driverCode);
    if (!selectedDrv) return;

    if (isFirstTimeSetup) {
      if (driverPin.length !== 4) return setAlertConfig({ isOpen: true, title: "Invalid", message: "PIN must be 4 digits.", type: "error" });
      if (driverPin !== confirmPin) return setAlertConfig({ isOpen: true, title: "Mismatch", message: "PINs do not match.", type: "error" });
      const { error } = await supabase.from('drivers').update({ pin: driverPin }).eq('driver_id', selectedDrv.driver_id);
      if (error) return setAlertConfig({ isOpen: true, title: "Setup Failed", message: error.message, type: "error" });
      setAlertConfig({ isOpen: true, title: "PIN Saved!", message: "PIN set successfully.", type: "success" });
      await fetchPortalData();
    } else {
      if (driverPin.trim() !== (selectedDrv.pin || "").toString().trim()) return setAlertConfig({ isOpen: true, title: "Invalid PIN", message: "Incorrect PIN.", type: "error" });
    }
    localStorage.setItem("kss_biometric_enrolled_driver", driverCode.toUpperCase().trim());
    setEnrolledBiometricDriver(driverCode.toUpperCase().trim());
    localStorage.setItem("kss_device_driver", driverCode.toUpperCase().trim());
    setSavedDriverCode(driverCode.toUpperCase().trim()); setIsDriverLocked(true); setDriverPin(""); setConfirmPin("");
  };

  const handleResetDriver = () => {
    if (confirm("Switch driver profile on this device?")) {
      localStorage.removeItem("kss_device_driver"); setIsDriverLocked(false); setSavedDriverCode(""); setSelectedTruckId(""); setDriverPin(""); setConfirmPin("");
    }
  };

  const handleWebUpload = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = "image/png, image/jpeg, image/jpg";
      input.onchange = (e: any) => {
        const file = e.target.files[0]; if (!file) return resolve("");
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = (err) => reject(err);
      };
      input.click();
    });
  };

  const triggerScanner = async (docType: string, sourceSelection: any) => {
    setSelectionModalFor(null);
    let rawBase64 = "";

    try {
      if (sourceSelection === "WEB") {
        rawBase64 = await handleWebUpload();
      } else {
        const image = await Camera.getPhoto({ 
            quality: 50, 
            width: 1000, 
            allowEditing: true, 
            resultType: CameraResultType.Base64, 
            source: sourceSelection 
        });
        rawBase64 = image.base64String || "";
      }
      
      if (!rawBase64) return;
      setActiveWorkflow(docType);

      // 🔥 COMPRESS THE IMAGE BEFORE SENDING
      const finalBase64 = await compressImageBase64(rawBase64, 1000, 0.6);

      const apiDocType = docType === "INVOICE" ? "TRIP_INVOICE" : docType === "FUEL" ? "FUEL_SLIP" : "POD_CLOSURE";

      const response = await fetch('/api/parse-document', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ imageBase64: finalBase64, documentType: apiDocType }) 
      });
      
      // 🛡️ SAFE ERROR HANDLING (Prevents the "SyntaxError: Unexpected Token R" crash)
      const responseText = await response.text();
      if (!response.ok) {
        if (response.status === 413 || responseText.includes("Request Entity Too Large")) {
          throw new Error("The photo is too large to process. Please step back slightly or use a lower resolution.");
        }
        throw new Error(`Server Error: ${responseText.substring(0, 40)}...`);
      }

      let parsedJson;
      try {
        parsedJson = JSON.parse(responseText);
      } catch (e) {
        throw new Error("Received an invalid response from the server. The file might still be too large.");
      }

      const { data, error } = parsedJson;
      if (error) throw new Error(error);

      if (docType === "INVOICE") {
        const extractedLr = data.lrNo ? String(data.lrNo).toUpperCase().trim() : null;
        let shouldInsert = true;
        if (extractedLr) {
          const { data: existingScan } = await supabase.from('pending_scans').select('scan_id').eq('lr_number', extractedLr).eq('status', 'PENDING').single();
          if (existingScan) {
            shouldInsert = false;
            await supabase.from('pending_scans').update({ tonnage_extracted: data.tonnage ? Number(data.tonnage) : null, destination: data.destination ? String(data.destination).toUpperCase() : null, source: data.source ? String(data.source).toUpperCase() : null, truck_number: data.truckNo ? String(data.truckNo).toUpperCase() : null, cargo_type: data.cargoType ? String(data.cargoType).toUpperCase() : null, raw_json_result: data }).eq('scan_id', existingScan.scan_id);
          }
        }
        if (shouldInsert) {
          await supabase.from('pending_scans').insert([{ document_type: apiDocType, lr_number: extractedLr, tonnage_extracted: data.tonnage ? Number(data.tonnage) : null, destination: data.destination ? String(data.destination).toUpperCase() : null, source: data.source ? String(data.source).toUpperCase() : null, truck_number: data.truckNo ? String(data.truckNo).toUpperCase() : null, cargo_type: data.cargoType ? String(data.cargoType).toUpperCase() : null, raw_json_result: data, status: 'PENDING' }]);
        }
      } else {
        await supabase.from('pending_scans').insert([{ document_type: apiDocType, raw_json_result: data, status: 'PENDING' }]);
      }
      setAlertConfig({ isOpen: true, title: "Uploaded ✨", message: `${docType} sent to office successfully.`, type: "success" });
    } catch (err: any) {
      if (!String(err).toLowerCase().includes("cancel")) setAlertConfig({ isOpen: true, title: "Scan Failed", message: String(err), type: "error" });
    } finally { setActiveWorkflow(null); }
  };

  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (!selectedTruckId) return setAlertConfig({ isOpen: true, title: "Truck Required", message: "Select active Truck.", type: "error" });

    setIsSubmitting(true);
    const timestamp = new Date().toISOString();

    if (!currentTrip && actionType === "START_TRIP") {
      const draftLr = `DRAFT-${Math.floor(Date.now() / 1000)}`;
      const updatePayload = {
        trip_number: draftLr, branch_id: 1, vehicle_id: Number(selectedTruckId), primary_driver_id: Number(activeDriverObj.driver_id),
        trip_start_date: timestamp.split('T')[0], origin: "PENDING OFFICE", destination: "PENDING OFFICE",
        start_km: Number(odometer) || 0, end_km: 0, total_km_run: 0, tonnage_loaded: 0, loaded_weight_mt: 0,
        freight_revenue: 0, fuel_litres: 0, fuel_expense: 0, driver_bata: 0, cash_advance_issued: 0, 
        trip_status: "IN_TRANSIT"
      };

      const { error: tripError } = await supabase.from('trips').insert([updatePayload]);
      if (tripError) { setIsSubmitting(false); return setAlertConfig({ isOpen: true, title: "Trip Error", message: tripError.message, type: "error" }); }

      const { error: vehicleError } = await supabase.from('vehicles').update({
          current_status: "IN_TRANSIT", status_remarks: `Started draft trip [${draftLr}]`, status_updated_at: timestamp
      }).eq('vehicle_id', selectedTruckId);

      if (vehicleError) { setIsSubmitting(false); return setAlertConfig({ isOpen: true, title: "Vehicle Error", message: vehicleError.message, type: "error" }); }
      
      setAlertConfig({ isOpen: true, title: "Trip Started", message: "Draft trip created! The office will attach paperwork later.", type: "success" });
      setOdometer(""); setRemarks(""); setIsSubmitting(false); await fetchPortalData(); 
      return;
    }

    if (!currentTrip && actionType === "FUEL") {
      const { error } = await supabase.from('driver_pending_entries').insert([{
        vehicle_id: Number(selectedTruckId), driver_code: savedDriverCode || "DRV-MOBILE", entry_type: "FUEL",
        litres: Number(fuelLitres), amount_inr: 0, odometer_km: Number(odometer) || 0,
        receipt_remarks: `[LR: PRE-DISPATCH] ${remarks} [Truck: ${selectedTruckObj?.vehicle_number}]`.trim(), status: 'PENDING'
      }]);
      if (error) setAlertConfig({ isOpen: true, title: "Failed", message: error.message, type: "error" });
      else setAlertConfig({ isOpen: true, title: "Success", message: "Fuel request sent to dispatch!", type: "success" });
      setOdometer(""); setFuelLitres(""); setRemarks(""); setIsSubmitting(false); return;
    }

    if (!currentTrip) {
      setIsSubmitting(false);
      return setAlertConfig({ isOpen: true, title: "Action Not Allowed", message: "No active trip. You can only Start Trip or Log Fuel.", type: "error" });
    }

    if (actionType === "FUEL") {
      const { error } = await supabase.from('driver_pending_entries').insert([{
        vehicle_id: Number(selectedTruckId), driver_code: savedDriverCode || "DRV-MOBILE", entry_type: "FUEL",
        litres: Number(fuelLitres), amount_inr: 0, odometer_km: Number(odometer) || 0,
        receipt_remarks: `[LR: ${currentTrip.trip_number}] ${remarks} [Truck: ${selectedTruckObj?.vehicle_number}]`.trim(), status: 'PENDING'
      }]);
      if (error) setAlertConfig({ isOpen: true, title: "Failed", message: error.message, type: "error" });
      else setAlertConfig({ isOpen: true, title: "Success", message: "Fuel request sent to dispatch!", type: "success" });
    } 
    else {
        let updatePayload: any = {}; let finalRemarks = remarks; let vehicleStatusUpdate = "IN_TRANSIT"; let statusRemarksText = "";

        if (actionType === "REACHED") { 
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

        const finalVehicleRemarks = (finalRemarks && (actionType === "UNLOADED" || actionType === "BREAKDOWN")) ? finalRemarks : statusRemarksText;

        const { error: tripError } = await supabase.from('trips').update(updatePayload).eq('trip_id', currentTrip.trip_id);
        if (tripError) { setIsSubmitting(false); return setAlertConfig({ isOpen: true, title: "Trip Update Failed", message: tripError.message, type: "error" }); }

        const { error: vehicleError } = await supabase.from('vehicles').update({ current_status: vehicleStatusUpdate, status_remarks: finalVehicleRemarks, status_updated_at: timestamp }).eq('vehicle_id', selectedTruckId);
        if (vehicleError) { setIsSubmitting(false); return setAlertConfig({ isOpen: true, title: "Vehicle Update Failed", message: vehicleError.message, type: "error" }); }
        
        setAlertConfig({ isOpen: true, title: "Status Updated", message: `Trip status successfully updated!`, type: "success" });
    }

    setOdometer(""); setFuelLitres(""); setRemarks(""); setUnloadedMt(""); setDamagedBags(""); setIsSubmitting(false); await fetchPortalData(); 
  };

  const inputStyle = "flex h-10 w-full rounded-md border border-border bg-app/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5A00] focus-visible:border-[#FF5A00]";
  const labelStyle = "text-xs font-bold text-fg-secondary uppercase tracking-wide leading-none mb-1";
  const numProps = { onWheel: (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur() };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-surface text-slate-950 shadow-lg relative mx-auto mt-4 overflow-hidden mb-10" style={{ colorScheme: 'light' }}>
      
      {selectionModalFor && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-surface border border-border rounded-2xl w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-black text-fg mb-4 text-center uppercase tracking-wide">Upload Source</h3>
            <div className="space-y-3">
              {isMobile ? (
                <>
                  <button onClick={() => triggerScanner(selectionModalFor, CameraSource.Camera)} className="w-full flex items-center justify-center gap-3 p-4 bg-app hover:bg-[#FF5A00]/10 border border-border rounded-xl font-bold text-fg transition-colors"><span className="text-xl">📸</span> Take New Photo</button>
                  <button onClick={() => triggerScanner(selectionModalFor, CameraSource.Photos)} className="w-full flex items-center justify-center gap-3 p-4 bg-app hover:bg-[#FF5A00]/10 border border-border rounded-xl font-bold text-fg transition-colors"><span className="text-xl">🖼️</span> Select from Gallery</button>
                </>
              ) : (
                <button onClick={() => triggerScanner(selectionModalFor, "WEB")} className="w-full flex items-center justify-center gap-3 p-4 bg-app hover:bg-[#FF5A00]/10 border border-border rounded-xl font-bold text-fg transition-colors"><span className="text-xl">📂</span> Browse Files</button>
              )}
              <button onClick={() => setSelectionModalFor(null)} className="w-full p-3 mt-2 text-sm text-fg-muted font-bold transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm bg-surface"><KssLogo className="w-full h-full" /></div>
          <div><h1 className="text-sm font-bold text-white tracking-tight leading-none">KSS Roadways</h1><p className="text-[9px] text-[#FF5A00] font-bold uppercase tracking-widest mt-0.5">Driver Portal</p></div>
        </div>
      </div>

      <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} />

      {!isDriverLocked ? (
        <form onSubmit={handleLockDriver} className="flex flex-col">
          <div className="flex flex-col p-6 space-y-1"><h3 className="font-bold tracking-tight text-xl">{isFirstTimeSetup ? "First-Time PIN Setup" : "Secure Login"}</h3><p className="text-sm text-fg-secondary">{isFirstTimeSetup ? "Create a 4-digit PIN." : "Select your profile."}</p></div>
          <div className="p-6 pt-0 grid gap-5">
            <div className="grid gap-1.5"><label className={labelStyle}>Driver Name</label><select value={driverCode} onChange={e => handleDriverChange(e.target.value)} className={inputStyle} required><option value="">Select your profile...</option>{drivers.map(d => (<option key={d.driver_id} value={d.driver_code}>{d.full_name} ({d.driver_code})</option>))}</select></div>
            {!isFirstTimeSetup && driverCode && driverCode === enrolledBiometricDriver && (
              <div className="flex flex-col items-center justify-center py-2"><button type="button" onClick={handleManualFingerprint} className="relative flex items-center justify-center w-16 h-16 rounded-full group focus:outline-none transition-transform active:scale-95"><div className="absolute inset-0 rounded-full bg-[#FF5A00]/30 animate-ping opacity-75" style={{ animationDuration: '2.5s' }}></div><div className="absolute inset-1.5 rounded-full bg-[#FF5A00]/10 group-hover:bg-[#FF5A00]/20 border border-[#FF5A00]/20 transition-all duration-300 shadow-[0_0_15px_rgba(255,90,0,0.1)]"></div><FingerprintIcon className="w-8 h-8 text-[#FF5A00] relative z-10 drop-shadow-sm group-hover:scale-105 transition-transform" /></button></div>
            )}
            <div className="grid gap-1.5 relative mt-2"><label className={labelStyle}>{isFirstTimeSetup ? "Create 4-Digit PIN" : "Security PIN"}</label><input type="password" maxLength={4} value={driverPin} onChange={e => setDriverPin(e.target.value)} placeholder="••••" className={inputStyle} required={isFirstTimeSetup} /></div>
            {isFirstTimeSetup && <div className="grid gap-1.5"><label className={labelStyle}>Confirm 4-Digit PIN</label><input type="password" maxLength={4} value={confirmPin} onChange={e => setConfirmPin(e.target.value)} placeholder="••••" className={inputStyle} required /></div>}
            <button type="submit" className="inline-flex items-center justify-center rounded-lg text-sm font-bold bg-[#FF5A00] text-white shadow-md hover:bg-[#e04f00] h-10 px-4 py-2 w-full mt-2">{isFirstTimeSetup ? "Save & Lock Device" : "Verify & Login with PIN"}</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col pb-4">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-app">
            <div><p className="text-[10px] text-fg-secondary font-bold uppercase">Active Driver</p><span className="text-sm font-bold text-fg">{displayDriverName}</span></div>
            <button type="button" onClick={handleResetDriver} className="text-xs font-bold text-[#FF5A00] hover:text-[#e04f00] underline transition-colors">Switch</button>
          </div>

          <div className="flex border-b border-border">
            <button onClick={() => setActiveTab("STATUS")} className={`flex-1 py-3 text-[13px] font-bold ${activeTab === "STATUS" ? "border-b-2 border-[#FF5A00] text-[#FF5A00]" : "text-fg-muted hover:text-fg"}`}>🚀 Status</button>
            <button onClick={() => setActiveTab("SCAN")} className={`flex-1 py-3 text-[13px] font-bold ${activeTab === "SCAN" ? "border-b-2 border-[#FF5A00] text-[#FF5A00]" : "text-fg-muted hover:text-fg"}`}>📸 Scan</button>
            <button onClick={() => setActiveTab("LEDGER")} className={`flex-1 py-3 text-[13px] font-bold ${activeTab === "LEDGER" ? "border-b-2 border-[#FF5A00] text-[#FF5A00]" : "text-fg-muted hover:text-fg"}`}>📊 Ledger</button>
          </div>

          {activeTab === "SCAN" && (
            <div className="p-6 grid gap-4 bg-app min-h-[400px] animate-in fade-in">
              <div className="mb-2"><h3 className="font-bold text-lg text-fg tracking-tight">Send to Office</h3><p className="text-xs text-fg-secondary">Scan a document to instantly notify Dispatch.</p></div>
              <button onClick={() => setSelectionModalFor("INVOICE")} disabled={activeWorkflow !== null} className="bg-surface border border-border p-5 rounded-xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"><span className="text-3xl">{activeWorkflow === "INVOICE" ? "⏳" : "📄"}</span><span className="text-sm font-bold text-fg uppercase">{activeWorkflow === "INVOICE" ? "Uploading..." : "Trip Invoice / Bilty"}</span></button>
              <button onClick={() => setSelectionModalFor("FUEL")} disabled={activeWorkflow !== null} className="bg-surface border border-border p-5 rounded-xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"><span className="text-3xl">{activeWorkflow === "FUEL" ? "⏳" : "⛽"}</span><span className="text-sm font-bold text-fg uppercase">{activeWorkflow === "FUEL" ? "Uploading..." : "Diesel Slip"}</span></button>
              <button onClick={() => setSelectionModalFor("POD")} disabled={activeWorkflow !== null} className="bg-surface border border-border p-5 rounded-xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"><span className="text-3xl">{activeWorkflow === "POD" ? "⏳" : "⚖️"}</span><span className="text-sm font-bold text-fg uppercase">{activeWorkflow === "POD" ? "Uploading..." : "POD / Weighment"}</span></button>
            </div>
          )}

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
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center"><span className="text-xs font-bold text-orange-900">Active LR: {currentTrip.trip_number}</span><span className="text-[10px] font-bold px-2 py-0.5 bg-orange-200 text-orange-900 rounded-full">{currentTrip.trip_status}</span></div>
                  <p className="text-xs font-bold text-fg">{currentTrip.origin} ➔ {currentTrip.destination}</p>
                </div>
              ) : (
                <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl text-center">
                  <p className="text-xs font-bold text-slate-500">No active trip dispatched by office.</p>
                  <p className="text-[11px] font-bold text-[#FF5A00] mt-1">Hit 'Start Trip' to create a Draft Trip.</p>
                </div>
              )}

              <div className="grid gap-1.5">
                <label className={labelStyle}>Update Lifecycle Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {[ { id: "START_TRIP", label: "🚀 Start Trip" }, { id: "REACHED", label: "📍 Reached Dest." }, { id: "UNLOADED", label: "📦 Unloaded" }, { id: "RETURNING", label: "🔄 Returning" }, { id: "WAITING_FOR_LOAD", label: "🏭 Reached Plant" }, { id: "BREAKDOWN", label: "⚠️ Breakdown" }, { id: "FUEL", label: "⛽ Fuel Log" } ].map((item, idx, arr) => {
                    const isStarted = item.id === "START_TRIP" && currentTrip && currentTrip.start_km > 0;
                    return (
                      <button 
                        type="button" key={item.id} onClick={() => !isStarted && setActionType(item.id)} disabled={isStarted}
                        className={`inline-flex items-center justify-center rounded-lg text-xs font-bold transition-all h-10 px-2 text-center border ${isStarted ? 'opacity-40 cursor-not-allowed bg-surface text-fg-muted border-border' : actionType === item.id ? 'bg-[#FF5A00] border-[#FF5A00] text-white shadow-md' : 'bg-surface text-fg border-border hover:bg-app'} ${idx === arr.length - 1 ? 'col-span-2' : ''}`}
                      >
                        {isStarted ? "✅ Started" : item.label}
                      </button>
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
                  <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl space-y-3">
                    {isBulk ? (
                      <><div className="grid gap-1.5"><label className="text-xs font-bold text-orange-900 uppercase">Unloaded Weight (MT)</label><input type="number" step="any" min="0" value={unloadedMt} onChange={e => setUnloadedMt(e.target.value === "" ? "" : parseFloat(e.target.value))} disabled={noWeighment} placeholder={noWeighment ? "N/A" : "e.g. 30.50"} className={inputStyle} required={!noWeighment} {...numProps}/></div>
                      <label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={noWeighment} onChange={(e) => setNoWeighment(e.target.checked)} className="w-4 h-4 rounded text-[#FF5A00] focus:ring-[#FF5A00] border-orange-300" /><span className="text-xs font-bold text-orange-800">No weighment facility</span></label></>
                    ) : ( <div className="grid gap-1.5"><label className="text-xs font-bold text-orange-900 uppercase">Damaged Bags Count</label><input type="number" min="0" value={damagedBags} onChange={e => setDamagedBags(e.target.value === "" ? "" : parseInt(e.target.value))} placeholder="0" className={inputStyle} required {...numProps}/></div> )}
                  </div>
                )}
                {(actionType === "BREAKDOWN" || actionType === "UNLOADED") && <div className="grid gap-1.5"><label className={labelStyle}>Remarks</label><input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional details..." className={inputStyle} required={actionType === "BREAKDOWN"} /></div>}
                <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center rounded-lg text-sm font-bold transition-colors bg-[#FF5A00] text-white shadow-md hover:bg-[#e04f00] h-12 px-4 py-2 w-full mt-2 disabled:opacity-50">
                  {isSubmitting ? "Updating..." : `Confirm Status Update`}
                </button>
              </div>
            </form>
          )}

          {activeTab === "LEDGER" && (
            <div className="p-6 grid gap-6 bg-app min-h-[400px] animate-in fade-in">
              <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-fg-muted">Current Month Net Balance</p>
                <div className="flex justify-between items-baseline mt-1"><span className={`text-2xl font-bold ${currentMonthNetBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>₹{currentMonthNetBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span><span className="text-[10px] text-fg-muted">{currentMonthNetBalance >= 0 ? 'Net Payable' : 'Deficit'}</span></div>
                <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 text-[11px] text-slate-300">
                  <div>Earned Bata: <strong className="text-white">₹{monthEarnedBata}</strong></div><div>Halt Bata (Exp): <strong className="text-amber-400">₹{monthHaltBata}</strong></div>
                  <div className="col-span-2 mt-1">Total Deductions (Advances): <strong className="text-rose-400">₹{totalMonthDeductions}</strong></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
