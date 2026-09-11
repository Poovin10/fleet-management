"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal";
import { AlertModal } from "@/components/AlertModal";

export function ApprovalQueue() {
  const supabase = createClient();
  const [queue, setQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dieselRate, setDieselRate] = useState(95.0);

  // --- UI MODAL STATES ---
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [approveData, setApproveData] = useState<{ isOpen: boolean; req: any; amount: string; lrNo: string }>({ isOpen: false, req: null, amount: "", lrNo: "" });
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: "", message: "", type: "info" as "success" | "error" | "info" });

  const fetchQueue = async () => {
    setIsLoading(true);
    
    const { data: dData } = await supabase
      .from('diesel_fuel_logs')
      .select('diesel_rate_per_litre')
      .order('fuel_date', { ascending: false })
      .limit(1);
      
    if (dData && dData.length > 0) setDieselRate(Number(dData[0].diesel_rate_per_litre));

    const { data: qData, error: qError } = await supabase
      .from('driver_pending_entries')
      .select('*')
      .eq('status', 'PENDING')
      .order('submitted_at', { ascending: false });

    if (qError) {
      console.error("Error fetching queue:", qError);
      setAlertConfig({ isOpen: true, title: "Database Error", message: qError.message, type: "error" });
    }

    if (qData && qData.length > 0) {
      const { data: vData } = await supabase.from('vehicles').select('vehicle_id, vehicle_number');
      const mappedQueue = qData.map(req => {
        const truck = vData?.find(v => v.vehicle_id === req.vehicle_id);
        return {
          ...req,
          truck_number: truck ? truck.vehicle_number : `Truck ID: ${req.vehicle_id}`
        };
      });
      setQueue(mappedQueue);
    } else {
      setQueue([]);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  // Trigger the Custom Approval Modal
  const handleApproveClick = (req: any) => {
    if (req.entry_type === 'FUEL') {
      const estimatedCost = Math.round((Number(req.litres) || 0) * dieselRate);
      
      // Auto-extract LR Number from driver's smart tag e.g. "[LR: 236]"
      const lrMatch = req.receipt_remarks?.match(/\[LR:\s*([^\]]+)\]/i);
      let extractedLr = lrMatch ? lrMatch[1] : "";
      if (extractedLr.toUpperCase() === "SUNDRY") extractedLr = "";
      
      setApproveData({ isOpen: true, req, amount: String(estimatedCost), lrNo: extractedLr });
    }
  };

  // Execute the Approval Logic
  const executeApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    const { req, amount, lrNo } = approveData;
    if (!req || !amount) return;

    setIsProcessing(true);
    const finalCost = Number(amount);
    const actualRate = finalCost / Number(req.litres);
    const finalLr = lrNo.trim() || 'SUNDRY';
    const finalCategory = finalLr === 'SUNDRY' ? 'SUNDRY_DIESEL' : 'TRIP_DIESEL';

    // 1. Insert into Diesel Logs
    const { error: insertError } = await supabase.from('diesel_fuel_logs').insert([{
      fuel_date: new Date().toISOString().split('T')[0],
      vehicle_id: req.vehicle_id,
      diesel_category: finalCategory,
      litres_filled: Number(req.litres),
      diesel_rate_per_litre: actualRate,
      total_fuel_cost: finalCost,
      filling_odometer_km: req.odometer_km || 0,
      lr_number: finalLr,
      is_tank_full: false
    }]);

    if (insertError) {
      setIsProcessing(false);
      setApproveData({ isOpen: false, req: null, amount: "", lrNo: "" });
      return setAlertConfig({ isOpen: true, title: "Failed", message: "Failed to save diesel log: " + insertError.message, type: "error" });
    }

    // 2. Synchronize with the Trips ledger automatically!
    if (finalLr !== 'SUNDRY') {
      const { data: tripData } = await supabase.from('trips').select('trip_id, fuel_litres, fuel_expense').ilike('trip_number', finalLr).single();
      if (tripData) {
        const newLitres = (Number(tripData.fuel_litres) || 0) + Number(req.litres);
        const newExpense = (Number(tripData.fuel_expense) || 0) + finalCost;
        await supabase.from('trips').update({ fuel_litres: newLitres, fuel_expense: newExpense }).eq('trip_id', tripData.trip_id);
      }
    }

    // 3. Mark Request as Approved
    await supabase.from('driver_pending_entries').update({ 
      status: 'APPROVED', 
      amount_inr: finalCost 
    }).eq('entry_id', req.entry_id);

    setIsProcessing(false);
    setApproveData({ isOpen: false, req: null, amount: "", lrNo: "" });
    setAlertConfig({ isOpen: true, title: "Approved!", message: `Fuel request approved and officially linked to ${finalLr}.`, type: "success" });
    fetchQueue();
  };

  // Execute Rejection
  const executeReject = async () => {
    if (!rejectId) return;
    setIsProcessing(true);
    
    await supabase.from('driver_pending_entries').update({ 
      status: 'REJECTED' 
    }).eq('entry_id', rejectId);
    
    setRejectId(null);
    setIsProcessing(false);
    fetchQueue();
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('en-GB')} at ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  };

  return (
    <div className="bg-[#161922] border border-[#272B36] rounded-2xl p-6 sm:p-8 shadow-xl max-w-5xl mx-auto animate-in fade-in duration-300">
      
      {/* GLOBAL ALERTS & CONFIRMATIONS */}
      <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} />

      <ConfirmModal 
        isOpen={rejectId !== null}
        title="Reject Request"
        message="Are you sure you want to REJECT this driver request? This cannot be undone."
        isDanger={true}
        confirmText="Yes, Reject"
        onConfirm={executeReject}
        onCancel={() => setRejectId(null)}
        isProcessing={isProcessing}
      />

      {/* CUSTOM APPROVAL OVERLAY */}
      {approveData.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#12141C] border border-[#272B36] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <form onSubmit={executeApprove}>
              <div className="p-6 pb-2">
                <h3 className="text-lg font-black text-white uppercase tracking-wide mb-1">Approve Fuel Request</h3>
                <p className="text-xs text-slate-400 mb-6">Review the details and confirm the final bill amount.</p>
                
                <div className="bg-[#1A1F2C] p-4 rounded-xl border border-[#272B36] mb-6 space-y-3 text-sm">
                  <div className="flex justify-between items-center"><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Truck</span> <span className="text-white font-black">{approveData.req?.truck_number}</span></div>
                  <div className="flex justify-between items-center"><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Driver</span> <span className="text-slate-300 font-bold">{approveData.req?.driver_code}</span></div>
                  <div className="flex justify-between items-center pt-2 border-t border-[#272B36]"><span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Requested Litres</span> <span className="text-[#FF5A00] font-black text-lg">{approveData.req?.litres} L</span></div>
                </div>

                <div className="mb-4">
                  <label className="block text-[10px] font-bold text-sky-400 uppercase mb-2">Trip LR Number (Optional)</label>
                  <input 
                    type="text" 
                    value={approveData.lrNo} 
                    onChange={e => setApproveData({...approveData, lrNo: e.target.value.toUpperCase()})}
                    placeholder="e.g. 236 (Leave blank for SUNDRY)"
                    className="w-full text-sm p-3.5 rounded-xl border border-[#272B36] bg-[#0F1117] text-white font-bold outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all uppercase"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-[10px] font-bold text-emerald-500 uppercase mb-2">Final Bill Amount (₹) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={approveData.amount} 
                    onChange={e => setApproveData({...approveData, amount: e.target.value})}
                    className="w-full text-xl p-3.5 rounded-xl border border-[#272B36] bg-[#0F1117] text-white font-black outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-0 mt-4">
                <button type="button" onClick={() => setApproveData({isOpen: false, req: null, amount: "", lrNo: ""})} disabled={isProcessing} className="flex-1 py-3.5 bg-[#0F1117] text-slate-300 font-bold rounded-xl border border-[#272B36] hover:bg-[#272B36] transition-colors">Cancel</button>
                <button type="submit" disabled={isProcessing} className="flex-[2] py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-900/20 disabled:bg-slate-700 disabled:shadow-none">
                  {isProcessing ? "Processing..." : "Approve & Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-[#272B36] pb-3 mb-6">
        <h3 className="text-sm font-black text-white uppercase tracking-wide">Driver Submissions Approval Queue</h3>
        <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded-lg uppercase tracking-widest">
          {queue.length} Pending
        </span>
      </div>

      {/* QUEUE TABLE */}
      <div className="overflow-x-auto w-full">
        <table className="min-w-full text-xs text-left whitespace-nowrap">
          <thead className="bg-[#0F1117] text-slate-400 uppercase font-bold">
            <tr>
              <th className="p-4 border-b border-[#272B36]">Submitted At</th>
              <th className="p-4 border-b border-[#272B36]">Driver / Truck</th>
              <th className="p-4 border-b border-[#272B36]">Request Details</th>
              <th className="p-4 border-b border-[#272B36]">Driver Remarks</th>
              <th className="p-4 border-b border-[#272B36] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#272B36] bg-[#12141C]">
            {queue.map(req => (
              <tr key={req.entry_id} className="hover:bg-[#1A1F2C] transition-colors">
                <td className="p-4 font-semibold text-slate-300">{formatDateTime(req.submitted_at)}</td>
                <td className="p-4">
                  <span className="font-black text-white">{req.truck_number}</span><br/>
                  <span className="text-[10px] font-bold text-[#FF5A00]">{req.driver_code}</span>
                </td>
                <td className="p-4">
                  <span className="px-2 py-1 rounded bg-sky-950/50 text-sky-400 font-black text-[10px] uppercase mr-2">{req.entry_type}</span>
                  <span className="font-bold text-slate-200">
                    {req.entry_type === 'FUEL' ? `${req.litres} Litres (Odo: ${req.odometer_km})` : `₹${req.amount_inr}`}
                  </span>
                </td>
                <td className="p-4 text-slate-400 italic text-[11px] max-w-[200px] truncate" title={req.receipt_remarks}>
                  {req.receipt_remarks || "No remarks"}
                </td>
                <td className="p-4 text-right space-x-2">
                  <button onClick={() => setRejectId(req.entry_id)} className="px-4 py-2 bg-rose-950/40 text-rose-500 hover:text-white hover:bg-rose-900 border border-rose-900/50 rounded-lg font-bold transition-colors">
                    Reject
                  </button>
                  <button onClick={() => handleApproveClick(req)} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg transition-colors shadow-lg shadow-emerald-900/20">
                    Approve
                  </button>
                </td>
              </tr>
            ))}
            {queue.length === 0 && !isLoading && (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-medium">✨ All driver requests have been processed! The queue is currently empty.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
