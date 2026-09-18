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
      supabase.from('trucks').select('*').order('vehicle_number'),
      supabase.from('drivers').select('*').order('full_name'),
      supabase.from('destinations_freight_master').select('*').order('destination_name'),
      supabase.from('driver_bata_master').select('*').order('destination_name'),
      supabase.from('app_users').select('*').order('username')
    ]);

    if (tRes.data) setTrucks(tRes.data);
    if (dRes.data) setDrivers(dRes.data);
    if (destRes.data) setDestinations(destRes.data);
    if (bRes.data) setBataRules(bRes.data);
    if (uRes.data) setAppUsers(uRes.data);
  };

  useEffect(() => {
    fetchData();
  }, [supabase]);

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
      await supabase.from('trucks').update(payload).eq('id', editTruckId);
      alert("Truck updated successfully!");
    } else {
      await supabase.from('trucks').insert([{ ...payload, current_status: "WAITING_FOR_LOAD" }]);
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
    <div className="space-y-6">
      <div className="border-b border-white/[0.06] pb-4">
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Master Database Configuration</h2>
        <p className="text-xs text-slate-400 font-medium mt-0.5">Manage enterprise assets, active fleet units, driver rosters, and operational rates.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/[0.06] pb-4">
        {subTabs.map((sub) => (
          <button
            key={sub}
            onClick={() => setActiveSubTab(sub)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === sub ? "bg-[#FF5A00] text-white shadow-[0_0_20px_rgba(255,90,0,0.3)] font-black" : "text-slate-400 hover:text-white hover:bg-white/[0.04]"}`}
          >
            {sub}
          </button>
        ))}
      </div>

      {activeSubTab === "Trucks" && (
        <div className="space-y-6">
          <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-xl max-w-xl">
            <h3 className="text-xs font-black text-white uppercase tracking-wider mb-4">{editTruckId ? "Edit Truck Record" : "Add New Fleet Truck"}</h3>
            <form onSubmit={handleSaveTruck} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">Truck No *</label>
                <input type="text" value={truckNo} onChange={e => setTruckNo(e.target.value)} placeholder="e.g. TN 56 F 0452" className="w-full text-xs p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] text-white font-black uppercase outline-none focus:border-[#FF5A00]" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">Variant</label>
                  <select value={truckType} onChange={e => setTruckType(e.target.value)} className="w-full text-xs p-3 rounded-xl border border-white/[0.08] bg-[#080A10] text-white font-bold outline-none focus:border-[#FF5A00]">
                    <option value="Bulks">Bulks</option><option value="16-Wheel Multi-Axle">16-Wheel Multi-Axle</option><option value="14-Wheel Heavy Duty">14-Wheel Heavy Duty</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">Capacity (MT)</label>
                  <select value={capacity} onChange={e => setCapacity(e.target.value)} className="w-full text-xs p-3 rounded-xl border border-white/[0.08] bg-[#080A10] text-white font-bold outline-none focus:border-[#FF5A00]">
                    <option value="30">30 MT</option><option value="35">35 MT</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-gradient-to-r from-[#FF5A00] to-[#E04F00] text-white font-black text-xs rounded-xl uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(255,90,0,0.3)] cursor-pointer">
                {editTruckId ? "Update Truck" : "Save Truck"}
              </button>
            </form>
          </div>

          <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-xl">
            <h3 className="text-xs font-black text-white uppercase tracking-wider mb-4">Registered Fleet ({trucks.length} Units)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/[0.06] text-xs">
                <thead className="bg-[#030407]"><tr className="text-left font-bold text-slate-400 uppercase tracking-wider text-[9px]"><th className="px-4 py-3">Truck No</th><th className="px-4 py-3">Variant</th><th className="px-4 py-3">Capacity</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {trucks.map(t => (
                    <tr key={t.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3.5 font-black text-white font-mono">{t.vehicle_number}</td>
                      <td className="px-4 py-3.5 text-slate-300 font-semibold">{t.truck_type}</td>
                      <td className="px-4 py-3.5 text-slate-300 font-mono">{t.carrying_capacity_tons} MT</td>
                      <td className="px-4 py-3.5"><span className="px-2 py-1 bg-emerald-950/40 text-emerald-400 rounded-md text-[9px] font-black uppercase font-mono">{t.current_status || "ACTIVE"}</span></td>
                      <td className="px-4 py-3.5 text-right">
                        <button onClick={() => { setTruckNo(t.vehicle_number); setTruckType(t.truck_type); setCapacity(String(t.carrying_capacity_tons)); setEditTruckId(t.id); }} className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-lg text-[10px] font-bold">Edit</button>
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
          <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-xl max-w-xl">
            <h3 className="text-xs font-black text-white uppercase tracking-wider mb-4">{editDriverId ? "Edit Driver Record" : "Register New Driver"}</h3>
            <form onSubmit={handleSaveDriver} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">Full Name *</label>
                <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="e.g. Aneesh CR" className="w-full text-xs p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] text-white font-bold uppercase outline-none focus:border-[#FF5A00]" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">Phone Number</label>
                  <input type="text" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="10-digit mobile" className="w-full text-xs p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] text-white font-mono outline-none focus:border-[#FF5A00]" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase">License Expiry</label>
                  <input type="date" value={licenseExp} onChange={e => setLicenseExp(e.target.value)} className="w-full text-xs p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] text-white font-mono outline-none focus:border-[#FF5A00]" />
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-gradient-to-r from-[#FF5A00] to-[#E04F00] text-white font-black text-xs rounded-xl uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(255,90,0,0.3)] cursor-pointer">
                {editDriverId ? "Update Driver" : "Register Driver"}
              </button>
            </form>
          </div>

          <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-xl">
            <h3 className="text-xs font-black text-white uppercase tracking-wider mb-4">Active Driver Roster ({drivers.length} Drivers)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/[0.06] text-xs">
                <thead className="bg-[#030407]"><tr className="text-left font-bold text-slate-400 uppercase tracking-wider text-[9px]"><th className="px-4 py-3">Code</th><th className="px-4 py-3">Full Name</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">License Expiry</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {drivers.map(d => (
                    <tr key={d.driver_id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3.5 font-black text-[#FF5A00] font-mono">{d.driver_code}</td>
                      <td className="px-4 py-3.5 font-black text-white">{d.full_name}</td>
                      <td className="px-4 py-3.5 text-slate-300 font-mono">{d.phone_number || "-"}</td>
                      <td className="px-4 py-3.5 text-slate-300 font-mono">{d.license_expiry_date || "-"}</td>
                      <td className="px-4 py-3.5 text-right">
                        <button onClick={() => { setDriverName(d.full_name); setDriverPhone(d.phone_number || ""); setLicenseNo(d.license_number || ""); setLicenseExp(d.license_expiry_date || ""); setEditDriverId(d.driver_id); }} className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-lg text-[10px] font-bold">Edit</button>
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
        <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-xl">
          <h3 className="text-xs font-black text-white uppercase tracking-wider mb-4">Destinations & Freight Master Slabs ({destinations.length})</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/[0.06] text-xs">
              <thead className="bg-[#030407]"><tr className="text-left font-bold text-slate-400 uppercase tracking-wider text-[9px]"><th className="px-4 py-3">Destination</th><th className="px-4 py-3">Origin</th><th className="px-4 py-3 text-right">Rate / MT (₹)</th></tr></thead>
              <tbody className="divide-y divide-white/[0.05]">
                {destinations.map(d => (
                  <tr key={d.destination_id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3.5 font-black text-white uppercase">{d.destination_name}</td>
                    <td className="px-4 py-3.5 text-slate-300 uppercase">{d.origin || "COCHIN"}</td>
                    <td className="px-4 py-3.5 text-right font-black text-emerald-400 font-mono">₹{(Number(d.freight_rate_per_ton)||0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === "Bata" && (
        <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-xl">
          <h3 className="text-xs font-black text-white uppercase tracking-wider mb-4">Driver Bata Rules ({bataRules.length})</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/[0.06] text-xs">
              <thead className="bg-[#030407]"><tr className="text-left font-bold text-slate-400 uppercase tracking-wider text-[9px]"><th className="px-4 py-3">Destination</th><th className="px-4 py-3 text-right">Standard Bata (₹)</th></tr></thead>
              <tbody className="divide-y divide-white/[0.05]">
                {bataRules.map(b => (
                  <tr key={b.bata_rule_id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3.5 font-black text-white uppercase">{b.destination_name}</td>
                    <td className="px-4 py-3.5 text-right font-black text-[#FF5A00] font-mono">₹{(Number(b.standard_bata_inr)||0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === "User Control" && (
        <div className="bg-[#080A10]/80 backdrop-blur-xl border border-white/[0.06] rounded-3xl p-6 shadow-xl">
          <h3 className="text-xs font-black text-white uppercase tracking-wider mb-4">App Users & Roles ({appUsers.length})</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/[0.06] text-xs">
              <thead className="bg-[#030407]"><tr className="text-left font-bold text-slate-400 uppercase tracking-wider text-[9px]"><th className="px-4 py-3">Username / Email</th><th className="px-4 py-3">Role</th></tr></thead>
              <tbody className="divide-y divide-white/[0.05]">
                {appUsers.map(u => (
                  <tr key={u.user_id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3.5 font-black text-white font-mono">{u.username}</td>
                    <td className="px-4 py-3.5"><span className="px-2.5 py-1 bg-[#FF5A00]/10 text-[#FF5A00] border border-[#FF5A00]/20 rounded-md text-[9px] font-black uppercase font-mono">{u.role}</span></td>
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
