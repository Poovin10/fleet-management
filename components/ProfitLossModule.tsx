"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

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

    // 1. Fetch Trips in Month
    const { data: trips } = await supabase
      .from('trips')
      .select('freight_revenue, driver_bata, halt_bata, enroute_repairs_maintenance')
      .gte('trip_start_date', firstDay)
      .lte('trip_start_date', lastDay);

    // 2. Fetch Fuel Logs in Month
    const { data: fuels } = await supabase
      .from('diesel_fuel_logs')
      .select('total_fuel_cost')
      .gte('fuel_date', firstDay)
      .lte('fuel_date', lastDay);

    // 3. Fetch Workshop Bills in Month
    const { data: bills } = await supabase
      .from('workshop_spares_bills')
      .select('bill_amount')
      .gte('bill_date', firstDay)
      .lte('bill_date', lastDay);

    let freight = 0; let bata = 0; let halt = 0; let enroute = 0;
    if (trips) {
      setTripCount(trips.length);
      trips.forEach(t => {
        freight += Number(t.freight_revenue) || 0;
        bata += Number(t.driver_bata) || 0;
        halt += Number(t.halt_bata) || 0;
        enroute += Number(t.enroute_repairs_maintenance) || 0;
      });
    }

    let diesel = 0;
    if (fuels) {
      fuels.forEach(f => { diesel += Number(f.total_fuel_cost) || 0; });
    }

    let workshop = 0;
    if (bills) {
      bills.forEach(b => { workshop += Number(b.bill_amount) || 0; });
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
    <div className="space-y-6 animate-in fade-in duration-300" style={{ colorScheme: 'light' }}>
      
      {/* Top Bar: Month Selector & Export */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-fg uppercase tracking-tight">Monthly P&L Statement</h3>
          <p className="text-xs text-fg-secondary mt-0.5">Comprehensive financial performance ledger for the selected month.</p>
        </div>
        <div className="flex items-center gap-3">
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)} 
            className="text-sm p-2.5 rounded-xl border border-slate-300 font-bold bg-surface text-fg outline-none focus:ring-2 focus:ring-[#FF5A00]" 
          />
          <button 
            onClick={exportPLToCSV} 
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold text-sm rounded-xl transition-all shadow-sm flex items-center gap-2"
          >
            <span>📊</span> Export CSV
          </button>
        </div>
      </div>

      {/* P&L Statement Card */}
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden max-w-4xl mx-auto relative">
        {isLoading && (
          <div className="absolute inset-0 bg-surface/70 backdrop-blur-sm z-10 flex items-center justify-center">
            <span className="font-bold text-[#FF5A00] animate-pulse">Calculating P&L...</span>
          </div>
        )}

        <div className="p-6 sm:p-8 bg-slate-900 text-white flex justify-between items-center">
          <div>
            <p className="text-[10px] font-bold text-[#FF5A00] uppercase tracking-widest">KSS Roadways Pvt Ltd</p>
            <h2 className="text-xl sm:text-2xl font-black mt-1">Profit & Loss Statement</h2>
            <p className="text-xs text-fg-muted mt-0.5">Period: {selectedMonth} ({tripCount} Trips Logged)</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-fg-muted uppercase tracking-wider">Net Margin</p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-400">{netMarginPct.toFixed(2)}%</p>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          
          {/* REVENUE SECTION */}
          <div>
            <h4 className="text-xs font-black text-fg-muted uppercase tracking-wider mb-3">1. Revenue</h4>
            <div className="bg-app border border-border rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-fg">Gross Freight Revenue</p>
                <p className="text-[11px] text-fg-secondary">Total billable earnings from completed/active trips</p>
              </div>
              <p className="text-base sm:text-lg font-black text-emerald-600">₹ {formatAmt(totalFreight)}</p>
            </div>
          </div>

          {/* OPERATING EXPENSES SECTION */}
          <div>
            <h4 className="text-xs font-black text-fg-muted uppercase tracking-wider mb-3">2. Operating Expenses (OPEX)</h4>
            <div className="space-y-2">
              <div className="bg-surface border border-border rounded-xl p-4 flex justify-between items-center hover:bg-app">
                <p className="text-sm font-semibold text-fg">Diesel Fuel Consumption</p>
                <p className="text-sm font-bold text-rose-600">₹ {formatAmt(totalDiesel)}</p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-4 flex justify-between items-center hover:bg-app">
                <p className="text-sm font-semibold text-fg">Driver Bata</p>
                <p className="text-sm font-bold text-rose-600">₹ {formatAmt(totalBata)}</p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-4 flex justify-between items-center hover:bg-app">
                <p className="text-sm font-semibold text-fg">Halt Bata</p>
                <p className="text-sm font-bold text-rose-600">₹ {formatAmt(totalHaltBata)}</p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-4 flex justify-between items-center hover:bg-app">
                <p className="text-sm font-semibold text-fg">Enroute Repairs & Maintenance</p>
                <p className="text-sm font-bold text-rose-600">₹ {formatAmt(totalEnrouteRepairs)}</p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-4 flex justify-between items-center hover:bg-app">
                <p className="text-sm font-semibold text-fg">Workshop Spares & Service Bills</p>
                <p className="text-sm font-bold text-rose-600">₹ {formatAmt(totalWorkshopBills)}</p>
              </div>
            </div>

            <div className="mt-3 bg-rose-50 border border-rose-200 rounded-xl p-4 flex justify-between items-center">
              <p className="text-xs font-black text-rose-900 uppercase">Total Operating Expenses</p>
              <p className="text-base sm:text-lg font-black text-rose-700">₹ {formatAmt(totalOperatingExpenses)}</p>
            </div>
          </div>

          {/* NET PROFIT SUMMARY BOX */}
          <div className="pt-6 border-t-2 border-border">
            <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${netProfit >= 0 ? 'bg-emerald-900 text-white border-emerald-800 shadow-lg' : 'bg-rose-900 text-white border-rose-800 shadow-lg'}`}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Net Profit / Retention</p>
                <h3 className="text-2xl sm:text-3xl font-black mt-1">₹ {formatAmt(netProfit)}</h3>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs opacity-80 font-bold">Operating Margin Status</p>
                <p className="text-sm font-bold mt-0.5">{netProfit >= 0 ? '🟢 Profitable Month' : '🔴 Net Loss Month'}</p>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
