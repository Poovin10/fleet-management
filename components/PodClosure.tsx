"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";

export function PodClosure({ onSuccess }: { onSuccess?: () => void }) {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dieselRate, setDieselRate] = useState<number>(95.0);

  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info" as "success" | "error" | "info"
  });

  // Active trips & pending list
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [selectedLr, setSelectedLr] = useState<string>("");
  const [currentTrip, setCurrentTrip] = useState<any>(null);

  // Form Fields
  const [podNo, setPodNo] = useState("");
  const [closingDate, setClosingDate] = useState(new Date().toISOString().split("T")[0]);
  const [unloadedMt, setUnloadedMt] = useState<number | "">("");
  const [closingKm, setClosingKm] = useState<number | "">("");
  const [haltBata, setHaltBata] = useState<number | "">("");
  const [claims, setClaims] = useState<number | "">("");
  const [closingDiesel, setClosingDiesel] = useState<number | "">("");
  const [isTankFull, setIsTankFull] = useState(false);

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

  // Fetch pending active trips and dynamic diesel rate
  const fetchActiveTrips = async () => {
    setIsLoading(true);
    const [tripsRes, dieselRes] = await Promise.all([
      supabase
        .from("trips")
        .select(`
          trip_id,
          trip_number,
          trip_start_date,
          origin,
          destination,
          loaded_weight_mt,
          start_km,
          fuel_litres,
          vehicle_id,
          primary_driver_id,
          vehicles ( vehicle_number ),
          drivers ( full_name, phone_number )
        `)
        .neq("trip_status", "COMPLETED")
        .order("trip_start_date", { ascending: true }),
      supabase
        .from("diesel_fuel_logs")
        .select("diesel_rate_per_litre")
        .order("fuel_date", { ascending: false })
        .order("fuel_log_id", { ascending: false })
        .limit(1)
    ]);

    if (tripsRes.data) {
      setActiveTrips(tripsRes.data);
    }

    if (dieselRes.data && dieselRes.data.length > 0 && dieselRes.data[0].diesel_rate_per_litre) {
      setDieselRate(Number(dieselRes.data[0].diesel_rate_per_litre));
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchActiveTrips();
  }, []);

  // Auto-fill fields when an LR is selected
  useEffect(() => {
    if (selectedLr) {
      const trip = activeTrips.find((t) => t.trip_number === selectedLr);
      if (trip) {
        setCurrentTrip(trip);
        setUnloadedMt(trip.loaded_weight_mt || 0);
        setClosingKm("");
        setHaltBata("");
        setClaims("");
        setClosingDiesel("");
        setIsTankFull(false);
      }
    } else {
      setCurrentTrip(null);
    }
  }, [selectedLr, activeTrips]);

  // Calculate Days Pending
  const getDaysPending = (startDateStr: string) => {
    if (!startDateStr) return 0;
    const start = new Date(startDateStr).getTime();
    const today = new Date().getTime();
    const diff = Math.floor((today - start) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const handleSettlePod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTrip || !podNo.trim()) {
      setAlertConfig({
        isOpen: true,
        title: "Missing Information",
        message: "Please enter a valid POD Number to proceed.",
        type: "error"
      });
      return;
    }

    setIsSubmitting(true);
    const loadedMt = Number(currentTrip.loaded_weight_mt) || 0;
    const finalUnloadedMt = Number(unloadedMt) || 0;
    const shortageMt = Math.max(0, loadedMt - finalUnloadedMt);

    const startKm = Number(currentTrip.start_km) || 0;
    const endKm = Number(closingKm) || 0;
    const totalKmRun = endKm > startKm ? endKm - startKm : 0;

    const addDiesel = Number(closingDiesel) || 0;
    const addedDieselCost = Math.round(addDiesel * dieselRate * 100) / 100;

    // 1. Update Trip row to COMPLETED
    const { error: tripUpdateError } = await supabase
      .from("trips")
      .update({
        pod_number: podNo.trim().toUpperCase(),
        trip_end_date: closingDate,
        end_km: endKm,
        total_km_run: totalKmRun,
        unloaded_weight_mt: finalUnloadedMt,
        shortage_mt: shortageMt,
        halt_bata: Number(haltBata) || 0,
        enroute_repairs_maintenance: Number(claims) || 0,
        fuel_litres: (Number(currentTrip.fuel_litres) || 0) + addDiesel,
        trip_status: "COMPLETED",
        trip_closed_at: new Date().toISOString()
      })
      .eq("trip_id", currentTrip.trip_id);

    if (tripUpdateError) {
      setAlertConfig({
        isOpen: true,
        title: "Closure Failed",
        message: "Error updating trip: " + tripUpdateError.message,
        type: "error"
      });
      setIsSubmitting(false);
      return;
    }

    // 2. Insert Closing Diesel into diesel_fuel_logs if entered
    if (addDiesel > 0) {
      await supabase.from("diesel_fuel_logs").insert([
        {
          fuel_date: closingDate,
          vehicle_id: currentTrip.vehicle_id,
          trip_id: currentTrip.trip_id,
          lr_number: currentTrip.trip_number,
          diesel_category: "TRIP_DIESEL",
          litres_filled: addDiesel,
          diesel_rate_per_litre: dieselRate,
          total_fuel_cost: addedDieselCost,
          filling_odometer_km: endKm,
          is_tank_full: isTankFull
        }
      ]);
    }

    // 3. Mark vehicle as AVAILABLE_FOR_LOAD
    await supabase
      .from("vehicles")
      .update({
        current_status: "AVAILABLE_FOR_LOAD",
        status_remarks: "Available (Auto-Closed on POD)"
      })
      .eq("vehicle_id", currentTrip.vehicle_id);

    // Trigger Success Alert
    setAlertConfig({
      isOpen: true,
      title: "POD Settled!",
      message: `Trip ${currentTrip.trip_number} successfully closed and settled!`,
      type: "success"
    });

    setIsSubmitting(false);

    // Reset state & refresh active list
    setSelectedLr("");
    setPodNo("");
    setCurrentTrip(null);
    fetchActiveTrips();
    if (onSuccess) onSuccess();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-300 relative">
      
      <AlertModal 
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />

      {/* LEFT PANEL: Settle POD Form */}
      <div className="lg:col-span-7 bg-[#12141C] border border-[#222634] rounded-2xl p-6 shadow-sm">
        <div className="border-b border-[#222634] pb-4 mb-6">
          <h3 className="text-base font-black text-white uppercase tracking-tight">Record POD & Settle Trip</h3>
          <p className="text-xs text-slate-400 mt-1">Finalize transit records, calculate shortages, and record closing top-ups.</p>
        </div>

        {activeTrips.length === 0 && !isLoading ? (
          <div className="p-8 text-center bg-emerald-950/20 border border-emerald-900/50 rounded-xl">
            <p className="text-sm font-bold text-emerald-400">All PODs are settled! No active trips pending closure.</p>
          </div>
        ) : (
          <form onSubmit={handleSettlePod} className="space-y-5">
            
            {/* LR Selection */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Search & Select Active LR *</label>
              <select
                value={selectedLr}
                onChange={(e) => setSelectedLr(e.target.value)}
                className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#1A1F2C] font-bold text-white outline-none focus:border-[#FF5A00]"
                required
              >
                <option value="">-- SELECT LR TO CLOSE --</option>
                {activeTrips.map((t) => (
                  <option key={t.trip_id} value={t.trip_number}>
                    LR: {t.trip_number} | Date: {formatDate(t.trip_start_date)} | Truck: {t.vehicles?.vehicle_number || "Unknown"}
                  </option>
                ))}
              </select>
            </div>

            {currentTrip && (
              <>
                {/* Trip Quick Insight Banner */}
                <div className="p-4 bg-[#0F1117] border border-[#222634] rounded-xl flex flex-wrap gap-4 justify-between text-xs text-slate-300">
                  <span><strong className="text-slate-500">DRIVER:</strong> <br/><span className="font-bold text-white">{currentTrip.drivers?.full_name || "Unassigned"}</span></span>
                  <span><strong className="text-slate-500">ROUTE:</strong> <br/><span className="font-bold text-white">{currentTrip.origin} ➔ {currentTrip.destination}</span></span>
                  <span><strong className="text-slate-500">DISPATCHED:</strong> <br/><span className="font-black text-[#FF5A00]">{currentTrip.loaded_weight_mt} MT</span></span>
                </div>

                {/* ROW 1: POD No, Closing Date, Unloaded MT */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">POD No *</label>
                    <input
                      type="text"
                      value={podNo}
                      onChange={(e) => setPodNo(e.target.value)}
                      placeholder="e.g. POD-8821"
                      className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#1A1F2C] text-white uppercase font-bold outline-none focus:border-[#FF5A00]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Closing Date *</label>
                    <input
                      type="date"
                      value={closingDate}
                      onChange={(e) => setClosingDate(e.target.value)}
                      className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#1A1F2C] text-white font-semibold outline-none focus:border-[#FF5A00]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unloaded MT</label>
                    <input
                      type="number"
                      step="0.01"
                      value={unloadedMt}
                      onChange={(e) => setUnloadedMt(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      placeholder="0.00"
                      className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#1A1F2C] text-white font-semibold outline-none focus:border-[#FF5A00]"
                    />
                  </div>
                </div>

                {/* ROW 2: Closing KM, Halt Bata, Claims */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Closing KM *</label>
                    <input
                      type="number"
                      value={closingKm}
                      onChange={(e) => setClosingKm(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      placeholder={`Start: ${currentTrip.start_km || 0}`}
                      className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#1A1F2C] text-white font-semibold outline-none focus:border-[#FF5A00]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Halt Bata (₹)</label>
                    <input
                      type="number"
                      value={haltBata}
                      onChange={(e) => setHaltBata(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      placeholder="0.00"
                      className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#1A1F2C] text-white font-semibold outline-none focus:border-[#FF5A00]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Claims / Repairs (₹)</label>
                    <input
                      type="number"
                      value={claims}
                      onChange={(e) => setClaims(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      placeholder="0.00"
                      className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#1A1F2C] text-white font-semibold outline-none focus:border-[#FF5A00]"
                    />
                  </div>
                </div>

                {/* ROW 3: Closing Diesel & Tank Full */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[#222634] pt-5 items-center">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Closing Diesel Top-up (L)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={closingDiesel}
                      onChange={(e) => setClosingDiesel(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      placeholder="0.0 Litres"
                      className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#1A1F2C] text-white font-semibold outline-none focus:border-[#FF5A00]"
                    />
                    <span className="text-[10px] text-slate-500 font-bold mt-1 block">Valued at current rate: ₹{dieselRate}/L</span>
                  </div>
                  <div className="pt-2">
                    <label className="flex items-center gap-3 cursor-pointer select-none bg-[#0F1117] p-3 rounded-xl border border-[#222634] w-fit">
                      <input
                        type="checkbox"
                        checked={isTankFull}
                        onChange={(e) => setIsTankFull(e.target.checked)}
                        className="w-4 h-4 rounded text-[#FF5A00] focus:ring-[#FF5A00] bg-[#1A1F2C] border-[#2B3142]"
                      />
                      <span className="text-xs font-black text-white uppercase">⛽ Mark Tank Full</span>
                    </label>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-6 border-t border-[#222634] flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full md:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-900/20 active:scale-95 disabled:bg-slate-700 disabled:shadow-none"
                  >
                    {isSubmitting ? "Settling..." : "✅ Settle & Close POD"}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>

      {/* RIGHT PANEL: Sleek Edge-to-Edge Pending POD List */}
      <div className="lg:col-span-5 bg-[#12141C] border border-[#222634] rounded-2xl overflow-hidden flex flex-col shadow-sm h-fit">
        
        {/* Header (Edge to Edge) */}
        <div className="bg-[#161922] px-5 py-4 flex justify-between items-center border-b border-[#222634]">
          <h4 className="text-xs font-black text-white uppercase tracking-wider">Pending POD List ({activeTrips.length})</h4>
          <span className="text-[9px] font-bold px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg uppercase tracking-widest">
            Awaiting
          </span>
        </div>

        {/* Table Container (Edge to Edge, No extra padding) */}
        <div className="overflow-x-auto overflow-y-auto max-h-[600px] w-full">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-[#0F1117] sticky top-0 z-10">
              <tr>
                <th className="py-3 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-[#222634]">LR No</th>
                <th className="py-3 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-[#222634]">Date</th>
                <th className="py-3 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-[#222634]">Truck</th>
                <th className="py-3 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-[#222634] text-right">Aging</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222634] bg-[#12141C]">
              {activeTrips.map((t) => {
                const days = getDaysPending(t.trip_start_date);
                const isUrgent = days >= 2;
                const isSelected = selectedLr === t.trip_number;

                return (
                  <tr
                    key={t.trip_id}
                    onClick={() => setSelectedLr(t.trip_number)}
                    className={`cursor-pointer transition-all ${
                      isSelected ? 'bg-[#FF5A00]/10 border-l-2 border-l-[#FF5A00]' : 'border-l-2 border-l-transparent hover:bg-[#1A1F2C]'
                    }`}
                  >
                    <td className={`py-3.5 px-5 text-xs font-black ${isSelected ? 'text-[#FF5A00]' : 'text-white'}`}>
                      {t.trip_number}
                    </td>
                    <td className="py-3.5 px-5 text-xs font-semibold text-slate-400">
                      {formatDate(t.trip_start_date)}
                    </td>
                    <td className="py-3.5 px-5 text-xs font-bold text-slate-300">
                      {t.vehicles?.vehicle_number || "-"}
                    </td>
                    <td className={`py-3.5 px-5 text-xs font-black text-right ${isUrgent ? 'text-rose-400' : 'text-amber-500'}`}>
                      {days}d
                    </td>
                  </tr>
                );
              })}
              {activeTrips.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500 text-xs font-medium">
                    No pending PODs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
