"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// Define the alert structure
type AlertItem = {
  id: string;
  type: "CRITICAL" | "TRIP" | "FUEL" | "APPROVAL";
  title: string;
  message: string;
  timestamp: Date;
  icon: string;
  color: string;
};

export function LiveAlertsWidget() {
  const supabase = createClient();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const previousAlertCount = useRef(0);

  // --- SLEEK BROWSER AUDIO SYNTHESIZER (NO MP3 REQUIRED) ---
  const playNotificationPing = () => {
    if (isMuted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(850, ctx.currentTime); // Crisp high pitch
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.log("Audio not supported or interaction required first.");
    }
  };

  // --- HELPER: TIME AGO FORMATTER ---
  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // --- MAIN DATA FETCHING ENGINE ---
  const fetchLiveAlerts = async () => {
    const newAlerts: AlertItem[] = [];
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    try {
      // 1. CHECK EXPIRIES (Trucks & Drivers)
      const { data: vehicles } = await supabase.from('vehicles').select('*').eq('is_active', true);
      const { data: drivers } = await supabase.from('drivers').select('*').eq('is_active', true);
      
      vehicles?.forEach(v => {
        const expiries = [];
        if (v.fc_expiry_date && new Date(v.fc_expiry_date) < thirtyDaysFromNow) expiries.push('FC');
        if (v.insurance_expiry_date && new Date(v.insurance_expiry_date) < thirtyDaysFromNow) expiries.push('Insurance');
        if (v.puc_expiry_date && new Date(v.puc_expiry_date) < thirtyDaysFromNow) expiries.push('PUC');
        if (v.np_expiry_date && new Date(v.np_expiry_date) < thirtyDaysFromNow) expiries.push('NP');
        if (v.tank_cert_expiry_date && new Date(v.tank_cert_expiry_date) < thirtyDaysFromNow) expiries.push('Tank Cert');
        
        if (expiries.length > 0) {
          newAlerts.push({
            id: `exp_v_${v.vehicle_id}`,
            type: "CRITICAL",
            title: "Document Expiry Warning",
            message: `${v.vehicle_number} has expiring documents: ${expiries.join(', ')}`,
            timestamp: now,
            icon: "⚠️",
            color: "text-rose-600 bg-rose-50 border-rose-200"
          });
        }
      });

      drivers?.forEach(d => {
        if (d.expiry_date && new Date(d.expiry_date) < thirtyDaysFromNow) {
          newAlerts.push({
            id: `exp_d_${d.driver_id}`, type: "CRITICAL", title: "License Expiry",
            message: `${d.full_name}'s license is expiring soon.`,
            timestamp: now, icon: "💳", color: "text-rose-600 bg-rose-50 border-rose-200"
          });
        }
      });

      // 2. CHECK RECENT TRIP STATUSES (Last 24 Hours)
      const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString();
      const { data: trips } = await supabase
        .from('trips')
        .select('trip_id, trip_number, trip_status, trip_start_date, origin, destination, vehicles(vehicle_number)')
        .order('trip_start_date', { ascending: false })
        .limit(10);

      trips?.forEach((t: any) => {
        const vehData = Array.isArray(t.vehicles) ? t.vehicles[0] : t.vehicles;
        const vNum = vehData?.vehicle_number || "Truck";
        const tripDate = t.trip_start_date ? new Date(t.trip_start_date) : now;

        newAlerts.push({
          id: `trip_${t.trip_id}_${t.trip_status}`,
          type: "TRIP",
          title: `Trip Status: ${String(t.trip_status || '').replace(/_/g, ' ')}`,
          message: `${vNum} | ${t.origin || 'Origin'} ➔ ${t.destination || 'Dest'}`,
          timestamp: tripDate,
          icon: "🚚",
          color: "text-blue-700 bg-blue-50 border-blue-200"
        });
      });

      // 3. CHECK RECENT FUEL FILLS
      const { data: fuelLogs } = await supabase
        .from('diesel_fuel_logs')
        .select('fuel_log_id, fuel_date, litres_filled, vehicles(vehicle_number)')
        .order('fuel_date', { ascending: false })
        .limit(5);

      fuelLogs?.forEach((f: any) => {
        const vehData = Array.isArray(f.vehicles) ? f.vehicles[0] : f.vehicles;
        const vNum = vehData?.vehicle_number || "Truck";
        const fuelDate = f.fuel_date ? new Date(f.fuel_date) : now;

        newAlerts.push({
          id: `fuel_${f.fuel_log_id}`,
          type: "FUEL",
          title: "Fuel Filled",
          message: `${f.litres_filled}L added to ${vNum}`,
          timestamp: fuelDate,
          icon: "⛽",
          color: "text-emerald-700 bg-emerald-50 border-emerald-200"
        });
      });

      // Sort all alerts chronologically (newest first)
      newAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setAlerts(newAlerts);

      // Play sound if a NEW notification appeared that wasn't there before
      if (newAlerts.length > previousAlertCount.current && previousAlertCount.current !== 0) {
        playNotificationPing();
      }
      previousAlertCount.current = newAlerts.length;

    } catch (error) {
      console.error("Error fetching live alerts:", error);
    }
  };

  // Run immediately, then poll every 30 seconds
  useEffect(() => {
    fetchLiveAlerts();
    const intervalId = setInterval(fetchLiveAlerts, 30000); // 30 seconds
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl shadow-lg overflow-hidden flex flex-col h-[500px]">
      
      {/* HEADER */}
      <div className="bg-slate-900 p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="text-xl">🔔</span>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF5A00] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF5A00]"></span>
            </span>
          </div>
          <h3 className="text-white font-black uppercase text-sm tracking-wider">Live Radar</h3>
        </div>
        
        <button 
          onClick={() => setIsMuted(!isMuted)} 
          className="text-slate-400 hover:text-white transition-colors"
          title={isMuted ? "Unmute Alerts" : "Mute Alerts"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* ALERT LIST */}
      <div className="overflow-y-auto p-4 space-y-3 flex-1 bg-slate-50/50">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <span className="text-3xl mb-2">✨</span>
            <p className="text-xs font-bold uppercase tracking-wider">No active alerts</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className={`p-3 rounded-2xl border flex gap-3 shadow-sm animate-in slide-in-from-right-4 duration-300 ${alert.color}`}>
              <div className="text-2xl mt-0.5">{alert.icon}</div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="text-[11px] font-black uppercase tracking-wider">{alert.title}</h4>
                  <span className="text-[9px] font-bold opacity-70 whitespace-nowrap ml-2">{timeAgo(alert.timestamp)}</span>
                </div>
                <p className="text-xs font-semibold leading-relaxed opacity-90">{alert.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
      
    </div>
  );
}
