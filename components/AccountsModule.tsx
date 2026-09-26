"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function AccountsModule() {
 const supabase = createClient();
 const [activeSubTab, setActiveSubTab] = useState<"advances" | "petty">("advances");
 const [isLoading, setIsLoading] = useState(false);
 const [isProcessing, setIsProcessing] = useState(false);

 const [drivers, setDrivers] = useState<any[]>([]);
 const [trucksList, setTrucksList] = useState<any[]>([]);


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

   const [driversRes, trucksRes] = await Promise.all([
     supabase.from("drivers").select("*").eq("is_active", true).order("full_name"),
     supabase.from("vehicles").select("*").order("vehicle_number"),
   ]);

   if (driversRes.data) setDrivers(driversRes.data);
   if (trucksRes.data) setTrucksList(trucksRes.data);

   setIsLoading(false);
 }

 const handleIssueAdvance = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!advDriverId || Number(advAmount) <= 0) return alert("Invalid amount.");
 setIsProcessing(true);

 const payload = {
   advance_date: advDate,
   driver_id: Number(advDriverId),
   amount_inr: Number(advAmount),
   advance_type: advCategory,
   reference_remarks: advRef.trim(),
 };

 let error;

 {
   const res = await supabase.rpc("save_driver_advance_atomic", {
     p_advance_date: payload.advance_date,
     p_driver_id: payload.driver_id,
     p_amount_inr: payload.amount_inr,
     p_advance_type: payload.advance_type,
     p_payment_mode: "CASH",
     p_reference_remarks: payload.reference_remarks,
   });
   error = res.error;
 }

 setIsProcessing(false);

 if (error) alert("Failed: " + error.message);
 else {
   setAdvAmount("");
   setAdvRef("");
   fetchAccountsData();
 }
 };


 const handleCreateExpense = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!expAmount || Number(expAmount) <= 0) return alert("Invalid amount.");

 setIsProcessing(true);

 const { error } = await supabase.rpc("create_workshop_bill_atomic", {
   p_bill_date: expDate,
   p_vehicle_id: expVehicleId ? Number(expVehicleId) : null,
   p_vendor_name: expCategory,
   p_invoice_number: null,
   p_spare_parts_details: expDescription.trim() || "Petty Expense",
   p_total_bill_amount: Number(expAmount),
 });

 setIsProcessing(false);

 if (error) alert("Failed: " + error.message);
 else {
   setExpAmount("");
   setExpDescription("");
   fetchAccountsData();
 }
 };


 return (
 <div className="animate-tab-focus space-y-6 animate-in fade-in duration-300">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
 <div><h2 className="text-xl font-semibold text-fg tracking-tight">Finance & Accounts</h2><p className="text-xs text-fg/60 mt-0.5">Record driver advances and petty expenses. Historical records are available in Reports.</p></div>
 <div className="flex flex-wrap gap-2">
 {[{ id: "advances", label: "Driver Advances" }, { id: "petty", label: "Petty Expenses" }, { id: "workshop", label: "Workshop Ledger" }].map((tab) => (
 <Button key={tab.id} type="button" onClick={() => setActiveSubTab(tab.id as any)} variant={activeSubTab === tab.id ? "default" : "glass"} size="sm">{tab.label}</Button>
 ))}
 </div>
 </div>

 {activeSubTab === "advances" && (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
 <div className="lg:col-span-4 liquid-glass p-6 shadow-xl h-fit">
 <div className="border-b border-border pb-3 mb-5"><h3 className="text-sm font-semibold text-fg tracking-wide">Issue Advance</h3></div>
 <form onSubmit={handleIssueAdvance} className="space-y-4">
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Advance Date *</label><input type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} className="input-glass text-fg outline-none focus:border-accent font-semibold" required /></div>
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Driver *</label><select value={advDriverId} onChange={e => setAdvDriverId(e.target.value)} className="input-glass text-fg outline-none focus:border-accent font-bold" required><option value="">-- SELECT --</option>{drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.driver_code} - {d.full_name}</option>)}</select></div>
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Amount () *</label><input type="number" min="1" max="500000" value={advAmount} onChange={e => setAdvAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} className="input-glass outline-none focus:border-accent font-semibold text-success" required /></div>
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Category</label><select value={advCategory} onChange={e => setAdvCategory(e.target.value)} className="input-glass text-fg outline-none focus:border-accent font-semibold"><option value="GENERAL_ADVANCE">GENERAL ADVANCE</option><option value="BATA_ADVANCE">BATA ADVANCE</option><option value="SALARY_ADVANCE">SALARY ADVANCE</option></select></div>
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Remarks</label><input type="text" maxLength={60} value={advRef} onChange={e => setAdvRef(e.target.value.toUpperCase())} placeholder="OPTIONAL REF" className="input-glass text-fg outline-none focus:border-accent font-semibold " /></div>
 <div className="flex gap-2">
 
 <Button type="submit" variant="default" size="lg" disabled={isProcessing} className="flex-[2]">{isProcessing ? "Processing..." : "Log Advance"}</Button>
 </div>
 </form>
 </div>
 <div className="lg:col-span-8 liquid-glass p-6 shadow-xl flex items-center justify-center min-h-[260px]">
   <div className="text-center max-w-md">
     <div className="text-sm font-semibold text-fg">Advance entry ready</div>
     <p className="mt-2 text-xs text-fg-muted leading-5">
       New driver advances are recorded here. Historical advances, filtering and exports are handled centrally from Reports.
     </p>
   </div>
 </div>
 </div>
 )}

 {activeSubTab === "petty" && (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
 <div className="lg:col-span-4 liquid-glass p-6 rounded-2xl shadow-xl h-fit">
 <h3 className="text-sm font-semibold text-fg  tracking-wide border-b border-border pb-3 mb-5">Record Petty Expense</h3>
 <form onSubmit={handleCreateExpense} className="space-y-4">
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Expense Type</label><select value={expCategory} onChange={e => setExpCategory(e.target.value)} className="w-full text-xs p-3 rounded-xl input-glass"><option value="TOLL_FASTAG">TOLL / FASTAG</option><option value="POLICE_RTO">RTO / PERMITS</option><option value="LOADING">HAMALI / LOADING</option><option value="OFFICE">OFFICE MISC</option></select></div>
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Truck (Optional)</label><select value={expVehicleId} onChange={e => setExpVehicleId(e.target.value)} className="w-full text-xs p-3 rounded-xl input-glass"><option value="">-- GENERAL --</option>{trucksList.map(t => <option key={t.vehicle_id} value={t.vehicle_id}>{t.vehicle_number}</option>)}</select></div>
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Amount () *</label><input type="number" min="1" max="100000" value={expAmount} onChange={e => setExpAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-xs p-3 rounded-xl input-glass" required /></div>
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Remarks</label><input type="text" maxLength={60} value={expDescription} onChange={e => setExpDescription(e.target.value.toUpperCase())} className="w-full text-xs p-3 rounded-xl input-glass" /></div>
 <Button type="submit" variant="default" size="lg" disabled={isProcessing} className="w-full">{isProcessing ? "Saving..." : "Log Expense"}</Button>
 </form>
 </div>
 <div className="lg:col-span-8 liquid-glass p-6 shadow-xl flex items-center justify-center min-h-[260px]">
   <div className="text-center max-w-md">
     <div className="text-sm font-semibold text-fg">Petty expense entry ready</div>
     <p className="mt-2 text-xs text-fg-muted leading-5">
       New expenses are recorded here. Historical expenses, filtering and exports are handled centrally from Reports.
     </p>
   </div>
 </div>
 </div>
 )}

 </div>
 );
}
