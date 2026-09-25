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
  const [vendors, setVendors] = useState<any[]>([]);

  // Form states for Vendors
  const [vendorName, setVendorName] = useState("");
  const [vendorType, setVendorType] = useState("GENERAL");
  const [vendorSubcategory, setVendorSubcategory] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [vendorTaxNumber, setVendorTaxNumber] = useState("");
  const [vendorActive, setVendorActive] = useState(true);
  const [editVendorId, setEditVendorId] = useState<string | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");

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
    const [tRes, dRes, destRes, bRes, uRes, vRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('vehicle_number'),
      supabase.from('drivers').select('*').order('full_name'),
      supabase.from('destinations_freight_master').select('*').order('destination_name'),
      supabase.from('driver_bata_master').select('*').order('destination_name'),
      supabase.from('app_users').select('*').order('username'),
      supabase.from('vendors').select('*').order('vendor_name')
    ]);

    if (tRes.data) setTrucks(tRes.data);
    if (dRes.data) setDrivers(dRes.data);
    if (destRes.data) setDestinations(destRes.data);
    if (bRes.data) setBataRules(bRes.data);
    if (uRes.data) setAppUsers(uRes.data);
    if (vRes.data) setVendors(vRes.data);
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


  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vendorName.trim()) {
      return alert("Please enter vendor name.");
    }

    if (!vendorType) {
      return alert("Please select vendor category.");
    }

    const payload = {
      p_vendor_name: vendorName.trim(),
      p_vendor_type: vendorType,
      p_vendor_subcategory: vendorSubcategory.trim() || null,
      p_phone_number: vendorPhone.trim() || null,
      p_email: vendorEmail.trim() || null,
      p_address: vendorAddress.trim() || null,
      p_tax_number: vendorTaxNumber.trim() || null,
    };

    if (editVendorId) {
      const { error } = await supabase.rpc("update_vendor_atomic", {
        p_vendor_id: Number(editVendorId),
        ...payload,
        p_is_active: vendorActive,
      });

      if (error) {
        return alert("Failed to update vendor: " + error.message);
      }

      alert("Vendor updated successfully!");
    } else {
      const { error } = await supabase.rpc("create_vendor_atomic", payload);

      if (error) {
        return alert("Failed to create vendor: " + error.message);
      }

      alert("Vendor registered successfully!");
    }

    setVendorName("");
    setVendorType("GENERAL");
    setVendorSubcategory("");
    setVendorPhone("");
    setVendorEmail("");
    setVendorAddress("");
    setVendorTaxNumber("");
    setVendorActive(true);
    setEditVendorId(null);
    fetchData();
  };

  const subTabs = ["Trucks", "Drivers", "Vendors", "Freight Slabs", "Bata", "User Control"];

  const filteredVendors = vendors.filter((v) =>
    (v.vendor_name || "").toLowerCase().includes(vendorSearch.toLowerCase()) ||
    (v.vendor_type || "").toLowerCase().includes(vendorSearch.toLowerCase()) ||
    (v.vendor_subcategory || "").toLowerCase().includes(vendorSearch.toLowerCase()) ||
    (v.phone_number || "").toLowerCase().includes(vendorSearch.toLowerCase())
  );

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
                    <TableRow key={t.vehicle_id} className="hover:bg-surface-raised/50 transition-colors">
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
                    <TableRow key={d.driver_id} className="hover:bg-surface-raised/50 transition-colors">
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

      {activeSubTab === "Vendors" && (
        <div className="space-y-6">
          <div className="liquid-glass p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-xs font-bold text-fg tracking-wider">
                  {editVendorId ? "Edit Vendor Record" : "Register New Vendor"}
                </h3>
                <p className="text-[10px] text-fg-muted mt-1">
                  Central supplier and service-provider master for tyres, workshop, fuel, parts, and accounts.
                </p>
              </div>

              {editVendorId && (
                <Button
                  type="button"
                  variant="glass"
                  size="xs"
                  onClick={() => {
                    setVendorName("");
                    setVendorType("GENERAL");
                    setVendorSubcategory("");
                    setVendorPhone("");
                    setVendorEmail("");
                    setVendorAddress("");
                    setVendorTaxNumber("");
                    setVendorActive(true);
                    setEditVendorId(null);
                  }}
                >
                  Cancel Edit
                </Button>
              )}
            </div>

            <form onSubmit={handleSaveVendor} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-accent mb-1.5 uppercase tracking-wider">
                    Vendor Name *
                  </label>
                  <Input
                    type="text"
                    maxLength={200}
                    value={vendorName}
                    onChange={e => setVendorName(e.target.value)}
                    placeholder="e.g. ABC Tyres"
                    className="input-glass"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">
                    Category *
                  </label>
                  <Select value={vendorType} onChange={e => setVendorType(e.target.value)}>
                    <option value="TYRE">Tyre</option>
                    <option value="RETREAD">Retread</option>
                    <option value="WORKSHOP">Workshop</option>
                    <option value="AUTO_PARTS">Auto Parts</option>
                    <option value="DIESEL">Diesel / Fuel</option>
                    <option value="ADBLUE">AdBlue</option>
                    <option value="AUTO_ELECTRICAL">Auto Electrical</option>
                    <option value="BATTERY">Battery</option>
                    <option value="LUBRICANTS">Lubricants</option>
                    <option value="BODY_FABRICATION">Body / Fabrication</option>
                    <option value="TOWING_RECOVERY">Towing / Recovery</option>
                    <option value="FASTAG_TOLL">FASTag / Toll</option>
                    <option value="INSURANCE">Insurance</option>
                    <option value="PERMIT_COMPLIANCE">Permit / Compliance</option>
                    <option value="TRANSPORT_SERVICE">Transport Service</option>
                    <option value="GENERAL">General</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">
                    Subcategory
                  </label>
                  <Input
                    type="text"
                    maxLength={100}
                    value={vendorSubcategory}
                    onChange={e => setVendorSubcategory(e.target.value)}
                    placeholder="e.g. Brake & Suspension"
                    className="input-glass"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">
                    Phone
                  </label>
                  <Input
                    type="text"
                    maxLength={30}
                    value={vendorPhone}
                    onChange={e => setVendorPhone(e.target.value)}
                    className="input-glass font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">
                    Email
                  </label>
                  <Input
                    type="email"
                    maxLength={200}
                    value={vendorEmail}
                    onChange={e => setVendorEmail(e.target.value)}
                    className="input-glass"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">
                    GST / Tax Number
                  </label>
                  <Input
                    type="text"
                    maxLength={100}
                    value={vendorTaxNumber}
                    onChange={e => setVendorTaxNumber(e.target.value.toUpperCase())}
                    className="input-glass font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">
                  Address
                </label>
                <Input
                  type="text"
                  maxLength={500}
                  value={vendorAddress}
                  onChange={e => setVendorAddress(e.target.value)}
                  className="input-glass"
                />
              </div>

              {editVendorId && (
                <label className="flex items-center gap-2 text-xs text-fg-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vendorActive}
                    onChange={e => setVendorActive(e.target.checked)}
                    className="accent-accent"
                  />
                  Vendor is active
                </label>
              )}

              <Button type="submit" className="w-full mt-2">
                {editVendorId ? "Update Vendor" : "Register Vendor"}
              </Button>
            </form>
          </div>

          <div className="liquid-glass p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xs font-bold text-fg tracking-wider">
                  Vendor Directory ({vendors.length})
                </h3>
                <p className="text-[10px] text-fg-muted mt-1">
                  Vendors are shared across tyre, workshop, fuel, and accounts workflows.
                </p>
              </div>

              <Input
                type="search"
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
                placeholder="Search vendor, category, phone..."
                className="input-glass sm:max-w-xs"
              />
            </div>

            <div className="overflow-x-auto">
              <Table className="min-w-full divide-y divide-border text-xs">
                <TableHeader>
                  <TableRow className="text-left font-bold text-fg-muted uppercase tracking-wider text-[9px]">
                    <TableHead className="px-4 py-3">Vendor</TableHead>
                    <TableHead className="px-4 py-3">Category</TableHead>
                    <TableHead className="px-4 py-3">Subcategory</TableHead>
                    <TableHead className="px-4 py-3">Phone</TableHead>
                    <TableHead className="px-4 py-3">Tax No.</TableHead>
                    <TableHead className="px-4 py-3">Status</TableHead>
                    <TableHead className="px-4 py-3 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="divide-y divide-border">
                  {filteredVendors.map(v => (
                    <TableRow key={v.vendor_id} className="hover:bg-surface-raised/50 transition-colors">
                      <TableCell className="px-4 py-3.5 font-bold text-fg">
                        {v.vendor_name}
                        {v.email && (
                          <div className="text-[9px] text-fg-muted font-normal mt-0.5">{v.email}</div>
                        )}
                      </TableCell>

                      <TableCell className="px-4 py-3.5">
                        <span className="px-2 py-1 rounded-md bg-accent-soft text-accent border border-accent-border text-[9px] font-bold">
                          {v.vendor_type}
                        </span>
                      </TableCell>

                      <TableCell className="px-4 py-3.5 text-fg-secondary">
                        {v.vendor_subcategory || "-"}
                      </TableCell>

                      <TableCell className="px-4 py-3.5 text-fg-secondary font-mono">
                        {v.phone_number || "-"}
                      </TableCell>

                      <TableCell className="px-4 py-3.5 text-fg-secondary font-mono">
                        {v.tax_number || "-"}
                      </TableCell>

                      <TableCell className="px-4 py-3.5">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-bold border ${
                          v.is_active
                            ? "bg-success-soft text-success border-border"
                            : "bg-surface-raised text-fg-muted border-border"
                        }`}>
                          {v.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </TableCell>

                      <TableCell className="px-4 py-3.5 text-right">
                        <Button
                          type="button"
                          onClick={() => {
                            setVendorName(v.vendor_name || "");
                            setVendorType(v.vendor_type || "GENERAL");
                            setVendorSubcategory(v.vendor_subcategory || "");
                            setVendorPhone(v.phone_number || "");
                            setVendorEmail(v.email || "");
                            setVendorAddress(v.address || "");
                            setVendorTaxNumber(v.tax_number || "");
                            setVendorActive(v.is_active !== false);
                            setEditVendorId(String(v.vendor_id));
                            setActiveSubTab("Vendors");
                          }}
                          variant="glass"
                          size="xs"
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredVendors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="p-10 text-center text-fg-muted font-medium">
                        No vendors found. Register the first vendor above.
                      </TableCell>
                    </TableRow>
                  )}
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
                  <TableRow key={d.destination_id} className="hover:bg-surface-raised/50 transition-colors">
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
                  <TableRow key={b.bata_rule_id} className="hover:bg-surface-raised/50 transition-colors">
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
                  <TableRow key={u.user_id} className="hover:bg-surface-raised/50 transition-colors">
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
