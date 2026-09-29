'use client';

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveFleetOperationalState, fleetStateLabel } from "../lib/operationalState";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/components/ui/usePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FleetTable() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFleetOpen, setIsFleetOpen] = useState(false);
  const [search, setSearch] = useState("");
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
        .eq('is_active', true)
        .order('vehicle_number', { ascending: true });

      if (!error && data) {
        setVehicles(data);
      }
      setLoading(false);
    }
    fetchVehicles();
  }, [supabase]);

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return vehicles;
    return vehicles.filter((vehicle) => [
      vehicle.vehicle_number,
      vehicle.truck_type,
      vehicle.carrying_capacity_tons,
      vehicle.current_status,
      fleetStateLabel(resolveFleetOperationalState(vehicle.current_status || "AVAILABLE_FOR_LOAD")),
      vehicle.status_remarks,
    ].some((value) => String(value ?? "").toLowerCase().includes(query)));
  }, [vehicles, search]);
  const pagination = usePagination(filteredVehicles, { pageSize: 10 });

  if (loading) return <div className="p-4 text-sm text-fg-secondary">Loading fleet assets...</div>;

  return (
    <div className="animate-tab-focus kss-surface space-y-4 p-5 sm:p-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-raised/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h3 className="text-lg font-bold text-fg">Live Fleet</h3>
          <p className="mt-1 text-sm text-fg-secondary">{vehicles.length} vehicles in the current operational fleet.</p>
        </div>
        <Button type="button" variant="glass" size="lg" onClick={() => setIsFleetOpen(true)} disabled={vehicles.length === 0}>
          View Fleet
        </Button>
      </div>

      {isFleetOpen && (
        <div className="kss-glass-overlay" onClick={() => setIsFleetOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="fleet-table-title" className="kss-glass-sheet max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-border shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface-raised/90 p-5 backdrop-blur-xl sm:p-6">
              <div>
                <h3 id="fleet-table-title" className="text-base font-semibold text-fg">Live Fleet Assets</h3>
                <p className="mt-1 text-xs text-fg-muted">{filteredVehicles.length} of {vehicles.length} vehicles</p>
              </div>
              <Button type="button" variant="glass" onClick={() => setIsFleetOpen(false)}>Close</Button>
            </div>
            <div className="p-4 sm:p-6">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vehicle, type, status or remarks..." aria-label="Search fleet" className="mb-4 w-full max-w-lg" />
              <div className="max-h-[62vh] overflow-auto rounded-xl border border-border">
                <Table className="min-w-[720px] text-left text-sm text-fg-secondary">
                  <TableHeader className="sticky top-0 z-10 bg-surface-raised">
                    <TableRow>
                      <TableHead className="p-3">Vehicle No</TableHead>
                      <TableHead className="p-3">Variant / Type</TableHead>
                      <TableHead className="p-3">Capacity (MT)</TableHead>
                      <TableHead className="p-3">Status</TableHead>
                      <TableHead className="p-3">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.paginatedItems.map((v) => (
                      <TableRow key={v.id || v.vehicle_number}>
                        <TableCell className="p-3 font-bold text-fg">{v.vehicle_number}</TableCell>
                        <TableCell className="p-3">{v.truck_type}</TableCell>
                        <TableCell className="p-3">{v.carrying_capacity_tons} MT</TableCell>
                        <TableCell className="p-3"><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${getStatusClass(v.current_status || "AVAILABLE_FOR_LOAD")}`}>{fleetStateLabel(resolveFleetOperationalState(v.current_status || "AVAILABLE_FOR_LOAD"))}</span></TableCell>
                        <TableCell className="p-3 text-fg-secondary">{v.status_remarks || "-"}</TableCell>
                      </TableRow>
                    ))}
                    {filteredVehicles.length === 0 && <TableRow><TableCell colSpan={5} className="p-8 text-center text-fg-muted">No vehicles match this search.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.setPage} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
