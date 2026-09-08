"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function DriverPortal() {
  const supabase = createClient();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  
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
  const [successMsg, setSuccessMsg] = useState("");

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
    if (!driverCode) return alert("Please select your Name / Code.");
    
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

    if (!selectedTruckId) return alert("Please select the active Truck Number you are driving today.");

    setIsSubmitting(true);
    setSuccessMsg("");

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
        alert("Submission failed: " + error.message);
      } else {
        setSuccessMsg(`✅ ${actionType} for ${truckNumberText} submitted successfully! Sent to Cochin office.`);
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

      setSuccessMsg(`✅ Status '${actionType}' for ${truckNumberText} updated instantly!`);
    }

    setOdometer(""); setFuelLitres(""); setFuelCost(""); setAdvanceAmt(""); setRemarks("");
    setIsSubmitting(false);
  };

  return (
    <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8" style={{ colorScheme: 'light' }}>
      <div className="text-center mb-6 border-b border-slate-100 pb-4">
        <span className="inline-block px-3 py-1 bg-[#FF5A00]/10 text-[#FF5A00] font-black text-xs rounded-full uppercase tracking-widest mb-2">Driver Road Portal</span>
        <h2 className="text-xl font-black text-slate-900">KSS Roadways Quick Update</h2>
        <p className="text-xs text-slate-500 mt-1">Frictionless highway reporting terminal.</p>
      </div>

      {!isDriverLocked ? (
        <form onSubmit={handleLockDriver} className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <div className="text-center mb-4">
            <p className="text-xs font-bold text-slate-700 uppercase">📱 One-Time Driver Setup</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Select your name. This phone will remember your profile securely.</p>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Your Name / Code *</label>
            <select 
              value={driverCode} 
              onChange={e => setDriverCode(e.target.value)} 
              className="w-full text-sm p-3 rounded-xl border border-slate-300 font-bold bg-white text-slate-900 outline-none" 
              required
            >
              <option value="">-- CHOOSE DRIVER --</option>
              {drivers.map(d => (
                <option key={d.driver_id} value={d.driver_code}>{d.full_name} ({d.driver_code})</option>
              ))}
            </select>
          </div>
          <button type="submit" className="w-full py-3.5 bg-slate-900 text-white font-black text-sm rounded-xl hover:bg-slate-800 transition-all shadow-sm">
            Save Driver Profile to This Phone 🔒
          </button>
        </form>
      ) : (
        <div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase">Active Driver Profile (Locked)</p>
              <p className="text-sm font-black text-emerald-900">{savedDriverCode}</p>
            </div>
            <button onClick={handleResetDriver} className="text-[10px] font-bold text-rose-600 bg-white px-2.5 py-1 rounded-lg border border-rose-200 hover:bg-rose-50">
              Switch Driver
            </button>
          </div>

          {successMsg && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold text-center animate-in fade-in">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleDriverSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Active Truck For Today *</label>
              <select 
                value={selectedTruckId} 
                onChange={e => setSelectedTruckId(e.target.value)} 
                className="w-full text-sm p-3.5 rounded-xl border border-slate-300 font-black bg-slate-50 text-slate-900 outline-none focus:ring-2 focus:ring-[#FF5A00]" 
                required
              >
                <option value="">-- SELECT TRUCK YOU ARE DRIVING TODAY --</option>
                {vehicles.map(v => (
                  <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number} ({v.truck_type})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Select Update Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: "REACHED", label: "📍 Reached", desc: "Instant Update" },
                  { id: "UNLOADED", label: "📦 Unloaded", desc: "Instant Update" },
                  { id: "RETURNING", label: "🔄 Returning", desc: "Instant Update" },
                  { id: "BREAKDOWN", label: "⚠️ Breakdown", desc: "Instant Update" },
                  { id: "FUEL", label: "⛽ Fuel Fill", desc: "Manager Review" },
                  { id: "ADVANCE", label: "💵 Cash Advance", desc: "Manager Review" },
                ].map(item => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setActionType(item.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${actionType === item.id ? 'bg-[#FF5A00] text-white border-[#FF5A00] shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                  >
                    <p className="text-xs font-black">{item.label}</p>
                    <p className={`text-[9px] mt-0.5 ${actionType === item.id ? 'text-white/80 font-bold' : 'text-slate-400'}`}>{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-slate-100">
              {(actionType === "FUEL" || actionType === "ADVANCE" || actionType === "BREAKDOWN") && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Current Odometer (KM)</label>
                  <input 
                    type="number" 
                    value={odometer} 
                    onChange={e => setOdometer(Number(e.target.value))} 
                    placeholder="e.g. 145230" 
                    className="w-full text-sm p-3 rounded-xl border border-slate-300 font-bold bg-white text-slate-900 outline-none" 
                  />
                </div>
              )}

              {actionType === "FUEL" && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Litres Filled</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={fuelLitres} 
                      onChange={e => setFuelLitres(Number(e.target.value))} 
                      placeholder="e.g. 200" 
                      className="w-full text-sm p-3 rounded-xl border border-slate-300 font-bold bg-white text-slate-900 outline-none" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Cost (INR)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={fuelCost} 
                      onChange={e => setFuelCost(Number(e.target.value))} 
                      placeholder="e.g. 18500" 
                      className="w-full text-sm p-3 rounded-xl font-black text-emerald-600 border border-slate-300 bg-white outline-none" 
                      required 
                    />
                  </div>
                </div>
              )}

              {actionType === "ADVANCE" && (
                <div className="animate-in fade-in">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Requested Amount (INR)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={advanceAmt} 
                    onChange={e => setAdvanceAmt(Number(e.target.value))} 
                    placeholder="e.g. 5000" 
                    className="w-full text-sm p-3 rounded-xl font-black text-indigo-600 border border-slate-300 bg-white outline-none" 
                    required 
                  />
                </div>
              )}

              {(actionType === "BREAKDOWN" || actionType === "FUEL") && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Remarks / Location Details</label>
                  <input 
                    type="text" 
                    value={remarks} 
                    onChange={e => setRemarks(e.target.value)} 
                    placeholder={actionType === "BREAKDOWN" ? "e.g. Tyre burst near Salem bypass" : "e.g. BPC Pump Kochi"} 
                    className="w-full text-sm p-3 rounded-xl border border-slate-300 font-semibold bg-white text-slate-900 outline-none" 
                  />
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full py-4 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-base rounded-xl transition-all shadow-sm active:scale-95 disabled:bg-slate-300"
            >
              {isSubmitting ? "Submitting Update..." : `Submit ${actionType}`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
