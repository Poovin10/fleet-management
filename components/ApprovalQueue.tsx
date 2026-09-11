"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function ApprovalQueue() {
  const supabase = createClient();
  const [queue, setQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dieselRate, setDieselRate] = useState(95.0);

  const fetchQueue = async () => {
    setIsLoading(true);
    
    // 1. Fetch latest diesel rate for auto-calculation
    const { data: dData } = await supabase
      .from('diesel_fuel_logs')
      .select('diesel_rate_per_litre')
      .order('fuel_date', { ascending: false })
      .limit(1);
      
    if (dData && dData.length > 0) setDieselRate(Number(dData[0].diesel_rate_per_litre));

    // 2. Safely fetch queue entries using correct column names
    const { data: qData, error: qError } = await supabase
      .from('driver_pending_entries')
      .select('*')
      .eq('status', 'PENDING')
      .order('submitted_at', { ascending: false }); // FIX: Using submitted_at

    if (qError) {
      console.error("Error fetching queue:", qError);
      alert("Database Error: " + qError.message);
    }

    if (qData && qData.length > 0) {
      // 3. Fetch vehicles separately to map the names manually
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

  const handleApprove = async (req: any) => {
    if (req.entry_type === 'FUEL') {
      const estimatedCost = Math.round((Number(req.litres) || 0) * dieselRate);
      
      const userInput = prompt(
        `APPROVE FUEL REQUEST\nTruck: ${req.truck_number}\nRequested: ${req.litres} Litres\n\nPlease confirm/enter the FINAL BILL AMOUNT (₹):`,
        estimatedCost.toString()
      );
      
      if (!userInput) return; // User clicked Cancel
      
      const finalCost = Number(userInput);
      const actualRate = finalCost / Number(req.litres);

      // 1. Insert into Diesel Logs
      const { error: insertError } = await supabase.from('diesel_fuel_logs').insert([{
        fuel_date: new Date().toISOString().split('T')[0],
        vehicle_id: req.vehicle_id,
        diesel_category: 'TRIP_DIESEL',
        litres_filled: Number(req.litres),
        diesel_rate_per_litre: actualRate,
        total_fuel_cost: finalCost,
        filling_odometer_km: req.odometer_km || 0,
        lr_number: 'SUNDRY',
        is_tank_full: false
      }]);

      if (insertError) return alert("Failed to save diesel log: " + insertError.message);

      // 2. Mark Request as Approved (FIX: Using entry_id)
      await supabase.from('driver_pending_entries').update({ 
        status: 'APPROVED', 
        amount_inr: finalCost 
      }).eq('entry_id', req.entry_id);

      alert("Fuel request approved and added to expenses!");
      fetchQueue();
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm("Are you sure you want to REJECT this driver request?")) return;
    
    // FIX: Using entry_id
    await supabase.from('driver_pending_entries').update({ 
      status: 'REJECTED' 
    }).eq('entry_id', id);
    
    fetchQueue();
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('en-GB')} at ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  };

  return (
    <div className="bg-[#161922] border border-[#272B36] rounded-2xl p-6 sm:p-8 shadow-xl max-w-5xl mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center border-b border-[#272B36] pb-3 mb-6">
        <h3 className="text-sm font-black text-white uppercase tracking-wide">Driver Submissions Approval Queue</h3>
        <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded-lg uppercase tracking-widest">
          {queue.length} Pending
        </span>
      </div>

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
                  <button onClick={() => handleReject(req.entry_id)} className="px-3 py-1.5 bg-rose-950/40 text-rose-500 hover:bg-rose-900 border border-rose-900/50 rounded-lg font-bold transition-colors">
                    Reject
                  </button>
                  <button onClick={() => handleApprove(req)} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg transition-colors shadow-lg shadow-emerald-900/20">
                    Approve
                  </button>
                </td>
              </tr>
            ))}
            {queue.length === 0 && !isLoading && (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-medium">✨ All driver requests have been processed! The queue is empty.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
