'use client';

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DriverSettlementModule() {
  const [loading, setLoading] = useState(false);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  
  // Form states for new rate slab or route entry
  const [source, setSource] = useState("COCHIN");
  const [destination, setDestination] = useState("");
  const [cargoType, setCargoType] = useState("BULK");
  const [ratePerMt, setRatePerMt] = useState("");

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [supabase]);

  async function fetchData() {
    // 1. Fetch Route Freight Slabs
    const { data: rateData } = await supabase.from('destinations_freight_master').select('*');
    if (rateData) setRates(rateData);

    // 2. Fetch Trips to calculate Driver Settlements & Bata Ledger
    const { data: tripData } = await supabase
      .from('trips')
      .select('trip_id, trip_number, trip_start_date, trip_status, driver_bata, cash_advance_issued, drivers(full_name, driver_code), vehicles(vehicle_number)')
      .order('trip_id', { ascending: false });

    if (tripData) {
      setSettlements(tripData);
    }
  }

  const handleAddRateSlab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination || !ratePerMt) {
      toast.error("Please provide destination and rate per MT.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('destinations_freight_master').insert([
      {
        origin: source,
        destination: destination.trim().toUpperCase(),
        cargo_category: cargoType,
        freight_rate_per_mt: Number(ratePerMt),
      }
    ]);

    if (error) {
      toast.error("Failed to add rate slab", { description: error.message });
    } else {
      toast.success("Rate slab added successfully!");
      setDestination("");
      setRatePerMt("");
      fetchData();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      
      {/* SECTION 1: Route Rate Slab Management */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-extrabold uppercase text-slate-900 border-b pb-2">Route Rate Slabs Master</h3>
        
        <form onSubmit={handleAddRateSlab} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Origin</label>
            <input 
              type="text" 
              value={source} 
              onChange={(e) => setSource(e.target.value)} 
              className="w-full border border-slate-300 rounded-md p-2 text-sm"
              required 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Destination</label>
            <input 
              type="text" 
              placeholder="e.g. NAMAKKAL"
              value={destination} 
              onChange={(e) => setDestination(e.target.value)} 
              className="w-full border border-slate-300 rounded-md p-2 text-sm"
              required 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Cargo</label>
            <select 
              value={cargoType} 
              onChange={(e) => setCargoType(e.target.value)} 
              className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white"
            >
              <option value="BULK">BULK</option>
              <option value="BAG">BAG</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Rate / MT (₹)</label>
            <input 
              type="number" 
              placeholder="0.00"
              value={ratePerMt} 
              onChange={(e) => setRatePerMt(e.target.value)} 
              className="w-full border border-slate-300 rounded-md p-2 text-sm"
              required 
            />
          </div>
          <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10">
            Add Slab
          </Button>
        </form>

        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 uppercase">
                <th className="p-2.5 border-b">Route Origin</th>
                <th className="p-2.5 border-b">Destination</th>
                <th className="p-2.5 border-b">Cargo Type</th>
                <th className="p-2.5 border-b">Rate / MT</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50 border-b">
                  <td className="p-2.5 font-medium">{r.origin}</td>
                  <td className="p-2.5 font-medium">{r.destination}</td>
                  <td className="p-2.5">{r.cargo_category || 'BULK'}</td>
                  <td className="p-2.5 font-bold text-indigo-700">₹{Number(r.freight_rate_per_mt || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Driver Bata & Cash Advance Settlements Ledger */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-extrabold uppercase text-slate-900 border-b pb-2">Driver Bata & Settlement Ledger</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 uppercase">
                <th className="p-2.5 border-b">Trip / LR No</th>
                <th className="p-2.5 border-b">Date</th>
                <th className="p-2.5 border-b">Driver</th>
                <th className="p-2.5 border-b">Vehicle</th>
                <th className="p-2.5 border-b">Earned Bata (₹)</th>
                <th className="p-2.5 border-b">Cash Advance (₹)</th>
                <th className="p-2.5 border-b">Net Balance</th>
                <th className="p-2.5 border-b">Status</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => {
                const bata = Number(s.driver_bata) || 0;
                const advance = Number(s.cash_advance_issued) || 0;
                const netBalance = bata - advance; // positive means payable to driver, negative means recovery needed

                return (
                  <tr key={s.trip_id} className="hover:bg-slate-50 border-b">
                    <td className="p-2.5 font-bold text-slate-900">{s.trip_number}</td>
                    <td className="p-2.5 text-slate-600">{s.trip_start_date}</td>
                    <td className="p-2.5 font-medium">{s.drivers?.full_name || 'N/A'}</td>
                    <td className="p-2.5 font-medium">{s.vehicles?.vehicle_number || 'N/A'}</td>
                    <td className="p-2.5 text-emerald-700 font-bold">₹{bata.toLocaleString()}</td>
                    <td className="p-2.5 text-amber-700 font-bold">₹{advance.toLocaleString()}</td>
                    <td className={`p-2.5 font-extrabold ${netBalance >= 0 ? 'text-indigo-900' : 'text-red-700'}`}>
                      ₹{netBalance.toLocaleString()} {netBalance < 0 ? '(Recover)' : '(Payable)'}
                    </td>
                    <td className="p-2.5">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${s.trip_status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {s.trip_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
