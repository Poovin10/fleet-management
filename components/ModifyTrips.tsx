"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal";

export function ModifyTrips() {
  const supabase = createClient();
  const [tripsList, setTripsList] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [currentTrip, setCurrentTrip] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form states for editing trip
  const [tonnage, setTonnage] = useState("");
  const [spotRate, setSpotRate] = useState<number | "">("");
  const [driverBata, setDriverBata] = useState<number | "">("");
  const [haltBata, setHaltBata] = useState<number | "">("");
  const [advanceIssued, setAdvanceIssued] = useState<number | "">("");
  const [status, setStatus] = useState("DISPATCHED");

  const [modalConfig, setModalConfig] = useState({ 
    isOpen: false, 
    title: "", 
    message: "", 
    isDanger: false, 
    confirmText: "Confirm", 
    action: async () => {} 
  });
  
  const triggerModal = (title: string, message: string, isDanger: boolean, confirmText: string, action: () => Promise<void>) => 
    setModalConfig({ isOpen: true, title, message, isDanger, confirmText, action });
  
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  const fetchTrips = async () => {
    const { data } = await supabase
      .from('trips')
      .select('*, vehicles(vehicle_number), drivers(full_name)')
      .order('trip_start_date', { ascending: false })
      .limit(50);
    if (data) setTripsList(data);
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  useEffect(() => {
    if (!selectedTripId) {
      setCurrentTrip(null);
      return;
    }
    const found = tripsList.find(t => String(t.trip_id) === selectedTripId);
    if (found) {
      setCurrentTrip(found);
      setTonnage(found.tonnage_loaded || "");
      setSpotRate(found.spot_freight_rate || "");
      setDriverBata(found.driver_bata || "");
      setHaltBata(found.halt_bata || "");
      setAdvanceIssued(found.cash_advance_issued || "");
      setStatus(found.trip_status || "DISPATCHED");
    }
  }, [selectedTripId, tripsList]);

  // Handle route / tonnage rate lookups cleanly without legacy fallback
  const handleRateLookup = async (origin: string, destination: string, capacity: number) => {
    const { data } = await supabase
      .from('destinations_freight_master')
      .select('freight_rate_per_ton')
      .ilike('origin', origin)
      .ilike('destination_name', destination)
      .eq('capacity_tons', capacity)
      .single();

    if (data) {
      setSpotRate(data.freight_rate_per_ton || 0);
    }
  };

  const handleUpdateTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTrip) return;

    triggerModal("Update Trip", `Save modifications for Trip #${currentTrip.trip_number}?`, false, "Save Changes", async () => {
      setIsProcessing(true);
      const { error } = await supabase.from('trips').update({
        tonnage_loaded: tonnage ? parseFloat(String(tonnage)) : null,
        spot_freight_rate: spotRate !== "" ? Number(spotRate) : null,
        driver_bata: driverBata !== "" ? Number(driverBata) : null,
        halt_bata: haltBata !== "" ? Number(haltBata) : null,
        cash_advance_issued: advanceIssued !== "" ? Number(advanceIssued) : null,
        trip_status: status
      }).eq('trip_id', currentTrip.trip_id);

      if (error) {
        alert("Error updating trip: " + error.message);
      } else {
        alert("Trip updated successfully!");
        fetchTrips();
      }
      setIsProcessing(false);
      closeModal();
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
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

      <div className="bg-[#161922] border border-[#272B36] rounded-2xl p-6 sm:p-8 shadow-xl max-w-4xl mx-auto">
        <h3 className="text-sm font-black text-white uppercase border-b border-[#272B36] pb-3 mb-6 tracking-wide">Modify Existing Trip</h3>

        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Select Trip to Modify</label>
          <select 
            value={selectedTripId} 
            onChange={e => setSelectedTripId(e.target.value)}
            className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] font-bold outline-none focus:border-[#FF5A00] text-white"
          >
            <option value="">-- SELECT TRIP --</option>
            {tripsList.map(t => (
              <option key={t.trip_id} value={t.trip_id}>
                LR: {t.trip_number} | {t.vehicles?.vehicle_number || 'Truck'} ({t.origin} ➔ {t.destination}) [{t.trip_status}]
              </option>
            ))}
          </select>
        </div>

        {currentTrip && (
          <form onSubmit={handleUpdateTrip} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tonnage Loaded (MT)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={tonnage} 
                  onChange={e => setTonnage(e.target.value)} 
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white font-bold outline-none focus:border-[#FF5A00]" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Freight Rate / MT (₹)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={spotRate} 
                  onChange={e => setSpotRate(e.target.value === "" ? "" : parseFloat(e.target.value))} 
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-emerald-400 font-bold outline-none focus:border-[#FF5A00]" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Trip Status</label>
                <select 
                  value={status} 
                  onChange={e => setStatus(e.target.value)} 
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-white font-bold outline-none"
                >
                  <option value="DISPATCHED">DISPATCHED</option>
                  <option value="IN_TRANSIT">IN_TRANSIT</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Driver Bata (₹)</label>
                <input 
                  type="number" 
                  value={driverBata} 
                  onChange={e => setDriverBata(e.target.value === "" ? "" : parseFloat(e.target.value))} 
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-[#FF5A00] font-bold outline-none" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Halt Bata (₹)</label>
                <input 
                  type="number" 
                  value={haltBata} 
                  onChange={e => setHaltBata(e.target.value === "" ? "" : parseFloat(e.target.value))} 
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-[#FF5A00] font-bold outline-none" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cash Advance Issued (₹)</label>
                <input 
                  type="number" 
                  value={advanceIssued} 
                  onChange={e => setAdvanceIssued(e.target.value === "" ? "" : parseFloat(e.target.value))} 
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] text-amber-400 font-bold outline-none" 
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                type="submit" 
                disabled={isProcessing} 
                className="px-8 py-3 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20 active:scale-95"
              >
                Save Trip Updates
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
