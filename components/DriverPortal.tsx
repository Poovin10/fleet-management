"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal"; // Sleek modern alerts

export function DriverPortal() {
  const supabase = createClient();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  
  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info" as "success" | "error" | "info"
  });

  // Persistent driver memory state
  const [savedDriverCode, setSavedDriverCode] = useState("");
  const [isDriverLocked, setIsDriverLocked] = useState(false);

  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [driverCode, setDriverCode] = useState("");
  const [actionType, setActionType] = useState("REACHED"); 
  
  // Form fields
  const [odometer, setOdometer] = useState<number | "">("");
  const [fuelLitres, setFuelLitres] = useState<number | "">("");
  const [fuelCost, setFuelCost] = useState<number | "">("");
  const [advanceAmt, setAdvanceAmt] = useState<number | "">("");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchPortalData = async () => {
      const [vRes, dRes, tRes] = await Promise.all([
        supabase.from('vehicles').select('*').eq('is_active', true),
        supabase.from('drivers').select('*').eq('is_active', true),
        supabase.from('trips').select('trip_id, vehicle_id, trip_number, origin, destination').neq('trip_status', 'COMPLETED')
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

  const handleLockDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverCode) {
      setAlertConfig({ isOpen: true, title: "Missing Detail", message: "Please select your Name / Code to continue.", type: "error" });
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
    }
  };

  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeDriver = isDriverLocked ? savedDriverCode : driverCode;

    if (!selectedTruckId) {
      setAlertConfig({ isOpen: true, title: "Truck Required", message: "Please select the active Truck Number you are driving today.", type: "error" });
      return;
    }

    setIsSubmitting(true);

    const currentTrip = activeTrips.find(t => String(t.vehicle_id) === String(selectedTruckId));
    const timestamp = new Date().toISOString();

    let clientIp = "Mobile Cellular / Dynamic IP";
    try {
      const ipRes = await fetch("https://api64.ipify.org?format=json");
      const ipData = await ipRes.json();
      if (ipData.ip) clientIp = ipData.ip;
    } catch (err) {}

    const selectedTruckObj = vehicles.find(v => String(v.vehicle_id) === String(selectedTruckId));
    const truckNumberText = selectedTruckObj ? selectedTruckObj.vehicle_number : "Unknown Truck";

    if (actionType === "FUEL" || actionType === "ADVANCE") {
      const { error } = await supabase.from('driver_pending_entries').insert([{
        vehicle_id: Number(selectedTruckId),
        driver_code: activeDriver || "DRV-MOBILE",
        entry_type: actionType,
        amount_inr: actionType === "FUEL" ? Number(fuelCost) : Number(advanceAmt),
        litres: actionType === "FUEL" ? Number(fuelLitres) : 0,
        odometer_km: Number(odometer) || 0,
        receipt_remarks: `${remarks} [Truck: ${truckNumberText} | IP: ${clientIp}]`,
        status: 'PENDING'
      }]);

      if (error) {
        setAlertConfig({ isOpen: true, title: "Submission Failed", message: error.message, type: "error" });
      } else {
        setAlertConfig({ isOpen: true, title: "Success", message: `${actionType} request for ${truckNumberText} has been sent to the Cochin office.`, type: "success" });
      }
    } else {
      if (currentTrip) {
        let updatePayload: any = {};
        if (actionType === "REACHED") { updatePayload.reached_at = timestamp; updatePayload.trip_status = "REACHED_DESTINATION"; }
        if (actionType === "UNLOADED") { updatePayload.unloaded_at = timestamp; updatePayload.trip_status = "UNLOADED"; }
        if (actionType === "RETURNING") { updatePayload.returning_at = timestamp; updatePayload.trip_status = "RETURNING"; }
        if (actionType === "BREAKDOWN") { updatePayload.breakdown_remarks = `${remarks} [IP: ${clientIp}]`; updatePayload.trip_status = "BREAKDOWN"; }

        await supabase.from('trips').update(updatePayload).eq('trip_id', currentTrip.trip_id);
      }

      if (actionType === "BREAKDOWN") {
        await supabase.from('vehicles').update({ current_status: "WORKSHOP_MAINTENANCE", status_remarks: remarks }).eq('vehicle_id', selectedTruckId);
      }

      setAlertConfig({ isOpen: true, title: "Status Updated", message: `Status '${actionType}' for ${truckNumberText} updated instantly!`, type: "success" });
    }

    setOdometer(""); setFuelLitres(""); setFuelCost(""); setAdvanceAmt(""); setRemarks("");
    setIsSubmitting(false);
  };

  // Shared minimal input styling class
  const inputStyle = "w-full text-sm px-3 py-2.5 rounded-md border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all";
  const labelStyle = "block text-sm font-medium text-slate-900 mb-1.5";

  return (
    <div className="w-full max-w-md mx-auto relative animate-in fade-in zoom-in-95 duration-300">
      
      {/* Sleek Alert Modal */}
      <AlertModal 
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8">
        
        {!isDriverLocked ? (
          <form onSubmit={handleLockDriver}>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 mb-1.5">Driver Setup</h2>
              <p className="text-sm text-slate-500">Enter your details below to link this device to your account.</p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
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
            </div>

            <button type="submit" className="w-full inline-flex justify-center items-center rounded-md text-sm font-medium transition-colors bg-slate-900 text-white hover:bg-slate-800 h-10 px-4 py-2">
              Save Profile
            </button>
            <div className="mt-4 text-center">
              <p className="text-xs text-slate-500">Don't have an account? <span className="text-slate-900 font-medium underline cursor-pointer">Contact Dispatch</span></p>
            </div>
          </form>
        ) : (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 mb-1.5">Update Status</h2>
              <p className="text-sm text-slate-500">Submit your transit updates and logs below.</p>
            </div>

            <div className="flex justify-between items-center mb-6 py-3 px-4 bg-slate-50 border border-slate-200 rounded-md">
              <span className="text-sm font-medium text-slate-900">{savedDriverCode}</span>
              <button type="button" onClick={handleResetDriver} className="text-xs font-medium text-slate-500 hover:text-slate-900 underline transition-colors">
                Switch account
              </button>
            </div>

            <form onSubmit={handleDriverSubmit} className="space-y-5">
              <div>
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

              <div>
                <label className={labelStyle}>Action Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "REACHED", label: "📍 Reached" },
                    { id: "UNLOADED", label: "📦 Unloaded" },
                    { id: "RETURNING", label: "🔄 Returning" },
                    { id: "BREAKDOWN", label: "⚠️ Breakdown" },
                    { id: "FUEL", label: "⛽ Fuel Fill" },
                    { id: "ADVANCE", label: "💵 Cash Advance" },
                  ].map(item => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setActionType(item.id)}
                      className={`px-3 py-2.5 text-sm font-medium rounded-md border transition-all ${
                        actionType === item.id 
                          ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {(actionType === "FUEL" || actionType === "ADVANCE" || actionType === "BREAKDOWN") && (
                <div className="space-y-4 pt-2">
                  <div>
                    <label className={labelStyle}>Odometer (KM)</label>
                    <input 
                      type="number" 
                      value={odometer} 
                      onChange={e => setOdometer(Number(e.target.value))} 
                      placeholder="e.g. 145230" 
                      className={inputStyle} 
                    />
                  </div>

                  {actionType === "FUEL" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelStyle}>Litres Filled</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={fuelLitres} 
                          onChange={e => setFuelLitres(Number(e.target.value))} 
                          placeholder="0.0" 
                          className={inputStyle} 
                          required 
                        />
                      </div>
                      <div>
                        <label className={labelStyle}>Total Cost (₹)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={fuelCost} 
                          onChange={e => setFuelCost(Number(e.target.value))} 
                          placeholder="0.00" 
                          className={inputStyle} 
                          required 
                        />
                      </div>
                    </div>
                  )}

                  {actionType === "ADVANCE" && (
                    <div>
                      <label className={labelStyle}>Requested Amount (₹)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={advanceAmt} 
                        onChange={e => setAdvanceAmt(Number(e.target.value))} 
                        placeholder="0.00" 
                        className={inputStyle} 
                        required 
                      />
                    </div>
                  )}

                  {(actionType === "BREAKDOWN" || actionType === "FUEL") && (
                    <div>
                      <label className={labelStyle}>Location / Remarks</label>
                      <input 
                        type="text" 
                        value={remarks} 
                        onChange={e => setRemarks(e.target.value)} 
                        placeholder={actionType === "BREAKDOWN" ? "Describe issue & location" : "Pump location name"} 
                        className={inputStyle} 
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full inline-flex justify-center items-center rounded-md text-sm font-medium transition-colors bg-slate-900 text-white hover:bg-slate-800 h-10 px-4 py-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Submitting..." : `Submit Update`}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
