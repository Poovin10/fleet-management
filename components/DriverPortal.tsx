"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";

// KSS Logo Component for Branding
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
  
  const [alertConfig, setAlertConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info" as "success" | "error" | "info"
  });

  const [savedDriverCode, setSavedDriverCode] = useState("");
  const [isDriverLocked, setIsDriverLocked] = useState(false);

  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [driverCode, setDriverCode] = useState("");
  const [actionType, setActionType] = useState("REACHED"); 
  
  // Standard Form fields
  const [odometer, setOdometer] = useState<number | "">("");
  const [fuelLitres, setFuelLitres] = useState<number | "">("");
  const [advanceAmt, setAdvanceAmt] = useState<number | "">("");
  const [remarks, setRemarks] = useState("");
  
  // UNLOADED specific fields
  const [unloadedMt, setUnloadedMt] = useState<number | "">("");
  const [damagedBags, setDamagedBags] = useState<number | "">("");
  const [noWeighment, setNoWeighment] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchPortalData = async () => {
      const [vRes, dRes, tRes] = await Promise.all([
        supabase.from('vehicles').select('*').eq('is_active', true),
        supabase.from('drivers').select('*').eq('is_active', true),
        // Added primary_driver_id and loaded_weight_mt to auto-select truck and calculate shortages
        supabase.from('trips').select('trip_id, vehicle_id, trip_number, origin, destination, primary_driver_id, loaded_weight_mt').neq('trip_status', 'COMPLETED')
      ]);

      if (vRes.data) setVehicles(vRes.data);
      if (dRes.data) setDrivers(dRes.data);
      if (tRes.data) setActiveTrips(tRes.data);

      const storedDriver = localStorage.getItem("kss_device_driver");
      if (storedDriver) {
        setSavedDriverCode(storedDriver);
        setDriverCode(storedDriver);
        setIsDriverLocked(true);
      }
    };
    fetchPortalData();
  }, []);

  // --- AUTO-SELECT TRUCK LOGIC ---
  useEffect(() => {
    if (isDriverLocked && drivers.length > 0 && activeTrips.length > 0) {
      const activeDriverObj = drivers.find(d => d.driver_code === savedDriverCode);
      if (activeDriverObj) {
        const activeTrip = activeTrips.find(t => String(t.primary_driver_id) === String(activeDriverObj.driver_id));
        if (activeTrip) {
          setSelectedTruckId(String(activeTrip.vehicle_id));
        }
      }
    }
  }, [isDriverLocked, drivers, activeTrips, savedDriverCode]);

  // Derived state to check if selected truck is BULK or BAGS
  const selectedTruckObj = vehicles.find(v => String(v.vehicle_id) === String(selectedTruckId));
  const isBulk = selectedTruckObj ? String(selectedTruckObj.truck_type).toUpperCase().includes("BULK") : true;

  const handleLockDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverCode) {
      setAlertConfig({ isOpen: true, title: "Missing Detail", message: "Please select your Name / Code.", type: "error" });
      return;
    }
    localStorage.setItem("kss_device_driver", driverCode.toUpperCase().trim());
    setSavedDriverCode(driverCode.toUpperCase().trim());
    setIsDriverLocked(true);
  };

  const handleResetDriver = () => {
    if (confirm("Switch driver profile on this device?")) {
      localStorage.removeItem("kss_device_driver");
      setIsDriverLocked(false);
      setSavedDriverCode("");
      setSelectedTruckId("");
    }
  };

  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeDriver = isDriverLocked ? savedDriverCode : driverCode;

    if (!selectedTruckId) {
      setAlertConfig({ isOpen: true, title: "Truck Required", message: "Please select the active Truck Number.", type: "error" });
      return;
    }

    setIsSubmitting(true);
    const currentTrip = activeTrips.find(t => String(t.vehicle_id) === String(selectedTruckId));
    const timestamp = new Date().toISOString();

    let clientIp = "Mobile Cellular";
    try {
      const ipRes = await fetch("https://api64.ipify.org?format=json");
      const ipData = await ipRes.json();
      if (ipData.ip) clientIp = ipData.ip;
    } catch (err) {}

    const truckNumberText = selectedTruckObj ? selectedTruckObj.vehicle_number : "Unknown Truck";

    if (actionType === "FUEL" || actionType === "ADVANCE") {
      const { error } = await supabase.from('driver_pending_entries').insert([{
        vehicle_id: Number(selectedTruckId),
        driver_code: activeDriver || "DRV-MOBILE",
        entry_type: actionType,
        amount_inr: actionType === "ADVANCE" ? Number(advanceAmt) : 0, // ERP will auto-calc fuel cost
        litres: actionType === "FUEL" ? Number(fuelLitres) : 0,
        odometer_km: Number(odometer) || 0,
        receipt_remarks: `${remarks} [Truck: ${truckNumberText} | IP: ${clientIp}]`,
        status: 'PENDING'
      }]);

      if (error) {
        setAlertConfig({ isOpen: true, title: "Failed", message: error.message, type: "error" });
      } else {
        setAlertConfig({ isOpen: true, title: "Success", message: `${actionType} request sent to dispatch!`, type: "success" });
      }
    } else {
      if (currentTrip) {
        let updatePayload: any = {};
        let finalRemarks = remarks;

        if (actionType === "REACHED") { 
          updatePayload.reached_at = timestamp; 
          updatePayload.trip_status = "REACHED_DESTINATION"; 
          updatePayload.end_km = Number(odometer) || 0; // Log reaching odometer
        }
        
        if (actionType === "UNLOADED") { 
          updatePayload.unloaded_at = timestamp; 
          updatePayload.trip_status = "UNLOADED"; 

          if (isBulk) {
            if (noWeighment) {
              finalRemarks = `[NO WEIGHMENT] ${finalRemarks}`;
            } else {
              updatePayload.unloaded_weight_mt = Number(unloadedMt);
              const loaded = Number(currentTrip.loaded_weight_mt) || 0;
              const shortage = Math.max(0, loaded - Number(unloadedMt));
              updatePayload.shortage_mt = shortage;
              
              // Trigger High Shortage Alert Tag if > 150 kg (0.15 MT)
              if (shortage > 0.15) {
                finalRemarks = `🚨 [HIGH SHORTAGE: ${shortage.toFixed(3)} MT] ${finalRemarks}`;
              }
            }
          } else {
            // Bag Truck Tracking
            finalRemarks = `[DAMAGED BAGS: ${damagedBags || 0}] ${finalRemarks}`;
          }
        }
        
        if (actionType === "RETURNING") { updatePayload.returning_at = timestamp; updatePayload.trip_status = "RETURNING"; }
        if (actionType === "BREAKDOWN") { updatePayload.breakdown_remarks = `${finalRemarks} [Odo: ${odometer} | IP: ${clientIp}]`; updatePayload.trip_status = "BREAKDOWN"; }
        
        // Append any special tags we generated for the unloading process
        if (finalRemarks && actionType === "UNLOADED") {
          updatePayload.status_remarks = finalRemarks;
        }

        await supabase.from('trips').update(updatePayload).eq('trip_id', currentTrip.trip_id);
      }

      if (actionType === "BREAKDOWN") {
        await supabase.from('vehicles').update({ current_status: "WORKSHOP_MAINTENANCE", status_remarks: remarks }).eq('vehicle_id', selectedTruckId);
      }
      setAlertConfig({ isOpen: true, title: "Status Updated", message: `'${actionType}' status for ${truckNumberText} updated!`, type: "success" });
    }

    setOdometer(""); setFuelLitres(""); setAdvanceAmt(""); setRemarks(""); setUnloadedMt(""); setDamagedBags("");
    setIsSubmitting(false);
  };

  // Orange themed sleek input style
  const inputStyle = "flex h-10 w-full rounded-md border border-slate-200 bg-slate-50/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5A00] focus-visible:border-[#FF5A00]";
  const labelStyle = "text-xs font-bold text-slate-600 uppercase tracking-wide leading-none mb-1";

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-lg relative mx-auto mt-4 overflow-hidden">
      
      {/* Top Branding Bar */}
      <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm bg-white">
             <KssLogo className="w-full h-full" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-tight leading-none">KSS Roadways</h1>
            <p className="text-[9px] text-[#FF5A00] font-bold uppercase tracking-widest mt-0.5">Driver Portal</p>
          </div>
        </div>
      </div>

      <AlertModal 
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />

      {!isDriverLocked ? (
        <form onSubmit={handleLockDriver} className="flex flex-col">
          <div className="flex flex-col p-6 space-y-1">
            <h3 className="font-bold tracking-tight text-xl">Device Setup</h3>
            <p className="text-sm text-slate-500">Select your profile to link this phone to your driver account.</p>
          </div>

          <div className="p-6 pt-0 grid gap-5">
            <div className="grid gap-1.5">
              <label className={labelStyle}>Driver Name</label>
              <select 
                value={driverCode} 
                onChange={e => setDriverCode(e.target.value)} 
                className={inputStyle}
                required
              >
                <option value="">Select your profile...</option>
                {drivers.map(d => (
                  <option key={d.driver_id} value={d.driver_code}>{d.full_name} ({d.driver_code})</option>
                ))}
              </select>
            </div>
            
            <button type="submit" className="inline-flex items-center justify-center rounded-lg text-sm font-black transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5A00] bg-[#FF5A00] text-white shadow-md hover:bg-[#e04f00] h-10 px-4 py-2 w-full mt-2">
              Save Device Profile
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleDriverSubmit} className="flex flex-col pb-4">
          
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Active Driver</p>
              <span className="text-sm font-black text-slate-900">{savedDriverCode}</span>
            </div>
            <button type="button" onClick={handleResetDriver} className="text-xs font-bold text-[#FF5A00] hover:text-[#e04f00] underline transition-colors">
              Switch
            </button>
          </div>

          <div className="p-6 grid gap-5">
            <div className="grid gap-1.5">
              <label className={labelStyle}>Active Truck</label>
              <select 
                value={selectedTruckId} 
                onChange={e => setSelectedTruckId(e.target.value)} 
                className={inputStyle}
                required
              >
                <option value="">Select current vehicle...</option>
                {vehicles.map(v => (
                  <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number} ({v.truck_type})</option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <label className={labelStyle}>Action Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "REACHED", label: "📍 Reached" },
                  { id: "UNLOADED", label: "📦 Unloaded" },
                  { id: "RETURNING", label: "🔄 Returning" },
                  { id: "BREAKDOWN", label: "⚠️ Breakdown" },
                  { id: "FUEL", label: "⛽ Fuel Fill" },
                  { id: "ADVANCE", label: "💵 Advance" },
                ].map(item => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setActionType(item.id)}
                    className={`inline-flex items-center justify-center rounded-lg text-xs font-bold transition-all h-9 border ${
                      actionType === item.id 
                        ? 'bg-[#FF5A00] border-[#FF5A00] text-white shadow-md' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 animate-in fade-in duration-300">
              
              {/* ODOMETER: Only show for Fuel, Breakdown, and Reached */}
              {(actionType === "FUEL" || actionType === "BREAKDOWN" || actionType === "REACHED") && (
                <div className="grid gap-1.5">
                  <label className={labelStyle}>Odometer (KM)</label>
                  <input type="number" value={odometer} onChange={e => setOdometer(Number(e.target.value))} placeholder="e.g. 145230" className={inputStyle} required={actionType === "FUEL"}/>
                </div>
              )}

              {/* FUEL: Only ask for Litres now, ERP handles cost */}
              {actionType === "FUEL" && (
                <div className="grid gap-1.5">
                  <label className={labelStyle}>Litres Filled</label>
                  <input type="number" step="0.01" value={fuelLitres} onChange={e => setFuelLitres(Number(e.target.value))} placeholder="0.0" className={inputStyle} required />
                </div>
              )}

              {/* ADVANCE */}
              {actionType === "ADVANCE" && (
                <div className="grid gap-1.5">
                  <label className={labelStyle}>Requested Amount (₹)</label>
                  <input type="number" step="0.01" value={advanceAmt} onChange={e => setAdvanceAmt(Number(e.target.value))} placeholder="0.00" className={inputStyle} required />
                </div>
              )}

              {/* UNLOADED LOGIC: Bulk vs Bags */}
              {actionType === "UNLOADED" && (
                <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl space-y-3">
                  {isBulk ? (
                    <>
                      <div className="grid gap-1.5">
                        <label className="text-xs font-bold text-orange-900 uppercase">Unloaded Weight (MT)</label>
                        <input type="number" step="0.01" value={unloadedMt} onChange={e => setUnloadedMt(Number(e.target.value))} disabled={noWeighment} placeholder={noWeighment ? "N/A" : "e.g. 30.50"} className={inputStyle} required={!noWeighment} />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={noWeighment} onChange={(e) => setNoWeighment(e.target.checked)} className="w-4 h-4 rounded text-[#FF5A00] focus:ring-[#FF5A00] border-orange-300" />
                        <span className="text-xs font-bold text-orange-800">No weighment facility available</span>
                      </label>
                    </>
                  ) : (
                    <div className="grid gap-1.5">
                      <label className="text-xs font-bold text-orange-900 uppercase">Damaged Bags Count</label>
                      <input type="number" value={damagedBags} onChange={e => setDamagedBags(Number(e.target.value))} placeholder="0" className={inputStyle} required />
                    </div>
                  )}
                </div>
              )}

              {/* REMARKS */}
              {(actionType === "BREAKDOWN" || actionType === "UNLOADED") && (
                <div className="grid gap-1.5">
                  <label className={labelStyle}>{actionType === "BREAKDOWN" ? "Breakdown Details" : "Additional Remarks"}</label>
                  <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder={actionType === "BREAKDOWN" ? "Describe issue & location" : "Any damages or notes?"} className={inputStyle} required={actionType === "BREAKDOWN"} />
                </div>
              )}
            </div>

            <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center rounded-lg text-sm font-black transition-colors bg-[#FF5A00] text-white shadow-md hover:bg-[#e04f00] h-12 px-4 py-2 w-full mt-2 disabled:opacity-50">
              {isSubmitting ? "Sending..." : `Submit Update`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
