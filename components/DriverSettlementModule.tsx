"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { generateUniversalPdf } from "@/lib/exportUniversalPdf";

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

 const { data: trips } = await supabase.from('trips').select(`trip_id, trip_start_date, trip_number, origin, destination, freight_revenue, driver_bata, halt_bata, cash_advance_issued, settlement_status, trucks ( vehicle_number )`).eq('primary_driver_id', selectedDriverId).gte('trip_start_date', fromDate).lte('trip_start_date', toDate).order('trip_start_date', { ascending: true });
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
 const truckNo = trip.trucks?.vehicle_number || "UNKNOWN TRUCK";
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
 <div className="border-b border-white/[0.06] pb-4">
 <h2 className="text-xl font-semibold text-white  tracking-tight">Driver Accounting & Settlements</h2>
 <p className="text-xs text-white/60 font-medium mt-0.5">Generate multi-truck ledgers, calculate net balances, and export statements.</p>
 </div>

 <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 sm:p-8 shadow-2xl">
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
 <div className="md:col-span-2">
 <label className="block text-[10px] font-semibold text-white/60  tracking-normal mb-2">Select Driver *</label>
 <select value={selectedDriverId} onChange={(e) => { setSelectedDriverId(e.target.value); setHasSearched(false); }} className="w-full text-xs p-3.5 rounded-xl border border-white/[0.08] bg-[#080A10] text-white outline-none focus:border-[#FF5A00] font-bold">
 <option value="">-- SELECT DRIVER --</option>
 {drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.driver_code} - {d.full_name}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-[10px] font-semibold text-white/60  tracking-normal mb-2">From Date *</label>
 <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full text-xs p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-white font-semibold outline-none" />
 </div>
 <div className="flex items-end">
 <div className="w-full">
 <label className="block text-[10px] font-semibold text-white/60  tracking-normal mb-2">To Date *</label>
 <div className="flex gap-2">
 <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full text-xs p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-white font-semibold outline-none" />
 <button onClick={generateSettlement} disabled={isProcessing || !selectedDriverId} className="px-5 py-3.5 bg-gradient-to-r from-[#FF5A00] to-[#E04F00] text-white font-semibold text-xs rounded-xl  tracking-wider transition-all shadow-[0_0_20px_rgba(255,90,0,0.3)] cursor-pointer">
 Load
 </button>
 </div>
 </div>
 </div>
 </div>

 {hasSearched && (
 <div className="space-y-8 animate-slide-up">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5"><p className="text-[9px] font-semibold text-white/60  tracking-normal">Total Trips</p><p className="text-2xl font-semibold text-white mt-2 font-mono">{driverTrips.length}</p></div>
 <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-2xl p-5"><p className="text-[9px] font-semibold text-emerald-400  tracking-normal">Gross Bata Earned</p><p className="text-2xl font-semibold text-emerald-300 mt-2 font-mono">{formatAmt(grandTotalBata)}</p></div>
 <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-5"><p className="text-[9px] font-semibold text-rose-400  tracking-normal">Total Deductions</p><p className="text-2xl font-semibold text-rose-300 mt-2 font-mono">{formatAmt(grandTotalTripAdv + directAdvTotal)}</p></div>
 <div className="bg-[#FF5A00]/10 border border-[#FF5A00]/30 rounded-2xl p-5 shadow-sm"><p className="text-[9px] font-semibold text-[#FF5A00]  tracking-normal">Net Payable</p><p className="text-2xl sm:text-3xl font-semibold text-[#FF5A00] mt-2 font-mono">{formatAmt(finalBalancePayable)}</p></div>
 </div>

 <div className="space-y-6">
 {Object.entries(tripsByTruck).map(([truckNo, tArr]: any) => {
 let trFreight = 0; let trBata = 0; let trAdv = 0;
 return (
 <div key={truckNo} className="border border-white/[0.06] rounded-2xl overflow-hidden shadow-sm bg-white/[0.01]">
 <div className="bg-white/[0.03] px-6 py-3.5 border-b border-white/[0.06] flex justify-between items-center"><h4 className="text-xs font-semibold text-[#FF5A00]  tracking-wide">TRUCK: {truckNo}</h4></div>
 <div className="overflow-x-auto w-full max-h-80 overflow-y-auto">
 <table className="min-w-full divide-y divide-white/[0.06] text-xs whitespace-nowrap">
 <thead className="bg-[#030407] sticky top-0"><tr className="text-left font-bold text-white/60  tracking-wider text-[9px]"><th className="px-5 py-3 border-b border-white/[0.06]">Date / LR No</th><th className="px-5 py-3 border-b border-white/[0.06]">Route</th><th className="px-5 py-3 text-right border-b border-white/[0.06]">Freight ()</th><th className="px-5 py-3 text-right border-b border-white/[0.06]">Bata ()</th><th className="px-5 py-3 text-right border-b border-white/[0.06]">Trip Adv ()</th><th className="px-5 py-3 text-right border-b border-white/[0.06]">Balance ()</th><th className="px-5 py-3 text-center border-b border-white/[0.06]">Status</th></tr></thead>
 <tbody className="divide-y divide-white/[0.05]">
 {tArr.map((t: any) => {
 const tb = (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0); const ta = Number(t.cash_advance_issued) || 0;
 trFreight += Number(t.freight_revenue) || 0; trBata += tb; trAdv += ta;
 return (
 <tr key={t.trip_id} className="animate-tab-focus hover:bg-white/[0.02]">
 <td className="px-5 py-3.5 font-semibold text-white">{formatDate(t.trip_start_date)}<br/><span className="text-white/40 font-semibold text-[9px] font-mono">{t.trip_number || "-"}</span></td>
 <td className="px-5 py-3.5 text-slate-300 font-bold"><span className="text-xs">{t.origin} {t.destination}</span></td>
 <td className="px-5 py-3.5 text-right font-semibold text-slate-300 font-mono">{formatAmt(t.freight_revenue)}</td>
 <td className="px-5 py-3.5 text-right font-semibold text-emerald-400 font-mono">{formatAmt(tb)}</td>
 <td className="px-5 py-3.5 text-right font-semibold text-rose-400 font-mono">{formatAmt(ta)}</td>
 <td className="px-5 py-3.5 text-right font-semibold text-[#FF5A00] font-mono">{formatAmt(tb - ta)}</td>
 <td className="px-5 py-3.5 text-center"><span className={`px-2.5 py-1 rounded-md text-[9px] font-semibold  tracking-wider ${t.settlement_status === 'SETTLED' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' : 'bg-amber-950/40 text-amber-400 border border-amber-900/40'}`}>{t.settlement_status || "PENDING"}</span></td>
 </tr>
 );
 })}
 <tr className="bg-[#030407]"><td colSpan={2} className="px-5 py-3.5 text-right font-semibold text-white/60  tracking-normal text-[9px]">Truck Subtotal</td><td className="px-5 py-3.5 text-right font-semibold text-white font-mono">{formatAmt(trFreight)}</td><td className="px-5 py-3.5 text-right font-semibold text-emerald-400 font-mono">{formatAmt(trBata)}</td><td className="px-5 py-3.5 text-right font-semibold text-rose-400 font-mono">{formatAmt(trAdv)}</td><td className="px-5 py-3.5 text-right font-semibold text-[#FF5A00] font-mono">{formatAmt(trBata - trAdv)}</td><td className="px-5 py-3.5"></td></tr>
 </tbody>
 </table>
 </div>
 </div>
 );
 })}

 {driverAdvances.length > 0 && (
 <div className="border border-white/[0.06] rounded-2xl overflow-hidden shadow-sm bg-white/[0.01]">
 <div className="bg-white/[0.03] px-6 py-3.5 border-b border-white/[0.06]"><h4 className="text-xs font-semibold text-rose-400  tracking-wide">Direct Cash Advances</h4></div>
 <div className="overflow-x-auto w-full max-h-60 overflow-y-auto">
 <table className="min-w-full divide-y divide-white/[0.06] text-xs whitespace-nowrap">
 <thead className="bg-[#030407] sticky top-0"><tr className="text-left font-bold text-white/60  tracking-wider text-[9px]"><th className="px-5 py-3 border-b border-white/[0.06]">Date</th><th className="px-5 py-3 border-b border-white/[0.06]">Category</th><th className="px-5 py-3 border-b border-white/[0.06]">Remarks</th><th className="px-5 py-3 text-right border-b border-white/[0.06]">Amount ()</th></tr></thead>
 <tbody className="divide-y divide-white/[0.05]">
 {driverAdvances.map(a => (<tr key={a.advance_id} className="hover:bg-white/[0.02]"><td className="px-5 py-3.5 font-semibold text-white">{formatDate(a.advance_date)}</td><td className="px-5 py-3.5 text-slate-300 font-bold">{a.advance_type}</td><td className="px-5 py-3.5 text-white/40">{a.reference_remarks || "-"}</td><td className="px-5 py-3.5 text-right font-semibold text-rose-400 font-mono">{formatAmt(a.amount_inr)}</td></tr>))}
 <tr className="bg-[#030407]"><td colSpan={3} className="px-5 py-3.5 text-right font-semibold text-white/60  tracking-normal text-[9px]">Advance Subtotal</td><td className="px-5 py-3.5 text-right font-semibold text-rose-400 font-mono">{formatAmt(directAdvTotal)}</td></tr>
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>

 <div className="pt-6 border-t border-white/[0.06] flex flex-wrap justify-between items-center gap-4">
 <button onClick={exportToPDF} disabled={isProcessing} className="px-6 py-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[#FF5A00] font-semibold text-xs rounded-xl transition-all  tracking-wider cursor-pointer">Export PDF Statement</button>
 <button onClick={handleMarkSettled} disabled={isProcessing} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl  tracking-wider transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer">
 Mark Period as Settled
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
