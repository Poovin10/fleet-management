"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { TableToolbar } from "@/components/ui/TableToolbar";

export function AccountsModule() {
  const supabase = createClient();
  const [activeSubTab, setActiveSubTab] = useState<"advances" | "petty" | "workshop">("advances");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [drivers, setDrivers] = useState<any[]>([]);
  const [trucksList, setTrucksList] = useState<any[]>([]);
  const [recentAdvances, setRecentAdvances] = useState<any[]>([]);
  const [workshopBills, setWorkshopBills] = useState<any[]>([]);
  const [pettyExpenses, setPettyExpenses] = useState<any[]>([]);

  const [advancesSearch, setAdvancesSearch] = useState("");
  const [workshopSearch, setWorkshopSearch] = useState("");
  const [pettySearch, setPettySearch] = useState("");

  const [editAdvId, setEditAdvId] = useState<number | null>(null);
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
    if (!dateStr) return "-"; const [y, m, d] = dateStr.split("-"); return `${d}/${m}/${y}`;
  };

  async function fetchAccountsData() {
    setIsLoading(true);
    const [driversRes, trucksRes, advRes, billsRes] = await Promise.all([
      supabase.from("drivers").select("*").eq("is_active", true).order("full_name"),
      supabase.from("trucks").select("*").order("vehicle_number"),
      supabase.from("driver_direct_advances").select("*, drivers(full_name, driver_code)").order("advance_date", { ascending: false }).limit(200),
      supabase.from("workshop_spares_bills").select("*, trucks(vehicle_number)").order("bill_date", { ascending: false }).limit(400)
    ]);

    if (driversRes.data) setDrivers(driversRes.data);
    if (trucksRes.data) setTrucksList(trucksRes.data);
    if (advRes.data) setRecentAdvances(advRes.data);
    if (billsRes.data) {
      // Split bills into Petty (Tolls/RTO/Office) and Workshop based on category
      const pettyCategories = ["TOLL_FASTAG", "POLICE_RTO", "LOADING", "OFFICE"];
      setPettyExpenses(billsRes.data.filter((b: any) => pettyCategories.includes(b.vendor_name)));
      setWorkshopBills(billsRes.data.filter((b: any) => !pettyCategories.includes(b.vendor_name)));
    }
    setIsLoading(false);
  }

  const handleEditAdvance = (adv: any) => {
    setEditAdvId(adv.advance_id);
    setAdvDate(adv.advance_date);
    setAdvDriverId(String(adv.driver_id));
    setAdvAmount(adv.amount_inr);
    setAdvCategory(adv.advance_type);
    setAdvRef(adv.reference_remarks || "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleIssueAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advDriverId || Number(advAmount) <= 0) return alert("Invalid amount.");
    setIsProcessing(true);
    const payload = { advance_date: advDate, driver_id: Number(advDriverId), amount_inr: Number(advAmount), advance_type: advCategory, reference_remarks: advRef.trim() };
    
    let error;
    if (editAdvId) { const res = await supabase.from("driver_direct_advances").update(payload).eq("advance_id", editAdvId); error = res.error; }
    else { const res = await supabase.from("driver_direct_advances").insert([payload]); error = res.error; }
    
    setIsProcessing(false);
    if (error) alert("Failed: " + error.message);
    else { setEditAdvId(null); setAdvAmount(""); setAdvRef(""); fetchAccountsData(); }
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
      vendor_name: expCategory, service_description: expDescription.trim() || "Petty Expense", bill_amount: Number(expAmount) // Use amount or bypass if schema errors
    }]);
    setIsProcessing(false);
    if (error) alert("Failed: " + error.message);
    else { setExpAmount(""); setExpDescription(""); fetchAccountsData(); }
  };

  const filteredAdvances = recentAdvances.filter(a => (a.drivers?.full_name || "").toLowerCase().includes(advancesSearch.toLowerCase()) || (a.advance_type || "").toLowerCase().includes(advancesSearch.toLowerCase()));
  const exportAdvances = filteredAdvances.map(a => ({ "Date": formatDate(a.advance_date), "Driver": a.drivers?.full_name || "-", "Type": a.advance_type, "Amount (INR)": a.amount_inr, "Remarks": a.reference_remarks || "-" }));

  const filteredWorkshop = workshopBills.filter(b => (b.trucks?.vehicle_number || "").toLowerCase().includes(workshopSearch.toLowerCase()) || (b.vendor_name || "").toLowerCase().includes(workshopSearch.toLowerCase()) || (b.service_description || "").toLowerCase().includes(workshopSearch.toLowerCase()));
  const exportWorkshop = filteredWorkshop.map(b => ({ "Date": formatDate(b.bill_date), "Truck": b.trucks?.vehicle_number || "GENERAL", "Vendor": b.vendor_name, "Description": b.service_description, "Amount (INR)": b.bill_amount }));

  const filteredPetty = pettyExpenses.filter(b => (b.trucks?.vehicle_number || "").toLowerCase().includes(pettySearch.toLowerCase()) || (b.vendor_name || "").toLowerCase().includes(pettySearch.toLowerCase()) || (b.service_description || "").toLowerCase().includes(pettySearch.toLowerCase()));
  const exportPetty = filteredPetty.map(b => ({ "Date": formatDate(b.bill_date), "Truck": b.trucks?.vehicle_number || "GENERAL", "Category": b.vendor_name, "Description": b.service_description, "Amount (INR)": b.bill_amount }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#272B36] pb-4">
        <div><h2 className="text-xl font-black text-white uppercase tracking-tight">Finance & Accounts</h2><p className="text-xs text-slate-400 mt-0.5">Manage cash advances, petty cash, and workshop ledgers.</p></div>
        <div className="flex flex-wrap gap-2">
          {[{ id: "advances", label: "Driver Advances" }, { id: "petty", label: "Petty Expenses" }, { id: "workshop", label: "Workshop Ledger" }].map((tab) => (
            <button key={tab.id} onClick={() => setActiveSubTab(tab.id as any)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === tab.id ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/20" : "bg-[#161922] text-slate-400 hover:text-white hover:bg-[#1E222D] border border-[#272B36]"}`}>{tab.label}</button>
          ))}
        </div>
      </div>

      {activeSubTab === "advances" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-4 bg-[#161922] border border-[#272B36] rounded-2xl p-6 shadow-xl h-fit">
            <div className="flex justify-between items-center border-b border-[#272B36] pb-3 mb-5"><h3 className="text-sm font-black text-white uppercase tracking-wide">{editAdvId ? "Edit Advance" : "Issue Advance"}</h3>{editAdvId && <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded-lg uppercase tracking-widest animate-pulse">Editing</span>}</div>
            <form onSubmit={handleIssueAdvance} className="space-y-4">
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Advance Date *</label><input type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" required /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Driver *</label><select value={advDriverId} onChange={e => setAdvDriverId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-bold" required><option value="">-- SELECT --</option>{drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.driver_code} - {d.full_name}</option>)}</select></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₹) *</label><input type="number" min="1" max="500000" value={advAmount} onChange={e => setAdvAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] outline-none focus:border-[#FF5A00] font-black text-emerald-400" required /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category</label><select value={advCategory} onChange={e => setAdvCategory(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold"><option value="GENERAL_ADVANCE">GENERAL ADVANCE</option><option value="BATA_ADVANCE">BATA ADVANCE</option><option value="SALARY_ADVANCE">SALARY ADVANCE</option></select></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Remarks</label><input type="text" maxLength={60} value={advRef} onChange={e => setAdvRef(e.target.value.toUpperCase())} placeholder="OPTIONAL REF" className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold uppercase" /></div>
              <div className="flex gap-2">
                {editAdvId && <button type="button" onClick={() => {setEditAdvId(null); setAdvAmount(""); setAdvRef("");}} className="flex-1 py-3 bg-[#0F1117] text-slate-300 font-bold rounded-xl border border-[#272B36] hover:bg-[#272B36] transition-colors">Cancel</button>}
                <button type="submit" disabled={isProcessing} className="flex-[2] py-3 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-sm rounded-xl transition-all shadow-lg">{isProcessing ? "Processing..." : editAdvId ? "Update Advance" : "Log Advance"}</button>
              </div>
            </form>
          </div>
          <div className="lg:col-span-8 bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden flex flex-col shadow-xl">
            <TableToolbar title="Advance History" searchQuery={advancesSearch} setSearchQuery={setAdvancesSearch} exportData={exportAdvances} exportFilename="Driver_Advances" />
            <div className="overflow-x-auto flex-1 max-h-[600px] overflow-y-auto w-full">
              <table className="min-w-full divide-y divide-[#272B36] whitespace-nowrap text-xs">
                <thead className="bg-[#0F1117] sticky top-0 z-10"><tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider"><th className="px-5 py-3.5 text-left">Date</th><th className="px-5 py-3.5 text-left">Driver</th><th className="px-5 py-3.5 text-left">Ref</th><th className="px-5 py-3.5 text-right">Amount (₹)</th><th className="px-5 py-3.5 text-center">Action</th></tr></thead>
                <tbody className="divide-y divide-[#272B36] bg-[#161922]">
                  {filteredAdvances.map((adv) => (
                    <tr key={adv.advance_id} onClick={() => handleEditAdvance(adv)} className={`cursor-pointer transition-colors ${editAdvId === adv.advance_id ? 'bg-[#FF5A00]/10 border-l-2 border-l-[#FF5A00]' : 'hover:bg-[#1E222D] border-l-2 border-transparent'}`}>
                      <td className="px-5 py-3.5 font-semibold text-slate-300">{formatDate(adv.advance_date)}</td><td className="px-5 py-3.5 font-black text-white">{adv.drivers?.full_name}</td><td className="px-5 py-3.5 text-slate-300">{adv.advance_type}<br/><span className="text-[9px] text-slate-500">{adv.reference_remarks || "-"}</span></td><td className="px-5 py-3.5 text-right font-black text-emerald-400">₹{(adv.amount_inr || 0).toLocaleString("en-IN")}</td><td className="px-5 py-3.5 text-center"><button onClick={(e) => {e.stopPropagation(); handleDeleteAdvance(adv.advance_id);}} className="text-rose-500 hover:text-white bg-rose-950/40 px-3 py-1 rounded text-xs font-bold transition-colors">Del</button></td>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-4 bg-[#161922] border border-[#272B36] p-6 rounded-2xl shadow-xl h-fit">
            <h3 className="text-sm font-black text-white uppercase tracking-wide border-b border-[#272B36] pb-3 mb-5">Record Petty Expense</h3>
            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Expense Type</label><select value={expCategory} onChange={e => setExpCategory(e.target.value)} className="w-full text-xs p-3 rounded-xl bg-[#0F1117] border border-[#272B36] text-white font-bold outline-none focus:border-[#FF5A00]"><option value="TOLL_FASTAG">TOLL / FASTAG</option><option value="POLICE_RTO">RTO / PERMITS</option><option value="LOADING">HAMALI / LOADING</option><option value="OFFICE">OFFICE MISC</option></select></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Truck (Optional)</label><select value={expVehicleId} onChange={e => setExpVehicleId(e.target.value)} className="w-full text-xs p-3 rounded-xl bg-[#0F1117] border border-[#272B36] text-white font-bold outline-none focus:border-[#FF5A00]"><option value="">-- GENERAL --</option>{trucksList.map(t => <option key={t.id} value={t.id}>{t.vehicle_number}</option>)}</select></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Amount (₹) *</label><input type="number" min="1" max="100000" value={expAmount} onChange={e => setExpAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-xs p-3 rounded-xl bg-[#0F1117] border border-[#272B36] text-[#FF5A00] font-black outline-none focus:border-[#FF5A00]" required /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Remarks</label><input type="text" maxLength={60} value={expDescription} onChange={e => setExpDescription(e.target.value.toUpperCase())} className="w-full text-xs p-3 rounded-xl bg-[#0F1117] border border-[#272B36] text-white outline-none focus:border-[#FF5A00] uppercase" /></div>
              <button type="submit" disabled={isProcessing} className="w-full py-3 bg-[#FF5A00] hover:bg-[#e04f00] text-white text-xs font-black rounded-xl uppercase transition-all shadow-lg">{isProcessing ? "Saving..." : "Log Expense"}</button>
            </form>
          </div>
          <div className="lg:col-span-8 bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden flex flex-col shadow-xl">
            <TableToolbar title="Petty Expense Ledger" searchQuery={pettySearch} setSearchQuery={setPettySearch} exportData={exportPetty} exportFilename="Petty_Expenses" />
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="min-w-full divide-y divide-[#272B36] text-left text-xs whitespace-nowrap"><thead className="bg-[#0F1117] sticky top-0 text-slate-400 uppercase font-black text-[10px] tracking-wider z-10"><tr><th className="px-5 py-3.5">Date</th><th className="px-5 py-3.5">Category</th><th className="px-5 py-3.5">Truck</th><th className="px-5 py-3.5">Description</th><th className="px-5 py-3.5 text-right">Amount (₹)</th></tr></thead>
              <tbody className="divide-y divide-[#272B36] bg-[#161922]">{filteredPetty.map(b => (<tr key={b.bill_id} className="hover:bg-[#1E222D]"><td className="px-5 py-3.5 text-slate-300">{formatDate(b.bill_date)}</td><td className="px-5 py-3.5 text-white font-bold">{b.vendor_name}</td><td className="px-5 py-3.5 font-bold text-slate-400">{b.trucks?.vehicle_number || "-"}</td><td className="px-5 py-3.5 text-slate-400">{b.service_description || "-"}</td><td className="px-5 py-3.5 text-right font-black text-[#FF5A00]">₹{(b.bill_amount || 0).toLocaleString("en-IN")}</td></tr>))}
              {filteredPetty.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-medium">No petty expenses recorded.</td></tr>}</tbody></table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "workshop" && (
        <div className="bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden shadow-xl animate-in fade-in">
          <TableToolbar title="Workshop Ledger" searchQuery={workshopSearch} setSearchQuery={setWorkshopSearch} exportData={exportWorkshop} exportFilename="Workshop_Ledger" />
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full divide-y divide-[#272B36] text-left text-xs whitespace-nowrap">
              <thead className="bg-[#0F1117] sticky top-0 text-slate-400 uppercase font-black text-[10px] tracking-wider z-10"><tr><th className="px-5 py-3.5">Bill Date</th><th className="px-5 py-3.5">Truck</th><th className="px-5 py-3.5">Vendor</th><th className="px-5 py-3.5">Description</th><th className="px-5 py-3.5 text-right">Amount (₹)</th></tr></thead>
              <tbody className="divide-y divide-[#272B36] bg-[#161922]">
                {filteredWorkshop.map((b) => (
                  <tr key={b.bill_id} className="hover:bg-[#1E222D]"><td className="px-5 py-3.5 text-slate-300">{formatDate(b.bill_date)}</td><td className="px-5 py-3.5 font-bold text-white">{b.trucks?.vehicle_number || "-"}</td><td className="px-5 py-3.5 text-slate-300 font-semibold">{b.vendor_name}</td><td className="px-5 py-3.5 text-slate-400">{b.service_description || "-"}</td><td className="px-5 py-3.5 text-right font-black text-rose-400">₹{(b.bill_amount || 0).toLocaleString("en-IN")}</td></tr>
                ))}
                {filteredWorkshop.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-medium">No workshop bills match your search.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
