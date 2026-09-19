"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function ProfitLossModule() {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<any[]>([]);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [sparesBills, setSparesBills] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const baselineDate = "2026-09-01";

      const [tripsRes, fuelRes, workshopRes] = await Promise.all([
        supabase
          .from("trips")
          .select("*, vehicles(vehicle_number)")
          .gte("trip_start_date", baselineDate),
        supabase
          .from("diesel_fuel_logs")
          .select("*")
          .gte("fuel_date", baselineDate),
        supabase
          .from("workshop_spares_bills")
          .select("*, vehicles(vehicle_number)")
          .gte("bill_date", baselineDate)
      ]);

      if (tripsRes.data) setTrips(tripsRes.data);
      if (fuelRes.data) setFuelLogs(fuelRes.data);
      if (workshopRes.data) setSparesBills(workshopRes.data);
      
      setLoading(false);
    }

    fetchData();
  }, []);

  const totalRevenue = trips.reduce((acc, t) => acc + Number(t.freight_revenue || 0), 0);
  const totalFuel = fuelLogs.reduce((acc, f) => acc + Number(f.total_fuel_cost || 0), 0);
  const totalBata = trips.reduce((acc, t) => acc + Number(t.driver_bata || 0) + Number(t.halt_bata || 0), 0);
  const totalSpares = sparesBills.reduce((acc, s) => acc + Number(s.total_bill_amount || 0), 0);
  const totalExpenses = totalFuel + totalBata + totalSpares;
  const netProfit = totalRevenue - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white/95 tracking-tight">Profit & Loss Statement</h2>
          <p className="text-xs text-white/50 mt-0.5">Comprehensive financial telemetry from September 1, 2026 onwards</p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-white/50">Computing financial statements...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-white/[0.02] backdrop-blur-3xl saturate-200 border border-white/[0.06]">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Total Freight Revenue</span>
            <p className="text-2xl font-semibold text-emerald-400 mt-2 font-mono">₹{totalRevenue.toLocaleString("en-IN")}</p>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.02] backdrop-blur-3xl saturate-200 border border-white/[0.06]">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Total Operating Expenses</span>
            <p className="text-2xl font-semibold text-rose-400 mt-2 font-mono">₹{totalExpenses.toLocaleString("en-IN")}</p>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.02] backdrop-blur-3xl saturate-200 border border-white/[0.06]">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Net Operating Margin</span>
            <p className={`text-2xl font-semibold mt-2 font-mono ${netProfit >= 0 ? "text-blue-400" : "text-amber-400"}`}>
              ₹{netProfit.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
