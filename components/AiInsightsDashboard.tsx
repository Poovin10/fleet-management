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

  useEffect(() => { fetchLatestAudit(); }, []);

  const handleManualAuditTrigger = async () => {
    setIsTriggering(true);
    try {
      const res = await fetch("/api/cron/audit");
      const json = await res.json();
      if (json.success) {
        alert("AI Fleet Audit executed successfully!");
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

  if (isLoading) return <div className="p-12 text-center text-slate-400 font-bold animate-pulse">Loading AI Operations Center...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
      <div className="bg-[#12141C] border border-[#222634] rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5A00] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF5A00]"></span>
            </span>
            <h2 className="text-lg font-black text-white uppercase tracking-tight">AI Fleet Operations Hub</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">Audit Report Date: <span className="text-white font-bold">{latestAudit ? formatDate(latestAudit.audit_date) : "No Audits Found"}</span></p>
        </div>
        <button onClick={handleManualAuditTrigger} disabled={isTriggering} className="px-6 py-3 bg-[#FF5A00] hover:bg-[#e04f00] disabled:bg-slate-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-[#FF5A00]/25 active:scale-95 flex items-center gap-2">
          {isTriggering ? "🧠 Running Analysis..." : "⚡ Run Professional Audit"}
        </button>
      </div>

      {!latestAudit ? (
        <div className="bg-[#12141C] border border-[#222634] rounded-2xl p-12 text-center shadow-xl">
          <p className="text-sm font-bold text-slate-400 mb-2">No AI audit reports generated yet.</p>
          <p className="text-xs text-slate-500">Click the button above to generate your professional fleet review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ANOMALIES */}
          <div className="bg-[#12141C] border border-[#222634] rounded-2xl p-6 shadow-xl flex flex-col">
            <div className="border-b border-[#222634] pb-4 mb-4">
              <h3 className="text-xs font-black text-rose-400 uppercase tracking-wider">🚨 Fleet Anomalies ({latestAudit.anomalies?.length || 0})</h3>
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto max-h-[550px] pr-1">
              {latestAudit.anomalies?.map((item: any, idx: number) => (
                <div key={idx} className="p-4 bg-[#161922] border border-[#272B36] rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-white truncate max-w-[140px]">Truck: {item.truckNo || "General"}</span>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">{item.severity || 'MEDIUM'}</span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed break-words">{item.issueDescription}</p>
                  {item.actionItem && (
                    <p className="text-[11px] text-emerald-400 font-bold bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/40 break-words">💡 Recommended Action: {item.actionItem}</p>
                  )}
                </div>
              ))}
              {(!latestAudit.anomalies || latestAudit.anomalies.length === 0) && (
                <p className="text-xs text-slate-500 text-center py-10 font-medium">No operational anomalies detected.</p>
              )}
            </div>
          </div>

          {/* EFFICIENCY LEAKS */}
          <div className="bg-[#12141C] border border-[#222634] rounded-2xl p-6 shadow-xl flex flex-col">
            <div className="border-b border-[#222634] pb-4 mb-4">
              <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider">⚠️ Efficiency Leaks ({latestAudit.efficiency_leaks?.length || 0})</h3>
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto max-h-[550px] pr-1">
              {latestAudit.efficiency_leaks?.map((item: any, idx: number) => (
                <div key={idx} className="p-4 bg-[#161922] border border-[#272B36] rounded-xl space-y-2">
                  <h4 className="text-xs font-black text-white">{item.area}</h4>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed break-words">{item.details}</p>
                  {item.estimatedLoss && (
                    <p className="text-[11px] text-amber-400 font-bold bg-amber-950/20 p-2.5 rounded-lg border border-amber-900/40 break-words">💰 Estimated Impact: {item.estimatedLoss}</p>
                  )}
                </div>
              ))}
              {(!latestAudit.efficiency_leaks || latestAudit.efficiency_leaks.length === 0) && (
                <p className="text-xs text-slate-500 text-center py-10 font-medium">No efficiency leaks reported.</p>
              )}
            </div>
          </div>

          {/* RETENTION & DATA SCIENCE */}
          <div className="bg-[#12141C] border border-[#222634] rounded-2xl p-6 shadow-xl flex flex-col">
            <div className="border-b border-[#222634] pb-4 mb-4">
              <h3 className="text-xs font-black text-sky-400 uppercase tracking-wider">🧠 Driver Retention & Strategy ({latestAudit.retention_suggestions?.length || 0})</h3>
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto max-h-[550px] pr-1">
              {latestAudit.retention_suggestions?.map((item: any, idx: number) => (
                <div key={idx} className="p-4 bg-[#161922] border border-[#272B36] rounded-xl space-y-2">
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 inline-block">{item.category}</span>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed break-words mt-1">{item.suggestion}</p>
                </div>
              ))}
              {(!latestAudit.retention_suggestions || latestAudit.retention_suggestions.length === 0) && (
                <p className="text-xs text-slate-500 text-center py-10 font-medium">No recommendations generated.</p>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
