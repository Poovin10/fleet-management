"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { exportToCSV } from "@/lib/utils/exportManager";

export function FuelAdvanceModule() {
  const supabase = createClient();
  const [faNav, setFaNav] = useState("⛽ Issue Diesel");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [modalConfig, setModalConfig] = useState({
    isOpen: false, title: "", message: "", confirmText: "Confirm", isDanger: false, action: async () => {}
  });

  const triggerModal = (title: string, message: string, isDanger: boolean, confirmText: string, action: () => Promise<void>) => {
    setModalConfig({ isOpen: true, title, message, isDanger, confirmText, action });
  };
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [dieselRate, setDieselRate] = useState<number>(95.0);
  const [recentFuelLogs, setRecentFuelLogs] = useState<any[]>([]);
  
  // Search States
  const [recentSearch, setRecentSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [kmplSearch, setKmplSearch] = useState("");

  // 📥 INBOX STATES
  const [pendingScans, setPendingScans] = useState<any[]>([]);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);

  // STRICT FORM STATES
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

  const [auditDateMode, setAuditDateMode] = useState("All Time");
  const [auditSpecificDate, setAuditSpecificDate] = useState(new Date().toISOString().split('T')[0]);
  const [auditFromDate, setAuditFromDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [auditToDate, setAuditToDate] = useState(new Date().toISOString().split('T')[0]);
  const [auditTruck, setAuditTruck] = useState("All Trucks");
  const [auditCategory, setAuditCategory] = useState("All Categories");
  const [auditResults, setAuditResults] = useState<any[]>([]);

  // 📈 KMPL TRACKER STATES
  const [kmplTruckId, setKmplTruckId] = useState("");
  const [kmplSpans, setKmplSpans] = useState<any[]>([]);
  const [ongoingKmplSpan, setOngoingKmplSpan] = useState<any>(null);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    if (!dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const fetchData = async () => {
    setIsLoading(true);
    const [vehRes, fuelRes, dieselRateRes, scansRes] = await Promise.all([
      supabase.from('trucks').select('*').eq('is_active', true).order('vehicle_number'),
      supabase.from('diesel_fuel_logs').select('*, trucks(vehicle_number)').order('fuel_date', { ascending: false }).order('fuel_log_id', { ascending: false }).limit(200),
      supabase.from('diesel_fuel_logs').select('diesel_rate_per_litre').order('fuel_date', { ascending: false }).order('fuel_log_id', { ascending: false }).limit(1),
      supabase.from("pending_scans").select("*").eq("document_type", "FUEL_SLIP").eq("status", "PENDING").order("created_at", { ascending: false })
    ]);

    if (vehRes.data) setVehicles(vehRes.data);
    if (fuelRes.data) setRecentFuelLogs(fuelRes.data);
    if (scansRes.data) setPendingScans(scansRes.data);

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

  useEffect(() => {
    if (faNav === "📈 Mileage Tracker" && kmplTruckId) {
      calculateKMPLHistory(kmplTruckId);
    }
  }, [faNav, kmplTruckId]);

  const clearFuelForm = () => {
    setEditLogId(null); setEditTripId(null); setFDate(new Date().toISOString().split('T')[0]);
    setFVehicleId(""); setFCategory("TRIP_DIESEL"); setFLrNo(""); setFFillingKm("");
    setFLitres(""); setFDieselRate(dieselRate); setFIsTankFull(false); setActiveScanId(null);
  };

  const applyScanData = (scan: any) => {
    setActiveScanId(scan.scan_id);
    const data = scan.raw_json_result || {};
    let matched = false;
    if (data.truckNo && data.truckNo !== "UNKNOWN") {
      const aiTruck = String(data.truckNo).replace(/[^A-Z0-9]/g, '').toUpperCase();
      const matchedTruck = vehicles.find(v => {
          const dbTruck = String(v.vehicle_number).replace(/[^A-Z0-9]/g, '').toUpperCase();
          return dbTruck === aiTruck || dbTruck.includes(aiTruck) || aiTruck.includes(dbTruck);
      });
      if (matchedTruck) {
          setFVehicleId(String(matchedTruck.id));
          matched = true;
      }
    }
    if (data.litres) setFLitres(Number(data.litres));
    if (data.rate) setFDieselRate(Number(data.rate));
    else setFDieselRate(dieselRate);
    if (!matched) alert(`⚠️ Could not auto-match the Truck Number from this entry (Detected: ${data.truckNo || "None"}). Please select the Truck from the dropdown below.`);
  };

  const handleEditClick = (log: any) => {
    setFaNav("⛽ Issue Diesel"); setEditLogId(log.fuel_log_id); setEditTripId(log.trip_id || null);
    setFDate(log.fuel_date || ""); setFVehicleId(String(log.vehicle_id) || ""); setFCategory(log.diesel_category || "TRIP_DIESEL");
    setFLrNo(log.lr_number === "SUNDRY" ? "" : (log.lr_number || "")); setFFillingKm(log.filling_odometer_km || "");
    setFLitres(log.litres_filled || ""); setFDieselRate(log.diesel_rate_per_litre || dieselRate); setFIsTankFull(log.is_tank_full || false);
    setActiveScanId(null); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveDiesel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fVehicleId || Number(fLitres) <= 0 || Number(fDieselRate) <= 0) return alert("Invalid inputs.");
    const isUpdate = editLogId !== null;
    const cost = Math.round((Number(fLitres) * Number(fDieselRate)) * 100) / 100;

    const payload = {
      fuel_date: fDate, vehicle_id: Number(fVehicleId), lr_number: fLrNo.toUpperCase().trim() || "SUNDRY",
      diesel_category: fCategory, litres_filled: Number(fLitres), diesel_rate_per_litre: Number(fDieselRate),
      total_fuel_cost: cost, filling_odometer_km: Number(fFillingKm) || 0, is_tank_full: fIsTankFull
    };

    triggerModal(
      isUpdate ? "Update Diesel Record" : "Record Diesel Entry",
      isUpdate ? "Edit this fuel log? Trip expenses will recalculate." : `Issue ${fLitres}L of diesel? This updates expenses immediately.`,
      false, isUpdate ? "Update Record" : "Record Diesel",
      async () => {
        setIsProcessing(true);
        if (isUpdate) {
          const { error } = await supabase.from('diesel_fuel_logs').update(payload).eq('fuel_log_id', editLogId);
          if (error) { alert("Error: " + error.message); setIsProcessing(false); return; }
          if (editTripId) {
            const { data: trip } = await supabase.from('trips').select('start_km').eq('trip_id', editTripId).single();
            let updatePayload: any = { fuel_litres: Number(fLitres), fuel_expense: cost };
            if (trip && (trip.start_km === 0 || trip.start_km === null)) updatePayload.start_km = Number(fFillingKm);
            await supabase.from('trips').update(updatePayload).eq('trip_id', editTripId);
          }
        } else {
          const { error } = await supabase.from('diesel_fuel_logs').insert([payload]);
          if (error) { alert("Error: " + error.message); setIsProcessing(false); return; }
          if (activeScanId) {
            await supabase.from("pending_scans").update({ status: 'PROCESSED' }).eq("scan_id", activeScanId);
            setPendingScans(prev => prev.filter(s => s.scan_id !== activeScanId));
          }
        }
        clearFuelForm(); fetchData(); setIsProcessing(false); closeModal();
      }
    );
  };

  const handleDeleteFuel = (id: string) => {
    triggerModal("Delete Fuel Record", "Warning: Permanently delete this fuel log? This action cannot be reversed.", true, "Delete Log", async () => {
      setIsProcessing(true); 
      const { error } = await supabase.from('diesel_fuel_logs').delete().eq('fuel_log_id', id);
      if (error) alert("Error: " + error.message);
      clearFuelForm(); fetchData(); if (faNav === "📊 Fuel Audit") handleRunAudit(); 
      setIsProcessing(false); closeModal();
    });
  };

  const handleRunAudit = async () => {
    setIsProcessing(true);
    let query = supabase.from('diesel_fuel_logs').select('*, trucks!inner(vehicle_number)').order('fuel_date', { ascending: false }).order('fuel_log_id', { ascending: false });
    
    if (auditDateMode === "Specific Date") query = query.eq('fuel_date', auditSpecificDate);
    else if (auditDateMode === "Date Range") query = query.gte('fuel_date', auditFromDate).lte('fuel_date', auditToDate);
    
    if (auditTruck !== "All Trucks") query = query.eq('trucks.vehicle_number', auditTruck);
    if (auditCategory !== "All Categories") query = query.eq('diesel_category', auditCategory);

    const { data, error } = await query;
    if (error) alert("Error fetching audit: " + error.message);
    setAuditResults(data || []);
    setIsProcessing(false);
  };

  // 📈 KMPL ALGORITHM
  const calculateKMPLHistory = async (truckId: string) => {
    setIsProcessing(true);
    const { data: logs } = await supabase.from('diesel_fuel_logs').select('*').eq('vehicle_id', truckId).gt('filling_odometer_km', 0).order('filling_odometer_km', { ascending: true });

    if (!logs || logs.length === 0) {
      setKmplSpans([]); setOngoingKmplSpan(null); setIsProcessing(false); return;
    }

    const spans: any[] = [];
    let currentSpan: any = null;

    for (const log of logs) {
      if (!currentSpan) {
        if (log.is_tank_full) currentSpan = { start_date: log.fuel_date, start_odo: Number(log.filling_odometer_km), accumulated_litres: 0, accumulated_cost: 0, logs_count: 0 };
      } else {
        currentSpan.accumulated_litres += Number(log.litres_filled);
        currentSpan.accumulated_cost += Number(log.total_fuel_cost);
        currentSpan.logs_count += 1;

        if (log.is_tank_full) {
          const end_odo = Number(log.filling_odometer_km);
          const distance = end_odo - currentSpan.start_odo;

          if (distance > 0 && currentSpan.accumulated_litres > 0) {
            spans.push({
              start_date: currentSpan.start_date, end_date: log.fuel_date, start_odo: currentSpan.start_odo, end_odo: end_odo,
              distance: distance, consumed_litres: currentSpan.accumulated_litres, total_cost: currentSpan.accumulated_cost,
              kmpl: (distance / currentSpan.accumulated_litres).toFixed(2), cost_per_km: (currentSpan.accumulated_cost / distance).toFixed(2),
              logs_count: currentSpan.logs_count
            });
          }
          currentSpan = { start_date: log.fuel_date, start_odo: end_odo, accumulated_litres: 0, accumulated_cost: 0, logs_count: 0 };
        }
      }
    }
    setKmplSpans(spans.reverse()); setOngoingKmplSpan(currentSpan); setIsProcessing(false);
  };

  // --- PREMIUM EXPORT MAPPINGS ---
  const filteredRecent = recentFuelLogs.filter(l => 
    (l.trucks?.vehicle_number || "").toLowerCase().includes(recentSearch.toLowerCase()) ||
    (l.lr_number || "").toLowerCase().includes(recentSearch.toLowerCase())
  );
  const exportRecent = filteredRecent.map(l => ({
    "Date": formatDate(l.fuel_date), "Truck": l.trucks?.vehicle_number, "Category": l.diesel_category, "LR No": l.lr_number || "-",
    "Litres": l.litres_filled, "Total Cost (INR)": l.total_fuel_cost, "Tank Full": l.is_tank_full ? "Yes" : "No"
  }));

  const filteredAudit = auditResults.filter(l => 
    (l.trucks?.vehicle_number || "").toLowerCase().includes(auditSearch.toLowerCase()) ||
    (l.lr_number || "").toLowerCase().includes(auditSearch.toLowerCase())
  );
  const exportAudit = filteredAudit.map(l => ({
    "Log ID": l.fuel_log_id, "Date": formatDate(l.fuel_date), "Truck": l.trucks?.vehicle_number || "Unknown",
    "Category": l.diesel_category, "LR Number": l.lr_number || "-", "Odometer": l.filling_odometer_km || 0,
    "Litres": l.litres_filled || 0, "Cost (INR)": l.total_fuel_cost || 0, "Tank Full": l.is_tank_full ? "Yes" : "No"
  }));

  const filteredKmpl = kmplSpans.filter(s => 
    formatDate(s.start_date).includes(kmplSearch) || formatDate(s.end_date).includes(kmplSearch)
  );
  const exportKmpl = filteredKmpl.map(s => ({
    "Span": `${formatDate(s.start_date)} to ${formatDate(s.end_date)}`, "Odo Start": s.start_odo, "Odo End": s.end_odo,
    "Distance (KM)": s.distance, "Consumed (L)": s.consumed_litres.toFixed(1), "KMPL": s.kmpl, "Cost/KM (INR)": s.cost_per_km
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} isDanger={modalConfig.isDanger} confirmText={modalConfig.confirmText} onConfirm={modalConfig.action} onCancel={closeModal} isProcessing={isProcessing} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#272B36] pb-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Fuel & Mileage</h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage diesel logs, full-to-full KMPL tracking, and fuel expense audits.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["⛽ Issue Diesel", "📊 Fuel Audit", "📈 Mileage Tracker"].map((tab) => (
            <button key={tab} onClick={() => setFaNav(tab)} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${faNav === tab ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/20" : "bg-[#161922] text-slate-400 hover:text-white hover:bg-[#1E222D] border border-[#272B36]"}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {faNav === "⛽ Issue Diesel" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-4 bg-[#161922] border border-[#272B36] rounded-2xl p-6 shadow-xl h-fit">
            
            {/* Inbox UI */}
            {!editLogId && pendingScans.length > 0 && (
              <div className="mb-6 p-4 bg-[#1A1F2C] border border-[#2B3142] rounded-xl animate-in slide-in-from-top-4">
                <h4 className="text-xs font-black text-sky-400 uppercase tracking-wider flex items-center gap-2 mb-3"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span></span>Pending Fuel Slips ({pendingScans.length})</h4>
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                  {pendingScans.map(scan => {
                    const data = scan.raw_json_result || {};
                    return (
                      <button key={scan.scan_id} type="button" onClick={() => applyScanData(scan)} className={`min-w-[200px] text-left p-3 rounded-lg border transition-all snap-start ${activeScanId === scan.scan_id ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500' : 'border-[#2B3142] hover:border-slate-500 bg-[#12141C]'}`}>
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold mb-1">Truck: <span className="text-white">{data.truckNo || "UNKNOWN"}</span></p>
                            <p className="text-xs font-black text-white truncate">{data.litres || 0} L <span className="text-slate-500 font-medium">@ ₹{data.rate || '?'}</span></p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center border-b border-[#272B36] pb-3 mb-5">
              <h3 className="text-sm font-black text-white uppercase tracking-wide">{editLogId ? "Edit Diesel Log" : "Record Fuel Bill"}</h3>
              {editLogId && <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded-lg uppercase tracking-widest animate-pulse">Editing Mode</span>}
            </div>

            <form onSubmit={handleSaveDiesel} className="space-y-4">
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fuel Date *</label><input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" required /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Select Truck *</label><select value={fVehicleId} onChange={e => setFVehicleId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-bold" required disabled={isLoading}><option value="">-- SELECT TRUCK --</option>{vehicles.map(v => <option key={v.id} value={String(v.id)}>{v.vehicle_number}</option>)}</select></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category *</label><select value={fCategory} onChange={e => setFCategory(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold"><option value="TRIP_DIESEL">TRIP_DIESEL</option><option value="SUNDRY_DIESEL">SUNDRY_DIESEL</option></select></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Trip LR No (Optional)</label><input type="text" maxLength={20} value={fLrNo} onChange={e => setFLrNo(e.target.value.toUpperCase())} placeholder="e.g. 40080069852" className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white uppercase outline-none focus:border-[#FF5A00] font-semibold" /></div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filling KM</label><input type="number" min="0" max="9999999" value={fFillingKm} onChange={e => setFFillingKm(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.0" className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Litres *</label><input type="number" step="0.1" min="0.1" max="2000" value={fLitres} onChange={e => setFLitres(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.0" className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] outline-none focus:border-[#FF5A00] font-black text-[#FF5A00]" required /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Rate (₹) *</label><input type="number" step="0.1" min="0.1" max="200" value={fDieselRate} onChange={e => setFDieselRate(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.00" className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-bold" required /></div>
              </div>

              <div className="flex justify-between items-center bg-[#0F1117] p-4 rounded-xl border border-[#272B36] mt-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input type="checkbox" checked={fIsTankFull} onChange={e => setFIsTankFull(e.target.checked)} className="w-4 h-4 rounded text-[#FF5A00] bg-[#1A1F2C] border-[#272B36] focus:ring-[#FF5A00]" />
                  <span className="text-xs font-black text-white uppercase">⛽ Tank Full</span>
                </label>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase mr-3">Cost:</span>
                  <span className="text-lg font-black text-rose-500">₹{((Number(fLitres) || 0) * (Number(fDieselRate) || 0)).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-[#272B36]">
                {editLogId && (
                  <><button type="button" onClick={() => handleDeleteFuel(editLogId)} className="px-4 py-3 bg-rose-950/40 text-rose-500 hover:bg-rose-900 border border-rose-900/50 rounded-xl font-bold transition-colors">🗑️</button><button type="button" onClick={clearFuelForm} className="flex-1 py-3 bg-[#0F1117] text-slate-300 font-bold rounded-xl border border-[#272B36] hover:bg-[#272B36] transition-colors">Cancel</button></>
                )}
                <button type="submit" disabled={!fVehicleId || Number(fLitres) <= 0 || isProcessing} className="flex-[2] py-3 bg-[#FF5A00] hover:bg-[#e04f00] disabled:bg-slate-700 text-white font-black text-sm rounded-xl transition-all shadow-lg active:scale-95">
                  {editLogId ? "Update Record" : "Record Diesel"}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-8 bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden flex flex-col shadow-xl h-fit">
            <TableToolbar title="Recent Fuel Entries" searchQuery={recentSearch} setSearchQuery={setRecentSearch} exportData={exportRecent} exportFilename="Recent_Fuel_Logs" />
            <div className="overflow-x-auto flex-1 max-h-[600px] overflow-y-auto w-full">
              <table className="min-w-full divide-y divide-[#272B36] whitespace-nowrap">
                <thead className="bg-[#0F1117] sticky top-0 z-10">
                  <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Truck</th>
                    <th className="px-5 py-3 text-left">Category / LR</th>
                    <th className="px-5 py-3 text-right">Litres</th>
                    <th className="px-5 py-3 text-right">Cost (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#272B36] text-xs bg-[#161922]">
                  {filteredRecent.map((log) => (
                    <tr key={log.fuel_log_id} onClick={() => handleEditClick(log)} className={`cursor-pointer transition-colors ${editLogId === log.fuel_log_id ? 'bg-[#FF5A00]/10 border-l-2 border-l-[#FF5A00]' : 'hover:bg-[#1E222D] border-l-2 border-transparent'}`}>
                      <td className="px-5 py-3.5 font-semibold text-slate-300">{formatDate(log.fuel_date)}</td>
                      <td className="px-5 py-3.5 font-black text-white">{log.trucks?.vehicle_number}</td>
                      <td className="px-5 py-3.5 text-slate-300">{log.diesel_category}<br/><span className="text-[9px] text-slate-500">{log.lr_number}</span></td>
                      <td className="px-5 py-3.5 text-right font-black text-[#FF5A00]">{log.litres_filled} L {log.is_tank_full && <span title="Tank Full" className="ml-1 text-sm">⛽</span>}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-rose-500">₹{(log.total_fuel_cost || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    </tr>
                  ))}
                  {filteredRecent.length === 0 && <tr><td colSpan={5} className="p-8 text-center font-medium text-slate-500">No logs found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {faNav === "📊 Fuel Audit" && (
        <div className="bg-[#161922] border border-[#272B36] rounded-2xl p-6 shadow-xl animate-in slide-in-from-bottom-4">
          <h3 className="text-sm font-black text-white uppercase tracking-wide border-b border-[#272B36] pb-3 mb-5">Advanced Fuel Audit Engine</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date Mode</label><select value={auditDateMode} onChange={e => setAuditDateMode(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold"><option value="All Time">All Time</option><option value="Specific Date">Specific Date</option><option value="Date Range">Date Range</option></select></div>
            {auditDateMode === "Specific Date" && <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label><input type="date" value={auditSpecificDate} onChange={e => setAuditSpecificDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" /></div>}
            {auditDateMode === "Date Range" && <><div className="col-span-1"><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">From</label><input type="date" value={auditFromDate} onChange={e => setAuditFromDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" /></div><div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">To</label><input type="date" value={auditToDate} onChange={e => setAuditToDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" /></div></>}
            {auditDateMode === "All Time" && <div className="hidden md:block md:col-span-2"></div>}
            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Truck No</label><select value={auditTruck} onChange={e => setAuditTruck(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-bold"><option value="All Trucks">All Trucks</option>{vehicles.map(v => <option key={v.id} value={v.vehicle_number}>{v.vehicle_number}</option>)}</select></div>
            <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</label><select value={auditCategory} onChange={e => setAuditCategory(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold"><option value="All Categories">All Categories</option><option value="TRIP_DIESEL">TRIP_DIESEL</option><option value="SUNDRY_DIESEL">SUNDRY_DIESEL</option></select></div>
          </div>

          <div className="flex justify-end mb-6">
            <button onClick={handleRunAudit} className="px-8 py-3 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-sm rounded-xl transition-all shadow-lg active:scale-95">Fetch Database Records</button>
          </div>

          <div className="border border-[#272B36] rounded-xl overflow-hidden">
            <TableToolbar title="Audit Results" searchQuery={auditSearch} setSearchQuery={setAuditSearch} exportData={exportAudit} exportFilename="Fuel_Audit_Report" />
            <div className="overflow-x-auto w-full max-h-[500px] overflow-y-auto">
              <table className="min-w-full divide-y divide-[#272B36] text-xs whitespace-nowrap">
                <thead className="bg-[#0F1117] sticky top-0"><tr className="text-left font-bold text-slate-400 uppercase tracking-wider text-[10px]"><th className="px-5 py-4">Log ID</th><th className="px-5 py-4">Date</th><th className="px-5 py-4">Truck</th><th className="px-5 py-4">Category</th><th className="px-5 py-4">LR No</th><th className="px-5 py-4 text-right">Odometer</th><th className="px-5 py-4 text-right">Litres</th><th className="px-5 py-4 text-right">Cost (₹)</th></tr></thead>
                <tbody className="bg-[#161922] divide-y divide-[#272B36]">
                  {filteredAudit.map(l => (
                    <tr key={l.fuel_log_id} onClick={() => handleEditClick(l)} className="hover:bg-[#1E222D] cursor-pointer transition-colors">
                      <td className="px-5 py-3 font-bold text-slate-500">#{l.fuel_log_id}</td>
                      <td className="px-5 py-3 font-semibold text-slate-300">{formatDate(l.fuel_date)}</td>
                      <td className="px-5 py-3 font-black text-white">{l.trucks?.vehicle_number}</td>
                      <td className="px-5 py-3 text-slate-300">{l.diesel_category}</td>
                      <td className="px-5 py-3 font-bold text-[#FF5A00]">{l.lr_number}</td>
                      <td className="px-5 py-3 text-right text-slate-300">{l.filling_odometer_km}</td>
                      <td className="px-5 py-3 text-right font-black text-[#FF5A00]">{l.litres_filled} L {l.is_tank_full && <span title="Tank Full" className="ml-1 text-sm">⛽</span>}</td>
                      <td className="px-5 py-3 text-right font-bold text-rose-500">₹{(l.total_fuel_cost || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                    </tr>
                  ))}
                  {filteredAudit.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-500 font-medium">No logs match your criteria.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {faNav === "📈 Mileage Tracker" && (
        <div className="bg-[#161922] border border-[#272B36] rounded-2xl p-6 shadow-xl animate-in slide-in-from-bottom-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[#272B36] pb-4 mb-6 gap-4">
             <div><h3 className="text-sm font-black text-white uppercase tracking-wide">Vehicle Mileage (KMPL) Tracker</h3><p className="text-xs text-slate-400 mt-1">Calculates true mileage using the "Full-to-Full" standard formula.</p></div>
             <div className="w-full md:w-64"><select value={kmplTruckId} onChange={e => setKmplTruckId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#1A1F2C] focus:border-[#FF5A00] outline-none font-bold text-white"><option value="">-- SELECT TRUCK --</option>{vehicles.map(v => (<option key={v.id} value={v.id}>{v.vehicle_number}</option>))}</select></div>
          </div>

          {!kmplTruckId ? (
            <div className="p-12 text-center bg-[#0F1117] border border-[#272B36] rounded-xl flex flex-col items-center"><span className="text-4xl mb-4">📈</span><p className="text-sm font-bold text-slate-500">Select a truck above to view its automated full-to-full mileage history.</p></div>
          ) : isProcessing ? (
            <div className="p-12 text-center"><p className="text-sm font-bold text-[#FF5A00] animate-pulse">Calculating algorithms...</p></div>
          ) : (
            <div className="space-y-6">
              {ongoingKmplSpan && (
                <div className="bg-sky-950/20 border border-sky-900/50 p-5 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div><h4 className="text-[10px] font-black text-sky-400 uppercase tracking-widest mb-1">Current Ongoing Span (Awaiting Next Tank Full)</h4><p className="text-sm font-semibold text-slate-300">Started at Odo <span className="font-black text-white">{ongoingKmplSpan.start_odo} KM</span> on {formatDate(ongoingKmplSpan.start_date)}</p></div>
                  <div className="text-right"><p className="text-2xl font-black text-sky-400">{ongoingKmplSpan.accumulated_litres.toFixed(1)} L</p><p className="text-[10px] font-bold text-sky-500 uppercase">Accumulated so far</p></div>
                </div>
              )}
              <div className="overflow-x-auto rounded-xl border border-[#272B36] w-full">
                <TableToolbar title="KMPL History" searchQuery={kmplSearch} setSearchQuery={setKmplSearch} exportData={exportKmpl} exportFilename="KMPL_Report" />
                <table className="min-w-full divide-y divide-[#272B36] text-xs whitespace-nowrap">
                  <thead className="bg-[#0F1117] sticky top-0"><tr className="text-left font-bold text-slate-400 uppercase tracking-wider text-[10px]"><th className="px-5 py-4">Time Span (Full to Full)</th><th className="px-5 py-4 text-right">Distance</th><th className="px-5 py-4 text-right">Consumed</th><th className="px-5 py-4 text-right border-l border-[#272B36]">KMPL (Mileage)</th><th className="px-5 py-4 text-right">Cost / KM</th></tr></thead>
                  <tbody className="bg-[#161922] divide-y divide-[#272B36]">
                    {filteredKmpl.map((span, idx) => (
                      <tr key={idx} className="hover:bg-[#1E222D] transition-colors">
                        <td className="px-5 py-3"><p className="font-semibold text-slate-300">{formatDate(span.start_date)} <span className="text-slate-600">➔</span> {formatDate(span.end_date)}</p><p className="text-[10px] text-slate-500 mt-0.5">Odo: {span.start_odo} ➔ {span.end_odo} <span className="text-[#FF5A00] ml-2 font-bold">({span.logs_count} fill-ups)</span></p></td>
                        <td className="px-5 py-3 text-right font-black text-white">{span.distance} KM</td>
                        <td className="px-5 py-3 text-right font-bold text-sky-400">{span.consumed_litres.toFixed(1)} L</td>
                        <td className="px-5 py-3 text-right font-black text-emerald-400 text-base border-l border-[#272B36] bg-emerald-950/10">{span.kmpl}</td>
                        <td className="px-5 py-3 text-right font-bold text-rose-400">₹{span.cost_per_km}</td>
                      </tr>
                    ))}
                    {filteredKmpl.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500 font-medium">Not enough "Tank Full" records to calculate.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
