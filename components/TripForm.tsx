"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertModal } from "@/components/AlertModal";

type TripFormProps = {
  initialOpen?: boolean;
};

export function TripForm({ initialOpen = false }: TripFormProps) {
  const [alertConfig, setAlertConfig] = useState<{
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
    title: string,
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setAlertConfig({
      isOpen: true,
      title,
      message,
      type,
    });
  };

  const closeAlert = () => {
    setAlertConfig((current) => ({
      ...current,
      isOpen: false,
    }));
  };

  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showTripWorkspace, setShowTripWorkspace] = useState(initialOpen);

  // Core Data States
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [freightMasters, setFreightMasters] = useState<any[]>([]);
  const [bataMasters, setBataMasters] = useState<any[]>([]);
  const [historicalSources, setHistoricalSources] = useState<string[]>([]);
  const [historicalDestinations, setHistoricalDestinations] = useState<string[]>([]);

  // Trip Form States
  const [tripDate, setTripDate] = useState(new Date().toISOString().split("T")[0]);
  const [lrNumber, setLrNumber] = useState("");
  const [cargoType, setCargoType] = useState("BULK");
  const [truckId, setTruckId] = useState("");

  // Driver States
  const [driverMode, setDriverMode] = useState<"select" | "manual">("select");
  const [driverId, setDriverId] = useState("");
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");
  const [newDriverLicense, setNewDriverLicense] = useState("");
  const [newDriverExpiry, setNewDriverExpiry] = useState("");

  // Location States
  const [sourceMode, setSourceMode] = useState<"select" | "manual">("select");
  const [source, setSource] = useState("");
  const [destMode, setDestMode] = useState<"select" | "manual">("select");
  const [destination, setDestination] = useState("");

  // Operational & Financial States
  const [tonnage, setTonnage] = useState("");
  const [freightRevenue, setFreightRevenue] = useState("");
  const [freightMasterRate, setFreightMasterRate] = useState<number | null>(null);
  const [freightMasterId, setFreightMasterId] = useState<number | null>(null);
  const [freightMasterStatus, setFreightMasterStatus] = useState("");
  const [driverBata, setDriverBata] = useState("");
  const [bataMasterAmount, setBataMasterAmount] = useState<number | null>(null);
  const [bataMasterStatus, setBataMasterStatus] = useState("");
  const [advance, setAdvance] = useState("");
  const [dieselIssued, setDieselIssued] = useState("");
  const [dieselRate, setDieselRate] = useState("");
  const [tankFull, setTankFull] = useState(false);

  // KM Tracking States
  const [startKm, setStartKm] = useState("");
  const [previousKm, setPreviousKm] = useState<number | null>(null);

  // Immediate validation state
  const [tonnageError, setTonnageError] = useState("");
  const [tonnageAnomaly, setTonnageAnomaly] = useState("");
  const [startKmError, setStartKmError] = useState("");
  const [lastDriverId, setLastDriverId] = useState<string>("");
  const [dieselRateSource, setDieselRateSource] = useState("");
  const [reviewWarnings, setReviewWarnings] = useState<string[]>([]);

  useEffect(() => {
    async function fetchFormContext() {
      const { data: vData } = await supabase.from("vehicles").select("*").eq("is_active", true);
      if (vData) setVehicles(vData);

      const { data: dData } = await supabase
        .from("drivers")
        .select("driver_id, driver_code, full_name, phone_number, license_number, license_expiry_date")
        .eq("is_active", true)
        .order("full_name");
      if (dData) setDrivers(dData);

      const { data: freightData } = await supabase
        .from("destinations_freight_master")
        .select("*")
        .eq("is_active", true);
      if (freightData) setFreightMasters(freightData);

      const { data: bataData } = await supabase
        .from("driver_bata_master")
        .select("*");
      if (bataData) setBataMasters(bataData);

      const { data: latestFuel } = await supabase
        .from("diesel_fuel_logs")
        .select("diesel_rate_per_litre")
        .gt("diesel_rate_per_litre", 0)
        .order("fuel_date", { ascending: false })
        .order("fuel_log_id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestFuel?.diesel_rate_per_litre) {
        const latestRate = String(latestFuel.diesel_rate_per_litre);
        setDieselRate(latestRate);
        setDieselRateSource("Latest recorded fuel rate");
        localStorage.setItem("kss_diesel_rate", latestRate);
      } else {
        const savedRate = localStorage.getItem("kss_diesel_rate");
        if (savedRate) {
          setDieselRate(savedRate);
          setDieselRateSource("Saved local rate");
        }
      }

      const { data: tData } = await supabase.from("trips").select("origin, destination").order("created_at", { ascending: false }).limit(300);
      if (tData) {
        const uniqueS = Array.from(new Set(tData.map(t => t.origin).filter(Boolean))) as string[];
        const uniqueD = Array.from(new Set(tData.map(t => t.destination).filter(Boolean))) as string[];
        setHistoricalSources(uniqueS.length ? uniqueS : ["Kochi", "Erode", "Chennai"]);
        setHistoricalDestinations(uniqueD.length ? uniqueD : ["Kochi", "Erode", "Chennai"]);
      }
    }
    fetchFormContext();

    // Diesel rate is loaded from the latest database record above.
    // localStorage is used only as fallback when no historical rate exists.
  }, [supabase]);

  useEffect(() => {
    async function getPreviousKm() {
      if (!truckId) {
        setPreviousKm(null);
        setStartKm("");
        return;
      }

      const { data, error } = await supabase
        .rpc("get_vehicle_current_odometer", {
          p_vehicle_id: Number(truckId)
        });

      if (error) {
        console.error("Failed to read authoritative odometer:", error);
        setPreviousKm(null);
        setStartKm("");
        return;
      }

      if (data !== null && data !== undefined) {
        setPreviousKm(Number(data));
        setStartKm("");
        setStartKmError("");
      } else {
        setPreviousKm(0);
        setStartKm("");
        setStartKmError("");
      }
    }

    getPreviousKm();
  }, [truckId, supabase]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const type = (v.truck_type || v.cargo_type || "").toUpperCase();
      return type.includes(cargoType) || type === "";
    });
  }, [vehicles, cargoType]);

  const selectedVehicle = useMemo(
    () => vehicles.find(v => String(v.vehicle_id) === truckId) || null,
    [vehicles, truckId]
  );

  const selectedCapacity = Number(selectedVehicle?.carrying_capacity_tons || 0);

  const strictNumberProps = {
    min: "0",
    onWheel: (e: any) => e.currentTarget.blur(),
    onKeyDown: (e: any) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
    }
  };

  useEffect(() => {
    const value = Number(tonnage);

    if (tonnage === "") {
      setTonnageError("");
      setTonnageAnomaly("");
      return;
    }

    if (!Number.isFinite(value) || value <= 0) {
      setTonnageError("Tonnage must be greater than 0 MT.");
      setTonnageAnomaly("");
      return;
    }

    if (selectedCapacity > 0 && value > selectedCapacity) {
      setTonnageError("");
      setTonnageAnomaly(
        `Load exceeds truck capacity of ${selectedCapacity} MT. Confirmation required.`
      );
      return;
    }

    if (value <= 2) {
      setTonnageError("");
      setTonnageAnomaly(
        "Low load anomaly: 2 MT or below. Confirmation required."
      );
      return;
    }

    setTonnageError("");
    setTonnageAnomaly("");
  }, [tonnage, selectedCapacity]);

  const normalize = (value: unknown) =>
    String(value ?? "").trim().toUpperCase();

  const capacityMatches = (masterCapacity: unknown, truckCapacity: number) => {
    if (!masterCapacity || truckCapacity <= 0) return false;

    const raw = normalize(masterCapacity);

    if (raw.includes("/")) {
      return raw
        .split("/")
        .map(Number)
        .some(value => Number.isFinite(value) && Math.abs(value - truckCapacity) < 0.01);
    }

    const value = Number(raw);
    return Number.isFinite(value) && Math.abs(value - truckCapacity) < 0.01;
  };

  useEffect(() => {
    if (!source || !destination || !cargoType || selectedCapacity <= 0) {
      setFreightMasterRate(null);
      setFreightMasterId(null);
      setFreightMasterStatus("");
      return;
    }

    const matches = freightMasters.filter(rule =>
      normalize(rule.cargo_type) === normalize(cargoType) &&
      normalize(rule.origin) === normalize(source) &&
      normalize(rule.destination_name) === normalize(destination) &&
      capacityMatches(rule.capacity_tons, selectedCapacity)
    );

    if (!matches.length) {
      setFreightMasterRate(null);
      setFreightMasterId(null);
      setFreightMasterStatus(
        "No matching Freight Master found — dispatch blocked."
      );
      return;
    }

    const exactCapacity = matches.find(rule =>
      Number(rule.capacity_tons) === selectedCapacity
    );

    const selectedRule = exactCapacity || matches[0];
    const rate = Number(selectedRule.freight_rate_per_ton);
    const selectedMasterId = Number(selectedRule.destination_id);

    if (!Number.isInteger(selectedMasterId) || selectedMasterId <= 0) {
      setFreightMasterRate(null);
      setFreightMasterId(null);
      setFreightMasterStatus(
        "Freight Master record is invalid — dispatch blocked."
      );
      return;
    }

    if (!Number.isFinite(rate) || rate <= 0) {
      setFreightMasterRate(null);
      setFreightMasterId(selectedMasterId);
      setFreightMasterStatus(
        "Freight Master rate is invalid — dispatch blocked."
      );
      return;
    }

    setFreightMasterRate(rate);
    setFreightMasterId(selectedMasterId);
    setFreightMasterStatus("Master Freight rate matched.");
  }, [
    source,
    destination,
    cargoType,
    selectedCapacity,
    freightMasters
  ]);

  useEffect(() => {
    if (freightMasterRate === null || !tonnage) {
      setFreightRevenue("");
      return;
    }

    const load = Number(tonnage);

    if (!Number.isFinite(load) || load <= 0) {
      setFreightRevenue("");
      return;
    }

    setFreightRevenue(
      String(Number((load * freightMasterRate).toFixed(2)))
    );
  }, [tonnage, freightMasterRate]);

  useEffect(() => {
    if (!source || !destination || !cargoType || selectedCapacity <= 0) {
      setBataMasterAmount(null);
      setBataMasterStatus("");
      setDriverBata("");
      return;
    }

    const destinationValue = normalize(destination);
    const cargoValue = normalize(cargoType);
    const originValue = normalize(source);
    const vehicleValue = Number(truckId);

    const matches = bataMasters
      .map(rule => {
        const cargo = normalize(rule.cargo_type);
        const origin = normalize(rule.origin);
        const capacityRaw = normalize(rule.capacity_tons);

        const cargoMatches =
          cargo === cargoValue ||
          cargo === "" ||
          cargo === "ALL";

        const originMatches =
          origin === originValue ||
          origin === "" ||
          origin === "ALL";

        const capacityMatchesRule =
          !capacityRaw ||
          capacityMatches(rule.capacity_tons, selectedCapacity);

        const destinationMatches =
          normalize(rule.destination_name) === destinationValue;

        if (
          !cargoMatches ||
          !originMatches ||
          !capacityMatchesRule ||
          !destinationMatches
        ) {
          return null;
        }

        const vehicleExact =
          Number.isFinite(vehicleValue) &&
          vehicleValue > 0 &&
          Number(rule.vehicle_id) === vehicleValue;

        const capacityExact =
          capacityRaw !== "" &&
          capacityMatches(rule.capacity_tons, selectedCapacity);

        const cargoExact =
          cargo !== "" &&
          cargo !== "ALL" &&
          cargo === cargoValue;

        const originExact =
          origin !== "" &&
          origin !== "ALL" &&
          origin === originValue;

        const specificity =
          (vehicleExact ? 1000 : 0) +
          (capacityExact ? 100 : 0) +
          (cargoExact ? 10 : 0) +
          (originExact ? 1 : 0);

        return {
          rule,
          specificity,
        };
      })
      .filter(
        (
          value
        ): value is {
          rule: any;
          specificity: number;
        } => value !== null
      )
      .sort((a, b) => b.specificity - a.specificity);

    if (!matches.length) {
      setBataMasterAmount(null);
      setBataMasterStatus(
        "No matching Bata Master — dispatch blocked."
      );
      setDriverBata("");
      return;
    }

    const best = matches[0];

    const tied = matches.filter(
      item => item.specificity === best.specificity
    );

    if (tied.length > 1) {
      setBataMasterAmount(null);
      setBataMasterStatus(
        "Multiple equally specific Bata Masters found — dispatch blocked."
      );
      setDriverBata("");
      return;
    }

    const amount = Number(best.rule.standard_bata_inr);

    if (!Number.isFinite(amount) || amount < 0) {
      setBataMasterAmount(null);
      setBataMasterStatus(
        "Bata Master amount is invalid — dispatch blocked."
      );
      setDriverBata("");
      return;
    }

    setBataMasterAmount(amount);
    setDriverBata(String(amount));
    setBataMasterStatus(
      "Master Bata matched — server authoritative."
    );
  }, [
    source,
    destination,
    cargoType,
    selectedCapacity,
    truckId,
    bataMasters
  ]);

  useEffect(() => {
    if (!truckId) {
      setLastDriverId("");
      return;
    }

    const fetchPreviousDriver = async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("primary_driver_id, trip_start_date, created_at")
        .eq("vehicle_id", Number(truckId))
        .not("primary_driver_id", "is", null)
        .order("trip_start_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data?.primary_driver_id) {
        setLastDriverId("");
        return;
      }

      const previousDriver = drivers.find(
        driver => Number(driver.driver_id) === Number(data.primary_driver_id)
      );

      if (previousDriver) {
        setLastDriverId(String(previousDriver.driver_id));
        setDriverId(String(previousDriver.driver_id));
      } else {
        setLastDriverId("");
      }
    };

    fetchPreviousDriver();
  }, [truckId, drivers, supabase]);

  const totalRevenue = Number(freightRevenue || 0);
  const fuelExpense = Number(dieselIssued || 0) * Number(dieselRate || 0);
  const totalExpense = Number(driverBata || 0) + fuelExpense;
  const netMargin = totalRevenue - totalExpense;

  const handleRateChange = (val: string) => {
    setDieselRate(val);
    localStorage.setItem("kss_diesel_rate", val);
  };

  const handleClear = () => {
    setLrNumber(""); setTruckId(""); setDriverId(""); setSource(""); setDestination("");
    setTonnage(""); setFreightRevenue("");
    setDriverBata(""); setAdvance("");
    setDieselIssued(""); setStartKm(""); setTankFull(false); setSuccess(false);
    if (driverMode === "manual") {
      setNewDriverName(""); setNewDriverPhone(""); setNewDriverLicense(""); setNewDriverExpiry(""); setDriverMode("select");
    }
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setReviewWarnings([]);

    const normalizedLr = lrNumber.toUpperCase().trim();
    const normalizedSource = source.toUpperCase().trim();
    const normalizedDestination = destination.toUpperCase().trim();

    // ------------------------------------------------------------
    // STAGE 5 — APPLICATION-LEVEL REQUIRED FIELD GATE
    // Browser `required` attributes remain useful for UX, but
    // critical business validation must also happen here.
    // ------------------------------------------------------------
    const hardErrors: string[] = [];

    if (!tripDate) hardErrors.push("Trip date is required.");
    if (!normalizedLr) hardErrors.push("LR Number is required.");
    if (!truckId) hardErrors.push("Truck selection is required.");
    if (!normalizedSource) hardErrors.push("Origin is required.");
    if (!normalizedDestination) hardErrors.push("Destination is required.");

    if (driverMode === "select") {
      if (!driverId) {
        hardErrors.push("Driver selection is required.");
      }
    } else {
      if (!newDriverName.trim()) hardErrors.push("New driver name is required.");
      if (!newDriverPhone.trim()) hardErrors.push("New driver phone is required.");
    }

    const numericFields: Array<[string, string, boolean]> = [
      ["Tonnage", tonnage, false],
      ["Freight", freightRevenue, true],
      ["Bata", driverBata, true],
      ["Advance", advance, true],
      ["Diesel quantity", dieselIssued, true],
      ["Diesel rate", dieselRate, true],
      ["Starting KM", startKm, false],
    ];

    for (const [label, rawValue, allowZero] of numericFields) {
      if (rawValue === "" || rawValue === null || rawValue === undefined) {
        hardErrors.push(`${label} is required.`);
        continue;
      }

      const value = Number(rawValue);

      if (!Number.isFinite(value)) {
        hardErrors.push(`${label} must be a valid number.`);
        continue;
      }

      if (allowZero ? value < 0 : value <= 0) {
        hardErrors.push(
          allowZero
            ? `${label} cannot be negative.`
            : `${label} must be greater than 0.`
        );
      }
    }

    if (tripDate && !/^\d{4}-\d{2}-\d{2}$/.test(tripDate)) {
      hardErrors.push("Trip date is invalid.");
    }

    if (normalizedLr && !/^[A-Z0-9]+$/.test(normalizedLr)) {
      hardErrors.push("LR Number may contain only letters and numbers.");
    }

    if (tonnageError) {
      hardErrors.push(tonnageError);
    }

    if (startKmError) {
      hardErrors.push(startKmError);
    }

    if (previousKm !== null && Number(startKm) <= previousKm) {
      hardErrors.push(
        `Starting KM (${startKm}) must be strictly greater than the authoritative odometer (${previousKm}).`
      );
    }

    if (hardErrors.length > 0) {
      setLoading(false);
      showAlert(
        "Dispatch Blocked",
        hardErrors
          .map((error, index) => `${index + 1}. ${error}`)
          .join("\n"),
        "error",
      );
      return;
    }

    // ------------------------------------------------------------
    // DUPLICATE LR CHECK
    // ------------------------------------------------------------
    const { data: existingLR, error: lrCheckError } = await supabase
      .from("trips")
      .select("trip_number")
      .eq("trip_number", normalizedLr)
      .maybeSingle();

    if (lrCheckError) {
      setLoading(false);
      showAlert(
        "LR Verification Failed",
        "Unable to verify LR uniqueness. Please try again.",
        "error",
      );
      return;
    }

    if (existingLR) {
      setLoading(false);
      showAlert(
        "Duplicate LR Number",
        `The LR Number "${normalizedLr}" already exists. Dispatch has been blocked.`,
        "error",
      );
      return;
    }

    // ------------------------------------------------------------
    // STAGE 5 — AUTHORITATIVE MASTER CONTROLS
    // ------------------------------------------------------------
    if (freightMasterId === null || freightMasterRate === null) {
      setLoading(false);
      showAlert(
        "Freight Master Required",
        "A valid active Freight Master rate is required. Dispatch has been blocked.",
        "error",
      );
      return;
    }

    if (bataMasterAmount === null || !Number.isFinite(bataMasterAmount)) {
      setLoading(false);
      showAlert(
        "Bata Master Required",
        "No valid Bata Master rule matches this dispatch. Manual Bata entry is not permitted. Dispatch has been blocked.",
        "error",
      );
      return;
    }

    // ------------------------------------------------------------
    // STAGE 6 — ANOMALY / EXPLICIT CONFIRMATION GATE
    // ------------------------------------------------------------
    const warnings: string[] = [];

    if (tonnageAnomaly) {
      warnings.push(tonnageAnomaly);
    }

    setReviewWarnings(warnings);
    setLoading(false);
    setShowConfirm(true);
  };

  const confirmDispatch = async () => {
    setLoading(true);
    let finalDriverId = driverId;
    if (driverMode === "manual") {
      const { data: newDriver, error: driverErr } = await supabase.rpc(
        "create_dispatch_driver_atomic",
        {
          p_full_name: newDriverName,
          p_phone_number: newDriverPhone,
          p_license_number: newDriverLicense,
          p_license_expiry_date: newDriverExpiry,
          p_branch_id: 1,
          p_pin: null
        }
      );

      if (driverErr) {
        showAlert(
          "Driver Registration Failed",
          "Failed to register new driver. Error: " + driverErr.message,
          "error",
        );
        setLoading(false);
        setShowConfirm(false);
        return;
      }

      if (!newDriver) {
        showAlert(
        "Driver Registration Failed",
        "No driver record was returned. The dispatch has been stopped.",
        "error",
      );
        setLoading(false);
        setShowConfirm(false);
        return;
      }

      finalDriverId = newDriver.driver_id;
    }

    const { error } = await supabase.rpc("create_dispatch_trip_atomic", {
      p_trip_number: lrNumber.toUpperCase().trim(),
      p_vehicle_id: Number(truckId),
      p_primary_driver_id: Number(finalDriverId),
      p_trip_start_date: tripDate,
      p_origin: source.toUpperCase().trim(),
      p_destination: destination.toUpperCase().trim(),
      p_tonnage_loaded: Number(tonnage),
      p_freight_revenue: Number(freightRevenue),
      p_fuel_litres: Number(dieselIssued),
      p_fuel_expense: fuelExpense,
      p_driver_bata: Number(driverBata),
      p_cash_advance_issued: Number(advance),
      p_start_km: Number(startKm),
      p_is_tank_full: tankFull,
      p_freight_master_id: freightMasterId
    });

    if (!error) {
      setSuccess(true);
      setShowConfirm(false);
      setShowTripWorkspace(false);
      handleClear();
    } else {
      showAlert(
        "Trip Dispatch Failed",
        "Error dispatching trip: " + error.message,
        "error",
      );
    }
    setLoading(false);
  };

  return (
    <>
      {!showTripWorkspace ? (
        <div className="liquid-glass w-full rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="kss-eyebrow text-accent">Operations · Dispatch</p>
              <h2 className="mt-1 text-xl font-semibold text-fg">Trip Dispatch</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-secondary">
                Create and dispatch a new trip with vehicle, driver, route, freight,
                fuel, odometer, bata, and advance details.
              </p>
            </div>

            <Button
              type="button"
              size="lg"
              className="min-h-11 shrink-0 sm:min-w-48"
              onClick={() => setShowTripWorkspace(true)}
            >
              Open Trip Dispatch
            </Button>
          </div>
        </div>
      ) : null}
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={closeAlert}
      />

      <div className="relative w-full min-w-0 space-y-8">
      <Dialog
        open={showConfirm}
        onOpenChange={(open) => {
          if (!open && !loading) {
            setShowConfirm(false);
          }
        }}
      >
        <DialogContent
          layout="modal"
          size="lg"
          showClose={!loading}
          className="overflow-hidden p-0"
        >
          <DialogHeader className="border-b border-border-subtle px-5 py-4 sm:px-6">
            <p className="kss-eyebrow">Final review</p>
            <DialogTitle className="mt-1 text-lg">
              Confirm trip dispatch
            </DialogTitle>
            <p className="mt-1 text-sm leading-5 text-fg-muted">
              Verify the current trip and financial summary before dispatch.
            </p>
          </DialogHeader>

          <DialogBody className="max-h-[70dvh] overflow-y-auto px-5 py-5 sm:px-6">
            <dl className="divide-y divide-border-subtle rounded-xl border border-border-subtle px-4">
              <div className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-fg-muted">LR number</dt>
                <dd className="font-medium text-fg">{lrNumber.toUpperCase()}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-fg-muted">Total revenue (freight)</dt>
                <dd className="font-medium text-success">
                  ₹{totalRevenue.toLocaleString("en-IN")}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-fg-muted">Total expenses</dt>
                <dd className="font-medium text-danger">
                  ₹{totalExpense.toLocaleString("en-IN")}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-fg-secondary">Expected margin</dt>
                <dd className="font-semibold text-fg">
                  ₹{netMargin.toLocaleString("en-IN")}
                </dd>
              </div>
            </dl>

            <p className="mt-2 text-xs text-fg-muted">
              Operating expenses include master Bata and fuel cost. Cash advance is tracked separately for settlement.
            </p>

            {reviewWarnings.length > 0 ? (
              <div
                className="mt-4 rounded-xl border border-warning/30 bg-warning-soft p-4"
                role="status"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-warning">
                    Review required
                  </p>
                  <StatusBadge variant="warning">
                    {reviewWarnings.length} item
                    {reviewWarnings.length === 1 ? "" : "s"}
                  </StatusBadge>
                </div>

                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-fg-secondary">
                  {reviewWarnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
                  ))}
                </ul>

                <p className="mt-3 border-t border-warning/20 pt-3 text-xs text-fg-muted">
                  Confirm these anomalies before dispatch. Normal values require no additional action.
                </p>
              </div>
            ) : null}
          </DialogBody>

          <div className="flex flex-col-reverse justify-end gap-2 border-t border-border-subtle bg-surface/40 px-5 py-4 sm:flex-row sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={loading}
              className="min-h-11"
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="default"
              onClick={confirmDispatch}
              disabled={loading}
              className="min-h-11"
            >
              {loading ? "Dispatching..." : "Dispatch Trip"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTripWorkspace} onOpenChange={setShowTripWorkspace}>
        <DialogContent
          layout="modal"
          size="full"
          className="flex h-[99dvh] max-h-[99dvh] flex-col overflow-hidden p-0"
        >
          <DialogHeader className="px-5 py-3 sm:px-6">
            <DialogTitle className="text-lg">Trip Dispatch</DialogTitle>
            
          </DialogHeader>

          <DialogBody className="min-h-0 flex-1 overflow-y-auto px-1">
            <div className="mx-auto w-full max-w-[1250px] px-2 pb-1 lg:px-4">
              <form onSubmit={handleReview} className="min-w-0 space-y-2 pb-1">
        <section aria-labelledby="trip-basics-title" className="space-y-1.5 border-b border-border-subtle pb-2">
          <div>
            <p className="kss-eyebrow text-accent">01 · Trip reference</p>
            
          </div>
          <div className="grid min-w-0 grid-cols-1 items-start gap-x-5 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            <FormField id="trip-date" label="Trip date" required>
              <Input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} required />
            </FormField>
            <FormField id="lr-number" label="LR number" required>
              <Input
                type="text"
                value={lrNumber}
                onChange={(e) => setLrNumber(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                placeholder="KSS..."
                className="font-mono uppercase"
                required
                pattern="[A-Za-z0-9]+"
              />
            </FormField>
            <FormField id="cargo-type" label="Cargo type" required>
              <div className="flex min-h-10 gap-2" role="group" aria-label="Cargo type">
                <Button
                  type="button"
                  variant={cargoType === "BULK" ? "default" : "outline"}
                  aria-pressed={cargoType === "BULK"}
                  onClick={() => { setCargoType("BULK"); setTruckId(""); setPreviousKm(null); setStartKm(""); }}
                  className="min-h-10 flex-1"
                >
                  Bulk
                </Button>
                <Button
                  type="button"
                  variant={cargoType === "BAG" ? "default" : "outline"}
                  aria-pressed={cargoType === "BAG"}
                  onClick={() => { setCargoType("BAG"); setTruckId(""); setPreviousKm(null); setStartKm(""); }}
                  className="min-h-10 flex-1"
                >
                  Bag
                </Button>
              </div>
            </FormField>
          </div>
        </section>

        <section aria-labelledby="vehicle-driver-title" className="space-y-1.5 border-b border-border-subtle pb-2">
          <div>
            <p className="kss-eyebrow text-accent">02 · Assignment</p>
            
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-4">
            <FormField
              id="dispatch-vehicle"
              label="Vehicle"
              required
              description={selectedVehicle ? (
                <span>
                  Selected: {selectedVehicle.vehicle_number}
                  {selectedCapacity > 0 ? ` · Capacity ${selectedCapacity} MT` : ""}
                </span>
              ) : undefined}
            >
              <Select value={truckId} onChange={(e) => setTruckId(e.target.value)} required>
                <option value="">Select vehicle...</option>
                {filteredVehicles.map((vehicle) => (
                  <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>{vehicle.vehicle_number}</option>
                ))}
              </Select>
            </FormField>

            <div className="grid max-w-[620px] gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-accent-border bg-accent-soft px-3 py-2"><span className="kss-status-dot bg-accent" /><h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">Driver</h3></div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDriverMode((previous) => previous === "select" ? "manual" : "select")}
                  className="min-h-10"
                >
                  {driverMode === "select" ? "Add driver" : "Choose existing"}
                </Button>
              </div>
              {driverMode === "select" ? (
                <FormField
                  id="dispatch-driver"
                  label="Primary driver"
                  required
                  description={lastDriverId ? "The vehicle's previous driver was selected. You can change it." : undefined}
                >
                  <Select value={driverId} onChange={(e) => setDriverId(e.target.value)} required>
                    <option value="">Select driver...</option>
                    {drivers.map((driver) => (
                      <option key={driver.driver_id} value={driver.driver_id}>
                        {driver.driver_code ? `${driver.driver_code} — ` : ""}{driver.full_name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : (
                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                  <FormField id="new-driver-name" label="Driver name" required>
                    <Input type="text" value={newDriverName} onChange={(e) => setNewDriverName(e.target.value)} required />
                  </FormField>
                  <FormField id="new-driver-phone" label="Phone number" required>
                    <Input type="tel" value={newDriverPhone} onChange={(e) => setNewDriverPhone(e.target.value)} required />
                  </FormField>
                </div>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="route-cargo-title" className="space-y-1.5 border-b border-border-subtle pb-2">
          <div>
            <p className="kss-eyebrow text-accent">03 · Route &amp; load</p>
            
          </div>
          <div className="grid min-w-0 grid-cols-1 items-start gap-x-5 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid content-start gap-1">
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setSourceMode((previous) => previous === "select" ? "manual" : "select")} className="min-h-9 px-2">
                  {sourceMode === "select" ? "Enter new origin" : "Choose from list"}
                </Button>
              </div>
              <FormField
                id="dispatch-origin"
                label="Origin"
                required
                description={undefined}
              >
                {sourceMode === "select" ? (
                  <Select value={source} onChange={(e) => setSource(e.target.value)} required>
                    <option value="">Select origin...</option>
                    {historicalSources.map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                ) : (
                  <Input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Type new origin..." required />
                )}
              </FormField>
            </div>
            <div className="grid content-start gap-1">
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setDestMode((previous) => previous === "select" ? "manual" : "select")} className="min-h-9 px-2">
                  {destMode === "select" ? "Enter new destination" : "Choose from list"}
                </Button>
              </div>
              <FormField
                id="dispatch-destination"
                label="Destination"
                required
                description={undefined}
              >
                {destMode === "select" ? (
                  <Select value={destination} onChange={(e) => setDestination(e.target.value)} required>
                    <option value="">Select destination...</option>
                    {historicalDestinations.map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                ) : (
                  <Input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Type new destination..." required />
                )}
              </FormField>
            </div>
            <FormField
              id="dispatch-tonnage"
              label="Tonnage (MT)"
              required
              error={tonnageError || undefined}
              description={(
                <span className="grid gap-1">
                  {selectedCapacity > 0 ? <span className="text-xs text-fg-muted">Capacity {selectedCapacity} MT</span> : null}
                  {tonnageAnomaly && !tonnageError ? <span className="text-warning">{tonnageAnomaly}</span> : null}
                </span>
              )}
            >
              <Input
                type="number"
                {...strictNumberProps}
                step="0.01"
                value={tonnage}
                onChange={(e) => setTonnage(e.target.value)}
                className={tonnageAnomaly && !tonnageError ? "border-warning" : ""}
                placeholder={selectedCapacity > 0 ? `2–${selectedCapacity}` : "0.00"}
                required
              />
            </FormField>
            <FormField
              id="dispatch-freight"
              label="Freight (₹)"
              required
              description={
                <span className="grid gap-1">
                  {freightMasterRate !== null ? (
                    <>
                      <span>
                        Master rate: ₹{freightMasterRate.toLocaleString("en-IN")}/MT
                      </span>
                      {tonnage ? (
                        <span>
                          Master calculated: ₹{Number(freightRevenue || 0).toLocaleString("en-IN")}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                  <span className={freightMasterRate !== null ? "text-success" : "text-warning"}>
                    {freightMasterStatus || "Select a valid Freight Master route."}
                  </span>
                </span>
              }
            >
              <Input
                type="number"
                {...strictNumberProps}
                step="0.01"
                value={freightRevenue}
                placeholder="Master calculated"
                readOnly
                aria-readonly="true"
                required
              />
            </FormField>
          </div>
        </section>

        <section aria-labelledby="trip-controls-title" className="space-y-1.5 border-b border-border-subtle pb-2">
          <p className="kss-eyebrow text-accent">04 · Odometer &amp; fuel</p>
          <div>
            
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              id="dispatch-start-km"
              label="Start KM"
              required
              error={startKmError || undefined}
              description={previousKm !== null ? `Current odometer: ${previousKm} km` : undefined}
             className="w-full max-w-[210px]">
              <Input
                type="number"
                {...strictNumberProps}
                step="0.1"
                value={startKm}
                onChange={(e) => {
                  const value = e.target.value;
                  setStartKm(value);

                  if (value === "") {
                    setStartKmError("");
                  } else if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
                    setStartKmError("Starting KM must be greater than 0.");
                  } else if (previousKm !== null && Number(value) <= previousKm) {
                    setStartKmError(`Starting KM must be greater than the current authoritative odometer (${previousKm} km).`);
                  } else {
                    setStartKmError("");
                  }
                }}
                className="font-mono"
                placeholder={previousKm !== null ? `> ${previousKm}` : "> 0"}
                required
              />
            </FormField>
            <FormField id="diesel-litres" label="Diesel issued (litres)" required className="w-full max-w-[210px]">
              <Input
                type="number"
                {...strictNumberProps}
                step="0.01"
                value={dieselIssued}
                onChange={(e) => setDieselIssued(e.target.value)}
                className="font-mono"
                placeholder="Litres"
                required
              />
            </FormField>
            <FormField id="diesel-rate" label="Diesel rate (₹/litre)" required description={dieselRateSource ? `${dieselRateSource}. ₹${dieselRate || "0"}/L` : undefined} className="w-full max-w-[210px]">
              <Input
                type="number"
                {...strictNumberProps}
                step="0.01"
                value={dieselRate}
                onChange={(e) => handleRateChange(e.target.value)}
                className="font-mono"
                placeholder="₹/L"
                required
              />
            </FormField>
          </div>
          <FormField id="tank-full" label="Tank full">
            <Input type="checkbox" checked={tankFull} onChange={(e) => setTankFull(e.target.checked)} className="size-4 accent-accent" />
          </FormField>
        </section>

        <section aria-labelledby="driver-pay-title" className="space-y-4 pb-2">
            <p className="kss-eyebrow text-accent">05 · Driver payments</p>
          <div>
            
          </div>
          <div className="grid min-w-0 grid-cols-1 items-start gap-x-5 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              id="driver-bata"
              label="Driver Bata (₹)"
              required
              description={
                <span className={bataMasterAmount !== null ? "text-success" : "text-warning"}>
                  {bataMasterStatus || "Select a valid Bata Master rule."}
                  {bataMasterAmount !== null
                    ? ` · Master Bata: ₹${bataMasterAmount.toLocaleString("en-IN")}`
                    : ""}
                </span>
              }
            >
              <Input
                type="number"
                {...strictNumberProps}
                step="0.01"
                value={driverBata}
                placeholder="Master resolved"
                readOnly
                aria-readonly="true"
                required
              />
            </FormField>
            <FormField id="trip-advance" label="Trip cash advance (₹)" required className="w-full max-w-[210px]">
              <Input type="number" {...strictNumberProps} value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="0.00" required />
            </FormField>
          </div>

          <div className="kss-surface grid grid-cols-1 divide-y divide-border-subtle rounded-md border border-border-subtle sm:grid-cols-3 sm:divide-x sm:divide-y-0" aria-label="Live trip financial summary">
            <div className="px-4 py-3">
              <p className="text-xs text-fg-muted">Total revenue</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-success">₹{totalRevenue.toLocaleString("en-IN")}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-fg-muted">Total expenses</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-danger" title={`Bata (₹${driverBata || 0}) + Fuel (₹${fuelExpense || 0})`}>
                ₹{totalExpense.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-fg-muted">Dispatch contribution</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-fg">₹{netMargin.toLocaleString("en-IN")}</p>
            </div>
          </div>
        </section>

        {success ? (
          <div className="rounded-md border border-success/20 bg-success-soft p-3 text-sm font-medium text-success" role="status">
            Trip successfully registered and dispatched to live telemetry!
          </div>
        ) : null}

        <footer className="sticky bottom-0 z-20 -mx-2 flex flex-col-reverse gap-2 border-t border-border-subtle bg-app/95 px-2 py-2 backdrop-blur-md sm:-mx-3 sm:flex-row sm:justify-end sm:px-3">
          <Button type="button" variant="outline" onClick={handleClear} disabled={loading} className="min-h-11 sm:min-w-28">
            Clear
          </Button>
          <Button type="submit" variant="default" disabled={loading} className="min-h-11 sm:min-w-44">
            {loading ? "Preparing dispatch..." : "Review & Dispatch"}
          </Button>
        </footer>
              </form>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
