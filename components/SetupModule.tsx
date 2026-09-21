"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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
  const [editTruckId, setEditTruckId] = useState<string | null>(null);

  // Form states for Drivers
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [licenseExp, setLicenseExp] = useState("");
  const [editDriverId, setEditDriverId] = useState<string | null>(null);

  const fetchData = async () => {
    const [tRes, dRes, destRes, bRes, uRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('vehicle_number'),
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
  }, []);

  
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
      await supabase.from('vehicles').update(payload).eq('vehicle_id', editTruckId);
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
      const maxId = drivers.reduce((max, d) => {
        const numMatch = (d.driver_code || "").match(/\d+/);
        const num = numMatch ? parseInt(numMatch[0]) : 0;
        return Math.max(max, num);
      }, 0);
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
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-semibold text-fg tracking-tight">Master Database Configuration</h2>
        <p className="text-xs text-fg-secondary font-medium mt-0.5">Manage enterprise assets, active fleet units, driver rosters, and operational rates.</p>
      </div>

      <div className="flex flex-wrap gap-2.5 border-b border-border pb-4">
        {subTabs.map((sub) => (
          <Button
            key={sub}
            onClick={() => setActiveSubTab(sub)}
            variant={activeSubTab === sub ? "default" : "glass"}
            size="sm">
            {sub}
          </Button>
        ))}
      </div>

      {activeSubTab === "Trucks" && (
        <div className="space-y-6">
          <div className="liquid-glass p-6 shadow-xl max-w-xl">
            <h3 className="text-xs font-bold text-fg tracking-wider mb-4">{editTruckId ? "Edit Truck Record" : "Add New Fleet Truck"}</h3>
            <form onSubmit={handleSaveTruck} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-accent mb-1.5 uppercase tracking-wider">Truck No *</label>
                <Input type="text" value={truckNo} onChange={e => setTruckNo(e.target.value)} placeholder="e.g. TN 56 F 0452" className="input-glass" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">Variant</label>
                  <Select value={truckType} onChange={e => setTruckType(e.target.value)}>
                    <option value="Bulks">Bulks</option><option value="16-Wheel Multi-Axle">16-Wheel Multi-Axle</option><option value="14-Wheel Heavy Duty">14-Wheel Heavy Duty</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">Capacity (MT)</label>
                  <Select value={capacity} onChange={e => setCapacity(e.target.value)}>
                    <option value="30">30 MT</option><option value="35">35 MT</option>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full mt-2">
                {editTruckId ? "Update Truck" : "Save Truck"}
              </Button>
            </form>
          </div>

          <div className="liquid-glass p-6 shadow-xl">
            <h3 className="text-xs font-bold text-fg tracking-wider mb-4">Registered Fleet ({trucks.length} Units)</h3>
            <div className="overflow-x-auto">
              <Table className="min-w-full divide-y divide-border text-xs">
                <TableHeader><TableRow className="text-left font-bold text-fg-muted uppercase tracking-wider text-[9px]"><TableHead className="px-4 py-3">Truck No</TableHead><TableHead className="px-4 py-3">Variant</TableHead><TableHead className="px-4 py-3">Capacity</TableHead><TableHead className="px-4 py-3">Status</TableHead><TableHead className="px-4 py-3 text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody className="divide-y divide-border">
                  {trucks.map(t => (
                    <TableRow key={t.vehicle_id} className="hover:bg-white/[0.02] transition-colors">
                      <TableCell className="px-4 py-3.5 font-bold text-fg font-mono">{t.vehicle_number}</TableCell>
                      <TableCell className="px-4 py-3.5 text-fg-secondary font-semibold">{t.truck_type}</TableCell>
                      <TableCell className="px-4 py-3.5 text-fg-secondary font-mono">{t.carrying_capacity_tons} MT</TableCell>
                      <TableCell className="px-4 py-3.5"><span className="px-2.5 py-1 bg-success-soft text-success border border-border rounded-md text-[9px] font-bold font-mono uppercase">{t.current_status || "ACTIVE"}</span></TableCell>
                      <TableCell className="px-4 py-3.5 text-right">
                        <Button onClick={() => { setTruckNo(t.vehicle_number); setTruckType(t.truck_type); setCapacity(String(t.carrying_capacity_tons)); setEditTruckId(t.vehicle_id); }} variant="glass" size="xs">Edit</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "Drivers" && (
        <div className="space-y-6">
          <div className="liquid-glass p-6 shadow-xl max-w-xl">
            <h3 className="text-xs font-bold text-fg tracking-wider mb-4">{editDriverId ? "Edit Driver Record" : "Register New Driver"}</h3>
            <form onSubmit={handleSaveDriver} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-accent mb-1.5 uppercase tracking-wider">Full Name *</label>
                <Input type="text" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="e.g. Aneesh CR" className="input-glass" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">Phone Number</label>
                  <Input type="text" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="10-digit mobile" className={`input-glass font-mono`} />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">License Expiry</label>
                  <Input type="date" value={licenseExp} onChange={e => setLicenseExp(e.target.value)} className={`input-glass font-mono`} />
                </div>
              </div>
              <Button type="submit" className="w-full mt-2">
                {editDriverId ? "Update Driver" : "Register Driver"}
              </Button>
            </form>
          </div>

          <div className="liquid-glass p-6 shadow-xl">
            <h3 className="text-xs font-bold text-fg tracking-wider mb-4">Active Driver Roster ({drivers.length} Drivers)</h3>
            <div className="overflow-x-auto">
              <Table className="min-w-full divide-y divide-border text-xs">
                <TableHeader><TableRow className="text-left font-bold text-fg-muted uppercase tracking-wider text-[9px]"><TableHead className="px-4 py-3">Code</TableHead><TableHead className="px-4 py-3">Full Name</TableHead><TableHead className="px-4 py-3">Phone</TableHead><TableHead className="px-4 py-3">License Expiry</TableHead><TableHead className="px-4 py-3 text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody className="divide-y divide-border">
                  {drivers.map(d => (
                    <TableRow key={d.driver_id} className="hover:bg-white/[0.02] transition-colors">
                      <TableCell className="px-4 py-3.5 font-bold text-accent font-mono">{d.driver_code}</TableCell>
                      <TableCell className="px-4 py-3.5 font-bold text-fg">{d.full_name}</TableCell>
                      <TableCell className="px-4 py-3.5 text-fg-secondary font-mono">{d.phone_number || "-"}</TableCell>
                      <TableCell className="px-4 py-3.5 text-fg-secondary font-mono">{d.license_expiry_date || "-"}</TableCell>
                      <TableCell className="px-4 py-3.5 text-right">
                        <Button onClick={() => { setDriverName(d.full_name); setDriverPhone(d.phone_number || ""); setLicenseNo(d.license_number || ""); setLicenseExp(d.license_expiry_date || ""); setEditDriverId(d.driver_id); }} variant="glass" size="xs">Edit</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "Freight Slabs" && (
        <div className="liquid-glass p-6 shadow-xl">
          <h3 className="text-xs font-bold text-fg tracking-wider mb-4">Destinations & Freight Master Slabs ({destinations.length})</h3>
          <div className="overflow-x-auto">
            <Table className="min-w-full divide-y divide-border text-xs">
              <TableHeader><TableRow className="text-left font-bold text-fg-muted uppercase tracking-wider text-[9px]"><TableHead className="px-4 py-3">Destination</TableHead><TableHead className="px-4 py-3">Origin</TableHead><TableHead className="px-4 py-3 text-right">Rate / MT (₹)</TableHead></TableRow></TableHeader>
              <TableBody className="divide-y divide-border">
                {destinations.map((d) => (
                  <TableRow key={d.destination_id} className="hover:bg-white/[0.02] transition-colors">
                    <TableCell className="px-4 py-3.5 font-bold text-fg">{d.destination_name}</TableCell>
                    <TableCell className="px-4 py-3.5 text-fg-secondary">{d.origin || "COCHIN"}</TableCell>
                    <TableCell className="px-4 py-3.5 text-right font-bold text-success font-mono">{(Number(d.freight_rate_per_ton)||0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {activeSubTab === "Bata" && (
        <div className="liquid-glass p-6 shadow-xl">
          <h3 className="text-xs font-bold text-fg tracking-wider mb-4">Driver Bata Rules ({bataRules.length})</h3>
          <div className="overflow-x-auto">
            <Table className="min-w-full divide-y divide-border text-xs">
              <TableHeader><TableRow className="text-left font-bold text-fg-muted uppercase tracking-wider text-[9px]"><TableHead className="px-4 py-3">Destination</TableHead><TableHead className="px-4 py-3 text-right">Standard Bata (₹)</TableHead></TableRow></TableHeader>
              <TableBody className="divide-y divide-border">
                {bataRules.map((b) => (
                  <TableRow key={b.bata_rule_id} className="hover:bg-white/[0.02] transition-colors">
                    <TableCell className="px-4 py-3.5 font-bold text-fg">{b.destination_name || "Unknown"}</TableCell>
                    <TableCell className="px-4 py-3.5 text-right font-bold text-accent font-mono">{(Number(b.standard_bata_inr)||0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {activeSubTab === "User Control" && (
        <div className="liquid-glass p-6 shadow-xl">
          <h3 className="text-xs font-bold text-fg tracking-wider mb-4">App Users & Roles ({appUsers.length})</h3>
          <div className="overflow-x-auto">
            <Table className="min-w-full divide-y divide-border text-xs">
              <TableHeader><TableRow className="text-left font-bold text-fg-muted uppercase tracking-wider text-[9px]"><TableHead className="px-4 py-3">Username / Email</TableHead><TableHead className="px-4 py-3">Role</TableHead></TableRow></TableHeader>
              <TableBody className="divide-y divide-border">
                {appUsers.map((u) => (
                  <TableRow key={u.user_id} className="hover:bg-white/[0.02] transition-colors">
                    <TableCell className="px-4 py-3.5 font-bold text-fg font-mono">{u.username || "-"}</TableCell>
                    <TableCell className="px-4 py-3.5"><span className="px-2.5 py-1 bg-accent-soft text-accent border border-accent rounded-md text-[9px] font-bold font-mono uppercase">{u.role || "USER"}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
