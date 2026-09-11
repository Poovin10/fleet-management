"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal";

export function ModifyTrips() {
  const supabase = createClient();
  
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [tripsList, setTripsList] = useState<any[]>([]);
  const [editTripId, setEditTripId] = useState<number | null>(null);
  const [currentTrip, setCurrentTrip] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- TRIP SEARCH & AUDIT STATES ---
  const [auditDateMode, setAuditDateMode] = useState("All Time");
  const [auditSpecificDate, setAuditSpecificDate] = useState(new Date().toISOString().split('T')[0]);
  const [auditFromDate, setAuditFromDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [auditToDate, setAuditToDate] = useState(new Date().toISOString().split('T')[0]);
  const [auditTruck, setAuditTruck] = useState("All Trucks");
  const [auditStatus, setAuditStatus] = useState("All Statuses");
  const [auditSearchLr, setAuditSearchLr] = useState("");

  // --- FULL EDIT FORM STATES ---
  const [tripNumber, setTripNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [status, setStatus] = useState("DISPATCHED");
  
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [driverId, setDriverId] = useState("");
  
  const [tonnage, setTonnage] = useState<number | "">("");
  const [spotRate, setSpotRate] = useState<number | "">("");
  
  const [dieselL, setDieselL] = useState<number | "">("");
  const [driverBata, setDriverBata] = useState<number | "">("");
  const [advanceIssued, setAdvanceIssued] = useState<number | "">("");
  
  const [endDate, setEndDate] = useState("");
  const [unloadedMt, setUnloadedMt] = useState<number | "">("");
  const [haltBata, setHaltBata] = useState<number | "">("");

  // Auto-calculated gross freight
  const grossFreight = Math.round((Number(tonnage) || 0) * (Number(spotRate) || 0) * 100) / 100;

  const [modalConfig, setModalConfig] = useState({ 
    isOpen: false, 
    title: "", 
    message: "", 
    isDanger: false, 
    confirmText: "Confirm", 
    action: async () => {} 
  });
  
  const triggerModal = (title: string, message: string, isDanger: boolean, confirmText: string, action: () => Promise<void>) => 
    setModalConfig({ isOpen: true, title, message, isDanger, confirmText, action });
  
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  // Helper to format dates visually
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    if (!dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const loadInitialData = async () => {
    setIsProcessing(true);
    // Fetch vehicles for the dropdown
    const { data: vData } = await supabase.from('vehicles').select('vehicle_number').eq('is_active', true).order('vehicle_number');
    if (vData) setVehicles(vData);

    // Fetch active drivers for the dropdown
    const { data: dData } = await supabase.from('drivers').select('driver_id, full_name, driver_code').eq('is_active', true).order('full_name');
    if (dData) setDrivers(dData);

    // Initial trip fetch (Top 200)
    await handleSearchTrips();
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleSearchTrips = async () => {
    setIsProcessing(true);
    
    const selectString = auditTruck !== "All Trucks" 
      ? '*, vehicles!inner(vehicle_number), drivers(full_name)' 
      : '*, vehicles(vehicle_number), drivers(full_name)';

    let query = supabase.from('trips').select(selectString).order('trip_start_date', { ascending: false }).order('trip_id', { ascending: false }).limit(200);

    if (auditDateMode === "Specific Date") query = query.eq('trip_start_date', auditSpecificDate);
    else if (auditDateMode === "Date Range") query = query.gte('trip_start_date', auditFromDate).lte('trip_start_date', auditToDate);

    if (auditTruck !== "All Trucks") query = query.eq('vehicles.vehicle_number', auditTruck);
    if (auditStatus !== "All Statuses") query = query.eq('trip_status', auditStatus);
    if (auditSearchLr) query = query.ilike('trip_number', `%${auditSearchLr}%`);

    const { data } = await query;
    if (data) setTripsList(data);
    else setTripsList([]);
    
    setIsProcessing(false);
  };

  const exportTripsToCSV = () => {
    if (tripsList.length === 0) return alert("No trip data to export.");
    const headers = ["Trip ID", "Date", "LR Number", "Truck No", "Driver", "Route", "Status", "Loaded MT", "Freight Rate", "Driver Bata", "Halt Bata", "Advance Issued"];
    
    const rows = tripsList.map(t => [
      t.trip_id,
      t.trip_start_date,
      t.trip_number || "-",
      t.vehicles?.vehicle_number || "Unknown",
      t.drivers?.full_name || "Unknown",
      `${t.origin} ➔ ${t.destination}`,
      t.trip_status,
      t.tonnage_loaded || 0,
      t.spot_freight_rate || 0,
      t.driver_bata || 0,
      t.halt_bata || 0,
      t.cash_advance_issued || 0
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Trip_Audit_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditClick = (trip: any) => {
    setEditTripId(trip.trip_id);
    setCurrentTrip(trip);
    
    // Populate all fields safely
    setTripNumber(trip.trip_number || "");
    setStartDate(trip.trip_start_date ? trip.trip_start_date.split('T')[0] : "");
    setStatus(trip.trip_status || "DISPATCHED");
    
    setOrigin(trip.origin || "");
    setDestination(trip.destination || "");
    setDriverId(trip.primary_driver_id ? String(trip.primary_driver_id) : "");
    
    setTonnage(trip.tonnage_loaded || "");
    // Fallback calculation if spot_freight_rate is missing but revenue exists
    const rate = trip.spot_freight_rate || (trip.freight_revenue && trip.tonnage_loaded ? (trip.freight_revenue / trip.tonnage_loaded).toFixed(2) : "");
    setSpotRate(Number(rate));
    
    setDieselL(trip.fuel_litres || "");
    setDriverBata(trip.driver_bata || "");
    setAdvanceIssued(trip.cash_advance_issued || "");
    
    setEndDate(trip.trip_end_date ? trip.trip_end_date.split('T')[0] : "");
    setUnloadedMt(trip.unloaded_weight_mt || "");
    setHaltBata(trip.halt_bata || "");
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearForm = () => {
    setEditTripId(null);
    setCurrentTrip(null);
    setTripNumber("");
    setStartDate("");
    setStatus("DISPATCHED");
    setOrigin("");
    setDestination("");
    setDriverId("");
    setTonnage("");
    setSpotRate("");
    setDieselL("");
    setDriverBata("");
    setAdvanceIssued("");
    setEndDate("");
    setUnloadedMt("");
    setHaltBata("");
  };

  const handleUpdateTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTrip) return;

    triggerModal("Update Trip & Sync Ledgers", `Save all modifications for Trip #${currentTrip.trip_number}? This will automatically sync your fuel audits.`, false, "Save & Sync", async () => {
      setIsProcessing(true);
      
      // 1. Calculate the exact new diesel cost if litres were changed
      let currentDieselRate = 95.0; // Fallback
      if (currentTrip.fuel_litres && currentTrip.fuel_expense) {
          currentDieselRate = currentTrip.fuel_expense / currentTrip.fuel_litres;
      } else {
          // If trip had no fuel before, grab the latest global diesel rate
          const { data: dData } = await supabase.from('diesel_fuel_logs').select('diesel_rate_per_litre').order('fuel_date', { ascending: false }).limit(1);
          if (dData && dData.length > 0) currentDieselRate = Number(dData[0].diesel_rate_per_litre);
      }
      const newFuelCost = Math.round((Number(dieselL) || 0) * currentDieselRate * 100) / 100;

      // 2. Prepare the Trip Update Payload
      const updatePayload = {
        trip_number: tripNumber.toUpperCase().trim(),
        trip_start_date: startDate || null,
        origin: origin.toUpperCase().trim(),
        destination: destination.toUpperCase().trim(),
        primary_driver_id: driverId ? Number(driverId) : null,
        tonnage_loaded: tonnage !== "" ? Number(tonnage) : null,
        freight_revenue: grossFreight,
        fuel_litres: dieselL !== "" ? Number(dieselL) : null,
        fuel_expense: newFuelCost, // Save the newly calculated fuel cost
        driver_bata: driverBata !== "" ? Number(driverBata) : null,
        cash_advance_issued: advanceIssued !== "" ? Number(advanceIssued) : null,
        trip_status: status,
        trip_end_date: endDate || null,
        unloaded_weight_mt: unloadedMt !== "" ? Number(unloadedMt) : null,
        halt_bata: haltBata !== "" ? Number(haltBata) : null,
      };

      // 3. Save Trip
      const { error } = await supabase.from('trips').update(updatePayload).eq('trip_id', currentTrip.trip_id);

      if (error) {
        alert("Error updating trip: " + error.message);
        setIsProcessing(false);
        closeModal();
        return;
      }

      // 4. THE MASTER SYNC: Update the Fuel Audit DB based on the changes!
      if (Number(dieselL) !== Number(currentTrip.fuel_litres || 0)) {
        if (Number(dieselL) > 0) {
            // Find if a fuel log already exists for this trip
            const { data: existingLogs } = await supabase.from('diesel_fuel_logs').select('fuel_log_id').eq('trip_id', currentTrip.trip_id);
            
            if (existingLogs && existingLogs.length > 0) {
                // Update the existing log with new totals
                await supabase.from('diesel_fuel_logs').update({
                    litres_filled: Number(dieselL),
                    total_fuel_cost: newFuelCost,
                    diesel_rate_per_litre: currentDieselRate,
                    lr_number: tripNumber.toUpperCase().trim()
                }).eq('fuel_log_id', existingLogs[0].fuel_log_id);
                
                // If by some glitch there are multiple logs for one trip, delete the extras to keep ledgers clean
                if (existingLogs.length > 1) {
                    const extraIds = existingLogs.slice(1).map(l => l.fuel_log_id);
                    await supabase.from('diesel_fuel_logs').delete().in('fuel_log_id', extraIds);
                }
            } else {
                // If user added diesel to a trip that originally had 0L, inject a new log
                await supabase.from('diesel_fuel_logs').insert([{
                    fuel_date: startDate || new Date().toISOString().split('T')[0],
                    vehicle_id: currentTrip.vehicle_id,
                    trip_id: currentTrip.trip_id,
                    lr_number: tripNumber.toUpperCase().trim(),
                    diesel_category: "TRIP_DIESEL",
                    litres_filled: Number(dieselL),
                    diesel_rate_per_litre: currentDieselRate,
                    total_fuel_cost: newFuelCost,
                    filling_odometer_km: currentTrip.start_km || 0,
                    is_tank_full: false
                }]);
            }
        } else {
            // If the user changed diesel to 0, completely delete the audit log
            await supabase.from('diesel_fuel_logs').delete().eq('trip_id', currentTrip.trip_id);
        }
      }

      await handleSearchTrips();
      clearForm();
      setIsProcessing(false);
      closeModal();
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <ConfirmModal 
        isOpen={modalConfig.isOpen} 
        title={modalConfig.title} 
        message={modalConfig.message} 
        isDanger={modalConfig.isDanger} 
        confirmText={modalConfig.confirmText} 
        onConfirm={modalConfig.action} 
        onCancel={closeModal} 
        isProcessing={isProcessing} 
      />

      {/* TOP SECTION: FULL EDIT FORM */}
      <div className="bg-[#161922] border border-[#272B36] rounded-2xl p-6 sm:p-8 shadow-xl max-w-5xl mx-auto h-fit">
        <div className="flex justify-between items-center border-b border-[#272B36] pb-3 mb-6">
          <h3 className="text-sm font-black text-white uppercase tracking-wide">
            {currentTrip ? `Modify Trip: ${currentTrip.trip_number}` : "Modify Existing Trip"}
          </h3>
          {currentTrip && <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded-lg uppercase tracking-widest animate-pulse">Editing Mode</span>}
        </div>

        {!currentTrip ? (
          <div className="py-12 text-center border-2 border-dashed border-[#272B36] rounded-xl bg-[#0F1117]">
            <p className="text-slate-400 font-bold text-sm">Select a trip from the Search & Audit Log below to modify its details.</p>
          </div>
        ) : (
          <form onSubmit={handleUpdateTrip} className="space-y-5 animate-in slide-in-from-bottom-4">
            
            {/* Quick Read-Only Warning */}
            <div className="flex flex-wrap gap-4 bg-emerald-950/20 p-3 rounded-xl border border-emerald-900/50">
              <span className="text-xs text-emerald-500 font-bold uppercase tracking-wider">✅ Auto-Sync Enabled: Any changes to Diesel Litres will automatically update your Fuel Audit database.</span>
            </div>

            {/* ROW 1: LR No, Start Date, Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">LR Number</label>
                <input type="text" value={tripNumber} onChange={e => setTripNumber(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-white uppercase font-bold outline-none focus:border-[#FF5A00]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Dispatch Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-white font-bold outline-none focus:border-[#FF5A00]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Trip Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-white font-bold outline-none focus:border-[#FF5A00]">
                  <option value="DISPATCHED">DISPATCHED</option>
                  <option value="IN_TRANSIT">IN_TRANSIT</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>

            {/* ROW 2: Source, Destination, Driver */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Source (Origin)</label>
                <input type="text" value={origin} onChange={e => setOrigin(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-white uppercase font-bold outline-none focus:border-[#FF5A00]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Destination</label>
                <input type="text" value={destination} onChange={e => setDestination(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-white uppercase font-bold outline-none focus:border-[#FF5A00]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Primary Driver</label>
                <select value={driverId} onChange={e => setDriverId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-white font-bold outline-none focus:border-[#FF5A00]">
                  <option value="">-- UNASSIGNED --</option>
                  {drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.driver_code} - {d.full_name}</option>)}
                </select>
              </div>
            </div>

            {/* ROW 3: Loaded MT, Rate, Auto Gross */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-[#0F1117] rounded-xl border border-[#272B36]">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Loaded MT</label>
                <input type="number" step="0.01" value={tonnage} onChange={e => setTonnage(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-white font-bold outline-none focus:border-[#FF5A00]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Freight Rate / MT (₹)</label>
                <input type="number" step="0.01" value={spotRate} onChange={e => setSpotRate(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-emerald-400 font-bold outline-none focus:border-[#FF5A00]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Auto-Calc Gross Freight (₹)</label>
                <input type="text" value={`₹${grossFreight.toLocaleString('en-IN', {minimumFractionDigits: 2})}`} disabled className="w-full text-sm p-3 rounded-xl border border-emerald-900/50 bg-emerald-950/20 text-emerald-400 font-black outline-none cursor-not-allowed" />
              </div>
            </div>

            {/* ROW 4: Diesel, Driver Bata, Advance */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Diesel Issued (L)</label>
                <input type="number" step="0.1" value={dieselL} onChange={e => setDieselL(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-[#FF5A00] font-bold outline-none focus:border-[#FF5A00]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Driver Bata (₹)</label>
                <input type="number" value={driverBata} onChange={e => setDriverBata(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-[#FF5A00] font-bold outline-none focus:border-[#FF5A00]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cash Adv Issued (₹)</label>
                <input type="number" value={advanceIssued} onChange={e => setAdvanceIssued(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-amber-400 font-bold outline-none focus:border-[#FF5A00]" />
              </div>
            </div>

            {/* ROW 5: POD Date, Unloaded MT, Halt Bata */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">POD Closing Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-white font-bold outline-none focus:border-[#FF5A00]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unloaded MT</label>
                <input type="number" step="0.01" value={unloadedMt} onChange={e => setUnloadedMt(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-white font-bold outline-none focus:border-[#FF5A00]" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Halt Bata (₹)</label>
                <input type="number" value={haltBata} onChange={e => setHaltBata(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-amber-400 font-bold outline-none focus:border-[#FF5A00]" />
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                type="button" 
                onClick={clearForm} 
                className="flex-1 py-3.5 bg-[#0F1117] text-slate-300 font-bold rounded-xl border border-[#272B36] hover:bg-[#272B36] transition-colors"
              >
                Cancel Edit
              </button>
              <button 
                type="submit" 
                disabled={isProcessing} 
                className="flex-[2] py-3.5 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20 active:scale-95"
              >
                Save Trip Updates
              </button>
            </div>
          </form>
        )}
      </div>

      {/* BOTTOM SECTION: TRIP AUDIT & SEARCH */}
      <div className="bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden flex flex-col shadow-xl max-w-5xl mx-auto h-fit mt-6">
        <div className="bg-[#12141C] px-6 py-4 flex justify-between items-center border-b border-[#272B36]">
          <h3 className="text-sm font-black text-white uppercase tracking-wide">Trip Audit & Search</h3>
        </div>
        
        {/* FILTERS */}
        <div className="p-6 border-b border-[#272B36] bg-[#1A1F2C]">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date Mode</label>
              <select value={auditDateMode} onChange={e => setAuditDateMode(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold">
                <option value="All Time">All Time</option>
                <option value="Specific Date">Specific Date</option>
                <option value="Date Range">Date Range</option>
              </select>
            </div>
            
            {auditDateMode === "Specific Date" && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
                <input type="date" value={auditSpecificDate} onChange={e => setAuditSpecificDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" />
              </div>
            )}
            
            {auditDateMode === "Date Range" && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">From</label>
                  <input type="date" value={auditFromDate} onChange={e => setAuditFromDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">To</label>
                  <input type="date" value={auditToDate} onChange={e => setAuditToDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" />
                </div>
              </>
            )}
            {auditDateMode === "All Time" && <div className="hidden md:block md:col-span-2"></div>}

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Truck No</label>
              <select value={auditTruck} onChange={e => setAuditTruck(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-bold">
                <option value="All Trucks">All Trucks</option>
                {vehicles.map(v => <option key={v.vehicle_number} value={v.vehicle_number}>{v.vehicle_number}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
              <select value={auditStatus} onChange={e => setAuditStatus(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold">
                <option value="All Statuses">All Statuses</option>
                <option value="DISPATCHED">DISPATCHED</option>
                <option value="IN_TRANSIT">IN_TRANSIT</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Search LR No</label>
              <input type="text" value={auditSearchLr} onChange={e => setAuditSearchLr(e.target.value.toUpperCase())} placeholder="e.g. 400..." className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white uppercase outline-none focus:border-[#FF5A00] font-semibold" />
            </div>
            <div className="flex items-end gap-3">
              <button onClick={handleSearchTrips} disabled={isProcessing} className="px-8 py-3 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20 active:scale-95 disabled:bg-slate-700">
                {isProcessing ? "Searching..." : "Search Trips"}
              </button>
              <button onClick={exportTripsToCSV} className="px-6 py-3 bg-[#0F1117] hover:bg-[#12141C] border border-[#272B36] text-emerald-400 font-bold text-sm rounded-xl transition-all shadow-sm flex items-center gap-2 active:scale-95">
                <span className="text-lg leading-none">📊</span> Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* RESULTS TABLE */}
        <div className="overflow-x-auto flex-1 max-h-[600px] overflow-y-auto w-full">
          <table className="min-w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-[#0F1117] text-slate-400 uppercase font-bold sticky top-0 z-10">
              <tr>
                <th className="px-5 py-3 border-b border-[#272B36]">Date</th>
                <th className="px-5 py-3 border-b border-[#272B36]">Trip LR</th>
                <th className="px-5 py-3 border-b border-[#272B36]">Truck & Driver</th>
                <th className="px-5 py-3 border-b border-[#272B36]">Route</th>
                <th className="px-5 py-3 text-center border-b border-[#272B36]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#272B36] bg-[#161922]">
              {tripsList.map(t => {
                const isEditing = editTripId === t.trip_id;
                return (
                  <tr 
                    key={t.trip_id} 
                    onClick={() => handleEditClick(t)}
                    className={`cursor-pointer transition-colors ${isEditing ? 'bg-[#FF5A00]/10 border-l-2 border-l-[#FF5A00]' : 'hover:bg-[#1E222D] border-l-2 border-transparent'}`}
                  >
                    <td className="px-5 py-3.5 font-semibold text-slate-300">{formatDate(t.trip_start_date)}</td>
                    <td className="px-5 py-3.5 font-black text-white">{t.trip_number}</td>
                    <td className="px-5 py-3.5 text-slate-300">
                      <span className="font-bold text-white">{t.vehicles?.vehicle_number}</span><br/>
                      <span className="text-[10px] text-slate-500">{t.drivers?.full_name}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">{t.origin} ➔ {t.destination}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                        t.trip_status === 'COMPLETED' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50' : 
                        t.trip_status === 'CANCELLED' ? 'bg-rose-950/40 text-rose-400 border border-rose-900/50' : 
                        'bg-amber-950/40 text-amber-400 border border-amber-900/50'
                      }`}>
                        {t.trip_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {tripsList.length === 0 && !isProcessing && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-medium">No trips found matching your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
