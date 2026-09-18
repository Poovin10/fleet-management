"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal";

export function TripForm({ onSuccess }: { onSuccess?: () => void }) {
  const supabase = createClient();

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const [lrNumber, setLrNumber] = useState("");
  const [tripDate, setTripDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [origin, setOrigin] = useState("COCHIN");
  const [destination, setDestination] = useState("");
  const [tonnage, setTonnage] = useState<number | "">("");
  const [spotRate, setSpotRate] = useState<number | "">("");
  const [dieselL, setDieselL] = useState<number | "">("");
  const [isTankFull, setIsTankFull] = useState(false);
  const [startKm, setStartKm] = useState<number | "">("");
  const [driverBata, setDriverBata] = useState<number | "">("");
  const [advanceIssued, setAdvanceIssued] = useState<number | "">("");

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    isDanger: false,
    confirmText: "Authorize Dispatch",
    action: async () => {}
  });

  const triggerModal = (title: string, message: string, action: () => Promise<void>) =>
    setModalConfig({ isOpen: true, title, message, isDanger: false, confirmText: "Authorize Dispatch", action });

  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  useEffect(() => {
    async function loadData() {
      const [vRes, dRes, rRes] = await Promise.all([
        supabase.from('trucks').select('id, vehicle_number, carrying_capacity_tons').eq('is_active', true).order('vehicle_number'),
        supabase.from('drivers').select('driver_id, full_name, driver_code').eq('is_active', true).order('full_name'),
        supabase.from('destinations_freight_master').select('*').eq('is_active', true).order('destination_name')
      ]);
      if (vRes.data) setVehicles(vRes.data);
      if (dRes.data) setDrivers(dRes.data);
      if (rRes.data) setDestinations(rRes.data);
    }
    loadData();
  }, [supabase]);

  const handleDestinationChange = (destName: string) => {
    setDestination(destName);
    const matched = destinations.find(d => d.destination_name.toUpperCase() === destName.toUpperCase());
    if (matched && matched.freight_rate_per_ton) {
      setSpotRate(Number(matched.freight_rate_per_ton));
    }
  };

  const grossFreight = Math.round((Number(tonnage) || 0) * (Number(spotRate) || 0) * 100) / 100;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lrNumber.trim() || !selectedTruckId || !destination) {
      alert("Please fill in all mandatory dispatch fields.");
      return;
    }

    triggerModal(
      "Confirm Waybill Dispatch",
      `Authorize dispatch for Waybill LR #${lrNumber.toUpperCase().trim()}?`,
      async () => {
        setIsProcessing(true);
        
        let currentDieselRate = 95.0;
        const { data: dLog } = await supabase.from('diesel_fuel_logs').select('diesel_rate_per_litre').order('fuel_date', { ascending: false }).limit(1);
        if (dLog && dLog.length > 0) currentDieselRate = Number(dLog[0].diesel_rate_per_litre);

        const fuelCost = Math.round((Number(dieselL) || 0) * currentDieselRate * 100) / 100;

        const tripPayload = {
          trip_number: lrNumber.toUpperCase().trim(),
          trip_start_date: tripDate,
          vehicle_id: Number(selectedTruckId),
          primary_driver_id: selectedDriverId ? Number(selectedDriverId) : null,
          origin: origin.toUpperCase().trim(),
          destination: destination.toUpperCase().trim(),
          tonnage_loaded: tonnage !== "" ? Number(tonnage) : null,
          freight_revenue: grossFreight,
          fuel_litres: dieselL !== "" ? Number(dieselL) : null,
          fuel_expense: fuelCost,
          is_tank_full: isTankFull,
          start_km: startKm !== "" ? Number(startKm) : null,
          driver_bata: driverBata !== "" ? Number(driverBata) : null,
          cash_advance_issued: advanceIssued !== "" ? Number(advanceIssued) : null,
          trip_status: "DISPATCHED",
          settlement_status: "PENDING"
        };

        const { data: insertedTrip, error: tripErr } = await supabase.from('trips').insert([tripPayload]).select('trip_id').single();

        if (tripErr) {
          alert("Dispatch Error: " + tripErr.message);
          setIsProcessing(false);
        } else {
          await supabase.from('trucks').update({ current_status: 'IN_TRANSIT' }).eq('id', selectedTruckId);

          if (Number(dieselL) > 0 && insertedTrip) {
            await supabase.from('diesel_fuel_logs').insert([{
              fuel_date: tripDate,
              vehicle_id: Number(selectedTruckId),
              trip_id: insertedTrip.trip_id,
              lr_number: lrNumber.toUpperCase().trim(),
              diesel_category: "TRIP_DIESEL",
              litres_filled: Number(dieselL),
              diesel_rate_per_litre: currentDieselRate,
              total_fuel_cost: fuelCost,
              filling_odometer_km: startKm !== "" ? Number(startKm) : null,
              is_tank_full: isTankFull
            }]);
          }

          alert("Waybill successfully authorized and dispatched!");
          setLrNumber(""); setTonnage(""); setSpotRate(""); setDieselL(""); setStartKm(""); setDriverBata(""); setAdvanceIssued("");
          setIsProcessing(false);
          closeModal();
          if (onSuccess) onSuccess();
        }
      }
    );
  };

  return (
    <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 sm:p-10 max-w-5xl mx-auto shadow-2xl">
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        isDanger={modalConfig.isDanger}
        confirmText={modalConfig.confirmText}
        onConfirm={modalConfig.action}
        onCancel={closeModal}
        isProcessing={isProcessing}
      />

      <div className="border-b border-white/[0.06] pb-4 mb-8">
        <h3 className="text-sm font-black text-white uppercase tracking-wider">New Trip Dispatch & Waybill Registration</h3>
        <p className="text-xs text-slate-400 font-medium mt-0.5">Initialize logistics waybill, assign active fleet units, and lock in freight rates.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Waybill LR Number *</label>
            <input
              type="text"
              value={lrNumber}
              onChange={e => setLrNumber(e.target.value)}
              placeholder="e.g. LR-94021"
              className="w-full text-xs p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-white uppercase font-black outline-none focus:border-[#FF5A00]"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Dispatch Date *</label>
            <input
              type="date"
              value={tripDate}
              onChange={e => setTripDate(e.target.value)}
              className="w-full text-xs p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-white font-bold outline-none focus:border-[#FF5A00]"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Assign Fleet Truck *</label>
            <select
              value={selectedTruckId}
              onChange={e => setSelectedTruckId(e.target.value)}
              className="w-full text-xs p-3.5 rounded-xl border border-white/[0.08] bg-[#080A10] text-white font-bold outline-none focus:border-[#FF5A00]"
              required
            >
              <option value="">Select available truck...</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number} [{v.carrying_capacity_tons} MT]</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Origin Hub</label>
            <input
              type="text"
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              className="w-full text-xs p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-white uppercase font-bold outline-none focus:border-[#FF5A00]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Destination *</label>
            <select
              value={destination}
              onChange={e => handleDestinationChange(e.target.value)}
              className="w-full text-xs p-3.5 rounded-xl border border-white/[0.08] bg-[#080A10] text-white uppercase font-bold outline-none focus:border-[#FF5A00]"
              required
            >
              <option value="">Select destination...</option>
              {destinations.map(d => <option key={d.destination_id} value={d.destination_name}>{d.destination_name} (₹{d.freight_rate_per_ton}/MT)</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Primary Driver</label>
            <select
              value={selectedDriverId}
              onChange={e => setSelectedDriverId(e.target.value)}
              className="w-full text-xs p-3.5 rounded-xl border border-white/[0.08] bg-[#080A10] text-white font-bold outline-none focus:border-[#FF5A00]"
            >
              <option value="">Assign driver...</option>
              {drivers.map(d => <option key={d.driver_id} value={d.driver_id}>{d.driver_code} - {d.full_name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-5 bg-white/[0.02] rounded-2xl border border-white/[0.05]">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Loaded Tonnage (MT)</label>
            <input
              type="number"
              step="0.01"
              value={tonnage}
              onChange={e => setTonnage(e.target.value === "" ? "" : parseFloat(e.target.value))}
              placeholder="e.g. 35.0"
              className="w-full text-xs p-3.5 rounded-xl border border-white/[0.08] bg-[#080A10] text-white font-bold outline-none focus:border-[#FF5A00]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Freight Rate / MT (₹)</label>
            <input
              type="number"
              step="0.01"
              value={spotRate}
              onChange={e => setSpotRate(e.target.value === "" ? "" : parseFloat(e.target.value))}
              placeholder="0.00"
              className="w-full text-xs p-3.5 rounded-xl border border-white/[0.08] bg-[#080A10] text-emerald-400 font-bold outline-none focus:border-[#FF5A00]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Auto Gross Freight (₹)</label>
            <input
              type="text"
              value={`₹${grossFreight.toLocaleString('en-IN', {minimumFractionDigits: 2})}`}
              disabled
              className="w-full text-xs p-3.5 rounded-xl border border-emerald-900/50 bg-emerald-950/20 text-emerald-400 font-black outline-none font-mono cursor-not-allowed"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Diesel Issued (L)</label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" checked={isTankFull} onChange={e => setIsTankFull(e.target.checked)} className="w-3.5 h-3.5 rounded text-[#FF5A00] bg-white/[0.02] border-white/[0.08]" />
                <span className="text-[9px] font-black text-white uppercase">Tank Full</span>
              </label>
            </div>
            <input
              type="number"
              step="0.1"
              value={dieselL}
              onChange={e => setDieselL(e.target.value === "" ? "" : parseFloat(e.target.value))}
              placeholder="0.0"
              className="w-full text-xs p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-[#FF5A00] font-bold outline-none focus:border-[#FF5A00]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Start Odometer (KM)</label>
            <input
              type="number"
              value={startKm}
              onChange={e => setStartKm(e.target.value === "" ? "" : parseFloat(e.target.value))}
              placeholder="e.g. 450200"
              className="w-full text-xs p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-sky-400 font-bold outline-none focus:border-[#FF5A00]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Driver Bata (₹)</label>
            <input
              type="number"
              value={driverBata}
              onChange={e => setDriverBata(e.target.value === "" ? "" : parseFloat(e.target.value))}
              placeholder="0.00"
              className="w-full text-xs p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-[#FF5A00] font-bold outline-none focus:border-[#FF5A00]"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-white/[0.06] flex justify-end">
          <button
            type="submit"
            disabled={isProcessing}
            className="px-8 py-3.5 bg-gradient-to-r from-[#FF5A00] to-[#E04F00] text-white font-black text-xs rounded-xl uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(255,90,0,0.3)] cursor-pointer"
          >
            {isProcessing ? "Authorizing Dispatch..." : "Authorize & Dispatch Waybill"}
          </button>
        </div>
      </form>
    </div>
  );
}
