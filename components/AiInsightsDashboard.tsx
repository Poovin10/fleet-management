"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function AiInsightsDashboard() {
  const supabase = createClient();
  const [latestAudit, setLatestAudit] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const showAlert = (
    title: string,
    message: string,
    type: "success" | "error" | "info" = "info",
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

  const fetchLatestAudit = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("daily_ai_audits")
      .select("*")
      .order("audit_date", { ascending: false })
      .limit(1);

    if (data && data.length > 0) setLatestAudit(data[0]);
    else setLatestAudit(null);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLatestAudit();
  }, []);

  const handleManualAuditTrigger = async () => {
    setIsTriggering(true);

    try {
      const res = await fetch("/api/cron/audit");
      const json = await res.json();

      if (json.success) {
        await fetchLatestAudit();

        showAlert(
          "Fleet Audit Completed",
          "The fleet operations audit completed successfully and the latest report has been refreshed.",
          "success",
        );
      } else {
        showAlert(
          "Fleet Audit Failed",
          json.error || "The fleet audit could not be completed.",
          "error",
        );
      }
    } catch (err: any) {
      showAlert(
        "Audit Network Error",
        err?.message || "A network error occurred while running the fleet audit.",
        "error",
      );
    } finally {
      setIsTriggering(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  if (isLoading) return <div className="p-12 text-center text-fg-secondary font-bold animate-pulse">Loading Operations Hub...</div>;

  return (
    <>
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={closeAlert}
      />

      <div className="animate-tab-focus max-w-6xl mx-auto px-2">
        {!isWorkspaceOpen && (
          <div className="liquid-glass rounded-2xl border border-border p-6 shadow-xl">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-accent" />
                  </span>

                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                    Intelligence & Audit
                  </p>
                </div>

                <h2 className="mt-2 text-lg font-semibold tracking-tight text-fg">
                  Fleet Operations & Audit Hub
                </h2>

                <p className="mt-1 text-xs text-fg-secondary">
                  Latest audit:
                  <span className="ml-1 font-bold text-fg">
                    {latestAudit ? formatDate(latestAudit.audit_date) : "No Audits Found"}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsWorkspaceOpen(true)}
                className="shrink-0 rounded-xl bg-accent px-6 py-3 text-xs font-semibold tracking-wider text-fg shadow-lg shadow-orange transition-all hover:bg-accent-hover active:scale-95"
              >
                Open Fleet Audit Hub
              </button>
            </div>
          </div>
        )}

        <Dialog open={isWorkspaceOpen} onOpenChange={setIsWorkspaceOpen}>
          <DialogContent size="full">
            <DialogHeader>
              <DialogTitle>Fleet Operations & Audit Hub</DialogTitle>
              <DialogDescription>
                Review the latest fleet audit findings, efficiency leaks and operational recommendations.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto px-5 py-5 sm:px-6">
              <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-border bg-surface-raised/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-secondary">
                    Audit Report Date
                  </p>
                  <p className="mt-1 text-sm font-semibold text-fg">
                    {latestAudit ? formatDate(latestAudit.audit_date) : "No Audits Found"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleManualAuditTrigger}
                  disabled={isTriggering}
                  className="rounded-xl bg-accent px-5 py-3 text-xs font-semibold tracking-wider text-fg shadow-lg shadow-orange transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-raised"
                >
                  {isTriggering ? "PROCESSING AUDIT..." : "RUN FLEET AUDIT"}
                </button>
              </div>

              {!latestAudit ? (
                <div className="liquid-glass rounded-2xl p-12 text-center shadow-xl">
                  <p className="mb-2 text-sm font-bold text-fg-secondary">
                    No audit reports generated yet.
                  </p>
                  <p className="text-xs text-fg-muted">
                    Run a fleet audit to generate the latest operational report.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="liquid-glass flex flex-col rounded-2xl p-6 shadow-xl">
                    <div className="mb-4 border-b border-border pb-4">
                      <h3 className="text-xs font-semibold tracking-wider text-danger">
                        Fuel & Maintenance Flags ({latestAudit.anomalies?.length || 0})
                      </h3>
                    </div>

                    <div className="flex-1 space-y-4">
                      {latestAudit.anomalies?.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="liquid-glass space-y-3 rounded-xl border border-border p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="whitespace-normal break-words text-xs font-semibold text-fg">
                              Truck: {item.truckNo || "General"}
                            </span>

                            <span className="shrink-0 rounded-lg border border-danger bg-danger-soft px-2 py-0.5 text-[9px] font-semibold text-danger">
                              {item.severity || "MEDIUM"}
                            </span>
                          </div>

                          <p className="whitespace-normal break-words text-xs font-medium leading-relaxed text-fg-secondary">
                            {item.issueDescription}
                          </p>

                          {item.actionItem && (
                            <p className="whitespace-normal break-words rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-2.5 text-[11px] font-bold text-emerald-400">
                              ACTION: {item.actionItem}
                            </p>
                          )}
                        </div>
                      ))}

                      {(!latestAudit.anomalies || latestAudit.anomalies.length === 0) && (
                        <p className="py-10 text-center text-xs font-medium text-fg-muted">
                          All vehicle fuel and maintenance metrics are within normal parameters.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="liquid-glass flex flex-col rounded-2xl p-6 shadow-xl">
                    <div className="mb-4 border-b border-border pb-4">
                      <h3 className="text-xs font-semibold tracking-wider text-warning">
                        Cash Flow & Transit Bottlenecks ({latestAudit.efficiency_leaks?.length || 0})
                      </h3>
                    </div>

                    <div className="flex-1 space-y-4">
                      {latestAudit.efficiency_leaks?.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="liquid-glass space-y-3 rounded-xl border border-border p-4"
                        >
                          <h4 className="whitespace-normal break-words text-xs font-semibold text-fg">
                            {item.area}
                          </h4>

                          <p className="whitespace-normal break-words text-xs font-medium leading-relaxed text-fg-secondary">
                            {item.details}
                          </p>

                          {item.estimatedLoss && (
                            <p className="whitespace-normal break-words rounded-lg border border-warning bg-warning-soft p-2.5 text-[11px] font-bold text-warning">
                              EST. LOSS: {item.estimatedLoss}
                            </p>
                          )}
                        </div>
                      ))}

                      {(!latestAudit.efficiency_leaks || latestAudit.efficiency_leaks.length === 0) && (
                        <p className="py-10 text-center text-xs font-medium text-fg-muted">
                          No efficiency leaks reported.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="liquid-glass flex flex-col rounded-2xl p-6 shadow-xl">
                    <div className="mb-4 border-b border-border pb-4">
                      <h3 className="text-xs font-semibold tracking-wider text-info">
                        Operational Recommendations ({latestAudit.retention_suggestions?.length || 0})
                      </h3>
                    </div>

                    <div className="flex-1 space-y-4">
                      {latestAudit.retention_suggestions?.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="liquid-glass space-y-3 rounded-xl border border-border p-4"
                        >
                          <span className="inline-block rounded-md border border-info bg-info-soft px-2.5 py-1 text-[10px] font-semibold text-info">
                            {item.category}
                          </span>

                          <p className="mt-1 whitespace-normal break-words text-xs font-medium leading-relaxed text-fg-secondary">
                            {item.suggestion}
                          </p>
                        </div>
                      ))}

                      {(!latestAudit.retention_suggestions || latestAudit.retention_suggestions.length === 0) && (
                        <p className="py-10 text-center text-xs font-medium text-fg-muted">
                          No strategic actions required.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
