'use client';

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function FleetTable() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchVehicles() {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('vehicle_number', { ascending: true });

      if (!error && data) {
        setVehicles(data);
      }
      setLoading(false);
    }
    fetchVehicles();
  }, [supabase]);

  if (loading) return <div className="p-4 text-sm text-fg-secondary">Loading fleet assets...</div>;

  return (
    <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
      <h3 className="text-lg font-bold text-fg border-b pb-2">Active Fleet Assets</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-fg-secondary">
          <thead className="bg-surface-raised text-xs uppercase text-fg font-bold">
            <tr>
              <th className="p-3">Vehicle No</th>
              <th className="p-3">Variant / Type</th>
              <th className="p-3">Capacity (MT)</th>
              <th className="p-3">Status</th>
              <th className="p-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.vehicle_id || v.vehicle_number} className="border-b hover:bg-app">
                <td className="p-3 font-bold text-fg">{v.vehicle_number}</td>
                <td className="p-3">{v.truck_type}</td>
                <td className="p-3">{v.carrying_capacity_tons} MT</td>
                <td className="p-3">
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700">
                    {v.current_status || "AVAILABLE_FOR_LOAD"}
                  </span>
                </td>
                <td className="p-3 text-fg-secondary">{v.status_remarks || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}