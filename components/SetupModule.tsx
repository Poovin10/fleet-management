"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";

export function SetupModule() {
  const supabase = createClient();
  const [activeSetupTab, setActiveSetupTab] = useState<"VEHICLES" | "DRIVERS" | "ROUTES">("VEHICLES");
  const [isLoading, setIsLoading] = useState(false);

  const [alertConfig, setAlertConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info" as "success" | "error" | "info"
  });

  // --- MASTER DATA STATES ---
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);

  // --- FORM VISIBILITY & EDIT STATES ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Vehicle Form State
  const [vNumber, setVNumber] = useState("");
  const [vType, setVType] = useState("BULK CEMENT");
  const [vCapacity, setVCapacity] = useState<number | "">("");
  const [fcExpiry, setFcExpiry] = useState("");
  const [insExpiry, setInsExpiry] = useState("");
  const [qtaxExpiry, setQtaxExpiry] = useState("");
  const [pucExpiry, setPucExpiry] = useState("");
  const [npExpiry, setNpExpiry] = useState("");
  const [spExpiry, setSpExpiry] = useState("");
  const [tankExpiry, setTankExpiry] = useState("");

  // Driver Form State
  const [dCode, setDCode] = useState("");
  const [dName, setDName] = useState("");
  const [dPhone, setDPhone] = useState("");
  const [dLicenseExpiry, setDLicenseExpiry] = useState("");
  const [dPin, setDPin] = useState("");

  // Route / Slab Form State
  const [rOrigin, setROrigin] = useState("");
  const [rDestination, setRDestination] = useState("");
  const [rFreightRate, setRFreightRate] = useState<number | "">("");
  const [rDriverBata, setRDriverBata] = useState<number | "">("");
  const [rHaltBata, setRHaltBata] = useState<number | "">("");

  // Helper date formatter
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    if (!dateStr.includes("-")) return dateStr;
    const parts = dateStr.split("T")[0].split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  };

  // --- DATA FETCHING ---
  const fetchAllMasterData = async () => {
    setIsLoading(true);
    const [vRes, dRes, rRes] = await Promise.all([
      supabase.from("vehicles").select("*").eq("is_active", true).order("vehicle_number"),
      supabase.from("drivers").select("*").eq("is_active", true).order("full_name"),
      supabase.from("routes").select("*").order("origin")
    ]);

    if (vRes.data) setVehicles(vRes.data);
    if (dRes.data) setDrivers(dRes.data);
    if (rRes.data) setRoutes(rRes.data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAllMasterData();
  }, []);

  const resetForms = () => {
    setEditingId(null);
    setIsFormOpen(false);
    
    // Vehicle reset
    setVNumber(""); setVType("BULK CEMENT"); setVCapacity("");
    setFcExpiry(""); setInsExpiry(""); setQtaxExpiry(""); setPucExpiry(""); setNpExpiry(""); setSpExpiry(""); setTankExpiry("");

    // Driver reset
    setDCode(""); setDName(""); setDPhone(""); setDLicenseExpiry(""); setDPin("");

    // Route reset
    setROrigin(""); setRDestination(""); setRFreightRate(""); setRDriverBata(""); setRHaltBata("");
  };

  // --- VEHICLE HANDLERS ---
  const handleEditVehicle = (v: any) => {
    setEditingId(v.vehicle_id);
    setVNumber(v.vehicle_number || "");
    setVType(v.truck_type || "BULK CEMENT");
    setVCapacity(v.carrying_capacity_tons || "");
    setFcExpiry(v.fc_expiry_date || "");
    setInsExpiry(v.insurance_expiry_date || "");
    setQtaxExpiry(v.qtax_expiry_date || "");
    setPucExpiry(v.puc_expiry_date || "");
    setNpExpiry(v.np_expiry_date || "");
    setSpExpiry(v.state_permit_expiry_date || "");
    setTankExpiry(v.tank_cert_expiry_date || "");
    setIsFormOpen(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      vehicle_number: vNumber.trim().toUpperCase(),
      truck_type: vType,
      carrying_capacity_tons: Number(vCapacity) || 0,
      fc_expiry_date: fcExpiry || null,
      insurance_expiry_date: insExpiry || null,
      qtax_expiry_date: qtaxExpiry || null,
      puc_expiry_date: pucExpiry || null,
      np_expiry_date: npExpiry || null,
      state_permit_expiry_date: spExpiry || null,
      tank_cert_expiry_date: tankExpiry || null,
      is_active: true
    };

    let res;
    if (editingId) {
      res = await supabase.from("vehicles").update(payload).eq("vehicle_id", editingId);
    } else {
      res = await supabase.from("vehicles").insert([payload]);
    }

    if (res.error) {
      setAlertConfig({ isOpen: true, title: "Failed", message: res.error.message, type: "error" });
    } else {
      setAlertConfig({ isOpen: true, title: "Success", message: `Vehicle ${editingId ? "updated" : "added"} successfully!`, type: "success" });
      resetForms();
      fetchAllMasterData();
    }
  };

  const handleDeleteVehicle = async (id: number) => {
    if (!confirm("Deactivate this truck? It will no longer appear in active trips.")) return;
    const { error } = await supabase.from("vehicles").update({ is_active: false }).eq("vehicle_id", id);
    if (error) setAlertConfig({ isOpen: true, title: "Error", message: error.message, type: "error" });
    else fetchAllMasterData();
  };

  // --- DRIVER HANDLERS ---
  const handleEditDriver = (d: any) => {
    setEditingId(d.driver_id);
    setDCode(d.driver_code || "");
    setDName(d.full_name || "");
    setDPhone(d.phone_number || "");
    setDLicenseExpiry(d.expiry_date || "");
    setDPin(d.pin || "");
    setIsFormOpen(true);
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      driver_code: dCode.trim().toUpperCase(),
      full_name: dName.trim(),
      phone_number: dPhone.trim(),
      expiry_date: dLicenseExpiry || null,
      is_active: true
    };
    if (dPin) payload.pin = dPin.trim();

    let res;
    if (editingId) {
      res = await supabase.from("drivers").update(payload).eq("driver_id", editingId);
    } else {
      payload.pin = dPin.trim() || "1234";
      res = await supabase.from("drivers").insert([payload]);
    }

    if (res.error) {
      setAlertConfig({ isOpen: true, title: "Failed", message: res.error.message, type: "error" });
    } else {
      setAlertConfig({ isOpen: true, title: "Success", message: `Driver ${editingId ? "updated" : "created"} successfully!`, type: "success" });
      resetForms();
      fetchAllMasterData();
    }
  };

  const handleDeleteDriver = async (id: number) => {
    if (!confirm("Deactivate this driver record?")) return;
    const { error } = await supabase.from("drivers").update({ is_active: false }).eq("driver_id", id);
    if (error) setAlertConfig({ isOpen: true, title: "Error", message: error.message, type: "error" });
    else fetchAllMasterData();
  };

  const handleResetDriverPin = async (driverId: number, driverName: string) => {
    const newPin = prompt(`Enter new 4-digit PIN for ${driverName}:`, "1234");
    if (!newPin || newPin.length !== 4) {
      if (newPin !== null) setAlertConfig({ isOpen: true, title: "Invalid PIN", message: "PIN must be exactly 4 digits.", type: "error" });
      return;
    }

    const { error } = await supabase.from("drivers").update({ pin: newPin }).eq("driver_id", driverId);
    if (error) {
      setAlertConfig({ isOpen: true, title: "Failed", message: error.message, type: "error" });
    } else {
      setAlertConfig({ isOpen: true, title: "PIN Updated", message: `PIN reset to ${newPin} for ${driverName}!`, type: "success" });
      fetchAllMasterData();
    }
  };

  // --- ROUTE & RATE SLAB HANDLERS ---
  const handleEditRoute = (r: any) => {
    setEditingId(r.route_id || r.id);
    setROrigin(r.origin || "");
    setRDestination(r.destination || "");
    setRFreightRate(r.freight_rate_per_mt || "");
    setRDriverBata(r.driver_bata || "");
    setRHaltBata(r.halt_bata || "");
    setIsFormOpen(true);
  };

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      origin: rOrigin.trim().toUpperCase(),
      destination: rDestination.trim().toUpperCase(),
      freight_rate_per_mt: Number(rFreightRate) || 0,
      driver_bata: Number(rDriverBata) || 0,
      halt_bata: Number(rHaltBata) || 0
    };

    let res;
    if (editingId) {
      res = await supabase.from("routes").update(payload).eq("route_id", editingId);
    } else {
      res = await supabase.from("routes").insert([payload]);
    }

    if (res.error) {
      setAlertConfig({ isOpen: true, title: "Failed", message: res.error.message, type: "error" });
    } else {
      setAlertConfig({ isOpen: true, title: "Success", message: "Route & rate slab saved successfully!", type: "success" });
      resetForms();
      fetchAllMasterData();
    }
  };

  const handleDeleteRoute = async (id: number) => {
    if (!confirm("Delete this route rate slab?")) return;
    const { error } = await supabase.from("routes").delete().eq("route_id", id);
    if (error) setAlertConfig({ isOpen: true, title: "Error", message: error.message, type: "error" });
    else fetchAllMasterData();
  };

  const inputStyle = "w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white outline-none focus:ring-1 focus:ring-[#FF5A00] font-semibold text-slate-800";
  const labelStyle = "block text-[10px] font-bold uppercase text-slate-600 mb-1";

  return (
    <div className="space-y-6" style={{ colorScheme: "light" }}>
      <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} />

      {/* SUB-NAVIGATION TABS */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-4 gap-3">
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          {[
            { id: "VEHICLES", label: "🚛 Fleet & Documents" },
            { id: "DRIVERS", label: "👤 Drivers & PINs" },
            { id: "ROUTES", label: "🛣️ Routes & Slabs" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveSetupTab(tab.id as any); resetForms(); }}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${activeSetupTab === tab.id ? "bg-white text-[#FF5A00] shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => { resetForms(); setIsFormOpen(!isFormOpen); }}
          className="px-4 py-2 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold text-xs rounded-xl shadow-sm transition-all"
        >
          {isFormOpen ? "✕ Close Form" : `+ Add New ${activeSetupTab === "VEHICLES" ? "Truck" : activeSetupTab === "DRIVERS" ? "Driver" : "Route"}`}
        </button>
      </div>

      {/* ============================================================ */}
      {/* 1. TRUCK & COMPLIANCE DOCUMENT MASTER */}
      {/* ============================================================ */}
      {activeSetupTab === "VEHICLES" && (
        <div className="space-y-6">
          {isFormOpen && (
            <form onSubmit={handleSaveVehicle} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in">
              <h4 className="text-xs font-black uppercase text-slate-900 border-b pb-2">{editingId ? "Edit Vehicle & Documents" : "Register New Truck"}</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className={labelStyle}>Vehicle Number *</label><input type="text" value={vNumber} onChange={e => setVNumber(e.target.value)} placeholder="e.g. KL-07-CD-1234" className={inputStyle} required /></div>
                <div>
                  <label className={labelStyle}>Truck Body Type</label>
                  <select value={vType} onChange={e => setVType(e.target.value)} className={inputStyle}>
                    <option value="BULK CEMENT">Bulk Cement Bulker</option>
                    <option value="BAG CEMENT">Bag Cement Open/Tarp</option>
                    <option value="TIPPER">Tipper / Aggregate</option>
                  </select>
                </div>
                <div><label className={labelStyle}>Carrying Capacity (MT) *</label><input type="number" step="0.01" value={vCapacity} onChange={e => setVCapacity(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="e.g. 35.0" className={inputStyle} required /></div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <p className="text-[11px] font-black uppercase text-slate-700 mb-2">Statutory Document Expiry Dates</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><label className={labelStyle}>FC Test Expiry</label><input type="date" value={fcExpiry} onChange={e => setFcExpiry(e.target.value)} className={inputStyle} /></div>
                  <div><label className={labelStyle}>Insurance Expiry</label><input type="date" value={insExpiry} onChange={e => setInsExpiry(e.target.value)} className={inputStyle} /></div>
                  <div><label className={labelStyle}>Quarterly Tax</label><input type="date" value={qtaxExpiry} onChange={e => setQtaxExpiry(e.target.value)} className={inputStyle} /></div>
                  <div><label className={labelStyle}>PUC Emission</label><input type="date" value={pucExpiry} onChange={e => setPucExpiry(e.target.value)} className={inputStyle} /></div>
                  <div><label className={labelStyle}>National Permit (NP)</label><input type="date" value={npExpiry} onChange={e => setNpExpiry(e.target.value)} className={inputStyle} /></div>
                  <div><label className={labelStyle}>State Permit</label><input type="date" value={spExpiry} onChange={e => setSpExpiry(e.target.value)} className={inputStyle} /></div>
                  <div><label className={labelStyle}>Tank/Pressure Cert</label><input type="date" value={tankExpiry} onChange={e => setTankExpiry(e.target.value)} className={inputStyle} /></div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={resetForms} className="px-4 py-2 bg-white border border-slate-300 text-slate-600 font-bold text-xs rounded-lg">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[#FF5A00] text-white font-bold text-xs rounded-lg shadow-sm">{editingId ? "Update Truck" : "Save Truck"}</button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <span className="text-xs font-black uppercase text-slate-800">Active Trucks ({vehicles.length})</span>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 sticky top-0 text-slate-600 uppercase">
                  <tr>
                    <th className="p-3 border-b">Vehicle No</th>
                    <th className="p-3 border-b">Type</th>
                    <th className="p-3 border-b">Cap (MT)</th>
                    <th className="p-3 border-b">FC Expiry</th>
                    <th className="p-3 border-b">Insurance</th>
                    <th className="p-3 border-b">Q-Tax</th>
                    <th className="p-3 border-b">PUC</th>
                    <th className="p-3 border-b text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {vehicles.map(v => (
                    <tr key={v.vehicle_id} className="hover:bg-slate-50">
                      <td className="p-3 font-black text-slate-900">{v.vehicle_number}</td>
                      <td className="p-3 text-slate-600">{v.truck_type}</td>
                      <td className="p-3 font-bold">{v.carrying_capacity_tons} MT</td>
                      <td className="p-3">{formatDate(v.fc_expiry_date)}</td>
                      <td className="p-3">{formatDate(v.insurance_expiry_date)}</td>
                      <td className="p-3">{formatDate(v.qtax_expiry_date)}</td>
                      <td className="p-3">{formatDate(v.puc_expiry_date)}</td>
                      <td className="p-3 text-center space-x-2">
                        <button onClick={() => handleEditVehicle(v)} className="text-blue-600 hover:text-blue-800 font-bold">Edit</button>
                        <button onClick={() => handleDeleteVehicle(v.vehicle_id)} className="text-rose-600 hover:text-rose-800 font-bold">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. DRIVER MASTER & PIN SECURITY */}
      {/* ============================================================ */}
      {activeSetupTab === "DRIVERS" && (
        <div className="space-y-6">
          {isFormOpen && (
            <form onSubmit={handleSaveDriver} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in">
              <h4 className="text-xs font-black uppercase text-slate-900 border-b pb-2">{editingId ? "Edit Driver Details" : "Register New Driver"}</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div><label className={labelStyle}>Driver Code *</label><input type="text" value={dCode} onChange={e => setDCode(e.target.value)} placeholder="e.g. DRV012" className={inputStyle} required /></div>
                <div><label className={labelStyle}>Full Name *</label><input type="text" value={dName} onChange={e => setDName(e.target.value)} placeholder="Full Name" className={inputStyle} required /></div>
                <div><label className={labelStyle}>Mobile Phone</label><input type="text" value={dPhone} onChange={e => setDPhone(e.target.value)} placeholder="10-digit number" className={inputStyle} /></div>
                <div><label className={labelStyle}>License Expiry</label><input type="date" value={dLicenseExpiry} onChange={e => setDLicenseExpiry(e.target.value)} className={inputStyle} /></div>
                {!editingId && (
                  <div><label className={labelStyle}>Default Security PIN</label><input type="password" maxLength={4} value={dPin} onChange={e => setDPin(e.target.value)} placeholder="Default: 1234" className={inputStyle} /></div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={resetForms} className="px-4 py-2 bg-white border border-slate-300 text-slate-600 font-bold text-xs rounded-lg">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[#FF5A00] text-white font-bold text-xs rounded-lg shadow-sm">{editingId ? "Update Driver" : "Save Driver"}</button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <span className="text-xs font-black uppercase text-slate-800">Drivers ({drivers.length})</span>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 sticky top-0 text-slate-600 uppercase">
                  <tr>
                    <th className="p-3 border-b">Code</th>
                    <th className="p-3 border-b">Full Name</th>
                    <th className="p-3 border-b">Phone</th>
                    <th className="p-3 border-b">License Expiry</th>
                    <th className="p-3 border-b">Mobile PIN</th>
                    <th className="p-3 border-b text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {drivers.map(d => (
                    <tr key={d.driver_id} className="hover:bg-slate-50">
                      <td className="p-3 font-black text-slate-900">{d.driver_code}</td>
                      <td className="p-3 font-semibold text-slate-800">{d.full_name}</td>
                      <td className="p-3 text-slate-600">{d.phone_number || "-"}</td>
                      <td className="p-3">{formatDate(d.expiry_date)}</td>
                      <td className="p-3 font-mono font-black text-[#FF5A00]">{d.pin ? d.pin : <span className="text-slate-400 font-normal italic">Not Set</span>}</td>
                      <td className="p-3 text-center space-x-2">
                        <button onClick={() => handleResetDriverPin(d.driver_id, d.full_name)} className="text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 font-bold hover:bg-amber-100">Reset PIN</button>
                        <button onClick={() => handleEditDriver(d)} className="text-blue-600 hover:text-blue-800 font-bold">Edit</button>
                        <button onClick={() => handleDeleteDriver(d.driver_id)} className="text-rose-600 hover:text-rose-800 font-bold">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. ROUTE, BATA & FREIGHT SLABS MASTER */}
      {/* ============================================================ */}
      {activeSetupTab === "ROUTES" && (
        <div className="space-y-6">
          {isFormOpen && (
            <form onSubmit={handleSaveRoute} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in">
              <h4 className="text-xs font-black uppercase text-slate-900 border-b pb-2">{editingId ? "Edit Route Slab" : "Create New Route Rate Slab"}</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div><label className={labelStyle}>Origin *</label><input type="text" value={rOrigin} onChange={e => setROrigin(e.target.value)} placeholder="e.g. COCHIN" className={inputStyle} required /></div>
                <div><label className={labelStyle}>Destination *</label><input type="text" value={rDestination} onChange={e => setRDestination(e.target.value)} placeholder="e.g. MUVATTUPUZHA" className={inputStyle} required /></div>
                <div><label className={labelStyle}>Freight / MT (₹)</label><input type="number" step="0.01" value={rFreightRate} onChange={e => setRFreightRate(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="e.g. 450" className={inputStyle} /></div>
                <div><label className={labelStyle}>Driver Bata (₹)</label><input type="number" step="0.01" value={rDriverBata} onChange={e => setRDriverBata(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="e.g. 1200" className={inputStyle} /></div>
                <div><label className={labelStyle}>Halt Bata / Day (₹)</label><input type="number" step="0.01" value={rHaltBata} onChange={e => setRHaltBata(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="e.g. 300" className={inputStyle} /></div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={resetForms} className="px-4 py-2 bg-white border border-slate-300 text-slate-600 font-bold text-xs rounded-lg">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[#FF5A00] text-white font-bold text-xs rounded-lg shadow-sm">{editingId ? "Update Slab" : "Save Slab"}</button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <span className="text-xs font-black uppercase text-slate-800">Preconfigured Route Slabs ({routes.length})</span>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 sticky top-0 text-slate-600 uppercase">
                  <tr>
                    <th className="p-3 border-b">Origin</th>
                    <th className="p-3 border-b">Destination</th>
                    <th className="p-3 border-b">Freight / MT</th>
                    <th className="p-3 border-b">Driver Bata</th>
                    <th className="p-3 border-b">Halt Bata</th>
                    <th className="p-3 border-b text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {routes.map(r => (
                    <tr key={r.route_id || r.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">{r.origin}</td>
                      <td className="p-3 font-bold text-slate-900">{r.destination}</td>
                      <td className="p-3 font-black text-emerald-700">₹{Number(r.freight_rate_per_mt || 0).toFixed(2)}</td>
                      <td className="p-3 font-bold text-[#FF5A00]">₹{Number(r.driver_bata || 0).toFixed(2)}</td>
                      <td className="p-3 text-slate-600">₹{Number(r.halt_bata || 0).toFixed(2)}</td>
                      <td className="p-3 text-center space-x-2">
                        <button onClick={() => handleEditRoute(r)} className="text-blue-600 hover:text-blue-800 font-bold">Edit</button>
                        <button onClick={() => handleDeleteRoute(r.route_id || r.id)} className="text-rose-600 hover:text-rose-800 font-bold">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {routes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">No route slabs defined yet. Click &quot;+ Add New Route&quot; above to create standard slabs.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
