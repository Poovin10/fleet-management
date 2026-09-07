"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function FuelAdvanceModule() {
  const supabase = createClient();
  const [faNav, setFaNav] = useState("Issue Diesel");
  const [isLoading, setIsLoading] = useState(true);

  // Master Data
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [dieselRate, setDieselRate] = useState<number>(95.0); // Default, can be linked to settings later

  // Data Tables
  const [recentFuelLogs, setRecentFuelLogs] = useState<any[]>([]);
  const [recentAdvances, setRecentAdvances] = useState<any[]>([]);

  // --- ISSUE DIESEL STATES ---
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0]);
  const [fVehicleId, setFVehicleId] = useState("");
  const [fCategory, setFCategory] = useState("TRIP_DIESEL");
  const [fLrNo, setFLrNo] = useState("");
  const [fFillingKm, setFFillingKm] = useState<number | "">("");
  const [fLitres, setFLitres] = useState<number | "">("");
  const [fIsTankFull, setFIsTankFull] = useState(false);

  // --- DRIVER ADVANCE STATES ---
  const [advDate, setAdvDate] = useState(new Date().toISOString().split('T')[0]);
  const [advDriverId, setAdvDriverId] = useState("");
  const [advAmount, setAdvAmount] = useState<number | "">("");
  const [advCategory, setAdvCategory] = useState("GENERAL_ADVANCE");
  const [advRef, setAdvRef] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    const [vehRes, drvRes, fuelRes, advRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('is_active', true).order('vehicle_number'),
      supabase.from('drivers').select('*').eq('is_active', true).order('full_name'),
      supabase.from('diesel_fuel_logs').select('*, vehicles(vehicle_number)').order('fuel_date', { ascending: false }).limit(50),
      supabase.from('driver_direct_advances').select('*, drivers(full_name, driver_code)').order('advance_date', { ascending: false }).limit(50)
    ]);

    if (vehRes.data) setVehicles(vehRes.data);
    if (drvRes.data) setDrivers(drvRes.data);
    if (fuelRes.data) setRecentFuelLogs(fuelRes.data);
    if (advRes.data) setRecentAdvances(advRes.data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [faNav]); // Refresh data when switching tabs

  // --- HANDLERS ---

  const handleIssueDiesel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fVehicleId || Number(fLitres) <= 0) return alert("Valid Vehicle and Litres > 0 are required.");

    const totalCost = Math.round((Number(fLitres) * dieselRate) * 100) / 100;

    const { error } = await supabase.from('diesel_fuel_logs').insert([{
      fuel_date: fDate,
      vehicle_id: fVehicleId,
      lr_number: fLrNo.toUpperCase() || "SUNDRY",
      diesel_category: fCategory,
      litres_filled: Number(fLitres),
      diesel_rate_per_litre: dieselRate,
      total_fuel_cost: totalCost,
      filling_odometer_km: Number(fFillingKm) || 0,
      is_tank_full: fIsTankFull
    }]);

    if (error) alert("Error recording fuel: " + error.message);
    else {
      alert("Diesel entry recorded successfully!");
      setFLitres(""); setFLrNo(""); setFFillingKm(""); setFIsTankFull(false);
      fetchData();
    }
  };

  const handleIssueAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advDriverId || Number(advAmount) <= 0) return alert("Valid Driver and Amount > 0 are required.");

    const { error } = await supabase.from('driver_direct_advances').insert([{
      advance_date: advDate,
      driver_id: advDriverId,
      amount_inr: Number(advAmount),
      advance_type: advCategory,
      reference_remarks: advRef
    }]);

    if (error) alert("Error recording advance: " + error.message);
    else {
      alert("Driver advance recorded successfully!");
      setAdvAmount(""); setAdvRef("");
      fetchData();
    }
  };

  const handleDeleteAdvance = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this advance?")) return;
    await supabase.from('driver_direct_advances').delete().eq('advance_id', id);
    fetchData();
  };

  const handleDeleteFuel = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this fuel log?")) return;
    await supabase.from('diesel_fuel_logs').delete().eq('fuel_log_id', id);
    fetchData();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Sub-Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {["⛽ Issue Diesel", "📝 Edit Diesel Log", "💵 Driver Advances", "📊 Fuel Audit"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFaNav(tab)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              faNav === tab 
                ? "bg-indigo-600 text-white shadow-md" 
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 1. ISSUE DIESEL */}
      {faNav === "⛽ Issue Diesel" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3 mb-5">Record Fuel Bill</h3>
            <form onSubmit={handleIssueDiesel} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fuel Date *</label>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Truck *</label>
                <select value={fVehicleId} onChange={e => setFVehicleId(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 font-bold" required disabled={isLoading}>
                  <option value="">-- SELECT TRUCK --</option>
                  {vehicles.map(v => <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category *</label>
                <select value={fCategory} onChange={e => setFCategory(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="TRIP_DIESEL">TRIP_DIESEL</option>
                  <option value="SUNDRY_DIESEL">SUNDRY_DIESEL</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trip LR No (Optional)</label>
                <input type="text" value={fLrNo} onChange={e => setFLrNo(e.target.value.toUpperCase())} placeholder="e.g. 40080069852" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 uppercase outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Filling KM</label>
                  <input type="number" value={fFillingKm} onChange={e => setFFillingKm(parseFloat(e.target.value))} placeholder="0.0" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Litres Filled *</label>
                  <input type="number" step="0.1" value={fLitres} onChange={e => setFLitres(parseFloat(e.target.value))} placeholder="0.0" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700" required />
                </div>
              </div>
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={fIsTankFull} onChange={e => setFIsTankFull(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-xs font-bold text-slate-700">⛽ Mark as Tank Full</span>
                </label>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <button type="submit" className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95">
                  Record Diesel Entry
                </button>
              </div>
            </form>
          </div>
          
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3 mb-5">Recent Fuel Entries</h3>
            <div className="overflow-x-auto flex-1 max-h-[500px] overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-200">
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
                      <td className="px-4 py-3 text-slate-600">{log.fuel_date}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{log.vehicles?.vehicle_number}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {log.diesel_category}<br/>
                        <span className="text-[9px] text-slate-400">{log.lr_number}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-600">{log.litres_filled} L</td>
                      <td className="px-4 py-3 text-right text-rose-600">₹{log.total_fuel_cost}</td>
                    </tr>
                  ))}
                  {recentFuelLogs.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">No recent logs found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. DRIVER ADVANCES */}
      {faNav === "💵 Driver Advances" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3 mb-5">Direct Cash Advance</h3>
            <form onSubmit={handleIssueAdvance} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Advance Date *</label>
                <input type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Driver Account *</label>
                <select value={advDriverId} onChange={e => setAdvDriverId(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 font-bold" required disabled={isLoading}>
                  <option value="">-- SELECT DRIVER --</option>
                  {drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.driver_code} - {d.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Advance Amount (₹) *</label>
                <input type="number" value={advAmount} onChange={e => setAdvAmount(parseFloat(e.target.value))} placeholder="0.00" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-emerald-700" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
                <select value={advCategory} onChange={e => setAdvCategory(e.target.value)} className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="GENERAL_ADVANCE">GENERAL_ADVANCE</option>
                  <option value="BATA_ADVANCE">BATA_ADVANCE</option>
                  <option value="EMERGENCY_MEDICAL">EMERGENCY_MEDICAL</option>
                  <option value="SALARY_ADVANCE">SALARY_ADVANCE</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Reference Note</label>
                <input type="text" value={advRef} onChange={e => setAdvRef(e.target.value)} placeholder="e.g. For enroute expenses" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="pt-4 border-t border-slate-100">
                <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95">
                  Issue Advance
                </button>
              </div>
            </form>
          </div>
          
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight border-b border-slate-100 pb-3 mb-5">Advance History</h3>
            <div className="overflow-x-auto flex-1 max-h-[500px] overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-200">
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
                      <td className="px-4 py-3 text-slate-600">{adv.advance_date}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{adv.drivers?.full_name} <br/><span className="text-[9px] font-normal text-slate-400">{adv.drivers?.driver_code}</span></td>
                      <td className="px-4 py-3 text-slate-600">
                        {adv.advance_type}<br/>
                        <span className="text-[9px] text-slate-400">{adv.reference_remarks || "-"}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-emerald-600">₹{adv.amount_inr}</td>
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

      {/* Placeholders for Audit and Edit (Can expand later if requested) */}
      {(faNav === "📝 Edit Diesel Log" || faNav === "📊 Fuel Audit") && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <p className="text-slate-500 font-medium">The {faNav} advanced search & override interface will be mounted here.</p>
        </div>
      )}

    </div>
  );
}
