"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function AccountsModule() {
  const supabase = createClient();
  const [activeSubTab, setActiveSubTab] = useState<"settlement" | "advances" | "petty" | "workshop">("settlement");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Core Data States
  const [trips, setTrips] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [trucksList, setTrucksList] = useState<any[]>([]);
  const [recentAdvances, setRecentAdvances] = useState<any[]>([]);
  const [workshopBills, setWorkshopBills] = useState<any[]>([]);

  // Driver Advance Form States
  const [advDate, setAdvDate] = useState(new Date().toISOString().split("T")[0]);
  const [advDriverId, setAdvDriverId] = useState("");
  const [advAmount, setAdvAmount] = useState<number | "">("");
  const [advCategory, setAdvCategory] = useState("GENERAL_ADVANCE");
  const [advRef, setAdvRef] = useState("");

  // Petty Expense Form States
  const [expCategory, setExpCategory] = useState("TOLL_FASTAG");
  const [expAmount, setExpAmount] = useState<number | "">("");
  const [expVehicleId, setExpVehicleId] = useState("");
  const [expDate, setExpDate] = useState(new Date().toISOString().split("T")[0]);
  const [expDescription, setExpDescription] = useState("");

  useEffect(() => {
    fetchAccountsData();
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  async function fetchAccountsData() {
    setIsLoading(true);
    const [tripsRes, driversRes, trucksRes, advRes, billsRes] = await Promise.all([
      supabase.from("trips").select("*, trucks(vehicle_number), drivers(full_name, driver_code)").order("trip_id", { ascending: false }).limit(50),
      supabase.from("drivers").select("*").eq("is_active", true).order("full_name"),
      supabase.from("trucks").select("*").order("vehicle_number"),
      supabase.from("driver_direct_advances").select("*, drivers(full_name, driver_code)").order("advance_date", { ascending: false }).limit(50),
      supabase.from("workshop_spares_bills").select("*, trucks(vehicle_number)").order("bill_date", { ascending: false }).limit(50)
    ]);

    if (tripsRes.data) setTrips(tripsRes.data);
    if (driversRes.data) setDrivers(driversRes.data);
    if (trucksRes.data) setTrucksList(trucksRes.data);
    if (advRes.data) setRecentAdvances(advRes.data);
    if (billsRes.data) setWorkshopBills(billsRes.data);
    setIsLoading(false);
  }

  // --- DRIVER ADVANCES HANDLERS ---
  const handleIssueAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advDriverId || Number(advAmount) <= 0) return alert("Please select a driver and valid amount.");

    setIsProcessing(true);
    const { error } = await supabase.from("driver_direct_advances").insert([{
      advance_date: advDate,
      driver_id: Number(advDriverId),
      amount_inr: Number(advAmount),
      advance_type: advCategory,
      reference_remarks: advRef.trim()
    }]);

    setIsProcessing(false);
    if (error) {
      alert("Failed to issue advance: " + error.message);
    } else {
      alert("Driver advance issued successfully!");
      setAdvAmount("");
      setAdvRef("");
      fetchAccountsData();
    }
  };

  const handleDeleteAdvance = async (id: string | number) => {
    if (!confirm("Are you sure you want to delete this advance record? This cannot be undone.")) return;

    setIsProcessing(true);
    const { error } = await supabase.from("driver_direct_advances").delete().eq("advance_id", id);
    setIsProcessing(false);

    if (error) {
      alert("Error deleting advance: " + error.message);
    } else {
      fetchAccountsData();
    }
  };

  // --- PETTY EXPENSE HANDLERS ---
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expAmount || Number(expAmount) <= 0) return alert("Please enter a valid amount.");

    setIsProcessing(true);
    const { error } = await supabase.from("workshop_spares_bills").insert([{
      bill_date: expDate,
      vehicle_id: expVehicleId ? Number(expVehicleId) : null,
      vendor_name: expCategory,
      service_description: expDescription.trim() || "Petty Operating Expense",
      bill_amount: Number(expAmount)
    }]);

    setIsProcessing(false);
    if (error) {
      alert("Failed to record expense: " + error.message);
    } else {
      alert("Expense logged successfully!");
      setExpAmount("");
      setExpDescription("");
      fetchAccountsData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#272B36] pb-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Finance & Accounts</h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage trip settlements, driver cash advances, petty cash, and workshop expenses.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: "settlement", label: "📊 Trip Settlements" },
            { id: "advances", label: "💵 Driver Advances" },
            { id: "petty", label: "🧾 Petty Expenses" },
            { id: "workshop", label: "🔧 Workshop Ledger" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === tab.id
                  ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/20"
                  : "bg-[#161922] text-slate-400 hover:text-white hover:bg-[#1E222D] border border-[#272B36]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tab 1: DRIVER TRIP SETTLEMENT */}
      {activeSubTab === "settlement" && (
        <div className="bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-[#12141C] px-6 py-4 flex justify-between items-center border-b border-[#272B36]">
            <h3 className="text-sm font-black text-white uppercase tracking-wide">Trip Settlement Queue</h3>
            <span className="text-xs font-semibold text-slate-400">{trips.length} Recent Trips Loaded</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#272B36] text-left text-xs whitespace-nowrap">
              <thead className="bg-[#0F1117] text-slate-400 uppercase font-black text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">LR / Trip #</th>
                  <th className="px-5 py-3.5">Truck</th>
                  <th className="px-5 py-3.5">Driver</th>
                  <th className="px-5 py-3.5 text-right">Freight (₹)</th>
                  <th className="px-5 py-3.5 text-right">Advance (₹)</th>
                  <th className="px-5 py-3.5 text-right">Driver Bata (₹)</th>
                  <th className="px-5 py-3.5 text-center">Settlement Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#272B36] bg-[#161922]">
                {trips.map((t) => {
                  const freight = Number(t.freight_amount) || 0;
                  const adv = Number(t.advance_amount) || 0;
                  const bata = Number(t.driver_bata) || 0;
                  return (
                    <tr key={t.trip_id} className="hover:bg-[#1E222D] transition-colors">
                      <td className="px-5 py-4 font-black text-white">
                        {t.lr_number || `TRIP-${t.trip_id}`}
                        <div className="text-[10px] text-slate-400 font-normal">{t.route || "N/A"}</div>
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-300">{t.trucks?.vehicle_number || t.vehicle_number || "-"}</td>
                      <td className="px-5 py-4 font-semibold text-slate-300">
                        {t.drivers?.full_name || `#${t.primary_driver_id || "-"}`}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-300">₹{freight.toLocaleString("en-IN")}</td>
                      <td className="px-5 py-4 text-right font-semibold text-amber-400">₹{adv.toLocaleString("en-IN")}</td>
                      <td className="px-5 py-4 text-right font-semibold text-emerald-400">₹{bata.toLocaleString("en-IN")}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          t.status === "COMPLETED"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            : "bg-amber-950 text-amber-400 border border-amber-800"
                        }`}>
                          {t.status || "IN_TRANSIT"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {trips.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">No trip records available for settlement.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 2: DRIVER ADVANCES */}
      {activeSubTab === "advances" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-4 bg-[#161922] border border-[#272B36] rounded-2xl p-6 shadow-xl h-fit">
            <h3 className="text-sm font-black text-white uppercase tracking-wide border-b border-[#272B36] pb-3 mb-5">Direct Cash Advance</h3>
            <form onSubmit={handleIssueAdvance} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Advance Date *</label>
                <input
                  type="date"
                  value={advDate}
                  onChange={(e) => setAdvDate(e.target.value)}
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Driver Account *</label>
                <select
                  value={advDriverId}
                  onChange={(e) => setAdvDriverId(e.target.value)}
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-bold"
                  required
                  disabled={isLoading}
                >
                  <option value="">-- SELECT DRIVER --</option>
                  {drivers.map((d) => (
                    <option key={d.driver_id} value={String(d.driver_id)}>
                      {d.driver_code} - {d.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Advance Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  value={advAmount}
                  onChange={(e) => setAdvAmount(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] outline-none focus:border-[#FF5A00] font-black text-emerald-400"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</label>
                <select
                  value={advCategory}
                  onChange={(e) => setAdvCategory(e.target.value)}
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold"
                >
                  <option value="GENERAL_ADVANCE">GENERAL_ADVANCE</option>
                  <option value="BATA_ADVANCE">BATA_ADVANCE</option>
                  <option value="EMERGENCY_MEDICAL">EMERGENCY_MEDICAL</option>
                  <option value="SALARY_ADVANCE">SALARY_ADVANCE</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Reference Note</label>
                <input
                  type="text"
                  value={advRef}
                  onChange={(e) => setAdvRef(e.target.value)}
                  placeholder="e.g. Enroute trip diesel/toll backup"
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold"
                />
              </div>

              <div className="pt-4 border-t border-[#272B36]">
                <button
                  type="submit"
                  disabled={!advDriverId || Number(advAmount) <= 0 || isProcessing}
                  className="w-full py-3.5 bg-[#FF5A00] hover:bg-[#e04f00] disabled:bg-slate-700 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20 active:scale-95"
                >
                  {isProcessing ? "Processing..." : "Issue Advance"}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-8 bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden flex flex-col shadow-xl h-fit">
            <div className="bg-[#12141C] px-6 py-4 flex justify-between items-center border-b border-[#272B36]">
              <h3 className="text-sm font-black text-white uppercase tracking-wide">Advance History</h3>
              <span className="text-xs font-semibold text-slate-400">{recentAdvances.length} Records</span>
            </div>
            <div className="overflow-x-auto flex-1 max-h-[600px] overflow-y-auto w-full">
              <table className="min-w-full divide-y divide-[#272B36] whitespace-nowrap">
                <thead className="bg-[#0F1117] sticky top-0 z-10">
                  <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-3.5 text-left border-b border-[#272B36]">Date</th>
                    <th className="px-5 py-3.5 text-left border-b border-[#272B36]">Driver</th>
                    <th className="px-5 py-3.5 text-left border-b border-[#272B36]">Category & Ref</th>
                    <th className="px-5 py-3.5 text-right border-b border-[#272B36]">Amount (₹)</th>
                    <th className="px-5 py-3.5 text-center border-b border-[#272B36]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#272B36] text-xs bg-[#161922]">
                  {recentAdvances.map((adv) => (
                    <tr key={adv.advance_id} className="hover:bg-[#1E222D] transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-300">{formatDate(adv.advance_date)}</td>
                      <td className="px-5 py-3.5 font-black text-white">
                        {adv.drivers?.full_name} <br />
                        <span className="text-[9px] font-bold text-[#FF5A00]">{adv.drivers?.driver_code}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {adv.advance_type}
                        <br />
                        <span className="text-[9px] text-slate-500">{adv.reference_remarks || "-"}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-emerald-400">
                        ₹{(adv.amount_inr || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => handleDeleteAdvance(adv.advance_id)}
                          className="text-rose-500 hover:text-white hover:bg-rose-600 bg-rose-950/40 border border-rose-900/50 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                          title="Delete Advance"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {recentAdvances.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center font-medium text-slate-500">No driver advances recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 3: PETTY EXPENSES */}
      {activeSubTab === "petty" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#161922] border border-[#272B36] p-6 rounded-2xl shadow-xl">
            <h3 className="text-sm font-black text-white uppercase tracking-wide border-b border-[#272B36] pb-3 mb-5">Record Petty Expense</h3>
            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Expense Type</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl bg-[#0F1117] border border-[#272B36] text-white font-bold outline-none focus:border-[#FF5A00]"
                >
                  <option value="TOLL_FASTAG">TOLL / FASTAG TOP-UP</option>
                  <option value="POLICE_RTO_EXPENSE">POLICE / RTO / PERMITS</option>
                  <option value="LOADING_UNLOADING">HAMALI / LOADING CHARGES</option>
                  <option value="OFFICE_STATIONERY">OFFICE & PETTY MISC</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Truck (Optional)</label>
                <select
                  value={expVehicleId}
                  onChange={(e) => setExpVehicleId(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl bg-[#0F1117] border border-[#272B36] text-white font-bold outline-none focus:border-[#FF5A00]"
                >
                  <option value="">-- GENERAL FLEET EXPENSE --</option>
                  {trucksList.map((t) => (
                    <option key={t.id} value={t.id}>{t.vehicle_number}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full text-xs p-3 rounded-xl bg-[#0F1117] border border-[#272B36] text-[#FF5A00] font-black outline-none focus:border-[#FF5A00]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl bg-[#0F1117] border border-[#272B36] text-white font-semibold outline-none focus:border-[#FF5A00]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Remarks</label>
                <input
                  type="text"
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  placeholder="Details of the payment..."
                  className="w-full text-xs p-3 rounded-xl bg-[#0F1117] border border-[#272B36] text-white outline-none focus:border-[#FF5A00]"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3 bg-[#FF5A00] hover:bg-[#e04f00] text-white text-xs font-black rounded-xl uppercase transition-all shadow-lg shadow-[#FF5A00]/20"
              >
                {isProcessing ? "Saving..." : "Log Expense"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-[#161922] border border-[#272B36] p-6 rounded-2xl flex flex-col justify-center items-center text-center">
            <p className="text-white text-sm font-bold">Consolidated Expense Ledger</p>
            <p className="text-slate-400 text-xs mt-1 max-w-sm">All miscellaneous expenses recorded here are tied directly to vehicle operating cost sheets and general P&L summaries.</p>
          </div>
        </div>
      )}

      {/* Sub-tab 4: WORKSHOP LEDGER */}
      {activeSubTab === "workshop" && (
        <div className="bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-[#12141C] px-6 py-4 flex justify-between items-center border-b border-[#272B36]">
            <h3 className="text-sm font-black text-white uppercase tracking-wide">Workshop & Spares Billing Ledger</h3>
            <span className="text-xs font-semibold text-slate-400">{workshopBills.length} Bills</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#272B36] text-left text-xs whitespace-nowrap">
              <thead className="bg-[#0F1117] text-slate-400 uppercase font-black text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Bill Date</th>
                  <th className="px-5 py-3.5">Truck</th>
                  <th className="px-5 py-3.5">Vendor</th>
                  <th className="px-5 py-3.5">Description</th>
                  <th className="px-5 py-3.5 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#272B36] bg-[#161922]">
                {workshopBills.map((b) => (
                  <tr key={b.bill_id} className="hover:bg-[#1E222D] transition-colors">
                    <td className="px-5 py-3.5 text-slate-300">{formatDate(b.bill_date)}</td>
                    <td className="px-5 py-3.5 font-bold text-white">{b.trucks?.vehicle_number || "-"}</td>
                    <td className="px-5 py-3.5 text-slate-300 font-semibold">{b.vendor_name}</td>
                    <td className="px-5 py-3.5 text-slate-400">{b.service_description || "-"}</td>
                    <td className="px-5 py-3.5 text-right font-black text-rose-400">₹{(b.bill_amount || 0).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
                {workshopBills.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">No workshop bills recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
