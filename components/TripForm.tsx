"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function TripForm() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
  const [freightMasterStatus, setFreightMasterStatus] = useState("");
  const [freightManualOverride, setFreightManualOverride] = useState(false);
  const [driverBata, setDriverBata] = useState("");
  const [bataMasterAmount, setBataMasterAmount] = useState<number | null>(null);
  const [bataMasterStatus, setBataMasterStatus] = useState("");
  const [bataManualOverride, setBataManualOverride] = useState(false);
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
      setFreightMasterStatus("");
      setFreightManualOverride(false);
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
      setFreightMasterStatus("No matching freight master found — manual freight required.");
      setFreightManualOverride(false);
      return;
    }

    const exactVehicleCapacity = matches.find(rule =>
      Number(rule.capacity_tons) === selectedCapacity
    );

    const selectedRule = exactVehicleCapacity || matches[0];
    const rate = Number(selectedRule.freight_rate_per_ton);

    if (!Number.isFinite(rate) || rate <= 0) {
      setFreightMasterRate(null);
      setFreightMasterStatus("Freight master rate is invalid — manual freight required.");
      return;
    }

    setFreightMasterRate(rate);
    setFreightMasterStatus("Master freight rate matched.");
    setFreightManualOverride(false);
  }, [
    source,
    destination,
    cargoType,
    selectedCapacity,
    freightMasters
  ]);

  useEffect(() => {
    if (freightMasterRate === null || !tonnage || freightManualOverride) return;

    const load = Number(tonnage);

    if (!Number.isFinite(load) || load <= 0) return;

    setFreightRevenue(String(Number((load * freightMasterRate).toFixed(2))));
  }, [tonnage, freightMasterRate, freightManualOverride]);

  useEffect(() => {
    if (!source || !destination || !cargoType || selectedCapacity <= 0) {
      setBataMasterAmount(null);
      setBataMasterStatus("");
      setBataManualOverride(false);
      return;
    }

    const matches = bataMasters.filter(rule =>
      normalize(rule.cargo_type) === normalize(cargoType) &&
      normalize(rule.origin) === normalize(source) &&
      normalize(rule.destination_name) === normalize(destination) &&
      capacityMatches(rule.capacity_tons, selectedCapacity)
    );

    if (!matches.length) {
      setBataMasterAmount(null);
      setBataMasterStatus("No Bata master found — manual Bata required.");
      setBataManualOverride(false);
      return;
    }

    const vehicleSpecific = matches.find(rule =>
      Number(rule.vehicle_id) === Number(truckId)
    );

    const selectedRule = vehicleSpecific || matches[0];
    const amount = Number(selectedRule.standard_bata_inr);

    if (!Number.isFinite(amount) || amount < 0) {
      setBataMasterAmount(null);
      setBataMasterStatus("Bata master amount is invalid — manual Bata required.");
      return;
    }

    setBataMasterAmount(amount);
    setDriverBata(String(amount));
    setBataMasterStatus("Master Bata matched.");
    setBataManualOverride(false);
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
  const totalExpense = Number(driverBata || 0) + Number(advance || 0) + fuelExpense;
  const netMargin = totalRevenue - totalExpense;

  const handleRateChange = (val: string) => {
    setDieselRate(val);
    localStorage.setItem("kss_diesel_rate", val);
  };

  const handleClear = () => {
    setLrNumber(""); setTruckId(""); setDriverId(""); setSource(""); setDestination("");
    setTonnage(""); setFreightRevenue(""); setFreightManualOverride(false);
    setDriverBata(""); setBataManualOverride(false); setAdvance("");
    setDieselIssued(""); setStartKm(""); setTankFull(false); setSuccess(false);
    if (driverMode === "manual") {
      setNewDriverName(""); setNewDriverPhone(""); setNewDriverLicense(""); setNewDriverExpiry(""); setDriverMode("select");
    }
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setSuccess(false);

    if (Number(startKm) < 0 || Number(tonnage) < 0 || Number(freightRevenue) < 0 || Number(driverBata) < 0 || Number(advance) < 0 || Number(dieselIssued) < 0 || Number(dieselRate) < 0) {
      alert("SECURITY BLOCK: Negative values are strictly prohibited."); setLoading(false); return;
    }

    if (tonnageError) {
      alert(`SECURITY BLOCK: ${tonnageError}`);
      setLoading(false);
      return;
    }
    if (startKmError) {
      alert(`SECURITY BLOCK: ${startKmError}`);
      setLoading(false);
      return;
    }

    if (!startKm || Number(startKm) <= 0) {
      alert("SECURITY BLOCK: Starting KM must be greater than 0.");
      setLoading(false);
      return;
    }

    if (previousKm !== null && Number(startKm) <= previousKm) {
      alert(`SECURITY BLOCK: Starting KM (${startKm}) must be strictly LARGER than the previous authoritative odometer (${previousKm}).`);
      setLoading(false);
      return;
    }
    if (lrNumber) {
      const { data: existingLR } = await supabase.from("trips").select("trip_number").eq("trip_number", lrNumber.toUpperCase().trim()).maybeSingle();
      if (existingLR) {
        alert(`SECURITY BLOCK: The LR Number "${lrNumber}" already exists.`); setLoading(false); return;
      }
    }

    setLoading(false);
    setShowConfirm(true);
  };

  const confirmDispatch = async () => {
    setLoading(true);
    let finalDriverId = driverId;
    if (driverMode === "manual") {
      const { data: newDriver, error: driverErr } = await supabase.from("drivers").insert([{
        full_name: newDriverName,
        phone_number: newDriverPhone,
        license_number: newDriverLicense,
        license_expiry_date: newDriverExpiry,
        is_active: true
      }]).select().single();

      if (driverErr) { alert("Failed to register new driver. Error: " + driverErr.message); setLoading(false); setShowConfirm(false); return; }
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
      p_entered_by: "TripForm"
    });

    if (!error) {
      setSuccess(true);
      setShowConfirm(false);
      handleClear();
    } else {
      alert("Error dispatching trip: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 relative">

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl px-4">
          <div className="liquid-glass p-6 sm:p-8 w-full max-w-md scale-in-center">
            <h3 className="text-lg font-bold text-fg mb-2">Confirm Trip Dispatch</h3>
            <p className="text-xs text-fg-secondary mb-6">Verify the calculated operational financials before locking this trip.</p>

            <div className="kss-surface-raised space-y-3 mb-8 p-4">
              <div className="flex justify-between text-xs">
                <span className="text-fg-muted uppercase tracking-wider font-semibold">LR Number:</span>
                <span className="text-fg font-bold">{lrNumber.toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-xs pt-2 border-t border-border-subtle">
                <span className="text-fg-muted uppercase tracking-wider font-semibold">Total Revenue (Freight):</span>
                <span className="text-success font-bold">₹{totalRevenue.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-fg-muted uppercase tracking-wider font-semibold">Total Expenses:</span>
                <span className="text-danger font-bold">₹{totalExpense.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-[10px] text-fg-muted pl-2">
                <span>(Advance + Bata + Fuel Cost)</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-border-subtle">
                <span className="text-fg-secondary uppercase tracking-wider font-bold">Expected Margin:</span>
                <span className="text-fg font-bold">₹{netMargin.toLocaleString('en-IN')}</span>
              </div>
              {tonnageAnomaly && (
                <div className="mt-3 p-3 rounded-xl bg-warning-soft border border-warning/30">
                  <p className="text-[10px] font-bold text-warning uppercase tracking-wider">Load Anomaly — Confirmation Required</p>
                  <p className="text-[10px] text-fg-secondary mt-1">{tonnageAnomaly}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="glass" onClick={() => setShowConfirm(false)} className="px-6 py-3 rounded-full font-bold text-xs">Cancel</Button>
              <Button type="button" variant="default" onClick={confirmDispatch} disabled={loading} className="px-7 py-3 rounded-full text-xs">
                {loading ? "Dispatching..." : "Confirm & Dispatch"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-wide">Dispatch New Trip</h2>
          <p className="text-[11px] text-fg-muted mt-0.5">Unified strict-validation logistics console</p>
        </div>
      </div>

      <form onSubmit={handleReview} className="space-y-4">

        {/* ROW 1: Core Identifiers */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">Trip Date</label>
            <input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} className="input-glass" required />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">LR Number</label>
            <input type="text" value={lrNumber} onChange={(e) => setLrNumber(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))} placeholder="KSS..." className="input-glass uppercase font-mono" required pattern="[A-Za-z0-9]+" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">Cargo Type</label>
            <div className="flex gap-1.5">
              <Button type="button" variant={cargoType === "BULK" ? "default" : "glass"} onClick={() => { setCargoType("BULK"); setTruckId(""); setPreviousKm(null); setStartKm(""); }} className="flex-1 py-2 rounded-full text-[10px] font-bold">BULK</Button>
              <Button type="button" variant={cargoType === "BAG" ? "default" : "glass"} onClick={() => { setCargoType("BAG"); setTruckId(""); setPreviousKm(null); setStartKm(""); }} className="flex-1 py-2 rounded-full text-[10px] font-bold">BAG</Button>
            </div>
          </div>
          <div className="md:col-span-3">
            <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">Assign Truck</label>
            <Select value={truckId} onChange={(e) => setTruckId(e.target.value)} required>
              <option value="" className="text-fg-muted">Select...</option>
              {filteredVehicles.map(v => (
                <option key={v.vehicle_id} value={v.vehicle_id}>{v.vehicle_number}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* ROW 2: Routing & Driver */}
        <div className="kss-surface-raised grid grid-cols-1 md:grid-cols-12 gap-4 p-4">
          <div className="md:col-span-4">
            <div className="flex justify-between items-end mb-1.5">
              <label className="block text-[10px] font-semibold text-accent uppercase tracking-wider">Origin</label>
              <Button type="button" variant="ghost" size="xs" onClick={() => setSourceMode(prev => prev === "select" ? "manual" : "select")} className="h-7 px-2.5 rounded-md bg-accent-soft text-accent border border-accent-border hover:bg-accent/15 uppercase tracking-wider text-[9px] font-bold">
                {sourceMode === "select" ? "+ New" : "≡ List"}
              </Button>
            </div>
            {sourceMode === "select" ? (
              <Select value={source} onChange={(e) => setSource(e.target.value)} required>
                <option value="">Select...</option>
                {historicalSources.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            ) : (
              <input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Type new origin..." className="input-glass" required />
            )}
          </div>

          <div className="md:col-span-4">
            <div className="flex justify-between items-end mb-1.5">
              <label className="block text-[10px] font-semibold text-accent uppercase tracking-wider">Destination</label>
              <Button type="button" variant="ghost" size="xs" onClick={() => setDestMode(prev => prev === "select" ? "manual" : "select")} className="h-7 px-2.5 rounded-md bg-accent-soft text-accent border border-accent-border hover:bg-accent/15 uppercase tracking-wider text-[9px] font-bold">
                {destMode === "select" ? "+ New" : "≡ List"}
              </Button>
            </div>
            {destMode === "select" ? (
              <Select value={destination} onChange={(e) => setDestination(e.target.value)} required>
                <option value="">Select...</option>
                {historicalDestinations.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            ) : (
              <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Type new destination..." className="input-glass" required />
            )}
          </div>

          <div className="md:col-span-4">
            <div className="flex justify-between items-end mb-1.5">
              <label className="block text-[10px] font-semibold text-accent uppercase tracking-wider">Driver</label>
              <Button type="button" variant="ghost" size="xs" onClick={() => setDriverMode(prev => prev === "select" ? "manual" : "select")} className="h-7 px-2.5 rounded-md bg-accent-soft text-accent border border-accent-border hover:bg-accent/15 uppercase tracking-wider text-[9px] font-bold">
                {driverMode === "select" ? "+ New" : "≡ List"}
              </Button>
            </div>
            {driverMode === "select" ? (
              <>
                <Select value={driverId} onChange={(e) => setDriverId(e.target.value)} required>
                  <option value="">Select driver...</option>
                  {drivers.map(d => (
                    <option key={d.driver_id} value={d.driver_id}>
                      {d.driver_code ? `${d.driver_code} — ` : ""}{d.full_name}
                    </option>
                  ))}
                </Select>
                {lastDriverId && (
                  <p className="text-[9px] text-success font-semibold mt-1">
                    Previous driver selected by default — you can change it.
                  </p>
                )}
              </>
            ) : (
              <div className="flex gap-2">
                <input type="text" placeholder="Name" value={newDriverName} onChange={e => setNewDriverName(e.target.value)} className="input-glass" required />
                <input type="tel" placeholder="Phone" value={newDriverPhone} onChange={e => setNewDriverPhone(e.target.value)} className="input-glass" required />
              </div>
            )}
          </div>
        </div>

        {/* ROW 3: Financials & Telemetry */}
        <div className="grid grid-cols-2 md:grid-cols-12 gap-3">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">Tonnage (MT)</label>
            <input
              type="number"
              {...strictNumberProps}
              step="0.01"
              value={tonnage}
              onChange={(e) => setTonnage(e.target.value)}
              className={`input-glass ${tonnageError ? "border-danger focus:border-danger" : tonnageAnomaly ? "border-warning focus:border-warning" : ""}`}
              placeholder={selectedCapacity > 0 ? `2–${selectedCapacity}` : "0.00"}
              required
            />
            {selectedCapacity > 0 && (
              <p className="text-[9px] text-fg-muted mt-1">
                Truck capacity: <span className="font-bold text-fg">{selectedCapacity} MT</span>
              </p>
            )}
            {tonnageError && (
              <p className="text-[9px] text-danger font-semibold mt-1">{tonnageError}</p>
            )}
            {tonnageAnomaly && !tonnageError && (
              <p className="text-[9px] text-warning font-semibold mt-1">{tonnageAnomaly}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">
              Freight (₹)
            </label>
            <input
              type="number"
              {...strictNumberProps}
              step="0.01"
              value={freightRevenue}
              onChange={(e) => {
                setFreightRevenue(e.target.value);
                setFreightManualOverride(
                  freightMasterRate !== null &&
                  Number(e.target.value || 0) !== Number((Number(tonnage || 0) * freightMasterRate).toFixed(2))
                );
              }}
              className={`input-glass ${freightManualOverride ? "border-warning focus:border-warning" : ""}`}
              placeholder="0.00"
              required
            />
            {freightMasterRate !== null && (
              <p className="text-[9px] text-fg-muted mt-1">
                Master: <span className="font-bold text-fg">₹{freightMasterRate.toLocaleString("en-IN")}/MT</span>
                {tonnage && (
                  <> · Calculated: <span className="font-bold text-fg">₹{(Number(tonnage) * freightMasterRate).toLocaleString("en-IN")}</span></>
                )}
              </p>
            )}
            {freightMasterStatus && (
              <p className={`text-[9px] font-semibold mt-1 ${freightManualOverride ? "text-warning" : freightMasterRate !== null ? "text-success" : "text-warning"}`}>
                {freightManualOverride ? "Manual freight override." : freightMasterStatus}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">
              Bata (₹)
            </label>
            <input
              type="number"
              {...strictNumberProps}
              step="0.01"
              value={driverBata}
              onChange={(e) => {
                setDriverBata(e.target.value);
                setBataManualOverride(
                  bataMasterAmount !== null &&
                  Number(e.target.value || 0) !== bataMasterAmount
                );
              }}
              className={`input-glass ${bataManualOverride ? "border-warning focus:border-warning" : ""}`}
              placeholder="0.00"
              required
            />
            {bataMasterAmount !== null && (
              <p className="text-[9px] text-fg-muted mt-1">
                Master Bata: <span className="font-bold text-fg">₹{bataMasterAmount.toLocaleString("en-IN")}</span>
              </p>
            )}
            {bataMasterStatus && (
              <p className={`text-[9px] font-semibold mt-1 ${bataManualOverride ? "text-warning" : bataMasterAmount !== null ? "text-success" : "text-warning"}`}>
                {bataManualOverride ? "Manual Bata override." : bataMasterStatus}
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">Advance (₹)</label>
            <input type="number" {...strictNumberProps} value={advance} onChange={(e) => setAdvance(e.target.value)} className="input-glass" placeholder="0.00" required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider" title={`Previous: ${previousKm ?? 'N/A'}`}>Start KM</label>
            <input
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
              className={`input-glass font-mono border-accent-border ${startKmError ? "border-danger focus:border-danger" : ""}`}
              placeholder={previousKm !== null ? `> ${previousKm}` : "> 0"}
              required
            />
            {previousKm !== null && (
              <p className="text-[9px] text-fg-muted mt-1">
                Current authoritative odometer: <span className="font-bold text-fg">{previousKm} km</span>
              </p>
            )}
            {startKmError && (
              <p className="text-[9px] text-danger font-semibold mt-1">{startKmError}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">Diesel</label>
            <div className="flex gap-1.5">
              <input type="number" {...strictNumberProps} step="0.01" value={dieselIssued} onChange={(e) => setDieselIssued(e.target.value)} className="input-glass font-mono border-accent-border w-1/2" placeholder="L" required title="Diesel Issued (Litres)" />
              <input
                type="number"
                {...strictNumberProps}
                step="0.01"
                value={dieselRate}
                onChange={(e) => handleRateChange(e.target.value)}
                className="input-glass font-mono border-accent-border w-1/2"
                placeholder="₹/L"
                required
                title="Diesel Rate (₹/Litre)"
              />
            </div>
            {dieselRateSource && (
              <p className="text-[9px] text-fg-muted mt-1">
                {dieselRateSource}. <span className="font-bold text-fg">₹{dieselRate || "0"}/L</span>
              </p>
            )}
            <div className="flex items-center mt-2 gap-2">
              <input type="checkbox" checked={tankFull} onChange={(e) => setTankFull(e.target.checked)} className="w-4 h-4 rounded-full input-glass border border-accent-border text-accent focus:ring-0 cursor-pointer appearance-none checked:bg-accent flex items-center justify-center relative after:content-[''] after:w-1 after:h-2 after:border-r-2 after:border-b-2 after:border-black after:rotate-45 after:absolute after:hidden checked:after:block after:-mt-0.5" />
              <span className="text-[9px] text-accent uppercase tracking-wider font-bold">Tank Full</span>
            </div>
          </div>
        </div>

        {/* Live Calculation & Controls Bar */}
        <div className="kss-surface-raised p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
          <div className="flex items-center gap-6 overflow-x-auto pb-2 md:pb-0">
            <div>
              <p className="text-[10px] font-semibold text-fg-muted uppercase tracking-wider mb-0.5">Total Revenue</p>
              <p className="text-sm font-bold text-success">₹{totalRevenue.toLocaleString('en-IN')}</p>
            </div>
            <div className="w-px h-8 bg-border"></div>
            <div>
              <p className="text-[10px] font-semibold text-fg-muted uppercase tracking-wider mb-0.5">Total Expenses</p>
              <p className="text-sm font-bold text-danger" title={`Bata (₹${driverBata || 0}) + Advance (₹${advance || 0}) + Fuel (₹${fuelExpense || 0})`}>
                ₹{totalExpense.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="w-px h-8 bg-border"></div>
            <div>
              <p className="text-[10px] font-semibold text-fg-muted uppercase tracking-wider mb-0.5">Expected Margin</p>
              <p className="text-sm font-bold text-fg">₹{netMargin.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 w-full md:w-auto">
            <Button type="button" variant="glass" onClick={handleClear} className="px-6 py-3 rounded-full font-bold text-xs hover:bg-danger/10 hover:text-danger hover:border-danger/30">
              Clear
            </Button>
            <Button type="submit" variant="default" disabled={loading} className="px-7 py-3 rounded-full text-xs">
              Review & Dispatch
            </Button>
          </div>
        </div>

        {success && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-success text-xs text-center font-bold">
            Trip successfully registered and dispatched to live telemetry!
          </div>
        )}
      </form>
    </div>
  );
}
