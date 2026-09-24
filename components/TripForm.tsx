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
  const [driverBata, setDriverBata] = useState("");
  const [advance, setAdvance] = useState("");
  const [dieselIssued, setDieselIssued] = useState("");
  const [dieselRate, setDieselRate] = useState("");
  const [tankFull, setTankFull] = useState(false);

  // KM Tracking States
  const [startKm, setStartKm] = useState("");
  const [previousKm, setPreviousKm] = useState<number | null>(null);

  useEffect(() => {
    async function fetchFormContext() {
      const { data: vData } = await supabase.from("vehicles").select("*").eq("is_active", true);
      if (vData) setVehicles(vData);

      const { data: dData } = await supabase.from("drivers").select("*").eq("is_active", true);
      if (dData) setDrivers(dData);

      const { data: tData } = await supabase.from("trips").select("origin, destination").order("created_at", { ascending: false }).limit(300);
      if (tData) {
        const uniqueS = Array.from(new Set(tData.map(t => t.origin).filter(Boolean))) as string[];
        const uniqueD = Array.from(new Set(tData.map(t => t.destination).filter(Boolean))) as string[];
        setHistoricalSources(uniqueS.length ? uniqueS : ["Kochi", "Erode", "Chennai"]);
        setHistoricalDestinations(uniqueD.length ? uniqueD : ["Kochi", "Erode", "Chennai"]);
      }
    }
    fetchFormContext();

    const savedRate = localStorage.getItem("kss_diesel_rate");
    if (savedRate) setDieselRate(savedRate);
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
        setStartKm(String(data));
      } else {
        setPreviousKm(0);
        setStartKm("");
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

  const strictNumberProps = {
    min: "0",
    onWheel: (e: any) => e.currentTarget.blur(),
    onKeyDown: (e: any) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
    }
  };

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
    setTonnage(""); setFreightRevenue(""); setDriverBata(""); setAdvance("");
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
    if (previousKm !== null && Number(startKm) <= previousKm) {
      alert(`SECURITY BLOCK: Starting KM (${startKm}) must be strictly LARGER than the previous recorded end KM (${previousKm}).`); setLoading(false); return;
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
        name: newDriverName, phone_number: newDriverPhone, license_number: newDriverLicense, license_expiry: newDriverExpiry, is_active: true
      }]).select().single();

      if (driverErr) { alert("Failed to register new driver. Error: " + driverErr.message); setLoading(false); setShowConfirm(false); return; }
      finalDriverId = newDriver.id || newDriver.driver_id;
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
              <Select value={driverId} onChange={(e) => setDriverId(e.target.value)} required>
                <option value="">Select driver...</option>
                {drivers.map(d => (
                  <option key={d.driver_id || d.id} value={d.driver_id || d.id}>{d.name}</option>
                ))}
              </Select>
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
            <input type="number" {...strictNumberProps} step="0.01" value={tonnage} onChange={(e) => setTonnage(e.target.value)} className="input-glass" placeholder="0.00" required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">Freight (₹)</label>
            <input type="number" {...strictNumberProps} value={freightRevenue} onChange={(e) => setFreightRevenue(e.target.value)} className="input-glass" placeholder="0.00" required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">Bata (₹)</label>
            <input type="number" {...strictNumberProps} value={driverBata} onChange={(e) => setDriverBata(e.target.value)} className="input-glass" placeholder="0.00" required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">Advance (₹)</label>
            <input type="number" {...strictNumberProps} value={advance} onChange={(e) => setAdvance(e.target.value)} className="input-glass" placeholder="0.00" required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider" title={`Previous: ${previousKm ?? 'N/A'}`}>Start KM</label>
            <input type="number" {...strictNumberProps} value={startKm} onChange={(e) => setStartKm(e.target.value)} className="input-glass font-mono border-accent-border" placeholder={previousKm ? String(previousKm) : "0"} required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold text-fg-secondary mb-1.5 uppercase tracking-wider">Diesel</label>
            <div className="flex gap-1.5">
              <input type="number" {...strictNumberProps} step="0.01" value={dieselIssued} onChange={(e) => setDieselIssued(e.target.value)} className="input-glass font-mono border-accent-border w-1/2" placeholder="L" required title="Diesel Issued (Litres)" />
              <input type="number" {...strictNumberProps} step="0.01" value={dieselRate} onChange={(e) => handleRateChange(e.target.value)} className="input-glass font-mono border-accent-border w-1/2" placeholder="₹/L" required title="Diesel Rate (₹/Litre)" />
            </div>
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
