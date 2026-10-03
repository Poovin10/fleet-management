"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/ui/Pagination";
import { exportToCSV, exportToExcel } from "@/lib/utils/exportManager";
import { generateUniversalPdf } from "@/lib/exportUniversalPdf";
import { AlertModal } from "@/components/AlertModal";

type AlertType = "success" | "error" | "info";

type AlertConfig = {
  isOpen: boolean;
  title: string;
  message: string;
  type: AlertType;
};

type ReportType =
  | "Trips"
  | "POD"
  | "Diesel/Fuel"
  | "Driver Bata"
  | "Driver Settlement"
  | "Workshop"
  | "Fleet/Vehicle"
  | "Financial/P&L";

type ReportsModuleProps = {
  initialReportType?: ReportType;
};

export default function ReportsModule({ initialReportType = "Trips" }: ReportsModuleProps) {
  const supabase = useMemo(() => createClient(), []);

  const [reportType, setReportType] = useState<ReportType>(initialReportType);
  const [showReportsWorkspace, setShowReportsWorkspace] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [rows, setRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const requestSequence = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const showAlert = (
    title: string,
    message: string,
    type: AlertType = "info",
  ) => {
    setAlertConfig({
      isOpen: true,
      title,
      message,
      type,
    });
  };

  const closeAlert = () => {
    setAlertConfig((current) => ({
      ...current,
      isOpen: false,
    }));
  };

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

  type ReportFilters = {
    reportType: ReportType;
    fromDate: string;
    toDate: string;
    search: string;
    status: string;
  };

  type SearchIds = { vehicleIds: number[]; driverIds: number[] };

  const currentFilters = (): ReportFilters => ({
    reportType,
    fromDate,
    toDate,
    search,
    status,
  });

  const escapeFilterText = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/%/g, "\\%").replace(/_/g, "\\_");

  const ilikeClause = (column: string, value: string) =>
    `${column}.ilike."%${escapeFilterText(value)}%"`;

  const resolveSearchIds = async (filters: ReportFilters): Promise<SearchIds> => {
    const result: SearchIds = { vehicleIds: [], driverIds: [] };
    const term = filters.search.trim();
    if (!term) return result;

    const lookupIds = async (table: "vehicles" | "drivers", idColumn: string, fields: string[]) => {
      const { data, error } = await (supabase.from(table) as any)
        .select(idColumn)
        .or(fields.map((field) => ilikeClause(field, term)).join(","));
      if (error) throw error;
      return (data || []).map((row: any) => Number(row[idColumn])).filter(Number.isFinite);
    };

    if (["Diesel/Fuel", "Driver Bata", "Driver Settlement", "Workshop", "Financial/P&L"].includes(filters.reportType)) {
      result.vehicleIds = await lookupIds("vehicles", "vehicle_id", ["vehicle_number"]);
    }
    if (["Driver Bata", "Driver Settlement"].includes(filters.reportType)) {
      result.driverIds = await lookupIds("drivers", "driver_id", ["full_name", "driver_code"]);
    }
    return result;
  };

  const addOrSearch = (query: any, term: string, fields: string[], ids: Array<{ column: string; values: number[] }> = []) => {
    const normalizedTerm = term.trim();
    const clauses = normalizedTerm ? fields.map((field) => ilikeClause(field, normalizedTerm)) : [];
    ids.forEach(({ column, values }) => {
      if (values.length) clauses.push(`${column}.in.(${values.join(",")})`);
    });
    return clauses.length ? query.or(clauses.join(",")) : query;
  };

  const buildReportQuery = (filters: ReportFilters, ids: SearchIds, withCount: boolean) => {
    const options = withCount ? { count: "exact" as const } : undefined;
    const term = filters.search.trim();
    let query: any;

    if (filters.reportType === "Trips") {
      query = supabase.from("trips").select(`
        trip_id, trip_number, trip_start_date, trip_end_date, origin, destination,
        loaded_weight_mt, tonnage_loaded, total_km_run, start_km, end_km,
        freight_revenue, driver_bata, halt_bata, cash_advance_issued, fuel_litres,
        trip_status, settlement_status, vehicles(vehicle_number), drivers(full_name)
      `, options).order("trip_start_date", { ascending: false }).order("trip_id", { ascending: false });
      if (filters.fromDate) query = query.gte("trip_start_date", filters.fromDate);
      if (filters.toDate) query = query.lte("trip_start_date", filters.toDate);
      if (filters.status !== "All") query = query.eq("trip_status", filters.status);
      if (term) query = query.ilike("trip_number", `%${term}%`);
    } else if (filters.reportType === "POD") {
      query = supabase.from("trips").select(`
        trip_id, trip_number, trip_start_date, trip_end_date, origin, destination,
        loaded_weight_mt, unloaded_weight_mt, shortage_mt, pod_status, pod_number,
        pod_received_date, halt_bata, enroute_repairs_maintenance,
        vehicles(vehicle_number), drivers(full_name)
      `, options).order("trip_start_date", { ascending: false }).order("trip_id", { ascending: false });
      if (filters.fromDate) query = query.gte("trip_start_date", filters.fromDate);
      if (filters.toDate) query = query.lte("trip_start_date", filters.toDate);
      if (filters.status !== "All") query = query.eq("pod_status", filters.status);
      if (term) query = addOrSearch(query, term, ["trip_number", "pod_number"]);
    } else if (filters.reportType === "Diesel/Fuel") {
      query = supabase.from("diesel_fuel_logs").select(`*, vehicles(vehicle_number)`, options)
        .order("fuel_date", { ascending: false }).order("fuel_log_id", { ascending: false });
      if (filters.fromDate) query = query.gte("fuel_date", filters.fromDate);
      if (filters.toDate) query = query.lte("fuel_date", filters.toDate);
      if (filters.status !== "All") query = query.eq("diesel_category", filters.status);
      if (term) query = addOrSearch(query, term, ["diesel_category"], [{ column: "vehicle_id", values: ids.vehicleIds }]);
    } else if (filters.reportType === "Driver Bata" || filters.reportType === "Driver Settlement" || filters.reportType === "Financial/P&L") {
      const selection = filters.reportType === "Driver Bata" ? `
        trip_id, trip_number, trip_start_date, origin, destination, driver_bata, halt_bata,
        cash_advance_issued, settlement_status, primary_driver_id,
        vehicles(vehicle_number), drivers(full_name, driver_code)
      ` : filters.reportType === "Driver Settlement" ? `
        trip_id, trip_number, trip_start_date, origin, destination, freight_revenue,
        driver_bata, halt_bata, cash_advance_issued, settlement_status, primary_driver_id,
        vehicles(vehicle_number), drivers(full_name, driver_code)
      ` : `
        trip_id, trip_number, trip_start_date, freight_revenue, driver_bata, halt_bata,
        enroute_repairs_maintenance, fuel_litres, total_km_run, trip_status, vehicles(vehicle_number)
      `;
      query = (supabase.from("trips") as any).select(selection, options)
        .order("trip_start_date", { ascending: false }).order("trip_id", { ascending: false });
      if (filters.fromDate) query = query.gte("trip_start_date", filters.fromDate);
      if (filters.toDate) query = query.lte("trip_start_date", filters.toDate);
      if (filters.status !== "All") {
        query = query.eq(filters.reportType === "Financial/P&L" ? "trip_status" : "settlement_status", filters.status);
      }
      if (term) {
        const matchIds: Array<{ column: string; values: number[] }> = [{ column: "vehicle_id", values: ids.vehicleIds }];
        if (filters.reportType !== "Financial/P&L") matchIds.push({ column: "primary_driver_id", values: ids.driverIds });
        query = addOrSearch(query, term, ["trip_number"], matchIds);
      }
    } else if (filters.reportType === "Workshop") {
      query = supabase.from("workshop_spares_bills").select(`*, vehicles(vehicle_number)`, options)
        .order("bill_date", { ascending: false }).order("bill_id", { ascending: false });
      if (filters.fromDate) query = query.gte("bill_date", filters.fromDate);
      if (filters.toDate) query = query.lte("bill_date", filters.toDate);
      if (term) query = addOrSearch(query, term, ["vendor_name", "spare_parts_details"], [{ column: "vehicle_id", values: ids.vehicleIds }]);
    } else {
      query = supabase.from("vehicles").select("*", options).order("vehicle_number", { ascending: true }).order("vehicle_id", { ascending: true });
      if (filters.status !== "All") query = query.eq("current_status", filters.status);
      if (term) query = addOrSearch(query, term, ["vehicle_number", "truck_type", "current_status"]);
    }
    return query;
  };

  const buildSettlementTripsQuery = (filters: ReportFilters, ids: SearchIds, withCount: boolean, countOnly = false) => {
    const options = countOnly ? { count: "exact" as const, head: true } : withCount ? { count: "exact" as const } : undefined;
    let query: any = supabase.from("trips").select(countOnly ? "trip_id" : `
      trip_id, trip_number, trip_start_date, origin, destination, freight_revenue,
      driver_bata, halt_bata, cash_advance_issued, settlement_status, primary_driver_id,
      vehicles(vehicle_number), drivers(full_name, driver_code)
    `, options).order("trip_start_date", { ascending: false }).order("trip_id", { ascending: false });
    if (filters.fromDate) query = query.gte("trip_start_date", filters.fromDate);
    if (filters.toDate) query = query.lte("trip_start_date", filters.toDate);
    if (filters.status !== "All") query = query.eq("settlement_status", filters.status);
    if (filters.search.trim()) query = addOrSearch(query, filters.search, ["trip_number"], [
      { column: "vehicle_id", values: ids.vehicleIds },
      { column: "primary_driver_id", values: ids.driverIds },
    ]);
    return query;
  };

  const buildSettlementAdvancesQuery = (filters: ReportFilters, ids: SearchIds, withCount: boolean, countOnly = false) => {
    const options = countOnly ? { count: "exact" as const, head: true } : withCount ? { count: "exact" as const } : undefined;
    let query: any = supabase.from("driver_direct_advances").select(countOnly ? "advance_id" : `
      advance_id, driver_id, advance_date, advance_type, reference_remarks, amount_inr,
      drivers(full_name, driver_code)
    `, options).order("advance_date", { ascending: false }).order("advance_id", { ascending: false });
    if (filters.search.trim()) query = addOrSearch(query, filters.search, ["advance_type", "reference_remarks"], [{ column: "driver_id", values: ids.driverIds }]);
    return query;
  };

  const formatDisplayDate = (value: unknown) => {
    if (!value) return "";
    const text = String(value);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (!match) return text;

    return `${match[3]}/${match[2]}/${match[1]}`;
  };

  const mapSettlementTrips = (data: any[]) => data.map((row: any) => ({
    record_type: "TRIP", date: formatDisplayDate(row.trip_start_date), reference: row.trip_number,
    driver: row.drivers?.full_name || "Unassigned", driver_code: row.drivers?.driver_code || "",
    vehicle: row.vehicles?.vehicle_number || "Unassigned", description: `${row.origin || ""} → ${row.destination || ""}`,
    freight: Number(row.freight_revenue || 0), driver_bata: Number(row.driver_bata || 0),
    halt_bata: Number(row.halt_bata || 0), cash_advance: Number(row.cash_advance_issued || 0),
    direct_advance: 0, settlement_status: row.settlement_status || "",
  }));

  const mapSettlementAdvances = (data: any[]) => data.map((row: any) => ({
    record_type: "DIRECT ADVANCE", date: formatDisplayDate(row.advance_date), reference: row.advance_type || "Advance",
    driver: row.drivers?.full_name || "Unassigned", driver_code: row.drivers?.driver_code || "",
    vehicle: "", description: row.reference_remarks || "", freight: 0, driver_bata: 0,
    halt_bata: 0, cash_advance: 0, direct_advance: Number(row.amount_inr || 0), settlement_status: "",
  }));

  const fetchReportPage = async (filters: ReportFilters, requestedPage: number) => {
    const ids = await resolveSearchIds(filters);
    const offset = (requestedPage - 1) * pageSize;
    if (filters.reportType !== "Driver Settlement") {
      const { data, error, count } = await buildReportQuery(filters, ids, true).range(offset, offset + pageSize - 1);
      if (error) throw error;
      return { data: data || [], count: count ?? data?.length ?? 0 };
    }

    const [tripCountResult, advanceCountResult] = await Promise.all([
      buildSettlementTripsQuery(filters, ids, true, true),
      buildSettlementAdvancesQuery(filters, ids, true, true),
    ]);
    if (tripCountResult.error) throw tripCountResult.error;
    if (advanceCountResult.error) throw advanceCountResult.error;
    const tripCount = tripCountResult.count || 0;
    const advanceCount = advanceCountResult.count || 0;
    const tripFrom = Math.min(offset, tripCount);
    const tripTo = Math.min(offset + pageSize - 1, tripCount - 1);
    const advanceFrom = Math.max(0, offset - tripCount);
    const advanceTo = Math.min(advanceCount - 1, offset + pageSize - 1 - tripCount);
    const pageQueries: Promise<any>[] = [];
    if (tripCount && tripFrom <= tripTo) {
      pageQueries.push(buildSettlementTripsQuery(filters, ids, false).range(tripFrom, tripTo));
    }
    if (advanceCount && advanceFrom <= advanceTo) {
      pageQueries.push(buildSettlementAdvancesQuery(filters, ids, false).range(advanceFrom, advanceTo));
    }
    const pageResults = await Promise.all(pageQueries);
    pageResults.forEach((result) => { if (result.error) throw result.error; });
    let pageIndex = 0;
    const tripPage = tripCount && tripFrom <= tripTo ? pageResults[pageIndex++]?.data || [] : [];
    const advancePage = advanceCount && advanceFrom <= advanceTo ? pageResults[pageIndex]?.data || [] : [];
    return {
      data: [...mapSettlementTrips(tripPage), ...mapSettlementAdvances(advancePage)],
      count: tripCount + advanceCount,
    };
  };

  const fetchAllFromQuery = async (queryFactory: () => any) => {
    const allRows: any[] = [];
    const batchSize = 1000;
    for (let offset = 0; ; offset += batchSize) {
      const { data, error } = await queryFactory().range(offset, offset + batchSize - 1);
      if (error) throw error;
      const batch = data || [];
      allRows.push(...batch);
      if (batch.length < batchSize) break;
    }
    return allRows;
  };

  const fetchFullReport = async (filters: ReportFilters) => {
    const ids = await resolveSearchIds(filters);
    if (filters.reportType !== "Driver Settlement") {
      return fetchAllFromQuery(() => buildReportQuery(filters, ids, false));
    }
    const [tripRows, advanceRows] = await Promise.all([
      fetchAllFromQuery(() => buildSettlementTripsQuery(filters, ids, false)),
      fetchAllFromQuery(() => buildSettlementAdvancesQuery(filters, ids, false)),
    ]);
    return [...mapSettlementTrips(tripRows), ...mapSettlementAdvances(advanceRows)];
  };

  const loadReport = async (requestedPage: number, filters: ReportFilters) => {
    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      showAlert(
        "Invalid Date Range",
        "From Date cannot be later than To Date.",
        "error",
      );
      setRows([]);
      setTotalItems(0);
      setIsLoading(false);
      setHasSearched(true);
      return;
    }

    const requestId = ++requestSequence.current;
    setIsLoading(true);
    setHasSearched(true);
    setPage(requestedPage);
    setRows([]);
    try {
      const result = await fetchReportPage(filters, requestedPage);
      if (requestId !== requestSequence.current) return;
      const pages = Math.max(1, Math.ceil(result.count / pageSize));
      if (requestedPage > pages) {
        setPage(pages);
        void loadReport(pages, filters);
        return;
      }
      setRows(result.data);
      setTotalItems(result.count);
    } catch (error: any) {
      if (requestId !== requestSequence.current) return;
      console.error("Report error:", error);
      showAlert(
        "Report Generation Failed",
        error?.message || "Unable to generate the requested report.",
        "error",
      );
      setRows([]);
      setTotalItems(0);
    } finally {
      if (requestId === requestSequence.current) setIsLoading(false);
    }
  };

  const clearSearchTimer = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = null;
  };

  const runReport = () => {
    clearSearchTimer();
    setPage(1);
    void loadReport(1, currentFilters());
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    setRows([]);
    setIsLoading(true);
    setHasSearched(true);
    clearSearchTimer();
    const filters = { ...currentFilters(), search: value };
    searchTimer.current = setTimeout(() => {
      void loadReport(1, filters);
    }, 250);
  };

  const handleDateChange = (field: "fromDate" | "toDate", value: string) => {
    const filters = { ...currentFilters(), [field]: value };
    if (field === "fromDate") setFromDate(value);
    else setToDate(value);
    clearSearchTimer();
    setPage(1);
    void loadReport(1, filters);
  };

  const handleStatusChange = (value: string) => {
    const filters = { ...currentFilters(), status: value };
    setStatus(value);
    clearSearchTimer();
    setPage(1);
    void loadReport(1, filters);
  };

  const handleReportTypeChange = (type: ReportType) => {
    const filters = { ...currentFilters(), reportType: type, search: "", status: "All" };
    setReportType(type);
    setRows([]);
    setTotalItems(0);
    setSearch("");
    setStatus("All");
    setPage(1);
    clearSearchTimer();
    void loadReport(1, filters);
  };

  const normalizeRows = (sourceRows: any[], selectedType: ReportType) => {
    const rows = sourceRows;
    const reportType = selectedType;
    if (reportType === "Trips") {
      return rows.map((row) => ({
        "LR No": row.trip_number ?? "",
        Date: formatDisplayDate(row.trip_start_date),
        "End Date": formatDisplayDate(row.trip_end_date),
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
        Date: formatDisplayDate(row.trip_start_date),
        Vehicle: row.vehicles?.vehicle_number ?? "Unassigned",
        Driver: row.drivers?.full_name ?? "Unassigned",
        Route: `${row.origin ?? ""} → ${row.destination ?? ""}`,
        "Loaded MT": Number(row.loaded_weight_mt ?? 0),
        "Unloaded MT": Number(row.unloaded_weight_mt ?? 0),
        "Shortage MT": Number(row.shortage_mt ?? 0),
        "POD No": row.pod_number ?? "",
        "POD Date": formatDisplayDate(row.pod_received_date),
        "POD Status": row.pod_status ?? "",
        "Halt Bata": Number(row.halt_bata ?? 0),
        "Claims / Repairs": Number(row.enroute_repairs_maintenance ?? 0),
      }));
    }

    if (reportType === "Diesel/Fuel") {
      return rows.map((row) => ({
        Date: formatDisplayDate(row.fuel_date),
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
        Date: formatDisplayDate(row.trip_start_date),
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
        Date: formatDisplayDate(row.date),
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
        Date: formatDisplayDate(row.bill_date),
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
        "FC Expiry": formatDisplayDate(row.fc_expiry_date),
        "Insurance Expiry": formatDisplayDate(row.insurance_expiry_date),
      }));
    }

    if (reportType === "Financial/P&L") {
      return rows.map((row) => ({
        "LR No": row.trip_number ?? "",
        Date: formatDisplayDate(row.trip_start_date),
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
  };

  const tableColumns = useMemo(() => {
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
  }, [reportType]);

  const displayRows = useMemo(() => {
    return rows.map((row: any) => {
      if (reportType === "Trips") {
        return [
          row.trip_number,
          formatDisplayDate(row.trip_start_date),
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
          formatDisplayDate(row.trip_start_date),
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
          formatDisplayDate(row.fuel_date),
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
          formatDisplayDate(row.trip_start_date),
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
          formatDisplayDate(row.date),
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
          formatDisplayDate(row.bill_date),
          row.vehicles?.vehicle_number ?? "GENERAL",
          row.vendor_name ?? "",
          row.spare_parts_details ?? "",
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
          formatDisplayDate(row.fc_expiry_date),
          formatDisplayDate(row.insurance_expiry_date),
        ];
      }

      return [
        row.trip_number,
        formatDisplayDate(row.trip_start_date),
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
  }, [rows, reportType]);

  const getFullExportRows = async () => {
    setIsExporting(true);
    try {
      const completeRows = await fetchFullReport(currentFilters());
      return normalizeRows(completeRows, reportType);
    } catch (error: any) {
      console.error("Report export error:", error);
      showAlert(
        "Report Export Failed",
        error?.message || "Unable to export the requested report.",
        "error",
      );
      return null;
    } finally {
      setIsExporting(false);
    }
  };

  const exportCSV = async () => {
    const exportRows = await getFullExportRows();
    if (!exportRows) return;
    if (!exportRows.length) {
      showAlert(
        "Nothing to Export",
        "No data is available for the selected report filters.",
        "info",
      );
      return;
    }
    exportToCSV(exportRows, `KSS_${reportType.replace(/[^A-Za-z0-9]+/g, "_")}_Report`);
  };

  const exportExcel = async () => {
    const exportRows = await getFullExportRows();
    if (!exportRows) return;
    if (!exportRows.length) {
      showAlert(
        "Nothing to Export",
        "No data is available for the selected report filters.",
        "info",
      );
      return;
    }
    exportToExcel(exportRows, `KSS_${reportType.replace(/[^A-Za-z0-9]+/g, "_")}_Report`);
  };

  const exportPDF = async () => {
    const exportRows = await getFullExportRows();
    if (!exportRows) return;
    if (!exportRows.length) {
      showAlert(
        "Nothing to Export",
        "No data is available for the selected report filters.",
        "info",
      );
      return;
    }

    const headers = Object.keys(exportRows[0]);

    const pdfRows = exportRows.map((row) =>
      headers.map((header) => row[header])
    );

    generateUniversalPdf(
      `${reportType} Report`,
      `${formatDisplayDate(fromDate) || "All dates"} to ${formatDisplayDate(toDate) || "All dates"} • ${exportRows.length} records`,
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
    <div className="w-full">
      {!showReportsWorkspace ? (
        <div className="liquid-glass w-full rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="kss-eyebrow text-accent">Reports · Analytics</p>
              <h2 className="mt-1 text-xl font-semibold text-fg">
                {reportType} Report
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-secondary">
                Search, filter, review, and export operational and financial
                records for the selected report.
              </p>
            </div>

            <Button
              type="button"
              size="lg"
              className="min-h-11 shrink-0 sm:min-w-48"
              onClick={() => setShowReportsWorkspace(true)}
            >
              Open Report
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full space-y-5 kss-page-enter">
          <div className="kss-module-header">
            <div>
              <div className="kss-eyebrow">REPORTING</div>
              <h2 className="kss-module-title">Reports & Analysis</h2>
              <p className="kss-module-subtitle">
                Search, filter and export operational and financial records.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setShowReportsWorkspace(false)}
              className="rounded-xl"
            >
              Close Report
            </Button>
          </div>

          <div className="liquid-glass p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {reportTypes.map((type) => (
            <Button
              key={type}
              type="button"
              variant={reportType === type ? "default" : "glass"}
              size="sm"
              onClick={() => handleReportTypeChange(type)}
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
              onChange={(e) => handleSearchChange(e.target.value)}
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
              onChange={(e) => handleDateChange("fromDate", e.target.value)}
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
              onChange={(e) => handleDateChange("toDate", e.target.value)}
              className="h-10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              Filter
            </label>
            <Select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
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
              <Button type="button" variant="glass" size="sm" onClick={exportCSV} disabled={isExporting}>
                CSV
              </Button>
              <Button type="button" variant="glass" size="sm" onClick={exportExcel} disabled={isExporting}>
                Excel
              </Button>
              <Button type="button" variant="glass" size="sm" onClick={exportPDF} disabled={isExporting}>
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
                    {isLoading ? "Loading report…" : "No records found for the selected filters."}
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
            onPageChange={(nextPage) => {
              if (isLoading) return;
              clearSearchTimer();
              void loadReport(nextPage, currentFilters());
            }}
          />
        </div>
      )}

          <AlertModal
            isOpen={alertConfig.isOpen}
            title={alertConfig.title}
            message={alertConfig.message}
            type={alertConfig.type}
            onClose={closeAlert}
          />
        </div>
      )}
    </div>
  );
}
