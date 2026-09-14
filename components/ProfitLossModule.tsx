"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export function ProfitLossModule() {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // P&L Data States
  const [totalFreight, setTotalFreight] = useState(0);
  const [totalDiesel, setTotalDiesel] = useState(0);
  const [totalBata, setTotalBata] = useState(0);
  const [totalHaltBata, setTotalHaltBata] = useState(0);
  const [totalEnrouteRepairs, setTotalEnrouteRepairs] = useState(0);
  const [totalWorkshopBills, setTotalWorkshopBills] = useState(0);
  const [tripCount, setTripCount] = useState(0);

  const formatAmt = (amt: number) => {
    return (Number(amt) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fetchPLData = async () => {
    setIsLoading(true);
    const [year, month] = selectedMonth.split('-');
    const firstDay = `${year}-${month}-01`;
    const lastDayObj = new Date(parseInt(year), parseInt(month), 0);
    const lastDay = `${year}-${month}-${String(lastDayObj.getDate()).padStart(2, '0')}`;

    const [tripsRes, fuelsRes, billsRes] = await Promise.all([
      supabase.from('trips').select('freight_revenue, driver_bata, halt_bata, enroute_repairs_maintenance').gte('trip_start_date', firstDay).lte('trip_start_date', lastDay),
      supabase.from('diesel_fuel_logs').select('total_fuel_cost').gte('fuel_date', firstDay).lte('fuel_date', lastDay),
      supabase.from('workshop_spares_bills').select('bill_amount').gte('bill_date', firstDay).lte('bill_date', lastDay)
    ]);

    let freight = 0; let bata = 0; let halt = 0; let enroute = 0;
    if (tripsRes.data) {
      setTripCount(tripsRes.data.length);
      tripsRes.data.forEach(t => {
        freight += Number(t.freight_revenue) || 0;
        bata += Number(t.driver_bata) || 0;
        halt += Number(t.halt_bata) || 0;
        enroute += Number(t.enroute_repairs_maintenance) || 0;
      });
    }

    let diesel = 0;
    if (fuelsRes.data) {
      fuelsRes.data.forEach(f => { diesel += Number(f.total_fuel_cost) || 0; });
    }

    let workshop = 0;
    if (billsRes.data) {
      billsRes.data.forEach(b => { workshop += Number(b.bill_amount) || 0; });
    }

    setTotalFreight(freight);
    setTotalDiesel(diesel);
    setTotalBata(bata);
    setTotalHaltBata(halt);
    setTotalEnrouteRepairs(enroute);
    setTotalWorkshopBills(workshop);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPLData();
  }, [selectedMonth]);

  const totalOperatingExpenses = totalDiesel + totalBata + totalHaltBata + totalEnrouteRepairs + totalWorkshopBills;
  const netProfit = totalFreight - totalOperatingExpenses;
  const netMarginPct = totalFreight > 0 ? (netProfit / totalFreight) * 100 : 0;

  // Data for Recharts Visualization
  const chartData = [
    { name: "Gross Rev", amount: totalFreight, color: "#10b981" }, // Emerald
    { name: "Diesel", amount: totalDiesel, color: "#f43f5e" }, // Rose
    { name: "Bata", amount: totalBata + totalHaltBata, color: "#f43f5e" },
    { name: "Repairs", amount: totalEnrouteRepairs + totalWorkshopBills, color: "#f43f5e" },
    { name: "Net Profit", amount: netProfit, color: netProfit >= 0 ? "#FF5A00" : "#ef4444" } // Orange or Red
  ];

  // CSV Export with Injection Protection
  const exportPLToCSV = () => {
    const sanitize = (val: any) => {
      let str = String(val ?? "");
      if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
      return `"${str.replace(/"/g, '""')}"`;
    };

    const csvContent = [
      sanitize(`KSS ROADWAYS PVT LTD - MONTHLY PROFIT & LOSS STATEMENT (${selectedMonth})`),
      `"Category","Amount (INR)"`,
      `"Gross Freight Revenue",${sanitize(totalFreight.toFixed(2))}`,
      `"Diesel Expenses",${sanitize(totalDiesel.toFixed(2))}`,
      `"Driver Bata",${sanitize(totalBata.toFixed(2))}`,
      `"Halt Bata",${sanitize(totalHaltBata.toFixed(2))}`,
      `"Enroute Repairs",${sanitize(totalEnrouteRepairs.toFixed(2))}`,
      `"Workshop Spares & Bills",${sanitize(totalWorkshopBills.toFixed(2))}`,
      `"Total Operating Expenses",${sanitize(totalOperatingExpenses.toFixed(2))}`,
      `"Net Profit / Retention",${sanitize(netProfit.toFixed(2))}`,
      `"Net Margin %",${sanitize(netMarginPct.toFixed(2) + "%")}`
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `PL_Statement_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Top Bar: Month Selector & Export */}
      <div className="bg-[#161922] border border-[#272B36] rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-wide">Monthly P&L Statement</h3>
          <p className="text-xs text-slate-400 mt-0.5 font-semibold">Comprehensive financial performance ledger.</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)} 
            className="text-sm p-2.5 rounded-xl border border-[#272B36] font-bold bg-[#0F1117] text-white outline-none focus:border-[#FF5A00]" 
          />
          <button 
            onClick={exportPLToCSV} 
            className="px-4 py-2.5 bg-[#0F1117] hover:bg-[#1A1F2C] border border-[#272B36] text-emerald-400 font-bold text-sm rounded-xl transition-all shadow-sm flex items-center gap-2 active:scale-95"
          >
            <span className="text-lg leading-none">📊</span> Export CSV
          </button>
        </div>
      </div>

      {/* P&L Statement Card */}
      <div className="bg-[#161922] border border-[#272B36] rounded-2xl shadow-xl overflow-hidden max-w-5xl mx-auto relative">
        {isLoading && (
          <div className="absolute inset-0 bg-[#161922]/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <span className="font-bold text-[#FF5A00] animate-pulse">Calculating P&L...</span>
          </div>
        )}

        <div className="p-6 sm:p-8 bg-[#0F1117] text-white flex justify-between items-center border-b border-[#272B36]">
          <div>
            <p className="text-[10px] font-black text-[#FF5A00] uppercase tracking-widest">KSS Roadways Pvt Ltd</p>
            <h2 className="text-xl sm:text-2xl font-black mt-1">Profit & Loss Statement</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-bold">Period: {selectedMonth} ({tripCount} Trips Logged)</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Net Margin</p>
            <p className={`text-2xl sm:text-3xl font-black ${netMarginPct >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
              {netMarginPct.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">

          {/* REVENUE SECTION */}
          <div>
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">1. Revenue</h4>
            <div className="bg-[#1A1F2C] border border-[#272B36] rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-white">Gross Freight Revenue</p>
                <p className="text-[11px] font-semibold text-slate-400">Total billable earnings from trips</p>
              </div>
              <p className="text-base sm:text-lg font-black text-emerald-400">₹ {formatAmt(totalFreight)}</p>
            </div>
          </div>

          {/* OPERATING EXPENSES SECTION */}
          <div>
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">2. Operating Expenses (OPEX)</h4>
            <div className="space-y-2">
              <div className="bg-[#0F1117] border border-[#272B36] rounded-xl p-4 flex justify-between items-center hover:bg-[#1A1F2C] transition-colors">
                <p className="text-sm font-bold text-slate-300">Diesel Fuel Consumption</p>
                <p className="text-sm font-black text-rose-400">₹ {formatAmt(totalDiesel)}</p>
              </div>
              <div className="bg-[#0F1117] border border-[#272B36] rounded-xl p-4 flex justify-between items-center hover:bg-[#1A1F2C] transition-colors">
                <p className="text-sm font-bold text-slate-300">Driver Bata</p>
                <p className="text-sm font-black text-rose-400">₹ {formatAmt(totalBata)}</p>
              </div>
              <div className="bg-[#0F1117] border border-[#272B36] rounded-xl p-4 flex justify-between items-center hover:bg-[#1A1F2C] transition-colors">
                <p className="text-sm font-bold text-slate-300">Halt Bata</p>
                <p className="text-sm font-black text-rose-400">₹ {formatAmt(totalHaltBata)}</p>
              </div>
              <div className="bg-[#0F1117] border border-[#272B36] rounded-xl p-4 flex justify-between items-center hover:bg-[#1A1F2C] transition-colors">
                <p className="text-sm font-bold text-slate-300">Enroute Repairs & Maintenance</p>
                <p className="text-sm font-black text-rose-400">₹ {formatAmt(totalEnrouteRepairs)}</p>
              </div>
              <div className="bg-[#0F1117] border border-[#272B36] rounded-xl p-4 flex justify-between items-center hover:bg-[#1A1F2C] transition-colors">
                <p className="text-sm font-bold text-slate-300">Workshop Spares & Service Bills</p>
                <p className="text-sm font-black text-rose-400">₹ {formatAmt(totalWorkshopBills)}</p>
              </div>
            </div>

            <div className="mt-3 bg-rose-950/20 border border-rose-900/50 rounded-xl p-4 flex justify-between items-center">
              <p className="text-xs font-black text-rose-500 uppercase tracking-wide">Total Operating Expenses</p>
              <p className="text-base sm:text-lg font-black text-rose-400">₹ {formatAmt(totalOperatingExpenses)}</p>
            </div>
          </div>

          {/* NET PROFIT SUMMARY BOX */}
          <div className="pt-6 border-t border-[#272B36]">
            <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${netProfit >= 0 ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-rose-950/20 border-rose-900/50'}`}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Net Profit / Retention</p>
                <h3 className={`text-2xl sm:text-3xl font-black mt-1 ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                  ₹ {formatAmt(netProfit)}
                </h3>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs font-bold text-slate-400">Operating Margin Status</p>
                <p className={`text-sm font-black mt-0.5 ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                  {netProfit >= 0 ? '🟢 Profitable Month' : '🔴 Net Loss Month'}
                </p>
              </div>
            </div>
          </div>

          {/* VISUAL ANALYTICS (RECHARTS) */}
          <div className="pt-8 mt-8 border-t border-[#272B36]">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-6">Financial Breakdown Visualized</h4>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 15, bottom: 25 }}>
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} 
                    axisLine={false} 
                    tickLine={false} 
                    dy={12}
                    interval={0}
                  />
                  <YAxis 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
                    axisLine={false} 
                    tickLine={false} 
                    width={45}
                    tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    cursor={{ fill: '#272B36', opacity: 0.4 }}
                    contentStyle={{ backgroundColor: '#0F1117', border: '1px solid #272B36', borderRadius: '12px', fontWeight: 'bold', color: '#fff' }}
                    formatter={(value: any) => [`₹ ${formatAmt(Number(value))}`, 'Amount']}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={45}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
