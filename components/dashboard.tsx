"use client";
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
import {
  Activity,
  BookOpen,
  ClipboardList,
  Fuel,
  Gauge,
  Home,
  Settings2,
  WalletCards,
  Wrench,
} from "lucide-react";
import { AppNavigation, AppNavigationTrigger, type AppNavigationGroup } from "@/components/ui/AppNavigation";
import { PageFrame } from "@/components/ui/PageFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [workspaceAction, setWorkspaceAction] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  const [liveVehicles, setLiveVehicles] = useState<any[]>([]);

  const [qsTruckId, setQsTruckId] = useState("");
  const [qsStatus, setQsStatus] = useState("WAITING_FOR_LOAD");
  const [qsRemarks, setQsRemarks] = useState("");

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
        const { data: userRoleData, error: userRoleError } = await supabase.rpc("get_current_user_role");

        if (!userRoleError && userRoleData) {
          setUserRole(String(userRoleData).toUpperCase());
        } else {
          setUserRole("VIEWER");
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

  const fetchFleetVehicles = async () => {
    if (!supabase) return;
    const { data: vehiclesData } = await supabase.from('vehicles')
      .select('vehicle_id, vehicle_number, carrying_capacity_tons, current_status')
      .eq('is_active', true)
      .order('vehicle_number');
    if (vehiclesData) setLiveVehicles(vehiclesData);
  };

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

  const allNavigationGroups: AppNavigationGroup[] = [
    {
      label: "Command",
      items: [
        { id: "dashboard", label: "Dashboard", icon: Home, tab: "Dashboard" },
      ],
    },
    {
      label: "Operations",
      items: [
        { id: "operations", label: "Operations", icon: ClipboardList, tab: "Operations" },
      ],
    },
    {
      label: "Fleet",
      items: [
        { id: "fleet", label: "Fleet", icon: Wrench, tab: "Fleet" },
      ],
    },
    {
      label: "Accounts",
      items: [
        { id: "accounts", label: "Accounts", icon: BookOpen, tab: "Accounts" },
      ],
    },
    {
      label: "Reports",
      items: [
        { id: "reports", label: "Reports", icon: ClipboardList, tab: "Reports" },
      ],
    },
    {
      label: "Master",
      items: [
        { id: "master", label: "Master", icon: Settings2, tab: "Master" },
      ],
    },
    {
      label: "AI",
      items: [
        { id: "ai", label: "AI", icon: Activity, tab: "AI" },
      ],
    },
  ];

  const isAdminRole = userRole === "ADMIN" || userRole === "SUPERADMIN";
  const allowedNavigationGroups = isAdminRole
    ? allNavigationGroups
    : allNavigationGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            ["Dashboard", "Reports", "Fleet", "AI"].includes(item.tab)
          ),
        }))
        .filter((group) => group.items.length > 0);
  const activeNavigationItem = allowedNavigationGroups.flatMap((group) => group.items).find((item) => item.tab === activeTab);
  const activeGroup = allowedNavigationGroups.find((group) => group.items.some((item) => item.tab === activeTab))?.label ?? "KSS ERP";

  return (
    <div className="kss-app-atmosphere text-fg font-sans selection:bg-accent/30 selection:text-accent">
      <div className="kss-app-shell" data-sidebar-collapsed={sidebarCollapsed}>

        <ConfirmModal
          isOpen={isLogoutModalOpen}
          title="Secure Sign Out"
          message="Terminate active secure session?"
          isDanger={true}
          confirmText="Sign Out"
          onConfirm={executeLogout}
          onCancel={() => setIsLogoutModalOpen(false)}
        />

        <AppNavigation
          groups={allowedNavigationGroups}
          activeItemId={activeNavigationItem?.id ?? "dashboard"}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileNavigationOpen}
          brand={<div className="app-brand-mark"><KssLogo className="size-5" /></div>}
          userEmail={userEmail}
          userRole={userRole}
          onNavigate={(item) => {
            setActiveTab(item.tab);
            setWorkspaceAction(null);
          }}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
          onMobileOpenChange={setMobileNavigationOpen}
          onSignOut={() => setIsLogoutModalOpen(true)}
        />
        <div className="app-main-column">
          <header className="app-topbar">
            <div className="flex min-w-0 items-center gap-3">
              <AppNavigationTrigger onClick={() => setMobileNavigationOpen(true)} />
              <div className="min-w-0">
                <p className="app-topbar-section">{activeGroup}</p>
                <p className="truncate text-sm font-medium text-fg sm:text-xs sm:font-normal sm:text-fg-muted">
                  {activeTab === "Dashboard"
                    ? "Fleet command center"
                    : workspaceAction
                      ? workspaceAction
                      : "Select a function to continue"}
                </p>
              </div>
            </div>
            <div className="app-topbar-status" aria-label={`${liveVehicles.length} fleet units`}>
              <span className="app-topbar-status-dot" aria-hidden="true" />
              <span>{liveVehicles.length} units</span>
            </div>
          </header>

          <main className="app-main-content">
            <PageFrame as="div" className="app-page-frame">
              {activeTab === "Dashboard" && (
                <div className="kss-workspace-content">
                  <TelemetryHUD
                    canAccessOperations={userRole === "ADMIN" || userRole === "SUPERADMIN"}
                    onFleetSnapshot={setLiveVehicles}
                    onNavigate={(destination) => {
                      const operationActions = [
                        "Trips",
                        "POD Closure",
                        "Modify Trips",
                        "Quick Status",
                        "Driver Approvals",
                      ];

                      if (operationActions.includes(destination)) {
                        setActiveTab("Operations");
                        setWorkspaceAction(destination);
                      } else {
                        setActiveTab(destination);
                        setWorkspaceAction(null);
                      }
                    }}
                  />
                </div>
              )}

              {activeTab === "Operations" && isAdminRole && (
                <div className="kss-workspace-content">
                  {!workspaceAction ? (
                    <div className="space-y-8">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">
                          Operations
                        </p>
                        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
                          Transport execution
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm text-fg-secondary">
                          Select a workflow to dispatch, close, modify, monitor, or approve trips.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {[
                          ["Trips", "Trip Dispatch", "Create and manage active dispatches"],
                          ["POD Closure", "POD Closure", "Search and close completed deliveries"],
                          ["Modify Trips", "Modify Trip", "Correct authorised trip details"],
                          ["Quick Status", "Quick Status", "Update current fleet status"],
                          ["Driver Approvals", "Driver Approvals", "Review pending driver entries"],
                        ].map(([action, title, description]) => (
                          <Button
                            key={action}
                            type="button"
                            variant="ghost"
                            onClick={() => setWorkspaceAction(action)}
                            className="group h-auto min-h-[132px] items-start justify-start rounded-2xl border border-border bg-surface/40 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-surface-raised"
                          >
                            <span className="block">
                              <span className="block text-sm font-semibold text-fg">
                                {title}
                              </span>
                              <span className="mt-2 block text-xs leading-5 text-fg-muted">
                                {description}
                              </span>
                              <span className="mt-5 block text-[11px] font-semibold uppercase tracking-wider text-accent">
                                Open workflow →
                              </span>
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">
                            Operations
                          </p>
                          <h1 className="mt-1 text-lg font-semibold text-fg">
                            {workspaceAction}
                          </h1>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setWorkspaceAction(null)}
                          className="rounded-xl px-4 text-xs"
                        >
                          Back to Operations
                        </Button>
                      </div>

                      {workspaceAction === "Trips" && <TripForm />}
                      {workspaceAction === "POD Closure" && <PodClosure />}
                      {workspaceAction === "Modify Trips" && <ModifyTrips />}
                      {workspaceAction === "Driver Approvals" && <ApprovalQueue />}

                      {workspaceAction === "Quick Status" && (
                        <Dialog
                          open={workspaceAction === "Quick Status"}
                          onOpenChange={(open) => {
                            if (!open) setWorkspaceAction(null);
                          }}
                        >
                          <DialogContent
                            layout="modal"
                            size="lg"
                            className="flex max-h-[92dvh] flex-col overflow-hidden p-0"
                          >
                            <DialogHeader className="px-5 py-4 sm:px-6">
                              <DialogTitle className="text-lg">Quick Status</DialogTitle>
                            </DialogHeader>

                            <DialogBody className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                              <form
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  if (!supabase || !qsTruckId) return;
                                  const { error } = await supabase.rpc("update_vehicle_status_atomic", {
                                    p_vehicle_id: Number(qsTruckId),
                                    p_status: qsStatus,
                                    p_status_remarks: qsRemarks,
                                  });
                                  if (error) {
                                    alert("Error: " + error.message);
                                  } else {
                                    alert("Status updated!");
                                    setQsTruckId("");
                                    setQsRemarks("");
                                    fetchFleetVehicles();
                                    setWorkspaceAction(null);
                                  }
                                }}
                                className="mx-auto w-full max-w-2xl space-y-5"
                              >
                                <div>
                                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-fg-secondary">
                                    Select Truck
                                  </label>
                                  <Select
                                    value={qsTruckId}
                                    onChange={(e) => setQsTruckId(e.target.value)}
                                  >
                                    <option value="">Select vehicle...</option>
                                    {liveVehicles.map((v) => (
                                      <option key={v.vehicle_id} value={v.vehicle_id}>
                                        {v.vehicle_number} ({v.carrying_capacity_tons}MT)
                                      </option>
                                    ))}
                                  </Select>
                                </div>

                                <div>
                                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-fg-secondary">
                                    Status
                                  </label>
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
                                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-fg-secondary">
                                    Remarks
                                  </label>
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
                                  className="mt-4 h-auto w-full rounded-2xl py-4 text-[14px]"
                                >
                                  Update Fleet Status
                                </Button>
                              </form>
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "Fleet" && isAdminRole && (
                <div className="kss-workspace-content">
                  {!workspaceAction ? (
                    <div className="space-y-8">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">
                          Fleet
                        </p>
                        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
                          Fleet control
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm text-fg-secondary">
                          Fuel, AdBlue, tyres, workshop activity, and live fleet visibility.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {[
                          ["Fuel", "Fuel", "Fuel issue, advance and consumption"],
                          ["AdBlue", "AdBlue", "AdBlue issue and filling control"],
                          ["Tyres", "Tyres", "Tyre lifecycle and inventory"],
                          ["Workshop", "Workshop", "Repairs, bills and maintenance"],
                          ["Live Fleet", "Live Fleet", "Current fleet status and movement"],
                        ].map(([action, title, description]) => (
                          <Button
                            key={action}
                            type="button"
                            variant="ghost"
                            onClick={() => setWorkspaceAction(action)}
                            className="group h-auto min-h-[132px] items-start justify-start rounded-2xl border border-border bg-surface/40 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-surface-raised"
                          >
                            <span className="block">
                              <span className="block text-sm font-semibold text-fg">{title}</span>
                              <span className="mt-2 block text-xs leading-5 text-fg-muted">{description}</span>
                              <span className="mt-5 block text-[11px] font-semibold uppercase tracking-wider text-accent">
                                Open workspace →
                              </span>
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Fleet</p>
                          <h1 className="mt-1 text-lg font-semibold text-fg">{workspaceAction}</h1>
                        </div>
                        <Button type="button" variant="ghost" onClick={() => setWorkspaceAction(null)} className="rounded-xl px-4 text-xs">
                          Back to Fleet
                        </Button>
                      </div>

                      {workspaceAction === "Fuel" && <FuelAdvanceModule />}
                      {workspaceAction === "Workshop" && <WorkshopModule />}
                      {workspaceAction === "Tyres" && <WorkshopModule />}
                      {workspaceAction === "Live Fleet" && (
                        <div className="kss-panel p-6">
                          <p className="text-sm font-semibold text-fg">Live Fleet</p>
                          <p className="mt-2 text-xs text-fg-muted">
                            Live fleet monitoring will use the existing fleet snapshot.
                          </p>
                          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                            <div className="rounded-xl border border-border p-4">
                              <p className="text-xs text-fg-muted">Units</p>
                              <p className="mt-1 text-xl font-semibold text-fg">{liveVehicles.length}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      {workspaceAction === "AdBlue" && (
                        <div className="kss-panel p-6">
                          <p className="text-sm font-semibold text-fg">AdBlue</p>
                          <p className="mt-2 text-xs text-fg-muted">
                            AdBlue workflow will be connected here without changing its existing business logic.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "Accounts" && isAdminRole && (
                <div className="kss-workspace-content">
                  {!workspaceAction ? (
                    <div className="space-y-8">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Accounts</p>
                        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">Financial control</h1>
                        <p className="mt-2 max-w-2xl text-sm text-fg-secondary">
                          Manage driver advances, expenses, settlements, and reconciliation.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {[
                          ["Driver Advance", "Driver Advance", "Issue and track driver advances"],
                          ["Expense", "Expense", "Record and manage operating expenses"],
                          ["Driver Settlement", "Driver Settlement", "Review and settle driver balances"],
                          ["Reconcile", "Reconcile", "Reconcile outstanding financial entries"],
                        ].map(([action, title, description]) => (
                          <Button
                            key={action}
                            type="button"
                            variant="ghost"
                            onClick={() => setWorkspaceAction(action)}
                            className="group h-auto min-h-[132px] items-start justify-start rounded-2xl border border-border bg-surface/40 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-surface-raised"
                          >
                            <span className="block">
                              <span className="block text-sm font-semibold text-fg">{title}</span>
                              <span className="mt-2 block text-xs leading-5 text-fg-muted">{description}</span>
                              <span className="mt-5 block text-[11px] font-semibold uppercase tracking-wider text-accent">Open workspace →</span>
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Accounts</p>
                          <h1 className="mt-1 text-lg font-semibold text-fg">{workspaceAction}</h1>
                        </div>
                        <Button type="button" variant="ghost" onClick={() => setWorkspaceAction(null)} className="rounded-xl px-4 text-xs">
                          Back to Accounts
                        </Button>
                      </div>
                      {(workspaceAction === "Driver Advance" || workspaceAction === "Expense") && <AccountsModule />}
                      {workspaceAction === "Driver Settlement" && <DriverSettlementModule />}
                      {workspaceAction === "Reconcile" && (
                        <div className="kss-panel p-6">
                          <p className="text-sm font-semibold text-fg">Reconcile</p>
                          <p className="mt-2 text-xs text-fg-muted">
                            Reconciliation workspace will be connected after the core Accounts workflow is stabilised.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "Reports" && (
                <div className="kss-workspace-content">
                  {!workspaceAction ? (
                    <div className="space-y-8">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Reports</p>
                        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">Reports & analytics</h1>
                        <p className="mt-2 max-w-2xl text-sm text-fg-secondary">
                          Review operational, financial, fleet, driver, and audit information from one reporting workspace.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {[
                          ["Fleet Analytics & Margin", "Fleet/Vehicle", "Fleet utilisation, vehicle status, and margin analysis"],
                          ["Driver Settlement Report", "Driver Settlement", "Driver trip balances, advances, and settlement status"],
                          ["P&L Report", "Financial/P&L", "Trip-level revenue, operating costs, and financial performance"],
                          ["Outstanding Expense/Revenue", "Financial/P&L", "Review outstanding financial entries and follow-up items"],
                          ["Diesel Mileage", "Diesel/Fuel", "Fuel consumption, cost, odometer, and mileage analysis"],
                          ["Trip Audit", "Trips", "Trip history, route, kilometre, status, and settlement audit"],
                        ].map(([action, reportType, description]) => (
                          <Button
                            key={action}
                            type="button"
                            variant="ghost"
                            onClick={() => setWorkspaceAction(`${action}::${reportType}`)}
                            className="group h-auto min-h-[132px] items-start justify-start rounded-2xl border border-border bg-surface/40 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-surface-raised"
                          >
                            <span className="block">
                              <span className="block text-sm font-semibold text-fg">{action}</span>
                              <span className="mt-2 block text-xs leading-5 text-fg-muted">{description}</span>
                              <span className="mt-5 block text-[11px] font-semibold uppercase tracking-wider text-accent">Open report →</span>
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Reports</p>
                          <h1 className="mt-1 text-lg font-semibold text-fg">
                            {workspaceAction.split("::")[0]}
                          </h1>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setWorkspaceAction(null)}
                          className="rounded-xl px-4 text-xs"
                        >
                          Back to Reports
                        </Button>
                      </div>

                      <ReportsModule
                        key={workspaceAction}
                        initialReportType={workspaceAction.split("::")[1] as
                          "Trips" | "POD" | "Diesel/Fuel" | "Driver Bata" | "Driver Settlement" | "Workshop" | "Fleet/Vehicle" | "Financial/P&L"}
                      />
                    </div>
                  )}
                </div>
              )}

              {activeTab === "Master" && isAdminRole && (
                <div className="kss-workspace-content">
                  {!workspaceAction ? (
                    <div className="space-y-8">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Master</p>
                        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">Master data control</h1>
                        <p className="mt-2 max-w-2xl text-sm text-fg-secondary">
                          Maintain fleet, people, routes, rates, vendors, customers, and system users.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {[
                          ["Vehicles", "Vehicles", "Fleet vehicle master"],
                          ["Drivers", "Drivers", "Driver master and access"],
                          ["Freight & Routes", "Freight & Routes", "Routes, freight and distance standards"],
                          ["Driver Bata", "Driver Bata", "Driver bata master"],
                          ["Vendors", "Vendors", "Vendor master and payables"],
                          ["Customers", "Customers", "Customer master"],
                          ["Users", "Users", "System user administration"],
                        ].map(([action, title, description]) => (
                          <Button
                            key={action}
                            type="button"
                            variant="ghost"
                            onClick={() => setWorkspaceAction(action)}
                            className="group h-auto min-h-[132px] items-start justify-start rounded-2xl border border-border bg-surface/40 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-surface-raised"
                          >
                            <span className="block">
                              <span className="block text-sm font-semibold text-fg">{title}</span>
                              <span className="mt-2 block text-xs leading-5 text-fg-muted">{description}</span>
                              <span className="mt-5 block text-[11px] font-semibold uppercase tracking-wider text-accent">Open workspace →</span>
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Master</p>
                          <h1 className="mt-1 text-lg font-semibold text-fg">{workspaceAction}</h1>
                        </div>
                        <Button type="button" variant="ghost" onClick={() => setWorkspaceAction(null)} className="rounded-xl px-4 text-xs">
                          Back to Master
                        </Button>
                      </div>
                      {["Vehicles", "Drivers", "Freight & Routes", "Driver Bata", "Vendors"].includes(workspaceAction) && <SetupModule />}
                      {!["Vehicles", "Drivers", "Freight & Routes", "Driver Bata", "Vendors"].includes(workspaceAction) && (
                        <div className="kss-panel p-6">
                          <p className="text-sm font-semibold text-fg">{workspaceAction}</p>
                          <p className="mt-2 text-xs text-fg-muted">
                            This master workspace is reserved for the dedicated module implementation.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "AI" && (
                <div className="kss-workspace-content">
                  {!workspaceAction ? (
                    <div className="space-y-8">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">AI</p>
                        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">Intelligence workspace</h1>
                        <p className="mt-2 max-w-2xl text-sm text-fg-secondary">
                          Document capture, driver intelligence, and operational insights.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {[
                          ["Uploads / OCR", "Uploads / OCR", "Capture documents and extract structured data"],
                          ["Driver Logs", "Driver Logs", "Review driver activity and submitted logs"],
                          ["Insights", "Insights", "Operational intelligence and exceptions"],
                        ].map(([action, title, description]) => (
                          <Button
                            key={action}
                            type="button"
                            variant="ghost"
                            onClick={() => setWorkspaceAction(action)}
                            className="group h-auto min-h-[132px] items-start justify-start rounded-2xl border border-border bg-surface/40 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-surface-raised"
                          >
                            <span className="block">
                              <span className="block text-sm font-semibold text-fg">{title}</span>
                              <span className="mt-2 block text-xs leading-5 text-fg-muted">{description}</span>
                              <span className="mt-5 block text-[11px] font-semibold uppercase tracking-wider text-accent">Open workspace →</span>
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">AI</p>
                          <h1 className="mt-1 text-lg font-semibold text-fg">{workspaceAction}</h1>
                        </div>
                        <Button type="button" variant="ghost" onClick={() => setWorkspaceAction(null)} className="rounded-xl px-4 text-xs">
                          Back to AI
                        </Button>
                      </div>
                      {workspaceAction === "Insights" && <AiInsightsDashboard />}
                      {workspaceAction !== "Insights" && (
                        <div className="kss-panel p-6">
                          <p className="text-sm font-semibold text-fg">{workspaceAction}</p>
                          <p className="mt-2 text-xs text-fg-muted">
                            This AI workspace will be connected after the core operational modules are stabilised.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </PageFrame>
          </main>
        </div>
      </div>
    </div>
  );
}
