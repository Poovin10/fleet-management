"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal"; 

export function FuelAdvanceModule() {
  const supabase = createClient();
  const [faNav, setFaNav] = useState("⛽ Issue Diesel");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // SLEEK MODAL STATE
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    isDanger: false,
    action: async () => {}
  });

  const triggerModal = (title: string, message: string, isDanger: boolean, confirmText: string, action: () => Promise<void>) => {
    setModalConfig({ isOpen: true, title, message, isDanger, confirmText, action });
  };
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  // Master Data
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [dieselRate, setDieselRate] = useState<number>(95.0);

  // Data Tables
  const [recentFuelLogs, setRecentFuelLogs] = useState<any[]>([]);
  const [recentAdvances, setRecentAdvances] = useState<any[]>([]);

  // --- UNIFIED DIESEL FORM STATES ---
  const [editLogId, setEditLogId] = useState<string | null>(null);
  const [editTripId, setEditTripId] = useState<number | null>(null);
  
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0]);
  const [fVehicleId, setFVehicleId] = useState("");
  const [fCategory, setFCategory] = useState("TRIP_DIESEL");
  const [fLrNo, setFLrNo] = useState("");
  const [fFillingKm, setFFillingKm] = useState<number | "">("");
  const [fLitres, setFLitres] = useState<number | "">("");
  const [fDieselRate, setFDieselRate] = useState<number | "">(95.0);
  const [fIsTankFull, setFIsTankFull] = useState(false);

  // --- DRIVER ADVANCE STATES ---
  const [advDate, setAdvDate] = useState(new Date().toISOString().split('T')[0]);
  const [advDriverId, setAdvDriverId] = useState("");
  const [advAmount, setAdvAmount] = useState<number | "">("");
  const [advCategory, setAdvCategory] = useState("GENERAL_ADVANCE");
  const [advRef, setAdvRef] = useState("");

  // --- FUEL AUDIT STATES ---
  const [auditDateMode, setAuditDateMode] = useState("All Time");
  const [auditSpecificDate, setAuditSpecificDate] = useState(new Date().toISOString().split('T')[0]);
  const [auditFromDate, setAuditFromDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [auditToDate, setAuditToDate] = useState(new Date().toISOString().split('T')[0]);
  const [auditTruck, setAuditTruck] = useState("All Trucks");
  const [auditCategory, setAuditCategory] = useState("All Categories");
  const [auditSearchLr, setAuditSearchLr] = useState("");
  const [auditResults, setAuditResults] = useState<any[]>([]);

  // Helper to format dates from YYYY-MM-DD to DD/MM/YYYY
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    if (!dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const fetchData = async () => {
    setIsLoading(true);
    const [vehRes, drvRes, fuelRes, advRes, dieselRateRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('is_active', true).order('vehicle_number'),
      supabase.from('drivers').select('*').eq('is_active', true).order('full_name'),
      supabase.from('diesel_fuel_logs').select('*, vehicles(vehicle_number)').order('fuel_date', { ascending: false }).order('fuel_log_id', { ascending: false }).limit(50),
      supabase.from('driver_direct_advances').select('*, drivers(full_name, driver_code)').order('advance_date', { ascending: false }).limit(50),
      supabase.from('diesel_fuel_logs').select('diesel_rate_per_litre').order('fuel_date', { ascending: false }).order('fuel_log_id', { ascending: false }).limit(1)
    ]);

    if (vehRes.data) setVehicles(vehRes.data);
    if (drvRes.data) setDrivers(drvRes.data);
    if (fuelRes.data) setRecentFuelLogs(fuelRes.data);
    if (advRes.data) setRecentAdvances(advRes.data);

    if (dieselRateRes.data && dieselRateRes.data.length > 0 && dieselRateRes.data[0].diesel_rate_per_litre) {
      const latestRate = Number(dieselRateRes.data[0].diesel_rate_per_litre);
      setDieselRate(latestRate);
      if (!editLogId) setFDieselRate(latestRate);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
    if (faNav === "📊 Fuel Audit") handleRunAudit();
  }, [faNav]);

  const clearFuelForm = () => {
    setEditLogId(null);
    setEditTripId(null);
    setFDate(new Date().toISOString().split('T')[0]);
    setFVehicleId("");
    setFCategory("TRIP_DIESEL");
    setFLrNo("");
    setFFillingKm("");
    setFLitres("");
    setFDieselRate(dieselRate);
    setFIsTankFull(false);
  };

  const handleEditClick = (log: any) => {
    setFaNav("⛽ Issue Diesel");
    setEditLogId(log.fuel_log_id);
    setEditTripId(log.trip_id || null);
    setFDate(log.fuel_date || "");
    setFVehicleId(String(log.vehicle_id) || "");
    setFCategory(log.diesel_category || "TRIP_DIESEL");
    setFLrNo(log.lr_number === "SUNDRY" ? "" : (log.lr_number || ""));
    setFFillingKm(log.filling_odometer_km || "");
    setFLitres(log.litres_filled || "");
    setFDieselRate(log.diesel_rate_per_litre || dieselRate);
    setFIsTankFull(log.is_tank_full || false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveDiesel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fVehicleId || Number(fLitres) <= 0 || Number(fDieselRate) <= 0) return;

    const isUpdate = editLogId !== null;
    const cost = Math.round((Number(fLitres) * Number(fDieselRate)) * 100) / 100;
    
    const payload = {
      fuel_date: fDate, 
      vehicle_id: Number(fVehicleId), 
      lr_number: fLrNo.toUpperCase().trim() || "SUNDRY",
      diesel_category: fCategory, 
      litres_filled: Number(fLitres), 
      diesel_rate_per_litre: Number(fDieselRate),
      total_fuel_cost: cost, 
      filling_odometer_km: Number(fFillingKm) || 0, 
      is_tank_full: fIsTankFull
    };

    triggerModal(
      isUpdate ? "Update Diesel Record" : "Record Diesel Entry", 
      isUpdate ? "Are you sure you want to edit this fuel log? If linked to a trip, expenses will be automatically recalculated." : `Are you sure you want to issue ${fLitres}L of diesel? This will automatically update your expenses.`, 
      false, 
      isUpdate ? "Update Record" : "Record Diesel", 
      async () => {
        setIsProcessing(true);

        if (isUpdate) {
          await supabase.from('diesel_fuel_logs').update(payload).eq('fuel_log_id', editLogId);
          if (editTripId) {
            const { data: trip } = await supabase.from('trips').select('start_km').eq('trip_id', editTripId).single();
            let updatePayload: any = { fuel_litres: Number(fLitres), fuel_expense: cost };
            if (trip && (trip.start_km === 0 || trip.start_km === null)) updatePayload.start_km = Number(fFillingKm);
            await supabase.from('trips').update(updatePayload).eq('trip_id', editTripId);
          }
        } else {
          await supabase.from('diesel_fuel_logs').insert([payload]);
        }

        clearFuelForm();
        fetchData();
        setIsProcessing(false);
        closeModal();
      }
    );
  };

  const handleDeleteFuel = (id: string) => {
    triggerModal("Delete Fuel Record", "Warning: Are you sure you want to permanently delete this fuel log? This action cannot be reversed.", true, "Delete Log", async () => {
      setIsProcessing(true);
      await supabase.from('diesel_fuel_logs').delete().eq('fuel_log_id', id);
      clearFuelForm();
      fetchData();
      if (faNav === "📊 Fuel Audit") handleRunAudit();
      setIsProcessing(false);
      closeModal();
    });
  };

  const handleIssueAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advDriverId || Number(advAmount) <= 0) return;

    triggerModal("Issue Driver Advance", `You are about to issue ₹${advAmount} as a direct advance. This will deduct from the driver's next settlement.`, false, "Issue Advance", async () => {
      setIsProcessing(true);
      await supabase.from('driver_direct_advances').insert([{
        advance_date: advDate, driver_id: Number(advDriverId), amount_inr: Number(advAmount),
        advance_type: advCategory, reference_remarks: advRef
      }]);
      setAdvAmount(""); setAdvRef("");
      fetchData();
      setIsProcessing(false);
      closeModal();
    });
  };

  const handleDeleteAdvance = (id: string) => {
    triggerModal("Delete Advance Record", "Warning: Are you sure you want to permanently delete this driver advance? This action cannot be reversed.", true, "Delete Advance", async () => {
      setIsProcessing(true);
      await supabase.from('driver_direct_advances').delete().eq('advance_id', id);
      fetchData();
      setIsProcessing(false);
      closeModal();
    });
  };

  const handleRunAudit = async () => {
    setIsProcessing(true);
    let query = supabase.from('diesel_fuel_logs').select('*, vehicles!inner(vehicle_number)').order('fuel_date', { ascending: false }).order('fuel_log_id', { ascending: false });

    if (auditDateMode === "Specific Date") query = query.eq('fuel_date', auditSpecificDate);
    else if (auditDateMode === "Date Range") query = query.gte('fuel_date', auditFromDate).lte('fuel_date', auditToDate);

    if (auditTruck !== "All Trucks") query = query.eq('vehicles.vehicle_number', auditTruck);
    if (auditCategory !== "All Categories") query = query.eq('diesel_category', auditCategory);
    if (auditSearchLr) query = query.ilike('lr_number', `%${auditSearchLr}%`);

    const { data } = await query;
    if (data) setAuditResults(data);
    else setAuditResults([]);
    setIsProcessing(false);
  };

  const exportAuditToCSV = () => {
    if (auditResults.length === 0) return alert("No audit data to export.");
    const headers = ["Log ID", "Date", "Truck No", "Category", "LR Number", "Odometer KM", "Litres Filled", "Total Cost (INR)", "Tank Full"];
    
    const rows = auditResults.map(l => [
      l.fuel_log_id,
      l.fuel_date,
      l.vehicles?.vehicle_number || "Unknown",
      l.diesel_category,
      l.lr_number || "-",
      l.filling_odometer_km || 0,
      l.litres_filled || 0,
      l.total_fuel_cost || 0,
      l.is_tank_full ? "Yes" : "No"
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Fuel_Audit_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      
      <div className="flex flex-wrap gap-2 border-b border-[#272B36] pb-4">
        {["⛽ Issue Diesel", "💵 Driver Advances", "📊 Fuel Audit"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFaNav(tab)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              faNav === tab 
                ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/20 ring-1 ring-[#FF5A00]" 
                : "bg-[#161922] text-slate-400 hover:text-white hover:bg-[#1E222D] border border-[#272B36]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {faNav === "⛽ Issue Diesel" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
          
          <div className="lg:col-span-5 bg-[#161922] border border-[#272B36] rounded-2xl p-6 shadow-xl h-fit">
            <div className="flex justify-between items-center border-b border-[#272B36] pb-3 mb-5">
              <h3 className="text-sm font-black text-white uppercase tracking-wide">
                {editLogId ? "Edit Diesel Log" : "Record Fuel Bill"}
              </h3>
              {editLogId && <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded-lg uppercase tracking-widest animate-pulse">Editing Mode</span>}
            </div>

            <form onSubmit={handleSaveDiesel} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fuel Date *</label>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Select Truck *</label>
                <select value={fVehicleId} onChange={e => setFVehicleId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-bold" required disabled={isLoading}>
                  <option value="">-- SELECT TRUCK --</option>
                  {vehicles.map(v => <option key={v.vehicle_id} value={String(v.vehicle_id)}>{v.vehicle_number}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category *</label>
                <select value={fCategory} onChange={e => setFCategory(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold">
                  <option value="TRIP_DIESEL">TRIP_DIESEL</option>
                  <option value="SUNDRY_DIESEL">SUNDRY_DIESEL</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Trip LR No (Optional)</label>
                <input type="text" value={fLrNo} onChange={e => setFLrNo(e.target.value.toUpperCase())} placeholder="e.g. 40080069852" className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white uppercase outline-none focus:border-[#FF5A00] font-semibold" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filling KM</label>
                  <input type="number" min="0" value={fFillingKm} onChange={e => setFFillingKm(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.0" className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Litres *</label>
                  <input type="number" step="0.1" min="0.1" value={fLitres} onChange={e => setFLitres(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.0" className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] outline-none focus:border-[#FF5A00] font-black text-[#FF5A00]" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Rate (₹/L) *</label>
                  <input type="number" step="0.1" min="0.1" value={fDieselRate} onChange={e => setFDieselRate(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.00" className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-bold" required />
                </div>
              </div>
              
              <div className="flex justify-between items-center bg-[#0F1117] p-4 rounded-xl border border-[#272B36] mt-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input type="checkbox" checked={fIsTankFull} onChange={e => setFIsTankFull(e.target.checked)} className="w-4 h-4 rounded text-[#FF5A00] bg-[#1A1F2C] border-[#272B36] focus:ring-[#FF5A00]" />
                  <span className="text-xs font-black text-white uppercase">⛽ Tank Full</span>
                </label>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase mr-3">Cost:</span>
                  <span className="text-lg font-black text-rose-500">₹{((Number(fLitres) || 0) * (Number(fDieselRate) || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#272B36]">
                {editLogId && (
                  <>
                     <button type="button" onClick={() => handleDeleteFuel(editLogId)} className="px-4 py-3 bg-rose-950/40 text-rose-500 hover:bg-rose-900 border border-rose-900/50 rounded-xl font-bold transition-colors">🗑️</button>
                     <button type="button" onClick={clearFuelForm} className="flex-1 py-3 bg-[#0F1117] text-slate-300 font-bold rounded-xl border border-[#272B36] hover:bg-[#272B36] transition-colors">Cancel</button>
                  </>
                )}
                <button type="submit" disabled={!fVehicleId || Number(fLitres) <= 0 || isProcessing} className="flex-[2] py-3 bg-[#FF5A00] hover:bg-[#e04f00] disabled:bg-slate-700 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20 active:scale-95">
                  {editLogId ? "Update Record" : "Record Diesel"}
                </button>
              </div>
            </form>
          </div>
          
          <div className="lg:col-span-7 bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden flex flex-col shadow-xl h-fit">
            <div className="bg-[#12141C] px-6 py-4 flex justify-between items-center border-b border-[#272B36]">
              <h3 className="text-sm font-black text-white uppercase tracking-wide">Recent Fuel Entries (Click to Edit)</h3>
            </div>
            
            <div className="overflow-x-auto flex-1 max-h-[600px] overflow-y-auto w-full">
              <table className="min-w-full divide-y divide-[#272B36] whitespace-nowrap">
                <thead className="bg-[#0F1117] sticky top-0 z-10">
                  <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-3 text-left border-b border-[#272B36]">Date</th>
                    <th className="px-5 py-3 text-left border-b border-[#272B36]">Truck</th>
                    <th className="px-5 py-3 text-left border-b border-[#272B36]">Category / LR</th>
                    <th className="px-5 py-3 text-right border-b border-[#272B36]">Litres</th>
                    <th className="px-5 py-3 text-right border-b border-[#272B36]">Cost (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#272B36] text-xs bg-[#161922]">
                  {recentFuelLogs.map((log) => (
                    <tr 
                      key={log.fuel_log_id} 
                      onClick={() => handleEditClick(log)} 
                      className={`cursor-pointer transition-colors ${editLogId === log.fuel_log_id ? 'bg-[#FF5A00]/10 border-l-2 border-l-[#FF5A00]' : 'hover:bg-[#1E222D] border-l-2 border-transparent'}`}
                    >
                      <td className="px-5 py-3.5 font-semibold text-slate-300">{formatDate(log.fuel_date)}</td>
                      <td className="px-5 py-3.5 font-black text-white">{log.vehicles?.vehicle_number}</td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {log.diesel_category}<br/>
                        <span className="text-[9px] text-slate-500">{log.lr_number}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-[#FF5A00]">
                        {log.litres_filled} L {log.is_tank_full && <span title="Tank Full" className="ml-1 text-sm">⛽</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-rose-500">₹{(log.total_fuel_cost || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    </tr>
                  ))}
                  {recentFuelLogs.length === 0 && <tr><td colSpan={5} className="p-8 text-center font-medium text-slate-500">No recent logs found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {faNav === "💵 Driver Advances" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-4 bg-[#161922] border border-[#272B36] rounded-2xl p-6 shadow-xl h-fit">
            <h3 className="text-sm font-black text-white uppercase tracking-wide border-b border-[#272B36] pb-3 mb-5">Direct Cash Advance</h3>
            <form onSubmit={handleIssueAdvance} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Advance Date *</label>
                <input type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Driver Account *</label>
                <select value={advDriverId} onChange={e => setAdvDriverId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-bold" required disabled={isLoading}>
                  <option value="">-- SELECT DRIVER --</option>
                  {drivers.map(d => <option key={d.driver_id} value={String(d.driver_id)}>{d.driver_code} - {d.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Advance Amount (₹) *</label>
                <input type="number" min="1" value={advAmount} onChange={e => setAdvAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.00" className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] outline-none focus:border-[#FF5A00] font-black text-emerald-400" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</label>
                <select value={advCategory} onChange={e => setAdvCategory(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold">
                  <option value="GENERAL_ADVANCE">GENERAL_ADVANCE</option>
                  <option value="BATA_ADVANCE">BATA_ADVANCE</option>
                  <option value="EMERGENCY_MEDICAL">EMERGENCY_MEDICAL</option>
                  <option value="SALARY_ADVANCE">SALARY_ADVANCE</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference Note</label>
                <input type="text" value={advRef} onChange={e => setAdvRef(e.target.value)} placeholder="e.g. For enroute expenses" className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" />
              </div>
              <div className="pt-4 border-t border-[#272B36]">
                <button type="submit" disabled={!advDriverId || Number(advAmount) <= 0 || isProcessing} className="w-full py-3.5 bg-[#FF5A00] hover:bg-[#e04f00] disabled:bg-slate-700 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20 active:scale-95">
                  Issue Advance
                </button>
              </div>
            </form>
          </div>
          
          <div className="lg:col-span-8 bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden flex flex-col shadow-xl h-fit">
            <div className="bg-[#12141C] px-6 py-4 flex justify-between items-center border-b border-[#272B36]">
              <h3 className="text-sm font-black text-white uppercase tracking-wide">Advance History</h3>
            </div>
            <div className="overflow-x-auto flex-1 max-h-[600px] overflow-y-auto w-full">
              <table className="min-w-full divide-y divide-[#272B36] whitespace-nowrap">
                <thead className="bg-[#0F1117] sticky top-0 z-10">
                  <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-3 text-left border-b border-[#272B36]">Date</th>
                    <th className="px-5 py-3 text-left border-b border-[#272B36]">Driver</th>
                    <th className="px-5 py-3 text-left border-b border-[#272B36]">Category & Ref</th>
                    <th className="px-5 py-3 text-right border-b border-[#272B36]">Amount (₹)</th>
                    <th className="px-5 py-3 text-center border-b border-[#272B36]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#272B36] text-xs bg-[#161922]">
                  {recentAdvances.map((adv) => (
                    <tr key={adv.advance_id} className="hover:bg-[#1E222D] transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-300">{formatDate(adv.advance_date)}</td>
                      <td className="px-5 py-3.5 font-black text-white">{adv.drivers?.full_name} <br/><span className="text-[9px] font-bold text-[#FF5A00]">{adv.drivers?.driver_code}</span></td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {adv.advance_type}<br/>
                        <span className="text-[9px] text-slate-500">{adv.reference_remarks || "-"}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-emerald-400">₹{(adv.amount_inr || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                      <td className="px-5 py-3.5 text-center">
                        <button onClick={() => handleDeleteAdvance(adv.advance_id)} className="text-rose-500 hover:text-white hover:bg-rose-600 bg-rose-950/40 border border-rose-900/50 p-2 rounded-lg transition-all" title="Delete Advance">🗑️</button>
                      </td>
                    </tr>
                  ))}
                  {recentAdvances.length === 0 && <tr><td colSpan={5} className="p-8 text-center font-medium text-slate-500">No advances recorded.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {faNav === "📊 Fuel Audit" && (
        <div className="bg-[#161922] border border-[#272B36] rounded-2xl p-6 shadow-xl animate-in slide-in-from-bottom-4">
          <h3 className="text-sm font-black text-white uppercase tracking-wide border-b border-[#272B36] pb-3 mb-5">Fuel Audit & Search</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
                {vehicles.map(v => <option key={v.vehicle_id} value={v.vehicle_number}>{v.vehicle_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</label>
              <select value={auditCategory} onChange={e => setAuditCategory(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold">
                <option value="All Categories">All Categories</option>
                <option value="TRIP_DIESEL">TRIP_DIESEL</option>
                <option value="SUNDRY_DIESEL">SUNDRY_DIESEL</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Search LR No</label>
              <input type="text" value={auditSearchLr} onChange={e => setAuditSearchLr(e.target.value.toUpperCase())} placeholder="e.g. 400..." className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white uppercase outline-none focus:border-[#FF5A00] font-semibold" />
            </div>
            <div className="flex items-end gap-3">
              <button onClick={handleRunAudit} className="px-8 py-3 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20 active:scale-95">
                Search Logs
              </button>
              <button onClick={exportAuditToCSV} className="px-6 py-3 bg-[#0F1117] hover:bg-[#1A1F2C] border border-[#272B36] text-emerald-400 font-bold text-sm rounded-xl transition-all shadow-sm flex items-center gap-2 active:scale-95">
                <span className="text-lg leading-none">📊</span> Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#272B36] w-full">
            <table className="min-w-full divide-y divide-[#272B36] text-xs whitespace-nowrap">
              <thead className="bg-[#0F1117]">
                <tr className="text-left font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-4">Log ID</th>
                  <th className="px-5 py-4">Date</th>
                  <th className="px-5 py-4">Truck</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">LR No</th>
                  <th className="px-5 py-4 text-right">Odometer</th>
                  <th className="px-5 py-4 text-right">Litres</th>
                  <th className="px-5 py-4 text-right">Cost (₹)</th>
                  <th className="px-5 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="bg-[#161922] divide-y divide-[#272B36]">
                {auditResults.map(l => (
                  <tr key={l.fuel_log_id} onClick={() => handleEditClick(l)} className="hover:bg-[#1E222D] cursor-pointer transition-colors">
                    <td className="px-5 py-3 font-bold text-slate-500">#{l.fuel_log_id}</td>
                    <td className="px-5 py-3 font-semibold text-slate-300">{formatDate(l.fuel_date)}</td>
                    <td className="px-5 py-3 font-black text-white">{l.vehicles?.vehicle_number}</td>
                    <td className="px-5 py-3 text-slate-300">{l.diesel_category}</td>
                    <td className="px-5 py-3 font-bold text-[#FF5A00]">{l.lr_number}</td>
                    <td className="px-5 py-3 text-right text-slate-300">{l.filling_odometer_km}</td>
                    <td className="px-5 py-3 text-right font-black text-[#FF5A00]">
                      {l.litres_filled} L {l.is_tank_full && <span title="Tank Full" className="ml-1 text-sm">⛽</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-rose-500">₹{(l.total_fuel_cost || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteFuel(l.fuel_log_id); }} className="text-rose-500 hover:text-white hover:bg-rose-600 bg-rose-950/40 border border-rose-900/50 p-2 rounded-lg transition-all" title="Delete Log">🗑️</button>
                    </td>
                  </tr>
                ))}
                {auditResults.length === 0 && <tr><td colSpan={9} className="px-5 py-8 text-center text-slate-500 font-medium">No logs match your search criteria.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
