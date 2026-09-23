'use client';

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveFleetOperationalState, fleetStateLabel } from "../lib/operationalState";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export function FleetTable() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const getStatusClass = (status: string) => {
    switch (resolveFleetOperationalState(status)) {
      case "WORKSHOP":
        return "border-danger/20 bg-danger-soft text-danger";
      case "DRIVER_UNAVAILABLE":
      case "PLANT_LOADING":
        return "border-warning/20 bg-warning-soft text-warning";
      case "IN_TRANSIT":
      case "WAITING_FOR_UNLOAD":
      case "UNLOADED":
      case "RETURNING":
        return "border-info/20 bg-info-soft text-info";
      case "READY":
        return "border-success/20 bg-success-soft text-success";
      default:
        return "border-subtle bg-surface-raised text-secondary";
    }
  };

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
    <div className="animate-tab-focus kss-surface p-6 space-y-4">
      <h3 className="text-lg font-bold text-fg border-b border-border pb-2">Active Fleet Assets</h3>
      <div className="overflow-x-auto">
        <Table className="w-full text-left text-sm text-fg-secondary">
          <TableHeader>
            <TableRow>
              <TableHead className="p-3">Vehicle No</TableHead>
              <TableHead className="p-3">Variant / Type</TableHead>
              <TableHead className="p-3">Capacity (MT)</TableHead>
              <TableHead className="p-3">Status</TableHead>
              <TableHead className="p-3">Remarks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.map((v) => (
              <TableRow key={v.id || v.vehicle_number}>
                <TableCell className="p-3 font-bold text-fg">{v.vehicle_number}</TableCell>
                <TableCell className="p-3">{v.truck_type}</TableCell>
                <TableCell className="p-3">{v.carrying_capacity_tons} MT</TableCell>
                <TableCell className="p-3">
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusClass(
                      v.current_status || "AVAILABLE_FOR_LOAD"
                    )}`}
                  >
                    {fleetStateLabel(
                      resolveFleetOperationalState(v.current_status || "AVAILABLE_FOR_LOAD")
                    )}
                  </span>
                </TableCell>
                <TableCell className="p-3 text-fg-secondary">{v.status_remarks || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}