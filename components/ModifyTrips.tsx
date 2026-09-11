"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal";

export function ModifyTrips() {
  const supabase = createClient();
  const [tripsList, setTripsList] = useState<any[]>([]);
  const [editTripId, setEditTripId] = useState<number | null>(null);
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

  // Helper to format dates
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    if (!dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const fetchTrips = async () => {
    const { data } = await supabase
      .from('trips')
      .select('*, vehicles(vehicle_number), drivers(full_name)')
      .order('trip_start_date', { ascending: false })
      .limit(100); // Increased limit for better audit logging
    if (data) setTripsList(data);
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleEditClick = (trip: any) => {
    setEditTripId(trip.trip_id);
    setCurrentTrip(trip);
    setTonnage(trip.tonnage_loaded || "");
    setSpotRate(trip.spot_freight_rate || "");
    setDriverBata(trip.driver_bata || "");
    setHaltBata(trip.halt_bata || "");
    setAdvanceIssued(trip.cash_advance_issued || "");
    setStatus(trip.trip_status || "DISPATCHED");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearForm = () => {
    setEditTripId(null);
    setCurrentTrip(null);
    setTonnage("");
    setSpotRate("");
    setDriverBata("");
    setHaltBata("");
    setAdvanceIssued("");
    setStatus("DISPATCHED");
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
        fetchTrips();
        clearForm();
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

      {/* TOP SECTION: EDIT FORM */}
      <div className="bg-[#161922] border border-[#272B36] rounded-2xl p-6 sm:p-8 shadow-xl max-w-5xl mx-auto h-fit">
        <div className="flex justify-between items-center border-b border-[#272B36] pb-3 mb-6">
          <h3 className="text-sm font-black text-white uppercase tracking-wide">
            {currentTrip ? `Modify Trip: ${currentTrip.trip_number}` : "Modify Existing Trip"}
          </h3>
          {currentTrip && <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded-lg uppercase tracking-widest animate-pulse">Editing Mode</span>}
        </div>

        {!currentTrip ? (
          <div className="py-12 text-center border-2 border-dashed border-[#272B36] rounded-xl bg-[#0F1117]">
            <p className="text-slate-400 font-bold text-sm">Select a trip from the Activity Log below to modify its details.</p>
          </div>
        ) : (
          <form onSubmit={handleUpdateTrip} className="space-y-5 animate-in slide-in-from-bottom-4">
            
            {/* Quick Read-Only Info */}
            <div className="flex flex-wrap gap-4 bg-[#0F1117] p-4 rounded-xl border border-[#272B36]">
              <span className="text-xs text-slate-400"><strong className="text-slate-500 mr-1">TRUCK:</strong> {currentTrip.vehicles?.vehicle_number}</span>
              <span className="text-xs text-slate-400"><strong className="text-slate-500 mr-1">DRIVER:</strong> {currentTrip.drivers?.full_name}</span>
              <span className="text-xs text-slate-400"><strong className="text-slate-500 mr-1">ROUTE:</strong> {currentTrip.origin} ➔ {currentTrip.destination}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tonnage Loaded (MT)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={tonnage} 
                  onChange={e => setTonnage(e.target.value)} 
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-white font-bold outline-none focus:border-[#FF5A00]" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Freight Rate / MT (₹)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={spotRate} 
                  onChange={e => setSpotRate(e.target.value === "" ? "" : parseFloat(e.target.value))} 
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-emerald-400 font-bold outline-none focus:border-[#FF5A00]" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Trip Status</label>
                <select 
                  value={status} 
                  onChange={e => setStatus(e.target.value)} 
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-white font-bold outline-none focus:border-[#FF5A00]"
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
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-[#FF5A00] font-bold outline-none focus:border-[#FF5A00]" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Halt Bata (₹)</label>
                <input 
                  type="number" 
                  value={haltBata} 
                  onChange={e => setHaltBata(e.target.value === "" ? "" : parseFloat(e.target.value))} 
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-[#FF5A00] font-bold outline-none focus:border-[#FF5A00]" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cash Advance Issued (₹)</label>
                <input 
                  type="number" 
                  value={advanceIssued} 
                  onChange={e => setAdvanceIssued(e.target.value === "" ? "" : parseFloat(e.target.value))} 
                  className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#1A1F2C] text-amber-400 font-bold outline-none focus:border-[#FF5A00]" 
                />
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                type="button" 
                onClick={clearForm} 
                className="flex-1 py-3 bg-[#0F1117] text-slate-300 font-bold rounded-xl border border-[#272B36] hover:bg-[#272B36] transition-colors"
              >
                Cancel Edit
              </button>
              <button 
                type="submit" 
                disabled={isProcessing} 
                className="flex-[2] py-3 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20 active:scale-95"
              >
                Save Trip Updates
              </button>
            </div>
          </form>
        )}
      </div>

      {/* BOTTOM SECTION: SYSTEM AUDIT / CLICK TO EDIT LOG */}
      <div className="bg-[#161922] border border-[#272B36] rounded-2xl overflow-hidden flex flex-col shadow-xl max-w-5xl mx-auto h-fit">
        <div className="bg-[#12141C] px-6 py-4 flex justify-between items-center border-b border-[#272B36]">
          <h3 className="text-sm font-black text-white uppercase tracking-wide">Trip Activity Log (Click to Edit)</h3>
        </div>
        
        <div className="overflow-x-auto flex-1 max-h-[600px] overflow-y-auto w-full">
          <table className="min-w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-[#0F1117] text-slate-400 uppercase font-bold sticky top-0 z-10">
              <tr>
                <th className="px-5 py-3 border-b border-[#272B36]">Date</th>
                <th className="px-5 py-3 border-b border-[#272B36]">Trip LR</th>
                <th className="px-5 py-3 border-b border-[#272B36]">Truck & Driver</th>
                <th className="px-5 py-3 border-b border-[#272B36]">Route</th>
                <th className="px-5 py-3 text-center border-b border-[#272B36]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#272B36] bg-[#161922]">
              {tripsList.map(t => {
                const isEditing = editTripId === t.trip_id;
                return (
                  <tr 
                    key={t.trip_id} 
                    onClick={() => handleEditClick(t)}
                    className={`cursor-pointer transition-colors ${isEditing ? 'bg-[#FF5A00]/10 border-l-2 border-l-[#FF5A00]' : 'hover:bg-[#1E222D] border-l-2 border-transparent'}`}
                  >
                    <td className="px-5 py-3.5 font-semibold text-slate-300">{formatDate(t.trip_start_date)}</td>
                    <td className="px-5 py-3.5 font-black text-white">{t.trip_number}</td>
                    <td className="px-5 py-3.5 text-slate-300">
                      <span className="font-bold text-white">{t.vehicles?.vehicle_number}</span><br/>
                      <span className="text-[10px] text-slate-500">{t.drivers?.full_name}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">{t.origin} ➔ {t.destination}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                        t.trip_status === 'COMPLETED' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50' : 
                        t.trip_status === 'CANCELLED' ? 'bg-rose-950/40 text-rose-400 border border-rose-900/50' : 
                        'bg-amber-950/40 text-amber-400 border border-amber-900/50'
                      }`}>
                        {t.trip_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {tripsList.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-medium">No recent trips available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
