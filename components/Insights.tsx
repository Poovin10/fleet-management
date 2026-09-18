"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Insights() {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);

  // Intelligence State
  const [fuelAnomalies, setFuelAnomalies] = useState<any[]>([]);
  const [routeProfitability, setRouteProfitability] = useState<any[]>([]);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<any[]>([]);
  const [utilizationRate, setUtilizationRate] = useState(0);

  const formatINR = (val: number) =>
    (Number(val) || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const fetchIntelligenceData = async () => {
    setIsLoading(true);
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];

    // Fetch core operational data
    const [trucksRes, tripsRes, fuelRes] = await Promise.all([
      supabase.from("trucks").select("*").eq("is_active", true),
      supabase.from("trips").select("*, trucks(vehicle_number)").gte("trip_start_date", firstDay),
      supabase.from("diesel_fuel_logs").select("*, trucks(vehicle_number)").gte("fuel_date", firstDay)
    ]);

    const trucks = trucksRes.data || [];
    const trips = tripsRes.data || [];
    const fuelLogs = fuelRes.data || [];

    // 1. Calculate Fleet Utilization
    const activeTruckIds = new Set(trips.filter(t => t.vehicle_id).map(t => t.vehicle_id));
    const utilRate = trucks.length > 0 ? (activeTruckIds.size / trucks.length) * 100 : 0;
    setUtilizationRate(utilRate);

    // 2. Detect Fuel Efficiency Anomalies (KMPL Drops)
    const anomalies: any[] = [];
    const truckFuelMap = new Map();
    
    fuelLogs.forEach(log => {
      if (!log.vehicle_id || !log.odometer_reading || !log.fuel_litres) return;
      const id = log.vehicle_id;
      if (!truckFuelMap.has(id)) truckFuelMap.set(id, { name: log.trucks?.vehicle_number || "Unknown", litres: 0, odoStart: log.odometer_reading, odoEnd: log.odometer_reading });
      
      const data = truckFuelMap.get(id);
      data.litres += Number(log.fuel_litres);
      if (log.odometer_reading < data.odoStart) data.odoStart = log.odometer_reading;
      if (log.odometer_reading > data.odoEnd) data.odoEnd = log.odometer_reading;
    });

    truckFuelMap.forEach((data, id) => {
      const distance = data.odoEnd - data.odoStart;
      if (distance > 0 && data.litres > 0) {
        const kmpl = distance / data.litres;
        if (kmpl < 3.0 || kmpl > 5.5) { // Standard heavy-duty truck thresholds
          anomalies.push({ truck: data.name, kmpl: kmpl.toFixed(2), distance, litres: data.litres });
        }
      }
    });
    setFuelAnomalies(anomalies);

    // 3. Route Profitability Engine
    const routeMap = new Map();
    trips.forEach(trip => {
      if (!trip.origin || !trip.destination) return;
      const route = `${trip.origin} → ${trip.destination}`;
      if (!routeMap.has(route)) routeMap.set(route, { revenue: 0, trips: 0 });
      
      const rData = routeMap.get(route);
      rData.revenue += Number(trip.freight_revenue) || 0;
      rData.trips += 1;
    });

    const sortedRoutes = Array.from(routeMap.entries())
      .map(([route, data]) => ({ route, revenue: data.revenue, trips: data.trips }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 4); // Top 4 routes
    setRouteProfitability(sortedRoutes);

    // 4. Predictive Maintenance (Based on trip counts for this cycle)
    const maintenance: any[] = [];
    const tripCounts = new Map();
    trips.forEach(trip => {
      if (!trip.vehicle_id) return;
      const name = trip.trucks?.vehicle_number || "Unknown";
      tripCounts.set(name, (tripCounts.get(name) || 0) + 1);
    });

    tripCounts.forEach((count, truck) => {
      if (count >= 10) { // High usage warning
        maintenance.push({ truck, reason: "High Trip Volume", count });
      }
    });
    setMaintenanceAlerts(maintenance);

    setIsLoading(false);
  };

  useEffect(() => {
    fetchIntelligenceData();
  }, [supabase]);

  return (
    <div className="space-y-6 animate-tab-focus text-white/90 font-sans">
      
      {/* Enterprise Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between pb-4 border-b border-white/[0.08] gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-3">
            Algorithmic Intelligence Engine
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-medium tracking-wide border border-blue-500/20">
              AI Analytics Active
            </span>
          </h2>
          <p className="text-sm text-white/40 mt-1">Predictive logistics, route optimization, and anomaly detection</p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-white/40 text-sm font-medium">
          Processing Fleet Telemetry...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Top Routes Matrix */}
            <div className="bg-[#0B0D13] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-sm font-medium text-white tracking-tight mb-5 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Route Profitability Matrix
              </h3>
              
              <div className="space-y-4">
                {routeProfitability.length === 0 ? (
                  <div className="text-xs text-white/40">Insufficient trip data to calculate route matrices.</div>
                ) : (
                  routeProfitability.map((route, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg">
                      <div>
                        <div className="text-[13px] font-medium text-white">{route.route}</div>
                        <div className="text-[11px] text-white/40 mt-0.5">{route.trips} Dispatches Logged</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-emerald-400 tracking-tight">₹{formatINR(route.revenue)}</div>
                        <div className="text-[10px] text-white/40  tracking-normal mt-0.5">Gross Yield</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Fuel Anomaly Radar */}
            <div className="bg-[#0B0D13] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-sm font-medium text-white tracking-tight mb-5 flex items-center gap-2">
                <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Fuel Efficiency Anomalies (KMPL Drop)
              </h3>
              
              {fuelAnomalies.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <div className="text-xs text-emerald-400 font-medium">All monitored units are operating within nominal KMPL parameters.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {fuelAnomalies.map((anom, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-rose-500/5 border border-rose-500/10 rounded-lg">
                      <div>
                        <div className="text-[13px] font-medium text-white">{anom.truck}</div>
                        <div className="text-[11px] text-white/60 mt-0.5">Logged {anom.distance} KM on {anom.litres} Litres</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-rose-400 tracking-tight">{anom.kmpl} KMPL</div>
                        <div className="text-[10px] text-rose-500/70  tracking-normal mt-0.5">Requires Audit</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right Column */}
          <div className="space-y-6">
            
            {/* Utilization Score */}
            <div className="bg-[#0B0D13] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-sm font-medium text-white tracking-tight mb-5">Fleet Utilization</h3>
              <div className="flex items-end gap-3 mb-4">
                <div className="text-4xl font-semibold text-white tracking-tight">{utilizationRate.toFixed(1)}%</div>
                <div className="text-xs text-white/40 mb-1.5  tracking-normal">Active Units</div>
              </div>
              
              <div className="w-full bg-white/[0.04] rounded-full h-1.5 mb-2 overflow-hidden">
                <div 
                  className={`h-1.5 rounded-full ${utilizationRate > 75 ? 'bg-emerald-400' : utilizationRate > 40 ? 'bg-amber-400' : 'bg-rose-400'}`}
                  style={{ width: `${utilizationRate}%` }}
                ></div>
              </div>
              <div className="text-[11px] text-white/40 mt-2 text-center">
                Percentage of registered fleet dispatched this cycle.
              </div>
            </div>

            {/* Predictive Maintenance */}
            <div className="bg-[#0B0D13] border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-sm font-medium text-white tracking-tight mb-5 flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Predictive Maintenance
              </h3>
              
              {maintenanceAlerts.length === 0 ? (
                <div className="text-xs text-white/40 text-center py-4">No critical wear detected based on trip volume.</div>
              ) : (
                <div className="space-y-3">
                  {maintenanceAlerts.map((alert, idx) => (
                    <div key={idx} className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                      <div className="text-[13px] font-medium text-white">{alert.truck}</div>
                      <div className="text-[11px] text-amber-500/80 mt-1">{alert.reason}: {alert.count} Trips</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
