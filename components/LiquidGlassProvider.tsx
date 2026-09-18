"use client";

import { useEffect, useState } from "react";

export default function LiquidGlassProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<{ id: number; message: string; type: string }[]>([]);

  useEffect(() => {
    // Intercept standard browser alerts globally
    const originalAlert = window.alert;
    window.alert = (message: string) => {
      const type = message.toLowerCase().includes("fail") || message.toLowerCase().includes("error") 
        ? "error" 
        : message.toLowerCase().includes("success") 
        ? "success" 
        : "info";
      
      const id = Date.now();
      setAlerts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }, 4000);
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  return (
    <>
      {children}
      {/* iOS Liquidglass Toast Container */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="animate-tab-focus flex items-center gap-3 p-4 rounded-2xl bg-[#1C1C1E]/70 backdrop-blur-3xl saturate-200 border border-white/[0.12] shadow-[0_16px_32px_rgba(0,0,0,0.4)] pointer-events-auto"
          >
            {alert.type === "success" && (
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {alert.type === "error" && (
              <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0 border border-rose-500/30">
                <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
            {alert.type === "info" && (
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/30">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}
            <p className="text-sm font-medium text-white/90 tracking-tight leading-snug">
              {alert.message}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
