"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function TripForm({ onSuccess }: { onSuccess?: () => void }) {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);

  // Master Data States
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  const [freightRates, setFreightRates] = useState<any[]>([]);
  const [bataRates, setBataRates] = useState<any[]>([]);

  // Form Field States
  const [tripDate, setTripDate] = useState(new Date().toISOString().split('T')[0]);
  const [lrNo, setLrNo] = useState("");
  const [cargoType, setCargoType] = useState("BULK");
  const [selectedTruck, setSelectedTruck] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [tonnage, setTonnage] = useState<number | "">("");
  const [driver, setDriver] = useState("");
  const [freightRate, setFreightRate] = useState<number | "">("");
  
  // Expenses
  const [dieselIssued, setDieselIssued] = useState<number | "">("");
  const [bata, setBata] = useState<number | "">("");
  const [advancePaid, setAdvancePaid] = useState<number | "">("");

  // Validation States
  const [lrError, setLrError] = useState("");

  useEffect(() => {
    async function fetchMasterData() {
      setIsLoading(true);
      
      // Fetch all required data in parallel
      const [vehRes, tripsRes, ratesRes, bataRes] = await Promise.all([
        supabase.from('vehicles').select('*'),
        supabase.from('trips').select('lr_no, vehicle_no, trip_status').neq('trip_status', 'COMPLETED'), // Only active trips
        supabase.from('freight_rates').select('*'),
        supabase.from('bata_rates').select('*') // Ensure you have a bata_rates table or adjust as needed
      ]);

      if (vehRes.data) setVehicles(vehRes.data);
      if (tripsRes.data) setActiveTrips(tripsRes.data);
      if (ratesRes.data) setFreightRates(ratesRes.data);
      if (bataRes.data) setBataRates(bataRes.data);
      
      setIsLoading(false);
    }
    fetchMasterData();
  }, [supabase]);

  // --- HELPERS & AUTO-FILL LOGIC ---

  const getCleanTruckNo = (v: any) => String(v.vehicle_no || v.truck_no || v.reg_no || v.id || "").trim();

  // Rule 2 & 3: Filter by Bag/Bulk AND hide trucks that are already in active trips
  const availableVehicles = vehicles.filter((v) => {
    const cleanNo = getCleanTruckNo(v);
    
    // Check if truck is currently on an active trip (Rule 3)
    const isBusy = activeTrips.some(t => String(t.vehicle_no).trim() === cleanNo);
    if (isBusy) return false;

    // Check Cargo Type Match (Rule 2)
    const variant = String(v.variant || v.type || v.body_type || "").toUpperCase();
    const isBagTruck = variant.includes("BAG") || variant.includes("BODY") || variant.includes("SACK");
    
    if (cargoType === "BAGS" && !isBagTruck) return false;
    if (cargoType === "BULK" && isBagTruck) return false;

    return true;
  });

  // Rule 4 & 5: Auto-fill Driver and Capacity when Truck is selected
  useEffect(() => {
    if (selectedTruck) {
      const truckData = vehicles.find(v => getCleanTruckNo(v) === selectedTruck);
      if (truckData) {
        setDriver(truckData.driver || truckData.driver_name || ""); // Rule 4
        setTonnage(truckData.capacity_tons || truckData.capacity || ""); // Rule 5
      }
    } else {
      setDriver("");
      setTonnage("");
    }
  }, [selectedTruck, vehicles]);

  // Rule 6 & 7: Auto-fill Freight Rate and Bata when Source/Destination change
  useEffect(() => {
    if (origin && destination) {
      // Find matching freight rate
      const matchingRate = freightRates.find(r => 
        String(r.origin).toUpperCase() === origin.toUpperCase() && 
        String(r.destination_name).toUpperCase() === destination.toUpperCase()
      );
      if (matchingRate) setFreightRate(matchingRate.freight_rate_per_ton);

      // Find matching bata (assuming bata table has origin/destination or route)
      const matchingBata = bataRates.find(b => 
        String(b.destination).toUpperCase() === destination.toUpperCase() || 
        String(b.route).toUpperCase().includes(destination.toUpperCase())
      );
      if (matchingBata) setBata(matchingBata.standard_bata || matchingBata.amount);
    }
  }, [origin, destination, freightRates, bataRates]);

  // Rule 1: LR Validation Check
  const validateLR = (value: string) => {
    setLrNo(value);
    const isDuplicateActive = activeTrips.some(t => String(t.lr_no).trim().toUpperCase() === value.trim().toUpperCase());
    if (isDuplicateActive) {
      setLrError("This LR Number is currently active. Cannot dispatch duplicate.");
    } else {
      setLrError("");
    }
  };

  // Calculations
  const expectedFreight = (Number(tonnage) || 0) * (Number(freightRate) || 0);
  const totalTripCost = (Number(dieselIssued) || 0) + (Number(bata) || 0) + (Number(advancePaid) || 0);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lrError) {
      alert("Please fix errors before dispatching.");
      return;
    }

    const { error } = await supabase.from('trips').insert([
      {
        trip_date: tripDate,
        lr_no: lrNo,
        vehicle_no: selectedTruck,
        cargo_type: cargoType,
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase(),
        driver_name: driver,
        tonnage: Number(tonnage) || 0,
        rate_per_ton: Number(freightRate) || 0,
        diesel_advance: Number(dieselIssued) || 0,
        bata_amount: Number(bata) || 0,
        cash_advance: Number(advancePaid) || 0,
        trip_status: 'IN_TRANSIT'
      }
    ]);

    if (!error) {
      alert("Trip Dispatched Successfully!");
      if (onSuccess) onSuccess();
      // Reset form
      setLrNo("");
      setSelectedTruck("");
      setDestination("");
      setTonnage("");
      setDieselIssued("");
      setAdvancePaid("");
      setBata("");
    } else {
      alert("Error dispatching trip: " + error.message);
    }
  };

  // Get unique lists for datalists (dropdowns)
  const uniqueOrigins = Array.from(new Set(freightRates.map(r => r.origin))).filter(Boolean);
  const uniqueDestinations = Array.from(new Set(freightRates.map(r => r.destination_name))).filter(Boolean);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm max-w-4xl mx-auto animate-in fade-in duration-300">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Trip Dispatch Entry</h3>
        <p className="text-xs text-slate-500 mt-1">Smart automated dispatch with Master Data mapping and validation.</p>
      </div>

      <form onSubmit={handleDispatch} className="space-y-6">
        
        {/* ROW 1: Date & LR Number */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Trip Date *</label>
            <input 
              type="date" 
              value={tripDate}
              onChange={(e) => setTripDate(e.target.value)}
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              required 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">LR / Invoice No *</label>
            <input 
              type="text" 
              value={lrNo}
              onChange={(e) => validateLR(e.target.value)}
              placeholder="e.g. 40080069852" 
              className={`w-full text-sm p-3 rounded-xl border ${lrError ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-white'} outline-none focus:ring-2 focus:ring-indigo-500 font-semibold uppercase transition-all`}
              required 
            />
            {lrError && <p className="text-[10px] text-rose-600 font-bold mt-1">{lrError}</p>}
          </div>
        </div>

        {/* ROW 2: Cargo Type & Filtered Truck Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Cargo Type</label>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => { setCargoType("BULK"); setSelectedTruck(""); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${cargoType === "BULK" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
              >
                BULK
              </button>
              <button
                type="button"
                onClick={() => { setCargoType("BAGS"); setSelectedTruck(""); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${cargoType === "BAGS" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
              >
                BAGS
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
              Truck No. ({availableVehicles.length} Ready)
            </label>
            <select 
              value={selectedTruck}
              onChange={(e) => setSelectedTruck(e.target.value)}
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900"
              required
              disabled={isLoading || availableVehicles.length === 0}
            >
              <option value="">{isLoading ? "Loading..." : availableVehicles.length === 0 ? `No available ${cargoType} trucks` : `-- SELECT TRUCK --`}</option>
              {availableVehicles.map((v, i) => {
                const cleanNo = getCleanTruckNo(v);
                return <option key={i} value={cleanNo}>{cleanNo}</option>;
              })}
            </select>
          </div>
        </div>

        {/* ROW 3: Source & Destination (With Datalist for Master + Custom entry) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Source (Origin) *</label>
            <input 
              list="origin-master"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="Select or type new..."
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white uppercase outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <datalist id="origin-master">
              {uniqueOrigins.map((org, i) => <option key={i} value={org} />)}
            </datalist>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Destination *</label>
            <input 
              list="destination-master"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Select or type new..."
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white uppercase outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <datalist id="destination-master">
              {uniqueDestinations.map((dest, i) => <option key={i} value={dest} />)}
            </datalist>
          </div>
        </div>

        {/* ROW 4: Driver & Tonnage (Auto-filled) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Driver Name *</label>
            <input 
              type="text" 
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
              placeholder="Enter or confirm driver" 
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-emerald-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500 transition-colors" 
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-2">Ton Dispatched (MT)</label>
              <input 
                type="number" 
                step="0.01"
                value={tonnage}
                onChange={(e) => setTonnage(parseFloat(e.target.value))}
                placeholder="0.00" 
                className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-emerald-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500" 
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-2">Freight Rate / MT (₹)</label>
              <input 
                type="number" 
                step="0.01"
                value={freightRate}
                onChange={(e) => setFreightRate(parseFloat(e.target.value))}
                placeholder="0.00" 
                className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-emerald-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500" 
              />
            </div>
          </div>
        </div>

        {/* ROW 5: Expenses */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200 pt-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Diesel Issued (₹)</label>
            <input 
              type="number" 
              value={dieselIssued}
              onChange={(e) => setDieselIssued(parseFloat(e.target.value))}
              placeholder="0.00" 
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-rose-500" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Bata (₹)</label>
            <input 
              type="number" 
              value={bata}
              onChange={(e) => setBata(parseFloat(e.target.value))}
              placeholder="0.00" 
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-emerald-50 focus:bg-white outline-none focus:ring-2 focus:ring-rose-500" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Advance Paid (₹)</label>
            <input 
              type="number" 
              value={advancePaid}
              onChange={(e) => setAdvancePaid(parseFloat(e.target.value))}
              placeholder="0.00" 
              className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-rose-500" 
            />
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
              <p className="text-[10px] font-bold text-slate-500 uppercase">Total Trip Cost</p>
              <p className="text-lg font-black text-rose-600">₹{totalTripCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={!!lrError || !selectedTruck}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95"
          >
            Dispatch Trip
          </button>
        </div>

      </form>
    </div>
  );
}
