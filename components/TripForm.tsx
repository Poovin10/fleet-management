"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";

export function TripForm({ onSuccess }: { onSuccess?: () => void }) {
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info" as "success" | "error" | "info"
  });

  // Master Data States
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [freightMaster, setFreightMaster] = useState<any[]>([]);
  const [bataMaster, setBataMaster] = useState<any[]>([]);

  // Form Fields State
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [lrNo, setLrNo] = useState("");
  const [cargoType, setCargoType] = useState("BULK");
  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [source, setSource] = useState("COCHIN");
  const [customSource, setCustomSource] = useState("");
  const [destinationLabel, setDestinationLabel] = useState("-- SELECT DESTINATION --");
  const [customDest, setCustomDest] = useState("");
  const [freightRate, setFreightRate] = useState<number | "">("");
  const [loadedMt, setLoadedMt] = useState<number | "">("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [driverBata, setDriverBata] = useState<number | "">("");
  const [advance, setAdvance] = useState<number | "">("");
  const [dieselRate, setDieselRate] = useState<number>(95.0);
  const [dieselL, setDieselL] = useState<number | "">("");
  const [startKm, setStartKm] = useState<number | "">("");
  
  // Hidden / Logic States
  const [expectedEndKm, setExpectedEndKm] = useState<number | "">("");
  const [isTankFull, setIsTankFull] = useState(false);
  const [isManualRoute, setIsManualRoute] = useState(false);

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

  // --- DYNAMIC SOURCES LOGIC ---
  const dynamicSources = Array.from(
    new Set(freightMaster.map(r => r.origin?.toUpperCase().trim()).filter(Boolean))
  ).sort();

  // Clear Form Function
  const handleClear = () => {
    setStartDate(new Date().toISOString().split("T")[0]);
    setLrNo("");
    setCargoType("BULK");
    setSelectedTruckId("");
    setSource("COCHIN");
    setCustomSource("");
    setDestinationLabel("-- SELECT DESTINATION --");
    setCustomDest("");
    setFreightRate("");
    setLoadedMt("");
    setSelectedDriverId("");
    setDriverBata("");
    setAdvance("");
    setDieselL("");
    setStartKm("");
    setIsManualRoute(false);
  };

  useEffect(() => {
    async function fetchMasterData() {
      setIsLoading(true);
      const [vehRes, drvRes, frRes, btRes, dieselRes] = await Promise.all([
        supabase.from("vehicles").select("*").eq("is_active", true).order("vehicle_number"),
        supabase.from("drivers").select("*").eq("is_active", true).order("full_name"),
        supabase.from("destinations_freight_master").select("*").eq("is_active", true),
        supabase.from("driver_bata_master").select("*"),
        supabase.from("diesel_fuel_logs").select("diesel_rate_per_litre").order("fuel_date", { ascending: false }).order("fuel_log_id", { ascending: false }).limit(1)
      ]);

      if (vehRes.data) setVehicles(vehRes.data);
      if (drvRes.data) setDrivers(drvRes.data);
      if (frRes.data) setFreightMaster(frRes.data);
      if (btRes.data) setBataMaster(btRes.data);
      
      if (dieselRes.data && dieselRes.data.length > 0 && dieselRes.data[0].diesel_rate_per_litre) {
        setDieselRate(Number(dieselRes.data[0].diesel_rate_per_litre));
      }
      setIsLoading(false);
    }
    fetchMasterData();
  }, [supabase]);

  const availableTrucks = vehicles.filter((v) => {
    const isBulkTruck = String(v.truck_type).toUpperCase().includes("BULK");
    const isAvailable = v.current_status === "AVAILABLE_FOR_LOAD" || v.current_status === "WAITING_FOR_LOAD";
    if (!isAvailable) return false;
    return cargoType === "BULK" ? isBulkTruck : !isBulkTruck;
  });

  const activeTruck = vehicles.find((v) => String(v.vehicle_id) === selectedTruckId);
  const activeTruckCap = activeTruck ? Number(activeTruck.carrying_capacity_tons) : 0;
  const finalSource = source === "CUSTOM" ? customSource : source;

  const validRoutes = freightMaster.filter((r) => {
    return (
      r.origin?.trim().toUpperCase() === finalSource.trim().toUpperCase() &&
      r.cargo_type?.toUpperCase() === cargoType.toUpperCase() &&
      (activeTruckCap === 0 || Number(r.capacity_tons) === activeTruckCap)
    );
  });

  useEffect(() => {
    if (selectedTruckId) {
      const truck = vehicles.find((v) => String(v.vehicle_id) === String(selectedTruckId));
      if (truck && truck.carrying_capacity_tons) {
        setLoadedMt(Number(truck.carrying_capacity_tons));
      }
      
      const fetchTruckHistory = async () => {
        const { data: lastTrip } = await supabase.from("trips").select("primary_driver_id").eq("vehicle_id", selectedTruckId).not("primary_driver_id", "is", null).order("trip_id", { ascending: false }).limit(1);
        if (lastTrip && lastTrip.length > 0 && lastTrip[0].primary_driver_id) {
          setSelectedDriverId(String(lastTrip[0].primary_driver_id));
        } else {
          setSelectedDriverId("");
        }

        const { data: lastOdoTrip } = await supabase.from("trips").select("end_km, start_km").eq("vehicle_id", selectedTruckId).order("trip_id", { ascending: false }).limit(1);
        const { data: lastOdoFuel } = await supabase.from("diesel_fuel_logs").select("filling_odometer_km").eq("vehicle_id", selectedTruckId).order("fuel_log_id", { ascending: false }).limit(1);
        
        let odo = 0;
        if (lastOdoTrip && lastOdoTrip.length > 0) odo = Math.max(odo, Number(lastOdoTrip[0].end_km || lastOdoTrip[0].start_km || 0));
        if (lastOdoFuel && lastOdoFuel.length > 0) odo = Math.max(odo, Number(lastOdoFuel[0].filling_odometer_km || 0));
        setStartKm(odo > 0 ? odo : "");
      };
      fetchTruckHistory();
    } else {
      setLoadedMt("");
      setSelectedDriverId("");
      setStartKm("");
    }
  }, [selectedTruckId, vehicles, supabase]);

  useEffect(() => {
    if (destinationLabel === "-- MANUAL / SPOT ROUTE --") {
      setIsManualRoute(true);
      setFreightRate(""); 
    } else if (destinationLabel !== "-- SELECT DESTINATION --") {
      setIsManualRoute(false);
      const matchedRoute = validRoutes.find(r => String(r.destination_name) === String(destinationLabel));
      if (matchedRoute) {
        setFreightRate(Number(matchedRoute.freight_rate_per_ton));
      }
    } else {
      setIsManualRoute(false);
      setFreightRate("");
    }
  }, [destinationLabel, validRoutes]);

  useEffect(() => {
    const finalDest = isManualRoute ? customDest : destinationLabel;
    if (finalSource && finalDest && finalDest !== "-- SELECT DESTINATION --") {
      const match = bataMaster.find(b => 
        b.origin?.trim().toUpperCase() === finalSource.trim().toUpperCase() &&
        b.destination_name?.trim().toUpperCase() === finalDest.trim().toUpperCase() &&
        b.cargo_type === cargoType &&
        Number(b.capacity_tons) === activeTruckCap
      );
      if (match) setDriverBata(Number(match.standard_bata_inr));
      else setDriverBata("");
    }
  }, [finalSource, destinationLabel, customDest, cargoType, activeTruckCap, bataMaster, isManualRoute]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Explicit Validation Guards for Zero or Negative numbers (Issue #7)
    if (!selectedTruckId || !selectedDriverId || !lrNo.trim() || freightRate === "" || Number(freightRate) <= 0 || loadedMt === "" || Number(loadedMt) <= 0) {
      setAlertConfig({
        isOpen: true,
        title: "Invalid Input",
        message: "Please ensure all mandatory fields have valid positive values (> 0) before dispatching.",
        type: "error"
      });
      return;
    }

    setIsSubmitting(true);
    const finalDest = isManualRoute ? customDest.toUpperCase() : destinationLabel;
    const finalStartKm = Number(startKm) || 0;
    const finalEndKm = Number(expectedEndKm) || 0;
    const totalKm = finalEndKm > finalStartKm ? finalEndKm - finalStartKm : 0;
    const grossFreight = Math.round(Number(loadedMt) * Number(freightRate) * 100) / 100;
    const fuelCost = Math.round((Number(dieselL) || 0) * dieselRate * 100) / 100;

    const { data: newTrip, error: tripError } = await supabase
      .from("trips")
      .insert([{
        trip_number: lrNo.toUpperCase().trim(),
        branch_id: 1,
        vehicle_id: Number(selectedTruckId),
        primary_driver_id: Number(selectedDriverId),
        trip_start_date: startDate,
        trip_end_date: startDate,
        origin: finalSource.toUpperCase(),
        destination: finalDest,
        start_km: finalStartKm,
        end_km: finalEndKm,
        total_km_run: totalKm,
        tonnage_loaded: Number(loadedMt),
        loaded_weight_mt: Number(loadedMt),
        freight_revenue: grossFreight,
        fuel_litres: Number(dieselL) || 0,
        fuel_expense: fuelCost,
        driver_bata: Number(driverBata) || 0,
        cash_advance_issued: Number(advance) || 0,
        trip_status: "IN_TRANSIT",
        is_tank_full: isTankFull
      }])
      .select()
      .single();

    if (tripError) {
      setAlertConfig({
        isOpen: true,
        title: "Dispatch Failed",
        message: "Error dispatching trip: " + tripError.message,
        type: "error"
      });
      setIsSubmitting(false);
      return;
    }

    if (Number(dieselL) > 0) {
      await supabase.from("diesel_fuel_logs").insert([{
        fuel_date: startDate,
        vehicle_id: Number(selectedTruckId),
        trip_id: newTrip.trip_id,
        lr_number: lrNo.toUpperCase().trim(),
        diesel_category: "TRIP_DIESEL",
        litres_filled: Number(dieselL),
        diesel_rate_per_litre: dieselRate,
        total_fuel_cost: fuelCost,
        filling_odometer_km: finalStartKm,
        is_tank_full: isTankFull
      }]);
    }

    await supabase
      .from("vehicles")
      .update({
        current_status: "IN_TRANSIT",
        status_remarks: `Trip ${lrNo.toUpperCase()}: ${finalSource.toUpperCase()} ➔ ${finalDest}`,
        status_updated_at: new Date().toISOString()
      })
      .eq("vehicle_id", Number(selectedTruckId));

    setAlertConfig({
      isOpen: true,
      title: "Trip Dispatched!",
      message: `LR No. ${lrNo.toUpperCase()} has been successfully registered and the truck status is now In Transit.`,
      type: "success"
    });
    
    setIsSubmitting(false);
    handleClear(); 
    if (onSuccess) onSuccess();
  };

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm max-w-4xl mx-auto animate-in fade-in duration-300 relative" style={{ colorScheme: 'light' }}>
      
      <AlertModal 
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />

      <div className="border-b border-border pb-4 mb-6">
        <h3 className="text-base font-bold text-fg uppercase tracking-tight">Initiate Trip Dispatch</h3>
        <p className="text-xs text-fg-secondary mt-1">Fill out the fields below in sequence to compute freight rules.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* 1. Date */}
          <div>
            <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">1. Start Date *</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] bg-surface text-fg" required />
          </div>

          {/* 2. LR Number */}
          <div>
            <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">2. LR Number *</label>
            <input type="text" value={lrNo} onChange={e => setLrNo(e.target.value)} placeholder="E.G. 40080069852" className="w-full text-sm p-3 rounded-xl border border-border-strong uppercase outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold bg-surface text-fg" required />
          </div>

          {/* 3. Cargo Type */}
          <div>
            <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">3. Cargo Type *</label>
            <div className="flex bg-surface-raised p-1 rounded-xl border border-border">
              <button type="button" onClick={() => { setCargoType("BULK"); setSelectedTruckId(""); }} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${cargoType === "BULK" ? "bg-surface text-[#FF5A00] shadow-sm border border-border" : "text-fg-secondary hover:text-fg"}`}>BULK</button>
              <button type="button" onClick={() => { setCargoType("BAG"); setSelectedTruckId(""); }} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${cargoType === "BAG" ? "bg-surface text-[#FF5A00] shadow-sm border border-border" : "text-fg-secondary hover:text-fg"}`}>BAGS</button>
            </div>
          </div>

          {/* 4. Assigned Truck */}
          <div>
            <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">4. Assigned Truck ({cargoType}) *</label>
            <select value={selectedTruckId} onChange={e => setSelectedTruckId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold text-[#FF5A00] bg-surface" required disabled={isLoading}>
              <option value="">-- SELECT TRUCK --</option>
              {availableTrucks.map(v => <option key={v.vehicle_id} value={String(v.vehicle_id)}>{v.vehicle_number} [{v.truck_type}]</option>)}
            </select>
          </div>

          {/* 5. Source */}
          <div>
            <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">5. Source (Origin) *</label>
            <select value={source} onChange={e => setSource(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold bg-surface text-fg">
              {dynamicSources.length === 0 && <option value="COCHIN">COCHIN</option>}
              {dynamicSources.map(s => <option key={s} value={s}>{s}</option>)}
              <option value="CUSTOM">CUSTOM (MANUAL)</option>
            </select>
            {source === "CUSTOM" && (
              <input type="text" value={customSource} onChange={e => setCustomSource(e.target.value)} placeholder="Type custom source..." className="w-full text-sm p-3 mt-2 rounded-xl border border-border-strong uppercase outline-none focus:ring-2 focus:ring-[#FF5A00] bg-surface text-fg" required />
            )}
          </div>

          {/* 6. Destination */}
          <div className="bg-app p-2 -m-2 rounded-xl border border-border">
            <label className="block text-[10px] font-bold text-[#FF5A00] uppercase mb-1">6. Destination *</label>
            <select value={destinationLabel} onChange={e => setDestinationLabel(e.target.value)} className="w-full text-sm p-3 rounded-xl border-2 border-[#FF5A00]/30 outline-none focus:border-[#FF5A00] font-bold text-fg bg-surface" disabled={!selectedTruckId}>
              <option value="-- SELECT DESTINATION --">-- SELECT DESTINATION --</option>
              {validRoutes.map(r => <option key={r.id} value={r.destination_name}>{r.destination_name} (₹{r.freight_rate_per_ton}/MT)</option>)}
              <option value="-- MANUAL / SPOT ROUTE --">-- MANUAL / SPOT ROUTE --</option>
            </select>
            {isManualRoute && (
              <input type="text" value={customDest} onChange={e => setCustomDest(e.target.value)} placeholder="Type custom destination..." className="w-full text-sm p-3 mt-2 rounded-xl border border-border-strong uppercase outline-none focus:ring-2 focus:ring-[#FF5A00] bg-surface text-fg" required />
            )}
          </div>

          {/* 7. Freight Rate */}
          <div>
            <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">7. Freight Rate / MT (₹) *</label>
            <input 
              type="number" 
              step="0.01" 
              min="0.01"
              value={freightRate} 
              onChange={e => setFreightRate(e.target.value === "" ? "" : parseFloat(e.target.value))} 
              className={`w-full text-sm p-3 rounded-xl border outline-none font-bold ${isManualRoute ? 'border-border-strong focus:ring-2 focus:ring-[#FF5A00] text-[#FF5A00] bg-surface' : 'border-emerald-200 bg-emerald-50 text-emerald-700 cursor-not-allowed'}`} 
              disabled={!isManualRoute} 
              readOnly={!isManualRoute}
              required 
            />
          </div>

          {/* 8. Loaded MT */}
          <div>
            <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">8. Loaded MT *</label>
            <input 
              type="number" 
              step="0.01" 
              min="0.01"
              value={loadedMt} 
              onChange={e => setLoadedMt(e.target.value === "" ? "" : parseFloat(e.target.value))} 
              className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold bg-surface text-fg" 
              required 
            />
          </div>

          {/* 9. Driver Name */}
          <div>
            <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">9. Driver Name *</label>
            <select value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] font-bold bg-surface text-fg" required disabled={isLoading || !selectedTruckId}>
              <option value="">-- SELECT DRIVER --</option>
              {drivers.map(d => <option key={d.driver_id} value={String(d.driver_id)}>{d.driver_code} - {d.full_name}</option>)}
            </select>
          </div>

          {/* 10. Driver Bata */}
          <div>
            <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">10. Driver Bata (₹) *</label>
            <input 
              type="number" 
              min="0"
              value={driverBata} 
              onChange={e => setDriverBata(e.target.value === "" ? "" : parseFloat(e.target.value))} 
              className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] bg-surface text-fg" 
              required 
            />
          </div>

          {/* 11. Advance */}
          <div>
            <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">11. Direct Advance (₹)</label>
            <input 
              type="number" 
              min="0"
              value={advance} 
              onChange={e => setAdvance(e.target.value === "" ? "" : parseFloat(e.target.value))} 
              placeholder="0.00" 
              className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] bg-surface text-fg" 
            />
          </div>

          {/* 12. Diesel Rate */}
          <div>
            <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">12. Diesel Rate (₹/L)</label>
            <input 
              type="number" 
              step="0.1" 
              min="0"
              value={dieselRate} 
              onChange={e => setDieselRate(e.target.value === "" ? 0 : parseFloat(e.target.value))} 
              className="w-full text-sm p-3 rounded-xl border border-border-strong outline-none focus:ring-2 focus:ring-[#FF5A00] bg-app text-fg font-bold" 
            />
          </div>

          {/* 13. Diesel Issued & Odo (Grouped) */}
          <div className="grid grid-cols-2 gap-3 border border-border p-2 rounded-xl bg-app">
             <div>
                <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">13. Diesel Issued (L)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  min="0"
                  value={dieselL} 
                  onChange={e => setDieselL(e.target.value === "" ? "" : parseFloat(e.target.value))} 
                  placeholder="0.0" 
                  className="w-full text-sm p-2 rounded border border-border outline-none focus:border-[#FF5A00] bg-surface text-fg" 
                />
             </div>
             <div>
                <label className="block text-[10px] font-bold text-fg-secondary uppercase mb-1">Start Odo KM</label>
                <input 
                  type="number" 
                  min="0"
                  value={startKm} 
                  onChange={e => setStartKm(e.target.value === "" ? "" : parseFloat(e.target.value))} 
                  placeholder="0.0" 
                  className="w-full text-sm p-2 rounded border border-border outline-none focus:border-[#FF5A00] bg-surface text-fg" 
                />
             </div>
          </div>

        </div>

        {/* Calculations Section */}
        <div className="pt-6 border-t border-border flex flex-col md:flex-row gap-6 items-center justify-between">
          <div className="flex gap-6 w-full md:w-auto justify-between md:justify-start">
            <div>
              <p className="text-[10px] font-bold text-fg-secondary uppercase mb-0">Expected Gross Freight</p>
              <p className="text-xl md:text-2xl font-bold text-[#FF5A00]">₹{(Number(loadedMt || 0) * Number(freightRate || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-fg-secondary uppercase mb-0">Upfront Trip Expense</p>
              <p className="text-xl md:text-2xl font-bold text-rose-600">₹{((Number(dieselL || 0) * dieselRate) + Number(driverBata || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
            <button 
              type="button" 
              onClick={handleClear}
              className="flex-1 md:flex-none px-6 py-4 bg-surface-raised hover:bg-surface-raised text-fg border border-border-strong font-bold text-sm rounded-xl transition-all active:scale-95"
            >
              Clear Form
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="flex-2 md:flex-none px-10 py-4 bg-[#FF5A00] hover:bg-[#e04f00] disabled:bg-slate-300 text-white font-bold text-sm rounded-xl transition-all shadow-md active:scale-95"
            >
              {isSubmitting ? "Dispatching..." : "🚀 Dispatch"}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
