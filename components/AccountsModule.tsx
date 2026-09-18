"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { TableToolbar } from "@/components/ui/TableToolbar";

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

  // Search States
  const [settlementSearch, setSettlementSearch] = useState("");
  const [advancesSearch, setAdvancesSearch] = useState("");
  const [workshopSearch, setWorkshopSearch] = useState("");

  // Form States (With Strict Types)
  const [advDate, setAdvDate] = useState(new Date().toISOString().split("T")[0]);
  const [advDriverId, setAdvDriverId] = useState("");
  const [advAmount, setAdvAmount] = useState<number | "">("");
  const [advCategory, setAdvCategory] = useState("GENERAL_ADVANCE");
  const [advRef, setAdvRef] = useState("");

  const [expCategory, setExpCategory] = useState("TOLL_FASTAG");
  const [expAmount, setExpAmount] = useState<number | "">("");
  const [expVehicleId, setExpVehicleId] = useState("");
  const [expDate, setExpDate] = useState(new Date().toISOString().split("T")[0]);
  const [expDescription, setExpDescription] = useState("");

  useEffect(() => { fetchAccountsData(); }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  async function fetchAccountsData() {
    setIsLoading(true);
    const [tripsRes, driversRes, trucksRes, advRes, billsRes] = await Promise.all([
      supabase.from("trips").select("*, trucks(vehicle_number), drivers(full_name, driver_code)").order("trip_id", { ascending: false }).limit(200),
      supabase.from("drivers").select("*").eq("is_active", true).order("full_name"),
      supabase.from("trucks").select("*").order("vehicle_number"),
      supabase.from("driver_direct_advances").select("*, drivers(full_name, driver_code)").order("advance_date", { ascending: false }).limit(200),
      supabase.from("workshop_spares_bills").select("*, trucks(vehicle_number)").order("bill_date", { ascending: false }).limit(200)
    ]);

    if (tripsRes.data) setTrips(tripsRes.data);
    if (driversRes.data) setDrivers(driversRes.data);
    if (trucksRes.data) setTrucksList(trucksRes.data);
    if (advRes.data) setRecentAdvances(advRes.data);
    if (billsRes.data) setWorkshopBills(billsRes.data);
    setIsLoading(false);
  }

  // --- STRICT HANDLERS ---
  const handleIssueAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advDriverId || Number(advAmount) <= 0) return alert("Invalid amount.");
    setIsProcessing(true);
    const { error } = await supabase.from("driver_direct_advances").insert([{
      advance_date: advDate, driver_id: Number(advDriverId), amount_inr: Number(advAmount),
      advance_type: advCategory, reference_remarks: advRef.trim()
    }]);
    setIsProcessing(false);
    if (error) alert("Failed: " + error.message);
    else { setAdvAmount(""); setAdvRef(""); fetchAccountsData(); }
  };

  const handleDeleteAdvance = async (id: string | number) => {
    if (!confirm("Delete this advance record? This cannot be undone.")) return;
    setIsProcessing(true);
    const { error } = await supabase.from("driver_direct_advances").delete().eq("advance_id", id);
    setIsProcessing(false);
    if (error) alert("Error: " + error.message); else fetchAccountsData();
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expAmount || Number(expAmount) <= 0) return alert("Invalid amount.");
    setIsProcessing(true);
    const { error } = await supabase.from("workshop_spares_bills").insert([{
      bill_date: expDate, vehicle_id: expVehicleId ? Number(expVehicleId) : null,
      vendor_name: expCategory, service_description: expDescription.trim() || "Petty Expense", bill_amount: Number(expAmount)
    }]);
    setIsProcessing(false);
    if (error) alert("Failed: " + error.message);
    else { setExpAmount(""); setExpDescription(""); fetchAccountsData(); }
  };

  // --- FILTER & EXPORT LOGIC ---
  const filteredTrips = trips.filter(t => 
    (t.lr_number || "").toLowerCase().includes(settlementSearch.toLowerCase()) ||
    (t.trucks?.vehicle_number || "").toLowerCase().includes(settlementSearch.toLowerCase()) ||
    (t.drivers?.full_name || "").toLowerCase().includes(settlementSearch.toLowerCase())
  );
  
  const exportTrips = filteredTrips.map(t => ({
    "Trip/LR": t.lr_number || `TRIP-${t.trip_id}`,
    "Truck": t.trucks?.vehicle_number || "-",
    "Driver": t.drivers?.full_name || "-",
    "Freight": t.freight_amount || 0,
    "Advance": t.advance_amount || 0,
    "Bata": t.driver_bata || 0,
    "Status": t.status || "IN_TRANSIT"
  }));

  const filteredAdvances = recentAdvances.filter(a => 
    (a.drivers?.full_name || "").toLowerCase().includes(advancesSearch.toLowerCase()) ||
    (a.advance_type || "").toLowerCase().includes(advancesSearch.toLowerCase())
  );

  const exportAdvances = filteredAdvances.map(a => ({
    "Date": formatDate(a.advance_date),
    "Driver": a.drivers?.full_name || "-",
    "Type": a.advance_type,
    "Amount (INR)": a.amount_inr,
    "Remarks": a.reference_remarks || "-"
  }));

  const filteredBills = workshopBills.filter(b => 
    (b.trucks?.vehicle_number || "").toLowerCase().includes(workshopSearch.toLowerCase()) ||
    (b.vendor_name || "").toLowerCase().includes(workshopSearch.toLowerCase()) ||
    (b.service_description || "").toLowerCase().includes(workshopSearch.toLowerCase())
  );

  const exportBills = filteredBills.map(b => ({
    "Date": formatDate(b.bill_date),
    "Truck": b.trucks?.vehicle_number || "GENERAL",
    "Vendor/Category": b.vendor_name,
    "Description": b.service_description,
    "Amount (INR)": b.bill_amount
  }));

  return (
    <div className="space-y-6">
      {/* Header & Sub-Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#272B36] pb-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Finance & Accounts</h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage trip settlements, cash advances, petty cash, and ledger exports.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "settlement", label: "📊 Trip Settlements" },
            { id: "advances", label: "💵 Driver Advances" },
            { id: "petty", label: "🧾 Petty Expenses" },
            { id: "workshop", label: "🔧 Workshop Ledger" }
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveSubTab(tab.id as any)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === tab.id ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/20" : "bg-[#161922] text-slate-400 hover:text-white hover:bg-[#1E222D] border border-[#272B36]"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeSubTab === "settlement" && (
        <div className="bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden shadow-xl animate-in fade-in">
          <TableToolbar title="Trip Settlement Queue" searchQuery={settlementSearch} setSearchQuery={setSettlementSearch} exportData={exportTrips} exportFilename="Trip_Settlements" />
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full divide-y divide-[#272B36] text-left text-xs whitespace-nowrap">
              <thead className="bg-[#0F1117] sticky top-0 text-slate-400 uppercase font-black text-[10px] tracking-wider z-10">
                <tr>
                  <th className="px-5 py-3.5">LR / Trip #</th>
                  <th className="px-5 py-3.5">Truck</th>
                  <th className="px-5 py-3.5">Driver</th>
                  <th className="px-5 py-3.5 text-right">Freight (₹)</th>
                  <th className="px-5 py-3.5 text-right">Advance (₹)</th>
                  <th className="px-5 py-3.5 text-right">Driver Bata (₹)</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#272B36] bg-[#161922]">
                {filteredTrips.map((t) => (
                  <tr key={t.trip_id} className="hover:bg-[#1E222D] transition-colors">
                    <td className="px-5 py-4 font-black text-white">{t.lr_number || `TRIP-${t.trip_id}`}</td>
                    <td className="px-5 py-4 font-bold text-slate-300">{t.trucks?.vehicle_number || "-"}</td>
                    <td className="px-5 py-4 font-semibold text-slate-300">{t.drivers?.full_name || "-"}</td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-300">₹{(Number(t.freight_amount)||0).toLocaleString("en-IN")}</td>
                    <td className="px-5 py-4 text-right font-semibold text-amber-400">₹{(Number(t.advance_amount)||0).toLocaleString("en-IN")}</td>
                    <td className="px-5 py-4 text-right font-semibold text-emerald-400">₹{(Number(t.driver_bata)||0).toLocaleString("en-IN")}</td>
                    <td className="px-5 py-4 text-center"><span className="px-2 py-1 rounded bg-[#0F1117] text-[#FF5A00] border border-[#272B36] text-[9px] font-black">{t.status || "TRANSIT"}</span></td>
                  </tr>
                ))}
                {filteredTrips.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500 font-medium">No records match your search.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === "advances" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-4 bg-[#161922] border border-[#272B36] rounded-2xl p-6 shadow-xl h-fit">
            <h3 className="text-sm font-black text-white uppercase tracking-wide border-b border-[#272B36] pb-3 mb-5">Issue Advance</h3>
            <form onSubmit={handleIssueAdvance} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Driver *</label>
                <select value={advDriverId} onChange={(e) => setAdvDriverId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-bold" required>
                  <option value="">-- SELECT --</option>
                  {drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.driver_code} - {d.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₹) *</label>
                <input type="number" min="1" max="500000" value={advAmount} onChange={(e) => setAdvAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] outline-none focus:border-[#FF5A00] font-black text-emerald-400" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</label>
                <select value={advCategory} onChange={(e) => setAdvCategory(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold">
                  <option value="GENERAL_ADVANCE">GENERAL ADVANCE</option>
                  <option value="BATA_ADVANCE">BATA ADVANCE</option>
                  <option value="SALARY_ADVANCE">SALARY ADVANCE</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Remarks</label>
                <input type="text" maxLength={60} value={advRef} onChange={(e) => setAdvRef(e.target.value.toUpperCase())} placeholder="OPTIONAL REF" className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold uppercase" />
              </div>
              <button type="submit" disabled={isProcessing} className="w-full py-3 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-sm rounded-xl transition-all shadow-lg">{isProcessing ? "Processing..." : "Log Advance"}</button>
            </form>
          </div>
          <div className="lg:col-span-8 bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden flex flex-col shadow-xl">
            <TableToolbar title="Advance History" searchQuery={advancesSearch} setSearchQuery={setAdvancesSearch} exportData={exportAdvances} exportFilename="Driver_Advances" />
            <div className="overflow-x-auto flex-1 max-h-[600px] overflow-y-auto w-full">
              <table className="min-w-full divide-y divide-[#272B36] whitespace-nowrap text-xs">
                <thead className="bg-[#0F1117] sticky top-0 z-10"><tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider"><th className="px-5 py-3.5 text-left">Date</th><th className="px-5 py-3.5 text-left">Driver</th><th className="px-5 py-3.5 text-left">Ref</th><th className="px-5 py-3.5 text-right">Amount (₹)</th><th className="px-5 py-3.5 text-center">Action</th></tr></thead>
                <tbody className="divide-y divide-[#272B36] bg-[#161922]">
                  {filteredAdvances.map((adv) => (
                    <tr key={adv.advance_id} className="hover:bg-[#1E222D]">
                      <td className="px-5 py-3.5 font-semibold text-slate-300">{formatDate(adv.advance_date)}</td>
                      <td className="px-5 py-3.5 font-black text-white">{adv.drivers?.full_name}</td>
                      <td className="px-5 py-3.5 text-slate-300">{adv.advance_type}<br/><span className="text-[9px] text-slate-500">{adv.reference_remarks || "-"}</span></td>
                      <td className="px-5 py-3.5 text-right font-black text-emerald-400">₹{(adv.amount_inr || 0).toLocaleString("en-IN")}</td>
                      <td className="px-5 py-3.5 text-center"><button onClick={() => handleDeleteAdvance(adv.advance_id)} className="text-rose-500 hover:text-white bg-rose-950/40 px-2 py-1 rounded text-xs font-bold">Del</button></td>
                    </tr>
                  ))}
                  {filteredAdvances.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-medium">No records match.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "petty" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#161922] border border-[#272B36] p-6 rounded-2xl shadow-xl">
            <h3 className="text-sm font-black text-white uppercase tracking-wide border-b border-[#272B36] pb-3 mb-5">Record Petty Expense</h3>
            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Expense Type</label><select value={expCategory} onChange={(e) => setExpCategory(e.target.value)} className="w-full text-xs p-3 rounded-xl bg-[#0F1117] border border-[#272B36] text-white font-bold outline-none focus:border-[#FF5A00]"><option value="TOLL_FASTAG">TOLL / FASTAG</option><option value="POLICE_RTO">RTO / PERMITS</option><option value="LOADING">HAMALI / LOADING</option><option value="OFFICE">OFFICE MISC</option></select></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Truck (Optional)</label><select value={expVehicleId} onChange={(e) => setExpVehicleId(e.target.value)} className="w-full text-xs p-3 rounded-xl bg-[#0F1117] border border-[#272B36] text-white font-bold outline-none focus:border-[#FF5A00]"><option value="">-- GENERAL --</option>{trucksList.map(t => <option key={t.id} value={t.id}>{t.vehicle_number}</option>)}</select></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₹) *</label><input type="number" min="1" max="100000" value={expAmount} onChange={(e) => setExpAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-xs p-3 rounded-xl bg-[#0F1117] border border-[#272B36] text-[#FF5A00] font-black outline-none focus:border-[#FF5A00]" required /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Remarks</label><input type="text" maxLength={60} value={expDescription} onChange={(e) => setExpDescription(e.target.value.toUpperCase())} className="w-full text-xs p-3 rounded-xl bg-[#0F1117] border border-[#272B36] text-white outline-none focus:border-[#FF5A00] uppercase" /></div>
              <button type="submit" disabled={isProcessing} className="w-full py-3 bg-[#FF5A00] hover:bg-[#e04f00] text-white text-xs font-black rounded-xl uppercase transition-all shadow-lg">{isProcessing ? "Saving..." : "Log Expense"}</button>
            </form>
          </div>
        </div>
      )}

      {activeSubTab === "workshop" && (
        <div className="bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden shadow-xl animate-in fade-in">
          <TableToolbar title="Workshop Ledger" searchQuery={workshopSearch} setSearchQuery={setWorkshopSearch} exportData={exportBills} exportFilename="Workshop_Ledger" />
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full divide-y divide-[#272B36] text-left text-xs whitespace-nowrap">
              <thead className="bg-[#0F1117] sticky top-0 text-slate-400 uppercase font-black text-[10px] tracking-wider z-10">
                <tr><th className="px-5 py-3.5">Bill Date</th><th className="px-5 py-3.5">Truck</th><th className="px-5 py-3.5">Vendor</th><th className="px-5 py-3.5">Description</th><th className="px-5 py-3.5 text-right">Amount (₹)</th></tr>
              </thead>
              <tbody className="divide-y divide-[#272B36] bg-[#161922]">
                {filteredBills.map((b) => (
                  <tr key={b.bill_id} className="hover:bg-[#1E222D]">
                    <td className="px-5 py-3.5 text-slate-300">{formatDate(b.bill_date)}</td>
                    <td className="px-5 py-3.5 font-bold text-white">{b.trucks?.vehicle_number || "-"}</td>
                    <td className="px-5 py-3.5 text-slate-300 font-semibold">{b.vendor_name}</td>
                    <td className="px-5 py-3.5 text-slate-400">{b.service_description || "-"}</td>
                    <td className="px-5 py-3.5 text-right font-black text-rose-400">₹{(b.bill_amount || 0).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
                {filteredBills.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-medium">No workshop bills match your search.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
