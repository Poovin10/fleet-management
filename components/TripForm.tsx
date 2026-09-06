'use client';

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function TripForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);

  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [lrNo, setLrNo] = useState("");
  const [cargoType, setCargoType] = useState("BULK");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [sourceHub, setSourceHub] = useState("COCHIN");
  const [destination, setDestination] = useState("");
  const [loadedMt, setLoadedMt] = useState("");
  const [driverBata, setDriverBata] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [startKm, setStartKm] = useState("");
  const [endKm, setEndKm] = useState("");
  const [fuelLitres, setFuelLitres] = useState("");
  const [isTankFull, setIsTankFull] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function fetchMasterData() {
      const { data: vData } = await supabase.from('vehicles').select('*').eq('is_active', true);
      const { data: dData } = await supabase.from('drivers').select('*').eq('is_active', true);
      const { data: tData } = await supabase.from('trips').select('*').in('trip_status', ['IN_TRANSIT', 'DISPATCHED']);
      
      if (vData) setVehicles(vData);
      if (dData) setDrivers(dData);
      if (tData) setActiveTrips(tData);
    }
    fetchMasterData();
  }, [supabase]);

  // AUTO-SELECT PREVIOUSLY ASSIGNED DRIVER & PRE-FILL SPECS WHEN TRUCK IS CHOSEN
  const handleVehicleChange = async (vehicleId: string) => {
    setSelectedVehicle(vehicleId);
    if (!vehicleId) return;

    // Find last trip for this vehicle to auto-assign driver and route info
    const { data: lastTrip } = await supabase
      .from('trips')
      .select('primary_driver_id, destination, tonnage_loaded')
      .eq('vehicle_id', Number(vehicleId))
      .order('trip_id', { ascending: false })
      .limit(1)
      .single();

    if (lastTrip) {
      if (lastTrip.primary_driver_id) {
        setSelectedDriver(lastTrip.primary_driver_id.toString());
        toast.info("Auto-assigned last active driver for this truck.");
      }
      if (lastTrip.tonnage_loaded) {
        setLoadedMt(lastTrip.tonnage_loaded.toString());
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || !selectedDriver || !lrNo || !destination) {
      toast.error("Please fill in all mandatory fields.");
      return;
    }

    setLoading(true);

    try {
      // 1. CHECK FOR DUPLICATE LR NUMBER
      const { data: existingLr } = await supabase
        .from('trips')
        .select('trip_id')
        .eq('trip_number', lrNo.trim().toUpperCase())
        .maybeSingle();

      if (existingLr) {
        toast.error(`Duplicate Error: LR Number "${lrNo.toUpperCase()}" already exists in the system!`);
        setLoading(false);
        return;
      }

      // 2. CHECK IF TRUCK ALREADY HAS AN UNCLOSED TRIP
      const activeTripForVehicle = activeTrips.find(t => t.vehicle_id.toString() === selectedVehicle);
      if (activeTripForVehicle) {
        toast.error(`Trip Not Closed Error: Vehicle already has an active trip (LR: ${activeTripForVehicle.trip_number})! Close POD first.`);
        setLoading(false);
        return;
      }

      const vehObj = vehicles.find(v => v.vehicle_id.toString() === selectedVehicle);
      const tonnage = Number(loadedMt) || Number(vehObj?.carrying_capacity_tons) || 30.0;
      const freightRevenue = tonnage * 1200; 
      const dieselRate = 95.0; 
      const fuelCost = (Number(fuelLitres) || 0) * dieselRate;

      const { data: tripData, error: tripError } = await supabase.from('trips').insert([
        {
          trip_number: lrNo.trim().toUpperCase(),
          branch_id: 1,
          vehicle_id: Number(selectedVehicle),
          primary_driver_id: Number(selectedDriver),
          trip_start_date: startDate,
          origin: sourceHub,
          destination: destination.trim().toUpperCase(),
          start_km: Number(startKm) || 0,
          end_km: Number(endKm) || 0,
          total_km_run: (Number(endKm) > Number(startKm)) ? Number(endKm) - Number(startKm) : 0,
          tonnage_loaded: tonnage,
          loaded_weight_mt: tonnage,
          freight_revenue: freightRevenue,
          fuel_litres: Number(fuelLitres) || 0,
          fuel_expense: fuelCost,
          driver_bata: Number(driverBata) || 1500,
          cash_advance_issued: Number(advanceAmount) || 0,
          trip_status: 'IN_TRANSIT',
          is_tank_full: isTankFull,
        }
      ]).select('trip_id');

      if (tripError) throw tripError;

      if (Number(fuelLitres) > 0 && tripData && tripData.length > 0) {
        await supabase.from('diesel_fuel_logs').insert([
          {
            fuel_date: startDate,
            vehicle_id: Number(selectedVehicle),
            trip_id: tripData[0].trip_id,
            lr_number: lrNo.trim().toUpperCase(),
            diesel_category: 'TRIP_DIESEL',
            litres_filled: Number(fuelLitres),
            diesel_rate_per_litre: dieselRate,
            total_fuel_cost: fuelCost,
            filling_odometer_km: Number(startKm) || 0,
            is_tank_full: isTankFull,
          }
        ]);
      }

      await supabase.from('vehicles').update({
        current_status: 'IN_TRANSIT',
        status_remarks: `Trip ${lrNo.toUpperCase()}: ${sourceHub} ➔ ${destination.toUpperCase()}`
      }).eq('vehicle_id', Number(selectedVehicle));

      toast.success("Trip dispatched successfully!");
      setLrNo("");
      setDestination("");
      setLoadedMt("");
      setDriverBata("");
      setAdvanceAmount("");
      setStartKm("");
      setEndKm("");
      setFuelLitres("");
      setIsTankFull(false);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to dispatch trip", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 max-w-3xl">
      <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Initiate Full Trip Dispatch (Safeguarded)</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Start Date*</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">LR Number (Unique)*</label>
          <input
            type="text"
            required
            placeholder="e.g. LR-9841"
            value={lrNo}
            onChange={(e) => setLrNo(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Cargo Category*</label>
          <select
            value={cargoType}
            onChange={(e) => setCargoType(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white"
          >
            <option value="BULK">BULK</option>
            <option value="BAG">BAG</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Assigned Truck* (Auto-checks active trips)</label>
          <select
            value={selectedVehicle}
            onChange={(e) => handleVehicleChange(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white"
            required
          >
            <option value="">-- SELECT TRUCK --</option>
            {vehicles.map((v) => {
              const hasActive = activeTrips.some(t => t.vehicle_id === v.vehicle_id);
              return (
                <option key={v.vehicle_id} value={v.vehicle_id} disabled={hasActive}>
                  {v.vehicle_number} [{v.truck_type} - {v.carrying_capacity_tons}MT] {hasActive ? "⚠️ [TRIP ACTIVE]" : ""}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Driver* (Auto-suggests previous)</label>
          <select
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white"
            required
          >
            <option value="">-- SELECT DRIVER --</option>
            {drivers.map((d) => (
              <option key={d.driver_id} value={d.driver_id}>
                {d.driver_code} - {d.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Source Hub*</label>
          <select
            value={sourceHub}
            onChange={(e) => setSourceHub(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white"
          >
            <option value="COCHIN">COCHIN</option>
            <option value="POTTANERI">POTTANERI</option>
            <option value="METTUR">METTUR</option>
            <option value="UDUPPI">UDUPPI</option>
            <option value="TUTICORIN">TUTICORIN</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Destination Terminal*</label>
          <input
            type="text"
            required
            placeholder="e.g. PARAMATHI VELUR"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Loaded MT</label>
          <input
            type="number"
            placeholder="Auto (e.g. 30)"
            value={loadedMt}
            onChange={(e) => setLoadedMt(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Driver Bata (₹)</label>
          <input
            type="number"
            placeholder="1500"
            value={driverBata}
            onChange={(e) => setDriverBata(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Cash Advance (₹)</label>
          <input
            type="number"
            placeholder="0.00"
            value={advanceAmount}
            onChange={(e) => setAdvanceAmount(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Start KM</label>
          <input
            type="number"
            placeholder="0"
            value={startKm}
            onChange={(e) => setStartKm(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Expected End KM</label>
          <input
            type="number"
            placeholder="0"
            value={endKm}
            onChange={(e) => setEndKm(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Diesel Litres (L)</label>
          <input
            type="number"
            placeholder="0.0"
            value={fuelLitres}
            onChange={(e) => setFuelLitres(e.target.value)}
            className="w-full border border-slate-300 rounded-md p-2 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <input
          type="checkbox"
          id="tankFull"
          checked={isTankFull}
          onChange={(e) => setIsTankFull(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="tankFull" className="text-sm font-semibold text-slate-700">Mark Tank Full</label>
      </div>

      <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2">
        {loading ? "Processing Dispatch..." : "Dispatch Trip (Safeguarded)"}
      </Button>
    </form>
  );
}
