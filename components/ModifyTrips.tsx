"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function ModifyTrips({ onSuccess }: { onSuccess?: () => void }) {
  const supabase = createClient();
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [matchedTrips, setMatchedTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  
  // Master Data
  const [routeMaster, setRouteMaster] = useState<any[]>([]);
  const [dieselRate, setDieselRate] = useState(95.0);

  // Form States
  const [activeTrip, setActiveTrip] = useState<any>(null);
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lrNo, setLrNo] = useState("");
  
  const [routeSlab, setRouteSlab] = useState("-- MANUAL / SPOT ROUTE --");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [spotRate, setSpotRate] = useState<number | "">("");
  const [stdKm, setStdKm] = useState<number | "">("");
  
  const [startKm, setStartKm] = useState<number | "">("");
  const [endKm, setEndKm] = useState<number | "">("");
  
  const [loadedMt, setLoadedMt] = useState<number | "">("");
  const [freight, setFreight] = useState<number | "">("");
  const [bata, setBata] = useState<number | "">("");
  const [advance, setAdvance] = useState<number | "">("");
  
  const [diesel, setDiesel] = useState<number | "">("");
  const [isTankFull, setIsTankFull] = useState(false);
  
  const [podNo, setPodNo] = useState("");
  const [unloadedMt, setUnloadedMt] = useState<number | "">("");
  const [haltBata, setHaltBata] = useState<number | "">("");
  const [claims, setClaims] = useState<number | "">("");
  const [tripStatus, setTripStatus] = useState("IN_TRANSIT");

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function fetchMaster() {
      const { data } = await supabase.from('destinations_freight_master').select('*').eq('is_active', true);
      if (data) setRouteMaster(data);
    }
    fetchMaster();
  }, [supabase]);

  const handleSearch = async () => {
    setIsProcessing(true);
    let query = supabase
      .from('trips')
      .select(`
        *,
        vehicles ( vehicle_number, carrying_capacity_tons ),
        drivers ( full_name )
      `)
      .order('trip_id', { ascending: false })
      .limit(100);

    if (statusFilter !== "All Statuses") {
      query = query.eq('trip_status', statusFilter);
    }

    const { data, error } = await query;
    
    if (data) {
      const filtered = searchQuery
        ? data.filter((t: any) => 
            t.trip_number?.toUpperCase().includes(searchQuery.toUpperCase()) ||
            t.vehicles?.vehicle_number?.toUpperCase().includes(searchQuery.toUpperCase())
          )
        : data;
      setMatchedTrips(filtered);
      setSelectedTripId("");
      setActiveTrip(null);
    }
    setIsProcessing(false);
  };

  useEffect(() => {
    if (selectedTripId) {
      const trip = matchedTrips.find((t) => String(t.trip_id) === selectedTripId);
      if (trip) {
        setActiveTrip(trip);
        setStartDate(trip.trip_start_date || "");
        setEndDate(trip.trip_end_date || "");
        setLrNo(trip.trip_number || "");
        
        setOrigin(trip.origin || "");
        setDestination(trip.destination || "");
        
        // FIXED: Using "match" instead of "r" for the template string
        const match = routeMaster.find(route => route.origin === trip.origin && route.destination_name === trip.destination);
        if (match) {
          setRouteSlab(`${match.origin} ➔ ${match.destination_name}`);
          setSpotRate(match.freight_rate_per_ton);
          setStdKm(match.standard_km);
        } else {
          setRouteSlab("-- MANUAL / SPOT ROUTE --");
          setSpotRate(Number(trip.freight_revenue) / (Number(trip.loaded_weight_mt) || 1) || 0);
          setStdKm(trip.total_km_run || 0);
        }

        setStartKm(trip.start_km || 0);
        setEndKm(trip.end_km || 0);
        setLoadedMt(trip.loaded_weight_mt || trip.vehicles?.carrying_capacity_tons || 0);
        setFreight(trip.freight_revenue || 0);
        setBata(trip.driver_bata || 0);
        setAdvance(trip.cash_advance_issued || 0);
        setDiesel(trip.fuel_litres || 0);
        setIsTankFull(trip.is_tank_full || false);
        setPodNo(trip.pod_number || "");
        setUnloadedMt(trip.unloaded_weight_mt || trip.loaded_weight_mt || 0);
        setHaltBata(trip.halt_bata || 0);
        setClaims(trip.enroute_repairs_maintenance || 0);
        setTripStatus(trip.trip_status || "IN_TRANSIT");
      }
    } else {
      setActiveTrip(null);
    }
  }, [selectedTripId, matchedTrips, routeMaster]);

  useEffect(() => {
    if (loadedMt !== "" && spotRate !== "") {
      setFreight(Math.round(Number(loadedMt) * Number(spotRate) * 100) / 100);
    }
  }, [loadedMt, spotRate]);

  const calcTotalKm = () => {
    const s = Number(startKm) || 0;
    const e = Number(endKm) || 0;
    return e > s ? e - s : (activeTrip?.total_km_run > 0 ? activeTrip.total_km_run : (Number(stdKm) || 0));
  };

  const handleCommitUpdates = async () => {
    if (!activeTrip) return;
    if (Number(loadedMt) <= 0) return alert("⚠️ Loaded MT cannot be zero.");
    
    setIsProcessing(true);
    const totalKm = calcTotalKm();
    const fuelCost = Number(diesel) * dieselRate;
    const shortage = Math.max(0, Number(loadedMt) - Number(unloadedMt));

    const { error: tripError } = await supabase.from('trips').update({
      trip_start_date: startDate,
      trip_end_date: endDate || null,
      trip_number: lrNo.toUpperCase(),
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      start_km: Number(startKm),
      end_km: Number(endKm),
      total_km_run: totalKm,
      loaded_weight_mt: Number(loadedMt),
      unloaded_weight_mt: Number(unloadedMt),
      tonnage_loaded: Number(loadedMt),
      shortage_mt: shortage,
      freight_revenue: Number(freight),
      fuel_litres: Number(diesel),
      fuel_expense: fuelCost,
      driver_bata: Number(bata),
      halt_bata: Number(haltBata),
      cash_advance_issued: Number(advance),
      enroute_repairs_maintenance: Number(claims),
      pod_number: podNo || null,
      trip_status: tripStatus,
      is_tank_full: isTankFull
    }).eq('trip_id', activeTrip.trip_id);

    if (tripError) {
      alert("Error updating trip: " + tripError.message);
      setIsProcessing(false);
      return;
    }

    const vStatus = tripStatus === 'COMPLETED' ? 'AVAILABLE_FOR_LOAD' : 'IN_TRANSIT';
    await supabase.from('vehicles').update({ current_status: vStatus }).eq('vehicle_id', activeTrip.vehicle_id);

    if (Number(diesel) > 0) {
      await supabase.from('diesel_fuel_logs').update({
        fuel_date: startDate,
        lr_number: lrNo.toUpperCase(),
        litres_filled: Number(diesel),
        total_fuel_cost: fuelCost,
        filling_odometer_km: Number(startKm),
        is_tank_full: isTankFull
      }).eq('trip_id', activeTrip.trip_id);
    }

    alert("Trip updated successfully!");
    if (onSuccess) onSuccess();
    handleSearch(); 
  };

  const handleReopenTrip = async () => {
    if (!confirm(`Are you sure you want to reopen LR: ${activeTrip.trip_number}?`)) return;
    setIsProcessing(true);
    await supabase.from('trips').update({ trip_status: 'IN_TRANSIT', pod_number: null }).eq('trip_id', activeTrip.trip_id);
    await supabase.from('vehicles').update({ current_status: 'IN_TRANSIT' }).eq('vehicle_id', activeTrip.vehicle_id);
    alert("Trip Reopened!");
    handleSearch();
  };

  const handleDeleteTrip = async () => {
    if (!confirm(`WARNING: Permanently delete Trip ${activeTrip.trip_number}?`)) return;
    setIsProcessing(true);
    await supabase.from('diesel_fuel_logs').update({ trip_id: null }).eq('trip_id', activeTrip.trip_id);
    await supabase.from('trips').delete().eq('trip_id', activeTrip.trip_id);
    await supabase.from('vehicles').update({ current_status: 'AVAILABLE_FOR_LOAD', status_remarks: 'Available' }).eq('vehicle_id', activeTrip.vehicle_id);
    alert("Trip Deleted Successfully!");
    setSelectedTripId("");
    setActiveTrip(null);
    handleSearch();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm max-w-5xl mx-auto animate-in fade-in duration-300">
      
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-200 pb-6">
        <div>
          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Modify / Correct Trips</h3>
          <p className="text-xs text-slate-500 mt-1">Search active or completed trips to override parameters.</p>
        </div>
        <div className="flex w-full md:w-auto gap-3">
          <input 
            type="text" 
            placeholder="Search LR or Truck No..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-48 text-sm p-2.5 rounded-lg border border-slate-300 uppercase outline-none focus:ring-2 focus:ring-indigo-500" 
          />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-36 text-sm p-2.5 rounded-lg border border-slate-300 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="All Statuses">All Statuses</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <button 
            onClick={handleSearch}
            disabled={isProcessing}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-lg transition-colors shadow-sm"
          >
            Search
          </button>
        </div>
      </div>

      {/* Target Trip Selector */}
      {matchedTrips.length > 0 && (
        <div className="mb-8">
          <label className="block text-xs font-bold text-slate-700 uppercase mb-2 text-indigo-600">Target Trip ({matchedTrips.length} found)</label>
          <select 
            value={selectedTripId}
            onChange={(e) => setSelectedTripId(e.target.value)}
            className="w-full text-sm p-3 rounded-xl border-2 border-indigo-100 bg-indigo-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900 cursor-pointer"
          >
            <option value="">-- SELECT TRIP TO MODIFY --</option>
            {matchedTrips.map(t => (
              <option key={t.trip_id} value={t.trip_id}>
                LR: {t.trip_number} | Truck: {t.vehicles?.vehicle_number} | Status: {t.trip_status}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Full Edit Form */}
      {activeTrip && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
          
          <div className="flex gap-2 items-center mb-4">
            <span className="px-3 py-1 bg-slate-100 text-slate-600 font-bold text-[10px] uppercase rounded-md border border-slate-200">
              Driver: {activeTrip.drivers?.full_name}
            </span>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 font-bold text-[10px] uppercase rounded-md border border-slate-200">
              Truck: {activeTrip.vehicles?.vehicle_number}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Closing Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">LR No</label>
              <input type="text" value={lrNo} onChange={e => setLrNo(e.target.value.toUpperCase())} className="w-full text-sm p-2 rounded border border-slate-300 uppercase outline-none focus:border-indigo-500 font-bold" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Route Slab</label>
              <select value={routeSlab} onChange={e => setRouteSlab(e.target.value)} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-indigo-500">
                <option value="-- MANUAL / SPOT ROUTE --">-- MANUAL / SPOT ROUTE --</option>
                <option value={`${origin} ➔ ${destination}`}>{origin} ➔ {destination} (Current)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Origin</label>
              <input type="text" value={origin} onChange={e => setOrigin(e.target.value.toUpperCase())} className="w-full text-sm p-2 rounded border border-slate-300 uppercase outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Destination</label>
              <input type="text" value={destination} onChange={e => setDestination(e.target.value.toUpperCase())} className="w-full text-sm p-2 rounded border border-slate-300 uppercase outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Spot Rate/MT (₹)</label>
              <input type="number" step="0.01" value={spotRate} onChange={e => setSpotRate(parseFloat(e.target.value))} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Standard KM</label>
              <input type="number" value={stdKm} onChange={e => setStdKm(parseFloat(e.target.value))} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-indigo-500" />
            </div>
          </div>

          <hr className="border-slate-100" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Start KM</label>
              <input type="number" value={startKm} onChange={e => setStartKm(parseFloat(e.target.value))} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">End KM</label>
              <input type="number" value={endKm} onChange={e => setEndKm(parseFloat(e.target.value))} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Total Dist (KM)</label>
              <input type="text" value={calcTotalKm().toFixed(2)} disabled className="w-full text-sm p-2 rounded border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Loaded MT</label>
              <input type="number" step="0.01" value={loadedMt} onChange={e => setLoadedMt(parseFloat(e.target.value))} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-indigo-500 font-bold" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Freight (₹)</label>
              <input type="number" step="0.01" value={freight} onChange={e => setFreight(parseFloat(e.target.value))} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-indigo-500 text-indigo-600 font-bold" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bata (₹)</label>
              <input type="number" value={bata} onChange={e => setBata(parseFloat(e.target.value))} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Advance (₹)</label>
              <input type="number" value={advance} onChange={e => setAdvance(parseFloat(e.target.value))} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Diesel (L)</label>
              <input type="number" step="0.1" value={diesel} onChange={e => setDiesel(parseFloat(e.target.value))} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-indigo-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">POD No</label>
              <input type="text" value={podNo} onChange={e => setPodNo(e.target.value.toUpperCase())} className="w-full text-sm p-2 rounded border border-slate-300 uppercase outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unloaded MT</label>
              <input type="number" step="0.01" value={unloadedMt} onChange={e => setUnloadedMt(parseFloat(e.target.value))} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Halt Bata (₹)</label>
              <input type="number" value={haltBata} onChange={e => setHaltBata(parseFloat(e.target.value))} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Claims (₹)</label>
              <input type="number" value={claims} onChange={e => setClaims(parseFloat(e.target.value))} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trip Status</label>
              <select value={tripStatus} onChange={e => setTripStatus(e.target.value)} className="w-full text-sm p-2 rounded border border-slate-300 outline-none focus:border-indigo-500 font-bold text-indigo-700">
                <option value="IN_TRANSIT">IN TRANSIT</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 flex flex-wrap justify-between items-center gap-4">
            <div className="flex gap-3">
              {activeTrip.trip_status === 'COMPLETED' && (
                <button type="button" onClick={handleReopenTrip} disabled={isProcessing} className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-xs rounded-lg transition-colors border border-amber-200">
                  🔓 Reopen Trip
                </button>
              )}
              <button type="button" onClick={handleDeleteTrip} disabled={isProcessing} className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-lg transition-colors border border-rose-200">
                🗑️ Delete Trip
              </button>
            </div>
            
            <button type="button" onClick={handleCommitUpdates} disabled={isProcessing} className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-95">
              {isProcessing ? "Processing..." : "💾 Commit Updates"}
            </button>
          </div>
          
        </div>
      )}
    </div>
  );
}
