"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/FormField";
import { AlertModal } from "@/components/AlertModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";

const formatMasterDate = (value: string | null | undefined) => {
  if (!value) return "-";

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
};

type SetupMaster =
  | "Trucks"
  | "Drivers"
  | "Vendors"
  | "Customers"
  | "Freight Slabs"
  | "Bata"
  | "User Control";

type SetupModuleProps = {
  initialSubTab?: SetupMaster;
};

export function SetupModule({ initialSubTab = "Trucks" }: SetupModuleProps) {
  const supabase = createClient();
  const [activeSubTab, setActiveSubTab] = useState<SetupMaster>(initialSubTab);
  const [showMasterWorkspace, setShowMasterWorkspace] = useState(false);
  const [masterOverlay, setMasterOverlay] = useState<"form" | "list" | null>(null);

  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const showAlert = (
    message: string,
    type: "success" | "error" | "info" = "info",
    title?: string,
  ) => {
    setAlertState({
      isOpen: true,
      title:
        title ??
        (type === "success"
          ? "Success"
          : type === "error"
            ? "Action Required"
            : "Information"),
      message,
      type,
    });
  };

  const [trucks, setTrucks] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [bataRules, setBataRules] = useState<any[]>([]);
  const [appUsers, setAppUsers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  // Customer form states
  const [customerCode, setCustomerCode] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerType, setCustomerType] = useState("CUSTOMER");
  const [customerContactPerson, setCustomerContactPerson] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerTaxNumber, setCustomerTaxNumber] = useState("");
  const [customerBillingAddress, setCustomerBillingAddress] = useState("");
  const [customerPaymentTerms, setCustomerPaymentTerms] = useState("");
  const [customerCreditLimit, setCustomerCreditLimit] = useState("0");
  const [customerRemarks, setCustomerRemarks] = useState("");
  const [customerActive, setCustomerActive] = useState(true);
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");

  // User Control list controls
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);

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
  const [vendorPage, setVendorPage] = useState(1);

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
  const [driverSearch, setDriverSearch] = useState("");
  const [driverPage, setDriverPage] = useState(1);

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
  const [freightSearch, setFreightSearch] = useState("");
  const [freightPage, setFreightPage] = useState(1);

  // Form states for Bata
  const [bataDestination, setBataDestination] = useState("");
  const [bataCargoType, setBataCargoType] = useState("BULK");
  const [bataVehicleId, setBataVehicleId] = useState("");
  const [bataCapacity, setBataCapacity] = useState("");
  const [bataAmount, setBataAmount] = useState("0");
  const [bataOrigin, setBataOrigin] = useState("ALL");
  const [editBataId, setEditBataId] = useState<string | null>(null);
  const [bataSearch, setBataSearch] = useState("");
  const [bataPage, setBataPage] = useState(1);

  const fetchData = async () => {
    const [tRes, dRes, destRes, bRes, uRes, vRes, cRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('vehicle_number'),
      supabase.from('drivers').select('*').order('full_name'),
      supabase.from('destinations_freight_master').select('*').order('destination_name'),
      supabase.from('driver_bata_master').select('*').order('destination_name'),
      supabase.rpc('get_manageable_app_users'),
      supabase.from('vendors').select('*').order('vendor_name'),
      supabase.from('customers').select('*').order('customer_name')
    ]);

    if (tRes.data) setTrucks(tRes.data);
    if (dRes.data) setDrivers(dRes.data);
    if (destRes.data) setDestinations(destRes.data);
    if (bRes.data) setBataRules(bRes.data);
    if (uRes.data) setAppUsers(uRes.data);
    if (vRes.data) setVendors(vRes.data);
    if (cRes.data) setCustomers(cRes.data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setActiveSubTab(initialSubTab);
    setMasterOverlay(null);
  }, [initialSubTab]);

  
  const openMasterForm = (sub: SetupMaster) => {
    setActiveSubTab(sub);

    if (sub === "Trucks") {
      resetTruckForm();
    }

    if (sub === "Drivers") {
      resetDriverForm();
    }

    if (sub === "Vendors") {
      setVendorName("");
      setVendorType("GENERAL");
      setVendorSubcategory("");
      setVendorPhone("");
      setVendorEmail("");
      setVendorAddress("");
      setVendorTaxNumber("");
      setVendorActive(true);
      setEditVendorId(null);
    }

    if (sub === "Customers") {
      resetCustomerForm();
    }

    if (sub === "Freight Slabs") {
      resetFreightForm();
    }

    if (sub === "Bata") {
      resetBataForm();
    }

    setMasterOverlay("form");
  };  const resetTruckForm = () => {
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

  const resetCustomerForm = () => {
    setCustomerCode("");
    setCustomerName("");
    setCustomerType("CUSTOMER");
    setCustomerContactPerson("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCustomerTaxNumber("");
    setCustomerBillingAddress("");
    setCustomerPaymentTerms("");
    setCustomerCreditLimit("0");
    setCustomerRemarks("");
    setCustomerActive(true);
    setEditCustomerId(null);
  };

  const handleSaveTruck = async (e: React.FormEvent) => {
    e.preventDefault();

    const vehicleNumber = truckNo.toUpperCase().trim();
    const carryingCapacity = Number(capacity);
    const grossVehicleWeight = Number(grossWeight) || 0;

    if (!vehicleNumber) return showAlert("Please enter a truck number.", "error", "Vehicle Number Required");
    if (!Number.isFinite(carryingCapacity) || carryingCapacity <= 0) {
      return showAlert("Please enter a valid carrying capacity.", "error", "Invalid Capacity");
    }
    if (grossVehicleWeight < 0) {
      return showAlert("Gross vehicle weight cannot be negative.", "error", "Invalid Gross Weight");
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
        return showAlert("Failed to update vehicle: " + error.message, "error", "Vehicle Update Failed");
      }

      showAlert("Truck details were updated successfully.", "success", "Vehicle Updated");
    } else {
      const { error } = await supabase.rpc("create_master_vehicle", commonPayload);

      if (error) {
        return showAlert("Failed to register vehicle: " + error.message, "error", "Vehicle Registration Failed");
      }

      showAlert("The new vehicle was registered successfully.", "success", "Vehicle Registered");
    }

    resetTruckForm();
    setMasterOverlay(null);
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

    if (!fullName) return showAlert("Please enter driver name.", "error", "Driver Name Required");
    if (!license) return showAlert("Please enter license number.", "error", "License Required");
    if (!Number.isInteger(branchId) || branchId <= 0) {
      return showAlert("Please select a valid branch.", "error", "Invalid Branch");
    }

    if (!editDriverId && !/^\d{4}$/.test(driverPin)) {
      return showAlert("New drivers require a 4-digit PIN.", "error", "Invalid Driver PIN");
    }

    if (editDriverId && driverPin && !/^\d{4}$/.test(driverPin)) {
      return showAlert("Driver PIN must be exactly 4 digits.", "error", "Invalid Driver PIN");
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
        return showAlert("Failed to update driver: " + error.message, "error", "Driver Update Failed");
      }

      if (driverPin) {
        const { error: pinError } = await supabase.rpc("set_master_driver_pin", {
          p_driver_id: Number(editDriverId),
          p_pin: driverPin,
        });

        if (pinError) {
          return showAlert("Driver was updated, but the PIN update failed: " + pinError.message, "error", "PIN Update Failed");
        }
      }

      showAlert(driverPin ? "Driver details and PIN were updated successfully." : "Driver details were updated successfully.", "success", "Driver Updated");
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
        return showAlert("Failed to register driver: " + error.message, "error", "Driver Registration Failed");
      }

      const generatedCode = data?.driver_code || "generated automatically";
      showAlert(`Driver registered successfully with code ${generatedCode}.`, "success", "Driver Registered");
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

    if (!origin) return showAlert("Please enter origin.", "error", "Origin Required");
    if (!destination) return showAlert("Please enter destination.", "error", "Destination Required");
    if (!capacityTons) return showAlert("Please enter capacity.", "error", "Capacity Required");
    if (!Number.isFinite(rate) || rate < 0) return showAlert("Please enter a valid freight rate.", "error", "Invalid Freight Rate");
    if (!Number.isFinite(standardKm) || standardKm < 0) return showAlert("Please enter a valid standard KM.", "error", "Invalid Standard KM");
    if (!Number.isFinite(minTolerance) || minTolerance < 0) return showAlert("Invalid minimum KM tolerance.", "error", "Invalid KM Tolerance");
    if (!Number.isFinite(maxTolerance) || maxTolerance < 0) return showAlert("Invalid maximum KM tolerance.", "error", "Invalid KM Tolerance");

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

      if (error) return showAlert("Failed to update freight slab: " + error.message, "error", "Freight Update Failed");
      showAlert("Freight slab was updated successfully.", "success", "Freight Slab Updated");
    } else {
      const { error } = await supabase.rpc("create_master_freight", payload);

      if (error) return showAlert("Failed to create freight slab: " + error.message, "error", "Freight Creation Failed");
      showAlert("Freight slab was created successfully.", "success", "Freight Slab Created");
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

    if (!destination) return showAlert("Please enter destination.", "error", "Destination Required");
    if (!cargoType) return showAlert("Please enter cargo type.", "error", "Cargo Type Required");
    if (vehicleId !== null && (!Number.isInteger(vehicleId) || vehicleId <= 0)) {
      return showAlert("Please select a valid vehicle.", "error", "Invalid Vehicle");
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return showAlert("Please enter a valid Bata amount.", "error", "Invalid Bata Amount");
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

      if (error) return showAlert("Failed to update Bata rule: " + error.message, "error", "Bata Update Failed");
      showAlert("Bata rule was updated successfully.", "success", "Bata Rule Updated");
    } else {
      const { error } = await supabase.rpc("create_master_bata", payload);

      if (error) return showAlert("Failed to create Bata rule: " + error.message, "error", "Bata Creation Failed");
      showAlert("Bata rule was created successfully.", "success", "Bata Rule Created");
    }

    resetBataForm();
    await fetchData();
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vendorName.trim()) {
      return showAlert("Please enter vendor name.", "error", "Vendor Name Required");
    }

    if (!vendorType) {
      return showAlert("Please select vendor category.", "error", "Vendor Category Required");
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
        return showAlert("Failed to update vendor: " + error.message, "error", "Vendor Update Failed");
      }

      showAlert("Vendor details were updated successfully.", "success", "Vendor Updated");
    } else {
      const { error } = await supabase.rpc("create_vendor_atomic", payload);

      if (error) {
        return showAlert("Failed to create vendor: " + error.message, "error", "Vendor Creation Failed");
      }

      showAlert("The vendor was registered successfully.", "success", "Vendor Registered");
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

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    const code = customerCode.trim().toUpperCase();
    const name = customerName.trim();
    const creditLimit = Number(customerCreditLimit);

    if (!code) {
      return showAlert("Please enter customer code.", "error", "Customer Code Required");
    }

    if (!name) {
      return showAlert("Please enter customer name.", "error", "Customer Name Required");
    }

    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      return showAlert("Credit limit cannot be negative.", "error", "Invalid Credit Limit");
    }

    const payload = {
      p_customer_code: code,
      p_customer_name: name,
      p_customer_type: customerType.trim().toUpperCase() || "CUSTOMER",
      p_contact_person: customerContactPerson.trim() || null,
      p_phone_number: customerPhone.trim() || null,
      p_email: customerEmail.trim() || null,
      p_tax_number: customerTaxNumber.trim() || null,
      p_billing_address: customerBillingAddress.trim() || null,
      p_payment_terms: customerPaymentTerms.trim() || null,
      p_credit_limit: creditLimit,
      p_remarks: customerRemarks.trim() || null,
    };

    if (editCustomerId) {
      const { error } = await supabase.rpc("update_master_customer", {
        p_customer_id: Number(editCustomerId),
        ...payload,
        p_is_active: customerActive,
      });

      if (error) {
        return showAlert(
          "Failed to update customer: " + error.message,
          "error",
          "Customer Update Failed"
        );
      }

      showAlert("Customer details were updated successfully.", "success", "Customer Updated");
    } else {
      const { error } = await supabase.rpc("create_master_customer", payload);

      if (error) {
        return showAlert(
          "Failed to create customer: " + error.message,
          "error",
          "Customer Creation Failed"
        );
      }

      showAlert("The customer was registered successfully.", "success", "Customer Registered");
    }

    resetCustomerForm();
    await fetchData();
  };

  const normalizedCustomerSearch = customerSearch.trim().toLowerCase();

  const filteredCustomers = customers.filter((c) => {
    if (!normalizedCustomerSearch) return true;

    return [
      c.customer_code,
      c.customer_name,
      c.customer_type,
      c.contact_person,
      c.phone_number,
      c.email,
      c.tax_number,
      c.billing_address,
      c.payment_terms,
      c.is_active ? "active" : "inactive",
    ]
      .map(value => String(value ?? "").toLowerCase())
      .some(value => value.includes(normalizedCustomerSearch));
  });

  const normalizedVendorSearch = vendorSearch.trim().toLowerCase();

  const filteredVendors = vendors.filter((v) => {
    if (!normalizedVendorSearch) return true;

    return [
      v.vendor_name,
      v.vendor_type,
      v.vendor_subcategory,
      v.phone_number,
      v.email,
      v.tax_number,
      v.address,
      v.is_active ? "active" : "inactive",
    ]
      .map(value => String(value ?? "").toLowerCase())
      .some(value => value.includes(normalizedVendorSearch));
  });

  useEffect(() => {
    setVendorPage(1);
  }, [vendorSearch]);

  const vendorPageSize = 10;

  const vendorTotalPages = Math.max(
    1,
    Math.ceil(filteredVendors.length / vendorPageSize)
  );

  const paginatedVendors = filteredVendors.slice(
    (vendorPage - 1) * vendorPageSize,
    vendorPage * vendorPageSize
  );

  useEffect(() => {
    setVendorPage(page => Math.min(Math.max(1, page), vendorTotalPages));
  }, [vendorTotalPages]);

  const normalizedFreightSearch = freightSearch.trim().toLowerCase();

  const filteredFreight = destinations.filter((d) => {
    if (!normalizedFreightSearch) return true;

    const standardKm = Number(d.standard_km || 0);
    const minTolerance = Number(d.min_km_tolerance_pct ?? 10);
    const maxTolerance = Number(d.max_km_tolerance_pct ?? 10);

    return [
      d.origin,
      d.destination_name,
      d.cargo_type,
      d.cargo_category,
      d.capacity_tons,
      d.freight_rate,
      d.standard_km,
      standardKm,
      minTolerance,
      maxTolerance,
      d.is_active ? "active" : "inactive",
    ]
      .map(value => String(value ?? "").toLowerCase())
      .some(value => value.includes(normalizedFreightSearch));
  });

  useEffect(() => {
    setFreightPage(1);
  }, [freightSearch]);

  const freightPageSize = 10;

  const freightTotalPages = Math.max(
    1,
    Math.ceil(filteredFreight.length / freightPageSize)
  );

  const paginatedFreight = filteredFreight.slice(
    (freightPage - 1) * freightPageSize,
    freightPage * freightPageSize
  );

  useEffect(() => {
    setFreightPage(page =>
      Math.min(Math.max(1, page), freightTotalPages)
    );
  }, [freightTotalPages]);

  const normalizedUserSearch = userSearch.trim().toLowerCase();

  const filteredUsers = appUsers.filter((u) => {
    if (!normalizedUserSearch) return true;

    const createdDate = u.created_at
      ? new Date(u.created_at)
      : null;

    const formattedCreatedDate =
      createdDate && !Number.isNaN(createdDate.getTime())
        ? createdDate.toLocaleDateString("en-GB")
        : "";

    return [
      u.username,
      u.role,
      u.access_level,
      u.user_id,
      u.created_at,
      formattedCreatedDate,
    ]
      .map(value => String(value ?? "").toLowerCase())
      .some(value => value.includes(normalizedUserSearch));
  });

  useEffect(() => {
    setUserPage(1);
  }, [userSearch]);

  const userPageSize = 10;

  const userTotalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / userPageSize)
  );

  const paginatedUsers = filteredUsers.slice(
    (userPage - 1) * userPageSize,
    userPage * userPageSize
  );

  useEffect(() => {
    setUserPage(page =>
      Math.min(Math.max(1, page), userTotalPages)
    );
  }, [userTotalPages]);

  const normalizedBataSearch = bataSearch.trim().toLowerCase();

  const filteredBata = bataRules.filter((b) => {
    if (!normalizedBataSearch) return true;

    return [
      b.origin,
      b.destination_name,
      b.cargo_type,
      b.capacity_tons,
      b.vehicle_id,
      b.standard_bata_inr,
      b.vehicle_id ? `vehicle ${b.vehicle_id}` : "all vehicles",
      b.origin ? "origin-specific rule" : "all origins",
      b.capacity_tons ? `${b.capacity_tons} mt` : "all capacities",
    ]
      .map(value => String(value ?? "").toLowerCase())
      .some(value => value.includes(normalizedBataSearch));
  });

  useEffect(() => {
    setBataPage(1);
  }, [bataSearch]);

  const bataPageSize = 10;

  const bataTotalPages = Math.max(
    1,
    Math.ceil(filteredBata.length / bataPageSize)
  );

  const paginatedBata = filteredBata.slice(
    (bataPage - 1) * bataPageSize,
    bataPage * bataPageSize
  );

  useEffect(() => {
    setBataPage(page =>
      Math.min(Math.max(1, page), bataTotalPages)
    );
  }, [bataTotalPages]);

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
  const truckTotalPages = Math.max(
    1,
    Math.ceil(filteredTrucks.length / truckPageSize)
  );

  const paginatedTrucks = filteredTrucks.slice(
    (truckPage - 1) * truckPageSize,
    truckPage * truckPageSize
  );

  useEffect(() => {
    setTruckPage(page => Math.min(Math.max(1, page), truckTotalPages));
  }, [truckTotalPages]);

  const normalizedDriverSearch = driverSearch.trim().toLowerCase();

  const filteredDrivers = drivers.filter(d => {
    if (!normalizedDriverSearch) return true;

    return [
      d.driver_code,
      d.full_name,
      d.phone_number,
      d.license_number,
      d.branch_id,
      d.is_active ? "active" : "inactive",
    ]
      .map(value => String(value ?? "").toLowerCase())
      .some(value => value.includes(normalizedDriverSearch));
  });

  useEffect(() => {
    setDriverPage(1);
  }, [driverSearch]);

  const driverPageSize = 10;
  const driverTotalPages = Math.max(
    1,
    Math.ceil(filteredDrivers.length / driverPageSize)
  );

  const paginatedDrivers = filteredDrivers.slice(
    (driverPage - 1) * driverPageSize,
    driverPage * driverPageSize
  );

  useEffect(() => {
    setDriverPage(page => Math.min(Math.max(1, page), driverTotalPages));
  }, [driverTotalPages]);

  const masterTitles: Record<SetupMaster, string> = {
    Trucks: "Vehicles",
    Drivers: "Drivers",
    Vendors: "Vendors",
    Customers: "Customers",
    "Freight Slabs": "Freight & Routes",
    Bata: "Driver Bata",
    "User Control": "User Control",
  };

  const masterDescriptions: Record<SetupMaster, string> = {
    Trucks: "Fleet vehicle master and statutory expiry controls.",
    Drivers: "Driver master, licence details and driver access.",
    Vendors: "Vendor master, classification and contact details.",
    Customers: "Customer master, billing, credit and commercial contact details.",
    "Freight Slabs": "Routes, freight rates, distance standards and tolerances.",
    Bata: "Driver bata rules by route, vehicle and cargo.",
    "User Control": "System user administration and access control.",
  };

  return (
    <div className="w-full">
      {!showMasterWorkspace ? (
        <div className="liquid-glass w-full rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="kss-eyebrow text-accent">Master · Data Control</p>
              <h2 className="mt-1 text-xl font-semibold text-fg">
                {masterTitles[activeSubTab]}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-secondary">
                {masterDescriptions[activeSubTab]}
              </p>
            </div>

            <Button
              type="button"
              size="lg"
              className="min-h-11 shrink-0 sm:min-w-52"
              onClick={() => setShowMasterWorkspace(true)}
            >
              Open Master Workspace
            </Button>
          </div>
        </div>
      ) : (
        <div className="animate-tab-focus space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface/30 px-4 py-3">
            <div className="min-w-0">
              <p className="kss-eyebrow text-accent">Master Workspace</p>
              <p className="mt-1 truncate text-sm font-semibold text-fg">
                {masterTitles[activeSubTab]}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMasterOverlay(null);
                setShowMasterWorkspace(false);
              }}
              className="shrink-0 rounded-xl"
            >
              Close Workspace
            </Button>
          </div>

          <div className="liquid-glass-soft overflow-hidden">
        <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
              Master workspace
            </p>

            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-fg">
              {masterTitles[activeSubTab]}
            </h2>

            <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-secondary">
              {masterDescriptions[activeSubTab]}
            </p>
          </div>

          {activeSubTab !== "User Control" && (
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => openMasterForm(activeSubTab)}
              >
                Add New
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

          {activeSubTab === "User Control" && (
            <Button
              type="button"
              size="sm"
              variant="glass"
              onClick={() => setMasterOverlay("list")}
            >
              View Users
            </Button>
          )}
        </div>
      </div>

      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        onClose={() =>
          setAlertState((current) => ({
            ...current,
            isOpen: false,
          }))
        }
      />

      <Dialog
        open={masterOverlay !== null}
        onOpenChange={(open) => {
          if (!open) setMasterOverlay(null);
        }}
      >
        <DialogContent
          size="full"
          showClose={false}
          className="h-[min(92dvh,900px)] max-w-[1280px] p-0"
        >
          <DialogHeader className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-fg-muted">
                Master Database
              </div>
              <DialogTitle className="mt-0.5 text-lg font-bold">
                {masterOverlay === "form"
                  ? `${activeSubTab} Form`
                  : `${activeSubTab} List`}
              </DialogTitle>
            </div>

            <Button
              type="button"
              variant="glass"
              size="sm"
              onClick={() => setMasterOverlay(null)}
            >
              Close
            </Button>
          </DialogHeader>

          <DialogBody className="flex-1 overflow-y-auto">

              {activeSubTab === "Trucks" && masterOverlay === "form" && (
                <form onSubmit={handleSaveTruck} className="space-y-6">
                  {/* Vehicle Identity */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Vehicle Identity
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Core vehicle details used across trips, fleet and finance workflows.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <FormField
                        id="truck-vehicle-number"
                        label="Vehicle Number"
                        required
                      >
                        <Input
                          value={truckNo}
                          onChange={e => setTruckNo(e.target.value.toUpperCase())}
                          placeholder="KL 01 AB 1234"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="truck-type"
                        label="Truck Type / Variant"
                        required
                      >
                        <Input
                          value={truckType}
                          onChange={e => setTruckType(e.target.value)}
                          placeholder="Bulks"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="truck-capacity"
                        label="Carrying Capacity (MT)"
                        required
                      >
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={capacity}
                          onChange={e => setCapacity(e.target.value)}
                          placeholder="35"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="truck-gross-weight"
                        label="Gross Vehicle Weight (MT)"
                      >
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={grossWeight}
                          onChange={e => setGrossWeight(e.target.value)}
                          placeholder="0"
                          className="input-glass"
                        />
                      </FormField>
                    </div>
                  </section>

                  {/* Compliance Documents */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Compliance & Documents
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Expiry dates are stored in the vehicle master for fleet compliance tracking.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <FormField
                        id="truck-fc-expiry"
                        label="FC Expiry"
                      >
                        <Input
                          type="date"
                          value={fcExpiry}
                          onChange={e => setFcExpiry(e.target.value)}
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="truck-insurance-expiry"
                        label="Insurance Expiry"
                      >
                        <Input
                          type="date"
                          value={insuranceExpiry}
                          onChange={e => setInsuranceExpiry(e.target.value)}
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="truck-qtax-expiry"
                        label="Q-Tax Expiry"
                      >
                        <Input
                          type="date"
                          value={qtaxExpiry}
                          onChange={e => setQtaxExpiry(e.target.value)}
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="truck-puc-expiry"
                        label="PUC Expiry"
                      >
                        <Input
                          type="date"
                          value={pucExpiry}
                          onChange={e => setPucExpiry(e.target.value)}
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="truck-np-expiry"
                        label="National Permit Expiry"
                      >
                        <Input
                          type="date"
                          value={npExpiry}
                          onChange={e => setNpExpiry(e.target.value)}
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="truck-state-permit-expiry"
                        label="State Permit Expiry"
                      >
                        <Input
                          type="date"
                          value={statePermitExpiry}
                          onChange={e => setStatePermitExpiry(e.target.value)}
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="truck-tank-cert-expiry"
                        label="Tank Certificate Expiry"
                      >
                        <Input
                          type="date"
                          value={tankCertExpiry}
                          onChange={e => setTankCertExpiry(e.target.value)}
                          className="input-glass"
                        />
                      </FormField>
                    </div>
                  </section>

                  {/* Operational Controls */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Operational Controls
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Control whether this vehicle can participate in normal fleet workflows.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        id="truck-active"
                        label="Vehicle Status"
                        description="Inactive vehicles remain in history but should not be selected for new operational work."
                      >
                        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border/70 bg-surface/40 px-3 text-sm text-fg-secondary">
                          <input
                            type="checkbox"
                            checked={truckActive}
                            onChange={e => setTruckActive(e.target.checked)}
                            className="size-4 accent-current"
                          />
                          <span>
                            {truckActive ? "Vehicle is active" : "Vehicle is inactive"}
                          </span>
                        </label>
                      </FormField>

                      <FormField
                        id="truck-odometer-working"
                        label="Odometer"
                        description="Disable this only when the vehicle's odometer is known to be unreliable or non-functional."
                      >
                        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border/70 bg-surface/40 px-3 text-sm text-fg-secondary">
                          <input
                            type="checkbox"
                            checked={odometerWorking}
                            onChange={e => setOdometerWorking(e.target.checked)}
                            className="size-4 accent-current"
                          />
                          <span>
                            {odometerWorking ? "Odometer working" : "Odometer not working"}
                          </span>
                        </label>
                      </FormField>
                    </div>
                  </section>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5">
                    <div className="text-xs text-fg-muted">
                      {editTruckId
                        ? "Editing an existing vehicle master record."
                        : "Register a new vehicle in the fleet master."}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="glass"
                        onClick={() => {
                          resetTruckForm();
                          setMasterOverlay(null);
                        }}
                      >
                        Cancel
                      </Button>

                      <Button type="submit">
                        {editTruckId ? "Update Truck" : "Register Truck"}
                      </Button>
                    </div>
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
                        <TableHead>Odometer</TableHead>
                        <TableHead>FC</TableHead>
                        <TableHead>Insurance</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTrucks.length > 0 ? (
                        paginatedTrucks.map(t => (
                          <TableRow key={t.vehicle_id}>
                          <TableCell className="font-bold">{t.vehicle_number}</TableCell>
                          <TableCell>{t.truck_type}</TableCell>
                          <TableCell>{t.carrying_capacity_tons} MT</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center rounded-full border border-border/70 bg-surface/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-fg-secondary">
                              {t.current_status || "UNKNOWN"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                t.is_active
                                  ? "inline-flex items-center rounded-full border border-success/20 bg-success-soft px-2.5 py-1 text-[10px] font-semibold text-success"
                                  : "inline-flex items-center rounded-full border border-danger/20 bg-danger-soft px-2.5 py-1 text-[10px] font-semibold text-danger"
                              }
                            >
                              {t.is_active ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                t.odometer_working !== false
                                  ? "inline-flex items-center rounded-full border border-success/20 bg-success-soft px-2.5 py-1 text-[10px] font-semibold text-success"
                                  : "inline-flex items-center rounded-full border border-warning/20 bg-warning-soft px-2.5 py-1 text-[10px] font-semibold text-warning"
                              }
                            >
                              {t.odometer_working !== false ? "Working" : "Check"}
                            </span>
                          </TableCell>
                          <TableCell>{formatMasterDate(t.fc_expiry_date)}</TableCell>
                          <TableCell>{formatMasterDate(t.insurance_expiry_date)}</TableCell>
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
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="py-12 text-center">
                            <div className="mx-auto max-w-md">
                              <div className="text-sm font-semibold text-fg-primary">
                                {truckSearch.trim()
                                  ? "No vehicles match your search"
                                  : "No vehicles registered"}
                              </div>
                              <p className="mt-1 text-xs leading-5 text-fg-muted">
                                {truckSearch.trim()
                                  ? "Try another vehicle number, truck type or status."
                                  : "Register the first vehicle using Add New."}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
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
                <form onSubmit={handleSaveDriver} className="space-y-6">
                  {/* Driver Identity */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Driver Identity
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Core driver information used across dispatch, settlement and driver workflows.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <FormField
                        id="driver-full-name"
                        label="Full Name"
                        required
                      >
                        <Input
                          value={driverName}
                          onChange={e => setDriverName(e.target.value)}
                          placeholder="Driver full name"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="driver-phone"
                        label="Phone Number"
                      >
                        <Input
                          type="tel"
                          inputMode="tel"
                          value={driverPhone}
                          onChange={e => setDriverPhone(e.target.value)}
                          placeholder="Mobile number"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="driver-branch"
                        label="Branch"
                        required
                        description="Branch assignment used for operational ownership."
                      >
                        <Input
                          type="number"
                          min="1"
                          value={driverBranchId}
                          onChange={e => setDriverBranchId(e.target.value)}
                          placeholder="Branch ID"
                          className="input-glass"
                        />
                      </FormField>
                    </div>
                  </section>

                  {/* License & Assignment */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        License & Assignment
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Keep statutory license information current before assigning a driver to operational work.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        id="driver-license-number"
                        label="License Number"
                        required
                      >
                        <Input
                          value={licenseNo}
                          onChange={e => setLicenseNo(e.target.value.toUpperCase())}
                          placeholder="Driving license number"
                          className="input-glass font-mono"
                        />
                      </FormField>

                      <FormField
                        id="driver-license-expiry"
                        label="License Expiry"
                        description="Leave blank only when the existing workflow permits an unknown expiry date."
                      >
                        <Input
                          type="date"
                          value={licenseExp}
                          onChange={e => setLicenseExp(e.target.value)}
                          className="input-glass"
                        />
                      </FormField>
                    </div>
                  </section>

                  {/* Driver Access */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Driver Access
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        The PIN is used for driver-side access. Existing driver PINs are never displayed.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        id="driver-pin"
                        label="Driver PIN"
                        required={!editDriverId}
                        description={
                          editDriverId
                            ? "Enter a new 4-digit PIN only if the driver's PIN should be changed."
                            : "New drivers require exactly 4 digits."
                        }
                      >
                        <Input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          value={driverPin}
                          onChange={e =>
                            setDriverPin(
                              e.target.value.replace(/\D/g, "").slice(0, 4),
                            )
                          }
                          placeholder={
                            editDriverId
                              ? "New 4-digit PIN (optional)"
                              : "4-digit Driver PIN"
                          }
                          className="input-glass font-mono tracking-[0.3em]"
                        />
                      </FormField>

                      {editDriverId ? (
                        <FormField
                          id="driver-active"
                          label="Driver Status"
                          description="Inactive drivers remain in history but should not be selected for new operational work."
                        >
                          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border/70 bg-surface/40 px-3 text-sm text-fg-secondary">
                            <input
                              type="checkbox"
                              checked={driverActive}
                              onChange={e => setDriverActive(e.target.checked)}
                              className="size-4 accent-current"
                            />
                            <span>
                              {driverActive
                                ? "Driver is active"
                                : "Driver is inactive"}
                            </span>
                          </label>
                        </FormField>
                      ) : (
                        <div className="flex min-h-11 items-end">
                          <div className="w-full rounded-xl border border-success/20 bg-success-soft px-3 py-2.5 text-xs text-success">
                            New driver will be registered as active.
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5">
                    <div className="text-xs text-fg-muted">
                      {editDriverId
                        ? "Editing an existing driver master record."
                        : "Register a new driver in the fleet master."}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="glass"
                        onClick={() => {
                          resetDriverForm();
                          setMasterOverlay(null);
                        }}
                      >
                        Cancel
                      </Button>

                      <Button type="submit">
                        {editDriverId ? "Update Driver" : "Register Driver"}
                      </Button>
                    </div>
                  </div>
                </form>
              )}

              {activeSubTab === "Drivers" && masterOverlay === "list" && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Driver Directory
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Active driver records, licence validity and branch assignment.
                      </p>
                    </div>

                    <div className="rounded-full border border-border/70 bg-surface/50 px-3 py-1.5 text-[10px] font-semibold text-fg-secondary">
                      {drivers.length} Drivers
                    </div>
                  </div>

                  <Input
                    type="search"
                    value={driverSearch}
                    onChange={e => setDriverSearch(e.target.value)}
                    placeholder="Search code, name, phone, license or status..."
                    className="input-glass"
                  />

                  <div className="overflow-x-auto">
                    <Table className="min-w-full text-xs">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>License</TableHead>
                          <TableHead>License Expiry</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {paginatedDrivers.length > 0 ? (
                          paginatedDrivers.map(d => (
                            <TableRow key={d.driver_id}>
                              <TableCell className="font-mono font-bold">
                                {d.driver_code || "-"}
                              </TableCell>

                              <TableCell>
                                <div className="font-semibold text-fg-primary">
                                  {d.full_name || "-"}
                                </div>
                                <div className="text-[10px] text-fg-muted">
                                  Branch {d.branch_id ?? "-"}
                                </div>
                              </TableCell>

                              <TableCell>
                                {d.phone_number || "-"}
                              </TableCell>

                              <TableCell className="font-mono text-xs">
                                {d.license_number || "-"}
                              </TableCell>

                              <TableCell>
                                <div className="flex flex-col items-start gap-1">
                                  <span className="text-xs">
                                    {formatMasterDate(d.license_expiry_date)}
                                  </span>

                                  {d.license_expiry_date ? (
                                    (() => {
                                      const expiry = new Date(
                                        `${d.license_expiry_date}T00:00:00`,
                                      );
                                      const today = new Date();
                                      today.setHours(0, 0, 0, 0);

                                      const expired = expiry < today;

                                      return (
                                        <span
                                          className={
                                            expired
                                              ? "inline-flex items-center rounded-full border border-danger/20 bg-danger-soft px-2 py-0.5 text-[10px] font-semibold text-danger"
                                              : "inline-flex items-center rounded-full border border-success/20 bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success"
                                          }
                                        >
                                          {expired ? "Expired" : "Valid"}
                                        </span>
                                      );
                                    })()
                                  ) : (
                                    <span className="inline-flex items-center rounded-full border border-warning/20 bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning">
                                      Not Set
                                    </span>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell>
                                <span
                                  className={
                                    d.is_active
                                      ? "inline-flex items-center rounded-full border border-success/20 bg-success-soft px-2.5 py-1 text-[10px] font-semibold text-success"
                                      : "inline-flex items-center rounded-full border border-danger/20 bg-danger-soft px-2.5 py-1 text-[10px] font-semibold text-danger"
                                  }
                                >
                                  {d.is_active ? "Active" : "Inactive"}
                                </span>
                              </TableCell>

                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="glass"
                                  onClick={() => {
                                    setDriverName(d.full_name || "");
                                    setDriverPhone(d.phone_number || "");
                                    setLicenseNo(d.license_number || "");
                                    setLicenseExp(d.license_expiry_date || "");
                                    setDriverBranchId(String(d.branch_id ?? ""));
                                    setDriverPin("");
                                    setDriverActive(d.is_active !== false);
                                    setEditDriverId(String(d.driver_id));
                                    setMasterOverlay("form");
                                  }}
                                >
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="py-12 text-center">
                              <div className="mx-auto max-w-md">
                                <div className="text-sm font-semibold text-fg-primary">
                                  {driverSearch.trim()
                                    ? "No drivers match your search"
                                    : "No drivers registered"}
                                </div>
                                <p className="mt-1 text-xs leading-5 text-fg-muted">
                                  {driverSearch.trim()
                                    ? "Try another driver code, name, phone, license or status."
                                    : "Register the first driver using Add New."}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {filteredDrivers.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-fg-secondary">
                      <span>
                        Showing {((driverPage - 1) * driverPageSize) + 1}–{Math.min(
                          driverPage * driverPageSize,
                          filteredDrivers.length,
                        )} of {filteredDrivers.length}
                      </span>

                      {driverTotalPages > 1 && (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="xs"
                            variant="glass"
                            disabled={driverPage === 1}
                            onClick={() =>
                              setDriverPage(page => Math.max(1, page - 1))
                            }
                          >
                            Previous
                          </Button>

                          <span className="min-w-[90px] text-center">
                            Page {driverPage} of {driverTotalPages}
                          </span>

                          <Button
                            type="button"
                            size="xs"
                            variant="glass"
                            disabled={driverPage === driverTotalPages}
                            onClick={() =>
                              setDriverPage(page =>
                                Math.min(driverTotalPages, page + 1),
                              )
                            }
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeSubTab === "Vendors" && masterOverlay === "form" && (
                <form
                  onSubmit={async e => {
                    await handleSaveVendor(e);
                    setMasterOverlay(null);
                  }}
                  className="space-y-6"
                >

                  {/* Vendor Identity */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Vendor Identity
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Define the vendor name and operational classification.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <FormField
                        id="vendor-name"
                        label="Vendor Name"
                        required
                      >
                        <Input
                          value={vendorName}
                          onChange={e => setVendorName(e.target.value)}
                          placeholder="ABC TRANSPORT SERVICES"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="vendor-type"
                        label="Vendor Type"
                        required
                        description="Primary business category."
                      >
                        <Input
                          value={vendorType}
                          onChange={e =>
                            setVendorType(e.target.value.toUpperCase())
                          }
                          placeholder="GENERAL"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="vendor-subcategory"
                        label="Subcategory"
                        description="Optional operational classification."
                      >
                        <Input
                          value={vendorSubcategory}
                          onChange={e =>
                            setVendorSubcategory(e.target.value)
                          }
                          placeholder="WORKSHOP / TYRE / FUEL"
                          className="input-glass"
                        />
                      </FormField>
                    </div>
                  </section>

                  {/* Contact & Tax */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Contact & Tax
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Store the primary communication and tax details used
                        across vendor transactions.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <FormField
                        id="vendor-phone"
                        label="Phone Number"
                      >
                        <Input
                          type="tel"
                          value={vendorPhone}
                          onChange={e =>
                            setVendorPhone(e.target.value)
                          }
                          placeholder="+91 XXXXX XXXXX"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="vendor-email"
                        label="Email"
                      >
                        <Input
                          type="email"
                          value={vendorEmail}
                          onChange={e =>
                            setVendorEmail(e.target.value)
                          }
                          placeholder="vendor@example.com"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="vendor-tax-number"
                        label="GST / Tax Number"
                        description="Optional statutory tax reference."
                      >
                        <Input
                          value={vendorTaxNumber}
                          onChange={e =>
                            setVendorTaxNumber(
                              e.target.value.toUpperCase()
                            )
                          }
                          placeholder="GSTIN / TAX NUMBER"
                          className="input-glass font-mono"
                        />
                      </FormField>
                    </div>
                  </section>

                  {/* Address */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Vendor Address
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Maintain the registered or operational vendor address.
                      </p>
                    </div>

                    <FormField
                      id="vendor-address"
                      label="Address"
                    >
                      <Input
                        value={vendorAddress}
                        onChange={e =>
                          setVendorAddress(e.target.value)
                        }
                        placeholder="Registered / operational address"
                        className="input-glass"
                      />
                    </FormField>
                  </section>

                  {/* Record Status */}
                  {editVendorId && (
                    <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                      <div className="mb-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                          Record Status
                        </div>
                        <p className="mt-1 text-xs text-fg-muted">
                          Inactive vendors remain in the master for historical
                          transaction reference.
                        </p>
                      </div>

                      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-surface/40 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={vendorActive}
                          onChange={e =>
                            setVendorActive(e.target.checked)
                          }
                          className="size-4 accent-[var(--accent)]"
                        />

                        <span className="flex flex-col">
                          <span className="text-xs font-semibold text-fg-secondary">
                            Vendor is active
                          </span>
                          <span className="mt-0.5 text-[10px] text-fg-muted">
                            Active vendors can be selected for new operational
                            transactions.
                          </span>
                        </span>
                      </label>
                    </section>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface/30 p-4">
                    <div>
                      <div className="text-xs font-semibold text-fg-secondary">
                        {editVendorId
                          ? "Update vendor master"
                          : "Register new vendor"}
                      </div>
                      <p className="mt-0.5 text-[10px] text-fg-muted">
                        Vendor changes are processed through the protected
                        database workflow.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="glass"
                        onClick={() => setMasterOverlay(null)}
                      >
                        Cancel
                      </Button>

                      <Button type="submit">
                        {editVendorId
                          ? "Update Vendor"
                          : "Register Vendor"}
                      </Button>
                    </div>
                  </div>

                </form>
              )}

              {activeSubTab === "Customers" && masterOverlay === "form" && (
                <form
                  onSubmit={async e => {
                    await handleSaveCustomer(e);
                    setMasterOverlay(null);
                  }}
                  className="space-y-6"
                >
                  {/* Customer Identity */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Customer Identity
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Define the customer code, legal name and commercial classification.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <FormField
                        id="customer-code"
                        label="Customer Code"
                        required
                        description="Unique internal customer reference."
                      >
                        <Input
                          value={customerCode}
                          onChange={e => setCustomerCode(e.target.value.toUpperCase())}
                          placeholder="CUST-001"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="customer-name"
                        label="Customer Name"
                        required
                      >
                        <Input
                          value={customerName}
                          onChange={e => setCustomerName(e.target.value)}
                          placeholder="ABC CEMENTS LTD"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="customer-type"
                        label="Customer Type"
                        required
                        description="Primary commercial classification."
                      >
                        <Input
                          value={customerType}
                          onChange={e => setCustomerType(e.target.value.toUpperCase())}
                          placeholder="CUSTOMER"
                          className="input-glass"
                        />
                      </FormField>
                    </div>
                  </section>

                  {/* Contact & Tax */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Contact & Tax
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Store the primary commercial contact and tax information.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <FormField
                        id="customer-contact-person"
                        label="Contact Person"
                      >
                        <Input
                          value={customerContactPerson}
                          onChange={e => setCustomerContactPerson(e.target.value)}
                          placeholder="Accounts / Purchase Contact"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="customer-phone"
                        label="Phone Number"
                      >
                        <Input
                          value={customerPhone}
                          onChange={e => setCustomerPhone(e.target.value)}
                          placeholder="9876543210"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="customer-email"
                        label="Email"
                      >
                        <Input
                          type="email"
                          value={customerEmail}
                          onChange={e => setCustomerEmail(e.target.value)}
                          placeholder="accounts@example.com"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="customer-tax-number"
                        label="GST / Tax Number"
                      >
                        <Input
                          value={customerTaxNumber}
                          onChange={e => setCustomerTaxNumber(e.target.value.toUpperCase())}
                          placeholder="GSTIN / TAX ID"
                          className="input-glass"
                        />
                      </FormField>

                      <div className="md:col-span-2">
                        <FormField
                          id="customer-billing-address"
                          label="Billing Address"
                        >
                          <textarea
                            id="customer-billing-address"
                            value={customerBillingAddress}
                            onChange={e => setCustomerBillingAddress(e.target.value)}
                            placeholder="Registered billing address"
                            rows={3}
                            className="input-glass min-h-[88px] w-full resize-y rounded-xl border border-border/70 px-3 py-2 text-sm outline-none transition focus:border-primary/50"
                          />
                        </FormField>
                      </div>
                    </div>
                  </section>

                  {/* Commercial & Credit */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Commercial & Credit
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Define payment expectations, credit exposure and internal remarks.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <FormField
                        id="customer-payment-terms"
                        label="Payment Terms"
                        description="Example: 30 DAYS, ADVANCE, COD."
                      >
                        <Input
                          value={customerPaymentTerms}
                          onChange={e => setCustomerPaymentTerms(e.target.value)}
                          placeholder="30 DAYS"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="customer-credit-limit"
                        label="Credit Limit"
                        description="Maximum approved outstanding amount."
                      >
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={customerCreditLimit}
                          onChange={e => setCustomerCreditLimit(e.target.value)}
                          placeholder="0.00"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="customer-remarks"
                        label="Remarks"
                      >
                        <Input
                          value={customerRemarks}
                          onChange={e => setCustomerRemarks(e.target.value)}
                          placeholder="Commercial notes"
                          className="input-glass"
                        />
                      </FormField>
                    </div>
                  </section>

                  {/* Record Status */}
                  {editCustomerId && (
                    <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                            Record Status
                          </div>
                          <p className="mt-1 text-xs text-fg-muted">
                            Inactive customers remain in history but are excluded from active workflows.
                          </p>
                        </div>

                        <label className="flex cursor-pointer items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={customerActive}
                            onChange={e => setCustomerActive(e.target.checked)}
                            className="h-4 w-4 rounded border-border"
                          />
                          <span className="font-medium text-fg">
                            Active Customer
                          </span>
                        </label>
                      </div>
                    </section>
                  )}

                  {/* Form Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-5">
                    <div>
                      <div className="text-sm font-semibold text-fg">
                        {editCustomerId
                          ? "Update customer master"
                          : "Register new customer"}
                      </div>
                      <p className="mt-0.5 text-[10px] text-fg-muted">
                        Customer changes are processed through the protected database workflow.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="glass"
                        onClick={() => setMasterOverlay(null)}
                      >
                        Cancel
                      </Button>

                      <Button type="submit">
                        {editCustomerId
                          ? "Update Customer"
                          : "Register Customer"}
                      </Button>
                    </div>
                  </div>
                </form>
              )}

              {activeSubTab === "Vendors" && masterOverlay === "list" && (
                <div className="space-y-5">

                  {/* Directory Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Vendor Directory
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Search and manage vendors used across fleet and
                        operational transactions.
                      </p>
                    </div>

                    <div className="rounded-full border border-border/70 bg-surface/50 px-3 py-1.5 text-[10px] font-semibold text-fg-secondary">
                      {filteredVendors.length}{" "}
                      {filteredVendors.length === 1 ? "Vendor" : "Vendors"}
                    </div>
                  </div>

                  {/* Search */}
                  <div className="liquid-glass-soft rounded-2xl border border-border/70 p-4">
                    <Input
                      type="search"
                      value={vendorSearch}
                      onChange={e =>
                        setVendorSearch(e.target.value)
                      }
                      placeholder="Search vendor, category, subcategory or phone..."
                      className="input-glass"
                    />
                  </div>

                  {/* Directory */}
                  <div className="overflow-hidden rounded-2xl border border-border/70 bg-surface/30">
                    <div className="overflow-x-auto">
                      <Table className="min-w-full text-xs">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Tax</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">
                              Action
                            </TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {paginatedVendors.map(v => (
                            <TableRow key={v.vendor_id}>

                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-surface/50 text-xs font-bold text-fg-secondary">
                                    {(v.vendor_name || "V")
                                      .trim()
                                      .charAt(0)
                                      .toUpperCase()}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="truncate font-semibold text-fg-primary">
                                      {v.vendor_name || "-"}
                                    </div>

                                    <div className="mt-0.5 truncate text-[10px] text-fg-muted">
                                      {v.email || "No email registered"}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>

                              <TableCell>
                                <div>
                                  <span className="inline-flex rounded-full border border-border/70 bg-surface/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-fg-secondary">
                                    {v.vendor_type || "GENERAL"}
                                  </span>

                                  {v.vendor_subcategory && (
                                    <div className="mt-1 text-[10px] text-fg-muted">
                                      {v.vendor_subcategory}
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-xs text-fg-secondary">
                                    {v.phone_number || "No phone"}
                                  </span>

                                  <span className="mt-0.5 text-[10px] text-fg-muted">
                                    {v.address || "No address"}
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell>
                                <span className="font-mono text-[10px] text-fg-secondary">
                                  {v.tax_number || "-"}
                                </span>
                              </TableCell>

                              <TableCell>
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                                    v.is_active !== false
                                      ? "border-success/20 bg-success-soft text-success"
                                      : "border-border/70 bg-surface/50 text-fg-muted"
                                  }`}
                                >
                                  {v.is_active !== false
                                    ? "ACTIVE"
                                    : "INACTIVE"}
                                </span>
                              </TableCell>

                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="glass"
                                  onClick={() => {
                                    setVendorName(v.vendor_name || "");
                                    setVendorType(
                                      v.vendor_type || "GENERAL"
                                    );
                                    setVendorSubcategory(
                                      v.vendor_subcategory || ""
                                    );
                                    setVendorPhone(
                                      v.phone_number || ""
                                    );
                                    setVendorEmail(v.email || "");
                                    setVendorAddress(
                                      v.address || ""
                                    );
                                    setVendorTaxNumber(
                                      v.tax_number || ""
                                    );
                                    setVendorActive(
                                      v.is_active !== false
                                    );
                                    setEditVendorId(
                                      String(v.vendor_id)
                                    );
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

                    {filteredVendors.length === 0 && (
                      <div className="border-t border-border/70 px-5 py-10 text-center">
                        <div className="text-sm font-semibold text-fg-primary">
                          No vendors found
                        </div>

                        <p className="mt-1 text-xs text-fg-muted">
                          Try a different search term or register a new vendor
                          from the master actions.
                        </p>
                      </div>
                    )}

                    {filteredVendors.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-xs text-fg-secondary">
                        <span>
                          Showing{" "}
                          {((vendorPage - 1) * vendorPageSize) + 1}–
                          {Math.min(
                            vendorPage * vendorPageSize,
                            filteredVendors.length,
                          )}{" "}
                          of {filteredVendors.length}
                        </span>

                        {vendorTotalPages > 1 && (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="xs"
                              variant="glass"
                              disabled={vendorPage === 1}
                              onClick={() =>
                                setVendorPage(page => Math.max(1, page - 1))
                              }
                            >
                              Previous
                            </Button>

                            <span className="min-w-[90px] text-center">
                              Page {vendorPage} of {vendorTotalPages}
                            </span>

                            <Button
                              type="button"
                              size="xs"
                              variant="glass"
                              disabled={vendorPage === vendorTotalPages}
                              onClick={() =>
                                setVendorPage(page =>
                                  Math.min(vendorTotalPages, page + 1),
                                )
                              }
                            >
                              Next
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              )}

              {activeSubTab === "Customers" && masterOverlay === "list" && (
                <div className="space-y-5">

                  {/* Directory Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Customer Directory
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Search and manage customers, billing contacts and approved credit limits.
                      </p>
                    </div>

                    <div className="rounded-full border border-border/70 bg-surface/50 px-3 py-1.5 text-[10px] font-semibold text-fg-secondary">
                      {filteredCustomers.length}{" "}
                      {filteredCustomers.length === 1 ? "Customer" : "Customers"}
                    </div>
                  </div>

                  {/* Search */}
                  <div className="liquid-glass-soft rounded-2xl border border-border/70 p-4">
                    <Input
                      type="search"
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      placeholder="Search code, customer, contact, phone or GST..."
                      className="input-glass"
                    />
                  </div>

                  {/* Directory */}
                  <div className="overflow-hidden rounded-2xl border border-border/70 bg-surface/30">
                    <div className="overflow-x-auto">
                      <Table className="min-w-full text-xs">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead className="text-right">
                              Credit Limit
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">
                              Action
                            </TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {filteredCustomers.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={8}
                                className="py-10 text-center text-xs text-fg-muted"
                              >
                                No customers found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredCustomers.map(c => (
                              <TableRow key={c.customer_id}>
                                <TableCell className="font-mono text-[11px] font-semibold text-fg-secondary">
                                  {c.customer_code}
                                </TableCell>

                                <TableCell>
                                  <div className="font-medium text-fg">
                                    {c.customer_name}
                                  </div>
                                  {c.tax_number && (
                                    <div className="mt-0.5 text-[10px] text-fg-muted">
                                      {c.tax_number}
                                    </div>
                                  )}
                                </TableCell>

                                <TableCell>
                                  <span className="rounded-full border border-border/70 bg-surface/50 px-2 py-1 text-[10px] font-semibold uppercase">
                                    {c.customer_type}
                                  </span>
                                </TableCell>

                                <TableCell className="text-fg-secondary">
                                  {c.contact_person || "—"}
                                </TableCell>

                                <TableCell className="text-fg-secondary">
                                  {c.phone_number || "—"}
                                </TableCell>

                                <TableCell className="text-right font-mono text-[11px] text-fg-secondary">
                                  {Number(c.credit_limit || 0).toLocaleString(
                                    "en-IN",
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    },
                                  )}
                                </TableCell>

                                <TableCell>
                                  <span
                                    className={
                                      c.is_active
                                        ? "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400"
                                        : "rounded-full border border-border/70 bg-surface/50 px-2 py-1 text-[10px] font-semibold text-fg-muted"
                                    }
                                  >
                                    {c.is_active ? "ACTIVE" : "INACTIVE"}
                                  </span>
                                </TableCell>

                                <TableCell className="text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="h-8 rounded-lg px-3 text-[11px]"
                                    onClick={() => {
                                      setEditCustomerId(String(c.customer_id));
                                      setCustomerCode(c.customer_code || "");
                                      setCustomerName(c.customer_name || "");
                                      setCustomerType(
                                        c.customer_type || "CUSTOMER",
                                      );
                                      setCustomerContactPerson(
                                        c.contact_person || "",
                                      );
                                      setCustomerPhone(
                                        c.phone_number || "",
                                      );
                                      setCustomerEmail(c.email || "");
                                      setCustomerTaxNumber(
                                        c.tax_number || "",
                                      );
                                      setCustomerBillingAddress(
                                        c.billing_address || "",
                                      );
                                      setCustomerPaymentTerms(
                                        c.payment_terms || "",
                                      );
                                      setCustomerCreditLimit(
                                        String(c.credit_limit ?? 0),
                                      );
                                      setCustomerRemarks(c.remarks || "");
                                      setCustomerActive(
                                        c.is_active !== false,
                                      );
                                      setMasterOverlay("form");
                                    }}
                                  >
                                    Edit
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                </div>
              )}

              {activeSubTab === "Freight Slabs" && masterOverlay === "form" && (
                <form onSubmit={handleSaveFreight} className="space-y-6">

                  {/* Route Definition */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Route Definition
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Define the origin, destination and cargo profile used for trip planning.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <FormField
                        id="freight-origin"
                        label="Origin"
                        required
                      >
                        <Input
                          value={freightOrigin}
                          onChange={e =>
                            setFreightOrigin(e.target.value.toUpperCase())
                          }
                          placeholder="KOCHI"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="freight-destination"
                        label="Destination"
                        required
                      >
                        <Input
                          value={freightDestination}
                          onChange={e =>
                            setFreightDestination(e.target.value.toUpperCase())
                          }
                          placeholder="TRIVANDRUM"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="freight-cargo-type"
                        label="Cargo Type"
                        required
                      >
                        <Input
                          value={freightCargoType}
                          onChange={e =>
                            setFreightCargoType(e.target.value.toUpperCase())
                          }
                          placeholder="BULK"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="freight-cargo-category"
                        label="Cargo Category"
                        description="Optional classification for reporting and operational rules."
                      >
                        <Input
                          value={freightCargoCategory}
                          onChange={e =>
                            setFreightCargoCategory(e.target.value.toUpperCase())
                          }
                          placeholder="CEMENT"
                          className="input-glass"
                        />
                      </FormField>
                    </div>
                  </section>

                  {/* Commercial Configuration */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Commercial Configuration
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        These values drive freight calculations for the selected route.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <FormField
                        id="freight-capacity"
                        label="Capacity (MT)"
                        required
                      >
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={freightCapacity}
                          onChange={e =>
                            setFreightCapacity(e.target.value)
                          }
                          placeholder="35"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="freight-rate"
                        label="Freight Rate / MT"
                        required
                        description="Base freight rate per metric tonne."
                      >
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={freightRate}
                          onChange={e =>
                            setFreightRate(e.target.value)
                          }
                          placeholder="854"
                          className="input-glass font-mono"
                        />
                      </FormField>

                      <FormField
                        id="freight-standard-km"
                        label="Standard Distance (KM)"
                        required
                        description="Expected route distance used for trip validation."
                      >
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={freightStandardKm}
                          onChange={e =>
                            setFreightStandardKm(e.target.value)
                          }
                          placeholder="200"
                          className="input-glass font-mono"
                        />
                      </FormField>
                    </div>
                  </section>

                  {/* Odometer / Distance Control */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Distance Validation
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Allow controlled distance variation around the standard route KM.
                        These limits will be used by future trip and odometer validation.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        id="freight-min-tolerance"
                        label="Minimum KM Tolerance (%)"
                        required
                        description="Permitted reduction below standard route distance."
                      >
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={freightMinTolerance}
                          onChange={e =>
                            setFreightMinTolerance(e.target.value)
                          }
                          placeholder="10"
                          className="input-glass font-mono"
                        />
                      </FormField>

                      <FormField
                        id="freight-max-tolerance"
                        label="Maximum KM Tolerance (%)"
                        required
                        description="Permitted increase above standard route distance."
                      >
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={freightMaxTolerance}
                          onChange={e =>
                            setFreightMaxTolerance(e.target.value)
                          }
                          placeholder="10"
                          className="input-glass font-mono"
                        />
                      </FormField>
                    </div>

                    <div className="mt-4 rounded-xl border border-info/20 bg-info-soft/40 px-4 py-3 text-xs leading-5 text-fg-secondary">
                      <span className="font-semibold text-info">
                        Example:
                      </span>{" "}
                      A 200 KM standard route with 10% tolerance permits an
                      expected distance range of approximately 180–220 KM.
                    </div>
                  </section>

                  {/* Record Status */}
                  {editFreightId && (
                    <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                      <div className="mb-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                          Master Record Status
                        </div>
                      </div>

                      <FormField
                        id="freight-active"
                        label="Route Status"
                        description="Inactive routes remain available in historical records but should not be used for new operational work."
                      >
                        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border/70 bg-surface/40 px-3 text-sm text-fg-secondary">
                          <input
                            type="checkbox"
                            checked={freightActive}
                            onChange={e =>
                              setFreightActive(e.target.checked)
                            }
                            className="size-4 accent-current"
                          />
                          <span>
                            {freightActive
                              ? "Freight slab is active"
                              : "Freight slab is inactive"}
                          </span>
                        </label>
                      </FormField>
                    </section>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5">
                    <div className="text-xs text-fg-muted">
                      {editFreightId
                        ? "Editing an existing freight route master record."
                        : "Create a route master record for future trip planning."}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="glass"
                        onClick={() => {
                          resetFreightForm();
                          setMasterOverlay(null);
                        }}
                      >
                        Cancel
                      </Button>

                      <Button type="submit">
                        {editFreightId
                          ? "Update Freight Slab"
                          : "Add Freight Slab"}
                      </Button>
                    </div>
                  </div>
                </form>
              )}

              {activeSubTab === "Freight Slabs" && masterOverlay === "list" && (
                <div className="space-y-4">

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Freight & Route Directory
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Route distance, commercial rate and permitted KM variation.
                      </p>
                    </div>

                    <div className="rounded-full border border-border/70 bg-surface/50 px-3 py-1.5 text-[10px] font-semibold text-fg-secondary">
                      {filteredFreight.length}{" "}
                      {filteredFreight.length === 1 ? "Route" : "Routes"}
                    </div>
                  </div>

                  <Input
                    type="search"
                    value={freightSearch}
                    onChange={e => setFreightSearch(e.target.value)}
                    placeholder="Search origin, destination, cargo, category, rate, KM or status..."
                    className="input-glass"
                  />

                  <div className="overflow-x-auto">
                    <Table className="min-w-full text-xs">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Route</TableHead>
                          <TableHead>Cargo</TableHead>
                          <TableHead>Capacity</TableHead>
                          <TableHead>Rate / MT</TableHead>
                          <TableHead>Standard KM</TableHead>
                          <TableHead>Allowed KM</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {paginatedFreight.map(d => {
                          const standardKm = Number(d.standard_km || 0);
                          const minTolerance = Number(
                            d.min_km_tolerance_pct ?? 10,
                          );
                          const maxTolerance = Number(
                            d.max_km_tolerance_pct ?? 10,
                          );

                          const minimumKm = Math.max(
                            0,
                            standardKm * (1 - minTolerance / 100),
                          );

                          const maximumKm =
                            standardKm * (1 + maxTolerance / 100);

                          return (
                            <TableRow key={d.destination_id}>

                              <TableCell>
                                <div className="font-bold text-fg-primary">
                                  {d.origin || "-"} → {d.destination_name || "-"}
                                </div>

                                {d.cargo_category ? (
                                  <div className="mt-1 text-[10px] uppercase tracking-wide text-fg-muted">
                                    {d.cargo_category}
                                  </div>
                                ) : null}
                              </TableCell>

                              <TableCell>
                                <span className="inline-flex items-center rounded-full border border-border/70 bg-surface/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-fg-secondary">
                                  {d.cargo_type || "-"}
                                </span>
                              </TableCell>

                              <TableCell>
                                <span className="font-mono font-semibold">
                                  {d.capacity_tons || "-"}
                                </span>
                                <span className="ml-1 text-[10px] text-fg-muted">
                                  MT
                                </span>
                              </TableCell>

                              <TableCell className="font-mono font-semibold">
                                ₹
                                {Number(
                                  d.freight_rate_per_ton || 0,
                                ).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>

                              <TableCell>
                                <span className="font-mono font-semibold">
                                  {standardKm.toLocaleString("en-IN")}
                                </span>
                                <span className="ml-1 text-[10px] text-fg-muted">
                                  KM
                                </span>
                              </TableCell>

                              <TableCell>
                                <div className="flex flex-col items-start gap-1">
                                  <span className="font-mono font-semibold">
                                    {minimumKm.toFixed(0)}–{maximumKm.toFixed(0)} KM
                                  </span>

                                  <span className="text-[10px] text-fg-muted">
                                    −{minTolerance}% / +{maxTolerance}%
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell>
                                <span
                                  className={
                                    d.is_active !== false
                                      ? "inline-flex items-center rounded-full border border-success/20 bg-success-soft px-2.5 py-1 text-[10px] font-semibold text-success"
                                      : "inline-flex items-center rounded-full border border-danger/20 bg-danger-soft px-2.5 py-1 text-[10px] font-semibold text-danger"
                                  }
                                >
                                  {d.is_active !== false
                                    ? "Active"
                                    : "Inactive"}
                                </span>
                              </TableCell>

                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="glass"
                                  onClick={() => {
                                    setFreightCargoType(
                                      d.cargo_type || "BULK",
                                    );
                                    setFreightOrigin(d.origin || "");
                                    setFreightDestination(
                                      d.destination_name || "",
                                    );
                                    setFreightCapacity(
                                      String(d.capacity_tons || ""),
                                    );
                                    setFreightRate(
                                      String(d.freight_rate_per_ton ?? ""),
                                    );
                                    setFreightStandardKm(
                                      String(d.standard_km ?? "0"),
                                    );
                                    setFreightCargoCategory(
                                      d.cargo_category || "",
                                    );
                                    setFreightMinTolerance(
                                      String(
                                        d.min_km_tolerance_pct ?? "10",
                                      ),
                                    );
                                    setFreightMaxTolerance(
                                      String(
                                        d.max_km_tolerance_pct ?? "10",
                                      ),
                                    );
                                    setFreightActive(
                                      d.is_active !== false,
                                    );
                                    setEditFreightId(
                                      String(d.destination_id),
                                    );
                                    setMasterOverlay("form");
                                  }}
                                >
                                  Edit
                                </Button>
                              </TableCell>

                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {filteredFreight.length === 0 && (
                    <div className="border-t border-border/70 px-5 py-10 text-center">
                      <div className="text-sm font-semibold text-fg-primary">
                        No freight routes found
                      </div>

                      <p className="mt-1 text-xs text-fg-muted">
                        Try a different search term or add a new freight slab
                        from the master actions.
                      </p>
                    </div>
                  )}

                  {filteredFreight.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-xs text-fg-secondary">
                      <span>
                        Showing{" "}
                        {((freightPage - 1) * freightPageSize) + 1}–
                        {Math.min(
                          freightPage * freightPageSize,
                          filteredFreight.length,
                        )}{" "}
                        of {filteredFreight.length}
                      </span>

                      {freightTotalPages > 1 && (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="xs"
                            variant="glass"
                            disabled={freightPage === 1}
                            onClick={() =>
                              setFreightPage(page => Math.max(1, page - 1))
                            }
                          >
                            Previous
                          </Button>

                          <span className="min-w-[90px] text-center">
                            Page {freightPage} of {freightTotalPages}
                          </span>

                          <Button
                            type="button"
                            size="xs"
                            variant="glass"
                            disabled={freightPage === freightTotalPages}
                            onClick={() =>
                              setFreightPage(page =>
                                Math.min(freightTotalPages, page + 1),
                              )
                            }
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeSubTab === "Bata" && masterOverlay === "form" && (
                <form onSubmit={handleSaveBata} className="space-y-6">

                  {/* Bata Rule Definition */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Bata Rule Definition
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Define the route and cargo conditions under which this driver
                        Bata amount applies.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

                      <FormField
                        id="bata-origin"
                        label="Origin"
                        description="Use ALL when the rule applies regardless of origin."
                      >
                        <Input
                          value={bataOrigin}
                          onChange={e =>
                            setBataOrigin(e.target.value.toUpperCase())
                          }
                          placeholder="ALL"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="bata-destination"
                        label="Destination"
                        required
                      >
                        <Input
                          value={bataDestination}
                          onChange={e =>
                            setBataDestination(e.target.value.toUpperCase())
                          }
                          placeholder="TRIVANDRUM"
                          className="input-glass"
                        />
                      </FormField>

                      <FormField
                        id="bata-cargo-type"
                        label="Cargo Type"
                        required
                      >
                        <Input
                          value={bataCargoType}
                          onChange={e =>
                            setBataCargoType(e.target.value.toUpperCase())
                          }
                          placeholder="BULK"
                          className="input-glass"
                        />
                      </FormField>

                    </div>
                  </section>

                  {/* Bata Calculation */}
                  <section className="liquid-glass-soft rounded-2xl border border-border/70 p-5">
                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Bata Configuration
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Configure the capacity and standard Bata amount for this rule.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

                      <FormField
                        id="bata-capacity"
                        label="Capacity (MT)"
                        description="Optional capacity-specific rule."
                      >
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={bataCapacity}
                          onChange={e =>
                            setBataCapacity(e.target.value)
                          }
                          placeholder="35"
                          className="input-glass font-mono"
                        />
                      </FormField>

                      <FormField
                        id="bata-amount"
                        label="Standard Bata (₹)"
                        required
                        description="Default driver Bata amount for the rule."
                      >
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={bataAmount}
                          onChange={e =>
                            setBataAmount(e.target.value)
                          }
                          placeholder="3000"
                          className="input-glass font-mono"
                        />
                      </FormField>

                      <FormField
                        id="bata-vehicle-id"
                        label="Vehicle ID"
                        description="Optional vehicle-specific Bata rule. Leave blank for ALL vehicles."
                      >
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={bataVehicleId}
                          onChange={e =>
                            setBataVehicleId(e.target.value)
                          }
                          placeholder="ALL"
                          className="input-glass font-mono"
                        />
                      </FormField>

                    </div>

                    <div className="mt-4 rounded-xl border border-info/20 bg-info-soft/40 px-4 py-3 text-xs leading-5 text-fg-secondary">
                      <span className="font-semibold text-info">
                        Rule priority:
                      </span>{" "}
                      A vehicle-specific rule can be used when a vehicle ID is
                      supplied; leaving Vehicle ID blank keeps the rule applicable
                      to all vehicles matching the route and cargo conditions.
                    </div>
                  </section>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5">

                    <div className="text-xs text-fg-muted">
                      {editBataId
                        ? "Editing an existing driver Bata master rule."
                        : "Create a driver Bata rule for future trip settlement."}
                    </div>

                    <div className="flex justify-end gap-2">

                      <Button
                        type="button"
                        variant="glass"
                        onClick={() => {
                          resetBataForm();
                          setMasterOverlay(null);
                        }}
                      >
                        Cancel
                      </Button>

                      <Button type="submit">
                        {editBataId
                          ? "Update Bata Rule"
                          : "Add Bata Rule"}
                      </Button>

                    </div>
                  </div>

                </form>
              )}

              {activeSubTab === "Bata" && masterOverlay === "list" && (
                <div className="space-y-4">

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        Driver Bata Directory
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Standard Bata rules by route, cargo, capacity and vehicle.
                      </p>
                    </div>

                    <div className="rounded-full border border-border/70 bg-surface/50 px-3 py-1.5 text-[10px] font-semibold text-fg-secondary">
                      {filteredBata.length}{" "}
                      {filteredBata.length === 1 ? "Rule" : "Rules"}
                    </div>
                  </div>

                  <Input
                    type="search"
                    value={bataSearch}
                    onChange={e => setBataSearch(e.target.value)}
                    placeholder="Search origin, destination, cargo, capacity, vehicle or Bata..."
                    className="input-glass"
                  />

                  <div className="overflow-x-auto">
                    <Table className="min-w-full text-xs">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Route</TableHead>
                          <TableHead>Cargo</TableHead>
                          <TableHead>Capacity</TableHead>
                          <TableHead>Vehicle Scope</TableHead>
                          <TableHead className="text-right">
                            Standard Bata
                          </TableHead>
                          <TableHead className="text-right">
                            Action
                          </TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {paginatedBata.map(b => (
                          <TableRow key={b.bata_rule_id}>

                            <TableCell>
                              <div className="font-bold text-fg-primary">
                                {b.origin || "ALL"} →{" "}
                                {b.destination_name || "-"}
                              </div>

                              <div className="mt-1 text-[10px] uppercase tracking-wide text-fg-muted">
                                {b.origin
                                  ? "Origin-specific rule"
                                  : "All origins"}
                              </div>
                            </TableCell>

                            <TableCell>
                              <span className="inline-flex items-center rounded-full border border-border/70 bg-surface/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-fg-secondary">
                                {b.cargo_type || "-"}
                              </span>
                            </TableCell>

                            <TableCell>
                              {b.capacity_tons ? (
                                <>
                                  <span className="font-mono font-semibold">
                                    {b.capacity_tons}
                                  </span>
                                  <span className="ml-1 text-[10px] text-fg-muted">
                                    MT
                                  </span>
                                </>
                              ) : (
                                <span className="text-fg-muted">
                                  All capacities
                                </span>
                              )}
                            </TableCell>

                            <TableCell>
                              {b.vehicle_id ? (
                                <span className="inline-flex items-center rounded-full border border-info/20 bg-info-soft px-2.5 py-1 text-[10px] font-semibold text-info">
                                  Vehicle #{b.vehicle_id}
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full border border-border/70 bg-surface/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-fg-secondary">
                                  All Vehicles
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="text-right">
                              <span className="font-mono text-sm font-bold text-fg-primary">
                                ₹
                                {Number(
                                  b.standard_bata_inr || 0,
                                ).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </TableCell>

                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="xs"
                                variant="glass"
                                onClick={() => {
                                  setBataOrigin(
                                    b.origin || "ALL",
                                  );
                                  setBataDestination(
                                    b.destination_name || "",
                                  );
                                  setBataCargoType(
                                    b.cargo_type || "BULK",
                                  );
                                  setBataCapacity(
                                    String(b.capacity_tons || ""),
                                  );
                                  setBataAmount(
                                    String(
                                      b.standard_bata_inr ?? "0",
                                    ),
                                  );
                                  setBataVehicleId(
                                    b.vehicle_id
                                      ? String(b.vehicle_id)
                                      : "",
                                  );
                                  setEditBataId(
                                    String(b.bata_rule_id),
                                  );
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

                  {filteredBata.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-surface/30 px-5 py-10 text-center">
                      <div className="text-sm font-semibold text-fg-primary">
                        No Bata rules found
                      </div>

                      <p className="mt-1 text-xs text-fg-muted">
                        {bataRules.length === 0
                          ? "Create the first Bata rule to use it during driver settlement and trip closure."
                          : "Try a different search term or add a new Bata rule from the master actions."}
                      </p>
                    </div>
                  )}

                  {filteredBata.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-xs text-fg-secondary">
                      <span>
                        Showing{" "}
                        {((bataPage - 1) * bataPageSize) + 1}–
                        {Math.min(
                          bataPage * bataPageSize,
                          filteredBata.length,
                        )}{" "}
                        of {filteredBata.length}
                      </span>

                      {bataTotalPages > 1 && (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="xs"
                            variant="glass"
                            disabled={bataPage === 1}
                            onClick={() =>
                              setBataPage(page => Math.max(1, page - 1))
                            }
                          >
                            Previous
                          </Button>

                          <span className="min-w-[90px] text-center">
                            Page {bataPage} of {bataTotalPages}
                          </span>

                          <Button
                            type="button"
                            size="xs"
                            variant="glass"
                            disabled={bataPage === bataTotalPages}
                            onClick={() =>
                              setBataPage(page =>
                                Math.min(bataTotalPages, page + 1),
                              )
                            }
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}

              {activeSubTab === "User Control" && masterOverlay === "list" && (
                <div className="space-y-5">

                  {/* Directory Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
                        User Access Directory
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        Authenticated application users and their assigned ERP roles.
                      </p>
                    </div>

                    <div className="rounded-full border border-border/70 bg-surface/50 px-3 py-1.5 text-[10px] font-semibold text-fg-secondary">
                      {filteredUsers.length}{" "}
                      {filteredUsers.length === 1 ? "User" : "Users"}
                    </div>
                  </div>

                  {/* Security Notice */}
                  <div className="rounded-2xl border border-info/20 bg-info-soft/40 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-info/20 bg-surface/50 text-info">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          className="size-4"
                          aria-hidden="true"
                        >
                          <rect x="5" y="10" width="14" height="10" rx="2" />
                          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                        </svg>
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-info">
                          Protected access directory
                        </div>
                        <p className="mt-1 text-xs leading-5 text-fg-secondary">
                          User authorization data is exposed through a protected
                          database function. Password information is never displayed
                          in this directory.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Input
                    type="search"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Search username, role, access level, user ID or created date..."
                    className="input-glass"
                  />

                  {/* User Directory */}
                  <div className="overflow-hidden rounded-2xl border border-border/70 bg-surface/30">
                    <div className="overflow-x-auto">
                      <Table className="min-w-full text-xs">
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Access Level</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {paginatedUsers.map(u => {
                            const role = String(u.role || "USER").toUpperCase();

                            const roleMeta =
                              role === "SUPERADMIN"
                                ? {
                                    label: "SUPERADMIN",
                                    description: "Full system administration",
                                    className:
                                      "border-danger/20 bg-danger-soft text-danger",
                                  }
                                : role === "ADMIN"
                                  ? {
                                      label: "ADMIN",
                                      description: "Administrative ERP access",
                                      className:
                                        "border-warning/20 bg-warning-soft text-warning",
                                    }
                                  : role === "MANAGER"
                                    ? {
                                        label: "MANAGER",
                                        description: "Management-level access",
                                        className:
                                          "border-info/20 bg-info-soft text-info",
                                      }
                                    : {
                                        label: role,
                                        description: "Standard application access",
                                        className:
                                          "border-border/70 bg-surface/50 text-fg-secondary",
                                      };

                            const createdDate = u.created_at
                              ? new Date(u.created_at)
                              : null;

                            const formattedCreatedDate =
                              createdDate && !Number.isNaN(createdDate.getTime())
                                ? createdDate.toLocaleDateString("en-GB")
                                : "-";

                            return (
                              <TableRow key={u.user_id}>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-surface/50 text-xs font-bold text-fg-secondary">
                                      {(u.username || "U")
                                        .trim()
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>

                                    <div className="min-w-0">
                                      <div className="truncate font-semibold text-fg-primary">
                                        {u.username || "-"}
                                      </div>

                                      <div className="mt-0.5 font-mono text-[10px] text-fg-muted">
                                        User ID #{u.user_id}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${roleMeta.className}`}
                                  >
                                    {roleMeta.label}
                                  </span>
                                </TableCell>

                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-medium text-fg-secondary">
                                      {roleMeta.description}
                                    </span>
                                    <span className="mt-0.5 text-[10px] text-fg-muted">
                                      Controlled by ERP authorization rules
                                    </span>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <span className="font-mono text-xs text-fg-secondary">
                                    {formattedCreatedDate}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {filteredUsers.length === 0 && (
                      <div className="border-t border-border/70 px-5 py-10 text-center">
                        <div className="text-sm font-semibold text-fg-primary">
                          No users found
                        </div>

                        <p className="mt-1 text-xs text-fg-muted">
                          {appUsers.length === 0
                            ? "The current account may not have access to view application users, or no users are configured."
                            : "Try a different search term."}
                        </p>
                      </div>
                    )}

                    {filteredUsers.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-xs text-fg-secondary">
                        <span>
                          Showing{" "}
                          {((userPage - 1) * userPageSize) + 1}–
                          {Math.min(
                            userPage * userPageSize,
                            filteredUsers.length,
                          )}{" "}
                          of {filteredUsers.length}
                        </span>

                        {userTotalPages > 1 && (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="xs"
                              variant="glass"
                              disabled={userPage === 1}
                              onClick={() =>
                                setUserPage(page => Math.max(1, page - 1))
                              }
                            >
                              Previous
                            </Button>

                            <span className="min-w-[90px] text-center">
                              Page {userPage} of {userTotalPages}
                            </span>

                            <Button
                              type="button"
                              size="xs"
                              variant="glass"
                              disabled={userPage === userTotalPages}
                              onClick={() =>
                                setUserPage(page =>
                                  Math.min(userTotalPages, page + 1),
                                )
                              }
                            >
                              Next
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Future Administration Boundary */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface/30 px-4 py-3">
                    <div>
                      <div className="text-xs font-semibold text-fg-secondary">
                        Role administration
                      </div>
                      <p className="mt-0.5 text-[10px] text-fg-muted">
                        Role changes will use a dedicated protected RPC rather
                        than direct table updates.
                      </p>
                    </div>

                    <span className="rounded-full border border-border/70 bg-surface/50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-fg-muted">
                      Protected
                    </span>
                  </div>

                </div>
              )}

          </DialogBody>
        </DialogContent>
        </Dialog>
        </div>
      )}
    </div>
  );
}
