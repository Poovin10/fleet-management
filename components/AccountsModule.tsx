"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

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
 supabase.from('vehicles').select("*").order("vehicle_number"),
 supabase.from("driver_direct_advances").select("*, drivers(full_name, driver_code)").order("advance_date", { ascending: false }).limit(200),
 supabase.from("workshop_spares_bills").select("*, vehicles(vehicle_number)").order("bill_date", { ascending: false }).limit(400)
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

 const filteredWorkshop = workshopBills.filter(b => (b.vehicles?.vehicle_number || "").toLowerCase().includes(workshopSearch.toLowerCase()) || (b.vendor_name || "").toLowerCase().includes(workshopSearch.toLowerCase()) || (b.service_description || "").toLowerCase().includes(workshopSearch.toLowerCase()));
 const exportWorkshop = filteredWorkshop.map(b => ({ "Date": formatDate(b.bill_date), "Truck": b.vehicles?.vehicle_number || "GENERAL", "Vendor": b.vendor_name, "Description": b.service_description, "Amount (INR)": b.bill_amount }));

 const filteredPetty = pettyExpenses.filter(b => (b.vehicles?.vehicle_number || "").toLowerCase().includes(pettySearch.toLowerCase()) || (b.vendor_name || "").toLowerCase().includes(pettySearch.toLowerCase()) || (b.service_description || "").toLowerCase().includes(pettySearch.toLowerCase()));
 const exportPetty = filteredPetty.map(b => ({ "Date": formatDate(b.bill_date), "Truck": b.vehicles?.vehicle_number || "GENERAL", "Category": b.vendor_name, "Description": b.service_description, "Amount (INR)": b.bill_amount }));

 return (
 <div className="animate-tab-focus space-y-6 animate-in fade-in duration-300">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
 <div><h2 className="text-xl font-semibold text-fg  tracking-tight">Finance & Accounts</h2><p className="text-xs text-fg/60 mt-0.5">Manage cash advances, petty cash, and workshop ledgers.</p></div>
 <div className="flex flex-wrap gap-2">
 {[{ id: "advances", label: "Driver Advances" }, { id: "petty", label: "Petty Expenses" }, { id: "workshop", label: "Workshop Ledger" }].map((tab) => (
 <Button key={tab.id} type="button" onClick={() => setActiveSubTab(tab.id as any)} variant={activeSubTab === tab.id ? "default" : "glass"} size="sm">{tab.label}</Button>
 ))}
 </div>
 </div>

 {activeSubTab === "advances" && (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-4">
 <div className="lg:col-span-4 liquid-glass p-6 shadow-xl h-fit">
 <div className="flex justify-between items-center border-b border-border pb-3 mb-5"><h3 className="text-sm font-semibold text-fg  tracking-wide">{editAdvId ? "Edit Advance" : "Issue Advance"}</h3>{editAdvId && <span className="px-3 py-1 bg-warning-soft text-warning text-[10px] font-bold rounded-lg  tracking-normal animate-pulse">Editing</span>}</div>
 <form onSubmit={handleIssueAdvance} className="space-y-4">
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Advance Date *</label><input type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} className="input-glass text-fg outline-none focus:border-accent font-semibold" required /></div>
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Driver *</label><select value={advDriverId} onChange={e => setAdvDriverId(e.target.value)} className="input-glass text-fg outline-none focus:border-accent font-bold" required><option value="">-- SELECT --</option>{drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.driver_code} - {d.full_name}</option>)}</select></div>
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Amount () *</label><input type="number" min="1" max="500000" value={advAmount} onChange={e => setAdvAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} className="input-glass outline-none focus:border-accent font-semibold text-success" required /></div>
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Category</label><select value={advCategory} onChange={e => setAdvCategory(e.target.value)} className="input-glass text-fg outline-none focus:border-accent font-semibold"><option value="GENERAL_ADVANCE">GENERAL ADVANCE</option><option value="BATA_ADVANCE">BATA ADVANCE</option><option value="SALARY_ADVANCE">SALARY ADVANCE</option></select></div>
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Remarks</label><input type="text" maxLength={60} value={advRef} onChange={e => setAdvRef(e.target.value.toUpperCase())} placeholder="OPTIONAL REF" className="input-glass text-fg outline-none focus:border-accent font-semibold " /></div>
 <div className="flex gap-2">
 {editAdvId && <Button type="button" variant="glass" size="lg" onClick={() => {setEditAdvId(null); setAdvAmount(""); setAdvRef("");}} className="flex-1">Cancel</Button>}
 <Button type="submit" variant="default" size="lg" disabled={isProcessing} className="flex-[2]">{isProcessing ? "Processing..." : editAdvId ? "Update Advance" : "Log Advance"}</Button>
 </div>
 </form>
 </div>
 <div className="lg:col-span-8 liquid-glass overflow-hidden flex flex-col shadow-xl">
 <TableToolbar title="Advance History" searchQuery={advancesSearch} setSearchQuery={setAdvancesSearch} exportData={exportAdvances} exportFilename="Driver_Advances" />
 <div className="overflow-x-auto flex-1 max-h-[600px] overflow-y-auto w-full">
 <Table className="min-w-full whitespace-nowrap text-xs">
 <TableHeader className="sticky top-0 z-10">
   <TableRow>
     <TableHead className="px-5 py-3.5 text-left">Date</TableHead>
     <TableHead className="px-5 py-3.5 text-left">Driver</TableHead>
     <TableHead className="px-5 py-3.5 text-left">Ref</TableHead>
     <TableHead className="px-5 py-3.5 text-right">Amount ()</TableHead>
     <TableHead className="px-5 py-3.5 text-center">Action</TableHead>
   </TableRow>
 </TableHeader>

 <TableBody>
   {filteredAdvances.map((adv) => (
     <TableRow
       key={adv.advance_id}
       onClick={() => handleEditAdvance(adv)}
       className={`cursor-pointer border-l-2 ${
         editAdvId === adv.advance_id
           ? "border-l-accent bg-accent/10"
           : "border-l-transparent"
       }`}
     >
       <TableCell className="px-5 py-3.5 font-semibold text-fg-secondary">
         {formatDate(adv.advance_date)}
       </TableCell>

       <TableCell className="px-5 py-3.5 font-semibold text-fg">
         {adv.drivers?.full_name}
       </TableCell>

       <TableCell className="px-5 py-3.5 text-fg-secondary">
         {adv.advance_type}
         <br />
         <span className="text-[9px] text-fg-muted">
           {adv.reference_remarks || "-"}
         </span>
       </TableCell>

       <TableCell className="px-5 py-3.5 text-right font-semibold text-success">
         {(adv.amount_inr || 0).toLocaleString("en-IN")}
       </TableCell>

       <TableCell className="px-5 py-3.5 text-center">
         <Button
           type="button"
           variant="destructive"
           size="xs"
           onClick={(e) => {
             e.stopPropagation();
             handleDeleteAdvance(adv.advance_id);
           }}
         >
           Del
         </Button>
       </TableCell>
     </TableRow>
   ))}

   {filteredAdvances.length === 0 && (
     <TableRow>
       <TableCell
         colSpan={5}
         className="p-8 text-center font-medium text-fg-muted"
       >
         No records match.
       </TableCell>
     </TableRow>
   )}
 </TableBody>
 </Table>
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
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Truck (Optional)</label><select value={expVehicleId} onChange={e => setExpVehicleId(e.target.value)} className="w-full text-xs p-3 rounded-xl input-glass"><option value="">-- GENERAL --</option>{trucksList.map(t => <option key={t.id} value={t.id}>{t.vehicle_number}</option>)}</select></div>
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Amount () *</label><input type="number" min="1" max="100000" value={expAmount} onChange={e => setExpAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} className="w-full text-xs p-3 rounded-xl input-glass" required /></div>
 <div><label className="block text-[10px] font-bold text-fg/60  mb-1">Remarks</label><input type="text" maxLength={60} value={expDescription} onChange={e => setExpDescription(e.target.value.toUpperCase())} className="w-full text-xs p-3 rounded-xl input-glass" /></div>
 <Button type="submit" variant="default" size="lg" disabled={isProcessing} className="w-full">{isProcessing ? "Saving..." : "Log Expense"}</Button>
 </form>
 </div>
 <div className="lg:col-span-8 liquid-glass overflow-hidden flex flex-col shadow-xl">
 <TableToolbar title="Petty Expense Ledger" searchQuery={pettySearch} setSearchQuery={setPettySearch} exportData={exportPetty} exportFilename="Petty_Expenses" />
 <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
 <Table className="min-w-full whitespace-nowrap text-xs">
 <TableHeader className="sticky top-0 z-10">
   <TableRow>
     <TableHead className="px-5 py-3.5 text-left">Date</TableHead>
     <TableHead className="px-5 py-3.5 text-left">Category</TableHead>
     <TableHead className="px-5 py-3.5 text-left">Truck</TableHead>
     <TableHead className="px-5 py-3.5 text-left">Description</TableHead>
     <TableHead className="px-5 py-3.5 text-right">Amount ()</TableHead>
   </TableRow>
 </TableHeader>

 <TableBody>
   {filteredPetty.map((b) => (
     <TableRow key={b.bill_id}>
       <TableCell className="px-5 py-3.5 font-semibold text-fg-secondary">
         {formatDate(b.bill_date)}
       </TableCell>

       <TableCell className="px-5 py-3.5 font-semibold text-fg">
         {b.vendor_name}
       </TableCell>

       <TableCell className="px-5 py-3.5 font-semibold text-fg-secondary">
         {b.vehicles?.vehicle_number || "-"}
       </TableCell>

       <TableCell className="px-5 py-3.5 text-fg-secondary">
         {b.service_description || "-"}
       </TableCell>

       <TableCell className="px-5 py-3.5 text-right font-semibold text-accent">
         {(b.bill_amount || 0).toLocaleString("en-IN")}
       </TableCell>
     </TableRow>
   ))}

   {filteredPetty.length === 0 && (
     <TableRow>
       <TableCell
         colSpan={5}
         className="p-8 text-center font-medium text-fg-muted"
       >
         No petty expenses recorded.
       </TableCell>
     </TableRow>
   )}
 </TableBody>
 </Table>
 </div>
 </div>
 </div>
 )}

 {activeSubTab === "workshop" && (
 <div className="liquid-glass overflow-hidden shadow-xl animate-in fade-in">
 <TableToolbar title="Workshop Ledger" searchQuery={workshopSearch} setSearchQuery={setWorkshopSearch} exportData={exportWorkshop} exportFilename="Workshop_Ledger" />
 <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
 <Table className="min-w-full whitespace-nowrap text-xs">
 <TableHeader className="sticky top-0 z-10">
   <TableRow>
     <TableHead className="px-5 py-3.5 text-left">Bill Date</TableHead>
     <TableHead className="px-5 py-3.5 text-left">Truck</TableHead>
     <TableHead className="px-5 py-3.5 text-left">Vendor</TableHead>
     <TableHead className="px-5 py-3.5 text-left">Description</TableHead>
     <TableHead className="px-5 py-3.5 text-right">Amount ()</TableHead>
   </TableRow>
 </TableHeader>

 <TableBody>
   {filteredWorkshop.map((b) => (
     <TableRow key={b.bill_id}>
       <TableCell className="px-5 py-3.5 font-semibold text-fg-secondary">
         {formatDate(b.bill_date)}
       </TableCell>

       <TableCell className="px-5 py-3.5 font-bold text-fg">
         {b.vehicles?.vehicle_number || "-"}
       </TableCell>

       <TableCell className="px-5 py-3.5 font-semibold text-fg">
         {b.vendor_name}
       </TableCell>

       <TableCell className="px-5 py-3.5 text-fg-secondary">
         {b.service_description || "-"}
       </TableCell>

       <TableCell className="px-5 py-3.5 text-right font-semibold text-danger">
         {(b.bill_amount || 0).toLocaleString("en-IN")}
       </TableCell>
     </TableRow>
   ))}

   {filteredWorkshop.length === 0 && (
     <TableRow>
       <TableCell
         colSpan={5}
         className="p-8 text-center font-medium text-fg-muted"
       >
         No workshop bills match your search.
       </TableCell>
     </TableRow>
   )}
 </TableBody>
 </Table>
 </div>
 </div>
 )}
 </div>
 );
}
