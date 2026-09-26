"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/components/ui/usePagination";
import { exportToCSV, exportToExcel } from "@/lib/utils/exportManager";
import { generateUniversalPdf } from "@/lib/exportUniversalPdf";

type ReportType =
  | "Trips"
  | "POD"
  | "Diesel/Fuel"
  | "Driver Bata"
  | "Driver Settlement"
  | "Workshop"
  | "Fleet/Vehicle"
  | "Financial/P&L";

export default function ReportsModule() {
  const supabase = createClient();

  const [reportType, setReportType] = useState<ReportType>("Trips");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [rows, setRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const {
    page,
    setPage,
    totalPages,
    totalItems,
    paginatedItems,
    reset,
  } = usePagination(rows, { pageSize: 10 });

  const reportTypes: ReportType[] = [
    "Trips",
    "POD",
    "Diesel/Fuel",
    "Driver Bata",
    "Driver Settlement",
    "Workshop",
    "Fleet/Vehicle",
    "Financial/P&L",
  ];

  const runReport = async () => {
    setIsLoading(true);
    setHasSearched(true);
    reset();

    try {
      let data: any[] = [];

      if (reportType === "Trips") {
        let query = supabase
          .from("trips")
          .select(`
            trip_id,
            trip_number,
            trip_start_date,
            trip_end_date,
            origin,
            destination,
            loaded_weight_mt,
            tonnage_loaded,
            total_km_run,
            start_km,
            end_km,
            freight_revenue,
            driver_bata,
            halt_bata,
            cash_advance_issued,
            fuel_litres,
            trip_status,
            settlement_status,
            vehicles(vehicle_number),
            drivers(full_name)
          `)
          .order("trip_start_date", { ascending: false })
          .order("trip_id", { ascending: false })
          .limit(1000);

        if (fromDate) query = query.gte("trip_start_date", fromDate);
        if (toDate) query = query.lte("trip_start_date", toDate);
        if (status !== "All") query = query.eq("trip_status", status);
        if (search.trim()) query = query.ilike("trip_number", `%${search.trim()}%`);

        const result = await query;
        if (result.error) throw result.error;
        data = result.data || [];
      }

      if (reportType === "POD") {
        let query = supabase
          .from("trips")
          .select(`
            trip_id,
            trip_number,
            trip_start_date,
            trip_end_date,
            origin,
            destination,
            loaded_weight_mt,
            unloaded_weight_mt,
            shortage_mt,
            pod_status,
            pod_number,
            pod_received_date,
            halt_bata,
            enroute_repairs_maintenance,
            vehicles(vehicle_number),
            drivers(full_name)
          `)
          .order("trip_start_date", { ascending: false })
          .order("trip_id", { ascending: false })
          .limit(1000);

        if (fromDate) query = query.gte("trip_start_date", fromDate);
        if (toDate) query = query.lte("trip_start_date", toDate);
        if (status !== "All") query = query.eq("pod_status", status);

        if (search.trim()) {
          query = query.or(
            `trip_number.ilike.%${search.trim()}%,pod_number.ilike.%${search.trim()}%`
          );
        }

        const result = await query;
        if (result.error) throw result.error;
        data = result.data || [];
      }

      if (reportType === "Diesel/Fuel") {
        let query = supabase
          .from("diesel_fuel_logs")
          .select(`
            *,
            vehicles(vehicle_number)
          `)
          .order("fuel_date", { ascending: false })
          .order("fuel_log_id", { ascending: false })
          .limit(1000);

        if (fromDate) query = query.gte("fuel_date", fromDate);
        if (toDate) query = query.lte("fuel_date", toDate);

        if (status !== "All") {
          query = query.eq("diesel_category", status);
        }

        const result = await query;
        if (result.error) throw result.error;

        data = (result.data || []).filter((row: any) => {
          if (!search.trim()) return true;
          const q = search.trim().toLowerCase();
          return (
            String(row.vehicles?.vehicle_number || "").toLowerCase().includes(q) ||
            String(row.diesel_category || "").toLowerCase().includes(q)
          );
        });
      }

      if (reportType === "Driver Bata") {
        let query = supabase
          .from("trips")
          .select(`
            trip_id,
            trip_number,
            trip_start_date,
            origin,
            destination,
            driver_bata,
            halt_bata,
            cash_advance_issued,
            settlement_status,
            primary_driver_id,
            vehicles(vehicle_number),
            drivers(full_name, driver_code)
          `)
          .order("trip_start_date", { ascending: false })
          .order("trip_id", { ascending: false })
          .limit(1000);

        if (fromDate) query = query.gte("trip_start_date", fromDate);
        if (toDate) query = query.lte("trip_start_date", toDate);
        if (status !== "All") query = query.eq("settlement_status", status);

        const result = await query;
        if (result.error) throw result.error;

        data = (result.data || []).filter((row: any) => {
          if (!search.trim()) return true;
          const q = search.trim().toLowerCase();
          return (
            String(row.trip_number || "").toLowerCase().includes(q) ||
            String(row.drivers?.full_name || "").toLowerCase().includes(q) ||
            String(row.drivers?.driver_code || "").toLowerCase().includes(q) ||
            String(row.vehicles?.vehicle_number || "").toLowerCase().includes(q)
          );
        });
      }

      if (reportType === "Driver Settlement") {
        let query = supabase
          .from("trips")
          .select(`
            trip_id,
            trip_number,
            trip_start_date,
            origin,
            destination,
            freight_revenue,
            driver_bata,
            halt_bata,
            cash_advance_issued,
            settlement_status,
            primary_driver_id,
            vehicles(vehicle_number),
            drivers(full_name, driver_code)
          `)
          .order("trip_start_date", { ascending: false })
          .order("trip_id", { ascending: false })
          .limit(1000);

        if (fromDate) query = query.gte("trip_start_date", fromDate);
        if (toDate) query = query.lte("trip_start_date", toDate);
        if (status !== "All") query = query.eq("settlement_status", status);

        const result = await query;
        if (result.error) throw result.error;

        const tripRows = result.data || [];

        const { data: advances, error: advanceError } = await supabase
          .from("driver_direct_advances")
          .select(`
            advance_id,
            driver_id,
            advance_date,
            advance_type,
            reference_remarks,
            amount_inr,
            drivers(full_name, driver_code)
          `)
          .order("advance_date", { ascending: false })
          .limit(1000);

        if (advanceError) throw advanceError;

        const filteredTrips = tripRows.filter((row: any) => {
          if (!search.trim()) return true;
          const q = search.trim().toLowerCase();
          return (
            String(row.trip_number || "").toLowerCase().includes(q) ||
            String(row.drivers?.full_name || "").toLowerCase().includes(q) ||
            String(row.drivers?.driver_code || "").toLowerCase().includes(q) ||
            String(row.vehicles?.vehicle_number || "").toLowerCase().includes(q)
          );
        });

        const filteredAdvances = (advances || []).filter((row: any) => {
          if (!search.trim()) return true;
          const q = search.trim().toLowerCase();
          return (
            String(row.drivers?.full_name || "").toLowerCase().includes(q) ||
            String(row.drivers?.driver_code || "").toLowerCase().includes(q) ||
            String(row.advance_type || "").toLowerCase().includes(q) ||
            String(row.reference_remarks || "").toLowerCase().includes(q)
          );
        });

        data = [
          ...filteredTrips.map((row: any) => ({
            record_type: "TRIP",
            date: row.trip_start_date,
            reference: row.trip_number,
            driver: row.drivers?.full_name || "Unassigned",
            driver_code: row.drivers?.driver_code || "",
            vehicle: row.vehicles?.vehicle_number || "Unassigned",
            description: `${row.origin || ""} → ${row.destination || ""}`,
            freight: Number(row.freight_revenue || 0),
            driver_bata: Number(row.driver_bata || 0),
            halt_bata: Number(row.halt_bata || 0),
            cash_advance: Number(row.cash_advance_issued || 0),
            direct_advance: 0,
            settlement_status: row.settlement_status || "",
          })),
          ...filteredAdvances.map((row: any) => ({
            record_type: "DIRECT ADVANCE",
            date: row.advance_date,
            reference: row.advance_type || "Advance",
            driver: row.drivers?.full_name || "Unassigned",
            driver_code: row.drivers?.driver_code || "",
            vehicle: "",
            description: row.reference_remarks || "",
            freight: 0,
            driver_bata: 0,
            halt_bata: 0,
            cash_advance: 0,
            direct_advance: Number(row.amount_inr || 0),
            settlement_status: "",
          })),
        ];
      }

      if (reportType === "Workshop") {
        let query = supabase
          .from("workshop_spares_bills")
          .select(`
            *,
            vehicles(vehicle_number)
          `)
          .order("bill_date", { ascending: false })
          .limit(1000);

        if (fromDate) query = query.gte("bill_date", fromDate);
        if (toDate) query = query.lte("bill_date", toDate);

        const result = await query;
        if (result.error) throw result.error;

        data = (result.data || []).filter((row: any) => {
          if (!search.trim()) return true;
          const q = search.trim().toLowerCase();
          return (
            String(row.vendor_name || "").toLowerCase().includes(q) ||
            String(row.vehicles?.vehicle_number || "").toLowerCase().includes(q) ||
            String(row.spare_parts_details || "").toLowerCase().includes(q)
          );
        });
      }

      if (reportType === "Fleet/Vehicle") {
        let query = supabase
          .from("vehicles")
          .select("*")
          .order("vehicle_number", { ascending: true })
          .limit(1000);

        if (status !== "All") query = query.eq("current_status", status);

        const result = await query;
        if (result.error) throw result.error;

        data = (result.data || []).filter((row: any) => {
          if (!search.trim()) return true;
          const q = search.trim().toLowerCase();
          return (
            String(row.vehicle_number || "").toLowerCase().includes(q) ||
            String(row.truck_type || "").toLowerCase().includes(q) ||
            String(row.current_status || "").toLowerCase().includes(q)
          );
        });
      }

      if (reportType === "Financial/P&L") {
        let query = supabase
          .from("trips")
          .select(`
            trip_id,
            trip_number,
            trip_start_date,
            freight_revenue,
            driver_bata,
            halt_bata,
            enroute_repairs_maintenance,
            fuel_litres,
            total_km_run,
            trip_status,
            vehicles(vehicle_number)
          `)
          .order("trip_start_date", { ascending: false })
          .order("trip_id", { ascending: false })
          .limit(1000);

        if (fromDate) query = query.gte("trip_start_date", fromDate);
        if (toDate) query = query.lte("trip_start_date", toDate);
        if (status !== "All") query = query.eq("trip_status", status);

        const result = await query;
        if (result.error) throw result.error;

        data = (result.data || []).filter((row: any) => {
          if (!search.trim()) return true;
          const q = search.trim().toLowerCase();
          return (
            String(row.trip_number || "").toLowerCase().includes(q) ||
            String(row.vehicles?.vehicle_number || "").toLowerCase().includes(q)
          );
        });
      }

      setRows(data);
    } catch (error: any) {
      console.error("Report error:", error);
      alert(error?.message || "Unable to generate report.");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  const normalizedRows = useMemo(() => {
    if (reportType === "Trips") {
      return rows.map((row) => ({
        "LR No": row.trip_number ?? "",
        Date: row.trip_start_date ?? "",
        "End Date": row.trip_end_date ?? "",
        Vehicle: row.vehicles?.vehicle_number ?? "Unassigned",
        Driver: row.drivers?.full_name ?? "Unassigned",
        Origin: row.origin ?? "",
        Destination: row.destination ?? "",
        "Loaded MT": Number(row.loaded_weight_mt ?? row.tonnage_loaded ?? 0),
        "KM Run": Number(row.total_km_run ?? 0),
        "Start KM": Number(row.start_km ?? 0),
        "End KM": Number(row.end_km ?? 0),
        Freight: Number(row.freight_revenue ?? 0),
        "Driver Bata": Number(row.driver_bata ?? 0),
        "Halt Bata": Number(row.halt_bata ?? 0),
        "Cash Advance": Number(row.cash_advance_issued ?? 0),
        "Fuel Litres": Number(row.fuel_litres ?? 0),
        Status: row.trip_status ?? "",
        Settlement: row.settlement_status ?? "",
      }));
    }

    if (reportType === "POD") {
      return rows.map((row) => ({
        "LR No": row.trip_number ?? "",
        Date: row.trip_start_date ?? "",
        Vehicle: row.vehicles?.vehicle_number ?? "Unassigned",
        Driver: row.drivers?.full_name ?? "Unassigned",
        Route: `${row.origin ?? ""} → ${row.destination ?? ""}`,
        "Loaded MT": Number(row.loaded_weight_mt ?? 0),
        "Unloaded MT": Number(row.unloaded_weight_mt ?? 0),
        "Shortage MT": Number(row.shortage_mt ?? 0),
        "POD No": row.pod_number ?? "",
        "POD Date": row.pod_received_date ?? "",
        "POD Status": row.pod_status ?? "",
        "Halt Bata": Number(row.halt_bata ?? 0),
        "Claims / Repairs": Number(row.enroute_repairs_maintenance ?? 0),
      }));
    }

    if (reportType === "Diesel/Fuel") {
      return rows.map((row) => ({
        Date: row.fuel_date ?? "",
        Vehicle: row.vehicles?.vehicle_number ?? "Unassigned",
        Category: row.diesel_category ?? "",
        "Litres": Number(row.litres_filled ?? 0),
        "Rate/Litre": Number(row.diesel_rate_per_litre ?? 0),
        "Total Cost": Number(row.total_fuel_cost ?? 0),
        "Filling Odometer": Number(row.filling_odometer_km ?? 0),
        "Tank Full": row.is_tank_full ? "YES" : "NO",
      }));
    }

    if (reportType === "Driver Bata") {
      return rows.map((row) => ({
        Date: row.trip_start_date ?? "",
        "LR No": row.trip_number ?? "",
        Driver: row.drivers?.full_name ?? "Unassigned",
        "Driver Code": row.drivers?.driver_code ?? "",
        Vehicle: row.vehicles?.vehicle_number ?? "Unassigned",
        Route: `${row.origin ?? ""} → ${row.destination ?? ""}`,
        "Driver Bata": Number(row.driver_bata ?? 0),
        "Halt Bata": Number(row.halt_bata ?? 0),
        "Cash Advance": Number(row.cash_advance_issued ?? 0),
        Settlement: row.settlement_status ?? "",
      }));
    }

    if (reportType === "Driver Settlement") {
      return rows.map((row) => ({
        Type: row.record_type ?? "",
        Date: row.date ?? "",
        Reference: row.reference ?? "",
        Driver: row.driver ?? "",
        "Driver Code": row.driver_code ?? "",
        Vehicle: row.vehicle ?? "",
        Description: row.description ?? "",
        Freight: Number(row.freight ?? 0),
        "Driver Bata": Number(row.driver_bata ?? 0),
        "Halt Bata": Number(row.halt_bata ?? 0),
        "Cash Advance": Number(row.cash_advance ?? 0),
        "Direct Advance": Number(row.direct_advance ?? 0),
        Settlement: row.settlement_status ?? "",
      }));
    }

    if (reportType === "Workshop") {
      return rows.map((row) => ({
        Date: row.bill_date ?? "",
        Vehicle: row.vehicles?.vehicle_number ?? "GENERAL",
        Vendor: row.vendor_name ?? "",
        Description: row.spare_parts_details ?? "",
        "Total Bill": Number(row.total_bill_amount ?? 0),
      }));
    }

    if (reportType === "Fleet/Vehicle") {
      return rows.map((row) => ({
        Vehicle: row.vehicle_number ?? "",
        Type: row.truck_type ?? "",
        Capacity: Number(row.carrying_capacity_tons ?? 0),
        "GVW": Number(row.gross_vehicle_weight_tons ?? 0),
        Status: row.current_status ?? "",
        Active: row.is_active ? "YES" : "NO",
        "Odometer Working": row.odometer_working ? "YES" : "NO",
        "FC Expiry": row.fc_expiry_date ?? "",
        "Insurance Expiry": row.insurance_expiry_date ?? "",
      }));
    }

    if (reportType === "Financial/P&L") {
      return rows.map((row) => ({
        "LR No": row.trip_number ?? "",
        Date: row.trip_start_date ?? "",
        Vehicle: row.vehicles?.vehicle_number ?? "Unassigned",
        Revenue: Number(row.freight_revenue ?? 0),
        "Driver Bata": Number(row.driver_bata ?? 0),
        "Halt Bata": Number(row.halt_bata ?? 0),
        "Enroute Maintenance": Number(row.enroute_repairs_maintenance ?? 0),
        "Fuel Litres": Number(row.fuel_litres ?? 0),
        "KM Run": Number(row.total_km_run ?? 0),
        Status: row.trip_status ?? "",
      }));
    }

    return rows;
  }, [rows, reportType]);

  const tableColumns = useMemo(() => {
    if (!paginatedItems.length) return [];

    if (reportType === "Trips") {
      return ["LR No", "Date", "Vehicle", "Driver", "Route", "MT", "KM", "Freight", "Bata", "Status"];
    }

    if (reportType === "POD") {
      return ["LR No", "Date", "Vehicle", "Route", "Loaded MT", "Unloaded MT", "Shortage MT", "POD No", "POD Status"];
    }

    if (reportType === "Diesel/Fuel") {
      return ["Date", "Vehicle", "Category", "Litres", "Rate/Litre", "Total Cost", "Filling Odometer", "Tank Full"];
    }

    if (reportType === "Driver Bata") {
      return ["Date", "LR No", "Driver", "Vehicle", "Route", "Driver Bata", "Halt Bata", "Cash Advance", "Settlement"];
    }

    if (reportType === "Driver Settlement") {
      return ["Type", "Date", "Reference", "Driver", "Vehicle", "Description", "Driver Bata", "Cash Advance", "Direct Advance", "Settlement"];
    }

    if (reportType === "Workshop") {
      return ["Date", "Vehicle", "Vendor", "Description", "Total Bill"];
    }

    if (reportType === "Fleet/Vehicle") {
      return ["Vehicle", "Type", "Capacity", "GVW", "Status", "Active", "Odometer Working", "FC Expiry", "Insurance Expiry"];
    }

    return ["LR No", "Date", "Vehicle", "Revenue", "Driver Bata", "Halt Bata", "Enroute Maintenance", "Fuel Litres", "KM Run", "Status"];
  }, [paginatedItems.length, reportType]);

  const displayRows = useMemo(() => {
    return paginatedItems.map((row: any) => {
      if (reportType === "Trips") {
        return [
          row.trip_number,
          row.trip_start_date,
          row.vehicles?.vehicle_number ?? "Unassigned",
          row.drivers?.full_name ?? "Unassigned",
          `${row.origin ?? ""} → ${row.destination ?? ""}`,
          row.loaded_weight_mt ?? row.tonnage_loaded ?? 0,
          row.total_km_run ?? 0,
          row.freight_revenue ?? 0,
          row.driver_bata ?? 0,
          row.trip_status ?? "",
        ];
      }

      if (reportType === "POD") {
        return [
          row.trip_number,
          row.trip_start_date,
          row.vehicles?.vehicle_number ?? "Unassigned",
          `${row.origin ?? ""} → ${row.destination ?? ""}`,
          row.loaded_weight_mt ?? 0,
          row.unloaded_weight_mt ?? 0,
          row.shortage_mt ?? 0,
          row.pod_number ?? "",
          row.pod_status ?? "",
        ];
      }

      if (reportType === "Diesel/Fuel") {
        return [
          row.fuel_date,
          row.vehicles?.vehicle_number ?? "Unassigned",
          row.diesel_category ?? "",
          row.litres_filled ?? 0,
          row.diesel_rate_per_litre ?? 0,
          row.total_fuel_cost ?? 0,
          row.filling_odometer_km ?? 0,
          row.is_tank_full ? "YES" : "NO",
        ];
      }

      if (reportType === "Driver Bata") {
        return [
          row.trip_start_date,
          row.trip_number,
          row.drivers?.full_name ?? "Unassigned",
          row.vehicles?.vehicle_number ?? "Unassigned",
          `${row.origin ?? ""} → ${row.destination ?? ""}`,
          row.driver_bata ?? 0,
          row.halt_bata ?? 0,
          row.cash_advance_issued ?? 0,
          row.settlement_status ?? "",
        ];
      }

      if (reportType === "Driver Settlement") {
        return [
          row.record_type,
          row.date,
          row.reference,
          row.driver,
          row.vehicle,
          row.description,
          row.driver_bata ?? 0,
          row.cash_advance ?? 0,
          row.direct_advance ?? 0,
          row.settlement_status ?? "",
        ];
      }

      if (reportType === "Workshop") {
        return [
          row.bill_date,
          row.vehicles?.vehicle_number ?? "GENERAL",
          row.vendor_name ?? "",
          row.spare_parts_details ?? "",
          row.subtotal_amount ?? 0,
          row.tax_amount ?? 0,
          row.total_bill_amount ?? 0,
        ];
      }

      if (reportType === "Fleet/Vehicle") {
        return [
          row.vehicle_number,
          row.truck_type,
          row.carrying_capacity_tons ?? 0,
          row.gross_vehicle_weight_tons ?? 0,
          row.current_status ?? "",
          row.is_active ? "YES" : "NO",
          row.odometer_working ? "YES" : "NO",
          row.fc_expiry_date ?? "",
          row.insurance_expiry_date ?? "",
        ];
      }

      return [
        row.trip_number,
        row.trip_start_date,
        row.vehicles?.vehicle_number ?? "Unassigned",
        row.freight_revenue ?? 0,
        row.driver_bata ?? 0,
        row.halt_bata ?? 0,
        row.enroute_repairs_maintenance ?? 0,
        row.fuel_litres ?? 0,
        row.total_km_run ?? 0,
        row.trip_status ?? "",
      ];
    });
  }, [paginatedItems, reportType]);

  const exportCSV = () => {
    exportToCSV(
      normalizedRows,
      `KSS_${reportType.replace(/[^A-Za-z0-9]+/g, "_")}_Report`
    );
  };

  const exportExcel = () => {
    exportToExcel(
      normalizedRows,
      `KSS_${reportType.replace(/[^A-Za-z0-9]+/g, "_")}_Report`
    );
  };

  const exportPDF = () => {
    if (!normalizedRows.length) {
      alert("No data available to export.");
      return;
    }

    const headers = Object.keys(normalizedRows[0]);

    const pdfRows = normalizedRows.map((row) =>
      headers.map((header) => row[header])
    );

    generateUniversalPdf(
      `${reportType} Report`,
      `${fromDate || "All dates"} to ${toDate || "All dates"} • ${totalItems} records`,
      headers,
      pdfRows,
      `KSS_${reportType.replace(/[^A-Za-z0-9]+/g, "_")}_Report`
    );
  };

  const getStatusOptions = () => {
    if (reportType === "POD") {
      return ["All", "PENDING_SUBMISSION", "SUBMITTED", "CLOSED"];
    }

    if (reportType === "Diesel/Fuel") {
      return ["All", "TRIP", "TOP_UP", "OTHER"];
    }

    if (reportType === "Driver Bata" || reportType === "Driver Settlement") {
      return ["All", "PENDING", "SETTLED"];
    }

    if (reportType === "Fleet/Vehicle") {
      return ["All", "AVAILABLE", "ON_TRIP", "MAINTENANCE", "BREAKDOWN", "INACTIVE"];
    }

    return ["All", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "COMPLETED", "CANCELLED"];
  };

  const statusOptions = getStatusOptions();

  return (
    <div className="w-full space-y-5 kss-page-enter">
      <div className="kss-module-header">
        <div>
          <div className="kss-eyebrow">REPORTING</div>
          <h2 className="kss-module-title">Reports & Analysis</h2>
          <p className="kss-module-subtitle">
            Search, filter and export operational and financial records.
          </p>
        </div>
      </div>

      <div className="liquid-glass p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {reportTypes.map((type) => (
            <Button
              key={type}
              type="button"
              variant={reportType === type ? "default" : "glass"}
              size="sm"
              onClick={() => {
                setReportType(type);
                setRows([]);
                setHasSearched(false);
                setSearch("");
                setStatus("All");
                reset();
              }}
              className="h-9 text-[11px]"
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      <div className="liquid-glass p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              Search
            </label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="LR / Truck / Driver / Vendor"
              className="h-10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              From Date
            </label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              To Date
            </label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              Filter
            </label>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "All" ? "All" : option.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              onClick={runReport}
              disabled={isLoading}
              className="h-10 w-full"
            >
              {isLoading ? "Loading..." : "Generate Report"}
            </Button>
          </div>
        </div>
      </div>

      {hasSearched && (
        <div className="kss-table-shell">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
            <div>
              <div className="text-xs font-semibold text-fg">
                {reportType} Results
              </div>
              <div className="mt-0.5 text-[10px] text-fg-muted">
                {totalItems} record{totalItems === 1 ? "" : "s"}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="glass" size="sm" onClick={exportCSV}>
                CSV
              </Button>
              <Button type="button" variant="glass" size="sm" onClick={exportExcel}>
                Excel
              </Button>
              <Button type="button" variant="glass" size="sm" onClick={exportPDF}>
                PDF
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                {tableColumns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {displayRows.map((cells, rowIndex) => (
                <TableRow key={`${reportType}-${rowIndex}`}>
                  {cells.map((cell, cellIndex) => (
                    <TableCell key={`${rowIndex}-${cellIndex}`}>
                      {cell === null || cell === undefined || cell === ""
                        ? "-"
                        : typeof cell === "number"
                          ? cell.toLocaleString("en-IN")
                          : cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}

              {displayRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={Math.max(tableColumns.length, 1)}
                    className="py-12 text-center text-xs text-fg-muted"
                  >
                    No records found for the selected filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-4 py-2">
            <span className="text-[10px] font-medium text-fg-muted">
              Page {page} of {totalPages}
            </span>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
