"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function FinancialsModule() {
  const supabase = createClient();
  const [finNav, setFinNav] = useState("💵 Driver Settlement");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Master Data
  const [drivers, setDrivers] = useState<any[]>([]);

  // Filter States
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default to 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  // Settlement Data States
  const [driverTrips, setDriverTrips] = useState<any[]>([]);
  const [driverAdvances, setDriverAdvances] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

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

    // 1. Fetch Trips for this driver in date range
    const { data: trips } = await supabase
      .from('trips')
      .select(`
        trip_id, trip_start_date, trip_number, origin, destination, fuel_litres, 
        driver_bata, halt_bata, cash_advance_issued, settlement_status,
        vehicles ( vehicle_number )
      `)
      .eq('primary_driver_id', selectedDriverId)
      .gte('trip_start_date', fromDate)
      .lte('trip_start_date', toDate)
      .order('trip_start_date', { ascending: true });

    // 2. Fetch Direct Advances from Fuel & Adv module
    const { data: advances } = await supabase
      .from('driver_direct_advances')
      .select('*')
      .eq('driver_id', selectedDriverId)
      .gte('advance_date', fromDate)
      .lte('advance_date', toDate)
      .order('advance_date', { ascending: true });

    if (trips) setDriverTrips(trips);
    if (advances) setDriverAdvances(advances);
    
    setIsProcessing(false);
  };

  // --- MATH CALCULATIONS EXACTLY MATCHING STREAMLIT ---
  let grandTotalBata = 0;
  let grandTotalAdv = 0;
  let grandTotalDiesel = 0;

  driverTrips.forEach(t => {
    const tBata = (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0);
    const tAdv = Number(t.cash_advance_issued) || 0;
    grandTotalBata += tBata;
    grandTotalAdv += tAdv;
    grandTotalDiesel += (Number(t.fuel_litres) || 0);
  });

  driverAdvances.forEach(a => {
    grandTotalAdv += (Number(a.amount_inr) || 0);
  });

  const finalBalancePayable = grandTotalBata - grandTotalAdv;
  const selectedDriverObj = drivers.find(d => String(d.driver_id) === selectedDriverId);

  // --- MARK AS SETTLED LOGIC ---
  const handleMarkSettled = async () => {
    if (!confirm(`Are you sure you want to mark these records as SETTLED for ${selectedDriverObj?.full_name}?`)) return;
    setIsProcessing(true);

    // Update Trips
    await supabase.from('trips')
      .update({ settlement_status: 'SETTLED' })
      .eq('primary_driver_id', selectedDriverId)
      .gte('trip_start_date', fromDate)
      .lte('trip_start_date', toDate);

    // Update Direct Advances (Assuming schema has is_settled based on your legacy code)
    await supabase.from('driver_direct_advances')
      .update({ is_settled: true })
      .eq('driver_id', selectedDriverId)
      .gte('advance_date', fromDate)
      .lte('advance_date', toDate);

    alert("Records successfully marked as SETTLED!");
    generateSettlement(); // Refresh the view
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Sub-Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {["💵 Driver Settlement", "📈 Analytics & Margins"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFinNav(tab)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              finNav === tab 
                ? "bg-indigo-600 text-white shadow-md" 
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {finNav === "💵 Driver Settlement" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          
          {/* SEARCH FILTERS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Driver *</label>
              <select 
                value={selectedDriverId} 
                onChange={(e) => { setSelectedDriverId(e.target.value); setHasSearched(false); }}
                className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                disabled={isLoading}
              >
                <option value="">-- SELECT DRIVER --</option>
                {drivers.map(d => (
                  <option key={d.driver_id} value={d.driver_id}>{d.driver_code} - {d.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">From Date *</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex items-end">
              <div className="w-full">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">To Date *</label>
                <div className="flex gap-2">
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button 
                    onClick={generateSettlement} 
                    disabled={isProcessing || !selectedDriverId}
                    className="px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors disabled:bg-slate-300"
                  >
                    Load
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RESULTS AREA */}
          {hasSearched && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4">
              
              {/* MASTER SUMMARY CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Total Diesel Issued</p>
                  <p className="text-xl font-black text-slate-900">{grandTotalDiesel.toFixed(1)} L</p>
                </div>
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Total Bata Earned</p>
                  <p className="text-xl font-black text-emerald-700">₹{grandTotalBata.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50">
                  <p className="text-[10px] font-bold text-rose-700 uppercase mb-1">Total Adv Deducted</p>
                  <p className="text-xl font-black text-rose-700">₹{grandTotalAdv.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-600 text-white shadow-md">
                  <p className="text-[10px] font-bold text-indigo-200 uppercase mb-1">Balance Payable</p>
                  <p className="text-2xl font-black">₹{finalBalancePayable.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
              </div>

              {/* TRIPS TABLE */}
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase border-b border-slate-200 pb-2 mb-4">Trip Details</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50">
                      <tr className="text-left font-bold text-slate-500 uppercase">
                        <th className="px-4 py-3">Date / LR No</th>
                        <th className="px-4 py-3">Truck & Route</th>
                        <th className="px-4 py-3 text-right">Diesel (L)</th>
                        <th className="px-4 py-3 text-right">Bata (₹)</th>
                        <th className="px-4 py-3 text-right">Adv (₹)</th>
                        <th className="px-4 py-3 text-right">Trip Bal (₹)</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {driverTrips.map(t => {
                        const tripBata = (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0);
                        const tripAdv = Number(t.cash_advance_issued) || 0;
                        const tripBal = tripBata - tripAdv;
                        const isSettled = t.settlement_status === "SETTLED";
                        return (
                          <tr key={t.trip_id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-semibold text-slate-900">{t.trip_start_date}<br/><span className="text-slate-500 font-normal">{t.trip_number}</span></td>
                            <td className="px-4 py-3 text-slate-700 font-bold">{t.vehicles?.vehicle_number}<br/><span className="text-[10px] font-normal text-slate-500">{t.origin} ➔ {t.destination}</span></td>
                            <td className="px-4 py-3 text-right font-bold text-slate-700">{t.fuel_litres || 0}</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600">{tripBata}</td>
                            <td className="px-4 py-3 text-right font-bold text-rose-500">{tripAdv}</td>
                            <td className="px-4 py-3 text-right font-black text-indigo-700">{tripBal}</td>
                            <td className="px-4 py-3 text-center">
                              {isSettled ? <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold">SETTLED</span> : <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[9px] font-bold">PENDING</span>}
                            </td>
                          </tr>
                        );
                      })}
                      {driverTrips.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No trips logged in this period.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DIRECT ADVANCES TABLE */}
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase border-b border-slate-200 pb-2 mb-4">Direct Advances (From Fuel & Adv Module)</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50">
                      <tr className="text-left font-bold text-slate-500 uppercase">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Remarks</th>
                        <th className="px-4 py-3 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {driverAdvances.map(a => (
                        <tr key={a.advance_id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-900">{a.advance_date}</td>
                          <td className="px-4 py-3 text-slate-700">{a.advance_type}</td>
                          <td className="px-4 py-3 text-slate-500">{a.reference_remarks || "-"}</td>
                          <td className="px-4 py-3 text-right font-bold text-rose-500">{a.amount_inr}</td>
                        </tr>
                      ))}
                      {driverAdvances.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No direct advances in this period.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="pt-4 border-t border-slate-200 flex justify-end gap-4">
                <button 
                  onClick={() => window.print()} 
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all shadow-sm flex gap-2 items-center"
                >
                  🖨️ Print / Save PDF
                </button>
                <button 
                  onClick={handleMarkSettled}
                  disabled={isProcessing}
                  className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95"
                >
                  {isProcessing ? "Processing..." : "✅ Mark All as Settled"}
                </button>
              </div>

            </div>
          )}
        </div>
      )}

      {finNav === "📈 Analytics & Margins" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <p className="text-slate-500 font-medium">The Fleet Analytics & Margin dashboard will be mounted here.</p>
        </div>
      )}

    </div>
  );
}
