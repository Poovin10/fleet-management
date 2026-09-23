"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { generateUniversalPdf } from "@/lib/exportUniversalPdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

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
 const formatDate = (dateStr: string) => {
 if (!dateStr) return 'N/A'; if (!dateStr.includes('-')) return dateStr;
 const parts = dateStr.split('T')[0].split('-');
 if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`; return dateStr;
 };

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

 const { data: trips } = await supabase.from('trips').select(`trip_id, trip_start_date, trip_number, origin, destination, freight_revenue, driver_bata, halt_bata, cash_advance_issued, settlement_status, vehicles(vehicle_number)`).eq('primary_driver_id', selectedDriverId).gte('trip_start_date', fromDate).lte('trip_start_date', toDate).order('trip_start_date', { ascending: true });
 const { data: advances } = await supabase.from('driver_direct_advances').select('*').eq('driver_id', selectedDriverId).gte('advance_date', fromDate).lte('advance_date', toDate).order('advance_date', { ascending: true });

 if (trips) setDriverTrips(trips);
 if (advances) setDriverAdvances(advances);
 setIsProcessing(false);
 };

 const handleMarkSettled = async () => {
 if (!confirm(`Mark all records as SETTLED for this period?`)) return;
 setIsProcessing(true);
 await supabase.from('trips').update({ settlement_status: 'SETTLED' }).eq('primary_driver_id', selectedDriverId).gte('trip_start_date', fromDate).lte('trip_start_date', toDate);
 await supabase.from('driver_direct_advances').update({ is_settled: true }).eq('driver_id', selectedDriverId).gte('advance_date', fromDate).lte('advance_date', toDate);
 alert("Records marked as settled successfully!");
 generateSettlement();
 };

 const tripsByTruck = driverTrips.reduce((acc: any, trip: any) => {
 const truckNo = trip.vehicles?.vehicle_number || "UNKNOWN TRUCK";
 if (!acc[truckNo]) acc[truckNo] = [];
 acc[truckNo].push(trip);
 return acc;
 }, {});

 let grandTotalBata = 0; let grandTotalTripAdv = 0;
 Object.values(tripsByTruck).forEach((tripsArr: any) => {
 tripsArr.forEach((t: any) => {
 grandTotalBata += (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0);
 grandTotalTripAdv += Number(t.cash_advance_issued) || 0;
 });
 });

 let directAdvTotal = 0;
 driverAdvances.forEach(a => directAdvTotal += Number(a.amount_inr) || 0);

 const finalBalancePayable = grandTotalBata - grandTotalTripAdv - directAdvTotal;
 const selectedDriverObj = drivers.find(d => String(d.driver_id) === selectedDriverId);

 const exportToPDF = () => {
 if (!selectedDriverObj) return;
 const headers = ["Date", "Description / Route", "Freight", "Earned Bata", "Deducted Adv", "Net Balance"];
 const rows: any[][] = [];

 Object.entries(tripsByTruck).forEach(([truckNo, tArr]: any) => {
 rows.push([`-- TRUCK: ${truckNo} --`, "", "", "", "", ""]);
 let trBata = 0; let trAdv = 0;
 tArr.forEach((t: any) => {
 const tb = (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0); const ta = Number(t.cash_advance_issued) || 0;
 trBata += tb; trAdv += ta;
 rows.push([formatDate(t.trip_start_date), `${t.trip_number||"-"} | ${t.origin} to ${t.destination}`, `Rs.${formatAmt(t.freight_revenue)}`, `Rs.${formatAmt(tb)}`, `Rs.${formatAmt(ta)}`, `Rs.${formatAmt(tb-ta)}`]);
 });
 rows.push(["SUBTOTAL", `For Truck ${truckNo}`, "", `Rs.${formatAmt(trBata)}`, `Rs.${formatAmt(trAdv)}`, `Rs.${formatAmt(trBata-trAdv)}`]);
 rows.push(["", "", "", "", "", ""]);
 });

 if (driverAdvances.length > 0) {
 rows.push(["-- DIRECT ADVANCES --", "", "", "", "", ""]);
 driverAdvances.forEach(a => { rows.push([formatDate(a.advance_date), `${a.advance_type} | ${a.reference_remarks || "-"}`, "-", "-", `Rs.${formatAmt(a.amount_inr)}`, `(Rs.${formatAmt(a.amount_inr)})`]); });
 rows.push(["SUBTOTAL", "Direct Advances", "", "-", `Rs.${formatAmt(directAdvTotal)}`, `(Rs.${formatAmt(directAdvTotal)})`]);
 }

 generateUniversalPdf(
 `Master Driver Settlement: ${selectedDriverObj.full_name} (${selectedDriverObj.driver_code})`,
 `Period: ${formatDate(fromDate)} to ${formatDate(toDate)} | Final Net Payable: Rs. ${formatAmt(finalBalancePayable)}`,
 headers, rows, `Settlement_${selectedDriverObj.driver_code}_${fromDate}_to_${toDate}`
 );
 };

 return (
 <div className="space-y-6">
 <div className="border-b border-border pb-4">
 <h2 className="text-xl font-semibold text-fg  tracking-tight">Driver Accounting & Settlements</h2>
 <p className="text-xs text-fg-secondary font-medium mt-0.5">Generate multi-truck ledgers, calculate net balances, and export statements.</p>
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

 <div className="space-y-6">
 {Object.entries(tripsByTruck).map(([truckNo, tArr]: any) => {
 let trFreight = 0; let trBata = 0; let trAdv = 0;
 return (
 <div key={truckNo} className="kss-surface overflow-hidden">
 <div className="bg-surface-raised px-6 py-3.5 border-b border-border flex justify-between items-center"><h4 className="text-xs font-semibold text-accent  tracking-wide">TRUCK: {truckNo}</h4></div>
 <div className="overflow-x-auto w-full max-h-80 overflow-y-auto">
 <Table className="text-xs whitespace-nowrap">
 <TableHeader className="sticky top-0 z-10"><TableRow className="text-left font-bold text-fg-secondary  tracking-wider text-[9px]"><TableHead className="px-5 py-3 border-b border-border">Date / LR No</TableHead><TableHead className="px-5 py-3 border-b border-border">Route</TableHead><TableHead className="px-5 py-3 text-right border-b border-border">Freight ()</TableHead><TableHead className="px-5 py-3 text-right border-b border-border">Bata ()</TableHead><TableHead className="px-5 py-3 text-right border-b border-border">Trip Adv ()</TableHead><TableHead className="px-5 py-3 text-right border-b border-border">Balance ()</TableHead><TableHead className="px-5 py-3 text-center border-b border-border">Status</TableHead></TableRow></TableHeader>
 <TableBody className="">
 {tArr.map((t: any) => {
 const tb = (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0); const ta = Number(t.cash_advance_issued) || 0;
 trFreight += Number(t.freight_revenue) || 0; trBata += tb; trAdv += ta;
 return (
 <TableRow key={t.trip_id} className="animate-tab-focus hover:bg-surface-raised/50">
 <TableCell className="px-5 py-3.5 font-semibold text-fg">{formatDate(t.trip_start_date)}<br/><span className="text-fg-muted font-semibold text-[9px] font-mono">{t.trip_number || "-"}</span></TableCell>
 <TableCell className="px-5 py-3.5 text-fg-secondary font-bold"><span className="text-xs">{t.origin} {t.destination}</span></TableCell>
 <TableCell className="px-5 py-3.5 text-right font-semibold text-fg-secondary font-mono">{formatAmt(t.freight_revenue)}</TableCell>
 <TableCell className="px-5 py-3.5 text-right font-semibold text-success font-mono">{formatAmt(tb)}</TableCell>
 <TableCell className="px-5 py-3.5 text-right font-semibold text-danger font-mono">{formatAmt(ta)}</TableCell>
 <TableCell className="px-5 py-3.5 text-right font-semibold text-accent font-mono">{formatAmt(tb - ta)}</TableCell>
 <TableCell className="px-5 py-3.5 text-center"><span className={`px-2.5 py-1 rounded-md text-[9px] font-semibold  tracking-wider ${t.settlement_status === 'SETTLED' ? 'bg-success-soft text-success border border-success/20' : 'bg-warning-soft text-warning border border-warning/20'}`}>{t.settlement_status || "PENDING"}</span></TableCell>
 </TableRow>
 );
 })}
 <TableRow className="bg-surface-raised"><TableCell colSpan={2} className="px-5 py-3.5 text-right font-semibold text-fg-secondary  tracking-normal text-[9px]">Truck Subtotal</TableCell><TableCell className="px-5 py-3.5 text-right font-semibold text-fg font-mono">{formatAmt(trFreight)}</TableCell><TableCell className="px-5 py-3.5 text-right font-semibold text-success font-mono">{formatAmt(trBata)}</TableCell><TableCell className="px-5 py-3.5 text-right font-semibold text-danger font-mono">{formatAmt(trAdv)}</TableCell><TableCell className="px-5 py-3.5 text-right font-semibold text-accent font-mono">{formatAmt(trBata - trAdv)}</TableCell><TableCell className="px-5 py-3.5"></TableCell></TableRow>
 </TableBody>
 </Table>
 </div>
 </div>
 );
 })}

 {driverAdvances.length > 0 && (
 <div className="kss-surface overflow-hidden">
 <div className="bg-surface-raised px-6 py-3.5 border-b border-border"><h4 className="text-xs font-semibold text-danger  tracking-wide">Direct Cash Advances</h4></div>
 <div className="overflow-x-auto w-full max-h-60 overflow-y-auto">
 <Table className="text-xs whitespace-nowrap">
 <TableHeader className="sticky top-0 z-10"><TableRow className="text-left font-bold text-fg-secondary  tracking-wider text-[9px]"><TableHead className="px-5 py-3 border-b border-border">Date</TableHead><TableHead className="px-5 py-3 border-b border-border">Category</TableHead><TableHead className="px-5 py-3 border-b border-border">Remarks</TableHead><TableHead className="px-5 py-3 text-right border-b border-border">Amount ()</TableHead></TableRow></TableHeader>
 <TableBody className="">
 {driverAdvances.map(a => (<TableRow key={a.advance_id} className=""><TableCell className="px-5 py-3.5 font-semibold text-fg">{formatDate(a.advance_date)}</TableCell><TableCell className="px-5 py-3.5 text-fg-secondary font-bold">{a.advance_type}</TableCell><TableCell className="px-5 py-3.5 text-fg-muted">{a.reference_remarks || "-"}</TableCell><TableCell className="px-5 py-3.5 text-right font-semibold text-danger font-mono">{formatAmt(a.amount_inr)}</TableCell></TableRow>))}
 <TableRow className="bg-surface-raised"><TableCell colSpan={3} className="px-5 py-3.5 text-right font-semibold text-fg-secondary  tracking-normal text-[9px]">Advance Subtotal</TableCell><TableCell className="px-5 py-3.5 text-right font-semibold text-danger font-mono">{formatAmt(directAdvTotal)}</TableCell></TableRow>
 </TableBody>
 </Table>
 </div>
 </div>
 )}
 </div>

 <div className="pt-6 border-t border-border flex flex-wrap justify-between items-center gap-4">
 <Button
 type="button"
 variant="glass"
 size="lg"
 onClick={exportToPDF}
 disabled={isProcessing}
>
 Export PDF Statement
</Button>
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
