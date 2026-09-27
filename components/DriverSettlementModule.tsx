"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function DriverSettlementModule() {
 const supabase = createClient();
 const [isProcessing, setIsProcessing] = useState(false);
 const [hasSearched, setHasSearched] = useState(false);

 const [drivers, setDrivers] = useState<any[]>([]);
 const [selectedDriverId, setSelectedDriverId] = useState("");
 const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
 const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

 const [driverTrips, setDriverTrips] = useState<any[]>([]);
 const [driverAdvances, setDriverAdvances] = useState<any[]>([]);

 const formatAmt = (amt: number) => (Number(amt) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
 useEffect(() => {
 async function fetchDrivers() {
 const { data } = await supabase.from('drivers').select('*').eq('is_active', true).order('full_name');
 if (data) setDrivers(data);
 }
 fetchDrivers();
 }, [supabase]);

 const generateSettlement = async () => {
 if (!selectedDriverId) return alert("Please select a driver first.");
 setIsProcessing(true); setHasSearched(true);

 const { data: trips } = await supabase.from('trips').select('trip_id, driver_bata, halt_bata, cash_advance_issued, settlement_status').eq('primary_driver_id', selectedDriverId).gte('trip_start_date', fromDate).lte('trip_start_date', toDate).order('trip_start_date', { ascending: true });
 const { data: advances } = await supabase.from('driver_direct_advances').select('*').eq('driver_id', selectedDriverId).gte('advance_date', fromDate).lte('advance_date', toDate).order('advance_date', { ascending: true });

 if (trips) setDriverTrips(trips);
 if (advances) setDriverAdvances(advances);
 setIsProcessing(false);
 };

 const handleMarkSettled = async () => {
 if (!confirm(`Mark all records as SETTLED for this period?`)) return;
 setIsProcessing(true);
 const { data, error } = await supabase.rpc("settle_driver_period_atomic", {
   p_driver_id: Number(selectedDriverId),
   p_from_date: fromDate,
   p_to_date: toDate,
 });

 if (error) {
   alert("Settlement failed: " + error.message);
   setIsProcessing(false);
   return;
 }

 alert(
   `Settlement completed. Trips settled: ${data?.trips_settled ?? 0}. ` +
   `Advances settled: ${data?.advances_settled ?? 0}.`
 );

 await generateSettlement();
 };

 const { grandTotalBata, grandTotalTripAdv } = driverTrips.reduce(
   (totals, trip) => ({
     grandTotalBata: totals.grandTotalBata + (Number(trip.driver_bata) || 0) + (Number(trip.halt_bata) || 0),
     grandTotalTripAdv: totals.grandTotalTripAdv + (Number(trip.cash_advance_issued) || 0),
   }),
   { grandTotalBata: 0, grandTotalTripAdv: 0 }
 );

 const directAdvTotal = driverAdvances.reduce(
   (total, advance) => total + (Number(advance.amount_inr) || 0),
   0
 );

 const finalBalancePayable = grandTotalBata - grandTotalTripAdv - directAdvTotal;
 return (
 <div className="space-y-6">
 <div className="border-b border-border pb-4">
 <h2 className="text-xl font-semibold text-fg  tracking-tight">Driver Accounting & Settlements</h2>
 <p className="text-xs text-fg-secondary font-medium mt-0.5">Calculate driver-period settlement balances and close the settlement period. Detailed history is available in Reports.</p>
 </div>

 <div className="liquid-glass p-6 sm:p-8 shadow-2xl">
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
 <div className="md:col-span-2">
 <label className="block text-[10px] font-semibold text-fg-secondary  tracking-normal mb-2">Select Driver *</label>
 <Select
 value={selectedDriverId}
 onChange={(e) => {
   setSelectedDriverId(e.target.value);
   setHasSearched(false);
 }}
 className="h-auto py-3.5 text-xs font-bold"
>
 <option value="">-- SELECT DRIVER --</option>
 {drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.driver_code} - {d.full_name}</option>)}
 </Select>
 </div>
 <div>
 <label className="block text-[10px] font-semibold text-fg-secondary  tracking-normal mb-2">From Date *</label>
 <Input
 type="date"
 value={fromDate}
 onChange={e => setFromDate(e.target.value)}
 className="h-auto py-3.5 text-xs font-semibold"
 />
 </div>
 <div className="flex items-end">
 <div className="w-full">
 <label className="block text-[10px] font-semibold text-fg-secondary  tracking-normal mb-2">To Date *</label>
 <div className="flex gap-2">
 <Input
 type="date"
 value={toDate}
 onChange={e => setToDate(e.target.value)}
 className="h-auto py-3.5 text-xs font-semibold"
 />
 <Button type="button" onClick={generateSettlement} disabled={isProcessing || !selectedDriverId} size="lg">
 Load
 </Button>
 </div>
 </div>
 </div>
 </div>

 {hasSearched && (
 <div className="space-y-8 animate-slide-up">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="kss-surface-raised border border-border p-5"><p className="text-[9px] font-semibold text-fg-secondary  tracking-normal">Total Trips</p><p className="text-2xl font-semibold text-fg mt-2 font-mono">{driverTrips.length}</p></div>
 <div className="kss-surface-raised border border-success/20 p-5"><p className="text-[9px] font-semibold text-success  tracking-normal">Gross Bata Earned</p><p className="text-2xl font-semibold text-success mt-2 font-mono">{formatAmt(grandTotalBata)}</p></div>
 <div className="kss-surface-raised border border-danger/20 p-5"><p className="text-[9px] font-semibold text-danger  tracking-normal">Total Deductions</p><p className="text-2xl font-semibold text-danger mt-2 font-mono">{formatAmt(grandTotalTripAdv + directAdvTotal)}</p></div>
 <div className="kss-surface-raised border border-accent-border p-5"><p className="text-[9px] font-semibold text-accent  tracking-normal">Net Payable</p><p className="text-2xl sm:text-3xl font-semibold text-accent mt-2 font-mono">{formatAmt(finalBalancePayable)}</p></div>
 </div>

 <div className="kss-surface p-6">
   <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
     <div>
       <h4 className="text-sm font-semibold text-fg">Settlement period loaded</h4>
       <p className="text-xs text-fg-muted mt-1">
         {driverTrips.length} trip records and {driverAdvances.length} direct advance records loaded.
         Detailed transaction history is available in Reports.
       </p>
     </div>
     <div className="text-right">
       <p className="text-[9px] font-semibold text-fg-secondary">Final Net Payable</p>
       <p className="text-xl font-semibold text-accent font-mono">{formatAmt(finalBalancePayable)}</p>
     </div>
   </div>
 </div>

 <div className="pt-6 border-t border-border flex flex-wrap justify-end items-center gap-4">
 <Button
 type="button"
 variant="secondary"
 size="lg"
 onClick={handleMarkSettled}
 disabled={isProcessing}
>
 Mark Period as Settled
 </Button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
