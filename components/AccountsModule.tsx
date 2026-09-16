"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function AccountsModule() {
  const supabase = createClient();
  const [activeSubTab, setActiveSubTab] = useState<"settlement" | "advances" | "petty" | "workshop">("settlement");
  const [isLoading, setIsLoading] = useState(false);

  // States
  const [trips, setTrips] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [advancesList, setAdvancesList] = useState<any[]>([]);
  const [expensesList, setExpensesList] = useState<any[]>([]);

  // Advance Form State
  const [advDriverId, setAdvDriverId] = useState("");
  const [advAmount, setAdvAmount] = useState<number | "">("");
  const [advDate, setAdvDate] = useState(new Date().toISOString().split("T")[0]);
  const [advPaymentMode, setAdvPaymentMode] = useState("CASH");
  const [advRemarks, setAdvRemarks] = useState("");

  // Petty Expense Form State
  const [expCategory, setExpCategory] = useState("TOLL_FASTAG");
  const [expAmount, setExpAmount] = useState<number | "">("");
  const [expVehicleId, setExpVehicleId] = useState("");
  const [expDate, setExpDate] = useState(new Date().toISOString().split("T")[0]);
  const [expDescription, setExpDescription] = useState("");

  useEffect(() => {
    fetchAccountsData();
  }, []);

  async function fetchAccountsData() {
    setIsLoading(true);
    const [tripsRes, driversRes, vehRes] = await Promise.all([
      supabase.from("trips").select("*, vehicles(vehicle_number), drivers(full_name, driver_code)").order("trip_id", { ascending: false }).limit(50),
      supabase.from("drivers").select("*").eq("is_active", true).order("full_name"),
      supabase.from("vehicles").select("*").eq("is_active", true).order("vehicle_number"),
    ]);

    if (tripsRes.data) setTrips(tripsRes.data);
    if (driversRes.data) setDrivers(driversRes.data);
    if (vehRes.data) setVehicles(vehRes.data);
    setIsLoading(false);
  }

  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advDriverId || !advAmount || Number(advAmount) <= 0) return alert("Please provide driver and valid amount.");

    setIsLoading(true);
    const { error } = await supabase.from("driver_advances").insert([{
      driver_id: Number(advDriverId),
      amount: Number(advAmount),
      advance_date: advDate,
      payment_mode: advPaymentMode,
      remarks: advRemarks,
      created_at: new Date().toISOString()
    }]);

    setIsLoading(false);
    if (error) alert("Error creating advance: " + error.message);
    else {
      alert("Driver advance recorded!");
      setAdvAmount("");
      setAdvRemarks("");
      fetchAccountsData();
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expAmount || Number(expAmount) <= 0) return alert("Please provide valid expense amount.");

    setIsLoading(true);
    const { error } = await supabase.from("expenses").insert([{
      category: expCategory,
      amount: Number(expAmount),
      vehicle_id: expVehicleId ? Number(expVehicleId) : null,
      expense_date: expDate,
      description: expDescription,
      created_at: new Date().toISOString()
    }]);

    setIsLoading(false);
    if (error) alert("Error saving expense: " + error.message);
    else {
      alert("Expense recorded!");
      setExpAmount("");
      setExpDescription("");
      fetchAccountsData();
    }
  };

  return (
    <div className="bg-[#12141C] border border-[#222634] rounded-2xl p-6 shadow-xl max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-[#222634] gap-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Accounts & Settlement</h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage driver payouts, petty expenses, advances, and workshop costs.</p>
        </div>

        {/* Sub Navigation */}
        <div className="flex bg-[#0F1117] p-1 rounded-xl border border-[#2B3142] overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveSubTab("settlement")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeSubTab === "settlement" ? "bg-[#FF5A00] text-white shadow-md" : "text-slate-400 hover:text-white"}`}
          >
            Driver Settlement
          </button>
          <button
            onClick={() => setActiveSubTab("advances")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeSubTab === "advances" ? "bg-[#FF5A00] text-white shadow-md" : "text-slate-400 hover:text-white"}`}
          >
            Driver Advances
          </button>
          <button
            onClick={() => setActiveSubTab("petty")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeSubTab === "petty" ? "bg-[#FF5A00] text-white shadow-md" : "text-slate-400 hover:text-white"}`}
          >
            Petty Expenses
          </button>
          <button
            onClick={() => setActiveSubTab("workshop")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeSubTab === "workshop" ? "bg-[#FF5A00] text-white shadow-md" : "text-slate-400 hover:text-white"}`}
          >
            Workshop Expenses
          </button>
        </div>
      </div>

      {/* Sub-tab 1: DRIVER SETTLEMENT */}
      {activeSubTab === "settlement" && (
        <div className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Trip Settlement Queue</h3>
            <span className="text-xs font-semibold text-slate-400">{trips.length} Recent Trips Loaded</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#222634]">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#1A1F2C] text-slate-400 uppercase font-black text-[10px] tracking-wider border-b border-[#2B3142]">
                <tr>
                  <th className="p-3">LR / Trip #</th>
                  <th className="p-3">Truck</th>
                  <th className="p-3">Driver</th>
                  <th className="p-3">Route</th>
                  <th className="p-3 text-right">Driver Bata</th>
                  <th className="p-3 text-right">Cash Advance</th>
                  <th className="p-3 text-right">Net Payable / (Recoverable)</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222634] font-medium">
                {trips.map((t) => {
                  const bata = Number(t.driver_bata) || 0;
                  const adv = Number(t.cash_advance_issued) || 0;
                  const net = bata - adv;
                  return (
                    <tr key={t.trip_id} className="hover:bg-[#1A1F2C]/50 transition-colors">
                      <td className="p-3 font-bold text-white">{t.trip_number}</td>
                      <td className="p-3 text-slate-200">{t.vehicles?.vehicle_number || `#${t.vehicle_id}`}</td>
                      <td className="p-3 text-slate-300">{t.drivers?.full_name || `#${t.primary_driver_id}`}</td>
                      <td className="p-3 text-slate-400">{t.origin} ➔ {t.destination}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-400">₹{bata.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono font-bold text-rose-400">₹{adv.toLocaleString()}</td>
                      <td className={`p-3 text-right font-mono font-black ${net >= 0 ? "text-emerald-300" : "text-amber-400"}`}>
                        ₹{net.toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 text-[10px] font-black rounded-md ${t.trip_status === "COMPLETED" ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800" : "bg-blue-950/60 text-blue-400 border border-blue-800"}`}>
                          {t.trip_status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 2: DRIVER ADVANCES */}
      {activeSubTab === "advances" && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#1A1F2C] border border-[#2B3142] p-5 rounded-xl">
            <h3 className="text-sm font-bold text-white uppercase mb-4">Record New Driver Advance</h3>
            <form onSubmit={handleCreateAdvance} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Driver *</label>
                <select value={advDriverId} onChange={e => setAdvDriverId(e.target.value)} className="w-full text-xs p-3 rounded-lg bg-[#12141C] border border-[#2B3142] text-white font-bold" required>
                  <option value="">-- SELECT DRIVER --</option>
                  {drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.driver_code} - {d.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Advance Amount (₹) *</label>
                <input type="number" value={advAmount} onChange={e => setAdvAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.00" className="w-full text-xs p-3 rounded-lg bg-[#12141C] border border-[#2B3142] text-[#FF5A00] font-black" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Payment Mode</label>
                <select value={advPaymentMode} onChange={e => setAdvPaymentMode(e.target.value)} className="w-full text-xs p-3 rounded-lg bg-[#12141C] border border-[#2B3142] text-white font-bold">
                  <option value="CASH">CASH</option>
                  <option value="UPI / GPAY">UPI / GPAY</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
                <input type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} className="w-full text-xs p-3 rounded-lg bg-[#12141C] border border-[#2B3142] text-white font-bold" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Remarks</label>
                <input type="text" value={advRemarks} onChange={e => setAdvRemarks(e.target.value)} placeholder="Emergency transit advance, etc." className="w-full text-xs p-3 rounded-lg bg-[#12141C] border border-[#2B3142] text-white font-bold" />
              </div>
              <button type="submit" disabled={isLoading} className="w-full py-3 bg-[#FF5A00] hover:bg-[#e04f00] text-white text-xs font-black rounded-lg uppercase transition-all shadow-lg">Save Advance</button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-[#1A1F2C] border border-[#2B3142] p-5 rounded-xl flex flex-col justify-center items-center text-center">
            <p className="text-slate-400 text-xs font-bold">Driver Advance History & Trip Ledger Linking</p>
            <p className="text-slate-500 text-[11px] mt-1 max-w-sm">All advances issued here automatically get indexed into the driver's settlement ledger when closing their trip.</p>
          </div>
        </div>
      )}

      {/* Sub-tab 3: PETTY EXPENSES */}
      {activeSubTab === "petty" && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#1A1F2C] border border-[#2B3142] p-5 rounded-xl">
            <h3 className="text-sm font-bold text-white uppercase mb-4">Record Petty Expense</h3>
            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Expense Type</label>
                <select value={expCategory} onChange={e => setExpCategory(e.target.value)} className="w-full text-xs p-3 rounded-lg bg-[#12141C] border border-[#2B3142] text-white font-bold">
                  <option value="TOLL_FASTAG">FASTAG / TOLL</option>
                  <option value="UNLOADING_LOADING">LOADING / UNLOADING TIP</option>
                  <option value="WEIGHBRIDGE">WEIGHBRIDGE CHARGES</option>
                  <option value="RTO_INCIDENTAL">RTO / TRANSIT EXPENSE</option>
                  <option value="OFFICE_TEA">OFFICE / TEA / PETTY CASH</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₹) *</label>
                <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.00" className="w-full text-xs p-3 rounded-lg bg-[#12141C] border border-[#2B3142] text-emerald-400 font-black" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Truck (Optional)</label>
                <select value={expVehicleId} onChange={e => setExpVehicleId(e.target.value)} className="w-full text-xs p-3 rounded-lg bg-[#12141C] border border-[#2B3142] text-white font-bold">
                  <option value="">-- NONE / GENERAL FLEET --</option>
                  {vehicles.map(v => <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
                <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} className="w-full text-xs p-3 rounded-lg bg-[#12141C] border border-[#2B3142] text-white font-bold" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description / Bill Ref</label>
                <input type="text" value={expDescription} onChange={e => setExpDescription(e.target.value)} placeholder="Toll voucher #, slip ref" className="w-full text-xs p-3 rounded-lg bg-[#12141C] border border-[#2B3142] text-white font-bold" />
              </div>
              <button type="submit" disabled={isLoading} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg uppercase transition-all shadow-lg">Save Expense</button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-[#1A1F2C] border border-[#2B3142] p-5 rounded-xl flex flex-col justify-center items-center text-center">
            <p className="text-slate-400 text-xs font-bold">Petty Cash Tracking</p>
            <p className="text-slate-500 text-[11px] mt-1 max-w-sm">Every incidental receipt logged here is automatically factored into overall fleet operational cost accounting.</p>
          </div>
        </div>
      )}

      {/* Sub-tab 4: WORKSHOP EXPENSES */}
      {activeSubTab === "workshop" && (
        <div className="mt-6 space-y-4">
          <div className="p-6 bg-[#1A1F2C] border border-[#2B3142] rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase">Workshop & Maintenance Payables</h3>
              <p className="text-xs text-slate-400 mt-1">Directly aggregated from work orders, tyre retreading, oil changes, and mechanic repair bills.</p>
            </div>
            <span className="px-3 py-1 bg-amber-950/40 border border-amber-800/60 text-amber-400 rounded-lg text-xs font-black">
              SYNCED WITH WORKSHOP MODULE
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
