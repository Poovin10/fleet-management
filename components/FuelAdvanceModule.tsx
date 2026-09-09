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

  // --- 1. ISSUE DIESEL STATES ---
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0]);
  const [fVehicleId, setFVehicleId] = useState("");
  const [fCategory, setFCategory] = useState("TRIP_DIESEL");
  const [fLrNo, setFLrNo] = useState("");
  const [fFillingKm, setFFillingKm] = useState<number | "">("");
  const [fLitres, setFLitres] = useState<number | "">("");
  const [fDieselRate, setFDieselRate] = useState<number | "">(95.0);
  const [fIsTankFull, setFIsTankFull] = useState(false);

  // --- 2. EDIT DIESEL LOG STATES ---
  const [allFuelLogs, setAllFuelLogs] = useState<any[]>([]);
  const [selectedEditLogId, setSelectedEditLogId] = useState("");
  const [editLog, setEditLog] = useState<any>(null);
  
  const [eFuelDate, setEFuelDate] = useState("");
  const [eVehicleId, setEVehicleId] = useState("");
  const [eCategory, setECategory] = useState("");
  const [eLrNo, setELrNo] = useState("");
  const [eFillingKm, setEFillingKm] = useState<number | "">("");
  const [eLitres, setELitres] = useState<number | "">("");
  const [eRate, setERate] = useState<number | "">("");
  const [eIsTankFull, setEIsTankFull] = useState(false);

  // --- 3. DRIVER ADVANCE STATES ---
  const [advDate, setAdvDate] = useState(new Date().toISOString().split('T')[0]);
  const [advDriverId, setAdvDriverId] = useState("");
  const [advAmount, setAdvAmount] = useState<number | "">("");
  const [advCategory, setAdvCategory] = useState("GENERAL_ADVANCE");
  const [advRef, setAdvRef] = useState("");

  // --- 4. FUEL AUDIT STATES ---
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
      supabase.from('diesel_fuel_logs').select('*, vehicles(vehicle_number)').order('fuel_date', { ascending: false }).limit(50),
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
      setFDieselRate(latestRate);
    }

    if (faNav === "📝 Edit Diesel Log") {
      const { data: allLogs } = await supabase.from('diesel_fuel_logs').select('*, vehicles(vehicle_number)').order('fuel_log_id', { ascending: false }).limit(200);
      if (allLogs) setAllFuelLogs(allLogs);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
    if (faNav === "📊 Fuel Audit") handleRunAudit();
  }, [faNav]);

  const handleIssueDiesel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fVehicleId || Number(fLitres) <= 0 || Number(fDieselRate) <= 0) return;

    triggerModal("Record Diesel Entry", `Are you sure you want to issue ${fLitres}L of diesel? This will automatically update your expenses.`, false, "Record Diesel", async () => {
      setIsProcessing(true);
      const totalCost = Math.round((Number(fLitres) * Number(fDieselRate)) * 100) / 100;

      await supabase.from('diesel_fuel_logs').insert([{
        fuel_date: fDate, vehicle_id: Number(fVehicleId), lr_number: fLrNo.toUpperCase().trim() || "SUNDRY",
        diesel_category: fCategory, litres_filled: Number(fLitres), diesel_rate_per_litre: Number(fDieselRate),
        total_fuel_cost: totalCost, filling_odometer_km: Number(fFillingKm) || 0, is_tank_full: fIsTankFull
      }]);

      setFLitres(""); setFLrNo(""); setFFillingKm(""); setFIsTankFull(false);
      fetchData();
      setIsProcessing(false);
      closeModal();
    });
  };

  useEffect(() => {
    if (selectedEditLogId) {
      const log = allFuelLogs.find(l => String(l.fuel_log_id) === selectedEditLogId);
      if (log) {
        setEditLog(log);
        setEFuelDate(log.fuel_date || ""); setEVehicleId(String(log.vehicle_id) || "");
        setECategory(log.diesel_category || "TRIP_DIESEL"); setELrNo(log.lr_number === "SUNDRY" ? "" : (log.lr_number || ""));
        setEFillingKm(log.filling_odometer_km || 0); setELitres(log.litres_filled || 0);
        setERate(log.diesel_rate_per_litre || dieselRate); setEIsTankFull(log.is_tank_full || false);
      }
    } else setEditLog(null);
  }, [selectedEditLogId, allFuelLogs]);

  const handleUpdateFuelLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLog || Number(eLitres) <= 0) return;
    
    triggerModal("Commit Diesel Updates", "Are you sure you want to edit this fuel log? If it is attached to a trip, the trip expenses will be automatically recalculated.", false, "Commit Updates", async () => {
      setIsProcessing(true);
      const cost = Math.round((Number(eLitres) * Number(eRate)) * 100) / 100;

      await supabase.from('diesel_fuel_logs').update({
        fuel_date: eFuelDate, vehicle_id: Number(eVehicleId), diesel_category: eCategory,
        lr_number: eLrNo.toUpperCase().trim() || "SUNDRY", filling_odometer_km: Number(eFillingKm),
        litres_filled: Number(eLitres), diesel_rate_per_litre: Number(eRate), total_fuel_cost: cost, is_tank_full: eIsTankFull
      }).eq('fuel_log_id', editLog.fuel_log_id);

      if (editLog.trip_id) {
        const { data: trip } = await supabase.from('trips').select('start_km').eq('trip_id', editLog.trip_id).single();
        let updatePayload: any = { fuel_litres: Number(eLitres), fuel_expense: cost };
        if (trip && (trip.start_km === 0 || trip.start_km === null)) updatePayload.start_km = Number(eFillingKm);
        await supabase.from('trips').update(updatePayload).eq('trip_id', editLog.trip_id);
      }

      setSelectedEditLogId("");
      fetchData();
      setIsProcessing(false);
      closeModal();
    });
  };

  const handleDeleteFuel = (id: string) => {
    triggerModal("Delete Fuel Record", "Warning: Are you sure you want to permanently delete this fuel log? This action cannot be reversed.", true, "Delete Log", async () => {
      setIsProcessing(true);
      await supabase.from('diesel_fuel_logs').delete().eq('fuel_log_id', id);
      if (faNav === "📝 Edit Diesel Log") setSelectedEditLogId("");
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

  // 🚀 CSV EXPORT FUNCTION
  const exportAuditToCSV = () => {
    if (auditResults.length === 0) return alert("No audit data to export.");
    const headers = ["Log ID", "Date", "Truck No", "Category", "LR Number", "Odometer KM", "Litres Filled", "Total Cost (INR)"];
    
    const rows = auditResults.map(l => [
      l.fuel_log_id,
      l.fuel_date,
      l.vehicles?.vehicle_number || "Unknown",
      l.diesel_category,
      l.lr_number || "-",
      l.filling_odometer_km || 0,
      l.litres_filled || 0,
      l.total_fuel_cost || 0
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
    <div className="space-y-6 animate-in fade-in duration-300" style={{ colorScheme: 'light' }}>
      
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
      
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {["⛽ Issue Diesel", "📝 Edit Diesel Log", "💵 Driver Advances", "📊 Fuel Audit"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFaNav(tab)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              faNav === tab 
                ? "bg-[#FF5A00] text-white shadow-sm ring-1 ring-[#FF5A00]" 
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {faNav === "⛽ Issue Diesel" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3 mb-5">Record Fuel Bill</h3>
            <form onSubmit={handleIssueDiesel} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fuel Date *</label>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Truck *</label>
                <select value={fVehicleId} onChange={e => setFVehicleId(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold" required disabled={isLoading}>
                  <option value="">-- SELECT TRUCK --</option>
                  {vehicles.map(v => <option key={v.vehicle_id} value={String(v.vehicle_id)}>{v.vehicle_number}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category *</label>
                <select value={fCategory} onChange={e => setFCategory(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]">
                  <option value="TRIP_DIESEL">TRIP_DIESEL</option>
                  <option value="SUNDRY_DIESEL">SUNDRY_DIESEL</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trip LR No (Optional)</label>
                <input type="text" value={fLrNo} onChange={e => setFLrNo(e.target.value.toUpperCase())} placeholder="e.g. 40080069852" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 uppercase outline-none focus:ring-2 focus:ring-[#FF5A00]" />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Filling KM</label>
                  <input type="number" min="0" value={fFillingKm} onChange={e => setFFillingKm(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.0" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Litres *</label>
                  <input type="number" step="0.1" min="0.1" value={fLitres} onChange={e => setFLitres(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.0" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold text-orange-600" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rate (₹/L) *</label>
                  <input type="number" step="0.1" min="0.1" value={fDieselRate} onChange={e => setFDieselRate(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.00" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold" required />
                </div>
              </div>
              
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={fIsTankFull} onChange={e => setFIsTankFull(e.target.checked)} className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500" />
                  <span className="text-xs font-bold text-slate-700">⛽ Tank Full</span>
                </label>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase mr-3">Total Cost:</span>
                  <span className="text-lg font-black text-rose-600">₹{((Number(fLitres) || 0) * (Number(fDieselRate) || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button type="submit" disabled={!fVehicleId || Number(fLitres) <= 0} className="w-full py-3 bg-[#FF5A00] hover:bg-[#e04f00] disabled:bg-slate-300 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95">
                  Record Diesel Entry
                </button>
              </div>
            </form>
          </div>
          
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3 mb-5">Recent Fuel Entries</h3>
            <div className="overflow-x-auto flex-1 max-h-[500px] overflow-y-auto w-full">
              <table className="min-w-full divide-y divide-slate-200 whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-[10px] font-bold text-slate-500 uppercase">
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Truck</th>
                    <th className="px-4 py-2 text-left">Category / LR</th>
                    <th className="px-4 py-2 text-right">Litres</th>
                    <th className="px-4 py-2 text-right">Cost (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {recentFuelLogs.map((log) => (
                    <tr key={log.fuel_log_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">{formatDate(log.fuel_date)}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{log.vehicles?.vehicle_number}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {log.diesel_category}<br/>
                        <span className="text-[9px] text-slate-400">{log.lr_number}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#FF5A00]">{log.litres_filled} L</td>
                      <td className="px-4 py-3 text-right text-rose-600">₹{(log.total_fuel_cost || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    </tr>
                  ))}
                  {recentFuelLogs.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">No recent logs found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {faNav === "📝 Edit Diesel Log" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-4xl mx-auto animate-in slide-in-from-bottom-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3 mb-5">Edit Diesel Log</h3>
          
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Select Record to Edit</label>
            <select 
              value={selectedEditLogId} 
              onChange={(e) => setSelectedEditLogId(e.target.value)}
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-slate-50 font-bold outline-none focus:ring-2 focus:ring-[#FF5A00]"
            >
              <option value="">-- SELECT LOG --</option>
              {allFuelLogs.map(l => (
                <option key={l.fuel_log_id} value={l.fuel_log_id}>
                  Log #{l.fuel_log_id} | {formatDate(l.fuel_date)} | {l.vehicles?.vehicle_number} | {l.litres_filled} L
                </option>
              ))}
            </select>
          </div>

          {editLog && (
            <form onSubmit={handleUpdateFuelLog} className="space-y-5 animate-in slide-in-from-bottom-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fuel Date *</label>
                  <input type="date" value={eFuelDate} onChange={e => setEFuelDate(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]" required />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vehicle *</label>
                  <select value={eVehicleId} onChange={e => setEVehicleId(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold" required>
                    {vehicles.map(v => <option key={v.vehicle_id} value={String(v.vehicle_id)}>{v.vehicle_number}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category *</label>
                  <select value={eCategory} onChange={e => setECategory(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]">
                    <option value="TRIP_DIESEL">TRIP_DIESEL</option>
                    <option value="SUNDRY_DIESEL">SUNDRY_DIESEL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trip LR No</label>
                  <input type="text" value={eLrNo} onChange={e => setELrNo(e.target.value.toUpperCase())} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 uppercase outline-none focus:ring-2 focus:ring-[#FF5A00]" />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Filling KM *</label>
                  <input type="number" min="0" value={eFillingKm} onChange={e => setEFillingKm(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]" required />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Litres *</label>
                  <input type="number" step="0.1" min="0.1" value={eLitres} onChange={e => setELitres(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold" required />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rate (₹/L) *</label>
                  <input type="number" step="0.1" min="0.1" value={eRate} onChange={e => setERate(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]" required />
                </div>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={eIsTankFull} onChange={e => setEIsTankFull(e.target.checked)} className="w-4 h-4 rounded text-[#FF5A00] focus:ring-[#FF5A00]" />
                  <span className="text-xs font-bold text-slate-700">⛽ Mark Tank Full</span>
                </label>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase mr-3">Recalculated Cost:</span>
                  <span className="text-lg font-black text-rose-600">₹{((Number(eLitres) * Number(eRate)) || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-between">
                <button type="button" onClick={() => handleDeleteFuel(editLog.fuel_log_id)} className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-lg transition-colors border border-rose-200">
                  🗑️ Delete Log
                </button>
                <button type="submit" className="px-8 py-2.5 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95">
                  💾 Commit Updates
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {faNav === "💵 Driver Advances" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3 mb-5">Direct Cash Advance</h3>
            <form onSubmit={handleIssueAdvance} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Advance Date *</label>
                <input type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Driver Account *</label>
                <select value={advDriverId} onChange={e => setAdvDriverId(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold" required disabled={isLoading}>
                  <option value="">-- SELECT DRIVER --</option>
                  {drivers.map(d => <option key={d.driver_id} value={String(d.driver_id)}>{d.driver_code} - {d.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Advance Amount (₹) *</label>
                <input type="number" min="1" value={advAmount} onChange={e => setAdvAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.00" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold text-emerald-700" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
                <select value={advCategory} onChange={e => setAdvCategory(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]">
                  <option value="GENERAL_ADVANCE">GENERAL_ADVANCE</option>
                  <option value="BATA_ADVANCE">BATA_ADVANCE</option>
                  <option value="EMERGENCY_MEDICAL">EMERGENCY_MEDICAL</option>
                  <option value="SALARY_ADVANCE">SALARY_ADVANCE</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Reference Note</label>
                <input type="text" value={advRef} onChange={e => setAdvRef(e.target.value)} placeholder="e.g. For enroute expenses" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]" />
              </div>
              <div className="pt-4 border-t border-slate-100">
                <button type="submit" disabled={!advDriverId || Number(advAmount) <= 0} className="w-full py-3 bg-[#FF5A00] hover:bg-[#e04f00] disabled:bg-slate-300 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95">
                  Issue Advance
                </button>
              </div>
            </form>
          </div>
          
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3 mb-5">Advance History</h3>
            <div className="overflow-x-auto flex-1 max-h-[500px] overflow-y-auto w-full">
              <table className="min-w-full divide-y divide-slate-200 whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-[10px] font-bold text-slate-500 uppercase">
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Driver</th>
                    <th className="px-4 py-2 text-left">Category & Ref</th>
                    <th className="px-4 py-2 text-right">Amount (₹)</th>
                    <th className="px-4 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {recentAdvances.map((adv) => (
                    <tr key={adv.advance_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">{formatDate(adv.advance_date)}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{adv.drivers?.full_name} <br/><span className="text-[9px] font-normal text-slate-400">{adv.drivers?.driver_code}</span></td>
                      <td className="px-4 py-3 text-slate-600">
                        {adv.advance_type}<br/>
                        <span className="text-[9px] text-slate-400">{adv.reference_remarks || "-"}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-emerald-600">₹{(adv.amount_inr || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleDeleteAdvance(adv.advance_id)} className="text-rose-500 hover:text-rose-700 bg-rose-50 p-1.5 rounded">🗑️</button>
                      </td>
                    </tr>
                  ))}
                  {recentAdvances.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">No advances recorded.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {faNav === "📊 Fuel Audit" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-in slide-in-from-bottom-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3 mb-5">Fuel Audit & Search</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date Mode</label>
              <select value={auditDateMode} onChange={e => setAuditDateMode(e.target.value)} className="w-full text-sm p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]">
                <option value="All Time">All Time</option>
                <option value="Specific Date">Specific Date</option>
                <option value="Date Range">Date Range</option>
              </select>
            </div>
            
            {auditDateMode === "Specific Date" && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date</label>
                <input type="date" value={auditSpecificDate} onChange={e => setAuditSpecificDate(e.target.value)} className="w-full text-sm p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]" />
              </div>
            )}
            
            {auditDateMode === "Date Range" && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">From</label>
                  <input type="date" value={auditFromDate} onChange={e => setAuditFromDate(e.target.value)} className="w-full text-sm p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">To</label>
                  <input type="date" value={auditToDate} onChange={e => setAuditToDate(e.target.value)} className="w-full text-sm p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]" />
                </div>
              </>
            )}
            {auditDateMode === "All Time" && <div className="hidden md:block md:col-span-2"></div>}

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Truck No</label>
              <select value={auditTruck} onChange={e => setAuditTruck(e.target.value)} className="w-full text-sm p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold">
                <option value="All Trucks">All Trucks</option>
                {vehicles.map(v => <option key={v.vehicle_id} value={v.vehicle_number}>{v.vehicle_number}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
              <select value={auditCategory} onChange={e => setAuditCategory(e.target.value)} className="w-full text-sm p-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00]">
                <option value="All Categories">All Categories</option>
                <option value="TRIP_DIESEL">TRIP_DIESEL</option>
                <option value="SUNDRY_DIESEL">SUNDRY_DIESEL</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Search LR No</label>
              <input type="text" value={auditSearchLr} onChange={e => setAuditSearchLr(e.target.value.toUpperCase())} placeholder="e.g. 400..." className="w-full text-sm p-2 rounded-lg border border-slate-300 uppercase outline-none focus:ring-2 focus:ring-[#FF5A00]" />
            </div>
            <div className="flex items-end gap-3">
              <button onClick={handleRunAudit} className="px-8 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-lg transition-all shadow-sm">
                Search Logs
              </button>
              {/* V2 EXPORT BUTTON */}
              <button onClick={exportAuditToCSV} className="px-5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold text-sm rounded-lg transition-all shadow-sm flex items-center gap-2">
                <span className="text-lg leading-none">📊</span> Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 w-full">
            <table className="min-w-full divide-y divide-slate-200 text-xs whitespace-nowrap">
              <thead className="bg-slate-50">
                <tr className="text-left font-bold text-slate-500 uppercase">
                  <th className="px-4 py-3">Log ID</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Truck</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">LR No</th>
                  <th className="px-4 py-3 text-right">Odometer</th>
                  <th className="px-4 py-3 text-right">Litres</th>
                  <th className="px-4 py-3 text-right">Cost (₹)</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {auditResults.map(l => (
                  <tr key={l.fuel_log_id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-bold text-slate-500">#{l.fuel_log_id}</td>
                    <td className="px-4 py-2 font-semibold">{formatDate(l.fuel_date)}</td>
                    <td className="px-4 py-2 font-bold text-slate-900">{l.vehicles?.vehicle_number}</td>
                    <td className="px-4 py-2 text-slate-600">{l.diesel_category}</td>
                    <td className="px-4 py-2 text-slate-600">{l.lr_number}</td>
                    <td className="px-4 py-2 text-right">{l.filling_odometer_km}</td>
                    <td className="px-4 py-2 text-right font-bold text-[#FF5A00]">{l.litres_filled} L</td>
                    <td className="px-4 py-2 text-right font-black text-rose-600">₹{(l.total_fuel_cost || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    <td className="px-4 py-2 text-center">
                      <button onClick={() => handleDeleteFuel(l.fuel_log_id)} className="text-rose-500 hover:text-rose-700 bg-rose-50 p-1.5 rounded" title="Delete Log">🗑️</button>
                    </td>
                  </tr>
                ))}
                {auditResults.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">No logs match your search criteria.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
