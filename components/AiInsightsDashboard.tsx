"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function AiInsightsDashboard() {
  const supabase = createClient();
  const [latestAudit, setLatestAudit] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);

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
        alert("Fleet Operations Audit completed successfully.");
        fetchLatestAudit();
      } else {
        alert("Audit failed: " + (json.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
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

  if (isLoading) return <div className="p-12 text-center text-white/60 font-bold animate-pulse">Loading Operations Hub...</div>;

  return (
    <div className="animate-tab-focus space-y-6 animate-in fade-in  max-w-6xl mx-auto px-2">
      <div className="bg-[#12141C] border border-[#222634] rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5A00] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF5A00]"></span>
            </span>
            <h2 className="text-lg font-semibold text-white  tracking-tight">Fleet Operations & Audit Hub</h2>
          </div>
          <p className="text-xs text-white/60 mt-1">Audit Report Date: <span className="text-white font-bold">{latestAudit ? formatDate(latestAudit.audit_date) : "No Audits Found"}</span></p>
        </div>
        <button onClick={handleManualAuditTrigger} disabled={isTriggering} className="px-6 py-3 bg-[#FF5A00] hover:bg-[#e04f00] disabled:bg-slate-700 text-white font-semibold text-xs  tracking-wider rounded-xl transition-all shadow-lg shadow-[#FF5A00]/25 active:scale-95 flex items-center gap-2">
          {isTriggering ? "PROCESSING AUDIT..." : "RUN FLEET AUDIT"}
        </button>
      </div>

      {!latestAudit ? (
        <div className="bg-[#12141C] border border-[#222634] rounded-2xl p-12 text-center shadow-xl">
          <p className="text-sm font-bold text-white/60 mb-2">No audit reports generated yet.</p>
          <p className="text-xs text-white/40">Click the button above to run an instant fleet audit.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#12141C] border border-[#222634] rounded-2xl p-6 shadow-xl flex flex-col">
            <div className="border-b border-[#222634] pb-4 mb-4">
              <h3 className="text-xs font-semibold text-rose-400  tracking-wider">Fuel & Maintenance Flags ({latestAudit.anomalies?.length || 0})</h3>
            </div>
            <div className="space-y-4 flex-1">
              {latestAudit.anomalies?.map((item: any, idx: number) => (
                <div key={idx} className="p-4 bg-[#161922] border border-[#272B36] rounded-xl space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-semibold text-white whitespace-normal break-words">Truck: {item.truckNo || "General"}</span>
                    <span className="text-[9px] font-semibold  px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">{item.severity || 'MEDIUM'}</span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed whitespace-normal break-words">{item.issueDescription}</p>
                  {item.actionItem && (
                    <p className="text-[11px] text-emerald-400 font-bold bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/40 whitespace-normal break-words">ACTION: {item.actionItem}</p>
                  )}
                </div>
              ))}
              {(!latestAudit.anomalies || latestAudit.anomalies.length === 0) && (
                <p className="text-xs text-white/40 text-center py-10 font-medium">All vehicle fuel and maintenance metrics are within normal parameters.</p>
              )}
            </div>
          </div>

          <div className="bg-[#12141C] border border-[#222634] rounded-2xl p-6 shadow-xl flex flex-col">
            <div className="border-b border-[#222634] pb-4 mb-4">
              <h3 className="text-xs font-semibold text-amber-400  tracking-wider">Cash Flow & Transit Bottlenecks ({latestAudit.efficiency_leaks?.length || 0})</h3>
            </div>
            <div className="space-y-4 flex-1">
              {latestAudit.efficiency_leaks?.map((item: any, idx: number) => (
                <div key={idx} className="p-4 bg-[#161922] border border-[#272B36] rounded-xl space-y-3">
                  <h4 className="text-xs font-semibold text-white whitespace-normal break-words">{item.area}</h4>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed whitespace-normal break-words">{item.details}</p>
                  {item.estimatedLoss && (
                    <p className="text-[11px] text-amber-400 font-bold bg-amber-950/20 p-2.5 rounded-lg border border-amber-900/40 whitespace-normal break-words">EST. LOSS: {item.estimatedLoss}</p>
                  )}
                </div>
              ))}
              {(!latestAudit.efficiency_leaks || latestAudit.efficiency_leaks.length === 0) && (
                <p className="text-xs text-white/40 text-center py-10 font-medium">No efficiency leaks reported.</p>
              )}
            </div>
          </div>

          <div className="bg-[#12141C] border border-[#222634] rounded-2xl p-6 shadow-xl flex flex-col">
            <div className="border-b border-[#222634] pb-4 mb-4">
              <h3 className="text-xs font-semibold text-sky-400  tracking-wider">Operational Recommendations ({latestAudit.retention_suggestions?.length || 0})</h3>
            </div>
            <div className="space-y-4 flex-1">
              {latestAudit.retention_suggestions?.map((item: any, idx: number) => (
                <div key={idx} className="p-4 bg-[#161922] border border-[#272B36] rounded-xl space-y-3">
                  <span className="text-[10px] font-semibold  px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 inline-block">{item.category}</span>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed whitespace-normal break-words mt-1">{item.suggestion}</p>
                </div>
              ))}
              {(!latestAudit.retention_suggestions || latestAudit.retention_suggestions.length === 0) && (
                <p className="text-xs text-white/40 text-center py-10 font-medium">No strategic actions required.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
