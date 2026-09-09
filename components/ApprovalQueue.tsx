"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function ApprovalQueue({ onSuccess }: { onSuccess?: () => void }) {
  const supabase = createClient();
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Record<number, string>>({});
  const [activeTrips, setActiveTrips] = useState<Record<number, any>>({});
  const [dieselRate, setDieselRate] = useState<number>(95.0);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Editable fields local state: { [id]: { litres, amount, rate } }
  const [edits, setEdits] = useState<Record<number, { litres: number; amount: number; rate: number }>>({});

  const fetchQueueData = async () => {
    setIsLoading(true);

    try {
      // 1. Fetch pending requests directly without relational joins
      const { data: entries, error: entriesErr } = await supabase
        .from("driver_pending_entries")
        .select("*")
        .eq("status", "PENDING");

      if (entriesErr) {
        console.error("Error fetching pending entries:", entriesErr);
      }

      // 2. Fetch active vehicles for name mapping
      const { data: vehData } = await supabase
        .from("vehicles")
        .select("vehicle_id, vehicle_number");

      const vehMap: Record<number, string> = {};
      if (vehData) {
        vehData.forEach((v) => {
          vehMap[v.vehicle_id] = v.vehicle_number;
        });
        setVehicles(vehMap);
      }

      // 3. Fetch active trips to map vehicle to current active trip
      const { data: tripsData } = await supabase
        .from("trips")
        .select("trip_id, vehicle_id, trip_number, fuel_litres, fuel_expense, cash_advance_issued")
        .neq("trip_status", "COMPLETED");

      const tripMap: Record<number, any> = {};
      if (tripsData) {
        tripsData.forEach((t) => {
          tripMap[t.vehicle_id] = t;
        });
        setActiveTrips(tripMap);
      }

      // 4. Fetch latest diesel rate
      const { data: dieselData } = await supabase
        .from("diesel_fuel_logs")
        .select("diesel_rate_per_litre")
        .order("fuel_date", { ascending: false })
        .order("fuel_log_id", { ascending: false })
        .limit(1);

      let currentRate = 95.0;
      if (dieselData && dieselData.length > 0 && dieselData[0].diesel_rate_per_litre) {
        currentRate = Number(dieselData[0].diesel_rate_per_litre);
        setDieselRate(currentRate);
      }

      if (entries) {
        setPendingItems(entries);

        // Pre-fill editable state
        const initialEdits: Record<number, { litres: number; amount: number; rate: number }> = {};
        entries.forEach((item) => {
          const l = Number(item.litres) || 0;
          const a = Number(item.amount_inr) || 0;
          initialEdits[item.id] = {
            litres: l,
            rate: currentRate,
            amount: item.entry_type === "FUEL" ? Math.round(l * currentRate * 100) / 100 : a,
          };
        });
        setEdits(initialEdits);
      }
    } catch (err) {
      console.error("Failed to load approval queue", err);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchQueueData();
  }, []);

  const handleLitresChange = (id: number, litresVal: number) => {
    const currentRate = edits[id]?.rate || dieselRate;
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        litres: litresVal,
        amount: Math.round(litresVal * currentRate * 100) / 100,
      },
    }));
  };

  const handleRateChange = (id: number, rateVal: number) => {
    const currentLitres = edits[id]?.litres || 0;
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        rate: rateVal,
        amount: Math.round(currentLitres * rateVal * 100) / 100,
      },
    }));
  };

  const handleAmountChange = (id: number, amountVal: number) => {
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        amount: amountVal,
      },
    }));
  };

  const handleAction = async (item: any, action: "APPROVED" | "REJECTED") => {
    setProcessingId(item.id);

    if (action === "REJECTED") {
      await supabase
        .from("driver_pending_entries")
        .update({ status: "REJECTED" })
        .eq("id", item.id);

      setPendingItems((prev) => prev.filter((p) => p.id !== item.id));
      setProcessingId(null);
      if (onSuccess) onSuccess();
      return;
    }

    // --- APPROVAL WORKFLOW ---
    const editData = edits[item.id] || {
      litres: Number(item.litres) || 0,
      amount: Number(item.amount_inr) || 0,
      rate: dieselRate,
    };

    const activeTrip = activeTrips[item.vehicle_id];

    if (item.entry_type === "FUEL") {
      const finalLitres = Number(editData.litres) || 0;
      const finalCost = Number(editData.amount) || 0;
      const finalRate = Number(editData.rate) || dieselRate;

      if (activeTrip) {
        // Update Trip fuel stats
        const currentFuelL = Number(activeTrip.fuel_litres) || 0;
        const currentFuelExp = Number(activeTrip.fuel_expense) || 0;

        await supabase
          .from("trips")
          .update({
            fuel_litres: currentFuelL + finalLitres,
            fuel_expense: currentFuelExp + finalCost,
          })
          .eq("trip_id", activeTrip.trip_id);

        // Record in diesel_fuel_logs
        await supabase.from("diesel_fuel_logs").insert([
          {
            fuel_date: new Date().toISOString().split("T")[0],
            vehicle_id: item.vehicle_id,
            trip_id: activeTrip.trip_id,
            lr_number: activeTrip.trip_number,
            diesel_category: "ENROUTE_TOPUP",
            litres_filled: finalLitres,
            diesel_rate_per_litre: finalRate,
            total_fuel_cost: finalCost,
            filling_odometer_km: item.odometer_km || 0,
          },
        ]);
      }
    }

    if (item.entry_type === "ADVANCE") {
      const finalAdvance = Number(editData.amount) || 0;
      if (activeTrip) {
        const currentAdvance = Number(activeTrip.cash_advance_issued) || 0;
        await supabase
          .from("trips")
          .update({
            cash_advance_issued: currentAdvance + finalAdvance,
          })
          .eq("trip_id", activeTrip.trip_id);
      }
    }

    // Mark as APPROVED with final adjusted values
    await supabase
      .from("driver_pending_entries")
      .update({
        status: "APPROVED",
        litres: editData.litres,
        amount_inr: editData.amount,
      })
      .eq("id", item.id);

    setPendingItems((prev) => prev.filter((p) => p.id !== item.id));
    setProcessingId(null);
    if (onSuccess) onSuccess();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-8 shadow-sm max-w-5xl mx-auto">
      <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-6">
        <div>
          <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide">
            Driver Submissions Queue
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Review driver entries, adjust fuel quantities or rates, and approve into trips.
          </p>
        </div>
        <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-black">
          {pendingItems.length} Pending Review
        </span>
      </div>

      {isLoading ? (
        <div className="text-center p-12 text-slate-500 font-bold text-sm">
          Loading pending entries...
        </div>
      ) : pendingItems.length === 0 ? (
        <div className="text-center p-12 bg-slate-50 border border-slate-200 rounded-2xl">
          <span className="text-3xl mb-2 block">☕</span>
          <h4 className="text-sm font-black text-slate-900 uppercase">All Caught Up!</h4>
          <p className="text-xs text-slate-500 mt-1">There are no pending driver requests to review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingItems.map((item) => {
            const truckNum = vehicles[item.vehicle_id] || `Truck #${item.vehicle_id}`;
            const activeTrip = activeTrips[item.vehicle_id];
            const currentEdit = edits[item.id] || {
              litres: Number(item.litres) || 0,
              amount: Number(item.amount_inr) || 0,
              rate: dieselRate,
            };

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-[#FF5A00]/50 transition-all flex flex-col gap-4"
              >
                {/* Header Row */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md border ${
                        item.entry_type === "FUEL"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {item.entry_type === "FUEL" ? "⛽ Fuel Fill" : "💵 Advance"}
                    </span>
                    <div>
                      <p className="text-sm font-black text-slate-900 leading-none">{truckNum}</p>
                      <p className="text-[10px] font-bold text-slate-500 mt-1">Driver: {item.driver_code}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    {activeTrip ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded">
                        LR: {activeTrip.trip_number}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded">
                        No Active Trip
                      </span>
                    )}
                    {item.odometer_km > 0 && (
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">
                        Odo: {item.odometer_km} km
                      </p>
                    )}
                  </div>
                </div>

                {/* Editable Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 items-end">
                  {item.entry_type === "FUEL" ? (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Litres Issued
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={currentEdit.litres}
                          onChange={(e) => handleLitresChange(item.id, parseFloat(e.target.value) || 0)}
                          className="w-full text-sm font-black p-2 rounded-lg border border-slate-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-[#FF5A00]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Diesel Rate (₹/L)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={currentEdit.rate}
                          onChange={(e) => handleRateChange(item.id, parseFloat(e.target.value) || 0)}
                          className="w-full text-sm font-black p-2 rounded-lg border border-slate-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-[#FF5A00]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Calculated Cost (₹)
                        </label>
                        <div className="w-full text-sm font-black p-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
                          ₹{currentEdit.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Advance Amount (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentEdit.amount}
                        onChange={(e) => handleAmountChange(item.id, parseFloat(e.target.value) || 0)}
                        className="w-full text-sm font-black p-2 rounded-lg border border-slate-300 bg-white text-emerald-700 outline-none focus:ring-2 focus:ring-[#FF5A00]"
                      />
                    </div>
                  )}
                </div>

                {/* Remarks & Footer Actions */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-1">
                  <p className="text-xs text-slate-500 italic truncate max-w-md">
                    {item.receipt_remarks || "No additional remarks"}
                  </p>

                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => handleAction(item, "REJECTED")}
                      disabled={processingId === item.id}
                      className="px-4 py-2 bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 font-black text-xs rounded-xl transition-all active:scale-95 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(item, "APPROVED")}
                      disabled={processingId === item.id}
                      className="px-5 py-2 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-xs rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                      {processingId === item.id ? "Approving..." : "Approve Entry"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
