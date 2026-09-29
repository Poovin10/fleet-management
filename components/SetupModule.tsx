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
  const [masterOverlay, setMasterOverlay] = useState<"form" | "list" | null>(null);

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
  const [grossWeight, setGrossWeight] = useState("0");
  const [odometerWorking, setOdometerWorking] = useState(true);
  const [truckActive, setTruckActive] = useState(true);
  const [fcExpiry, setFcExpiry] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [qtaxExpiry, setQtaxExpiry] = useState("");
  const [pucExpiry, setPucExpiry] = useState("");
  const [npExpiry, setNpExpiry] = useState("");
  const [statePermitExpiry, setStatePermitExpiry] = useState("");
  const [tankCertExpiry, setTankCertExpiry] = useState("");
  const [editTruckId, setEditTruckId] = useState<string | null>(null);
  const [truckSearch, setTruckSearch] = useState("");
  const [truckPage, setTruckPage] = useState(1);

  // Form states for Drivers
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [licenseExp, setLicenseExp] = useState("");
  const [driverBranchId, setDriverBranchId] = useState("1");
  const [driverPin, setDriverPin] = useState("");
  const [driverActive, setDriverActive] = useState(true);
  const [editDriverId, setEditDriverId] = useState<string | null>(null);

  // Form states for Freight Slabs
  const [freightCargoType, setFreightCargoType] = useState("BULK");
  const [freightOrigin, setFreightOrigin] = useState("");
  const [freightDestination, setFreightDestination] = useState("");
  const [freightCapacity, setFreightCapacity] = useState("35");
  const [freightRate, setFreightRate] = useState("");
  const [freightStandardKm, setFreightStandardKm] = useState("0");
  const [freightCargoCategory, setFreightCargoCategory] = useState("");
  const [freightMinTolerance, setFreightMinTolerance] = useState("10");
  const [freightMaxTolerance, setFreightMaxTolerance] = useState("10");
  const [freightActive, setFreightActive] = useState(true);
  const [editFreightId, setEditFreightId] = useState<string | null>(null);

  // Form states for Bata
  const [bataDestination, setBataDestination] = useState("");
  const [bataCargoType, setBataCargoType] = useState("BULK");
  const [bataVehicleId, setBataVehicleId] = useState("");
  const [bataCapacity, setBataCapacity] = useState("");
  const [bataAmount, setBataAmount] = useState("0");
  const [bataOrigin, setBataOrigin] = useState("ALL");
  const [editBataId, setEditBataId] = useState<string | null>(null);

  const fetchData = async () => {
    const [tRes, dRes, destRes, bRes, uRes, vRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('vehicle_number'),
      supabase.from('drivers').select('*').order('full_name'),
      supabase.from('destinations_freight_master').select('*').order('destination_name'),
      supabase.from('driver_bata_master').select('*').order('destination_name'),
      supabase.rpc('get_manageable_app_users'),
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

  
  const openMasterForm = (sub: string) => {    setActiveSubTab(sub);    if (sub === "Trucks") resetTruckForm();    if (sub === "Drivers") resetDriverForm();    if (sub === "Vendors") {      setVendorName("");      setVendorType("GENERAL");      setVendorSubcategory("");      setVendorPhone("");      setVendorEmail("");      setVendorAddress("");      setVendorTaxNumber("");      setVendorActive(true);      setEditVendorId(null);    }    if (sub === "Freight Slabs") resetFreightForm();    if (sub === "Bata") resetBataForm();    setMasterOverlay("form");  };  const resetTruckForm = () => {
    setTruckNo("");
    setTruckType("Bulks");
    setCapacity("35");
    setGrossWeight("0");
    setOdometerWorking(true);
    setTruckActive(true);
    setFcExpiry("");
    setInsuranceExpiry("");
    setQtaxExpiry("");
    setPucExpiry("");
    setNpExpiry("");
    setStatePermitExpiry("");
    setTankCertExpiry("");
    setEditTruckId(null);
  };

  const handleSaveTruck = async (e: React.FormEvent) => {
    e.preventDefault();

    const vehicleNumber = truckNo.toUpperCase().trim();
    const carryingCapacity = Number(capacity);
    const grossVehicleWeight = Number(grossWeight) || 0;

    if (!vehicleNumber) return alert("Please enter a truck number.");
    if (!Number.isFinite(carryingCapacity) || carryingCapacity <= 0) {
      return alert("Please enter a valid carrying capacity.");
    }
    if (grossVehicleWeight < 0) {
      return alert("Gross vehicle weight cannot be negative.");
    }

    const commonPayload = {
      p_vehicle_number: vehicleNumber,
      p_truck_type: truckType,
      p_carrying_capacity_tons: carryingCapacity,
      p_gross_vehicle_weight_tons: grossVehicleWeight,
      p_fc_expiry_date: fcExpiry || null,
      p_insurance_expiry_date: insuranceExpiry || null,
      p_qtax_expiry_date: qtaxExpiry || null,
      p_puc_expiry_date: pucExpiry || null,
      p_np_expiry_date: npExpiry || null,
      p_state_permit_expiry_date: statePermitExpiry || null,
      p_tank_cert_expiry_date: tankCertExpiry || null,
    };

    if (editTruckId) {
      const { error } = await supabase.rpc("update_master_vehicle", {
        p_vehicle_id: Number(editTruckId),
        ...commonPayload,
        p_is_active: truckActive,
        p_odometer_working: odometerWorking,
      });

      if (error) {
        return alert("Failed to update truck: " + error.message);
      }

      alert("Truck updated successfully!");
    } else {
      const { error } = await supabase.rpc("create_master_vehicle", commonPayload);

      if (error) {
        return alert("Failed to register truck: " + error.message);
      }

      alert("New truck registered successfully!");
    }

    resetTruckForm();
    await fetchData();
  };

  const resetDriverForm = () => {
    setDriverName("");
    setDriverPhone("");
    setLicenseNo("");
    setLicenseExp("");
    setDriverBranchId("1");
    setDriverPin("");
    setDriverActive(true);
    setEditDriverId(null);
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();

    const fullName = driverName.toUpperCase().trim();
    const phone = driverPhone.trim();
    const license = licenseNo.trim();
    const branchId = Number(driverBranchId);

    if (!fullName) return alert("Please enter driver name.");
    if (!license) return alert("Please enter license number.");
    if (!Number.isInteger(branchId) || branchId <= 0) {
      return alert("Please select a valid branch.");
    }

    if (!editDriverId && !/^\d{4}$/.test(driverPin)) {
      return alert("New drivers require a 4-digit PIN.");
    }

    if (editDriverId && driverPin && !/^\d{4}$/.test(driverPin)) {
      return alert("Driver PIN must be exactly 4 digits.");
    }

    if (editDriverId) {
      const { error } = await supabase.rpc("update_master_driver", {
        p_driver_id: Number(editDriverId),
        p_full_name: fullName,
        p_phone_number: phone || null,
        p_license_number: license,
        p_license_expiry_date: licenseExp || null,
        p_branch_id: branchId,
        p_is_active: driverActive,
      });

      if (error) {
        return alert("Failed to update driver: " + error.message);
      }

      if (driverPin) {
        const { error: pinError } = await supabase.rpc("set_master_driver_pin", {
          p_driver_id: Number(editDriverId),
          p_pin: driverPin,
        });

        if (pinError) {
          return alert("Driver updated, but PIN update failed: " + pinError.message);
        }
      }

      alert(driverPin ? "Driver and PIN updated successfully!" : "Driver updated successfully!");
    } else {
      const { data, error } = await supabase.rpc("create_master_driver", {
        p_full_name: fullName,
        p_phone_number: phone || null,
        p_license_number: license,
        p_license_expiry_date: licenseExp || null,
        p_branch_id: branchId,
        p_pin: driverPin,
      });

      if (error) {
        return alert("Failed to register driver: " + error.message);
      }

      const generatedCode = data?.driver_code || "generated automatically";
      alert(`Driver registered successfully with code ${generatedCode}!`);
    }

    resetDriverForm();
    await fetchData();
  };

  const resetFreightForm = () => {
    setFreightCargoType("BULK");
    setFreightOrigin("");
    setFreightDestination("");
    setFreightCapacity("35");
    setFreightRate("");
    setFreightStandardKm("0");
    setFreightCargoCategory("");
    setFreightMinTolerance("10");
    setFreightMaxTolerance("10");
    setFreightActive(true);
    setEditFreightId(null);
  };

  const handleSaveFreight = async (e: React.FormEvent) => {
    e.preventDefault();

    const origin = freightOrigin.trim().toUpperCase();
    const destination = freightDestination.trim().toUpperCase();
    const capacityTons = freightCapacity.trim();
    const rate = Number(freightRate);
    const standardKm = Number(freightStandardKm);
    const minTolerance = Number(freightMinTolerance);
    const maxTolerance = Number(freightMaxTolerance);

    if (!origin) return alert("Please enter origin.");
    if (!destination) return alert("Please enter destination.");
    if (!capacityTons) return alert("Please enter capacity.");
    if (!Number.isFinite(rate) || rate < 0) return alert("Please enter a valid freight rate.");
    if (!Number.isFinite(standardKm) || standardKm < 0) return alert("Please enter a valid standard KM.");
    if (!Number.isFinite(minTolerance) || minTolerance < 0) return alert("Invalid minimum KM tolerance.");
    if (!Number.isFinite(maxTolerance) || maxTolerance < 0) return alert("Invalid maximum KM tolerance.");

    const payload = {
      p_cargo_type: freightCargoType.trim().toUpperCase(),
      p_origin: origin,
      p_destination_name: destination,
      p_capacity_tons: capacityTons,
      p_freight_rate_per_ton: rate,
      p_standard_km: standardKm,
      p_cargo_category: freightCargoCategory.trim().toUpperCase() || null,
      p_min_km_tolerance_pct: minTolerance,
      p_max_km_tolerance_pct: maxTolerance,
    };

    if (editFreightId) {
      const { error } = await supabase.rpc("update_master_freight", {
        p_destination_id: Number(editFreightId),
        ...payload,
        p_is_active: freightActive,
      });

      if (error) return alert("Failed to update freight slab: " + error.message);
      alert("Freight slab updated successfully!");
    } else {
      const { error } = await supabase.rpc("create_master_freight", payload);

      if (error) return alert("Failed to create freight slab: " + error.message);
      alert("Freight slab created successfully!");
    }

    resetFreightForm();
    await fetchData();
  };

  const resetBataForm = () => {
    setBataDestination("");
    setBataCargoType("BULK");
    setBataVehicleId("");
    setBataCapacity("");
    setBataAmount("0");
    setBataOrigin("ALL");
    setEditBataId(null);
  };

  const handleSaveBata = async (e: React.FormEvent) => {
    e.preventDefault();

    const destination = bataDestination.trim().toUpperCase();
    const cargoType = bataCargoType.trim().toUpperCase();
    const origin = bataOrigin.trim().toUpperCase() || "ALL";
    const capacityTons = bataCapacity.trim() || null;
    const vehicleId = bataVehicleId ? Number(bataVehicleId) : null;
    const amount = Number(bataAmount);

    if (!destination) return alert("Please enter destination.");
    if (!cargoType) return alert("Please enter cargo type.");
    if (vehicleId !== null && (!Number.isInteger(vehicleId) || vehicleId <= 0)) {
      return alert("Please select a valid vehicle.");
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return alert("Please enter a valid Bata amount.");
    }

    const payload = {
      p_destination_name: destination,
      p_cargo_type: cargoType,
      p_vehicle_id: vehicleId,
      p_capacity_tons: capacityTons,
      p_standard_bata_inr: amount,
      p_origin: origin,
    };

    if (editBataId) {
      const { error } = await supabase.rpc("update_master_bata", {
        p_bata_rule_id: Number(editBataId),
        ...payload,
      });

      if (error) return alert("Failed to update Bata rule: " + error.message);
      alert("Bata rule updated successfully!");
    } else {
      const { error } = await supabase.rpc("create_master_bata", payload);

      if (error) return alert("Failed to create Bata rule: " + error.message);
      alert("Bata rule created successfully!");
    }

    resetBataForm();
    await fetchData();
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

  const filteredTrucks = trucks.filter((t) => {
    const query = truckSearch.trim().toLowerCase();
    if (!query) return true;

    return (
      (t.vehicle_number || "").toLowerCase().includes(query) ||
      (t.truck_type || "").toLowerCase().includes(query) ||
      (t.current_status || "").toLowerCase().includes(query) ||
      (t.is_active ? "active" : "inactive").includes(query)
    );
  });

  useEffect(() => {
    setTruckPage(1);
  }, [truckSearch]);

  const truckPageSize = 10;
  const truckTotalPages = Math.max(1, Math.ceil(filteredTrucks.length / truckPageSize));
  const paginatedTrucks = filteredTrucks.slice(
    (truckPage - 1) * truckPageSize,
    truckPage * truckPageSize
  );

  return (
    <div className="animate-tab-focus space-y-6">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-semibold text-fg tracking-tight">
          Master Database Configuration
        </h2>
        <p className="text-xs text-fg-secondary font-medium mt-0.5">
          Manage enterprise assets, drivers, vendors, freight rules and operational rates.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {subTabs.map((sub) => {
          const count =
            sub === "Trucks" ? trucks.length :
            sub === "Drivers" ? drivers.length :
            sub === "Vendors" ? vendors.length :
            sub === "Freight Slabs" ? destinations.length :
            sub === "Bata" ? bataRules.length :
            appUsers.length;

          return (
            <div
              key={sub}
              className={`liquid-glass p-4 transition-all duration-300 ${
                activeSubTab === sub ? "ring-1 ring-accent/40 shadow-lg" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveSubTab(sub)}
                className="w-full text-left"
              >
                <div className="text-[10px] font-bold uppercase tracking-widest text-fg-muted">
                  {sub}
                </div>
                <div className="text-2xl font-bold text-fg mt-1">{count}</div>
              </button>

              {sub !== "User Control" ? (
                <div className="flex gap-2 mt-3">
                  <Button
                    type="button"
                    size="xs"
                    className="flex-1"
                    onClick={() => {
                      setActiveSubTab(sub);
                      setMasterOverlay("form");
                    }}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="glass"
                    className="flex-1"
                    onClick={() => {
                      setActiveSubTab(sub);
                      setMasterOverlay("list");
                    }}
                  >
                    List
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="glass"
                  className="w-full mt-3"
                  onClick={() => {
                    setActiveSubTab(sub);
                    setMasterOverlay("list");
                  }}
                >
                  View
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className="liquid-glass-soft p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-fg-muted">
              Selected Master
            </div>
            <div className="text-lg font-semibold text-fg mt-1">
              {activeSubTab}
            </div>
          </div>

          {activeSubTab !== "User Control" && (
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => openMasterForm(activeSubTab)}>
                Add / Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="glass"
                onClick={() => setMasterOverlay("list")}
              >
                Open List
              </Button>
            </div>
          )}
        </div>
      </div>

      {masterOverlay && (
        <div
          className="kss-glass-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMasterOverlay(null);
          }}
        >
          <div
            className="kss-glass-sheet"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border">
              <div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-fg-muted">
                  Master Database
                </div>
                <h3 className="text-lg font-bold text-fg mt-0.5">
                  {masterOverlay === "form"
                    ? `${activeSubTab} Form`
                    : `${activeSubTab} List`}
                </h3>
              </div>

              <Button
                type="button"
                variant="glass"
                size="sm"
                onClick={() => setMasterOverlay(null)}
              >
                Close
              </Button>
            </div>

            <div className="kss-glass-sheet-content overflow-y-auto">

              {activeSubTab === "Trucks" && masterOverlay === "form" && (
                <form onSubmit={handleSaveTruck} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Input value={truckNo} onChange={e => setTruckNo(e.target.value.toUpperCase())} placeholder="Vehicle Number" className="input-glass" />
                    <Input value={truckType} onChange={e => setTruckType(e.target.value)} placeholder="Truck Variant / Type" className="input-glass" />
                    <Input type="number" min="0.01" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="Carrying Capacity (MT)" className="input-glass" />
                    <Input type="number" min="0" value={grossWeight} onChange={e => setGrossWeight(e.target.value)} placeholder="Gross Vehicle Weight (MT)" className="input-glass" />
                    <Input type="date" value={fcExpiry} onChange={e => setFcExpiry(e.target.value)} className="input-glass" />
                    <Input type="date" value={insuranceExpiry} onChange={e => setInsuranceExpiry(e.target.value)} className="input-glass" />
                    <Input type="date" value={qtaxExpiry} onChange={e => setQtaxExpiry(e.target.value)} className="input-glass" />
                    <Input type="date" value={pucExpiry} onChange={e => setPucExpiry(e.target.value)} className="input-glass" />
                    <Input type="date" value={npExpiry} onChange={e => setNpExpiry(e.target.value)} className="input-glass" />
                    <Input type="date" value={statePermitExpiry} onChange={e => setStatePermitExpiry(e.target.value)} className="input-glass" />
                    <Input type="date" value={tankCertExpiry} onChange={e => setTankCertExpiry(e.target.value)} className="input-glass" />
                  </div>

                  <div className="flex flex-wrap items-center gap-5">
                    <label className="flex items-center gap-2 text-xs text-fg-secondary">
                      <input
                        type="checkbox"
                        checked={truckActive}
                        onChange={e => setTruckActive(e.target.checked)}
                      />
                      Active
                    </label>

                    <label className="flex items-center gap-2 text-xs text-fg-secondary">
                      <input
                        type="checkbox"
                        checked={odometerWorking}
                        onChange={e => setOdometerWorking(e.target.checked)}
                      />
                      Odometer working
                    </label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="glass" onClick={() => {
                      resetTruckForm();
                      setMasterOverlay(null);
                    }}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editTruckId ? "Update Truck" : "Register Truck"}
                    </Button>
                  </div>
                </form>
              )}

              {activeSubTab === "Trucks" && masterOverlay === "list" && (
                <div className="space-y-3">
                  <Input
                    type="search"
                    value={truckSearch}
                    onChange={e => setTruckSearch(e.target.value)}
                    placeholder="Search vehicle, type, status..."
                    className="input-glass"
                  />

                  <div className="overflow-x-auto">
                    <Table className="min-w-full text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead>FC</TableHead>
                        <TableHead>Insurance</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTrucks.map(t => (
                        <TableRow key={t.vehicle_id}>
                          <TableCell className="font-bold">{t.vehicle_number}</TableCell>
                          <TableCell>{t.truck_type}</TableCell>
                          <TableCell>{t.carrying_capacity_tons} MT</TableCell>
                          <TableCell>{t.current_status || "-"}</TableCell>
                          <TableCell>
                            <span
                              className={
                                t.is_active
                                  ? "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-400/20"
                                  : "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold text-red-300 bg-red-500/10 border border-red-400/20"
                              }
                            >
                              {t.is_active ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell>{t.fc_expiry_date || "-"}</TableCell>
                          <TableCell>{t.insurance_expiry_date || "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="xs"
                              variant="glass"
                              onClick={() => {
                                setTruckNo(t.vehicle_number || "");
                                setTruckType(t.truck_type || "Bulks");
                                setCapacity(String(t.carrying_capacity_tons ?? ""));
                                setGrossWeight(String(t.gross_vehicle_weight_tons ?? "0"));
                                setOdometerWorking(t.odometer_working !== false);
                                setTruckActive(t.is_active !== false);
                                setFcExpiry(t.fc_expiry_date || "");
                                setInsuranceExpiry(t.insurance_expiry_date || "");
                                setQtaxExpiry(t.qtax_expiry_date || "");
                                setPucExpiry(t.puc_expiry_date || "");
                                setNpExpiry(t.np_expiry_date || "");
                                setStatePermitExpiry(t.state_permit_expiry_date || "");
                                setTankCertExpiry(t.tank_cert_expiry_date || "");
                                setEditTruckId(String(t.vehicle_id));
                                setMasterOverlay("form");
                              }}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>

                  {filteredTrucks.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-fg-secondary">
                      <span>
                        Showing {((truckPage - 1) * truckPageSize) + 1}–{Math.min(truckPage * truckPageSize, filteredTrucks.length)} of {filteredTrucks.length}
                      </span>

                      {truckTotalPages > 1 && (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="xs"
                            variant="glass"
                            disabled={truckPage === 1}
                            onClick={() => setTruckPage(page => Math.max(1, page - 1))}
                          >
                            Previous
                          </Button>

                          <span className="min-w-[90px] text-center">
                            Page {truckPage} of {truckTotalPages}
                          </span>

                          <Button
                            type="button"
                            size="xs"
                            variant="glass"
                            disabled={truckPage === truckTotalPages}
                            onClick={() => setTruckPage(page => Math.min(truckTotalPages, page + 1))}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeSubTab === "Drivers" && masterOverlay === "form" && (
                <form onSubmit={handleSaveDriver} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Full Name" className="input-glass" />
                    <Input value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="Phone Number" className="input-glass" />
                    <Input value={licenseNo} onChange={e => setLicenseNo(e.target.value.toUpperCase())} placeholder="License Number" className="input-glass" />
                    <Input type="date" value={licenseExp} onChange={e => setLicenseExp(e.target.value)} className="input-glass" />
                    <Input type="number" value={driverBranchId} onChange={e => setDriverBranchId(e.target.value)} placeholder="Branch ID" className="input-glass" />
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={driverPin}
                      onChange={e => setDriverPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder={editDriverId ? "New 4-digit PIN (optional)" : "4-digit Driver PIN"}
                      className="input-glass font-mono"
                    />
                  </div>

                  {editDriverId && (
                    <label className="flex items-center gap-2 text-xs text-fg-secondary">
                      <input type="checkbox" checked={driverActive} onChange={e => setDriverActive(e.target.checked)} />
                      Driver is active
                    </label>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="glass" onClick={() => {
                      resetDriverForm();
                      setMasterOverlay(null);
                    }}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editDriverId ? "Update Driver" : "Register Driver"}
                    </Button>
                  </div>
                </form>
              )}

              {activeSubTab === "Drivers" && masterOverlay === "list" && (
                <div className="overflow-x-auto">
                  <Table className="min-w-full text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>License</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drivers.map(d => (
                        <TableRow key={d.driver_id}>
                          <TableCell className="font-mono font-bold">{d.driver_code || "-"}</TableCell>
                          <TableCell>{d.full_name || "-"}</TableCell>
                          <TableCell>{d.phone_number || "-"}</TableCell>
                          <TableCell>
                            {d.license_number || "-"}
                            <div className="text-[9px] text-fg-muted">{d.license_expiry_date || "-"}</div>
                          </TableCell>
                          <TableCell>{d.is_active === false ? "INACTIVE" : "ACTIVE"}</TableCell>
                          <TableCell className="text-right">
                            <Button type="button" size="xs" variant="glass" onClick={() => {
                              setDriverName(d.full_name || "");
                              setDriverPhone(d.phone_number || "");
                              setLicenseNo(d.license_number || "");
                              setLicenseExp(d.license_expiry_date || "");
                              setDriverBranchId(String(d.branch_id ?? ""));
                              setDriverPin("");
                              setDriverActive(d.is_active !== false);
                              setEditDriverId(String(d.driver_id));
                              setMasterOverlay("form");
                            }}>
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {activeSubTab === "Vendors" && masterOverlay === "form" && (
                <form onSubmit={async e => {
                  await handleSaveVendor(e);
                  setMasterOverlay(null);
                }} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Vendor Name" className="input-glass" />
                    <Input value={vendorType} onChange={e => setVendorType(e.target.value.toUpperCase())} placeholder="Vendor Type" className="input-glass" />
                    <Input value={vendorSubcategory} onChange={e => setVendorSubcategory(e.target.value)} placeholder="Subcategory" className="input-glass" />
                    <Input value={vendorPhone} onChange={e => setVendorPhone(e.target.value)} placeholder="Phone Number" className="input-glass" />
                    <Input type="email" value={vendorEmail} onChange={e => setVendorEmail(e.target.value)} placeholder="Email" className="input-glass" />
                    <Input value={vendorTaxNumber} onChange={e => setVendorTaxNumber(e.target.value.toUpperCase())} placeholder="GST / Tax Number" className="input-glass font-mono" />
                  </div>
                  <Input value={vendorAddress} onChange={e => setVendorAddress(e.target.value)} placeholder="Address" className="input-glass" />
                  {editVendorId && (
                    <label className="flex items-center gap-2 text-xs text-fg-secondary">
                      <input type="checkbox" checked={vendorActive} onChange={e => setVendorActive(e.target.checked)} />
                      Vendor is active
                    </label>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="glass" onClick={() => setMasterOverlay(null)}>Cancel</Button>
                    <Button type="submit">{editVendorId ? "Update Vendor" : "Register Vendor"}</Button>
                  </div>
                </form>
              )}

              {activeSubTab === "Vendors" && masterOverlay === "list" && (
                <div className="space-y-4">
                  <Input type="search" value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} placeholder="Search vendor, category, phone..." className="input-glass" />
                  <div className="overflow-x-auto">
                    <Table className="min-w-full text-xs">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vendor</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Tax</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredVendors.map(v => (
                          <TableRow key={v.vendor_id}>
                            <TableCell className="font-bold">
                              {v.vendor_name}
                              <div className="text-[9px] text-fg-muted">{v.email || ""}</div>
                            </TableCell>
                            <TableCell>
                              {v.vendor_type}
                              <div className="text-[9px] text-fg-muted">{v.vendor_subcategory || ""}</div>
                            </TableCell>
                            <TableCell>{v.phone_number || "-"}</TableCell>
                            <TableCell className="font-mono">{v.tax_number || "-"}</TableCell>
                            <TableCell>{v.is_active ? "ACTIVE" : "INACTIVE"}</TableCell>
                            <TableCell className="text-right">
                              <Button type="button" size="xs" variant="glass" onClick={() => {
                                setVendorName(v.vendor_name || "");
                                setVendorType(v.vendor_type || "GENERAL");
                                setVendorSubcategory(v.vendor_subcategory || "");
                                setVendorPhone(v.phone_number || "");
                                setVendorEmail(v.email || "");
                                setVendorAddress(v.address || "");
                                setVendorTaxNumber(v.tax_number || "");
                                setVendorActive(v.is_active !== false);
                                setEditVendorId(String(v.vendor_id));
                                setMasterOverlay("form");
                              }}>
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {activeSubTab === "Freight Slabs" && masterOverlay === "form" && (
                <form onSubmit={handleSaveFreight} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Input value={freightCargoType} onChange={e => setFreightCargoType(e.target.value.toUpperCase())} placeholder="Cargo Type" className="input-glass" />
                    <Input value={freightOrigin} onChange={e => setFreightOrigin(e.target.value.toUpperCase())} placeholder="Origin" className="input-glass" />
                    <Input value={freightDestination} onChange={e => setFreightDestination(e.target.value.toUpperCase())} placeholder="Destination" className="input-glass" />
                    <Input value={freightCapacity} onChange={e => setFreightCapacity(e.target.value)} placeholder="Capacity (MT)" className="input-glass" />
                    <Input type="number" min="0" value={freightRate} onChange={e => setFreightRate(e.target.value)} placeholder="Freight Rate / MT" className="input-glass" />
                    <Input type="number" min="0" value={freightStandardKm} onChange={e => setFreightStandardKm(e.target.value)} placeholder="Standard KM" className="input-glass" />
                    <Input value={freightCargoCategory} onChange={e => setFreightCargoCategory(e.target.value.toUpperCase())} placeholder="Cargo Category" className="input-glass" />
                    <Input type="number" min="0" value={freightMinTolerance} onChange={e => setFreightMinTolerance(e.target.value)} placeholder="Min KM Tolerance %" className="input-glass" />
                    <Input type="number" min="0" value={freightMaxTolerance} onChange={e => setFreightMaxTolerance(e.target.value)} placeholder="Max KM Tolerance %" className="input-glass" />
                  </div>
                  {editFreightId && (
                    <label className="flex items-center gap-2 text-xs text-fg-secondary">
                      <input type="checkbox" checked={freightActive} onChange={e => setFreightActive(e.target.checked)} />
                      Freight slab is active
                    </label>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="glass" onClick={() => {
                      resetFreightForm();
                      setMasterOverlay(null);
                    }}>
                      Cancel
                    </Button>
                    <Button type="submit">{editFreightId ? "Update Freight Slab" : "Add Freight Slab"}</Button>
                  </div>
                </form>
              )}

              {activeSubTab === "Freight Slabs" && masterOverlay === "list" && (
                <div className="overflow-x-auto">
                  <Table className="min-w-full text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Route</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Rate / MT</TableHead>
                        <TableHead>KM</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {destinations.map(d => (
                        <TableRow key={d.destination_id}>
                          <TableCell className="font-bold">{d.origin || "-"} → {d.destination_name}</TableCell>
                          <TableCell>{d.cargo_type || "-"}</TableCell>
                          <TableCell>{d.capacity_tons || "-"}</TableCell>
                          <TableCell className="font-mono">{Number(d.freight_rate_per_ton || 0).toLocaleString("en-IN", {minimumFractionDigits: 2})}</TableCell>
                          <TableCell>{d.standard_km || 0}</TableCell>
                          <TableCell>{d.is_active === false ? "INACTIVE" : "ACTIVE"}</TableCell>
                          <TableCell className="text-right">
                            <Button type="button" size="xs" variant="glass" onClick={() => {
                              setFreightCargoType(d.cargo_type || "BULK");
                              setFreightOrigin(d.origin || "");
                              setFreightDestination(d.destination_name || "");
                              setFreightCapacity(String(d.capacity_tons || ""));
                              setFreightRate(String(d.freight_rate_per_ton ?? ""));
                              setFreightStandardKm(String(d.standard_km ?? "0"));
                              setFreightCargoCategory(d.cargo_category || "");
                              setFreightMinTolerance(String(d.min_km_tolerance_pct ?? "10"));
                              setFreightMaxTolerance(String(d.max_km_tolerance_pct ?? "10"));
                              setFreightActive(d.is_active !== false);
                              setEditFreightId(String(d.destination_id));
                              setMasterOverlay("form");
                            }}>
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {activeSubTab === "Bata" && masterOverlay === "form" && (
                <form onSubmit={handleSaveBata} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Input value={bataOrigin} onChange={e => setBataOrigin(e.target.value.toUpperCase())} placeholder="Origin" className="input-glass" />
                    <Input value={bataDestination} onChange={e => setBataDestination(e.target.value.toUpperCase())} placeholder="Destination" className="input-glass" />
                    <Input value={bataCargoType} onChange={e => setBataCargoType(e.target.value.toUpperCase())} placeholder="Cargo Type" className="input-glass" />
                    <Input value={bataCapacity} onChange={e => setBataCapacity(e.target.value)} placeholder="Capacity (MT)" className="input-glass" />
                    <Input type="number" min="0" value={bataAmount} onChange={e => setBataAmount(e.target.value)} placeholder="Standard Bata (₹)" className="input-glass" />
                    <Input type="number" min="1" value={bataVehicleId} onChange={e => setBataVehicleId(e.target.value)} placeholder="Vehicle ID (optional)" className="input-glass" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="glass" onClick={() => {
                      resetBataForm();
                      setMasterOverlay(null);
                    }}>
                      Cancel
                    </Button>
                    <Button type="submit">{editBataId ? "Update Bata Rule" : "Add Bata Rule"}</Button>
                  </div>
                </form>
              )}

              {activeSubTab === "Bata" && masterOverlay === "list" && (
                <div className="overflow-x-auto">
                  <Table className="min-w-full text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Route</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead className="text-right">Bata</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bataRules.map(b => (
                        <TableRow key={b.bata_rule_id}>
                          <TableCell className="font-bold">{b.origin || "ALL"} → {b.destination_name}</TableCell>
                          <TableCell>{b.cargo_type || "-"}</TableCell>
                          <TableCell>{b.capacity_tons || "-"}</TableCell>
                          <TableCell>{b.vehicle_id || "ALL"}</TableCell>
                          <TableCell className="text-right font-mono">{Number(b.standard_bata_inr || 0).toLocaleString("en-IN", {minimumFractionDigits: 2})}</TableCell>
                          <TableCell className="text-right">
                            <Button type="button" size="xs" variant="glass" onClick={() => {
                              setBataOrigin(b.origin || "ALL");
                              setBataDestination(b.destination_name || "");
                              setBataCargoType(b.cargo_type || "BULK");
                              setBataCapacity(String(b.capacity_tons || ""));
                              setBataAmount(String(b.standard_bata_inr ?? "0"));
                              setBataVehicleId(b.vehicle_id ? String(b.vehicle_id) : "");
                              setEditBataId(String(b.bata_rule_id));
                              setMasterOverlay("form");
                            }}>
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {activeSubTab === "User Control" && masterOverlay === "list" && (
                <div className="overflow-x-auto">
                  <Table className="min-w-full text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username / Email</TableHead>
                        <TableHead>Role</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appUsers.map(u => (
                        <TableRow key={u.user_id}>
                          <TableCell className="font-bold font-mono">{u.username || "-"}</TableCell>
                          <TableCell>
                            <span className="px-2.5 py-1 bg-accent-soft text-accent border border-accent rounded-md text-[9px] font-bold font-mono uppercase">
                              {u.role || "USER"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
