"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";

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
  const [activeTab, setActiveTab] = useState<"STATUS" | "LEDGER">("STATUS");

  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [driverCode, setDriverCode] = useState("");
  const [driverPin, setDriverPin] = useState("");
  const [actionType, setActionType] = useState("REACHED"); 
  
  // Standard Form fields
  const [odometer, setOdometer] = useState<number | "">("");
  const [fuelLitres, setFuelLitres] = useState<number | "">("");
  const [remarks, setRemarks] = useState("");
  
  // UNLOADED fields
  const [unloadedMt, setUnloadedMt] = useState<number | "">("");
  const [damagedBags, setDamagedBags] = useState<number | "">("");
  const [noWeighment, setNoWeighment] = useState(false);

  // History/Reports state
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [currentMonthTrips, setCurrentMonthTrips] = useState<any[]>([]);
  const [currentMonthAdvances, setCurrentMonthAdvances] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to format dates & timestamps to DD/MM/YYYY HH:MM
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${day}/${month}/${year} at ${time}`;
    } catch {
      return dateStr;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    if (!dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  // Fetch Core Data
  const fetchPortalData = async () => {
    const [vRes, dRes, tRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('is_active', true),
      supabase.from('drivers').select('*').eq('is_active', true),
      supabase.from('trips').select('trip_id, vehicle_id, trip_number, origin, destination, primary_driver_id, loaded_weight_mt, trip_status, trip_start_date, reached_at, unloaded_at, returning_at').neq('trip_status', 'COMPLETED')
    ]);

    if (vRes.data) setVehicles(vRes.data);
    if (dRes.data) setDrivers(dRes.data);
    if (tRes.data) setActiveTrips(tRes.data);
  };

  // Fetch Driver Specific History for Current Fiscal Month
  const fetchDriverCurrentMonthReports = async (drvCode: string, drvId: number) => {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const firstDay = `${currentYearMonth}-01`;

    const [reqRes, tripRes, advRes] = await Promise.all([
      supabase.from('driver_pending_entries').select('*').eq('driver_code', drvCode).order('created_at', { ascending: false }).limit(10),
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

  useEffect(() => {
    if (isDriverLocked && drivers.length > 0) {
      const activeDriverObj = drivers.find(d => d.driver_code === savedDriverCode);
      if (activeDriverObj) {
        if (activeTrips.length > 0) {
          const activeTrip = activeTrips.find(t => String(t.primary_driver_id) === String(activeDriverObj.driver_id));
          if (activeTrip) setSelectedTruckId(String(activeTrip.vehicle_id));
        }
        fetchDriverCurrentMonthReports(savedDriverCode, activeDriverObj.driver_id);
      }
    }
  }, [isDriverLocked, drivers, activeTrips, savedDriverCode, activeTab]);

  const activeDriverObj = drivers.find(d => d.driver_code === savedDriverCode);
  const displayDriverName = activeDriverObj ? `${activeDriverObj.full_name} (${activeDriverObj.driver_code})` : savedDriverCode;
  
  const selectedTruckObj = vehicles.find(v => String(v.vehicle_id) === String(selectedTruckId));
  const currentTrip = activeTrips.find(t => String(t.vehicle_id) === String(selectedTruckId));
  const isBulk = selectedTruckObj ? String(selectedTruckObj.truck_type).toUpperCase().includes("BULK") : true;

  // Current Month Calculations (Using Dispatch-issued direct advances and trip advances)
  const monthEarnedBata = currentMonthTrips.reduce((sum, t) => sum + (Number(t.driver_bata) || 0), 0);
  const monthHaltBata = currentMonthTrips.reduce((sum, t) => sum + (Number(t.halt_bata) || 0), 0);
  const monthTripAdvances = currentMonthTrips.reduce((sum, t) => sum + (Number(t.cash_advance_issued) || 0), 0);
  const monthDirectAdvances = currentMonthAdvances.reduce((sum, a) => sum + (Number(a.amount_inr) || 0), 0);
  
  const totalMonthEarnings = monthEarnedBata + monthHaltBata;
  const totalMonthDeductions = monthTripAdvances + monthDirectAdvances;
  const currentMonthNetBalance = totalMonthEarnings - totalMonthDeductions;

  const handleLockDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverCode) {
      return setAlertConfig({ isOpen: true, title: "Missing Detail", message: "Please select your driver profile.", type: "error" });
    }

    const selectedDrv = drivers.find(d => d.driver_code === driverCode);
    const expectedPin = selectedDrv?.pin || "1234";

    if (driverPin.trim() !== expectedPin.toString().trim()) {
      return setAlertConfig({ isOpen: true, title: "Invalid PIN", message: "Incorrect security PIN. Please check with dispatch.", type: "error" });
    }

    localStorage.setItem("kss_device_driver", driverCode.toUpperCase().trim());
    setSavedDriverCode(driverCode.toUpperCase().trim());
    setIsDriverLocked(true);
    setDriverPin("");
  };

  const handleResetDriver = () => {
    if (confirm("Switch driver profile on this device?")) {
      localStorage.removeItem("kss_device_driver");
      setIsDriverLocked(false);
      setSavedDriverCode("");
      setSelectedTruckId("");
      setDriverPin("");
    }
  };

  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTruckId) return setAlertConfig({ isOpen: true, title: "Truck Required", message: "Select active Truck.", type: "error" });

    setIsSubmitting(true);
    const timestamp = new Date().toISOString();
    const truckNumberText = selectedTruckObj ? selectedTruckObj.vehicle_number : "Unknown";

    if (actionType === "FUEL") {
      const { error } = await supabase.from('driver_pending_entries').insert([{
        vehicle_id: Number(selectedTruckId),
        driver_code: savedDriverCode || "DRV-MOBILE",
        entry_type: "FUEL",
        litres: Number(fuelLitres),
        odometer_km: Number(odometer) || 0,
        receipt_remarks: `${remarks} [Truck: ${truckNumberText}]`,
        status: 'PENDING'
      }]);

      if (error) setAlertConfig({ isOpen: true, title: "Failed", message: error.message, type: "error" });
      else setAlertConfig({ isOpen: true, title: "Success", message: `Fuel fill request sent to dispatch!`, type: "success" });
    } else {
      if (currentTrip) {
        let updatePayload: any = {};
        let finalRemarks = remarks;
        let vehicleStatusUpdate = "IN_TRANSIT";
        let statusRemarksText = "";

        if (actionType === "REACHED") { 
          updatePayload.reached_at = timestamp; 
          updatePayload.trip_status = "REACHED_DESTINATION"; 
          updatePayload.end_km = Number(odometer) || 0; 
          statusRemarksText = `Reached ${currentTrip.destination} at ${formatDateTime(timestamp)}`;
        }
        else if (actionType === "UNLOADED") { 
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
              if (shortage > 0.15) finalRemarks = `🚨 [HIGH SHORTAGE: ${shortage.toFixed(3)} MT] ${finalRemarks}`;
            }
          } else {
            finalRemarks = `[DAMAGED BAGS: ${damagedBags || 0}] ${finalRemarks}`;
          }
          statusRemarksText = `Unloaded at ${currentTrip.destination}`;
        }
        else if (actionType === "RETURNING") { 
          updatePayload.returning_at = timestamp; 
          updatePayload.trip_status = "RETURNING"; 
          statusRemarksText = `Returning from ${currentTrip.destination}`;
        }
        else if (actionType === "WAITING_FOR_LOAD") {
          updatePayload.trip_status = "WAITING_FOR_LOAD";
          vehicleStatusUpdate = "WAITING_FOR_LOAD";
          statusRemarksText = `Waiting for load at plant (${currentTrip.origin})`;
        }
        else if (actionType === "BREAKDOWN") { 
          updatePayload.breakdown_remarks = `${finalRemarks} [Odo: ${odometer}]`; 
          updatePayload.trip_status = "BREAKDOWN"; 
          vehicleStatusUpdate = "WORKSHOP_MAINTENANCE";
          statusRemarksText = `Enroute Breakdown`;
        }

        if (finalRemarks && (actionType === "UNLOADED" || actionType === "BREAKDOWN")) {
          updatePayload.status_remarks = finalRemarks;
        } else {
          updatePayload.status_remarks = statusRemarksText;
        }

        await supabase.from('trips').update(updatePayload).eq('trip_id', currentTrip.trip_id);
        await supabase.from('vehicles').update({ current_status: vehicleStatusUpdate, status_remarks: statusRemarksText }).eq('vehicle_id', selectedTruckId);
      }
      
      setAlertConfig({ isOpen: true, title: "Status Updated", message: `Trip status successfully updated!`, type: "success" });
    }

    setOdometer(""); setFuelLitres(""); setRemarks(""); setUnloadedMt(""); setDamagedBags("");
    setIsSubmitting(false);
    await fetchPortalData(); 
  };

  const handleCancelRequest = async (id: number) => {
    if (!confirm("Delete this request?")) return;
    await supabase.from('driver_pending_entries').delete().eq('id', id);
    if (activeDriverObj) fetchDriverCurrentMonthReports(savedDriverCode, activeDriverObj.driver_id);
    setAlertConfig({ isOpen: true, title: "Deleted", message: "Request cancelled.", type: "success" });
  };

  const inputStyle = "flex h-10 w-full rounded-md border border-slate-200 bg-slate-50/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5A00] focus-visible:border-[#FF5A00]";
  const labelStyle = "text-xs font-bold text-slate-600 uppercase tracking-wide leading-none mb-1";

  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-lg relative mx-auto mt-4 overflow-hidden mb-10" style={{ colorScheme: 'light' }}>
      
      {/* Branding */}
      <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm bg-white"><KssLogo className="w-full h-full" /></div>
          <div>
            <h1 className="text-sm font-black text-white tracking-tight leading-none">KSS Roadways</h1>
            <p className="text-[9px] text-[#FF5A00] font-bold uppercase tracking-widest mt-0.5">Driver Portal</p>
          </div>
        </div>
      </div>

      <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} />

      {!isDriverLocked ? (
        <form onSubmit={handleLockDriver} className="flex flex-col">
          <div className="flex flex-col p-6 space-y-1">
            <h3 className="font-bold tracking-tight text-xl">Secure Device Setup</h3>
            <p className="text-sm text-slate-500">Select your profile and enter your 4-digit security PIN.</p>
          </div>
          <div className="p-6 pt-0 grid gap-5">
            <div className="grid gap-1.5">
              <label className={labelStyle}>Driver Name</label>
              <select value={driverCode} onChange={e => setDriverCode(e.target.value)} className={inputStyle} required>
                <option value="">Select your profile...</option>
                {drivers.map(d => (<option key={d.driver_id} value={d.driver_code}>{d.full_name} ({d.driver_code})</option>))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <label className={labelStyle}>4-Digit Security PIN</label>
              <input 
                type="password" 
                maxLength={4} 
                value={driverPin} 
                onChange={e => setDriverPin(e.target.value)} 
                placeholder="••••" 
                className={inputStyle} 
                required 
              />
            </div>
            <button type="submit" className="inline-flex items-center justify-center rounded-lg text-sm font-black bg-[#FF5A00] text-white shadow-md hover:bg-[#e04f00] h-10 px-4 py-2 w-full mt-2">
              Verify & Lock Device
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col pb-4">
          
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Active Driver</p>
              <span className="text-sm font-black text-slate-900">{displayDriverName}</span>
            </div>
            <button type="button" onClick={handleResetDriver} className="text-xs font-bold text-[#FF5A00] hover:text-[#e04f00] underline transition-colors">Switch</button>
          </div>

          {/* TABS */}
          <div className="flex border-b border-slate-200">
            <button onClick={() => setActiveTab("STATUS")} className={`flex-1 py-3 text-sm font-black ${activeTab === "STATUS" ? "border-b-2 border-[#FF5A00] text-[#FF5A00]" : "text-slate-400 hover:text-slate-700"}`}>🚀 Trip Status</button>
            <button onClick={() => setActiveTab("LEDGER")} className={`flex-1 py-3 text-sm font-black ${activeTab === "LEDGER" ? "border-b-2 border-[#FF5A00] text-[#FF5A00]" : "text-slate-400 hover:text-slate-700"}`}>📊 Month Ledger</button>
          </div>

          {/* TAB 1: TRIP STATUS & LIFECYCLE */}
          {activeTab === "STATUS" && (
            <form onSubmit={handleDriverSubmit} className="p-6 grid gap-5 animate-in fade-in">
              <div className="grid gap-1.5">
                <label className={labelStyle}>Active Truck</label>
                <select value={selectedTruckId} onChange={e => setSelectedTruckId(e.target.value)} className={inputStyle} required>
                  <option value="">Select assigned vehicle...</option>
                  {vehicles.map(v => (<option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number} ({v.truck_type})</option>))}
                </select>
              </div>

              {/* CURRENT ACTIVE LR BANNER & PROFESSIONAL TIMELINE */}
              {currentTrip && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-orange-900">Active LR: {currentTrip.trip_number}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-orange-200 text-orange-900 rounded-full">{currentTrip.trip_status}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-700">{currentTrip.origin} ➔ {currentTrip.destination}</p>
                  <p className="text-[11px] text-slate-500 pt-1 border-t border-orange-200/60">
                    Started: {formatDateTime(currentTrip.trip_start_date)}
                  </p>
                </div>
              )}

              <div className="grid gap-1.5">
                <label className={labelStyle}>Update Lifecycle Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {[ 
                    { id: "REACHED", label: "📍 Reached Destination" }, 
                    { id: "UNLOADED", label: "📦 Unloaded" }, 
                    { id: "RETURNING", label: "🔄 Returning" }, 
                    { id: "WAITING_FOR_LOAD", label: "⏳ Waiting for Load" }, 
                    { id: "BREAKDOWN", label: "⚠️ Breakdown" }, 
                    { id: "FUEL", label: "⛽ Fuel Fill Request" } 
                  ].map(item => (
                    <button type="button" key={item.id} onClick={() => setActionType(item.id)} className={`inline-flex items-center justify-center rounded-lg text-xs font-bold transition-all h-10 px-2 text-center border ${actionType === item.id ? 'bg-[#FF5A00] border-[#FF5A00] text-white shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {(actionType === "FUEL" || actionType === "BREAKDOWN" || actionType === "REACHED") && (
                  <div className="grid gap-1.5">
                    <label className={labelStyle}>Odometer (KM)</label>
                    <input type="number" min="0" value={odometer} onChange={e => setOdometer(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="e.g. 145230" className={inputStyle} required={actionType === "FUEL"}/>
                  </div>
                )}
                {actionType === "FUEL" && (
                  <div className="grid gap-1.5">
                    <label className={labelStyle}>Litres Filled</label>
                    <input type="number" step="0.01" min="0.1" value={fuelLitres} onChange={e => setFuelLitres(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.0" className={inputStyle} required />
                  </div>
                )}
                {actionType === "UNLOADED" && (
                  <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl space-y-3">
                    {isBulk ? (
                      <>
                        <div className="grid gap-1.5">
                          <label className="text-xs font-bold text-orange-900 uppercase">Unloaded Weight (MT)</label>
                          <input type="number" step="0.01" min="0" value={unloadedMt} onChange={e => setUnloadedMt(e.target.value === "" ? "" : parseFloat(e.target.value))} disabled={noWeighment} placeholder={noWeighment ? "N/A" : "e.g. 30.50"} className={inputStyle} required={!noWeighment} />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input type="checkbox" checked={noWeighment} onChange={(e) => setNoWeighment(e.target.checked)} className="w-4 h-4 rounded text-[#FF5A00] focus:ring-[#FF5A00] border-orange-300" />
                          <span className="text-xs font-bold text-orange-800">No weighment facility</span>
                        </label>
                      </>
                    ) : (
                      <div className="grid gap-1.5">
                        <label className="text-xs font-bold text-orange-900 uppercase">Damaged Bags Count</label>
                        <input type="number" min="0" value={damagedBags} onChange={e => setDamagedBags(e.target.value === "" ? "" : parseInt(e.target.value))} placeholder="0" className={inputStyle} required />
                      </div>
                    )}
                  </div>
                )}
                {(actionType === "BREAKDOWN" || actionType === "UNLOADED") && (
                  <div className="grid gap-1.5">
                    <label className={labelStyle}>{actionType === "BREAKDOWN" ? "Breakdown Details" : "Additional Remarks"}</label>
                    <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder={actionType === "BREAKDOWN" ? "Describe issue & location" : "Any damages or notes?"} className={inputStyle} required={actionType === "BREAKDOWN"} />
                  </div>
                )}
                <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center rounded-lg text-sm font-black transition-colors bg-[#FF5A00] text-white shadow-md hover:bg-[#e04f00] h-12 px-4 py-2 w-full mt-2 disabled:opacity-50">
                  {isSubmitting ? "Updating..." : `Confirm Status Update`}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: CURRENT MONTH LEDGER */}
          {activeTab === "LEDGER" && (
            <div className="p-6 grid gap-6 bg-slate-50 min-h-[400px] animate-in fade-in">
              
              {/* NET BALANCE CARD */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Month Net Balance</p>
                <div className="flex justify-between items-baseline mt-1">
                  <span className={`text-2xl font-black ${currentMonthNetBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ₹{currentMonthNetBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-400">{currentMonthNetBalance >= 0 ? 'Net Payable' : 'Deficit'}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-2 text-[11px] text-slate-300">
                  <div>Earned Bata: <strong className="text-white">₹{monthEarnedBata}</strong></div>
                  <div>Halt Bata (Exp): <strong className="text-amber-400">₹{monthHaltBata}</strong></div>
                  <div className="col-span-2 mt-1">Total Deductions (Advances): <strong className="text-rose-400">₹{totalMonthDeductions}</strong></div>
                </div>
              </div>

              {/* PENDING FUEL REQUESTS */}
              {pendingRequests.length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase mb-3">Pending Requests</h4>
                  <div className="space-y-3">
                    {pendingRequests.map(r => (
                      <div key={r.id} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-black text-slate-900">{r.entry_type} - {r.entry_type === 'FUEL' ? `${r.litres}L` : `₹${r.amount_inr}`}</span>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">{r.status}</span>
                        </div>
                        <div className="flex justify-end mt-2">
                          <button onClick={() => handleCancelRequest(r.id)} className="px-2.5 py-1 text-[10px] font-bold text-rose-600 bg-white border border-rose-200 rounded-lg">Cancel Request ❌</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TRIPWISE BREAKDOWN FOR CURRENT MONTH */}
              <div>
                <h4 className="text-xs font-black text-slate-900 uppercase mb-3">Current Month Tripwise Ledger</h4>
                {currentMonthTrips.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No trips logged this month yet.</p>
                ) : (
                  <div className="space-y-3">
                    {currentMonthTrips.map(t => {
                      const tripBata = Number(t.driver_bata) || 0;
                      const halt = Number(t.halt_bata) || 0;
                      const adv = Number(t.cash_advance_issued) || 0;
                      return (
                        <div key={t.trip_id} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2">
                          <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                            <div>
                              <p className="text-sm font-black text-slate-900">{t.trip_number}</p>
                              <p className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]">{t.origin} ➔ {t.destination}</p>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">{formatDate(t.trip_start_date)}</span>
                          </div>
                          <div className="grid grid-cols-3 text-[11px] text-slate-600">
                            <div>Bata: <strong className="text-emerald-600">₹{tripBata}</strong></div>
                            <div>Halt: <strong className="text-amber-600">₹{halt}</strong></div>
                            <div>Adv: <strong className="text-rose-600">₹{adv}</strong></div>
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
