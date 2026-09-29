"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function AccountsModule() {
 const supabase = createClient();
 const [isEntryOpen, setIsEntryOpen] = useState(false);
 const [selectedEntry, setSelectedEntry] = useState<"advance" | "petty-expense" | null>(null);
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
     supabase.from("vehicles").select("*").eq("is_active", true).order("vehicle_number"),
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
   setIsEntryOpen(false);
   setSelectedEntry(null);
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
   setIsEntryOpen(false);
   setSelectedEntry(null);
   fetchAccountsData();
 }
 };


 return (
 <div className="animate-tab-focus mx-auto w-full max-w-5xl space-y-6 animate-in fade-in duration-300">
   <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
     <div>
       <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Finance workspace</p>
       <h2 className="mt-1 text-2xl font-semibold tracking-tight text-fg">Accounts</h2>
       <p className="mt-1 max-w-xl text-sm text-fg-muted">Create supported advance and petty expense entries. Historical records and exports are available in Reports.</p>
     </div>
     <Button type="button" variant="default" size="lg" onClick={() => { setSelectedEntry(null); setIsEntryOpen(true); }} className="w-full sm:w-auto">
       + New Entry
     </Button>
   </header>

   <section aria-labelledby="accounts-entry-types" className="space-y-3">
     <div>
       <h3 id="accounts-entry-types" className="text-sm font-semibold text-fg">Available entries</h3>
       <p className="mt-1 text-xs text-fg-muted">Choose one of the transaction types currently supported here.</p>
     </div>
     <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
       <button type="button" onClick={() => { setSelectedEntry("advance"); setIsEntryOpen(true); }} className="liquid-glass rounded-2xl border border-border p-5 text-left transition hover:border-accent/40 hover:bg-surface-elevated/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
         <span className="text-xs font-bold uppercase tracking-wider text-accent">Advance</span>
         <span className="mt-2 block text-base font-semibold text-fg">Driver Advance</span>
         <span className="mt-1 block text-xs leading-5 text-fg-muted">Record a direct advance for a driver.</span>
       </button>
       <button type="button" onClick={() => { setSelectedEntry("petty-expense"); setIsEntryOpen(true); }} className="liquid-glass rounded-2xl border border-border p-5 text-left transition hover:border-accent/40 hover:bg-surface-elevated/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
         <span className="text-xs font-bold uppercase tracking-wider text-accent">Expense</span>
         <span className="mt-2 block text-base font-semibold text-fg">Petty Expense</span>
         <span className="mt-1 block text-xs leading-5 text-fg-muted">Record an expense using the existing petty expense workflow.</span>
       </button>
     </div>
   </section>

   <div className="liquid-glass flex flex-col gap-3 rounded-2xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
     <div>
       <h3 className="text-sm font-semibold text-fg">Need a different transaction?</h3>
       <p className="mt-1 text-xs text-fg-muted">Fuel, workshop, trip and settlement actions stay in their operational modules. Historical financial records are in Reports.</p>
     </div>
   </div>

   {isEntryOpen && (
     <div className="kss-glass-overlay z-[100] flex items-center justify-center p-3 sm:p-5" onClick={() => { if (!isProcessing) { setIsEntryOpen(false); setSelectedEntry(null); } }}>
       <section role="dialog" aria-modal="true" aria-labelledby="accounts-entry-title" className="kss-glass-sheet w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-border p-5 shadow-2xl sm:p-7" onClick={event => event.stopPropagation()}>
         <div className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-4">
           <div>
             <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">Accounts · New Entry</p>
             <h3 id="accounts-entry-title" className="mt-1 text-lg font-semibold text-fg">
               {selectedEntry === "advance" ? "Driver Advance" : selectedEntry === "petty-expense" ? "Petty Expense" : "Choose Transaction"}
             </h3>
             <p className="mt-1 text-xs text-fg-muted">{selectedEntry ? "Complete the entry details below." : "Select a supported transaction type to continue."}</p>
           </div>
           <Button type="button" variant="glass" size="sm" onClick={() => { setIsEntryOpen(false); setSelectedEntry(null); }} disabled={isProcessing} aria-label="Close entry">Close</Button>
         </div>

         {!selectedEntry && (
           <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
             <button type="button" onClick={() => setSelectedEntry("advance")} className="rounded-2xl border border-border bg-surface/60 p-5 text-left transition hover:border-accent/40 hover:bg-surface-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
               <span className="text-xs font-bold uppercase tracking-wider text-accent">Advance</span>
               <span className="mt-2 block text-base font-semibold text-fg">Driver Advance</span>
               <span className="mt-1 block text-xs leading-5 text-fg-muted">Record a direct driver advance.</span>
             </button>
             <button type="button" onClick={() => setSelectedEntry("petty-expense")} className="rounded-2xl border border-border bg-surface/60 p-5 text-left transition hover:border-accent/40 hover:bg-surface-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
               <span className="text-xs font-bold uppercase tracking-wider text-accent">Expense</span>
               <span className="mt-2 block text-base font-semibold text-fg">Petty Expense</span>
               <span className="mt-1 block text-xs leading-5 text-fg-muted">Record a petty expense.</span>
             </button>
           </div>
         )}

         {selectedEntry === "advance" && (
           <form onSubmit={handleIssueAdvance} className="space-y-4">
             <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
               <div><label className="mb-1 block text-[10px] font-bold text-fg/60">Advance Date *</label><input type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} className="input-glass w-full text-fg outline-none focus:border-accent font-semibold" required /></div>
               <div><label className="mb-1 block text-[10px] font-bold text-fg/60">Driver *</label><select value={advDriverId} onChange={e => setAdvDriverId(e.target.value)} className="input-glass w-full text-fg outline-none focus:border-accent font-bold" required><option value="">-- SELECT --</option>{drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.driver_code} - {d.full_name}</option>)}</select></div>
               <div><label className="mb-1 block text-[10px] font-bold text-fg/60">Amount () *</label><input type="number" min="1" max="500000" value={advAmount} onChange={e => setAdvAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} className="input-glass w-full outline-none focus:border-accent font-semibold text-success" required /></div>
               <div><label className="mb-1 block text-[10px] font-bold text-fg/60">Category</label><select value={advCategory} onChange={e => setAdvCategory(e.target.value)} className="input-glass w-full text-fg outline-none focus:border-accent font-semibold"><option value="GENERAL_ADVANCE">GENERAL ADVANCE</option><option value="BATA_ADVANCE">BATA ADVANCE</option><option value="SALARY_ADVANCE">SALARY ADVANCE</option></select></div>
             </div>
             <div><label className="mb-1 block text-[10px] font-bold text-fg/60">Remarks</label><input type="text" maxLength={60} value={advRef} onChange={e => setAdvRef(e.target.value.toUpperCase())} placeholder="OPTIONAL REF" className="input-glass w-full text-fg outline-none focus:border-accent font-semibold" /></div>
             <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
               <Button type="button" variant="glass" onClick={() => setSelectedEntry(null)} disabled={isProcessing}>Back</Button>
               <Button type="submit" variant="default" size="lg" disabled={isProcessing}>{isProcessing ? "Processing..." : "Log Advance"}</Button>
             </div>
           </form>
         )}

         {selectedEntry === "petty-expense" && (
           <form onSubmit={handleCreateExpense} className="space-y-4">
             <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
               <div><label className="mb-1 block text-[10px] font-bold text-fg/60">Expense Type</label><select value={expCategory} onChange={e => setExpCategory(e.target.value)} className="input-glass w-full text-xs"><option value="TOLL_FASTAG">TOLL / FASTAG</option><option value="POLICE_RTO">RTO / PERMITS</option><option value="LOADING">HAMALI / LOADING</option><option value="OFFICE">OFFICE MISC</option></select></div>
               <div><label className="mb-1 block text-[10px] font-bold text-fg/60">Truck (Optional)</label><select value={expVehicleId} onChange={e => setExpVehicleId(e.target.value)} className="input-glass w-full text-xs"><option value="">-- GENERAL --</option>{trucksList.map(t => <option key={t.vehicle_id} value={t.vehicle_id}>{t.vehicle_number}</option>)}</select></div>
               <div><label className="mb-1 block text-[10px] font-bold text-fg/60">Amount () *</label><input type="number" min="1" max="100000" value={expAmount} onChange={e => setExpAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} className="input-glass w-full text-xs" required /></div>
               <div><label className="mb-1 block text-[10px] font-bold text-fg/60">Remarks</label><input type="text" maxLength={60} value={expDescription} onChange={e => setExpDescription(e.target.value.toUpperCase())} className="input-glass w-full text-xs" /></div>
             </div>
             <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
               <Button type="button" variant="glass" onClick={() => setSelectedEntry(null)} disabled={isProcessing}>Back</Button>
               <Button type="submit" variant="default" size="lg" disabled={isProcessing}>{isProcessing ? "Saving..." : "Log Expense"}</Button>
             </div>
           </form>
         )}
       </section>
     </div>
   )}

 </div>
 );
}
