"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { generateUniversalPdf } from "@/lib/exportUniversalPdf";

export function ProfitLossModule() {
 const supabase = createClient();
 const [loading, setLoading] = useState(false);

 const [selectedMonth, setSelectedMonth] = useState(() => {
 const now = new Date();
 return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
 });

 const [summaryData, setSummaryData] = useState({
 totalFreight: 0,
 totalDieselCost: 0,
 totalBata: 0,
 totalHalt: 0,
 totalEnroute: 0,
 totalWorkshopBills: 0,
 netProfit: 0,
 tripCount: 0,
 totalTonnage: 0,
 totalKm: 0
 });

 const [rawTrips, setRawTrips] = useState<any[]>([]);
 const [rawBills, setRawBills] = useState<any[]>([]);

 const formatAmt = (amt: number) => (Number(amt) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

 useEffect(() => {
 fetchFinancials();
 }, [selectedMonth]);

 async function fetchFinancials() {
 setLoading(true);
 const [year, month] = selectedMonth.split('-');
 const firstDay = "2026-09-01";
 const lastDayObj = new Date(parseInt(year), parseInt(month), 0);
 const lastDay = `${year}-${month}-${String(lastDayObj.getDate()).padStart(2, '0')}`;

 const [tripsRes, dieselRes, workshopRes] = await Promise.all([
 supabase.from('trips').select('*, trucks(vehicle_number).gte('trip_start_date', '2026-09-01')').gte('trip_start_date', firstDay).lte('trip_start_date', lastDay),
 supabase.from('diesel_fuel_logs').select('*').gte('fuel_date', firstDay).lte('fuel_date', lastDay),
 supabase.from('workshop_spares_bills').select('*, trucks(vehicle_number)').gte('bill_date', firstDay).lte('bill_date', lastDay)
 ]);

 const trips = tripsRes.data || [];
 const dieselLogs = dieselRes.data || [];
 const workshopBills = workshopRes.data || [];

 setRawTrips(trips);
 setRawBills(workshopBills);

 let freight = 0;
 let bata = 0;
 let halt = 0;
 let enroute = 0;
 let tonnage = 0;
 let km = 0;

 trips.forEach(t => {
 freight += Number(t.freight_revenue) || 0;
 bata += Number(t.driver_bata) || 0;
 halt += Number(t.halt_bata) || 0;
 enroute += Number(t.enroute_repairs_maintenance) || 0;
 tonnage += Number(t.loaded_weight_mt) || Number(t.tonnage_loaded) || 0;
 km += Number(t.total_km_run) || 0;
 });

 let dieselCost = 0;
 dieselLogs.forEach(d => {
 dieselCost += Number(d.total_fuel_cost) || 0;
 });

 let workshopCost = 0;
 workshopBills.forEach(w => {
 workshopCost += Number(w.bill_amount) || 0;
 });

 const totalOpEx = dieselCost + bata + halt + enroute + workshopCost;
 const netProfit = freight - totalOpEx;

 setSummaryData({
 totalFreight: freight,
 totalDieselCost: dieselCost,
 totalBata: bata,
 totalHalt: halt,
 totalEnroute: enroute,
 totalWorkshopBills: workshopCost,
 netProfit: netProfit,
 tripCount: trips.length,
 totalTonnage: tonnage,
 totalKm: km
 });

 setLoading(false);
 }

 const exportPlPdf = () => {
 const headers = ["Expense / Revenue Head", "Amount (INR)", "Percentage of Revenue"];
 const rev = summaryData.totalFreight || 1;

 const rows = [
 ["Gross Freight Revenue", `Rs. ${formatAmt(summaryData.totalFreight)}`, "100.0%"],
 ["Less: Diesel Fuel OPEX", `Rs. ${formatAmt(summaryData.totalDieselCost)}`, `${((summaryData.totalDieselCost/rev)*100).toFixed(1)}%`],
 ["Less: Driver Bata & Allowances", `Rs. ${formatAmt(summaryData.totalBata)}`, `${((summaryData.totalBata/rev)*100).toFixed(1)}%`],
 ["Less: Halt Allowances", `Rs. ${formatAmt(summaryData.totalHalt)}`, `${((summaryData.totalHalt/rev)*100).toFixed(1)}%`],
 ["Less: En-route Repairs", `Rs. ${formatAmt(summaryData.totalEnroute)}`, `${((summaryData.totalEnroute/rev)*100).toFixed(1)}%`],
 ["Less: Workshop Spares & Maintenance", `Rs. ${formatAmt(summaryData.totalWorkshopBills)}`, `${((summaryData.totalWorkshopBills/rev)*100).toFixed(1)}%`],
 ["NET OPERATING PROFIT (RETENTION)", `Rs. ${formatAmt(summaryData.netProfit)}`, `${((summaryData.netProfit/rev)*100).toFixed(1)}%`]
 ];

 generateUniversalPdf(
 `Executive P&L Statement - KSS Roadways`,
 `Period: ${selectedMonth} | Total Trips: ${summaryData.tripCount} | Fleet Tonnage: ${summaryData.totalTonnage.toFixed(1)} MT`,
 headers,
 rows,
 `PL_Statement_${selectedMonth}`
 );
 };

 return (
 <div className="animate-tab-focus space-y-6 animate-slide-up">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/[0.06] pb-4">
 <div>
 <h2 className="text-xl font-semibold text-white  tracking-tight">Executive Profit & Loss Statement</h2>
 <p className="text-xs text-white/60 font-medium mt-0.5">Unified financial matching engine consolidating freight revenue, diesel OPEX, and workshop bills.</p>
 </div>
 <div className="flex items-center gap-3">
 <input
 type="month"
 value={selectedMonth}
 onChange={(e) => setSelectedMonth(e.target.value)}
 className="text-xs p-3 rounded-xl border border-white/[0.08] bg-[#0B0D13] text-white font-bold outline-none focus:border-[#FF5A00]"
 />
 <button onClick={exportPlPdf} className="erp-button-primary px-5 py-3 text-xs  tracking-wider cursor-pointer">
 Export P&L PDF
 </button>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
 <div className="erp-card rounded-2xl p-6 bg-gradient-to-br from-emerald-950/30 to-[#0B0D13] border-emerald-900/30">
 <p className="text-[10px] font-semibold text-emerald-400  tracking-normal">Gross Revenue</p>
 <p className="text-3xl font-semibold text-emerald-300 mt-2">{formatAmt(summaryData.totalFreight)}</p>
 <p className="text-[11px] font-bold text-white/60 mt-1">{summaryData.tripCount} Trips {summaryData.totalTonnage.toFixed(0)} MT Moved</p>
 </div>
 <div className="erp-card rounded-2xl p-6 bg-gradient-to-br from-rose-950/30 to-[#0B0D13] border-rose-900/30">
 <p className="text-[10px] font-semibold text-rose-400  tracking-normal">Total Operating Expenses</p>
 <p className="text-3xl font-semibold text-rose-300 mt-2">{formatAmt(summaryData.totalDieselCost + summaryData.totalBata + summaryData.totalHalt + summaryData.totalEnroute + summaryData.totalWorkshopBills)}</p>
 <p className="text-[11px] font-bold text-white/60 mt-1">Diesel, Bata, Maintenance & Spares</p>
 </div>
 <div className="erp-card rounded-2xl p-6 bg-gradient-to-br from-orange-950/30 to-[#0B0D13] border-[#FF5A00]/30">
 <p className="text-[10px] font-semibold text-[#FF5A00]  tracking-normal">Net Operating Retention</p>
 <p className="text-3xl font-semibold text-[#FF5A00] mt-2">{formatAmt(summaryData.netProfit)}</p>
 <p className="text-[11px] font-bold text-white/60 mt-1">{summaryData.totalFreight > 0 ? ((summaryData.netProfit / summaryData.totalFreight) * 100).toFixed(1) : '0'}% Net Profit Margin</p>
 </div>
 </div>

 <div className="erp-card rounded-3xl p-6 sm:p-8">
 <h3 className="text-sm font-semibold text-white  tracking-wider mb-6 border-b border-white/[0.06] pb-3">Detailed Financial Breakdown ({selectedMonth})</h3>
 
 <div className="space-y-4">
 <div className="flex justify-between items-center p-4 rounded-xl bg-[#0B0D13] border border-white/[0.06]">
 <div><p className="text-xs font-semibold text-white ">1. Gross Freight Revenue</p><p className="text-[10px] font-bold text-white/40">Total freight collected across all completed and active waybills</p></div>
 <p className="text-sm font-semibold text-emerald-400">{formatAmt(summaryData.totalFreight)}</p>
 </div>

 <div className="flex justify-between items-center p-4 rounded-xl bg-[#0B0D13] border border-white/[0.06]">
 <div><p className="text-xs font-semibold text-white ">2. Diesel Fuel Consumption OPEX</p><p className="text-[10px] font-bold text-white/40">Total bulk and pump diesel refueling logs</p></div>
 <p className="text-sm font-semibold text-rose-400">-{formatAmt(summaryData.totalDieselCost)}</p>
 </div>

 <div className="flex justify-between items-center p-4 rounded-xl bg-[#0B0D13] border border-white/[0.06]">
 <div><p className="text-xs font-semibold text-white ">3. Driver Bata & Halt Allowances</p><p className="text-[10px] font-bold text-white/40">Trip bata and waiting halts disbursed to primary crew</p></div>
 <p className="text-sm font-semibold text-rose-400">-{formatAmt(summaryData.totalBata + summaryData.totalHalt)}</p>
 </div>

 <div className="flex justify-between items-center p-4 rounded-xl bg-[#0B0D13] border border-white/[0.06]">
 <div><p className="text-xs font-semibold text-white ">4. En-Route & Workshop Spares Bills</p><p className="text-[10px] font-bold text-white/40">Unified matching including garage maintenance and spare parts</p></div>
 <p className="text-sm font-semibold text-rose-400">-{formatAmt(summaryData.totalEnroute + summaryData.totalWorkshopBills)}</p>
 </div>

 <div className="flex justify-between items-center p-5 rounded-2xl bg-[#050608] border border-[#FF5A00]/40 shadow-xl mt-6">
 <div><p className="text-xs font-semibold text-[#FF5A00]  tracking-normal">Final Net Operating Profit</p><p className="text-[10px] font-bold text-white/60">Bottom-line net retention after all operational and workshop deductions</p></div>
 <p className="text-xl sm:text-2xl font-semibold text-[#FF5A00]">{formatAmt(summaryData.netProfit)}</p>
 </div>
 </div>
 </div>
 </div>
 );
}
