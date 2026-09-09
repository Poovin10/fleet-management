"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function ApprovalQueue() {
  const supabase = createClient();
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchQueue = async () => {
    setIsLoading(true);
    // Fetch pending items and join with vehicles to get the truck number
    const { data } = await supabase
      .from('driver_pending_entries')
      .select(`
        *,
        vehicles ( vehicle_number )
      `)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true });

    if (data) setPendingItems(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchQueue();
  }, [supabase]);

  const handleAction = async (item: any, action: 'APPROVED' | 'REJECTED') => {
    setProcessingId(item.id);

    if (action === 'REJECTED') {
      await supabase.from('driver_pending_entries').update({ status: 'REJECTED' }).eq('id', item.id);
      setPendingItems(prev => prev.filter(p => p.id !== item.id));
      setProcessingId(null);
      return;
    }

    // --- APPROVAL LOGIC ---
    // 1. Find the active trip for this vehicle
    const { data: activeTrips } = await supabase
      .from('trips')
      .select('*')
      .eq('vehicle_id', item.vehicle_id)
      .neq('trip_status', 'COMPLETED')
      .order('trip_id', { ascending: false })
      .limit(1);

    const activeTrip = activeTrips?.[0];

    // 2. Process Fuel
    if (item.entry_type === 'FUEL') {
      if (activeTrip) {
        // Add cost to trip
        const currentFuel = Number(activeTrip.fuel_litres) || 0;
        const currentExpense = Number(activeTrip.fuel_expense) || 0;
        
        await supabase.from('trips').update({
          fuel_litres: currentFuel + Number(item.litres),
          fuel_expense: currentExpense + Number(item.amount_inr)
        }).eq('trip_id', activeTrip.trip_id);

        // Add to diesel logs
        await supabase.from('diesel_fuel_logs').insert([{
          fuel_date: new Date().toISOString().split('T')[0],
          vehicle_id: item.vehicle_id,
          trip_id: activeTrip.trip_id,
          lr_number: activeTrip.trip_number,
          diesel_category: "ENROUTE_TOPUP",
          litres_filled: item.litres,
          total_fuel_cost: item.amount_inr,
          filling_odometer_km: item.odometer_km
        }]);
      }
    }

    // 3. Process Advance
    if (item.entry_type === 'ADVANCE') {
      if (activeTrip) {
        const currentAdvance = Number(activeTrip.cash_advance_issued) || 0;
        await supabase.from('trips').update({
          cash_advance_issued: currentAdvance + Number(item.amount_inr)
        }).eq('trip_id', activeTrip.trip_id);
      }
    }

    // 4. Mark request as APPROVED
    await supabase.from('driver_pending_entries').update({ status: 'APPROVED' }).eq('id', item.id);
    
    // Remove from UI
    setPendingItems(prev => prev.filter(p => p.id !== item.id));
    setProcessingId(null);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm animate-in fade-in duration-300 max-w-5xl mx-auto">
      <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-6">
        <div>
          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Driver Submissions Queue</h3>
          <p className="text-xs text-slate-500 mt-1">Review and approve fuel bills or cash advances from the road.</p>
        </div>
        <div className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-black">
          {pendingItems.length} Pending
        </div>
      </div>

      {isLoading ? (
        <div className="text-center p-10 text-slate-500 font-medium">Loading queue...</div>
      ) : pendingItems.length === 0 ? (
        <div className="text-center p-12 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-3xl mb-3 block">☕</span>
          <h4 className="text-sm font-black text-slate-900 uppercase">All Caught Up!</h4>
          <p className="text-xs text-slate-500 mt-1">There are no pending driver requests to review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingItems.map(item => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row gap-4 justify-between md:items-center hover:border-slate-300 transition-colors">
              
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Driver / Truck</p>
                  <p className="text-sm font-black text-slate-900 mt-0.5">{item.driver_code}</p>
                  <p className="text-xs font-semibold text-indigo-600">{item.vehicles?.vehicle_number || "Unknown"}</p>
                </div>
                
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Request Type</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-black uppercase rounded ${item.entry_type === 'FUEL' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                    {item.entry_type}
                  </span>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Details</p>
                  {item.entry_type === 'FUEL' ? (
                    <p className="text-sm font-black text-slate-900 mt-0.5">{item.litres} Litres</p>
                  ) : (
                    <p className="text-sm font-black text-slate-900 mt-0.5">₹{item.amount_inr}</p>
                  )}
                  {item.odometer_km > 0 && <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Odo: {item.odometer_km}</p>}
                </div>

                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Remarks</p>
                  <p className="text-xs text-slate-700 mt-0.5 line-clamp-2" title={item.receipt_remarks}>{item.receipt_remarks || "N/A"}</p>
                  <p className="text-[9px] text-slate-400 mt-1">{new Date(item.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex gap-2 md:flex-col lg:flex-row border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-4 mt-2 md:mt-0">
                <button 
                  onClick={() => handleAction(item, 'REJECTED')}
                  disabled={processingId === item.id}
                  className="flex-1 px-4 py-2 bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 hover:border-rose-300 font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
                <button 
                  onClick={() => handleAction(item, 'APPROVED')}
                  disabled={processingId === item.id}
                  className="flex-1 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  {processingId === item.id ? "Processing..." : "Approve"}
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
