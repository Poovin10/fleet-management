"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function FinancialsModule() {
  const supabase = createClient();
  const [finNav, setFinNav] = useState("💵 Driver Settlement");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [driverTrips, setDriverTrips] = useState<any[]>([]);
  const [driverAdvances, setDriverAdvances] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const [analysisWindow, setAnalysisWindow] = useState("Current Fiscal Month");
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);
  
  const [sortMetric, setSortMetric] = useState("Total Net Retention (₹)");
  const [sortOrder, setSortOrder] = useState("Top Performers (Descending)");
  const [analyticsSubTab, setAnalyticsSubTab] = useState("📊 Fleet Retention");
  const [selectedVariant, setSelectedVariant] = useState("All Variants");

  const [fleetData, setFleetData] = useState<any[]>([]);
  const [driverScorecard, setDriverScorecard] = useState<any[]>([]);
  const [variantTypes, setVariantTypes] = useState<string[]>([]);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);

  // Helper to format dates from YYYY-MM-DD to DD/MM/YYYY
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    if (!dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const formatAmt = (amt: number) => {
    return (Number(amt) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const formatDec = (val: number) => {
    return (Number(val) || 0).toFixed(2);
  };

  useEffect(() => {
    async function fetchDrivers() {
      setIsLoading(true);
      const { data } = await supabase.from('drivers').select('*').eq('is_active', true).order('full_name');
      if (data) setDrivers(data);
      setIsLoading(false);
    }
    fetchDrivers();
  }, [supabase]);

  const generateSettlement = async () => {
    if (!selectedDriverId) return alert("Please select a driver first.");
    setIsProcessing(true);
    setHasSearched(true);

    const { data: trips } = await supabase.from('trips').select(`trip_id, trip_start_date, trip_number, origin, destination, fuel_litres, driver_bata, halt_bata, cash_advance_issued, settlement_status, vehicles ( vehicle_number )`).eq('primary_driver_id', selectedDriverId).gte('trip_start_date', fromDate).lte('trip_start_date', toDate).order('trip_start_date', { ascending: true });
    const { data: advances } = await supabase.from('driver_direct_advances').select('*').eq('driver_id', selectedDriverId).gte('advance_date', fromDate).lte('advance_date', toDate).order('advance_date', { ascending: true });

    if (trips) setDriverTrips(trips);
    if (advances) setDriverAdvances(advances);
    setIsProcessing(false);
  };

  let grandTotalBata = 0; let grandTotalAdv = 0; let grandTotalDiesel = 0;
  driverTrips.forEach(t => {
    grandTotalBata += (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0);
    grandTotalAdv += Number(t.cash_advance_issued) || 0;
    grandTotalDiesel += (Number(t.fuel_litres) || 0);
  });
  driverAdvances.forEach(a => grandTotalAdv += (Number(a.amount_inr) || 0));
  const finalBalancePayable = grandTotalBata - grandTotalAdv;
  const selectedDriverObj = drivers.find(d => String(d.driver_id) === selectedDriverId);

  const handleMarkSettled = async () => {
    if (!confirm(`Mark records as SETTLED for ${selectedDriverObj?.full_name}?`)) return;
    setIsProcessing(true);
    await supabase.from('trips').update({ settlement_status: 'SETTLED' }).eq('primary_driver_id', selectedDriverId).gte('trip_start_date', fromDate).lte('trip_start_date', toDate);
    await supabase.from('driver_direct_advances').update({ is_settled: true }).eq('driver_id', selectedDriverId).gte('advance_date', fromDate).lte('advance_date', toDate);
    alert("Settled successfully!");
    generateSettlement(); 
  };

  const fetchAnalyticsData = async () => {
    setIsAnalyticsLoading(true);
    let sDate = null; let eDate = null;
    if (analysisWindow === "Current Fiscal Month") {
      const now = new Date();
      sDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      eDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
    } else if (analysisWindow === "Custom Dates") {
      sDate = customStart; eDate = customEnd;
    }

    const { data: activeVehicles } = await supabase.from('vehicles').select('vehicle_id, vehicle_number, truck_type').eq('is_active', true);
    const { data: activeDrivers } = await supabase.from('drivers').select('driver_id, driver_code, full_name').eq('is_active', true);
    
    let tQuery = supabase.from('trips').select('vehicle_id, primary_driver_id, trip_status, total_km_run, loaded_weight_mt, tonnage_loaded, freight_revenue, driver_bata, halt_bata, enroute_repairs_maintenance, fuel_litres');
    let fQuery = supabase.from('diesel_fuel_logs').select('vehicle_id, litres_filled, total_fuel_cost');
    
    if (sDate && eDate) {
      tQuery = tQuery.gte('trip_start_date', sDate).lte('trip_start_date', eDate);
      fQuery = fQuery.gte('fuel_date', sDate).lte('fuel_date', eDate);
    }

    const { data: trips } = await tQuery;
    const { data: fuels } = await fQuery;

    const fleetMetrics: any[] = [];
    const variants = new Set<string>();

    (activeVehicles || []).forEach(v => {
      variants.add(v.truck_type || "Unknown");
      const vTrips = (trips || []).filter(t => t.vehicle_id === v.vehicle_id);
      const vFuels = (fuels || []).filter(f => f.vehicle_id === v.vehicle_id);

      let trips_count = vTrips.length;
      let incomplete_trips = vTrips.filter(t => t.trip_status !== 'COMPLETED').length;
      let total_km = 0; let total_tons = 0; let total_freight = 0; let non_fuel_costs = 0;
      
      vTrips.forEach(t => {
        total_km += Number(t.total_km_run) || 0;
        total_tons += Number(t.loaded_weight_mt) || Number(t.tonnage_loaded) || 0;
        total_freight += Number(t.freight_revenue) || 0;
        non_fuel_costs += (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0) + (Number(t.enroute_repairs_maintenance) || 0);
      });

      let total_diesel_litres = 0; let total_diesel_cost = 0;
      vFuels.forEach(f => {
        total_diesel_litres += Number(f.litres_filled) || 0;
        total_diesel_cost += Number(f.total_fuel_cost) || 0;
      });

      const net_retention = total_freight - total_diesel_cost - non_fuel_costs;
      const retention_pct = total_freight > 0 ? (net_retention / total_freight) * 100 : 0;
      const diesel_pct = total_freight > 0 ? (total_diesel_cost / total_freight) * 100 : 0;
      const kmpl = total_diesel_litres > 0 ? total_km / total_diesel_litres : 0;

      fleetMetrics.push({
        vehicle_number: v.vehicle_number, truck_type: v.truck_type || "Unknown",
        total_trips: trips_count, incomplete_trips, total_tons, total_freight,
        total_diesel_litres, total_diesel_cost, net_retention,
        retention_pct, diesel_pct, kmpl
      });
    });

    setVariantTypes(Array.from(variants).sort());
    setFleetData(fleetMetrics);

    const driverMetrics: any[] = [];
    (activeDrivers || []).forEach(d => {
      const dTrips = (trips || []).filter(t => t.primary_driver_id === d.driver_id);
      if (dTrips.length > 0) {
        let trips = dTrips.length; let d_km = 0; let d_rev = 0; let d_fuel = 0;
        dTrips.forEach(t => {
          d_km += Number(t.total_km_run) || 0;
          d_rev += Number(t.freight_revenue) || 0;
          d_fuel += Number(t.fuel_litres) || 0;
        });
        driverMetrics.push({
          driver_code: d.driver_code, full_name: d.full_name,
          trips, total_km: d_km, revenue: d_rev,
          kmpl: d_fuel > 0 ? d_km / d_fuel : 0
        });
      }
    });

    setDriverScorecard(driverMetrics.sort((a, b) => b.revenue - a.revenue));
    setIsAnalyticsLoading(false);
  };

  useEffect(() => {
    if (finNav === "📈 Analytics & Margins") fetchAnalyticsData();
  }, [finNav, analysisWindow, customStart, customEnd]);

  const getSortedFleetData = () => {
    const METRIC_MAP: any = {
      "Total Net Retention (₹)": "net_retention", "Total Freight Revenue (₹)": "total_freight", 
      "Total Trips": "total_trips", "Incomplete Trips": "incomplete_trips", 
      "Total Tons (MT)": "total_tons", "Total Diesel (L)": "total_diesel_litres", 
      "Total Diesel Expense (₹)": "total_diesel_cost", "Retention %": "retention_pct", 
      "Diesel %": "diesel_pct", "KMPL": "kmpl"
    };
    
    let filtered = [...fleetData];
    if (analyticsSubTab === "⚖️ Variant Benchmarks" && selectedVariant !== "All Variants") {
      filtered = filtered.filter(f => f.truck_type === selectedVariant);
    }

    const key = METRIC_MAP[sortMetric];
    const isAsc = sortOrder.includes("Ascending");
    return filtered.sort((a, b) => isAsc ? a[key] - b[key] : b[key] - a[key]);
  };

  const sortedFleetData = getSortedFleetData();
  const aggFreight = sortedFleetData.reduce((acc, c) => acc + c.total_freight, 0);
  const aggDiesel = sortedFleetData.reduce((acc, c) => acc + c.total_diesel_cost, 0);
  const aggRetention = sortedFleetData.reduce((acc, c) => acc + c.net_retention, 0);
  const aggRetentionPct = aggFreight > 0 ? (aggRetention / aggFreight) * 100 : 0;

  // 🚀 CSV EXPORT FUNCTION
  const exportAnalyticsToCSV = () => {
    let headers: string[] = [];
    let rows: string[] = [];
    let filename = "";

    const sanitizeCsv = (val: any) => {
      let str = String(val ?? "");
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    if (analyticsSubTab === "👨‍✈️ Driver Scorecard") {
      if (driverScorecard.length === 0) return alert("No data to export.");
      headers = ["Driver Code", "Full Name", "Total Trips", "Total KM", "Est KMPL", "Revenue (INR)"];
      rows = driverScorecard.map(d => [
        d.driver_code, 
        d.full_name, 
        d.trips, 
        d.total_km.toFixed(1), 
        d.kmpl.toFixed(2), 
        d.revenue.toFixed(2)
      ].map(sanitizeCsv).join(","));
      filename = `Driver_Scorecard_${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      const data = sortedFleetData;
      if (data.length === 0) return alert("No data to export.");
      headers = ["Truck No", "Type", "Trips", "Tons (MT)", "Inc. Trips", "Freight (INR)", "Diesel (L)", "Diesel Cost (INR)", "Net Retention (INR)", "Retention %", "Diesel %", "KMPL"];
      rows = data.map(r => [
        r.vehicle_number, 
        r.truck_type, 
        r.total_trips, 
        r.total_tons.toFixed(2), 
        r.incomplete_trips,
        r.total_freight.toFixed(2), 
        r.total_diesel_litres.toFixed(2), 
        r.total_diesel_cost.toFixed(2),
        r.net_retention.toFixed(2), 
        r.retention_pct.toFixed(2), 
        r.diesel_pct.toFixed(2), 
        r.kmpl.toFixed(2)
      ].map(sanitizeCsv).join(","));
      filename = `Fleet_Analytics_${new Date().toISOString().split('T')[0]}.csv`;
    }

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* TABS */}
      <div className="flex flex-wrap gap-2 border-b border-[#272B36] pb-4">
        {["💵 Driver Settlement", "📈 Analytics & Margins"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFinNav(tab)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              finNav === tab 
                ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/20 ring-1 ring-[#FF5A00]" 
                : "bg-[#161922] text-slate-400 hover:text-white hover:bg-[#1E222D] border border-[#272B36]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {finNav === "💵 Driver Settlement" && (
        <div className="bg-[#161922] border border-[#272B36] rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Select Driver *</label>
              <select 
                value={selectedDriverId} 
                onChange={(e) => { setSelectedDriverId(e.target.value); setHasSearched(false); }}
                className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-bold"
                disabled={isLoading}
              >
                <option value="">-- SELECT DRIVER --</option>
                {drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.driver_code} - {d.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">From Date *</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" />
            </div>
            <div className="flex items-end">
              <div className="w-full">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">To Date *</label>
                <div className="flex gap-2">
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" />
                  <button onClick={generateSettlement} disabled={isProcessing || !selectedDriverId} className="px-5 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black rounded-xl transition-all shadow-sm disabled:bg-slate-700 active:scale-95">
                    Load
                  </button>
                </div>
              </div>
            </div>
          </div>

          {hasSearched && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-[#2B3142] bg-[#0F1117]">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Diesel Issued</p>
                  <p className="text-xl sm:text-2xl font-black text-white">{formatDec(grandTotalDiesel)} L</p>
                </div>
                <div className="p-4 rounded-xl border border-emerald-900/50 bg-emerald-950/20">
                  <p className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Total Bata Earned</p>
                  <p className="text-xl sm:text-2xl font-black text-emerald-400">₹{formatAmt(grandTotalBata)}</p>
                </div>
                <div className="p-4 rounded-xl border border-rose-900/50 bg-rose-950/20">
                  <p className="text-[10px] font-bold text-rose-500 uppercase mb-1">Total Adv Deducted</p>
                  <p className="text-xl sm:text-2xl font-black text-rose-400">₹{formatAmt(grandTotalAdv)}</p>
                </div>
                <div className="p-4 rounded-xl border border-[#FF5A00]/30 bg-[#FF5A00]/10 shadow-sm">
                  <p className="text-[10px] font-bold text-[#FF5A00] uppercase mb-1">Balance Payable</p>
                  <p className="text-xl sm:text-3xl font-black text-[#FF5A00]">₹{formatAmt(finalBalancePayable)}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black text-white uppercase border-b border-[#272B36] pb-2 mb-4">Trip Details</h4>
                <div className="overflow-x-auto rounded-xl border border-[#272B36] w-full max-h-80">
                  <table className="min-w-full divide-y divide-[#272B36] text-xs whitespace-nowrap">
                    <thead className="bg-[#0F1117] sticky top-0">
                      <tr className="text-left font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-4 py-3 border-b border-[#272B36]">Date / LR No</th>
                        <th className="px-4 py-3 border-b border-[#272B36]">Truck & Route</th>
                        <th className="px-4 py-3 text-right border-b border-[#272B36]">Diesel (L)</th>
                        <th className="px-4 py-3 text-right border-b border-[#272B36]">Bata (₹)</th>
                        <th className="px-4 py-3 text-right border-b border-[#272B36]">Adv (₹)</th>
                        <th className="px-4 py-3 text-right border-b border-[#272B36]">Trip Bal (₹)</th>
                        <th className="px-4 py-3 text-center border-b border-[#272B36]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-[#161922] divide-y divide-[#272B36]">
                      {driverTrips.map(t => {
                        const tripBata = (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0);
                        const tripAdv = Number(t.cash_advance_issued) || 0;
                        const tripBal = tripBata - tripAdv;
                        const isSettled = t.settlement_status === "SETTLED";
                        return (
                          <tr key={t.trip_id} className="hover:bg-[#1E222D]">
                            <td className="px-4 py-3 font-semibold text-white">{formatDate(t.trip_start_date)}<br/><span className="text-slate-500 font-bold">{t.trip_number}</span></td>
                            <td className="px-4 py-3 text-white font-bold">{t.vehicles?.vehicle_number}<br/><span className="text-[10px] font-bold text-slate-500">{t.origin} ➔ {t.destination}</span></td>
                            <td className="px-4 py-3 text-right font-black text-white">{formatDec(t.fuel_litres)}</td>
                            <td className="px-4 py-3 text-right font-black text-emerald-400">{formatAmt(tripBata)}</td>
                            <td className="px-4 py-3 text-right font-black text-rose-400">{formatAmt(tripAdv)}</td>
                            <td className="px-4 py-3 text-right font-black text-[#FF5A00]">{formatAmt(tripBal)}</td>
                            <td className="px-4 py-3 text-center">
                              {isSettled ? <span className="px-2 py-1 bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 rounded text-[9px] font-black uppercase tracking-wider">SETTLED</span> : <span className="px-2 py-1 bg-amber-950/40 border border-amber-900/50 text-amber-500 rounded text-[9px] font-black uppercase tracking-wider">PENDING</span>}
                            </td>
                          </tr>
                        );
                      })}
                      {driverTrips.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500 font-medium">No trips logged in this period.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black text-white uppercase border-b border-[#272B36] pb-2 mb-4">Direct Advances</h4>
                <div className="overflow-x-auto rounded-xl border border-[#272B36] w-full max-h-60">
                  <table className="min-w-full divide-y divide-[#272B36] text-xs whitespace-nowrap">
                    <thead className="bg-[#0F1117] sticky top-0">
                      <tr className="text-left font-bold text-slate-400 uppercase tracking-wider"><th className="px-4 py-3 border-b border-[#272B36]">Date</th><th className="px-4 py-3 border-b border-[#272B36]">Category</th><th className="px-4 py-3 border-b border-[#272B36]">Remarks</th><th className="px-4 py-3 text-right border-b border-[#272B36]">Amount (₹)</th></tr>
                    </thead>
                    <tbody className="bg-[#161922] divide-y divide-[#272B36]">
                      {driverAdvances.map(a => (
                        <tr key={a.advance_id} className="hover:bg-[#1E222D]">
                          <td className="px-4 py-3 font-semibold text-white">{formatDate(a.advance_date)}</td><td className="px-4 py-3 text-slate-300 font-bold">{a.advance_type}</td><td className="px-4 py-3 text-slate-500">{a.reference_remarks || "-"}</td><td className="px-4 py-3 text-right font-black text-rose-400">{formatAmt(a.amount_inr)}</td>
                        </tr>
                      ))}
                      {driverAdvances.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500 font-medium">No direct advances in this period.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-4 border-t border-[#272B36] flex justify-end gap-4">
                <button onClick={handleMarkSettled} disabled={isProcessing} className="px-8 py-3 bg-[#FF5A00] hover:bg-[#e04f00] disabled:bg-slate-700 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20 active:scale-95">
                  {isProcessing ? "Processing..." : "✅ Mark All as Settled"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {finNav === "📈 Analytics & Margins" && (
        <div className="bg-[#161922] border border-[#272B36] rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Analysis Window</label>
              <select value={analysisWindow} onChange={e => setAnalysisWindow(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-bold">
                <option value="Current Fiscal Month">Current Fiscal Month</option>
                <option value="Lifetime Fleet">Lifetime Fleet</option>
                <option value="Custom Dates">Custom Dates</option>
              </select>
            </div>
            {analysisWindow === "Custom Dates" && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">From Date</label>
                  <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">To Date</label>
                  <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00]" />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-[#272B36] pb-6 mb-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sort By Metric</label>
              <select value={sortMetric} onChange={e => setSortMetric(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold">
                <option value="Total Net Retention (₹)">Total Net Retention (₹)</option>
                <option value="Total Freight Revenue (₹)">Total Freight Revenue (₹)</option>
                <option value="Total Trips">Total Trips</option>
                <option value="Incomplete Trips">Incomplete Trips</option>
                <option value="Total Tons (MT)">Total Tons (MT)</option>
                <option value="Total Diesel (L)">Total Diesel (L)</option>
                <option value="Total Diesel Expense (₹)">Total Diesel Expense (₹)</option>
                <option value="Retention %">Retention %</option>
                <option value="Diesel %">Diesel %</option>
                <option value="KMPL">KMPL</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sort Order</label>
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold">
                <option value="Top Performers (Descending)">Top Performers (Descending)</option>
                <option value="Underperformers (Ascending)">Underperformers (Ascending)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap gap-4">
              {["📊 Fleet Retention", "⚖️ Variant Benchmarks", "👨‍✈️ Driver Scorecard"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAnalyticsSubTab(tab)}
                  className={`pb-2 text-sm font-bold transition-all duration-200 border-b-2 ${
                    analyticsSubTab === tab ? "border-[#FF5A00] text-[#FF5A00]" : "border-transparent text-slate-500 hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
              {analyticsSubTab === "⚖️ Variant Benchmarks" && (
                <select value={selectedVariant} onChange={e => setSelectedVariant(e.target.value)} className="ml-auto text-xs p-2 rounded-lg border border-[#2B3142] font-bold text-white bg-[#0F1117] outline-none">
                  <option value="All Variants">All Variants</option>
                  {variantTypes.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
            </div>

            <button onClick={exportAnalyticsToCSV} className="px-6 py-2.5 bg-[#0F1117] hover:bg-[#1A1F2C] border border-[#272B36] text-emerald-400 font-bold text-sm rounded-xl transition-all shadow-sm flex items-center gap-2 active:scale-95">
              <span className="text-lg leading-none">📊</span> Export CSV
            </button>
          </div>

          {analyticsSubTab !== "👨‍✈️ Driver Scorecard" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="p-4 rounded-xl border border-[#2B3142] bg-[#1A1F2C] min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase mb-1 truncate">Fleet Revenue</p>
                <p style={{ fontSize: 'clamp(1.1rem, 2vw, 1.875rem)' }} className="font-black text-white leading-none whitespace-nowrap">₹{formatAmt(aggFreight)}</p>
              </div>
              <div className="p-4 rounded-xl border border-rose-900/50 bg-rose-950/20 min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-rose-500 uppercase mb-1 truncate">Diesel Cost</p>
                <p style={{ fontSize: 'clamp(1.1rem, 2vw, 1.875rem)' }} className="font-black text-rose-400 leading-none whitespace-nowrap">₹{formatAmt(aggDiesel)}</p>
              </div>
              <div className="p-4 rounded-xl border border-emerald-900/50 bg-emerald-950/20 min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-emerald-500 uppercase mb-1 truncate">Net Margin</p>
                <p style={{ fontSize: 'clamp(1.1rem, 2vw, 1.875rem)' }} className="font-black text-emerald-400 leading-none whitespace-nowrap">₹{formatAmt(aggRetention)}</p>
              </div>
              <div className="p-4 rounded-xl border border-[#FF5A00]/30 bg-[#FF5A00]/10 min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-[#FF5A00] uppercase mb-1 truncate">Retention %</p>
                <p style={{ fontSize: 'clamp(1.1rem, 2vw, 1.875rem)' }} className="font-black text-[#FF5A00] leading-none whitespace-nowrap">{formatDec(aggRetentionPct)}%</p>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-[#272B36] relative min-h-[300px] w-full">
            {isAnalyticsLoading && (
              <div className="absolute inset-0 bg-[#161922]/80 backdrop-blur-sm z-10 flex items-center justify-center">
                <span className="font-bold text-[#FF5A00] animate-pulse">Aggregating Metrics...</span>
              </div>
            )}
            
            {(analyticsSubTab === "📊 Fleet Retention" || analyticsSubTab === "⚖️ Variant Benchmarks") && (
              <table className="min-w-full divide-y divide-[#272B36] text-xs text-right whitespace-nowrap">
                <thead className="bg-[#0F1117] sticky top-0 z-10">
                  <tr className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="px-4 py-4 text-left border-b border-[#272B36]">Truck No</th>
                    <th className="px-4 py-4 text-left border-b border-[#272B36]">Type</th>
                    <th className="px-4 py-4 border-b border-[#272B36]">Trips</th>
                    <th className="px-4 py-4 border-b border-[#272B36]">Tons (MT)</th>
                    <th className="px-4 py-4 border-b border-[#272B36]">Inc. Trips</th>
                    <th className="px-4 py-4 border-b border-[#272B36]">Freight (₹)</th>
                    <th className="px-4 py-4 border-b border-[#272B36]">Diesel (L)</th>
                    <th className="px-4 py-4 border-b border-[#272B36]">Diesel Cost (₹)</th>
                    <th className="px-4 py-4 border-b border-[#272B36]">Net Ret (₹)</th>
                    <th className="px-4 py-4 border-b border-[#272B36]">Ret %</th>
                    <th className="px-4 py-4 border-b border-[#272B36]">Diesel %</th>
                    <th className="px-4 py-4 border-b border-[#272B36]">KMPL</th>
                  </tr>
                </thead>
                <tbody className="bg-[#161922] divide-y divide-[#272B36]">
                  {sortedFleetData.map((row: any) => (
                    <tr key={row.vehicle_number} className="hover:bg-[#1E222D]">
                      <td className="px-4 py-3 text-left font-black text-white">{row.vehicle_number}</td>
                      <td className="px-4 py-3 text-left font-bold text-slate-400">{row.truck_type}</td>
                      <td className="px-4 py-3 font-black text-white">{row.total_trips}</td>
                      <td className="px-4 py-3 font-semibold text-slate-400">{formatDec(row.total_tons)}</td>
                      <td className="px-4 py-3 text-rose-500 font-bold">{row.incomplete_trips}</td>
                      <td className="px-4 py-3 font-bold text-slate-300">{formatAmt(row.total_freight)}</td>
                      <td className="px-4 py-3 font-bold text-slate-400">{formatDec(row.total_diesel_litres)}</td>
                      <td className="px-4 py-3 font-bold text-rose-400">{formatAmt(row.total_diesel_cost)}</td>
                      <td className="px-4 py-3 font-black text-[#FF5A00]">{formatAmt(row.net_retention)}</td>
                      <td className="px-4 py-3 font-black text-emerald-400">{formatDec(row.retention_pct)}%</td>
                      <td className="px-4 py-3 font-bold text-slate-400">{formatDec(row.diesel_pct)}%</td>
                      <td className="px-4 py-3 font-bold text-amber-500">{formatDec(row.kmpl)}</td>
                    </tr>
                  ))}
                  {sortedFleetData.length === 0 && !isAnalyticsLoading && (
                    <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-500 font-medium">No fleet data found for this period.</td></tr>
                  )}
                </tbody>
              </table>
            )}

            {analyticsSubTab === "👨‍✈️ Driver Scorecard" && (
              <table className="min-w-full divide-y divide-[#272B36] text-xs text-right whitespace-nowrap">
                <thead className="bg-[#0F1117] sticky top-0 z-10">
                  <tr className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="px-6 py-4 text-left border-b border-[#272B36]">Driver Code</th>
                    <th className="px-6 py-4 text-left border-b border-[#272B36]">Full Name</th>
                    <th className="px-6 py-4 border-b border-[#272B36]">Total Trips</th>
                    <th className="px-6 py-4 border-b border-[#272B36]">Total KM</th>
                    <th className="px-6 py-4 border-b border-[#272B36]">Est KMPL</th>
                    <th className="px-6 py-4 border-b border-[#272B36]">Generated Revenue (₹)</th>
                  </tr>
                </thead>
                <tbody className="bg-[#161922] divide-y divide-[#272B36]">
                  {driverScorecard.map((row: any) => (
                    <tr key={row.driver_code} className="hover:bg-[#1E222D]">
                      <td className="px-6 py-4 text-left font-black text-white">{row.driver_code}</td>
                      <td className="px-6 py-4 text-left font-bold text-slate-300">{row.full_name}</td>
                      <td className="px-6 py-4 font-black text-[#FF5A00]">{row.trips}</td>
                      <td className="px-6 py-4 font-semibold text-slate-400">{formatDec(row.total_km)}</td>
                      <td className="px-6 py-4 font-black text-amber-500">{formatDec(row.kmpl)}</td>
                      <td className="px-6 py-4 font-black text-emerald-400">₹{formatAmt(row.revenue)}</td>
                    </tr>
                  ))}
                  {driverScorecard.length === 0 && !isAnalyticsLoading && (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-medium">No driver activity logged in this period.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
