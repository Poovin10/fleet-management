"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { extractFleetRawStatus, resolveFleetOperationalState, fleetStateLabel } from "@/lib/operationalState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRight, ClipboardCheck, Fuel, RefreshCw, TriangleAlert, Truck, Wrench } from "lucide-react";

type PeriodKey = "today" | "week" | "month" | "custom";
type FleetKey = "plant" | "inTrip" | "halted" | "workshop" | "noDriver" | "ready" | "all";
type DashboardAction = "Trips" | "POD Closure" | "Driver Approvals" | "Quick Status" | "Fuel" | "Workshop & Tyres" | "Driver Settlement" | "Reports" | "Fleet Analytics" | "Master";
type FleetVehicle = {
  vehicle_id: number;
  vehicle_number: string;
  carrying_capacity_tons: number;
  truck_type: string | null;
  current_status: string | null;
  status_remarks: string | null;
  status_updated_at: string | null;
};
type ExpiryItem = { id: string; entity: string; document: string; date: string; days: number };
type ExpiryGroup = { title: string; subtitle: string; items: ExpiryItem[] };
type FinancialSummary = {
  revenue: number | null;
  diesel: number | null;
  expenses: number | null;
  retention: number | null;
  dieselPercent: number | null;
  warning: string | null;
};

const PAGE_SIZE = 10;
const MAX_CLIENT_AGGREGATE_ROWS = 1000;

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateRange(period: PeriodKey, customFrom: string, customTo: string) {
  const now = new Date();
  const today = localDateKey(now);
  if (period === "today") return { from: today, to: today };
  if (period === "week") {
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysSinceMonday = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - daysSinceMonday);
    return { from: localDateKey(monday), to: today };
  }
  if (period === "custom") return { from: customFrom, to: customTo };
  return {
    from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
    to: localDateKey(now),
  };
}

function daysUntil(date: string, today: string) {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / 86_400_000);
}

function matchesFleetKey(vehicle: Pick<FleetVehicle, "current_status">, key: FleetKey) {
  const state = resolveFleetOperationalState(extractFleetRawStatus(vehicle));
  if (key === "plant") return state === "PLANT_LOADING";
  if (key === "ready") return state === "READY";
  if (key === "inTrip") return state === "IN_TRANSIT" || state === "RETURNING";
  if (key === "halted") return state === "WAITING_FOR_UNLOAD" || state === "UNLOADED";
  if (key === "workshop") return state === "WORKSHOP";
  if (key === "noDriver") return state === "DRIVER_UNAVAILABLE";
  return true;
}

function applyFleetFilter(query: any, key: FleetKey) {
  if (key === "plant") return query.or("current_status.is.null,current_status.ilike.%WAITING_FOR_LOAD%,current_status.ilike.%PLANT%,current_status.ilike.%LOADING%");
  if (key === "ready") return query.or("current_status.ilike.%AVAILABLE_FOR_LOAD%,current_status.ilike.%READY_FOR_DISPATCH%");
  if (key === "inTrip") return query.or("current_status.ilike.%TRANSIT%,current_status.ilike.%RETURNING%");
  if (key === "halted") return query.or("current_status.ilike.%WAITING_FOR_UNLOAD%,current_status.ilike.%UNLOADED%");
  if (key === "workshop") return query.or("current_status.ilike.%WORKSHOP%,current_status.ilike.%REPAIR%,current_status.ilike.%BREAKDOWN%");
  if (key === "noDriver") return query.or("current_status.ilike.%DRIVER%,current_status.ilike.%UNAVAILABLE%,current_status.ilike.%NO_DRIVER%,current_status.ilike.%LEAVE%");
  return query;
}

const moneyCompact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 2 });
const moneyExact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export function DashboardOwnerCommandCenter({
  onNavigate,
  canAccessOperations,
  onFleetSnapshot,
}: {
  onNavigate: (destination: DashboardAction) => void;
  canAccessOperations: boolean;
  onFleetSnapshot?: (vehicles: FleetVehicle[]) => void;
}) {
  const [supabase] = useState(() => createClient());
  const now = new Date();
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [customFrom, setCustomFrom] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [customTo, setCustomTo] = useState(localDateKey(now));
  const range = dateRange(period, customFrom, customTo);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [fleetLoaded, setFleetLoaded] = useState(false);
  const [financial, setFinancial] = useState<FinancialSummary>({ revenue: null, diesel: null, expenses: null, retention: null, dieselPercent: null, warning: null });
  const [tripCount, setTripCount] = useState<number | null>(null);
  const [completedTripCount, setCompletedTripCount] = useState<number | null>(null);
  const [todayTripCount, setTodayTripCount] = useState<number | null>(null);
  const [pendingPods, setPendingPods] = useState<number | null>(null);
  const [pendingEntries, setPendingEntries] = useState<number | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehiclesComplete, setVehiclesComplete] = useState(true);
  const [driversComplete, setDriversComplete] = useState(true);
  const [expiryGroups, setExpiryGroups] = useState<ExpiryGroup[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [selectedExpiryGroup, setSelectedExpiryGroup] = useState<ExpiryGroup | null>(null);
  const [selectedFleet, setSelectedFleet] = useState<{ key: FleetKey; title: string } | null>(null);
  const [fleetSearch, setFleetSearch] = useState("");
  const [fleetPage, setFleetPage] = useState(1);
  const [fleetRows, setFleetRows] = useState<any[]>([]);
  const [fleetTotal, setFleetTotal] = useState(0);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [fleetError, setFleetError] = useState<string | null>(null);
  const [tripContext, setTripContext] = useState<Record<number, { route: string; driver: string }>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      if (!range.from || !range.to || range.from > range.to) {
        setFinancial({ revenue: null, diesel: null, expenses: null, retention: null, dieselPercent: null, warning: null });
        setTripCount(null);
        setCompletedTripCount(null);
        setTodayTripCount(null);
        setDashboardError("Choose both custom dates and make sure the start date is on or before the end date.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setDashboardError(null);
      setFinancial({ revenue: null, diesel: null, expenses: null, retention: null, dieselPercent: null, warning: null });
      const today = localDateKey(new Date());
      const [fleetRes, driversRes, podsRes, pendingRes, tripRowsRes, completedRes, todayTripsRes, fuelRowsRes, workshopRowsRes] = await Promise.all([
        supabase.from("vehicles").select("vehicle_id, vehicle_number, carrying_capacity_tons, truck_type, current_status, status_remarks, status_updated_at, is_active, fc_expiry_date, insurance_expiry_date, qtax_expiry_date, puc_expiry_date, np_expiry_date, state_permit_expiry_date, tank_cert_expiry_date", { count: "exact" }).eq("is_active", true).order("vehicle_number"),
        supabase.from("drivers").select("driver_id, driver_code, full_name, license_expiry_date", { count: "exact" }).eq("is_active", true),
        supabase.from("trips").select("trip_id", { count: "exact", head: true }).eq("pod_status", "PENDING_SUBMISSION"),
        supabase.from("driver_pending_entries").select("entry_id", { count: "exact", head: true }).eq("status", "PENDING"),
        supabase.from("trips").select("freight_revenue, driver_bata, halt_bata, enroute_repairs_maintenance", { count: "exact" }).gte("trip_start_date", range.from).lte("trip_start_date", range.to),
        supabase.from("trips").select("trip_id", { count: "exact", head: true }).gte("trip_start_date", range.from).lte("trip_start_date", range.to).eq("trip_status", "COMPLETED"),
        range.from === today && range.to === today
          ? Promise.resolve(null)
          : supabase.from("trips").select("trip_id", { count: "exact", head: true }).eq("trip_start_date", today),
        supabase.from("diesel_fuel_logs").select("total_fuel_cost", { count: "exact" }).gte("fuel_date", range.from).lte("fuel_date", range.to),
        supabase.from("workshop_spares_bills").select("bill_amount", { count: "exact" }).gte("bill_date", range.from).lte("bill_date", range.to),
      ]);
      if (cancelled) return;

      const fleetData = fleetRes.data || [];
      const driverData = driversRes.data || [];
      setVehicles(fleetData);
      setFleetLoaded(!fleetRes.error);
      setVehiclesComplete(!fleetRes.error && (fleetRes.count ?? fleetData.length) <= fleetData.length);
      setDriversComplete(!driversRes.error && (driversRes.count ?? driverData.length) <= driverData.length);
      if (!fleetRes.error) onFleetSnapshot?.(fleetData as FleetVehicle[]);
      setPendingPods(podsRes.error ? null : podsRes.count ?? 0);
      setPendingEntries(pendingRes.error ? null : pendingRes.count ?? 0);
      setTripCount(tripRowsRes.error ? null : tripRowsRes.count ?? tripRowsRes.data?.length ?? 0);
      setCompletedTripCount(completedRes.error ? null : completedRes.count ?? 0);
      setTodayTripCount(range.from === today && range.to === today
        ? (tripRowsRes.error ? null : tripRowsRes.count ?? tripRowsRes.data?.length ?? 0)
        : todayTripsRes?.error ? null : todayTripsRes?.count ?? 0);

      const tripsComplete = !tripRowsRes.error && (tripRowsRes.count ?? tripRowsRes.data?.length ?? 0) <= (tripRowsRes.data?.length ?? 0);
      const fuelsComplete = !fuelRowsRes.error && (fuelRowsRes.count ?? fuelRowsRes.data?.length ?? 0) <= (fuelRowsRes.data?.length ?? 0);
      const workshopComplete = !workshopRowsRes.error && (workshopRowsRes.count ?? workshopRowsRes.data?.length ?? 0) <= (workshopRowsRes.data?.length ?? 0);
      const revenue = tripsComplete ? (tripRowsRes.data || []).reduce((sum, row: any) => sum + (Number(row.freight_revenue) || 0), 0) : null;
      const diesel = fuelsComplete ? (fuelRowsRes.data || []).reduce((sum, row: any) => sum + (Number(row.total_fuel_cost) || 0), 0) : null;
      let expenses: number | null = null;
      let retention: number | null = null;
      let warning: string | null = null;
      if (tripsComplete && fuelsComplete && workshopComplete) {
        const tripCosts = (tripRowsRes.data || []).reduce((sum, row: any) => sum + (Number(row.driver_bata) || 0) + (Number(row.halt_bata) || 0) + (Number(row.enroute_repairs_maintenance) || 0), 0);
        const workshop = (workshopRowsRes.data || []).reduce((sum, row: any) => sum + (Number(row.bill_amount) || 0), 0);
        expenses = (diesel || 0) + tripCosts + workshop;
        retention = (revenue || 0) - expenses;
      } else {
        warning = workshopRowsRes.error
          ? "Workshop expense data could not be read. The bill amount column is not confirmed against the deployed database."
          : "The selected period exceeds the safe browser aggregation limit or a source could not be read. A verified database aggregate is needed for complete totals.";
      }
      setFinancial({
        revenue,
        diesel,
        expenses,
        retention,
        dieselPercent: revenue !== null && diesel !== null && revenue > 0 ? (diesel / revenue) * 100 : null,
        warning,
      });

      const expiryToday = localDateKey(new Date());
      const truckDocuments: ExpiryItem[] = [];
      const driverDocuments: ExpiryItem[] = [];
      const vehicleDocumentFields = [
        ["fc_expiry_date", "Fitness Certificate"], ["insurance_expiry_date", "Insurance"], ["qtax_expiry_date", "Quarterly Tax"],
        ["puc_expiry_date", "PUC"], ["np_expiry_date", "National Permit"], ["state_permit_expiry_date", "State Permit"], ["tank_cert_expiry_date", "Tank Certificate"],
      ] as const;
      for (const vehicle of fleetData) {
        if (vehicle.is_active !== true) continue;
        for (const [field, label] of vehicleDocumentFields) {
          const date = vehicle[field];
          if (!date) continue;
          const days = daysUntil(date, expiryToday);
          if (days <= 30) truckDocuments.push({ id: `vehicle-${vehicle.vehicle_id}-${field}`, entity: vehicle.vehicle_number, document: label, date, days });
        }
      }
      for (const driver of driverData) {
        if (!driver.license_expiry_date) continue;
        const days = daysUntil(driver.license_expiry_date, expiryToday);
        if (days <= 30) driverDocuments.push({ id: `driver-${driver.driver_id}-license`, entity: driver.full_name, document: "Driving Licence", date: driver.license_expiry_date, days });
      }
      const groups: ExpiryGroup[] = [];
      const addExpiryGroup = (source: ExpiryItem[], title: string, window: "expired" | "soon") => {
        const items = source.filter((item) => window === "expired" ? item.days < 0 : item.days >= 0 && item.days <= 30).sort((a, b) => a.days - b.days);
        if (items.length) groups.push({ title, subtitle: window === "expired" ? "Expired documents" : `${items.filter((item) => item.days <= 7).length} due within 7 days · next 30 days`, items });
      };
      if (vehiclesComplete) {
        addExpiryGroup(truckDocuments, "Truck documents expired", "expired");
        addExpiryGroup(truckDocuments, "Truck documents due within 30 days", "soon");
      }
      if (driversComplete) {
        addExpiryGroup(driverDocuments, "Driver licences expired", "expired");
        addExpiryGroup(driverDocuments, "Driver licences due within 30 days", "soon");
      }
      setExpiryGroups(groups);
      setDashboardError(
        fleetRes.error || driversRes.error || podsRes.error || pendingRes.error || tripRowsRes.error || completedRes.error || todayTripsRes?.error
          ? "Some live dashboard data could not be loaded. Refresh to try again."
          : null,
      );
      setIsLoading(false);
    }
    void loadDashboard();
    return () => { cancelled = true; };
  }, [supabase, range.from, range.to, refreshKey, onFleetSnapshot]);

  const counts = useMemo(() => {
    const stateCounts: Record<Exclude<FleetKey, "all">, number> = { plant: 0, inTrip: 0, halted: 0, workshop: 0, noDriver: 0, ready: 0 };
    for (const vehicle of vehicles) {
      for (const key of Object.keys(stateCounts) as Array<Exclude<FleetKey, "all">>) {
        if (matchesFleetKey(vehicle, key)) { stateCounts[key] += 1; break; }
      }
    }
    return stateCounts;
  }, [vehicles]);

  const openFleet = (key: FleetKey, title: string) => {
    setFleetPage(1);
    setFleetSearch("");
    setFleetRows([]);
    setSelectedFleet({ key, title });
  };

  useEffect(() => {
    if (!selectedFleet) return;
    let cancelled = false;
    async function loadFleetPage() {
      setFleetLoading(true);
      setFleetError(null);
      setFleetRows([]);
      const from = (fleetPage - 1) * PAGE_SIZE;
      let query = supabase.from("vehicles").select("vehicle_id, vehicle_number, truck_type, current_status, status_remarks, status_updated_at", { count: "exact" });
      query = applyFleetFilter(query, selectedFleet!.key);
      if (fleetSearch.trim()) query = query.ilike("vehicle_number", `%${fleetSearch.trim()}%`);
      const { data, count, error } = await query.order("vehicle_number", { ascending: true }).order("vehicle_id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
      if (cancelled) return;
      if (error) {
        setFleetError("Fleet details could not be loaded. Please try again.");
        setFleetLoading(false);
        return;
      }
      const rows = data || [];
      setFleetRows(rows);
      setFleetTotal(count ?? 0);
      setFleetLoading(false);
      if (count !== null && fleetPage > Math.max(1, Math.ceil(count / PAGE_SIZE))) setFleetPage(Math.max(1, Math.ceil(count / PAGE_SIZE)));
      if (rows.length) {
        const ids = rows.map((vehicle: any) => vehicle.vehicle_id);
        const { data: trips } = await supabase.from("trips")
          .select("vehicle_id, origin, destination, trip_status, trip_start_date, trip_id, drivers(full_name)")
          .in("vehicle_id", ids).neq("trip_status", "COMPLETED")
          .order("trip_start_date", { ascending: false }).order("trip_id", { ascending: false });
        if (cancelled) return;
        const context: Record<number, { route: string; driver: string }> = {};
        for (const trip of trips || []) {
          if (trip.vehicle_id == null || context[trip.vehicle_id]) continue;
          const driverRelation: any = trip.drivers;
          const driver = Array.isArray(driverRelation) ? driverRelation[0]?.full_name : driverRelation?.full_name;
          context[trip.vehicle_id] = { route: [trip.origin, trip.destination].filter(Boolean).join(" → "), driver: driver || "—" };
        }
        setTripContext(context);
      } else setTripContext({});
    }
    void loadFleetPage();
    return () => { cancelled = true; };
  }, [supabase, selectedFleet?.key, fleetSearch, fleetPage]);

  const dayLabel = useMemo(() => {
    if (period === "today") return `Today · ${range.from}`;
    if (period === "week") return `${range.from} – ${range.to}`;
    if (period === "custom") return `${range.from} – ${range.to}`;
    return new Date(`${range.from}T00:00:00`).toLocaleString("en-IN", { month: "long", year: "numeric" });
  }, [period, range.from, range.to]);
  const activeTripCount = tripCount !== null && completedTripCount !== null ? Math.max(0, tripCount - completedTripCount) : null;
  const fleetSummaryReady = fleetLoaded && vehiclesComplete;
  const documentAttention = expiryGroups.length;
  const attentionVerified = vehiclesComplete && driversComplete && pendingPods !== null && pendingEntries !== null;
  const hasAttention = (pendingPods ?? 0) > 0 || (pendingEntries ?? 0) > 0 || (vehiclesComplete && (counts.noDriver > 0 || counts.workshop > 0)) || documentAttention > 0;
  const formatMoney = (amount: number | null) => amount === null ? "—" : moneyCompact.format(amount);
  const fleetSegments: Array<{ key: FleetKey; title: string; label: string; description: string; count: number; variant: "info" | "warning" | "danger" | "success" | "neutral" }> = [
    { key: "plant", title: "Trucks · Plant", label: "Plant", description: "", count: counts.plant, variant: "warning" },
    { key: "inTrip", title: "Trucks · In Trip", label: "In Trip", description: "", count: counts.inTrip, variant: "info" },
    { key: "halted", title: "Trucks · Halted / Unloading", label: "Halted", description: "", count: counts.halted, variant: "warning" },
    { key: "workshop", title: "Trucks · Workshop", label: "Workshop", description: "", count: counts.workshop, variant: "danger" },
    { key: "noDriver", title: "Trucks · No Driver", label: "No Driver", description: "", count: counts.noDriver, variant: "warning" },
    { key: "ready", title: "Trucks · Ready", label: "Ready", description: "", count: counts.ready, variant: "success" },
  ];

  const attentionRows = [
    ...expiryGroups.map((group) => ({ key: group.title, title: group.title, detail: `${group.items.length} document${group.items.length === 1 ? "" : "s"} · ${group.subtitle}`, variant: group.title.includes("expired") ? "danger" as const : "warning" as const, action: () => setSelectedExpiryGroup(group), actionLabel: "View" })),
    ...(pendingPods && pendingPods > 0 ? [{ key: "pods", title: "POD closure pending", detail: `${pendingPods} trips are waiting for POD submission.`, variant: "warning" as const, action: () => onNavigate("POD Closure"), actionLabel: "Open" }] : []),
    ...(pendingEntries && pendingEntries > 0 ? [{ key: "entries", title: "Driver entries awaiting review", detail: `${pendingEntries} entries are pending review.`, variant: "warning" as const, action: () => onNavigate("Driver Approvals"), actionLabel: "Review" }] : []),
    ...(vehiclesComplete && counts.noDriver > 0 ? [{ key: "no-driver", title: "Trucks marked no driver", detail: `${counts.noDriver} fleet units need driver availability review.`, variant: "warning" as const, action: () => onNavigate("Quick Status"), actionLabel: "View" }] : []),
    ...(vehiclesComplete && counts.workshop > 0 ? [{ key: "workshop", title: "Trucks in workshop status", detail: `${counts.workshop} fleet units are marked for workshop / repairs.`, variant: "danger" as const, action: () => onNavigate("Workshop & Tyres"), actionLabel: "View" }] : []),
  ];


  return (
    <div className="min-w-0 space-y-3 text-fg xl:grid xl:h-[calc(100dvh-8rem)] xl:grid-rows-[auto_auto_auto_auto] xl:gap-3 xl:space-y-0 xl:overflow-hidden 2xl:h-[calc(100dvh-7.5rem)]">
      <PageHeader
        title="Dashboard"
        subtitle="Owner command center"
        actions={<div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Select financial period" value={period} onChange={(event) => setPeriod(event.target.value as PeriodKey)} className="min-w-32">
            <option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="custom">Custom</option>
          </Select>
          {period === "custom" ? <><Input aria-label="From date" type="date" required value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="w-36" /><Input aria-label="To date" type="date" required value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="w-36" /></> : null}
          <Button type="button" variant="outline" size="sm" aria-label="Refresh dashboard" onClick={() => setRefreshKey((value) => value + 1)} disabled={isLoading}><RefreshCw aria-hidden="true" className="size-4" /><span className="hidden sm:inline">Refresh</span></Button>
          <svg className="hidden h-11 w-28 text-accent lg:block" viewBox="0 0 140 54" role="img" aria-label="Fleet truck on the road">
            <path d="M4 43h132" fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="2" strokeDasharray="5 5" />
            <path d="M10 38c15-14 27-14 42-3s27 10 40-2 23-9 38 1" fill="none" stroke="currentColor" strokeOpacity=".42" strokeWidth="2" />
            <path d="M73 14h25a4 4 0 0 1 4 4v17H69V18a4 4 0 0 1 4-4Zm29 8h14l12 10v3h-26V22Z" fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="81" cy="38" r="5" fill="var(--surface)" stroke="currentColor" strokeWidth="2" />
            <circle cx="116" cy="38" r="5" fill="var(--surface)" stroke="currentColor" strokeWidth="2" />
            <path d="M108 23v9h14" fill="none" stroke="currentColor" strokeOpacity=".7" strokeWidth="1.5" />
          </svg>
        </div>}
      />

      <section aria-labelledby="owner-financial-title" className="min-h-0 space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="owner-financial-title" className="text-sm font-semibold text-fg">Financial performance <span className="font-normal text-fg-muted">· {dayLabel}</span></h2>
          {period === "custom" && (!range.from || !range.to || range.from > range.to) ? <span className="text-xs text-warning">Select a valid date range</span> : null}
        </div>

        <dl className="kss-surface grid grid-cols-1 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
          <div className="min-h-28 px-4 py-4 sm:px-5">
            <dt className="text-xs font-medium text-fg-muted">Freight revenue</dt>
            <dd className="mt-2 truncate text-2xl font-semibold tabular-nums text-fg" title={financial.revenue === null ? undefined : moneyExact.format(financial.revenue)}>{isLoading ? "…" : formatMoney(financial.revenue)}</dd>
            <p className="mt-1 text-xs text-fg-muted">{dayLabel}</p>
          </div>
          <div className="min-h-28 px-4 py-4 sm:px-5">
            <dt className="text-xs font-medium text-fg-muted">Trips</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums text-fg">{isLoading ? "…" : tripCount ?? "—"}</dd>
            <p className="mt-1 text-xs text-fg-muted">{completedTripCount === null || tripCount === null ? dayLabel : `${completedTripCount} completed · ${activeTripCount ?? 0} active`}</p>
          </div>
          <div className="min-h-28 px-4 py-4 sm:px-5">
            <dt className="text-xs font-medium text-fg-muted">Diesel expense</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums text-fg">{isLoading ? "…" : financial.dieselPercent === null ? "—" : `${financial.dieselPercent.toFixed(1)}%`}</dd>
            <p className="mt-1 text-xs text-fg-muted">of freight revenue</p>
          </div>
          <div className="min-h-28 px-4 py-4 sm:px-5">
            <dt className="text-xs font-medium text-fg-muted">Operating expenses</dt>
            <dd className="mt-2 truncate text-2xl font-semibold tabular-nums text-fg" title={financial.expenses === null ? undefined : moneyExact.format(financial.expenses)}>{isLoading ? "…" : formatMoney(financial.expenses)}</dd>
            <p className="mt-1 text-xs text-fg-muted">{dayLabel}</p>
          </div>
          <div className="min-h-28 px-4 py-4 sm:px-5">
            <dt className="text-xs font-medium text-fg-muted">Net retention</dt>
            <dd className="mt-2 truncate text-2xl font-semibold tabular-nums text-fg" title={financial.retention === null ? undefined : moneyExact.format(financial.retention)}>{isLoading ? "…" : formatMoney(financial.retention)}</dd>
            <p className="mt-1 text-xs text-fg-muted">{financial.retention !== null && financial.revenue ? `${((financial.retention / financial.revenue) * 100).toFixed(1)}% retention` : dayLabel}</p>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          <p className="text-fg-muted" role="note">Dashboard operating view</p>
          {financial.warning ? <p className="text-warning" role="status">{financial.warning}</p> : null}
          {dashboardError ? <p className="text-danger" role="alert">{dashboardError}</p> : null}
        </div>
      </section>

      <section aria-labelledby="movement-title" className="min-h-0 space-y-2">
        <div className="flex items-center justify-between gap-3"><h2 id="movement-title" className="text-sm font-semibold text-fg">Truck movement</h2><span className="text-xs text-fg-muted">Select a status to view trucks</span></div>
        <div className="kss-surface overflow-hidden rounded-lg border border-border-subtle">
          <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-7">
            {fleetSegments.map((segment) => (
              <button key={segment.key} type="button" onClick={() => openFleet(segment.key, segment.title)} className="flex min-h-16 items-center justify-between gap-2 border-b border-r border-border-subtle px-3 py-2 text-left transition-colors hover:bg-glass-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:px-4">
                <StatusBadge variant={segment.variant}>{segment.label}</StatusBadge>
                <span className="text-xl font-semibold tabular-nums text-fg">{fleetSummaryReady ? segment.count : "—"}</span>
              </button>
            ))}
            <button type="button" onClick={() => openFleet("all", "All Trucks")} className="flex min-h-16 items-center justify-between gap-2 border-b border-border-subtle px-3 py-2 text-left transition-colors hover:bg-glass-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:px-4">
              <span className="flex items-center gap-1.5 text-xs font-medium text-fg-secondary"><Truck aria-hidden="true" className="size-4 text-accent" />Total</span>
              <span className="text-xl font-semibold tabular-nums text-fg">{fleetSummaryReady ? vehicles.length : "—"}</span>
            </button>
          </div>
          {!vehiclesComplete ? <p className="border-t border-border-subtle px-4 py-1.5 text-[11px] text-warning">Fleet summary incomplete · search all trucks for full results</p> : null}
        </div>
      </section>

      <section aria-labelledby="attention-title" className="min-h-0 space-y-2">
        <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface/70 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5"><span className={`grid size-8 shrink-0 place-items-center rounded-full ${hasAttention ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}><TriangleAlert aria-hidden="true" className="size-4" /></span><div className="min-w-0"><h2 id="attention-title" className="text-sm font-semibold text-fg">{hasAttention ? `${attentionRows.length} alerts need attention` : attentionVerified ? "No open alerts" : "Checking alerts…"}</h2><p className="truncate text-[11px] text-fg-muted">{attentionRows.slice(0, 3).map((item) => item.title).join(" · ") || "Documents, POD and fleet exceptions"}</p></div></div>
          {attentionRows.length ? <Button type="button" variant="outline" size="sm" onClick={() => setNotificationsOpen(true)} className="shrink-0">Review alerts<ArrowRight aria-hidden="true" /></Button> : !attentionVerified ? <StatusBadge variant="pending">Needs verification</StatusBadge> : <StatusBadge variant="success">Clear</StatusBadge>}
        </div>
      </section>

      {canAccessOperations ? <section aria-label="Today and quick actions" className="flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle px-3 py-2">
        <p className="px-1 text-xs text-fg-secondary"><span className="font-medium text-fg">Today</span> · {todayTripCount ?? "—"} trips</p>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" onClick={() => onNavigate("Trips")}><Truck aria-hidden="true" />Dispatch trip</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("POD Closure")}><ClipboardCheck aria-hidden="true" />Close POD</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("Fuel")}><Fuel aria-hidden="true" />Fuel</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("Workshop & Tyres")}><Wrench aria-hidden="true" />Workshop</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("Driver Settlement")}><span aria-hidden="true">₹</span>Settlement</Button>
        </div>
      </section> : null}

      <Dialog open={Boolean(selectedFleet)} onOpenChange={(open) => { if (!open) setSelectedFleet(null); }}>
        {selectedFleet ? <DialogContent layout="modal" size="full" className="flex max-h-[92dvh] flex-col overflow-hidden">
          <DialogHeader><DialogTitle>{selectedFleet.title}</DialogTitle><DialogDescription>Current fleet records</DialogDescription></DialogHeader>
          <DialogBody className="min-h-0 flex-1 overflow-y-auto">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><Input aria-label="Search vehicle number" placeholder="Search truck number…" value={fleetSearch} onChange={(event) => { setFleetSearch(event.target.value); setFleetPage(1); }} className="w-full sm:max-w-xs" /><span className="text-xs text-fg-muted">{fleetTotal} matching units</span></div>
            {fleetLoading ? <p className="py-8 text-center text-sm text-fg-muted" role="status">Loading fleet details…</p> : fleetError ? <p className="py-8 text-center text-sm text-danger" role="alert">{fleetError}</p> : fleetRows.length ? <div className="overflow-x-auto rounded-md border border-border-subtle"><Table><TableHeader><TableRow><TableHead>Truck</TableHead><TableHead>Status</TableHead><TableHead>Route / driver</TableHead><TableHead>Last note</TableHead></TableRow></TableHeader><TableBody>{fleetRows.map((vehicle: any) => {
              const context = tripContext[vehicle.vehicle_id];
              const state = resolveFleetOperationalState(extractFleetRawStatus(vehicle));
              return <TableRow key={vehicle.vehicle_id}><TableCell className="font-medium text-fg">{vehicle.vehicle_number}<span className="ml-2 text-xs text-fg-muted">{vehicle.truck_type || ""}</span></TableCell><TableCell><StatusBadge variant={state === "WORKSHOP" ? "danger" : state === "DRIVER_UNAVAILABLE" ? "warning" : state === "READY" ? "success" : "info"}>{fleetStateLabel(state)}</StatusBadge></TableCell><TableCell><span className="block max-w-56 truncate">{context?.route || "—"}</span><span className="text-xs text-fg-muted">{context?.driver || "—"}</span></TableCell><TableCell className="max-w-48 truncate text-xs text-fg-muted">{vehicle.status_remarks || "—"}</TableCell></TableRow>;
            })}</TableBody></Table></div> : <p className="py-8 text-center text-sm text-fg-muted">No vehicles match this status and search.</p>}
          </DialogBody>
          <DialogFooter className="justify-between"><span className="text-xs text-fg-muted">Page {fleetPage} of {Math.max(1, Math.ceil(fleetTotal / PAGE_SIZE))}</span><Pagination page={fleetPage} totalPages={Math.ceil(fleetTotal / PAGE_SIZE)} onPageChange={setFleetPage} /></DialogFooter>
        </DialogContent> : null}
      </Dialog>

      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        {notificationsOpen ? <DialogContent layout="modal" size="xl" className="max-h-[88dvh] w-full">
          <DialogHeader><DialogTitle>Alerts requiring attention</DialogTitle><DialogDescription>Open an alert to review its records or go to the responsible workflow.</DialogDescription></DialogHeader>
          <DialogBody>
            {attentionRows.map((item) => (
              <div key={item.key} className="flex flex-col gap-3 border-b border-border-subtle py-3 first:pt-0 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="text-sm font-medium text-fg">{item.title}</p><p className="mt-0.5 text-xs text-fg-muted">{item.detail}</p></div>
                {canAccessOperations || item.key.startsWith("Truck documents") || item.key.startsWith("Driver licences") ? <Button type="button" variant="outline" size="sm" onClick={() => { setNotificationsOpen(false); item.action(); }}>{item.actionLabel}<ArrowRight aria-hidden="true" /></Button> : <StatusBadge variant="pending">Operations access required</StatusBadge>}
              </div>
            ))}
            {!vehiclesComplete || !driversComplete ? <p className="pt-3 text-xs text-warning">Document alerts are incomplete because not all active fleet or driver records could be read.</p> : null}
          </DialogBody>
        </DialogContent> : null}
      </Dialog>

      <Dialog open={Boolean(selectedExpiryGroup)} onOpenChange={(open) => { if (!open) setSelectedExpiryGroup(null); }}>
        {selectedExpiryGroup ? <DialogContent layout="modal" size="xl" className="flex max-h-[88dvh] w-full flex-col overflow-hidden">
          <DialogHeader><DialogTitle>{selectedExpiryGroup.title}</DialogTitle><DialogDescription>{selectedExpiryGroup.subtitle}</DialogDescription></DialogHeader>
          <DialogBody className="min-h-0 flex-1 overflow-y-auto">
            <div className="divide-y divide-border-subtle">{selectedExpiryGroup.items.slice(0, 50).map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-fg">{item.entity}</p><p className="text-xs text-fg-muted">{item.document} · {item.date}</p></div><StatusBadge variant={item.days < 0 ? "danger" : item.days <= 7 ? "warning" : "neutral"}>{item.days < 0 ? `${Math.abs(item.days)}d overdue` : item.days === 0 ? "Due today" : `${item.days}d`}</StatusBadge></div>)}</div>
            {selectedExpiryGroup.items.length > 50 ? <p className="pt-3 text-xs text-fg-muted">Showing first 50 items. Open Masters for the complete document records.</p> : null}
          </DialogBody>
          {canAccessOperations ? <DialogFooter><Button type="button" onClick={() => { setSelectedExpiryGroup(null); onNavigate("Master"); }}>Open Masters<ArrowRight aria-hidden="true" /></Button></DialogFooter> : null}
        </DialogContent> : null}
      </Dialog>
    </div>
  );
}
