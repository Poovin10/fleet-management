"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";

export function ApprovalQueue() {
  const supabase = createClient();
  const [pendingEntries, setPendingEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [alertConfig, setAlertConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info" as "success" | "error" | "info"
  });

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Helper to format dates from YYYY-MM-DD to DD/MM/YYYY
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    if (!dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const fetchPendingQueue = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('driver_pending_entries')
      .select('*, vehicles(vehicle_number)')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (data) setPendingEntries(data);
    if (error) console.error("Error fetching queue:", error.message);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPendingQueue();
  }, [supabase]);

  const handleApprove = async (entry: any) => {
    setIsProcessing(true);
    try {
      // Execute the atomic RPC function
      const { data, error } = await supabase.rpc('approve_driver_entry', { 
        p_entry_id: entry.id 
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      setAlertConfig({
        isOpen: true,
        title: "Approved Successfully",
        message: data.message,
        type: "success"
      });

      fetchPendingQueue();
    } catch (err: any) {
      setAlertConfig({
        isOpen: true,
        title: "Approval Failed",
        message: err.message || "Failed to process approval.",
        type: "error"
      });
    }
    setIsProcessing(false);
  };

  const handleOpenReject = (id: number) => {
    setSelectedEntryId(id);
    setRejectionReason("");
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedEntryId) return;
    setIsProcessing(true);

    const { error } = await supabase
      .from('driver_pending_entries')
      .update({ 
        status: 'REJECTED', 
        rejection_reason: rejectionReason.trim() || "Rejected by manager" 
      })
      .eq('id', selectedEntryId);

    if (error) {
      setAlertConfig({
        isOpen: true,
        title: "Error",
        message: error.message,
        type: "error"
      });
    } else {
      setAlertConfig({
        isOpen: true,
        title: "Rejected",
        message: "The driver entry request has been rejected.",
        type: "success"
      });
      setRejectModalOpen(false);
      fetchPendingQueue();
    }
    setIsProcessing(false);
  };

  return (
    <div className="bg-surface border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm max-w-5xl mx-auto animate-in fade-in duration-300 relative" style={{ colorScheme: 'light' }}>
      
      <AlertModal 
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />

      {/* REJECTION REASON MODAL */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
            <h3 className="text-lg font-black text-slate-900 mb-2">Reject Driver Request</h3>
            <p className="text-xs text-slate-500 mb-4">Please provide a reason so the driver knows why this was rejected.</p>
            
            <textarea 
              value={rejectionReason} 
              onChange={e => setRejectionReason(e.target.value)} 
              placeholder="e.g. Invalid receipt bill photo / Odometer mismatch" 
              className="w-full h-28 text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-[#FF5A00] bg-slate-50 font-medium mb-4"
              required 
            />

            <div className="flex gap-3 justify-end">
              <button onClick={() => setRejectModalOpen(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl">Cancel</button>
              <button onClick={handleConfirmReject} disabled={isProcessing} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl">
                {isProcessing ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-6">
        <div>
          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Driver Submissions Approval Queue</h3>
          <p className="text-xs text-slate-500 mt-0.5">Review and approve on-road fuel bills or cash advance requests submitted from driver mobile portals.</p>
        </div>
        <span className="px-3 py-1 bg-amber-100 text-amber-800 font-black text-xs rounded-full">
          {pendingEntries.length} Pending
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 w-full relative min-h-[300px]">
        {isLoading && (
          <div className="absolute inset-0 bg-surface/70 backdrop-blur-sm z-10 flex items-center justify-center">
            <span className="font-bold text-[#FF5A00] animate-pulse">Loading Queue...</span>
          </div>
        )}

        <table className="min-w-full divide-y divide-slate-200 text-xs text-left whitespace-nowrap">
          <thead className="bg-slate-50 sticky top-0">
            <tr className="font-bold text-slate-500 uppercase">
              <th className="px-4 py-3">Submitted At</th>
              <th className="px-4 py-3">Driver Code</th>
              <th className="px-4 py-3">Truck No</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">Remarks</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-slate-100">
            {pendingEntries.map(e => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-600">{formatDate(e.created_at)}</td>
                <td className="px-4 py-3 font-bold text-slate-900">{e.driver_code}</td>
                <td className="px-4 py-3 font-bold text-[#FF5A00]">{e.vehicles?.vehicle_number || "N/A"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-[10px] font-black ${e.entry_type === 'FUEL' ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {e.entry_type}
                  </span>
                </td>
                <td className="px-4 py-3 font-black text-slate-800">
                  {e.entry_type === 'FUEL' ? `${e.litres} Litres (Odo: ${e.odometer_km || 0} KM)` : `₹${Number(e.amount_inr || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`}
                </td>
                <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{e.receipt_remarks || "-"}</td>
                <td className="px-4 py-3 text-center space-x-2">
                  <button 
                    onClick={() => handleApprove(e)} 
                    disabled={isProcessing}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors shadow-sm disabled:bg-slate-300"
                  >
                    Approve ✅
                  </button>
                  <button 
                    onClick={() => handleOpenReject(e.id)} 
                    disabled={isProcessing}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-lg border border-rose-200 transition-colors"
                  >
                    Reject ❌
                  </button>
                </td>
              </tr>
            ))}
            {pendingEntries.length === 0 && !isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-medium">
                  🎉 All driver requests have been processed! The queue is currently empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
