"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export function useFleetTelemetry() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    liveVehicles: any[];
    statusCounts: { "Plant Loading": number; "In Transit": number; "Workshop / Repairs": number; "No Driver / Leave": number };
    metrics: { tripCount: number; activeCount: number; freightRevenue: number; netRetention: number; dieselCost: number };
    pendingApprovalsCount: number;
  }>({
    liveVehicles: [],
    statusCounts: { "Plant Loading": 0, "In Transit": 0, "Workshop / Repairs": 0, "No Driver / Leave": 0 },
    metrics: { tripCount: 0, activeCount: 0, freightRevenue: 0, netRetention: 0, dieselCost: 0 },
    pendingApprovalsCount: 0
  });

  const fetchTelemetry = useCallback(async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const monthStr = String(now.getMonth() + 1).padStart(2, '0');
      const firstDay = `${year}-${monthStr}-01`;
      const lastDayObj = new Date(year, now.getMonth() + 1, 0);
      const lastDay = `${year}-${monthStr}-${String(lastDayObj.getDate()).padStart(2, '0')}`;

      const [vehiclesRes, activeTripsRes, pendingRes, monthTripsRes, dieselRes, workshopRes] = await Promise.all([
        supabase.from('trucks').select('*'),
        supabase.from('trips').select('*', { count: 'exact', head: true }).neq('trip_status', 'COMPLETED'),
        supabase.from('driver_pending_entries').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('trips').select('freight_revenue, driver_bata, halt_bata, enroute_repairs_maintenance').gte('trip_start_date', firstDay).lte('trip_start_date', lastDay),
        supabase.from('diesel_fuel_logs').select('total_fuel_cost').gte('fuel_date', firstDay).lte('fuel_date', lastDay),
        supabase.from('workshop_spares_bills').select('bill_amount').gte('bill_date', firstDay).lte('bill_date', lastDay)
      ]);

      const vehicles = vehiclesRes.data || [];
      const extractStatus = (v: any) => String(v.status || v.current_status || v.vehicle_status || v.STATUS || "").trim().toUpperCase();

      const counts = {
        "Plant Loading": vehicles.filter((v: any) => ['WAITING_FOR_LOAD', 'AVAILABLE_FOR_LOAD'].includes(extractStatus(v))).length,
        "In Transit": vehicles.filter((v: any) => extractStatus(v) === 'IN_TRANSIT').length,
        "Workshop / Repairs": vehicles.filter((v: any) => extractStatus(v) === 'WORKSHOP_MAINTENANCE').length,
        "No Driver / Leave": vehicles.filter((v: any) => extractStatus(v) === 'DRIVER_UNAVAILABLE').length
      };

      let totalFreight = 0;
      let nonFuelOpex = 0;
      if (monthTripsRes.data) {
        monthTripsRes.data.forEach((t: any) => {
          totalFreight += Number(t.freight_revenue) || 0;
          nonFuelOpex += (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0) + (Number(t.enroute_repairs_maintenance) || 0);
        });
      }

      let totalDiesel = 0;
      if (dieselRes.data) {
        dieselRes.data.forEach((d: any) => { totalDiesel += Number(d.total_fuel_cost) || 0; });
      }

      let totalWorkshop = 0;
      if (workshopRes.data) {
        workshopRes.data.forEach((w: any) => { totalWorkshop += Number(w.bill_amount) || 0; });
      }

      const netRetention = totalFreight - totalDiesel - nonFuelOpex - totalWorkshop;

      setData({
        liveVehicles: vehicles,
        statusCounts: counts,
        metrics: {
          tripCount: monthTripsRes.data?.length || 0,
          activeCount: activeTripsRes.count || 0,
          freightRevenue: totalFreight,
          netRetention: netRetention,
          dieselCost: totalDiesel
        },
        pendingApprovalsCount: pendingRes.count || 0
      });
    } catch (err) {
      console.error("Telemetry Pipeline Error:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 15000);
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  return { ...data, loading, refreshTelemetry: fetchTelemetry };
}
