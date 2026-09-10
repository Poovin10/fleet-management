"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type NotificationItem = {
  id: string;
  type: "CRITICAL" | "TRIP" | "FUEL" | "APPROVAL";
  title: string;
  message: string;
  timestamp: Date;
  icon: string;
};

export function LiveAlertsWidget() {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const previousCount = useRef(0);

  // --- AUDIO SYNTHESIZER ---
  const playNotificationPing = () => {
    if (isMuted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(850, ctx.currentTime);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.log("Audio context blocked or not supported.");
    }
  };

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // --- FETCH RECENT NOTIFICATIONS ---
  const fetchNotifications = async () => {
    const newItems: NotificationItem[] = [];
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    try {
      // 1. EXPIRIES (Documents & Licenses)
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
          newItems.push({
            id: `exp_v_${v.vehicle_id}`,
            type: "CRITICAL",
            title: "Compliance Warning",
            message: `${v.vehicle_number} docs expiring: ${expiries.join(', ')}`,
            timestamp: now,
            icon: "⚠️"
          });
        }
      });

      drivers?.forEach(d => {
        if (d.expiry_date && new Date(d.expiry_date) < thirtyDaysFromNow) {
          newItems.push({
            id: `exp_d_${d.driver_id}`,
            type: "CRITICAL",
            title: "License Expiry",
            message: `${d.full_name}'s license is expiring soon.`,
            timestamp: now,
            icon: "💳"
          });
        }
      });

      // 2. BRAND NEW TRIPS (Last 10 mins)
      const tenMinutesAgo = new Date(now.getTime() - (10 * 60 * 1000)).toISOString();
      const { data: recentTrips } = await supabase
        .from('trips')
        .select('trip_id, trip_number, trip_start_date, origin, destination, vehicles(vehicle_number)')
        .gte('trip_start_date', tenMinutesAgo)
        .order('trip_start_date', { ascending: false });

      recentTrips?.forEach((t: any) => {
        const vehData = Array.isArray(t.vehicles) ? t.vehicles[0] : t.vehicles;
        const vNum = vehData?.vehicle_number || "Truck";
        const tripDate = t.trip_start_date ? new Date(t.trip_start_date) : now;

        newItems.push({
          id: `new_trip_${t.trip_id}`,
          type: "TRIP",
          title: "New Trip Dispatched",
          message: `${vNum} : ${t.origin || 'Origin'} ➔ ${t.destination || 'Dest'}`,
          timestamp: tripDate,
          icon: "🚀"
        });
      });

      // 3. BRAND NEW FUEL LOGS (Last 10 mins)
      const { data: recentFuel } = await supabase
        .from('diesel_fuel_logs')
        .select('fuel_log_id, fuel_date, litres_filled, vehicles(vehicle_number)')
        .gte('fuel_date', tenMinutesAgo.split('T')[0])
        .order('fuel_log_id', { ascending: false })
        .limit(3);

      recentFuel?.forEach((f: any) => {
        const vehData = Array.isArray(f.vehicles) ? f.vehicles[0] : f.vehicles;
        const vNum = vehData?.vehicle_number || "Truck";
        const fuelDate = f.fuel_date ? new Date(f.fuel_date) : now;

        newItems.push({
          id: `new_fuel_${f.fuel_log_id}`,
          type: "FUEL",
          title: "Fuel Logged",
          message: `${f.litres_filled}L added to ${vNum}`,
          timestamp: fuelDate,
          icon: "⛽"
        });
      });

      newItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setNotifications(newItems);

      // Audio notification if a brand new item arrived
      if (newItems.length > previousCount.current && previousCount.current !== 0) {
        playNotificationPing();
      }
      previousCount.current = newItems.length;

    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 30000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[500px]">
      
      {/* HEADER */}
      <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-base">🔔</span>
          <h3 className="text-slate-900 font-black uppercase text-xs tracking-wider">Notifications</h3>
          {notifications.length > 0 && (
            <span className="bg-[#FF5A00] text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              {notifications.length}
            </span>
          )}
        </div>
        
        <button 
          onClick={() => setIsMuted(!isMuted)} 
          className="text-slate-400 hover:text-slate-700 transition-colors text-sm"
          title={isMuted ? "Unmute Alerts" : "Mute Alerts"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* NOTIFICATIONS LIST (PILL STYLE) */}
      <div className="overflow-y-auto p-4 space-y-2.5 flex-1 bg-slate-50/40">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <span className="text-2xl mb-2">✨</span>
            <p className="text-[11px] font-bold uppercase tracking-wider">No new notifications</p>
          </div>
        ) : (
          notifications.map((item) => (
            <div 
              key={item.id} 
              className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-start gap-3 shadow-sm hover:border-[#FF5A00]/40 transition-all animate-in slide-in-from-right-4 duration-300"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-base shrink-0">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-black uppercase text-slate-900 tracking-tight truncate">
                    {item.title}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap ml-2">
                    {timeAgo(item.timestamp)}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-600 leading-snug break-words">
                  {item.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
