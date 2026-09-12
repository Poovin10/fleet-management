"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";

// --- CUSTOM SEARCHABLE SELECT COMPONENT ---
function SearchableSelect({ options, value, onChange, placeholder, disabled }: { options: {label: string, value: string}[], value: string, onChange: (val: string) => void, placeholder: string, disabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => String(o.value) === String(value));

  return (
    <div ref={containerRef} className="relative w-full">
      <div 
        className={`w-full text-sm p-3 rounded-xl border ${isOpen ? 'border-[#FF5A00] ring-1 ring-[#FF5A00]' : 'border-[#2B3142]'} bg-[#1A1F2C] text-white flex justify-between items-center cursor-pointer font-bold ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <span className="text-[10px] text-slate-400">▼</span>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[#12141C] border border-[#2B3142] rounded-xl shadow-2xl max-h-60 overflow-y-auto">
          <div className="p-2 sticky top-0 bg-[#12141C]">
            <input 
              type="text" 
              className="w-full text-xs p-2.5 rounded-lg bg-[#1A1F2C] border border-[#2B3142] text-white outline-none focus:border-[#FF5A00]" 
              placeholder="Type to search..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              onClick={(e) => e.stopPropagation()} 
              autoFocus
            />
          </div>
          <div className="pb-2 px-2">
            {options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).map(o => (
              <div 
                key={o.value} 
                className="p-2.5 text-xs font-bold text-slate-300 hover:bg-[#FF5A00]/20 hover:text-white rounded-lg cursor-pointer truncate"
                onClick={() => { onChange(o.value); setIsOpen(false); setSearch(""); }}
              >
                {o.label}
              </div>
            ))}
            {options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())).length === 0 && (
              <div className="p-3 text-xs text-slate-500 text-center font-bold">No matches found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface TripFormProps {
  onSuccess?: () => void | Promise<void>;
}

export function TripForm({ onSuccess }: TripFormProps) {
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState({
    isOpen: false, title: "", message: "", type: "info" as "success" | "error" | "info"
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
  const [destinationLabel, setDestinationLabel] = useState("");
  const [customDest, setCustomDest] = useState("");
  const [freightRate, setFreightRate] = useState<number | "">("");
  const [loadedMt, setLoadedMt] = useState<number | "">("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [driverBata, setDriverBata] = useState<number | "">("");
  const [advance, setAdvance] = useState<number | "">("");
  const [dieselRate, setDieselRate] = useState<number>(95.0);
  const [dieselL, setDieselL] = useState<number | "">("");
  const [startKm, setStartKm] = useState<number | "">("");
  
  const [expectedEndKm, setExpectedEndKm] = useState<number | "">("");
  const [isTankFull, setIsTankFull] = useState(false);
  const [isManualRoute, setIsManualRoute] = useState(false);
  
  // COMPLIANCE ALERTS STATE
  const [complianceWarnings, setComplianceWarnings] = useState<any[]>([]);

  // DYNAMIC SOURCES LOGIC
  const dynamicSources = Array.from(new Set(freightMaster.map(r => r.origin?.toUpperCase().trim()).filter(Boolean))).sort();

  const handleClear = () => {
    setStartDate(new Date().toISOString().split("T")[0]);
    setLrNo(""); setCargoType("BULK"); setSelectedTruckId(""); setSource("COCHIN"); setCustomSource("");
    setDestinationLabel(""); setCustomDest(""); setFreightRate(""); setLoadedMt(""); setSelectedDriverId("");
    setDriverBata(""); setAdvance(""); setDieselL(""); setStartKm(""); setIsManualRoute(false);
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

  // COMPLIANCE ENGINE (10 DAYS)
  useEffect(() => {
    const warnings: any[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tenDaysFromNow = new Date(today); tenDaysFromNow.setDate(today.getDate() + 10);

    const checkWarning = (name: string, docName: string, dateVal: string) => {
      if (!dateVal) return;
      const expDate = new Date(dateVal); expDate.setHours(0, 0, 0, 0);
      if (expDate <= tenDaysFromNow) warnings.push({ name, docName, date: dateVal, isUrgent: expDate <= today });
    };

    const selDriver = drivers.find(d => String(d.driver_id) === String(selectedDriverId));
    if (selDriver) checkWarning(`Driver ${selDriver.driver_code}`, "License", selDriver.license_expiry_date);

    const selTruck = vehicles.find(v => String(v.vehicle_id) === String(selectedTruckId));
    if (selTruck) {
      const tName = `Truck ${selTruck.vehicle_number}`;
      checkWarning(tName, "FC", selTruck.fc_expiry_date);
      checkWarning(tName, "Insurance", selTruck.insurance_expiry_date);
      checkWarning(tName, "Q-Tax", selTruck.qtax_expiry_date);
      checkWarning(tName, "PUC", selTruck.puc_expiry_date);
      checkWarning(tName, "NP", selTruck.np_expiry_date);
      checkWarning(tName, "State Permit", selTruck.state_permit_expiry_date);
      if (String(selTruck.truck_type).toUpperCase().includes("BULK")) checkWarning(tName, "Tank Cert", selTruck.tank_cert_expiry_date);
    }
    setComplianceWarnings(warnings);
  }, [selectedDriverId, selectedTruckId, drivers, vehicles]);

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
    let isCapMatch = false;
    if (activeTruckCap === 0) isCapMatch = true; 
    else {
      const dbCap = String(r.capacity_tons || "");
      if (dbCap.includes("/")) isCapMatch = dbCap.includes(String(activeTruckCap));
      else isCapMatch = Number(dbCap) === activeTruckCap;
    }
    return r.origin?.trim().toUpperCase() === finalSource.trim().toUpperCase() && r.cargo_type?.toUpperCase() === cargoType.toUpperCase() && isCapMatch;
  });

  useEffect(() => {
    if (selectedTruckId) {
      const truck = vehicles.find((v) => String(v.vehicle_id) === String(selectedTruckId));
      if (truck && truck.carrying_capacity_tons) setLoadedMt(Number(truck.carrying_capacity_tons));
      
      const fetchTruckHistory = async () => {
        const { data: lastTrip } = await supabase.from("trips").select("primary_driver_id").eq("vehicle_id", selectedTruckId).not("primary_driver_id", "is", null).order("trip_id", { ascending: false }).limit(1);
        if (lastTrip && lastTrip.length > 0 && lastTrip[0].primary_driver_id) setSelectedDriverId(String(lastTrip[0].primary_driver_id));
        else setSelectedDriverId("");

        const { data: lastOdoTrip } = await supabase.from("trips").select("end_km, start_km").eq("vehicle_id", selectedTruckId).order("trip_id", { ascending: false }).limit(1);
        const { data: lastOdoFuel } = await supabase.from("diesel_fuel_logs").select("filling_odometer_km").eq("vehicle_id", selectedTruckId).order("fuel_log_id", { ascending: false }).limit(1);
        
        let odo = 0;
        if (lastOdoTrip && lastOdoTrip.length > 0) odo = Math.max(odo, Number(lastOdoTrip[0].end_km || lastOdoTrip[0].start_km || 0));
        if (lastOdoFuel && lastOdoFuel.length > 0) odo = Math.max(odo, Number(lastOdoFuel[0].filling_odometer_km || 0));
        setStartKm(odo > 0 ? odo : "");
      };
      fetchTruckHistory();
    } else { setLoadedMt(""); setSelectedDriverId(""); setStartKm(""); }
  }, [selectedTruckId, vehicles, supabase]);

  useEffect(() => {
    if (destinationLabel === "MANUAL_SPOT_ROUTE") {
      setIsManualRoute(true); setFreightRate(""); 
    } else if (destinationLabel) {
      setIsManualRoute(false);
      const matchedRoute = validRoutes.find(r => String(r.destination_name) === String(destinationLabel));
      if (matchedRoute) setFreightRate(Number(matchedRoute.freight_rate_per_ton));
    } else {
      setIsManualRoute(false); setFreightRate("");
    }
  }, [destinationLabel, validRoutes]);

  useEffect(() => {
    const finalDest = isManualRoute ? customDest : destinationLabel;
    if (finalSource && finalDest && finalDest !== "MANUAL_SPOT_ROUTE") {
      const match = bataMaster.find(b => {
        let isCapMatch = false;
        const dbCap = String(b.capacity_tons || "");
        if (dbCap.includes("/")) isCapMatch = dbCap.includes(String(activeTruckCap));
        else isCapMatch = Number(dbCap) === activeTruckCap;
        return b.origin?.trim().toUpperCase() === finalSource.trim().toUpperCase() && b.destination_name?.trim().toUpperCase() === finalDest.trim().toUpperCase() && b.cargo_type === cargoType && isCapMatch;
      });
      if (match) setDriverBata(Number(match.standard_bata_inr));
      else setDriverBata("");
    }
  }, [finalSource, destinationLabel, customDest, cargoType, activeTruckCap, bataMaster, isManualRoute]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTruckId || !selectedDriverId || !lrNo.trim() || freightRate === "" || Number(freightRate) <= 0 || loadedMt === "" || Number(loadedMt) <= 0) {
      return setAlertConfig({ isOpen: true, title: "Invalid Input", message: "Please ensure all mandatory fields have valid positive values (> 0) before dispatching.", type: "error" });
    }

    setIsSubmitting(true);
    const finalDest = isManualRoute ? customDest.toUpperCase() : destinationLabel;
    const finalStartKm = Number(startKm) || 0;
    const finalEndKm = Number(expectedEndKm) || 0;
    const totalKm = finalEndKm > finalStartKm ? finalEndKm - finalStartKm : 0;
    const grossFreight = Math.round(Number(loadedMt) * Number(freightRate) * 100) / 100;
    const fuelCost = Math.round((Number(dieselL) || 0) * dieselRate * 100) / 100;

    const { data: newTrip, error: tripError } = await supabase.from("trips").insert([{
      trip_number: lrNo.toUpperCase().trim(), branch_id: 1, vehicle_id: Number(selectedTruckId), primary_driver_id: Number(selectedDriverId),
      trip_start_date: startDate, trip_end_date: startDate, origin: finalSource.toUpperCase(), destination: finalDest,
      start_km: finalStartKm, end_km: finalEndKm, total_km_run: totalKm, tonnage_loaded: Number(loadedMt), loaded_weight_mt: Number(loadedMt),
      freight_revenue: grossFreight, fuel_litres: Number(dieselL) || 0, fuel_expense: fuelCost, driver_bata: Number(driverBata) || 0,
      cash_advance_issued: Number(advance) || 0, trip_status: "IN_TRANSIT", is_tank_full: isTankFull
    }]).select().single();

    if (tripError) { setIsSubmitting(false); return setAlertConfig({ isOpen: true, title: "Dispatch Failed", message: "Error: " + tripError.message, type: "error" }); }

    let fuelErrorMessage = null;
    if (Number(dieselL) > 0) {
      const { error: fuelError } = await supabase.from("diesel_fuel_logs").insert([{
        fuel_date: startDate, vehicle_id: Number(selectedTruckId), trip_id: newTrip.trip_id, lr_number: lrNo.toUpperCase().trim(),
        diesel_category: "TRIP_DIESEL", litres_filled: Number(dieselL), diesel_rate_per_litre: dieselRate, total_fuel_cost: fuelCost,
        filling_odometer_km: finalStartKm, is_tank_full: isTankFull
      }]);
      if (fuelError) fuelErrorMessage = fuelError.message;
    }

    await supabase.from("vehicles").update({ current_status: "IN_TRANSIT", status_remarks: `Trip ${lrNo.toUpperCase()}: ${finalSource.toUpperCase()} ➔ ${finalDest}`, status_updated_at: new Date().toISOString() }).eq("vehicle_id", Number(selectedTruckId));

    if (fuelErrorMessage) setAlertConfig({ isOpen: true, title: "Trip Created (Fuel Error)", message: `Trip dispatched, BUT diesel log failed (${fuelErrorMessage}). Add it manually.`, type: "error" });
    else setAlertConfig({ isOpen: true, title: "Trip Dispatched!", message: `LR No. ${lrNo.toUpperCase()} registered and truck is In Transit.`, type: "success" });
    
    setIsSubmitting(false); handleClear(); if (onSuccess) onSuccess();
  };

  // Pre-calculated Select Options
  const truckOptions = availableTrucks.map(v => ({ value: String(v.vehicle_id), label: `${v.vehicle_number} [${v.truck_type}]` }));
  const sourceOptions = dynamicSources.map(s => ({ value: s, label: s })).concat([{ value: "CUSTOM", label: "CUSTOM (MANUAL)" }]);
  const destOptions = validRoutes.map(r => ({ value: r.destination_name, label: `${r.destination_name} (₹${r.freight_rate_per_ton}/MT)` })).concat([{ value: "MANUAL_SPOT_ROUTE", label: "-- MANUAL / SPOT ROUTE --" }]);
  const driverOptions = drivers.map(d => ({ value: String(d.driver_id), label: `${d.driver_code} - ${d.full_name}` }));

  // Helper class for number inputs to hide arrows and handle scroll
  const noSpinClass = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const numProps = { step: "any", onWheel: (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur() };

  return (
    <div className="bg-[#12141C] border border-[#222634] rounded-2xl p-6 sm:p-8 shadow-xl max-w-4xl mx-auto animate-in fade-in duration-300 relative">
      <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} />

      <div className="border-b border-[#222634] pb-4 mb-6">
        <h3 className="text-base font-black text-white uppercase tracking-tight">Initiate Trip Dispatch</h3>
        <p className="text-xs text-slate-400 mt-1">Fill out the fields below in sequence to compute freight rules.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">1. Start Date *</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#2B3142] outline-none focus:border-[#FF5A00] bg-[#1A1F2C] text-white font-bold" required />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">2. LR Number *</label>
            <input type="text" value={lrNo} onChange={e => setLrNo(e.target.value)} placeholder="E.G. 40080069852" className="w-full text-sm p-3 rounded-xl border border-[#2B3142] uppercase outline-none focus:border-[#FF5A00] font-bold bg-[#1A1F2C] text-white" required />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">3. Cargo Type *</label>
            <div className="flex bg-[#0F1117] p-1 rounded-xl border border-[#2B3142]">
              <button type="button" onClick={() => { setCargoType("BULK"); setSelectedTruckId(""); }} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${cargoType === "BULK" ? "bg-[#FF5A00] text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>BULK</button>
              <button type="button" onClick={() => { setCargoType("BAG"); setSelectedTruckId(""); }} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-colors ${cargoType === "BAG" ? "bg-[#FF5A00] text-white shadow-sm" : "text-slate-400 hover:text-white"}`}>BAGS</button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">4. Assigned Truck ({cargoType}) *</label>
            <SearchableSelect options={truckOptions} value={selectedTruckId} onChange={setSelectedTruckId} placeholder="-- SELECT TRUCK --" disabled={isLoading} />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">5. Source (Origin) *</label>
            <SearchableSelect options={sourceOptions} value={source} onChange={setSource} placeholder="-- SELECT SOURCE --" />
            {source === "CUSTOM" && (
              <input type="text" value={customSource} onChange={e => setCustomSource(e.target.value)} placeholder="Type custom source..." className="w-full text-sm p-3 mt-2 rounded-xl border border-[#2B3142] uppercase outline-none focus:border-[#FF5A00] bg-[#1A1F2C] text-white font-bold" required />
            )}
          </div>

          <div className="bg-[#161922] p-2 -m-2 rounded-xl border border-[#2B3142]">
            <label className="block text-[10px] font-bold text-[#FF5A00] uppercase mb-1">6. Destination *</label>
            <SearchableSelect options={destOptions} value={destinationLabel} onChange={setDestinationLabel} placeholder="-- SELECT DESTINATION --" disabled={!selectedTruckId} />
            {isManualRoute && (
              <input type="text" value={customDest} onChange={e => setCustomDest(e.target.value)} placeholder="Type custom destination..." className="w-full text-sm p-3 mt-2 rounded-xl border border-[#2B3142] uppercase outline-none focus:border-[#FF5A00] bg-[#1A1F2C] text-white font-bold" required />
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">7. Freight Rate / MT (₹) *</label>
            <input 
              type="number" {...numProps}
              value={freightRate} onChange={e => setFreightRate(e.target.value === "" ? "" : parseFloat(e.target.value))} 
              className={`w-full text-sm p-3 rounded-xl border outline-none font-black ${noSpinClass} ${isManualRoute ? 'border-[#2B3142] focus:border-[#FF5A00] text-[#FF5A00] bg-[#1A1F2C]' : 'border-emerald-900 bg-emerald-950/40 text-emerald-400 cursor-not-allowed'}`} 
              disabled={!isManualRoute} readOnly={!isManualRoute} required 
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">8. Loaded MT *</label>
            <input 
              type="number" {...numProps}
              value={loadedMt} onChange={e => setLoadedMt(e.target.value === "" ? "" : parseFloat(e.target.value))} 
              className={`w-full text-sm p-3 rounded-xl border border-[#2B3142] outline-none focus:border-[#FF5A00] font-bold bg-[#1A1F2C] text-white ${noSpinClass}`} 
              required 
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">9. Driver Name *</label>
            <SearchableSelect options={driverOptions} value={selectedDriverId} onChange={setSelectedDriverId} placeholder="-- SELECT DRIVER --" disabled={isLoading || !selectedTruckId} />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">10. Driver Bata (₹) *</label>
            <input 
              type="number" {...numProps}
              value={driverBata} onChange={e => setDriverBata(e.target.value === "" ? "" : parseFloat(e.target.value))} 
              className={`w-full text-sm p-3 rounded-xl border border-[#2B3142] outline-none focus:border-[#FF5A00] bg-[#1A1F2C] text-white font-bold ${noSpinClass}`} 
              required 
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">11. Direct Advance (₹)</label>
            <input 
              type="number" {...numProps}
              value={advance} onChange={e => setAdvance(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.00" 
              className={`w-full text-sm p-3 rounded-xl border border-[#2B3142] outline-none focus:border-[#FF5A00] bg-[#1A1F2C] text-white font-bold ${noSpinClass}`} 
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">12. Diesel Rate (₹/L)</label>
            <input 
              type="number" {...numProps}
              value={dieselRate} onChange={e => setDieselRate(e.target.value === "" ? 0 : parseFloat(e.target.value))} 
              className={`w-full text-sm p-3 rounded-xl border border-[#2B3142] outline-none focus:border-[#FF5A00] bg-[#0F1117] text-white font-bold ${noSpinClass}`} 
            />
          </div>

          <div className="grid grid-cols-2 gap-3 border border-[#2B3142] p-2 rounded-xl bg-[#0F1117]">
             <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">13. Diesel Issued (L)</label>
                <input 
                  type="number" {...numProps}
                  value={dieselL} onChange={e => setDieselL(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.0" 
                  className={`w-full text-sm p-2.5 rounded-lg border border-[#2B3142] outline-none focus:border-[#FF5A00] bg-[#1A1F2C] text-[#FF5A00] font-black ${noSpinClass}`} 
                />
             </div>
             <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Start Odo KM</label>
                <input 
                  type="number" {...numProps}
                  value={startKm} onChange={e => setStartKm(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0.0" 
                  className={`w-full text-sm p-2.5 rounded-lg border border-[#2B3142] outline-none focus:border-[#FF5A00] bg-[#1A1F2C] text-sky-400 font-black ${noSpinClass}`} 
                />
             </div>
          </div>
        </div>

        {complianceWarnings.length > 0 && (
          <div className="bg-rose-950/20 border border-rose-900/50 p-4 rounded-xl mt-4 mb-2 animate-in slide-in-from-top-2">
            <h4 className="text-[10px] font-black text-rose-500 uppercase mb-2 flex items-center gap-2">⚠️ Compliance Warnings (Dispatching Allowed)</h4>
            {complianceWarnings.map((w, i) => (
              <p key={i} className={`text-xs font-bold ${w.isUrgent ? 'text-rose-500' : 'text-amber-500'}`}>
                • {w.name} {w.docName} expiring on {w.date}
              </p>
            ))}
          </div>
        )}

        <div className="pt-6 border-t border-[#222634] flex flex-col md:flex-row gap-6 items-center justify-between">
          <div className="flex gap-6 w-full md:w-auto justify-between md:justify-start">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-0">Expected Gross Freight</p>
              <p className="text-xl md:text-2xl font-black text-[#FF5A00]">₹{(Number(loadedMt || 0) * Number(freightRate || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-0">Upfront Trip Expense</p>
              <p className="text-xl md:text-2xl font-black text-rose-500">₹{((Number(dieselL || 0) * dieselRate) + Number(driverBata || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
            <button type="button" onClick={handleClear} className="flex-1 md:flex-none px-6 py-4 bg-[#1A1F2C] hover:bg-[#222634] text-slate-300 border border-[#2B3142] font-bold text-sm rounded-xl transition-all active:scale-95">
              Clear Form
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-[2] md:flex-none px-10 py-4 bg-[#FF5A00] hover:bg-[#e04f00] disabled:bg-slate-700 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20 active:scale-95">
              {isSubmitting ? "Dispatching..." : "🚀 Dispatch"}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
