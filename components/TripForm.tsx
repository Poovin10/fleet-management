"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function TripForm({ onSuccess }: { onSuccess?: () => void }) {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);

  // Exact Schema Master Data States
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [driversList, setDriversList] = useState<any[]>([]);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [freightRates, setFreightRates] = useState<any[]>([]);
  const [bataRates, setBataRates] = useState<any[]>([]);

  // Form Field States
  const [tripDate, setTripDate] = useState(new Date().toISOString().split('T')[0]);
  const [lrNo, setLrNo] = useState("");
  const [cargoType, setCargoType] = useState("BULK");
  const [selectedTruckNumber, setSelectedTruckNumber] = useState("");
  const [origin, setOrigin] = useState("COCHIN");
  const [destination, setDestination] = useState("");
  const [tonnage, setTonnage] = useState<number | "">("");
  const [driverName, setDriverName] = useState("");
  const [freightRate, setFreightRate] = useState<number | "">("");
  
  // Expenses
  const [dieselIssued, setDieselIssued] = useState<number | "">("");
  const [bata, setBata] = useState<number | "">("");
  const [advancePaid, setAdvancePaid] = useState<number | "">("");

  // Validation
  const [lrError, setLrError] = useState("");

  useEffect(() => {
    async function fetchMasterData() {
      setIsLoading(true);
      
      // Fetching from exact table names found in your Streamlit code
      const [vehRes, drvRes, tripsRes, ratesRes, bataRes] = await Promise.all([
        supabase.from('vehicles').select('*').eq('is_active', true),
        supabase.from('drivers').select('*').eq('is_active', true),
        supabase.from('trips').select('trip_number, vehicle_id, trip_status').neq('trip_status', 'COMPLETED'),
        supabase.from('destinations_freight_master').select('*').eq('is_active', true),
        supabase.from('driver_bata_master').select('*')
      ]);

      if (vehRes.data) setVehicles(vehRes.data);
      if (drvRes.data) setDriversList(drvRes.data);
      if (tripsRes.data) setActiveTrips(tripsRes.data);
      if (ratesRes.data) setFreightRates(ratesRes.data);
      if (bataRes.data) setBataRates(bataRes.data);
      
      setIsLoading(false);
    }
    fetchMasterData();
  }, [supabase]);

  // Filtering Logic exactly matching Streamlit
  const availableVehicles = vehicles.filter((v) => {
    // 1. Check if truck is busy in active trips
    const isBusy = activeTrips.some(t => t.vehicle_id === v.vehicle_id);
    if (isBusy) return false;

    // 2. Cargo Type Check
    const vType = String(v.truck_type || "").toUpperCase();
    if (cargoType === "BULK") {
      return vType.includes("BULK");
    } else {
      return !vType.includes("BULK"); // Streamlit logic: Bags = not bulk
    }
  });

  // Auto-fill Driver and Capacity when Truck is selected
  useEffect(() => {
    if (selectedTruckNumber) {
      const truckData = vehicles.find(v => v.vehicle_number === selectedTruckNumber);
      if (truckData) {
        setTonnage(truckData.carrying_capacity_tons || "");
      }
    } else {
      setTonnage("");
    }
  }, [selectedTruckNumber, vehicles]);

  // Auto-fill Rates and Bata based on Master Data
  useEffect(() => {
    if (origin && destination && tonnage) {
      // Find matching freight rate
      const matchingRate = freightRates.find(r => 
        String(r.origin).toUpperCase() === origin.toUpperCase() && 
        String(r.destination_name).toUpperCase() === destination.toUpperCase() &&
        String(r.cargo_type).toUpperCase() === cargoType &&
        Number(r.capacity_tons) === Number(tonnage)
      );
      if (matchingRate) setFreightRate(matchingRate.freight_rate_per_ton);

      // Find matching bata
      const matchingBata = bataRates.find(b => 
        String(b.origin).toUpperCase() === origin.toUpperCase() &&
        String(b.destination_name).toUpperCase() === destination.toUpperCase() &&
        String(b.cargo_type).toUpperCase() === cargoType &&
        Number(b.capacity_tons) === Number(tonnage)
      );
      if (matchingBata) setBata(matchingBata.standard_bata_inr);
    }
  }, [origin, destination, tonnage, cargoType, freightRates, bataRates]);

  // LR Duplicate Check
  const validateLR = (value: string) => {
    setLrNo(value);
    const isDuplicateActive = activeTrips.some(t => String(t.trip_number).trim().toUpperCase() === value.trim().toUpperCase());
    setLrError(isDuplicateActive ? "This LR Number is currently active. Cannot dispatch duplicate." : "");
  };

  const expectedFreight = (Number(tonnage) || 0) * (Number(freightRate) || 0);
  const totalTripCost = (Number(dieselIssued) || 0) + (Number(bata) || 0) + (Number(advancePaid) || 0);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lrError || !selectedTruckNumber) return;

    // Get the foreign keys needed for the trips table
    const truckData = vehicles.find(v => v.vehicle_number === selectedTruckNumber);
    const driverData = driversList.find(d => String(d.full_name).toUpperCase() === driverName.toUpperCase());

    const vehicle_id = truckData ? truckData.vehicle_id : null;
    const driver_id = driverData ? driverData.driver_id : null;

    if (!vehicle_id) return alert("Error: Vehicle ID not found.");

    // 1. Insert into exact Streamlit Trips Schema
    const { data: newTrip, error: tripError } = await supabase.from('trips').insert([
      {
        trip_number: lrNo,
        vehicle_id: vehicle_id,
        primary_driver_id: driver_id,
        trip_start_date: tripDate,
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        tonnage_loaded: Number(tonnage) || 0,
        loaded_weight_mt: Number(tonnage) || 0,
        freight_revenue: expectedFreight,
        fuel_litres: Number(dieselIssued) || 0, // Using liters field to store diesel amount for now
        driver_bata: Number(bata) || 0,
        cash_advance_issued: Number(advancePaid) || 0,
        trip_status: 'IN_TRANSIT'
      }
    ]).select();

    if (tripError) {
      return alert("Error dispatching trip: " + tripError.message);
    }

    // 2. Update Vehicle Status
    await supabase.from('vehicles')
      .update({ 
        current_status: 'IN_TRANSIT', 
        status_remarks: `Trip ${lrNo}: ${origin.toUpperCase()} ➔ ${destination.toUpperCase()}` 
      })
      .eq('vehicle_id', vehicle_id);

    alert("Trip Dispatched Successfully!");
    if (onSuccess) onSuccess();
    
    // Reset Form
    setLrNo(""); setSelectedTruckNumber(""); setDestination(""); setDriverName(""); 
    setTonnage(""); setFreightRate(""); setDieselIssued(""); setBata(""); setAdvancePaid("");
  };

  const uniqueOrigins = Array.from(new Set(freightRates.map(r => r.origin))).filter(Boolean);
  const uniqueDestinations = Array.from(new Set(freightRates.map(r => r.destination_name))).filter(Boolean);
  const uniqueDrivers = Array.from(new Set(driversList.map(d => d.full_name))).filter(Boolean);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm max-w-4xl mx-auto animate-in fade-in duration-300">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Trip Dispatch Entry</h3>
        <p className="text-xs text-slate-500 mt-1">Smart automated dispatch mapping directly to your Supabase schema.</p>
      </div>

      <form onSubmit={handleDispatch} className="space-y-6">
        
        {/* ROW 1: Date & LR Number */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Trip Date *</label>
            <input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">LR / Invoice No *</label>
            <input type="text" value={lrNo} onChange={(e) => validateLR(e.target.value)} placeholder="e.g. 40080069852" className={`w-full text-sm p-3 rounded-xl border ${lrError ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-white'} outline-none focus:ring-2 focus:ring-indigo-500 font-semibold uppercase transition-all`} required />
            {lrError && <p className="text-[10px] text-rose-600 font-bold mt-1">{lrError}</p>}
          </div>
        </div>

        {/* ROW 2: Cargo Type & Filtered Truck Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Cargo Type</label>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button type="button" onClick={() => { setCargoType("BULK"); setSelectedTruckNumber(""); }} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${cargoType === "BULK" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>BULK</button>
              <button type="button" onClick={() => { setCargoType("BAGS"); setSelectedTruckNumber(""); }} className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${cargoType === "BAGS" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>BAGS</button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Truck No. ({availableVehicles.length} Ready)</label>
            <select value={selectedTruckNumber} onChange={(e) => setSelectedTruckNumber(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900" required disabled={isLoading || availableVehicles.length === 0}>
              <option value="">{isLoading ? "Loading..." : availableVehicles.length === 0 ? `No ${cargoType} trucks available` : `-- SELECT TRUCK --`}</option>
              {availableVehicles.map((v, i) => (
                <option key={v.vehicle_id || i} value={v.vehicle_number}>{v.vehicle_number}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ROW 3: Source & Destination */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Source (Origin) *</label>
            <input list="origin-master" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Select or type new..." className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white uppercase outline-none focus:ring-2 focus:ring-indigo-500" required />
            <datalist id="origin-master">{uniqueOrigins.map((org, i) => <option key={i} value={String(org)} />)}</datalist>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Destination *</label>
            <input list="destination-master" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Select or type new..." className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white uppercase outline-none focus:ring-2 focus:ring-indigo-500" required />
            <datalist id="destination-master">{uniqueDestinations.map((dest, i) => <option key={i} value={String(dest)} />)}</datalist>
          </div>
        </div>

        {/* ROW 4: Driver & Tonnage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Driver Name *</label>
            <input list="driver-master" type="text" value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Enter or select driver" className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-emerald-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" required />
            <datalist id="driver-master">{uniqueDrivers.map((drv, i) => <option key={i} value={String(drv)} />)}</datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-2">Ton Dispatched (MT)</label>
              <input type="number" step="0.01" value={tonnage} onChange={(e) => setTonnage(parseFloat(e.target.value))} placeholder="0.00" className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-emerald-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500" required />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-2">Freight Rate / MT (₹)</label>
              <input type="number" step="0.01" value={freightRate} onChange={(e) => setFreightRate(parseFloat(e.target.value))} placeholder="0.00" className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-emerald-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        {/* ROW 5: Expenses */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200 pt-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Diesel Issued (Litres)</label>
            <input type="number" step="0.1" value={dieselIssued} onChange={(e) => setDieselIssued(parseFloat(e.target.value))} placeholder="0.0 L" className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-rose-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Bata (₹)</label>
            <input type="number" value={bata} onChange={(e) => setBata(parseFloat(e.target.value))} placeholder="0.00" className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-emerald-50 focus:bg-white outline-none focus:ring-2 focus:ring-rose-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Advance Paid (₹)</label>
            <input type="number" value={advancePaid} onChange={(e) => setAdvancePaid(parseFloat(e.target.value))} placeholder="0.00" className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-rose-500" />
          </div>
        </div>

        {/* Trip Summary Footer */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-6 flex flex-wrap justify-between items-center gap-4">
          <div className="flex gap-6">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Expected Freight</p>
              <p className="text-lg font-black text-indigo-700">₹{expectedFreight.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Total Trip Expense</p>
              <p className="text-lg font-black text-rose-600">₹{totalTripCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          <button type="submit" disabled={!!lrError || !selectedTruckNumber} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95">
            Dispatch Trip
          </button>
        </div>

      </form>
    </div>
  );
}
