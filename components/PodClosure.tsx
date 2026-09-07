"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function PodClosure({ onSuccess }: { onSuccess?: () => void }) {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Fetch pending active trips and driver details
  const fetchActiveTrips = async () => {
    setIsLoading(true);
    const { data } = await supabase
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
      .order("trip_start_date", { ascending: true });

    if (data) {
      setActiveTrips(data);
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
      alert("Please enter a valid POD Number.");
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
    const dieselRate = 95.0; // Standard diesel rate
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
      alert("Error updating trip: " + tripUpdateError.message);
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

    alert(`Trip ${currentTrip.trip_number} successfully closed and settled!`);
    setIsSubmitting(false);

    // Reset state & refresh active list
    setSelectedLr("");
    setPodNo("");
    setCurrentTrip(null);
    fetchActiveTrips();
    if (onSuccess) onSuccess();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-300">
      
      {/* LEFT PANEL: Settle POD Form */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="border-b border-slate-200 pb-4 mb-6">
          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Record POD & Settle Trip</h3>
          <p className="text-xs text-slate-500 mt-1">Finalize transit records, calculate shortages, and record closing top-ups.</p>
        </div>

        {activeTrips.length === 0 && !isLoading ? (
          <div className="p-8 text-center bg-emerald-50 border border-emerald-100 rounded-xl">
            <p className="text-sm font-bold text-emerald-800">All PODs are settled! No active trips pending closure.</p>
          </div>
        ) : (
          <form onSubmit={handleSettlePod} className="space-y-5">
            
            {/* LR Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Search & Select Active LR *</label>
              <select
                value={selectedLr}
                onChange={(e) => setSelectedLr(e.target.value)}
                className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">-- SELECT LR TO CLOSE --</option>
                {activeTrips.map((t) => (
                  <option key={t.trip_id} value={t.trip_number}>
                    LR: {t.trip_number} | Truck: {t.vehicles?.vehicle_number || "Unknown"} | {t.destination}
                  </option>
                ))}
              </select>
            </div>

            {currentTrip && (
              <>
                {/* Trip Quick Insight Banner */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between text-xs text-slate-600">
                  <span><strong>Driver:</strong> {currentTrip.drivers?.full_name || "Unassigned"}</span>
                  <span><strong>Route:</strong> {currentTrip.origin} ➔ {currentTrip.destination}</span>
                  <span><strong>Dispatched:</strong> {currentTrip.loaded_weight_mt} MT</span>
                </div>

                {/* ROW 1: POD No, Closing Date, Unloaded MT */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">POD No *</label>
                    <input
                      type="text"
                      value={podNo}
                      onChange={(e) => setPodNo(e.target.value)}
                      placeholder="e.g. POD-8821"
                      className="w-full text-sm p-2.5 rounded-lg border border-slate-300 uppercase font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Closing Date *</label>
                    <input
                      type="date"
                      value={closingDate}
                      onChange={(e) => setClosingDate(e.target.value)}
                      className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Unloaded MT</label>
                    <input
                      type="number"
                      step="0.01"
                      value={unloadedMt}
                      onChange={(e) => setUnloadedMt(parseFloat(e.target.value))}
                      placeholder="0.00"
                      className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* ROW 2: Closing KM, Halt Bata, Claims */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Closing KM *</label>
                    <input
                      type="number"
                      value={closingKm}
                      onChange={(e) => setClosingKm(parseFloat(e.target.value))}
                      placeholder={`Start: ${currentTrip.start_km || 0}`}
                      className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Halt Bata (₹)</label>
                    <input
                      type="number"
                      value={haltBata}
                      onChange={(e) => setHaltBata(parseFloat(e.target.value))}
                      placeholder="0.00"
                      className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Claims / Enroute (₹)</label>
                    <input
                      type="number"
                      value={claims}
                      onChange={(e) => setClaims(parseFloat(e.target.value))}
                      placeholder="0.00"
                      className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* ROW 3: Closing Diesel & Tank Full */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4 items-center">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Closing Diesel Top-up (L)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={closingDiesel}
                      onChange={(e) => setClosingDiesel(parseFloat(e.target.value))}
                      placeholder="0.0 Litres"
                      className="w-full text-sm p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="pt-5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isTankFull}
                        onChange={(e) => setIsTankFull(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <span className="text-xs font-bold text-slate-700">⛽ Mark Tank Full</span>
                    </label>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-slate-200 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95 disabled:bg-slate-300"
                  >
                    {isSubmitting ? "Settling..." : "✅ Settle & Close POD"}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>

      {/* RIGHT PANEL: Pending POD List (Matching Legacy Layout) */}
      <div className="lg:col-span-5 bg-rose-50/50 border border-rose-100 rounded-2xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider">Pending POD List ({activeTrips.length})</h4>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full">Awaiting Closure</span>
        </div>

        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="min-w-full divide-y divide-rose-100 text-left">
            <thead>
              <tr className="text-[10px] font-bold text-rose-900 uppercase">
                <th className="py-2">LR No</th>
                <th className="py-2">Truck</th>
                <th className="py-2">Dest</th>
                <th className="py-2 text-right">Aging</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-100 text-xs">
              {activeTrips.map((t) => {
                const days = getDaysPending(t.trip_start_date);
                return (
                  <tr
                    key={t.trip_id}
                    onClick={() => setSelectedLr(t.trip_number)}
                    className="cursor-pointer hover:bg-rose-100/60 transition-colors"
                  >
                    <td className="py-2.5 font-bold text-slate-900">{t.trip_number}</td>
                    <td className="py-2.5 text-slate-700">{t.vehicles?.vehicle_number || "-"}</td>
                    <td className="py-2.5 text-slate-600 truncate max-w-[100px]">{t.destination}</td>
                    <td className="py-2.5 text-right font-black text-rose-600">{days}d</td>
                  </tr>
                );
              })}
              {activeTrips.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
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
