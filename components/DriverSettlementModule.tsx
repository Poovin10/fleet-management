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
    if (!confirm(`Mark records as SETTLED for this period?`)) return;
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

  let grandTotalFreight = 0; let grandTotalBata = 0; let grandTotalTripAdv = 0;
  Object.values(tripsByTruck).forEach((tripsArr: any) => {
    tripsArr.forEach((t: any) => {
      grandTotalFreight += Number(t.freight_revenue) || 0;
      grandTotalBata += (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0);
      grandTotalTripAdv += Number(t.cash_advance_issued) || 0;
    });
  });

  let directAdvTotal = 0;
  driverAdvances.forEach(a => directAdvTotal += Number(a.amount_inr) || 0);

  const finalBalancePayable = grandTotalBata - grandTotalTripAdv - directAdvTotal;
  const selectedDriverObj = drivers.find(d => String(d.driver_id) === selectedDriverId);

  const exportToCSV = () => {
    if (!selectedDriverObj) return;
    const sanitize = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows: string[] = [];
    rows.push(["DRIVER SETTLEMENT STATEMENT"].join(","));
    rows.push(["Driver", sanitize(selectedDriverObj.full_name), "Code", sanitize(selectedDriverObj.driver_code)].join(","));
    rows.push(["Period", sanitize(`${formatDate(fromDate)} to ${formatDate(toDate)}`), "Generated", sanitize(new Date().toISOString().split('T')[0])].join(","));
    rows.push(""); // FIXED: Pushing empty string instead of empty array

    Object.entries(tripsByTruck).forEach(([truckNo, tArr]: any) => {
      rows.push([sanitize(`--- TRUCK NO: ${truckNo} ---`)].join(","));
      rows.push(["Date", "LR Number", "Route", "Freight (INR)", "Total Bata (INR)", "Trip Advance (INR)", "Net Balance (INR)", "Status"].map(sanitize).join(","));
      let trFreight = 0; let trBata = 0; let trAdv = 0;
      tArr.forEach((t: any) => {
        const tb = (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0); const ta = Number(t.cash_advance_issued) || 0;
        trFreight += Number(t.freight_revenue) || 0; trBata += tb; trAdv += ta;
        rows.push([formatDate(t.trip_start_date), t.trip_number || "-", `${t.origin} to ${t.destination}`, t.freight_revenue || 0, tb, ta, tb - ta, t.settlement_status || "PENDING"].map(sanitize).join(","));
      });
      rows.push(["TRUCK SUBTOTAL", "", "", trFreight.toFixed(2), trBata.toFixed(2), trAdv.toFixed(2), (trBata - trAdv).toFixed(2), ""].map(sanitize).join(","));
      rows.push(""); // FIXED
    });

    if (driverAdvances.length > 0) {
      rows.push(["--- DIRECT CASH ADVANCES ---"].join(","));
      rows.push(["Date", "Category", "Remarks", "Amount (INR)"].map(sanitize).join(","));
      driverAdvances.forEach(a => { rows.push([formatDate(a.advance_date), a.advance_type, a.reference_remarks || "-", a.amount_inr || 0].map(sanitize).join(",")); });
      rows.push(["ADVANCE SUBTOTAL", "", "", directAdvTotal.toFixed(2)].map(sanitize).join(","));
      rows.push(""); // FIXED
    }

    rows.push(["--- GRAND TOTALS ---"].join(","));
    rows.push(["Total Bata Earned", "", "", grandTotalBata.toFixed(2)].map(sanitize).join(","));
    rows.push(["Less: Trip Advances", "", "", grandTotalTripAdv.toFixed(2)].map(sanitize).join(","));
    rows.push(["Less: Direct Advances", "", "", directAdvTotal.toFixed(2)].map(sanitize).join(","));
    rows.push(["NET BALANCE PAYABLE", "", "", finalBalancePayable.toFixed(2)].map(sanitize).join(","));

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.setAttribute("download", `Settlement_${selectedDriverObj.driver_code}_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

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
      rows.push(["", "", "", "", "", ""]);
    }

    generateUniversalPdf(
      `Master Driver Settlement: ${selectedDriverObj.full_name} (${selectedDriverObj.driver_code})`,
      `Period: ${formatDate(fromDate)} to ${formatDate(toDate)} | Final Net Payable: Rs. ${formatAmt(finalBalancePayable)}`,
      headers, rows, `Settlement_${selectedDriverObj.driver_code}_${fromDate}_to_${toDate}`
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#272B36] pb-4">
        <div><h2 className="text-xl font-black text-white uppercase tracking-tight">Driver Accounting & Settlements</h2><p className="text-xs text-slate-400 mt-0.5">Generate multi-truck ledgers, calculate net balances, and export PDF statements.</p></div>
      </div>

      <div className="bg-[#161922] border border-[#272B36] rounded-2xl p-6 sm:p-8 shadow-xl max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Select Driver *</label>
            <select value={selectedDriverId} onChange={(e) => { setSelectedDriverId(e.target.value); setHasSearched(false); }} className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-bold">
              <option value="">-- SELECT DRIVER --</option>
              {drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.driver_code} - {d.full_name}</option>)}
            </select>
          </div>
          <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">From Date *</label><input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" /></div>
          <div className="flex items-end"><div className="w-full"><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">To Date *</label><div className="flex gap-2"><input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#0F1117] text-white outline-none focus:border-[#FF5A00] font-semibold" /><button onClick={generateSettlement} disabled={isProcessing || !selectedDriverId} className="px-6 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black rounded-xl transition-all shadow-sm disabled:bg-slate-700 active:scale-95 uppercase tracking-wide">Generate</button></div></div></div>
        </div>

        {hasSearched && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-[#2B3142] bg-[#0F1117]"><p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Trips</p><p className="text-xl sm:text-2xl font-black text-white">{driverTrips.length}</p></div>
              <div className="p-4 rounded-xl border border-emerald-900/50 bg-emerald-950/20"><p className="text-[10px] font-bold text-emerald-500 uppercase mb-1">Gross Bata Earned</p><p className="text-xl sm:text-2xl font-black text-emerald-400">₹{formatAmt(grandTotalBata)}</p></div>
              <div className="p-4 rounded-xl border border-rose-900/50 bg-rose-950/20"><p className="text-[10px] font-bold text-rose-500 uppercase mb-1">Total Deductions</p><p className="text-xl sm:text-2xl font-black text-rose-400">₹{formatAmt(grandTotalTripAdv + directAdvTotal)}</p></div>
              <div className="p-4 rounded-xl border border-[#FF5A00]/30 bg-[#FF5A00]/10 shadow-sm"><p className="text-[10px] font-bold text-[#FF5A00] uppercase mb-1">Net Balance Payable</p><p className="text-xl sm:text-3xl font-black text-[#FF5A00]">₹{formatAmt(finalBalancePayable)}</p></div>
            </div>

            <div className="space-y-6">
              {Object.entries(tripsByTruck).map(([truckNo, tArr]: any) => {
                let trFreight = 0; let trBata = 0; let trAdv = 0;
                return (
                  <div key={truckNo} className="border border-[#272B36] rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-[#12141C] px-5 py-3 border-b border-[#272B36] flex justify-between items-center"><h4 className="text-xs font-black text-[#FF5A00] uppercase tracking-wide">TRUCK: {truckNo}</h4></div>
                    <div className="overflow-x-auto w-full max-h-80 overflow-y-auto">
                      <table className="min-w-full divide-y divide-[#272B36] text-xs whitespace-nowrap">
                        <thead className="bg-[#0F1117] sticky top-0"><tr className="text-left font-bold text-slate-400 uppercase tracking-wider"><th className="px-4 py-3 border-b border-[#272B36]">Date / LR No</th><th className="px-4 py-3 border-b border-[#272B36]">Route</th><th className="px-4 py-3 text-right border-b border-[#272B36]">Freight (₹)</th><th className="px-4 py-3 text-right border-b border-[#272B36]">Bata (₹)</th><th className="px-4 py-3 text-right border-b border-[#272B36]">Trip Adv (₹)</th><th className="px-4 py-3 text-right border-b border-[#272B36]">Balance (₹)</th><th className="px-4 py-3 text-center border-b border-[#272B36]">Status</th></tr></thead>
                        <tbody className="bg-[#161922] divide-y divide-[#272B36]">
                          {tArr.map((t: any) => {
                            const tb = (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0); const ta = Number(t.cash_advance_issued) || 0;
                            trFreight += Number(t.freight_revenue) || 0; trBata += tb; trAdv += ta;
                            return (
                              <tr key={t.trip_id} className="hover:bg-[#1E222D]">
                                <td className="px-4 py-3 font-semibold text-white">{formatDate(t.trip_start_date)}<br/><span className="text-slate-500 font-bold">{t.trip_number || "-"}</span></td>
                                <td className="px-4 py-3 text-white font-bold"><span className="text-[10px] text-slate-400">{t.origin} ➔ {t.destination}</span></td>
                                <td className="px-4 py-3 text-right font-black text-slate-300">{formatAmt(t.freight_revenue)}</td>
                                <td className="px-4 py-3 text-right font-black text-emerald-400">{formatAmt(tb)}</td>
                                <td className="px-4 py-3 text-right font-black text-rose-400">{formatAmt(ta)}</td>
                                <td className="px-4 py-3 text-right font-black text-[#FF5A00]">{formatAmt(tb - ta)}</td>
                                <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded text-[9px] font-bold ${t.settlement_status === 'SETTLED' ? 'bg-emerald-950/40 text-emerald-400' : 'bg-amber-950/40 text-amber-500'}`}>{t.settlement_status || "PENDING"}</span></td>
                              </tr>
                            );
                          })}
                          <tr className="bg-[#0F1117]"><td colSpan={2} className="px-4 py-3 text-right font-black text-slate-400 uppercase tracking-widest">TRUCK SUBTOTAL</td><td className="px-4 py-3 text-right font-black text-white">₹{formatAmt(trFreight)}</td><td className="px-4 py-3 text-right font-black text-emerald-400">₹{formatAmt(trBata)}</td><td className="px-4 py-3 text-right font-black text-rose-400">₹{formatAmt(trAdv)}</td><td className="px-4 py-3 text-right font-black text-[#FF5A00]">₹{formatAmt(trBata - trAdv)}</td><td className="px-4 py-3"></td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              {Object.keys(tripsByTruck).length === 0 && <div className="p-8 text-center text-slate-500 font-medium bg-[#161922] border border-[#272B36] rounded-xl">No trips logged by this driver in the selected period.</div>}

              {driverAdvances.length > 0 && (
                <div className="border border-[#272B36] rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-[#12141C] px-5 py-3 border-b border-[#272B36]"><h4 className="text-xs font-black text-rose-400 uppercase tracking-wide">Direct Cash Advances</h4></div>
                  <div className="overflow-x-auto w-full max-h-60 overflow-y-auto">
                    <table className="min-w-full divide-y divide-[#272B36] text-xs whitespace-nowrap">
                      <thead className="bg-[#0F1117] sticky top-0"><tr className="text-left font-bold text-slate-400 uppercase tracking-wider"><th className="px-4 py-3 border-b border-[#272B36]">Date</th><th className="px-4 py-3 border-b border-[#272B36]">Category</th><th className="px-4 py-3 border-b border-[#272B36]">Remarks</th><th className="px-4 py-3 text-right border-b border-[#272B36]">Amount (₹)</th></tr></thead>
                      <tbody className="bg-[#161922] divide-y divide-[#272B36]">
                        {driverAdvances.map(a => (<tr key={a.advance_id} className="hover:bg-[#1E222D]"><td className="px-4 py-3 font-semibold text-white">{formatDate(a.advance_date)}</td><td className="px-4 py-3 text-slate-300 font-bold">{a.advance_type}</td><td className="px-4 py-3 text-slate-500">{a.reference_remarks || "-"}</td><td className="px-4 py-3 text-right font-black text-rose-400">{formatAmt(a.amount_inr)}</td></tr>))}
                        <tr className="bg-[#0F1117]"><td colSpan={3} className="px-4 py-3 text-right font-black text-slate-400 uppercase tracking-widest">ADVANCE SUBTOTAL</td><td className="px-4 py-3 text-right font-black text-rose-400">₹{formatAmt(directAdvTotal)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-8 border-t border-[#272B36] flex flex-wrap justify-between items-center gap-4">
              <div className="flex gap-3">
                <button onClick={exportToCSV} disabled={isProcessing} className="px-6 py-3 bg-[#0F1117] hover:bg-[#1A1F2C] border border-[#2B3142] text-emerald-400 font-black text-sm rounded-xl transition-all shadow-sm active:scale-95 uppercase tracking-wide">EXPORT CSV</button>
                <button onClick={exportToPDF} disabled={isProcessing} className="px-6 py-3 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-sm rounded-xl transition-all shadow-sm active:scale-95 uppercase tracking-wide">EXPORT PDF</button>
              </div>
              <button onClick={handleMarkSettled} disabled={isProcessing} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl transition-all shadow-lg active:scale-95 uppercase tracking-wide">MARK AS SETTLED</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
