"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function Insights() {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<any[]>([]);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    async function fetchInsights() {
      setLoading(true);
      const baselineDate = "2026-09-01";

      const [tripsRes, fuelRes] = await Promise.all([
        supabase
          .from("trips")
          .select("*, trucks(vehicle_number)")
          .gte("trip_start_date", baselineDate),
        supabase
          .from("diesel_fuel_logs")
          .select("*, trucks(vehicle_number)")
          .gte("fuel_date", baselineDate)
      ]);

      if (tripsRes.data) setTrips(tripsRes.data);
      if (fuelRes.data) setFuelLogs(fuelRes.data);
      
      setLoading(false);
    }

    fetchInsights();
  }, []);

  const totalKm = trips.reduce((acc, t) => acc + Number(t.total_km_run || 0), 0);
  const totalTonnage = trips.reduce((acc, t) => acc + Number(t.tonnage_loaded || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white/95 tracking-tight">Fleet Intelligence & Insights</h2>
          <p className="text-xs text-white/50 mt-0.5">Performance analytics and operational metrics since September 1, 2026</p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-white/50">Analyzing fleet telemetry...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-white/[0.02] backdrop-blur-3xl saturate-200 border border-white/[0.06]">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Total Fleet Distance Run</span>
            <p className="text-2xl font-semibold text-blue-400 mt-2 font-mono">{totalKm.toLocaleString("en-IN")} KM</p>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.02] backdrop-blur-3xl saturate-200 border border-white/[0.06]">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Total Tonnage Transported</span>
            <p className="text-2xl font-semibold text-emerald-400 mt-2 font-mono">{totalTonnage.toLocaleString("en-IN")} Tons</p>
          </div>
        </div>
      )}
    </div>
  );
}
