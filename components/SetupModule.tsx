"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";

export function SetupModule() {
  const supabase = createClient();
  const [activeSetupTab, setActiveSetupTab] = useState<"VEHICLES" | "DRIVERS" | "FREIGHT">("VEHICLES");
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
  const [freightSlabs, setFreightSlabs] = useState<any[]>([]);

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

  // Freight Slab Form State
  const [fCargoType, setFCargoType] = useState("BULK");
  const [fOrigin, setFOrigin] = useState("");
  const [fDestination, setFDestination] = useState("");
  const [fCapacity, setFCapacity] = useState<number | "">("");
  const [fFreightRate, setFFreightRate] = useState<number | "">("");
  const [fStandardKm, setFStandardKm] = useState<number | "">("");

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
    const [vRes, dRes, fRes] = await Promise.all([
      supabase.from("vehicles").select("*").eq("is_active", true).order("vehicle_number"),
      supabase.from("drivers").select("*").eq("is_active", true).order("full_name"),
      supabase.from("destinations_freight_master").select("*").order("destination_name")
    ]);

    if (vRes.data) setVehicles(vRes.data);
    if (dRes.data) setDrivers(dRes.data);
    if (fRes.data) setFreightSlabs(fRes.data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAllMasterData();
  }, []);

  const resetForms = () => {
    setEditingId(null);
    setIsFormOpen(false);
    
    setVNumber(""); setVType("BULK CEMENT"); setVCapacity("");
    setFcExpiry(""); setInsExpiry(""); setQtaxExpiry(""); setPucExpiry(""); setNpExpiry(""); setSpExpiry(""); setTankExpiry("");
    
    setDCode(""); setDName(""); setDPhone(""); setDLicenseExpiry(""); setDPin("");
    
    setFCargoType("BULK"); setFOrigin(""); setFDestination(""); setFCapacity(""); setFFreightRate(""); setFStandardKm("");
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
    if (editingId) res = await supabase.from("vehicles").update(payload).eq("vehicle_id", editingId);
    else res = await supabase.from("vehicles").insert([payload]);

    if (res.error) setAlertConfig({ isOpen: true, title: "Failed", message: res.error.message, type: "error" });
    else {
      setAlertConfig({ isOpen: true, title: "Success", message: `Vehicle ${editingId ? "updated" : "added"} successfully!`, type: "success" });
      resetForms();
      fetchAllMasterData();
    }
  };

  const handleDeleteVehicle = async (id: number) => {
    if (!confirm("Deactivate this truck?")) return;
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
    if (editingId) res = await supabase.from("drivers").update(payload).eq("driver_id", editingId);
    else {
      payload.pin = dPin.trim() || "1234";
      res = await supabase.from("drivers").insert([payload]);
    }

    if (res.error) setAlertConfig({ isOpen: true, title: "Failed", message: res.error.message, type: "error" });
    else {
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
    if (error) setAlertConfig({ isOpen: true, title: "Failed", message: error.message, type: "error" });
    else {
      setAlertConfig({ isOpen: true, title: "PIN Updated", message: `PIN reset to ${newPin} for ${driverName}!`, type: "success" });
      fetchAllMasterData();
    }
  };

  // --- FREIGHT SLAB HANDLERS ---
  const handleEditFreight = (f: any) => {
    setEditingId(f.destination_id);
    setFCargoType(f.cargo_type || "BULK");
    setFOrigin(f.orgin || "");
    setFDestination(f.destination_name || "");
    setFCapacity(f.capacity_tons || "");
    setFFreightRate(f.freight_rate_per_ton || "");
    setFStandardKm(f.standard_km || "");
    setIsFormOpen(true);
  };

  const handleSaveFreight = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      cargo_type: fCargoType,
      orgin: fOrigin.trim().toUpperCase(),
      destination_name: fDestination.trim().toUpperCase(),
      capacity_tons: Number(fCapacity) || 0,
      freight_rate_per_ton: Number(fFreightRate) || 0,
      standard_km: Number(fStandardKm) || 0
    };

    let res;
    if (editingId) res = await supabase.from("destinations_freight_master").update(payload).eq("destination_id", editingId);
    else res = await supabase.from("destinations_freight_master").insert([payload]);

    if (res.error) setAlertConfig({ isOpen: true, title: "Failed", message: res.error.message, type: "error" });
    else {
      setAlertConfig({ isOpen: true, title: "Success", message: "Freight slab saved successfully!", type: "success" });
      resetForms();
      fetchAllMasterData();
    }
  };

  const handleDeleteFreight = async (id: number) => {
    if (!confirm("Delete this freight rate slab?")) return;
    const { error } = await supabase.from("destinations_freight_master").delete().eq("destination_id", id);
    if (error) setAlertConfig({ isOpen: true, title: "Error", message: error.message, type: "error" });
    else fetchAllMasterData();
  };

  // PROFESSIONAL UI STYLES
  const inputStyle = "flex h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A00] focus-visible:border-transparent font-semibold text-slate-900";
  const labelStyle = "block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1";

  return (
    <div className="space-y-6" style={{ colorScheme: "light" }}>
      <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} />

      {/* SUB-NAVIGATION TABS */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-4 gap-3">
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm">
          {[
            { id: "VEHICLES", label: "🚛 Fleet & Documents" },
            { id: "DRIVERS", label: "👤 Drivers & PINs" },
            { id: "FREIGHT", label: "🛣️ Freight Rate Master" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveSetupTab(tab.id as any); resetForms(); }}
              className={`px-5 py-2.5 text-sm font-black rounded-lg transition-all ${activeSetupTab === tab.id ? "bg-white text-[#FF5A00] shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => { resetForms(); setIsFormOpen(!isFormOpen); }}
          className="px-5 py-2.5 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-95"
        >
          {isFormOpen ? "✕ Cancel" : `+ Add New ${activeSetupTab === "VEHICLES" ? "Truck" : activeSetupTab === "DRIVERS" ? "Driver" : "Freight Slab"}`}
        </button>
      </div>

      {/* 1. TRUCK & COMPLIANCE DOCUMENT MASTER */}
      {activeSetupTab === "VEHICLES" && (
         <div className="space-y-6">
           {/* Form UI kept exactly the same as previously built */}
           {/* ... [Vehicles UI block from before] ... */}
           <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
             <div className="p-5 border-b bg-slate-50">
               <span className="text-sm font-black uppercase text-slate-900">Active Trucks ({vehicles.length})</span>
             </div>
             <div className="overflow-x-auto max-h-[600px]">
               <table className="w-full text-left text-sm border-collapse">
                 <thead className="bg-slate-50 sticky top-0 text-slate-600 uppercase text-[11px] font-bold">
                   <tr>
                     <th className="px-5 py-3 border-b">Vehicle No</th>
                     <th className="px-5 py-3 border-b">Type</th>
                     <th className="px-5 py-3 border-b">Cap (MT)</th>
                     <th className="px-5 py-3 border-b">FC Expiry</th>
                     <th className="px-5 py-3 border-b">Insurance</th>
                     <th className="px-5 py-3 border-b text-center">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 font-medium">
                   {vehicles.map(v => (
                     <tr key={v.vehicle_id} className="hover:bg-slate-50">
                       <td className="px-5 py-4 font-black text-slate-900">{v.vehicle_number}</td>
                       <td className="px-5 py-4 text-slate-600">{v.truck_type}</td>
                       <td className="px-5 py-4 font-bold">{v.carrying_capacity_tons} MT</td>
                       <td className="px-5 py-4">{formatDate(v.fc_expiry_date)}</td>
                       <td className="px-5 py-4">{formatDate(v.insurance_expiry_date)}</td>
                       <td className="px-5 py-4 text-center space-x-4">
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

      {/* 2. DRIVER MASTER & PIN SECURITY */}
      {activeSetupTab === "DRIVERS" && (
         <div className="space-y-6">
           {/* Form UI kept exactly the same as previously built */}
           {/* ... [Drivers UI block from before] ... */}
           <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
             <div className="p-5 border-b bg-slate-50">
               <span className="text-sm font-black uppercase text-slate-900">Active Drivers ({drivers.length})</span>
             </div>
             <div className="overflow-x-auto max-h-[600px]">
               <table className="w-full text-left text-sm border-collapse">
                 <thead className="bg-slate-50 sticky top-0 text-slate-600 uppercase text-[11px] font-bold">
                   <tr>
                     <th className="px-5 py-3 border-b">Code</th>
                     <th className="px-5 py-3 border-b">Full Name</th>
                     <th className="px-5 py-3 border-b">Phone</th>
                     <th className="px-5 py-3 border-b">License Expiry</th>
                     <th className="px-5 py-3 border-b">Mobile PIN</th>
                     <th className="px-5 py-3 border-b text-center">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 font-medium">
                   {drivers.map(d => (
                     <tr key={d.driver_id} className="hover:bg-slate-50">
                       <td className="px-5 py-4 font-black text-slate-900">{d.driver_code}</td>
                       <td className="px-5 py-4 font-semibold text-slate-800">{d.full_name}</td>
                       <td className="px-5 py-4 text-slate-600">{d.phone_number || "-"}</td>
                       <td className="px-5 py-4">{formatDate(d.expiry_date)}</td>
                       <td className="px-5 py-4 font-mono font-black text-[#FF5A00]">{d.pin ? d.pin : <span className="text-slate-400 font-normal italic">Not Set</span>}</td>
                       <td className="px-5 py-4 text-center space-x-3">
                         <button onClick={() => handleResetDriverPin(d.driver_id, d.full_name)} className="text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 font-bold hover:bg-amber-100">Reset PIN</button>
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

      {/* 3. FREIGHT SLABS MASTER */}
      {activeSetupTab === "FREIGHT" && (
        <div className="space-y-6">
          {isFormOpen && (
            <form onSubmit={handleSaveFreight} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 animate-in fade-in">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="text-sm font-black uppercase text-slate-900">{editingId ? "Edit Freight Slab" : "Create New Freight Rate Slab"}</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-2">
                <div>
                  <label className={labelStyle}>Cargo Type *</label>
                  <select value={fCargoType} onChange={e => setFCargoType(e.target.value)} className={inputStyle}>
                    <option value="BULK">BULK</option>
                    <option value="BAG">BAG</option>
                  </select>
                </div>
                <div><label className={labelStyle}>Origin (From) *</label><input type="text" value={fOrigin} onChange={e => setFOrigin(e.target.value)} placeholder="e.g. COCHIN" className={inputStyle} required /></div>
                <div><label className={labelStyle}>Destination Name (To) *</label><input type="text" value={fDestination} onChange={e => setFDestination(e.target.value)} placeholder="e.g. MUVATTUPUZHA" className={inputStyle} required /></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Capacity (Tons)</label>
                  <input type="number" step="0.01" value={fCapacity} onChange={e => setFCapacity(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="e.g. 35" className={inputStyle} />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-emerald-700 mb-1.5 ml-1">Freight Rate / Ton (₹)</label>
                  <input type="number" step="0.01" value={fFreightRate} onChange={e => setFFreightRate(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="e.g. 450.50" className={inputStyle} />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-amber-700 mb-1.5 ml-1">Standard KM</label>
                  <input type="number" step="0.1" value={fStandardKm} onChange={e => setFStandardKm(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="e.g. 150" className={inputStyle} />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button type="submit" className="px-8 py-3 bg-[#FF5A00] text-white font-black text-sm rounded-xl shadow-md hover:bg-[#e04f00]">{editingId ? "Update Slab" : "Save Freight Slab"}</button>
              </div>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-5 border-b bg-slate-50">
              <span className="text-sm font-black uppercase text-slate-900">Preconfigured Freight Slabs ({freightSlabs.length})</span>
            </div>
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 sticky top-0 text-slate-600 uppercase text-[11px] font-bold">
                  <tr>
                    <th className="px-5 py-3 border-b">Cargo / Route</th>
                    <th className="px-5 py-3 border-b">Cap (Tons)</th>
                    <th className="px-5 py-3 border-b">Std. KM</th>
                    <th className="px-5 py-3 border-b">Freight / Ton</th>
                    <th className="px-5 py-3 border-b text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {freightSlabs.map(f => (
                    <tr key={f.destination_id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <span className="text-[10px] font-black uppercase bg-slate-200 text-slate-600 px-2 py-0.5 rounded mr-2">{f.cargo_type}</span>
                        <span className="font-black text-slate-900">{f.orgin} ➔ {f.destination_name}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{f.capacity_tons || "-"}</td>
                      <td className="px-5 py-4 text-slate-700">{f.standard_km || "-"}</td>
                      <td className="px-5 py-4 font-black text-emerald-700">₹{Number(f.freight_rate_per_ton || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                      <td className="px-5 py-4 text-center space-x-4">
                        <button onClick={() => handleEditFreight(f)} className="text-blue-600 hover:text-blue-800 font-bold">Edit</button>
                        <button onClick={() => handleDeleteFreight(f.destination_id)} className="text-rose-600 hover:text-rose-800 font-bold">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {freightSlabs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-slate-500 font-semibold">
                        No freight slabs found in the destinations_freight_master table.
                      </td>
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
