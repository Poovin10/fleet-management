import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Fetch live fleet records
    const [vehiclesRes, tripsRes, fuelRes, repairsRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('is_active', true),
      supabase.from('trips').select('*, vehicles(vehicle_number), drivers(full_name)').order('trip_id', { ascending: false }).limit(60),
      supabase.from('diesel_fuel_logs').select('*, vehicles(vehicle_number)').order('fuel_date', { ascending: false }).limit(60),
      supabase.from('workshop_repairs').select('*, vehicles(vehicle_number)').order('repair_date', { ascending: false }).limit(30)
    ]);

    const vehicles = vehiclesRes.data || [];
    const trips = tripsRes.data || [];
    const fuelLogs = fuelRes.data || [];
    const repairs = repairsRes.data || [];

    const anomalies: any[] = [];
    const efficiencyLeaks: any[] = [];
    const strategicInsights: any[] = [];

    // --- Audit Rule 1: Abnormal Fuel / Mileage Drops ---
    const recentFuelByTruck: Record<string, any[]> = {};
    fuelLogs.forEach((log) => {
      const truck = log.vehicles?.vehicle_number || "Unknown";
      if (!recentFuelByTruck[truck]) recentFuelByTruck[truck] = [];
      recentFuelByTruck[truck].push(log);
    });

    Object.entries(recentFuelByTruck).forEach(([truckNo, logs]) => {
      if (logs.length > 0) {
        const latest = logs[0];
        if (latest.kmpl && Number(latest.kmpl) > 0 && Number(latest.kmpl) < 3.0) {
          anomalies.push({
            truckNo,
            severity: "HIGH",
            issueDescription: `Low fuel economy recorded: ${latest.kmpl} KMPL on ${latest.fuel_date}.`,
            actionItem: "Inspect tyre pressures, check engine air filters, and review driver idling."
          });
        }
      }
    });

    // --- Audit Rule 2: Aging PODs (Cash Flow Lock) ---
    const unclosedTrips = trips.filter((t) => t.trip_status !== 'COMPLETED');
    if (unclosedTrips.length > 0) {
      const totalPendingRevenue = unclosedTrips.reduce((acc, t) => acc + (Number(t.freight_revenue) || 0), 0);
      efficiencyLeaks.push({
        area: "Pending POD Closures",
        details: `${unclosedTrips.length} active trips pending delivery weighment/POD verification.`,
        estimatedLoss: `₹${totalPendingRevenue.toLocaleString('en-IN')} locked in receivables`
      });
    }

    // --- Audit Rule 3: Workshop Repairs Concentration ---
    const repairCounts: Record<string, { count: number; totalCost: number }> = {};
    repairs.forEach((r) => {
      const truck = r.vehicles?.vehicle_number || "General";
      if (!repairCounts[truck]) repairCounts[truck] = { count: 0, totalCost: 0 };
      repairCounts[truck].count += 1;
      repairCounts[truck].totalCost += Number(r.total_cost_inr) || 0;
    });

    Object.entries(repairCounts).forEach(([truckNo, data]) => {
      if (data.count >= 2) {
        anomalies.push({
          truckNo,
          severity: "MEDIUM",
          issueDescription: `Multiple maintenance visits logged recently (${data.count} repairs).`,
          actionItem: `Conduct complete overhaul inspection. Total spent: ₹${data.totalCost.toLocaleString('en-IN')}`
        });
      }
    });

    // --- Audit Rule 4: Operational & Retention Guidance ---
    strategicInsights.push({
      category: "Fleet Optimization",
      suggestion: `Fleet active capacity: ${vehicles.length} trucks operational. Prioritize closing the oldest ${Math.min(unclosedTrips.length, 5)} open PODs to accelerate freight realization.`
    });

    // 2. Persist deterministic audit into Supabase
    await supabase.from('daily_ai_audits').upsert([{
      audit_date: todayStr,
      anomalies,
      efficiency_leaks: efficiencyLeaks,
      retention_suggestions: strategicInsights
    }], { onConflict: 'audit_date' });

    return NextResponse.json({
      success: true,
      message: "Deterministic Fleet Operations Audit completed.",
      audit: { anomalies, efficiency_leaks: efficiencyLeaks, retention_suggestions: strategicInsights }
    });
  } catch (error: any) {
    console.error("Audit Engine Error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error." }, { status: 500 });
  }
}
