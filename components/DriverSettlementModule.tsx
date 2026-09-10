'use client';

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertModal } from "@/components/AlertModal";

export function DriverSettlementModule() {
  const [loading, setLoading] = useState(false);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [source, setSource] = useState("COCHIN");
  const [destination, setDestination] = useState("");
  const [cargoType, setCargoType] = useState("BULK");
  const [ratePerMt, setRatePerMt] = useState<number | "">("");

  const [alertConfig, setAlertConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info" as "success" | "error" | "info"
  });

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  async function fetchData() {
    const { data: rateData } = await supabase.from('destinations_freight_master').select('*');
    if (rateData) setRates(rateData);

    const { data: driversData } = await supabase.from('drivers').select('*').eq('is_active', true);
    const [year, month] = selectedMonth.split('-');
    const firstDay = `${year}-${month}-01`;
    const lastDayObj = new Date(parseInt(year), parseInt(month), 0);
    const lastDay = `${year}-${month}-${String(lastDayObj.getDate()).padStart(2, '0')}`;

    const { data: tripData } = await supabase
      .from('trips')
      .select('trip_id, trip_number, trip_start_date, trip_status, driver_bata, halt_bata, cash_advance_issued, primary_driver_id, drivers(full_name, driver_code)')
      .gte('trip_start_date', firstDay)
      .lte('trip_start_date', lastDay);

    const { data: advData } = await supabase
      .from('driver_direct_advances')
      .select('*')
      .gte('advance_date', firstDay)
      .lte('advance_date', lastDay);

    if (driversData && tripData && advData) {
      const driverLedgers = driversData.map(d => {
        const dTrips = tripData.filter(t => t.primary_driver_id === d.driver_id);
        const dAdvs = advData.filter(a => a.driver_id === d.driver_id);

        let earnedBata = 0;
        let haltBataExpense = 0;
        let tripAdvances = 0;

        dTrips.forEach(t => {
          earnedBata += Number(t.driver_bata) || 0;
          haltBataExpense += Number(t.halt_bata) || 0;
          tripAdvances += Number(t.cash_advance_issued) || 0;
        });

        let directAdvances = 0;
        dAdvs.forEach(a => {
          directAdvances += Number(a.amount_inr) || 0;
        });

        const totalEarnings = earnedBata + haltBataExpense;
        const totalDeductions = tripAdvances + directAdvances;
        const netPayable = totalEarnings - totalDeductions;

        return {
          driver_id: d.driver_id,
          driver_code: d.driver_code,
          full_name: d.full_name,
          earnedBata,
          haltBataExpense,
          totalEarnings,
          tripAdvances,
          directAdvances,
          totalDeductions,
          netPayable,
          tripCount: dTrips.length
        };
      });

      setSettlements(driverLedgers);
    }
  }

  const handleAddRateSlab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination || ratePerMt === "" || Number(ratePerMt) <= 0) {
      setAlertConfig({
        isOpen: true,
        title: "Invalid Input",
        message: "Please provide a valid destination and positive rate per MT.",
        type: "error"
      });
      return;
    }

    setLoading(true);
    const destFormatted = destination.trim().toUpperCase();
    const rateVal = Number(ratePerMt);

    const { error } = await supabase.from('destinations_freight_master').insert([
      {
        origin: source.toUpperCase(),
        destination_name: destFormatted,
        cargo_type: cargoType,
        cargo_category: cargoType,
        freight_rate_per_ton: rateVal,
        capacity_tons: 35,
        is_active: true
      }
    ]);

    if (error) {
      setAlertConfig({
        isOpen: true,
        title: "Failed",
        message: "Failed to add rate slab: " + error.message,
        type: "error"
      });
    } else {
      setAlertConfig({
        isOpen: true,
        title: "Success",
        message: "Rate slab added successfully!",
        type: "success"
      });
      setDestination("");
      setRatePerMt("");
      fetchData();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 relative" style={{ colorScheme: 'dark' }}>
      <AlertModal 
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />

      <div className="bg-[#12141C] border border-[#222634] rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-black uppercase text-white border-b border-[#222634] pb-2">Route Rate Slabs Master</h3>
        
        <form onSubmit={handleAddRateSlab} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Origin</label>
            <input 
              type="text" 
              value={source} 
              onChange={(e) => setSource(e.target.value)} 
              className="w-full border border-[#2B3142] rounded-lg p-2.5 text-sm uppercase bg-[#1A1F2C] text-white"
              required 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Destination</label>
            <input 
              type="text" 
              placeholder="e.g. NAMAKKAL"
              value={destination} 
              onChange={(e) => setDestination(e.target.value)} 
              className="w-full border border-[#2B3142] rounded-lg p-2.5 text-sm uppercase bg-[#1A1F2C] text-white"
              required 
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Cargo</label>
            <select 
              value={cargoType} 
              onChange={(e) => setCargoType(e.target.value)} 
              className="w-full border border-[#2B3142] rounded-lg p-2.5 text-sm bg-[#1A1F2C] text-white font-bold"
            >
              <option value="BULK">BULK</option>
              <option value="BAG">BAG</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Rate / MT (₹)</label>
            <input 
              type="number" 
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={ratePerMt} 
              onChange={(e) => setRatePerMt(e.target.value === "" ? "" : parseFloat(e.target.value))} 
              className="w-full border border-[#2B3142] rounded-lg p-2.5 text-sm bg-[#1A1F2C] text-white font-bold"
              required 
            />
          </div>
          <Button type="submit" disabled={loading} className="bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold h-10 rounded-xl">
            {loading ? "Adding..." : "Add Slab"}
          </Button>
        </form>

        <div className="overflow-x-auto pt-2 max-h-[300px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#161922] sticky top-0">
              <tr className="text-slate-400 uppercase">
                <th className="p-2.5 border-b border-[#222634]">Route Origin</th>
                <th className="p-2.5 border-b border-[#222634]">Destination</th>
                <th className="p-2.5 border-b border-[#222634]">Cargo Type</th>
                <th className="p-2.5 border-b border-[#222634]">Rate / MT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222634]">
              {rates.map((r, idx) => (
                <tr key={idx} className="hover:bg-[#1A1F2C]">
                  <td className="p-2.5 font-medium text-white">{r.origin}</td>
                  <td className="p-2.5 font-medium text-white">{r.destination_name}</td>
                  <td className="p-2.5 text-slate-300">{r.cargo_type || r.cargo_category || 'BULK'}</td>
                  <td className="p-2.5 font-bold text-[#FF5A00]">₹{Number(r.freight_rate_per_ton || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
