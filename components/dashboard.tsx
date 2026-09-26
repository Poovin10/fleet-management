"use client";
import { extractFleetRawStatus, resolveFleetOperationalState } from "../lib/operationalState";

import TelemetryHUD from "./TelemetryHUD";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import { TripForm } from "@/components/TripForm";
import { PodClosure } from "@/components/PodClosure";
import { ModifyTrips } from "@/components/ModifyTrips";
import { AccountsModule } from "@/components/AccountsModule";
import { FuelAdvanceModule } from "@/components/FuelAdvanceModule";
import { FinancialsModule } from "@/components/FinancialsModule";
import { ProfitLossModule } from "@/components/ProfitLossModule";
import ReportsModule from "./ReportsModule";
import { WorkshopModule } from "@/components/WorkshopModule";
import { SetupModule } from "@/components/SetupModule";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ApprovalQueue } from "@/components/ApprovalQueue";
import { DriverPortal } from "@/components/DriverPortal";
import { LiveAlertsWidget } from "@/components/LiveAlertsWidget";
import { AiInsightsDashboard } from "@/components/AiInsightsDashboard";
import { DriverSettlementModule } from "@/components/DriverSettlementModule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const KssLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="200" height="200" fill="var(--accent)" />
    <rect x="15" y="15" width="170" height="170" fill="var(--accent-fg)" />
    <path d="M 50 35 L 50 165" stroke="var(--accent)" strokeWidth="24" strokeLinecap="square" />
    <path d="M 50 110 L 140 35" stroke="var(--accent)" strokeWidth="24" strokeLinecap="square" />
    <path d="M 85 85 C 130 95, 145 130, 145 165" stroke="var(--accent)" strokeWidth="24" fill="none" />
  </svg>
);

export default function Dashboard() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<any>(null);

  useEffect(() => { try { setSupabase(createClient()); } catch (err) { console.error(err); } }, []);

  const [isDriverRoute, setIsDriverRoute] = useState(false);
  const [isCheckingRoute, setIsCheckingRoute] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string>("VIEWER");
  const [userEmail, setUserEmail] = useState<string>("");
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState("Dashboard");
  const [opSubTab, setOpSubTab] = useState("Trips");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [currentMonthText, setCurrentMonthText] = useState("");
  const [liveVehicles, setLiveVehicles] = useState<any[]>([]);
  const [monthTripsCount, setMonthTripsCount] = useState<number>(0);
  const [monthFreight, setMonthFreight] = useState<number>(0);
  const [monthDieselCost, setMonthDieselCost] = useState<number>(0);
  const [monthNetRetention, setMonthNetRetention] = useState<number>(0);
  const [activeTripCount, setActiveTripCount] = useState<number>(0);
  const [pendingDriverCount, setPendingDriverCount] = useState<number>(0);
  const [statusCounts, setStatusCounts] = useState({ "Plant Loading": 0, "In Transit": 0, "Workshop / Repairs": 0, "No Driver / Leave": 0 });

  const [qsTruckId, setQsTruckId] = useState("");
  const [qsStatus, setQsStatus] = useState("WAITING_FOR_LOAD");
  const [qsRemarks, setQsRemarks] = useState("");

  const opTabs = ["Trips", "POD Closure", "Modify Trips", "Quick Status", "Driver Approvals"];
  const formatAmt = (amt: number) => (Number(amt) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  useEffect(() => {
    if (typeof window !== "undefined") { if (window.location.pathname.startsWith('/driver')) setIsDriverRoute(true); }
    setIsCheckingRoute(false);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const checkAuth = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (user && !error) {
        setIsAuthenticated(true);
        setUserEmail(user.email || "");
        const sessionUsername = user.email?.split('@')[0];
        if (sessionUsername) {
          const { data: userData } = await supabase.from('app_users').select('role').eq('username', sessionUsername).maybeSingle();
          if (userData && userData.role) { setUserRole(userData.role.toUpperCase()); } else { setUserRole("VIEWER"); }
        }
        setIsAuthLoading(false);
      } else {
        setIsAuthenticated(false); setUserRole("VIEWER");
        if (!isDriverRoute) { router.replace("/auth/login"); }
      }
    };
    if (!isDriverRoute) { checkAuth(); } else { setIsAuthLoading(false); }
  }, [supabase, router, isDriverRoute]);

  const executeLogout = async () => {
    if (!supabase) return; await supabase.auth.signOut(); setIsLogoutModalOpen(false); router.replace("/auth/login");
  };

  const fetchDashboardData = async () => {
    if (!supabase) return;
    const { data: vehiclesData } = await supabase.from('vehicles').select('*');
    if (vehiclesData && vehiclesData.length > 0) {
      setLiveVehicles(vehiclesData);
      setStatusCounts({
        "Plant Loading": vehiclesData.filter((v: any) => resolveFleetOperationalState(extractFleetRawStatus(v)) === "PLANT_LOADING").length,
        "In Transit": vehiclesData.filter((v: any) =>
          ["IN_TRANSIT", "WAITING_FOR_UNLOAD", "UNLOADED", "RETURNING"].includes(
            resolveFleetOperationalState(extractFleetRawStatus(v))
          )
        ).length,
        "Workshop / Repairs": vehiclesData.filter((v: any) => resolveFleetOperationalState(extractFleetRawStatus(v)) === "WORKSHOP").length,
        "No Driver / Leave": vehiclesData.filter((v: any) => resolveFleetOperationalState(extractFleetRawStatus(v)) === "DRIVER_UNAVAILABLE").length
      });
    }

    const { count: activeCount } = await supabase.from('trips').select('*', { count: 'exact', head: true }).neq('trip_status', 'COMPLETED');
    setActiveTripCount(activeCount || 0);

    const { count: driverPendingCount } = await supabase.from('driver_pending_entries').select('*', { count: 'exact', head: true }).eq('status', 'PENDING');
    setPendingDriverCount(driverPendingCount || 0);

    const firstDay = "2026-09-01";

    const [tripsRes, dieselRes, workshopRes] = await Promise.all([
      supabase.from('trips').select('freight_revenue, driver_bata, halt_bata, enroute_repairs_maintenance').gte('trip_start_date', firstDay),
      supabase.from('diesel_fuel_logs').select('total_fuel_cost').gte('fuel_date', firstDay),
      supabase.from('workshop_spares_bills').select('bill_amount').gte('bill_date', firstDay)
    ]);

    if (tripsRes.data && dieselRes.data) {
      setMonthTripsCount(tripsRes.data.length);
      let totalFreight = 0; let nonFuelExpenses = 0; let totalDieselCost = 0; let totalWorkshop = 0;
      tripsRes.data.forEach((t: any) => { totalFreight += Number(t.freight_revenue) || 0; nonFuelExpenses += (Number(t.driver_bata) || 0) + (Number(t.halt_bata) || 0) + (Number(t.enroute_repairs_maintenance) || 0); });
      dieselRes.data.forEach((d: any) => { totalDieselCost += Number(d.total_fuel_cost) || 0; });
      if (workshopRes.data) workshopRes.data.forEach((w: any) => { totalWorkshop += Number(w.bill_amount) || 0; });
      setMonthFreight(totalFreight); setMonthDieselCost(totalDieselCost);
      setMonthNetRetention(totalFreight - totalDieselCost - nonFuelExpenses - totalWorkshop);
    }
  };

  useEffect(() => {
    if (isAuthenticated && supabase) {
      setCurrentMonthText(new Date().toLocaleString('default', { month: 'long', year: 'numeric' }));
      fetchDashboardData();
    }
  }, [activeTab, opSubTab, isAuthenticated, supabase]);

  if (isCheckingRoute || isAuthLoading || !supabase) return <div className="min-h-screen bg-app" />;

  if (isDriverRoute) {
    return (
      <div className="min-h-screen bg-app text-fg relative font-sans overflow-x-hidden">
        <div className="fixed top-[-10%] right-[-5%] w-[50vw] h-[50vw] bg-accent/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen z-0 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="fixed bottom-[-10%] left-[-5%] w-[60vw] h-[60vw] bg-accent-hover/10 rounded-full blur-[150px] pointer-events-none mix-blend-screen z-0 animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="relative z-10">
          <div className="max-w-md mx-auto mb-6 text-center mt-8">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-fg">KSS Roadways</h1>
            <p className="text-xs text-accent tracking-wide font-medium mt-1">Driver Highway Portal</p>
          </div>
          <DriverPortal/>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const erpNavigation = [
    {
      category: "Command & Operations",
      items: ["Dashboard", "Operations", "Fuel", "Workshop & Tyres"]
    },
    {
      category: "Finance & Analytics",
      items: ["Driver Settlement", "Accounts", "Reports", "Fleet Analytics", "P&L Statement"]
    },
    {
      category: "System",
      items: ["Insights", "Master"]
    }
  ];

  const allowedCategories =
    userRole === "ADMIN" || userRole === "SUPERADMIN"
      ? erpNavigation
      : [
          { category: "Overview", items: ["Dashboard"] },
          { category: "Finance", items: ["Reports", "Fleet Analytics", "P&L Statement", "Insights"] }
        ];

  const activeGroup =
    allowedCategories.find((group) => group.items.includes(activeTab))?.category ?? "Overview";

  const activeDescription: Record<string, string> = {
    Dashboard: "Fleet command center",
    Operations: "Trip execution and closure",
    Fuel: "Fuel advances and fleet consumption",
    "Workshop & Tyres": "Maintenance and tyre control",
    "Driver Settlement": "Driver advances and settlement",
    Accounts: "Accounts and financial control",
    "Reports": "Operational and financial reports",
    "Fleet Analytics": "Fleet financial performance",
    "P&L Statement": "Profit and loss statement",
    Insights: "Operational intelligence",
    Master: "Fleet and system configuration"
  };

  return (
    <div className="kss-app-atmosphere text-fg font-sans selection:bg-accent/30 selection:text-accent">

      {/* Global Ambient Refraction */}
      <div
        className="fixed top-[-18%] right-[-12%] w-[55vw] h-[55vw] bg-accent/10 rounded-full blur-[150px] pointer-events-none mix-blend-screen z-0 animate-pulse"
        style={{ animationDuration: "12s" }}
      />
      <div
        className="fixed bottom-[-18%] left-[-12%] w-[65vw] h-[65vw] bg-accent-hover/8 rounded-full blur-[170px] pointer-events-none mix-blend-screen z-0 animate-pulse"
        style={{ animationDuration: "16s" }}
      />

      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.025] pointer-events-none z-0" />

      <div className="relative z-10 min-h-screen">

        <ConfirmModal
          isOpen={isLogoutModalOpen}
          title="Secure Sign Out"
          message="Terminate active secure session?"
          isDanger={true}
          confirmText="Sign Out"
          onConfirm={executeLogout}
          onCancel={() => setIsLogoutModalOpen(false)}
        />

        {/* Desktop Command Sidebar */}
        <aside
          className="kss-sidebar hidden lg:flex fixed inset-y-0 left-0 z-40"
          style={{ width: sidebarCollapsed ? "88px" : "252px" }}
        >
          <div className="kss-sidebar-inner">

            <div className="px-3 pt-3 pb-3 border-b border-border-subtle">
              <div className={`flex ${
                sidebarCollapsed
                  ? "flex-col items-center justify-center gap-2"
                  : "items-center justify-between gap-3"
              }`}>
                <div className={`flex min-w-0 items-center ${
                  sidebarCollapsed ? "justify-center" : "gap-3"
                }`}>
                  <div className="w-10 h-10 rounded-[14px] bg-surface-elevated border border-border-strong flex items-center justify-center shadow-inner shrink-0">
                    <KssLogo className="w-5 h-5" />
                  </div>

                  {!sidebarCollapsed && (
                    <div className="min-w-0">
                      <div className="text-sm font-semibold tracking-wide text-fg">
                        KSS Roadways
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                        <span className="text-[9px] uppercase tracking-[0.14em] font-medium text-fg-muted">
                          Fleet Command
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((value) => !value)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-raised/60 text-fg-muted transition-all duration-200 hover:bg-surface-elevated hover:text-fg"
                  aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  <svg
                    className={`h-4 w-4 transition-transform duration-300 ${
                      sidebarCollapsed ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m15 18-6-6 6-6" />
                  </svg>
                </button>
              </div>
            </div>

            <nav className={`flex-1 min-h-0 overflow-y-auto ${
              sidebarCollapsed ? "px-2 py-3 space-y-3" : "px-3 py-4 space-y-5"
            }`}>
              {allowedCategories.map((group) => (
                <div key={group.category}>
                  {!sidebarCollapsed && (
                    <div className="px-3 mb-2 text-[9px] uppercase tracking-[0.16em] font-semibold text-fg-muted">
                      {group.category}
                    </div>
                  )}

                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = activeTab === item;

                      return (
                        <Button
                          key={item}
                          type="button"
                          variant="ghost"
                          onClick={() => setActiveTab(item)}
                          className={`w-full ${
                            sidebarCollapsed
                              ? "justify-center h-10 rounded-xl px-0"
                              : "justify-start h-10 rounded-xl px-3.5"
                          } text-[11.5px] transition-all duration-200 ${
                            isActive
                              ? "bg-accent text-accent-fg font-bold shadow-orange hover:bg-accent-hover hover:text-accent-fg"
                              : "text-fg-secondary font-medium hover:text-fg hover:bg-surface-raised"
                          }`}
                          title={sidebarCollapsed ? item : undefined}
                          aria-label={sidebarCollapsed ? item : undefined}
                        >
                          <span className={`flex items-center justify-center shrink-0 ${
                            sidebarCollapsed
                              ? "h-7 w-7 rounded-lg border border-current/20 bg-black/10 text-[9px] font-bold uppercase"
                              : "w-1.5 h-1.5 rounded-full mr-3"
                          } ${
                            isActive ? "bg-accent-fg/15" : ""
                          }`}>
                            {sidebarCollapsed ? item.charAt(0) : ""}
                          </span>
                          {!sidebarCollapsed && (
                            <span className="truncate">{item}</span>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="px-2.5 py-2 border-t border-border-subtle shrink-0">
              <div className={`flex items-center ${
                sidebarCollapsed ? "justify-center" : "justify-between"
              } gap-2 rounded-xl border border-accent/20 bg-accent/[0.06] px-2.5 py-2`}>

                {!sidebarCollapsed && (
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_rgba(255,159,10,0.65)]" />

                    <div className="min-w-0 leading-none">
                      <div className="truncate text-[11px] font-semibold text-fg">
                        {userEmail ? userEmail.split("@")[0] : "KSS User"}
                      </div>

                      <div className="mt-1 text-[7px] font-bold uppercase tracking-[0.14em] text-accent">
                        {userRole}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsLogoutModalOpen(true)}
                  className={`flex shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent transition-all duration-200 hover:border-accent/60 hover:bg-accent/20 hover:shadow-[0_0_16px_rgba(255,159,10,0.18)] active:scale-95 ${
                    sidebarCollapsed ? "h-9 w-9" : "h-8 w-8"
                  }`}
                  title={`Sign out (${userRole})`}
                  aria-label={`Sign out (${userRole})`}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Application Frame */}
        <div
  className="h-screen min-h-0 min-w-0 max-w-full overflow-hidden flex flex-col transition-[padding-left] duration-300"
  style={{ paddingLeft: typeof window !== "undefined" && window.innerWidth >= 1024 ? (sidebarCollapsed ? "88px" : "252px") : undefined }}
>

          {/* Premium Command Bar */}
          <header className="shrink-0 z-30 px-3 sm:px-5 lg:px-6 pt-3 lg:pt-4">
            <div className="kss-command-bar min-h-[68px] px-4 sm:px-5 flex items-center justify-between gap-4">

              <div className="min-w-0">
                <div className="mb-1">
                  <span className="text-[9px] uppercase tracking-[0.16em] font-semibold text-accent">
                    {activeGroup}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 min-w-0">
                  <h1 className="text-base sm:text-lg font-semibold tracking-[-0.025em] text-fg truncate">
                    {activeTab}
                  </h1>
                  <span className="hidden sm:inline text-[10px] text-fg-muted truncate">
                    {activeDescription[activeTab] ?? "KSS Roadways ERP"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-raised/70 border border-border-subtle">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span className="text-[10px] font-medium text-fg-secondary">
                    {liveVehicles.length} units
                  </span>
                </div>

                <Button
                  type="button"
                  variant="glass"
                  onClick={() => setIsLogoutModalOpen(true)}
                  className="lg:hidden h-9 rounded-xl px-3 text-[10.5px] font-semibold"
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </header>

          {/* Mobile Navigation */}
          <div className="lg:hidden px-3 sm:px-5 pt-3">
            <div className="kss-mobile-nav rounded-[20px] p-2 overflow-x-auto">
              <div className="flex items-center gap-1.5 min-w-max">
                {allowedCategories.flatMap((group) => group.items).map((item) => {
                  const isActive = activeTab === item;

                  return (
                    <Button
                      key={item}
                      type="button"
                      variant="ghost"
                      onClick={() => setActiveTab(item)}
                      className={`h-9 rounded-xl px-3.5 text-[10.5px] whitespace-nowrap ${
                        isActive
                          ? "bg-accent text-accent-fg font-bold shadow-orange hover:bg-accent-hover hover:text-accent-fg"
                          : "text-fg-secondary hover:text-fg hover:bg-surface-raised font-medium"
                      }`}
                    >
                      {item}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          <main className="kss-workspace my-3 lg:my-4 flex-1 min-h-0 overflow-auto">
            <div>
              {activeTab === "Dashboard" && <div className="kss-workspace-content"><TelemetryHUD /></div>}

            {activeTab === "Operations" && (userRole === "ADMIN" || userRole === "SUPERADMIN") && (
              <div className="kss-workspace-content">
                <div className="flex flex-wrap gap-2 border-b border-border pb-6 mb-8">
                  {opTabs.map((sub) => (
                    <Button
                      key={sub}
                      type="button"
                      variant={opSubTab === sub ? "default" : "ghost"}
                      onClick={() => setOpSubTab(sub)}
                      className={`h-auto rounded-xl px-5 py-2.5 text-xs ${
                        opSubTab === sub
                          ? "font-bold"
                          : "text-fg-secondary hover:text-fg hover:bg-surface-raised font-semibold"
                      }`}
                    >
                      {sub}
                    </Button>
                  ))}
                </div>

                {opSubTab === "Trips" && <TripForm />}
                {opSubTab === "POD Closure" && <PodClosure />}
                {opSubTab === "Modify Trips" && <ModifyTrips />}
                {opSubTab === "Driver Approvals" && <ApprovalQueue/>}
                {opSubTab === "Quick Status" && (
                  <div className="kss-panel max-w-xl">
                    <h3 className="text-sm font-semibold text-fg mb-6 tracking-wide border-b border-border pb-4">Manual Status Override</h3>
                    <form onSubmit={async (e) => {
                      e.preventDefault(); if (!supabase || !qsTruckId) return;
                      const { error } = await supabase.rpc("update_vehicle_status_atomic", {
                        p_vehicle_id: Number(qsTruckId),
                        p_status: qsStatus,
                        p_status_remarks: qsRemarks,
                      });
                      if (error) alert("Error: " + error.message); else { alert("Status updated!"); setQsTruckId(""); setQsRemarks(""); fetchDashboardData(); }
                    }} className="space-y-5">
                      <div>
                        <label className="block text-[11px] font-semibold text-fg-secondary mb-2 uppercase tracking-wider">Select Truck</label>
                        <Select
                          value={qsTruckId}
                          onChange={(e) => setQsTruckId(e.target.value)}
                        >
                          <option value="">Select vehicle...</option>
                          {liveVehicles.map(v => (
                            <option key={v.vehicle_id} value={v.vehicle_id}>
                              {v.vehicle_number} ({v.carrying_capacity_tons}MT)
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-fg-secondary mb-2 uppercase tracking-wider">Status</label>
                        <Select
                          value={qsStatus}
                          onChange={(e) => setQsStatus(e.target.value)}
                        >
                          <option value="WAITING_FOR_LOAD">Plant Loading</option>
                          <option value="IN_TRANSIT">In Transit</option>
                          <option value="WORKSHOP_MAINTENANCE">Workshop / Repairs</option>
                          <option value="DRIVER_UNAVAILABLE">No Driver / Leave</option>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-fg-secondary mb-2 uppercase tracking-wider">Remarks</label>
                        <Input
                          type="text"
                          value={qsRemarks}
                          onChange={(e) => setQsRemarks(e.target.value)}
                          placeholder="Location or repair notes"
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="default"
                        className="w-full h-auto rounded-2xl py-4 text-[14px] mt-4"
                      >
                        Update Fleet Status
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {activeTab === "Driver Settlement" && <div className="kss-workspace-content"><DriverSettlementModule /></div>}
            {activeTab === "Accounts" && <div className="kss-workspace-content"><AccountsModule /></div>}
            {activeTab === "Fuel" && <div className="kss-workspace-content"><FuelAdvanceModule /></div>}
            {activeTab === "Workshop & Tyres" && <div className="kss-workspace-content"><WorkshopModule /></div>}
            {activeTab === "Reports" && <div className="kss-workspace-content"><ReportsModule /></div>}
            {activeTab === "Fleet Analytics" && <div className="kss-workspace-content"><FinancialsModule /></div>}
            {activeTab === "P&L Statement" && <div className="kss-workspace-content"><ProfitLossModule /></div>}
            {activeTab === "Insights" && <div className="kss-workspace-content"><AiInsightsDashboard /></div>}
            {activeTab === "Master" && <div className="kss-workspace-content"><SetupModule /></div>}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
