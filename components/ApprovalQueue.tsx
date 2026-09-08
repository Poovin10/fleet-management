"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function ApprovalQueue() {
  const supabase = createClient();
  const [pendingEntries, setPendingEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit state tracker for an active row
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLitres, setEditLitres] = useState<number>(0);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editOdo, setEditOdo] = useState<number>(0);

  const fetchPending = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('driver_pending_entries')
      .select('*, vehicles(vehicle_number)')
      .eq('status', 'PENDING')
      .order('submitted_at', { ascending: false });
    
    if (data) setPendingEntries(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const startEditing = (entry: any) => {
    setEditingId(entry.entry_id);
    setEditLitres(entry.litres || 0);
    setEditAmount(entry.amount_inr || 0);
    setEditOdo(entry.odometer_km || 0);
  };

  const handleApproveWithEdits = async (entry: any) => {
    // 1. If it's FUEL, insert the corrected data into actual diesel_fuel_logs table
    if (entry.entry_type === 'FUEL') {
      await supabase.from('diesel_fuel_logs').insert([{
        vehicle_id: entry.vehicle_id,
        fuel_date: new Date().toISOString().split('T')[0],
        litres_filled: editLitres,
        total_fuel_cost: editAmount,
        odometer_reading: editOdo,
        remarks: `Driver submission corrected & approved from ${entry.driver_code}`
      }]);
    }

    // 2. Mark staging entry as approved
    await supabase.from('driver_pending_entries').update({ 
      status: 'APPROVED',
      litres: editLitres,
      amount_inr: editAmount,
      odometer_km: editOdo
    }).eq('entry_id', entry.entry_id);

    setEditingId(null);
    fetchPending();
  };

  const handleReject = async (entryId: number) => {
    await supabase.from('driver_pending_entries').update({ status: 'REJECTED' }).eq('entry_id', entryId);
    fetchPending();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm" style={{ colorScheme: 'light' }}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Driver Submissions & Correction Queue</h3>
          <p className="text-xs text-slate-500 mt-0.5">Review, modify driver typos, and approve fuel bills or cash advances.</p>
        </div>
        <span className="px-3 py-1 bg-amber-50 text-amber-700 font-bold text-xs rounded-full border border-amber-200">
          {pendingEntries.length} Pending Review
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-xs text-left whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 uppercase font-bold">
            <tr>
              <th className="p-3">Truck / Driver</th>
              <th className="p-3">Type</th>
              <th className="p-3">Litres (Editable)</th>
              <th className="p-3">Odometer (Editable)</th>
              <th className="p-3">Amount ₹ (Editable)</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {pendingEntries.map(entry => {
              const isEditing = editingId === entry.entry_id;
              return (
                <tr key={entry.entry_id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">
                    {entry.vehicles?.vehicle_number || 'Unknown'}
                    <span className="block text-[10px] text-slate-400 font-normal">Driver: {entry.driver_code}</span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${entry.entry_type === 'FUEL' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>
                      {entry.entry_type}
                    </span>
                  </td>

                  {/* LITRES COLUMN */}
                  <td className="p-3">
                    {isEditing && entry.entry_type === 'FUEL' ? (
                      <input 
                        type="number" 
                        step="0.01" 
                        value={editLitres} 
                        onChange={e => setEditLitres(Number(e.target.value))} 
                        className="w-24 p-1.5 text-xs font-bold border border-orange-400 rounded bg-white text-slate-900" 
                      />
                    ) : (
                      <span className="font-semibold">{entry.entry_type === 'FUEL' ? `${entry.litres} L` : '-'}</span>
                    )}
                  </td>

                  {/* ODOMETER COLUMN */}
                  <td className="p-3">
                    {isEditing ? (
                      <input 
                        type="number" 
                        value={editOdo} 
                        onChange={e => setEditOdo(Number(e.target.value))} 
                        className="w-28 p-1.5 text-xs font-bold border border-orange-400 rounded bg-white text-slate-900" 
                      />
                    ) : (
                      <span className="font-semibold">{entry.odometer_km ? `${entry.odometer_km} km` : '-'}</span>
                    )}
                  </td>

                  {/* AMOUNT COLUMN */}
                  <td className="p-3">
                    {isEditing ? (
                      <input 
                        type="number" 
                        step="0.01" 
                        value={editAmount} 
                        onChange={e => setEditAmount(Number(e.target.value))} 
                        className="w-32 p-1.5 text-xs font-black border border-orange-400 rounded bg-white text-emerald-600" 
                      />
                    ) : (
                      <span className="font-black text-slate-900">₹ {entry.amount_inr}</span>
                    )}
                  </td>

                  {/* ACTIONS COLUMN */}
                  <td className="p-3 text-center space-x-2">
                    {isEditing ? (
                      <button 
                        onClick={() => handleApproveWithEdits(entry)} 
                        className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        Save & Approve
                      </button>
                    ) : (
                      <button 
                        onClick={() => startEditing(entry)} 
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors border border-slate-300"
                      >
                        Edit & Correct
                      </button>
                    )}
                    
                    {!isEditing && (
                      <button 
                        onClick={() => handleReject(entry.entry_id)} 
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg transition-colors border border-rose-200"
                      >
                        Discard
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {pendingEntries.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400 font-bold">No pending driver entries to review.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
