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
  const [processingId, setProcessingId] = useState<string | number | null>(null);

  // Editable fields local state
  const [edits, setEdits] = useState<Record<string, { litres: number; amount: number; rate: number }>>({});

  const getIdCol = (item: any) => ("id" in item ? "id" : "entry_id" in item ? "entry_id" : "request_id");
  const getId = (item: any) => item[getIdCol(item)];

  const fetchQueueData = async () => {
    setIsLoading(true);

    try {
      const { data: entries, error: entriesErr } = await supabase
        .from("driver_pending_entries")
        .select("*")
        .eq("status", "PENDING");

      if (entriesErr) throw entriesErr;

      const { data: vehData } = await supabase.from("vehicles").select("vehicle_id, vehicle_number");
      const vehMap: Record<number, string> = {};
      if (vehData) vehData.forEach((v) => { vehMap[v.vehicle_id] = v.vehicle_number; });
      setVehicles(vehMap);

      const { data: tripsData } = await supabase
        .from("trips")
        .select("trip_id, vehicle_id, trip_number, fuel_litres, fuel_expense, cash_advance_issued")
        .neq("trip_status", "COMPLETED");

      const tripMap: Record<number, any> = {};
      if (tripsData) tripsData.forEach((t) => { tripMap[t.vehicle_id] = t; });
      setActiveTrips(tripMap);

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
        const initialEdits: Record<string, { litres: number; amount: number; rate: number }> = {};
        
        entries.forEach((item) => {
          const itemId = String(getId(item));
          const l = Number(item.litres) || 0;
          const a = Number(item.amount_inr) || 0;
          initialEdits[itemId] = {
            litres: l,
            rate: currentRate,
            amount: item.entry_type === "FUEL" ? Math.round(l * currentRate * 100) / 100 : a,
          };
        });
        setEdits(initialEdits);
      }
    } catch (err: any) {
      console.error("Failed to load approval queue", err);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchQueueData();
  }, []);

  const handleLitresChange = (id: string, litresVal: number) => {
    const currentRate = edits[id]?.rate || dieselRate;
    setEdits((prev) => ({
      ...prev, [id]: { ...prev[id], litres: litresVal, amount: Math.round(litresVal * currentRate * 100) / 100 },
    }));
  };

  const handleRateChange = (id: string, rateVal: number) => {
    const currentLitres = edits[id]?.litres || 0;
    setEdits((prev) => ({
      ...prev, [id]: { ...prev[id], rate: rateVal, amount: Math.round(currentLitres * rateVal * 100) / 100 },
    }));
  };

  const handleAmountChange = (id: string, amountVal: number) => {
    setEdits((prev) => ({
      ...prev, [id]: { ...prev[id], amount: amountVal },
    }));
  };

  const handleAction = async (item: any, action: "APPROVED" | "REJECTED") => {
    const itemId = getId(item);
    const idCol = getIdCol(item);
    
    if (!itemId) {
      alert("Database error: Could not find primary key for this row.");
      return;
    }

    setProcessingId(itemId);

    try {
      if (action === "REJECTED") {
        const reason = prompt("Enter a brief reason for rejection (optional):", "Incorrect bill amount or details");
        
        const { error } = await supabase.from("driver_pending_entries").update({ 
          status: "REJECTED",
          rejection_reason: reason || "Rejected by office dispatch"
        }).eq(idCol, itemId);

        if (error) throw new Error("Failed to reject: " + error.message);
        
        await fetchQueueData(); 
        setProcessingId(null);
        if (onSuccess) onSuccess();
        return;
      }

      // --- APPROVAL WORKFLOW ---
      const editData = edits[String(itemId)] || {
        litres: Number(item.litres) || 0,
        amount: Number(item.amount_inr) || 0,
        rate: dieselRate,
      };

      const activeTrip = activeTrips[item.vehicle_id];

      if (item.entry_type === "FUEL") {
        const finalLitres = Number(editData.litres) || 0;
        const finalCost = Number(editData.amount) || 0;

        if (activeTrip) {
          const { error: tripErr } = await supabase.from("trips").update({
              fuel_litres: (Number(activeTrip.fuel_litres) || 0) + finalLitres,
              fuel_expense: (Number(activeTrip.fuel_expense) || 0) + finalCost,
            }).eq("trip_id", activeTrip.trip_id);
          
          if (tripErr) throw new Error("Trip Update Failed: " + tripErr.message);

          const { error: logErr } = await supabase.from("diesel_fuel_logs").insert([{
              fuel_date: new Date().toISOString().split("T")[0],
              vehicle_id: item.vehicle_id,
              trip_id: activeTrip.trip_id,
              lr_number: activeTrip.trip_number,
              diesel_category: "ENROUTE_TOPUP",
              litres_filled: finalLitres,
              diesel_rate_per_litre: Number(editData.rate) || dieselRate,
              total_fuel_cost: finalCost,
              filling_odometer_km: item.odometer_km || 0,
            }]);
            
          if (logErr) throw new Error("Fuel Log Failed: " + logErr.message);
        }
      }

      if (item.entry_type === "ADVANCE" && activeTrip) {
        const { error: advErr } = await supabase.from("trips").update({
            cash_advance_issued: (Number(activeTrip.cash_advance_issued) || 0) + (Number(editData.amount) || 0),
          }).eq("trip_id", activeTrip.trip_id);
          
        if (advErr) throw new Error("Advance Update Failed: " + advErr.message);
      }

      const { error: finalErr } = await supabase.from("driver_pending_entries").update({
          status: "APPROVED",
          litres: editData.litres,
          amount_inr: editData.amount,
        }).eq(idCol, itemId);
        
      if (finalErr) throw new Error("Final Approval Failed: " + finalErr.message);

      await fetchQueueData();
      setProcessingId(null);
      if (onSuccess) onSuccess();

    } catch (err: any) {
      alert("❌ " + (err.message || "An unexpected error occurred during processing."));
      setProcessingId(null);
    }
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
          {pendingItems.length} Pending
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
            const itemId = String(getId(item));
            const truckNum = vehicles[item.vehicle_id] || `Truck #${item.vehicle_id}`;
            const activeTrip = activeTrips[item.vehicle_id];
            const currentEdit = edits[itemId] || { litres: Number(item.litres) || 0, amount: Number(item.amount_inr) || 0, rate: dieselRate };

            return (
              <div key={itemId} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-[#FF5A00]/50 transition-all flex flex-col gap-4">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md border ${item.entry_type === "FUEL" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                      {item.entry_type === "FUEL" ? "⛽ Fuel Fill" : "💵 Advance"}
                    </span>
                    <div>
                      <p className="text-sm font-black text-slate-900 leading-none">{truckNum}</p>
                      <p className="text-[10px] font-bold text-slate-500 mt-1">Driver: {item.driver_code}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {activeTrip ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded">LR: {activeTrip.trip_number}</span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded">No Active Trip</span>
                    )}
                    {item.odometer_km > 0 && <p className="text-[10px] text-slate-400 font-semibold mt-1">Odo: {item.odometer_km} km</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 items-end">
                  {item.entry_type === "FUEL" ? (
                    <>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Litres Issued</label>
                        <input type="number" step="0.01" value={currentEdit.litres} onChange={(e) => handleLitresChange(itemId, parseFloat(e.target.value) || 0)} className="w-full text-sm font-black p-2 rounded-lg border border-slate-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-[#FF5A00]" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Diesel Rate (₹/L)</label>
                        <input type="number" step="0.01" value={currentEdit.rate} onChange={(e) => handleRateChange(itemId, parseFloat(e.target.value) || 0)} className="w-full text-sm font-black p-2 rounded-lg border border-slate-300 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-[#FF5A00]" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Calculated Cost (₹)</label>
                        <div className="w-full text-sm font-black p-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">₹{currentEdit.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Advance Amount (₹)</label>
                      <input type="number" step="0.01" value={currentEdit.amount} onChange={(e) => handleAmountChange(itemId, parseFloat(e.target.value) || 0)} className="w-full text-sm font-black p-2 rounded-lg border border-slate-300 bg-white text-emerald-700 outline-none focus:ring-2 focus:ring-[#FF5A00]" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-1">
                  <p className="text-xs text-slate-500 italic truncate max-w-md">{item.receipt_remarks || "No additional remarks"}</p>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => handleAction(item, "REJECTED")} disabled={processingId === itemId} className="px-4 py-2 bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 font-black text-xs rounded-xl transition-all active:scale-95 disabled:opacity-50">
                      Reject
                    </button>
                    <button type="button" onClick={() => handleAction(item, "APPROVED")} disabled={processingId === itemId} className="px-5 py-2 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-xs rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50">
                      {processingId === itemId ? "Processing..." : "Approve Entry"}
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
