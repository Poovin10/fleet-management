"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function SetupModule() {
  const supabase = createClient();
  const [activeSubTab, setActiveSubTab] = useState("Trucks");

  const [trucks, setTrucks] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [bataRules, setBataRules] = useState<any[]>([]);
  const [appUsers, setAppUsers] = useState<any[]>([]);

  // Form states for Trucks
  const [truckNo, setTruckNo] = useState("");
  const [truckType, setTruckType] = useState("Bulks");
  const [capacity, setCapacity] = useState("35");
  const [editTruckId, setEditTruckId] = useState<number | null>(null);

  // Form states for Drivers
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [licenseExp, setLicenseExp] = useState("");
  const [editDriverId, setEditDriverId] = useState<number | null>(null);

  const fetchData = async () => {
    const [tRes, dRes, destRes, bRes, uRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('vehicle_number'),
      supabase.from('drivers').select('*').order('full_name'),
      supabase.from('destinations_freight_master').select('*'),
      supabase.from('driver_bata_master').select('*'),
      supabase.from('app_users').select('*')
    ]);

    if (tRes.data) setTrucks(tRes.data);
    if (dRes.data) setDrivers(dRes.data);
    if (destRes.data) setDestinations(destRes.data);
    if (bRes.data) setBataRules(bRes.data);
    if (uRes.data) setAppUsers(uRes.data);
  };

  // FIXED: Removed `supabase` dependency to kill the infinite re-render loop
  useEffect(() => {
    fetchData();
  }, []);

  const compactInput = "w-full bg-white/[0.02] border border-white/[0.08] rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:border-[#FF9F0A]/50 focus:bg-white/[0.05] transition-all outline-none font-medium ios-spring";

  const handleSaveTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckNo.trim()) return alert("Please enter a truck number.");
    const payload = {
      vehicle_number: truckNo.toUpperCase().trim(),
      truck_type: truckType,
      carrying_capacity_tons: parseFloat(capacity) || 35.00,
      is_active: true
    };

    if (editTruckId) {
      await supabase.from('vehicles').update(payload).eq('id', editTruckId);
      alert("Truck updated successfully!");
    } else {
      await supabase.from('vehicles').insert([{ ...payload, current_status: "WAITING_FOR_LOAD" }]);
      alert("New truck registered successfully!");
    }
    setTruckNo(""); setEditTruckId(null); fetchData();
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim()) return alert("Please enter driver name.");

    let autoGenCode = "DRV-001";
    if (drivers.length > 0) {
      const maxId = drivers.reduce((max, d) => Math.max(max, Number(d.driver_id) || 0), 0);
      autoGenCode = `DRV-${String(maxId + 1).padStart(3, '0')}`;
    }

    const payload = {
      full_name: driverName.toUpperCase().trim(),
      phone_number: driverPhone,
      license_number: licenseNo,
      license_expiry_date: licenseExp || null,
      is_active: true
    };

    if (editDriverId) {
      await supabase.from('drivers').update(payload).eq('driver_id', editDriverId);
      alert("Driver updated successfully!");
    } else {
      await supabase.from('drivers').insert([{ ...payload, driver_code: autoGenCode, pin: "1234" }]);
      alert(`Driver registered successfully with code ${autoGenCode}!`);
    }
    setDriverName(""); setDriverPhone(""); setLicenseNo(""); setLicenseExp(""); setEditDriverId(null); fetchData();
  };

  const subTabs = ["Trucks", "Drivers", "Freight Slabs", "Bata", "User Control"];

  return (
    <div className="animate-tab-focus space-y-6">
      <div className="border-b border-white/[0.06] pb-4">
        <h2 className="text-xl font-semibold text-white tracking-tight">Master Database Configuration</h2>
        <p className="text-xs text-white/60 font-medium mt-0.5">Manage enterprise assets, active fleet units, driver rosters, and operational rates.</p>
      </div>

      <div className="flex flex-wrap gap-2.5 border-b border-white/[0.06] pb-4">
        {subTabs.map((sub) => (
          <button
            key={sub}
            onClick={() => setActiveSubTab(sub)}
            className={`px-5 py-2 rounded-full text-[11px] font-bold transition-all ios-spring ${activeSubTab === sub ? "bg-[#FF9F0A] text-black shadow-[0_0_15px_rgba(255,159,10,0.3)]" : "text-white/60 bg-white/[0.02] border border-white/[0.06] hover:text-white hover:bg-white/[0.08]"}`}
          >
            {sub}
          </button>
        ))}
      </div>

      {activeSubTab === "Trucks" && (
        <div className="space-y-6">
          <div className="liquid-glass border border-white/[0.04] rounded-[32px] p-6 shadow-xl max-w-xl">
            <h3 className="text-xs font-bold text-white tracking-wider mb-4">{editTruckId ? "Edit Truck Record" : "Add New Fleet Truck"}</h3>
            <form onSubmit={handleSaveTruck} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-[#FF9F0A] mb-1.5 uppercase tracking-wider">Truck No *</label>
                <input type="text" value={truckNo} onChange={e => setTruckNo(e.target.value)} placeholder="e.g. TN 56 F 0452" className={compactInput} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-white/60 mb-1.5 uppercase tracking-wider">Variant</label>
                  <select value={truckType} onChange={e => setTruckType(e.target.value)} className={`${compactInput} bg-[#020203]`}>
                    <option value="Bulks">Bulks</option><option value="16-Wheel Multi-Axle">16-Wheel Multi-Axle</option><option value="14-Wheel Heavy Duty">14-Wheel Heavy Duty</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-white/60 mb-1.5 uppercase tracking-wider">Capacity (MT)</label>
                  <select value={capacity} onChange={e => setCapacity(e.target.value)} className={`${compactInput} bg-[#020203]`}>
                    <option value="30">30 MT</option><option value="35">35 MT</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-3 btn-orange-glow text-xs font-bold rounded-full tracking-wide transition-all ios-spring shadow-[0_0_15px_rgba(255,159,10,0.3)] mt-2">
                {editTruckId ? "Update Truck" : "Save Truck"}
              </button>
            </form>
          </div>

          <div className="liquid-glass border border-white/[0.04] rounded-[32px] p-6 shadow-xl">
            <h3 className="text-xs font-bold text-white tracking-wider mb-4">Registered Fleet ({trucks.length} Units)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/[0.06] text-xs">
                <thead><tr className="text-left font-bold text-white/50 uppercase tracking-wider text-[9px]"><th className="px-4 py-3">Truck No</th><th className="px-4 py-3">Variant</th><th className="px-4 py-3">Capacity</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {trucks.map(t => (
                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5 font-bold text-white font-mono">{t.vehicle_number}</td>
                      <td className="px-4 py-3.5 text-white/70 font-semibold">{t.truck_type}</td>
                      <td className="px-4 py-3.5 text-white/70 font-mono">{t.carrying_capacity_tons} MT</td>
                      <td className="px-4 py-3.5"><span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[9px] font-bold font-mono uppercase">{t.current_status || "ACTIVE"}</span></td>
                      <td className="px-4 py-3.5 text-right">
                        <button onClick={() => { setTruckNo(t.vehicle_number); setTruckType(t.truck_type); setCapacity(String(t.carrying_capacity_tons)); setEditTruckId(t.id); }} className="px-4 py-1.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-white rounded-full text-[10px] font-bold transition-all ios-spring">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "Drivers" && (
        <div className="space-y-6">
          <div className="liquid-glass border border-white/[0.04] rounded-[32px] p-6 shadow-xl max-w-xl">
            <h3 className="text-xs font-bold text-white tracking-wider mb-4">{editDriverId ? "Edit Driver Record" : "Register New Driver"}</h3>
            <form onSubmit={handleSaveDriver} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-[#FF9F0A] mb-1.5 uppercase tracking-wider">Full Name *</label>
                <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="e.g. Aneesh CR" className={compactInput} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-white/60 mb-1.5 uppercase tracking-wider">Phone Number</label>
                  <input type="text" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="10-digit mobile" className={`${compactInput} font-mono`} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-white/60 mb-1.5 uppercase tracking-wider">License Expiry</label>
                  <input type="date" value={licenseExp} onChange={e => setLicenseExp(e.target.value)} className={`${compactInput} font-mono`} />
                </div>
              </div>
              <button type="submit" className="w-full py-3 btn-orange-glow text-xs font-bold rounded-full tracking-wide transition-all ios-spring shadow-[0_0_15px_rgba(255,159,10,0.3)] mt-2">
                {editDriverId ? "Update Driver" : "Register Driver"}
              </button>
            </form>
          </div>

          <div className="liquid-glass border border-white/[0.04] rounded-[32px] p-6 shadow-xl">
            <h3 className="text-xs font-bold text-white tracking-wider mb-4">Active Driver Roster ({drivers.length} Drivers)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/[0.06] text-xs">
                <thead><tr className="text-left font-bold text-white/50 uppercase tracking-wider text-[9px]"><th className="px-4 py-3">Code</th><th className="px-4 py-3">Full Name</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">License Expiry</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {drivers.map(d => (
                    <tr key={d.driver_id || d.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5 font-bold text-[#FF9F0A] font-mono">{d.driver_code}</td>
                      <td className="px-4 py-3.5 font-bold text-white">{d.full_name}</td>
                      <td className="px-4 py-3.5 text-white/70 font-mono">{d.phone_number || "-"}</td>
                      <td className="px-4 py-3.5 text-white/70 font-mono">{d.license_expiry_date || "-"}</td>
                      <td className="px-4 py-3.5 text-right">
                        <button onClick={() => { setDriverName(d.full_name); setDriverPhone(d.phone_number || ""); setLicenseNo(d.license_number || ""); setLicenseExp(d.license_expiry_date || ""); setEditDriverId(d.driver_id); }} className="px-4 py-1.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-white rounded-full text-[10px] font-bold transition-all ios-spring">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "Freight Slabs" && (
        <div className="liquid-glass border border-white/[0.04] rounded-[32px] p-6 shadow-xl">
          <h3 className="text-xs font-bold text-white tracking-wider mb-4">Destinations & Freight Master Slabs ({destinations.length})</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/[0.06] text-xs">
              <thead><tr className="text-left font-bold text-white/50 uppercase tracking-wider text-[9px]"><th className="px-4 py-3">Destination</th><th className="px-4 py-3">Origin</th><th className="px-4 py-3 text-right">Rate / MT (₹)</th></tr></thead>
              <tbody className="divide-y divide-white/[0.05]">
                {destinations.map((d, i) => (
                  <tr key={d.id || d.destination_id || i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5 font-bold text-white">{d.destination_name}</td>
                    <td className="px-4 py-3.5 text-white/70">{d.origin || "COCHIN"}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-emerald-400 font-mono">{(Number(d.freight_rate_per_ton)||0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === "Bata" && (
        <div className="liquid-glass border border-white/[0.04] rounded-[32px] p-6 shadow-xl">
          <h3 className="text-xs font-bold text-white tracking-wider mb-4">Driver Bata Rules ({bataRules.length})</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/[0.06] text-xs">
              <thead><tr className="text-left font-bold text-white/50 uppercase tracking-wider text-[9px]"><th className="px-4 py-3">Destination</th><th className="px-4 py-3 text-right">Standard Bata (₹)</th></tr></thead>
              <tbody className="divide-y divide-white/[0.05]">
                {bataRules.map((b, i) => (
                  <tr key={b.id || b.bata_rule_id || i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5 font-bold text-white">{b.destination_name || b.destination || "Unknown"}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-[#FF9F0A] font-mono">{(Number(b.standard_bata_inr || b.bata_amount)||0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === "User Control" && (
        <div className="liquid-glass border border-white/[0.04] rounded-[32px] p-6 shadow-xl">
          <h3 className="text-xs font-bold text-white tracking-wider mb-4">App Users & Roles ({appUsers.length})</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/[0.06] text-xs">
              <thead><tr className="text-left font-bold text-white/50 uppercase tracking-wider text-[9px]"><th className="px-4 py-3">Username / Email</th><th className="px-4 py-3">Role</th></tr></thead>
              <tbody className="divide-y divide-white/[0.05]">
                {appUsers.map((u, i) => (
                  <tr key={u.id || u.user_id || i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5 font-bold text-white font-mono">{u.username || u.email}</td>
                    <td className="px-4 py-3.5"><span className="px-2.5 py-1 bg-[#FF9F0A]/10 text-[#FF9F0A] border border-[#FF9F0A]/20 rounded-md text-[9px] font-bold font-mono uppercase">{u.role || "USER"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
