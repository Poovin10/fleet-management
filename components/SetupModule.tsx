"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";

export function SetupModule() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState("TRUCKS");
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);

  const [alertConfig, setAlertConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info" as "success" | "error" | "info"
  });

  // --- DATA STATES ---
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [freightSlabs, setFreightSlabs] = useState<any[]>([]);
  const [bataSlabs, setBataSlabs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // --- VEHICLE FORM ---
  const [vNumber, setVNumber] = useState("");
  const [vVariant, setVVariant] = useState("Bulker (16-Wheel)");
  const [vCapacity, setVCapacity] = useState("35.0");
  const [vOdoWorking, setVOdoWorking] = useState(true);
  const [vFc, setVFc] = useState("");
  const [vIns, setVIns] = useState("");
  const [vQtax, setVQtax] = useState("");
  const [vPuc, setVPuc] = useState("");
  const [vNp, setVNp] = useState("");
  const [vSp, setVSp] = useState("");
  const [vTank, setVTank] = useState("");

  // --- DRIVER FORM ---
  const [dCode, setDCode] = useState("");
  const [dName, setDName] = useState("");
  const [dPhone, setDPhone] = useState("");
  const [dExpiry, setDExpiry] = useState("");

  // --- SLAB FORM ---
  const [sCargo, setSCargo] = useState("BULK");
  const [sOrigin, setSOrigin] = useState("");
  const [sDestination, setSDestination] = useState("");
  const [sRate, setSRate] = useState("");

  // --- BATA FORM ---
  const [bRoute, setBRoute] = useState("");
  const [bDriverBata, setBDriverBata] = useState("");
  const [bHaltBata, setBHaltBata] = useState("");

  const resetForms = () => {
    setEditingId(null);
    setVNumber(""); setVVariant("Bulker (16-Wheel)"); setVCapacity("35.0"); setVOdoWorking(true);
    setVFc(""); setVIns(""); setVQtax(""); setVPuc(""); setVNp(""); setVSp(""); setVTank("");
    setDCode(""); setDName(""); setDPhone(""); setDExpiry("");
    setSCargo("BULK"); setSOrigin(""); setSDestination(""); setSRate("");
    setBRoute(""); setBDriverBata(""); setBHaltBata("");
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    resetForms();
  };

  const fetchAllData = async () => {
    setIsLoading(true);
    const [vRes, dRes, fRes, bRes, aRes] = await Promise.all([
      supabase.from("vehicles").select("*").eq("is_active", true).order("vehicle_number"),
      supabase.from("drivers").select("*").eq("is_active", true).order("full_name"),
      supabase.from("destinations_freight_master").select("*").order("destination_name"),
      supabase.from("driver_bata_master").select("*").order("route_name"),
      // Switched to trip_start_date since updated_at does not exist in your schema
      supabase.from("trips").select("trip_number, trip_status, origin, destination, trip_start_date").order("trip_start_date", { ascending: false }).limit(20)
    ]);

    if (vRes.data) setVehicles(vRes.data);
    if (dRes.data) setDrivers(dRes.data);
    if (fRes.data) setFreightSlabs(fRes.data);
    if (bRes.data) setBataSlabs(bRes.data);
    if (aRes.data) setAuditLogs(aRes.data);
    setIsLoading(false);
  };

  useEffect(() => { fetchAllData(); }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    if (!dateStr.includes("-")) return dateStr;
    const parts = dateStr.split("T")[0].split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  };

  // --- AUTO GENERATE DRIVER CODE ---
  const getNextDriverCode = () => {
    if (drivers.length === 0) return "DRV-001";
    const nums = drivers.map(d => {
      const match = (d.driver_code || "").match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    });
    const nextNum = Math.max(...nums, 0) + 1;
    return `DRV-${String(nextNum).padStart(3, '0')}`;
  };

  const currentDriverCodeDisplay = editingId ? dCode : getNextDriverCode();

  // --- EXTRACT UNIQUE ROUTES FOR BATA DROPDOWN ---
  const uniqueRoutes = Array.from(new Set(freightSlabs.map(f => `${f.orgin} - ${f.destination_name}`))).sort();

  // --- VEHICLE HANDLERS ---
  const handleEditVehicle = (v: any) => {
    setEditingId(v.vehicle_id);
    setVNumber(v.vehicle_number || "");
    setVVariant(v.truck_type || "Bulker (16-Wheel)");
    setVCapacity(v.carrying_capacity_tons ? String(v.carrying_capacity_tons) : "35.0");
    setVFc(v.fc_expiry_date || ""); setVIns(v.insurance_expiry_date || "");
    setVQtax(v.qtax_expiry_date || ""); setVPuc(v.puc_expiry_date || "");
    setVNp(v.np_expiry_date || ""); setVSp(v.state_permit_expiry_date || "");
    setVTank(v.tank_cert_expiry_date || "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      vehicle_number: vNumber.trim().toUpperCase(),
      truck_type: vVariant,
      carrying_capacity_tons: Number(vCapacity) || 0,
      fc_expiry_date: vFc || null, insurance_expiry_date: vIns || null,
      qtax_expiry_date: vQtax || null, puc_expiry_date: vPuc || null,
      np_expiry_date: vNp || null, state_permit_expiry_date: vSp || null,
      tank_cert_expiry_date: vTank || null,
      is_active: true
    };
    
    const res = editingId 
      ? await supabase.from("vehicles").update(payload).eq("vehicle_id", editingId)
      : await supabase.from("vehicles").insert([payload]);
      
    if (res.error) setAlertConfig({ isOpen: true, title: "Error", message: res.error.message, type: "error" });
    else {
      setAlertConfig({ isOpen: true, title: "Success", message: "Truck saved successfully!", type: "success" });
      resetForms(); fetchAllData();
    }
  };

  const handleDeleteVehicle = async (id: number) => {
    if (!confirm("Deactivate this truck?")) return;
    await supabase.from("vehicles").update({ is_active: false }).eq("vehicle_id", id);
    fetchAllData();
  };

  // --- DRIVER HANDLERS ---
  const handleEditDriver = (d: any) => {
    setEditingId(d.driver_id);
    setDCode(d.driver_code || "");
    setDName(d.full_name || "");
    setDPhone(d.phone_number || "");
    setDExpiry(d.expiry_date || "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      driver_code: currentDriverCodeDisplay,
      full_name: dName.trim(),
      phone_number: dPhone.trim(),
      expiry_date: dExpiry || null,
      is_active: true
    };
    if (!editingId) payload.pin = "1234";
    
    const res = editingId 
      ? await supabase.from("drivers").update(payload).eq("driver_id", editingId)
      : await supabase.from("drivers").insert([payload]);

    if (res.error) setAlertConfig({ isOpen: true, title: "Error", message: res.error.message, type: "error" });
    else {
      setAlertConfig({ isOpen: true, title: "Success", message: "Driver saved successfully!", type: "success" });
      resetForms(); fetchAllData();
    }
  };

  const handleDeleteDriver = async (id: number) => {
    if (!confirm("Deactivate this driver?")) return;
    await supabase.from("drivers").update({ is_active: false }).eq("driver_id", id);
    fetchAllData();
  };

  const handleResetDriverPin = async (driverId: number, driverName: string) => {
    const newPin = prompt(`Enter new 4-digit PIN for ${driverName}:`, "1234");
    if (!newPin || newPin.length !== 4) return;
    await supabase.from("drivers").update({ pin: newPin }).eq("driver_id", driverId);
    setAlertConfig({ isOpen: true, title: "Updated", message: `PIN reset for ${driverName}`, type: "success" });
  };

  // --- SLAB HANDLERS ---
  const handleEditSlab = (f: any) => {
    setEditingId(f.destination_id);
    setSCargo(f.cargo_type || "BULK");
    setSOrigin(f.orgin || "");
    setSDestination(f.destination_name || "");
    setSRate(f.freight_rate_per_ton ? String(f.freight_rate_per_ton) : "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveSlab = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      cargo_type: sCargo,
      orgin: sOrigin.trim().toUpperCase(),
      destination_name: sDestination.trim().toUpperCase(),
      freight_rate_per_ton: Number(sRate)
    };
    
    const res = editingId 
      ? await supabase.from("destinations_freight_master").update(payload).eq("destination_id", editingId)
      : await supabase.from("destinations_freight_master").insert([payload]);

    if (res.error) setAlertConfig({ isOpen: true, title: "Error", message: res.error.message, type: "error" });
    else {
      setAlertConfig({ isOpen: true, title: "Success", message: "Freight slab saved successfully!", type: "success" });
      resetForms(); fetchAllData();
    }
  };

  const handleDeleteSlab = async (id: number) => {
    if (!confirm("Delete this freight slab?")) return;
    await supabase.from("destinations_freight_master").delete().eq("destination_id", id);
    fetchAllData();
  };

  // --- BATA HANDLERS ---
  const handleSaveBata = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { 
      route_name: bRoute.trim().toUpperCase(), 
      driver_bata_amount: Number(bDriverBata), 
      halt_bata_amount: Number(bHaltBata) 
    };
    const { error } = await supabase.from("driver_bata_master").insert([payload]);
    if (error) setAlertConfig({ isOpen: true, title: "Error", message: error.message, type: "error" });
    else {
      setAlertConfig({ isOpen: true, title: "Saved", message: "Bata slab saved successfully!", type: "success" });
      resetForms(); fetchAllData();
    }
  };

  const handleDeleteBata = async (routeName: string) => {
    if (!confirm("Delete this bata rule?")) return;
    await supabase.from("driver_bata_master").delete().eq("route_name", routeName);
    fetchAllData();
  };

  // --- STYLING ---
  const inputStyle = "w-full h-12 bg-white border border-slate-200 rounded-[14px] px-4 text-sm font-semibold text-slate-900 outline-none focus:border-[#FF5A00] focus:ring-1 focus:ring-[#FF5A00] shadow-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:border-slate-100";
  const labelStyle = "block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1";
  const buttonStyle = "w-full h-12 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-sm rounded-[14px] transition-colors mt-2 shadow-sm active:scale-[0.98]";
  const cardStyle = "bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm";
  const headingStyle = "text-[13px] font-black uppercase text-slate-900 mb-6 tracking-wide border-b border-slate-100 pb-3 flex justify-between";
  const actionBtnStyle = "text-[10px] font-black px-3 py-1.5 rounded-lg shadow-sm transition-colors border";

  const tabs = [
    { id: "TRUCKS", icon: "🚚", label: "Trucks" },
    { id: "DRIVERS", icon: "👨‍✈️", label: "Drivers" },
    { id: "SLABS", icon: "🛣️", label: "Slabs" },
    { id: "BATA", icon: "💰", label: "Bata" },
    { id: "AUDIT", icon: "📋", label: "System Audit" }
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20" style={{ colorScheme: "light" }}>
      <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} />

      {/* PILL TABS NAVIGATION */}
      <div className="flex flex-wrap gap-2.5 bg-slate-50 p-2 rounded-2xl border border-slate-200">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === t.id ? "bg-[#FF5A00] text-white shadow-md" : "bg-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* 1. TRUCKS */}
      {activeTab === "TRUCKS" && (
        <div className="space-y-6 animate-in fade-in">
          <div className={cardStyle}>
            <h3 className={headingStyle}>
              <span>{editingId ? "EDIT TRUCK" : "ADD NEW TRUCK"}</span>
              {editingId && <button onClick={resetForms} className="text-rose-500 hover:underline">Cancel Edit</button>}
            </h3>
            <form onSubmit={handleSaveVehicle} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelStyle}>Truck No *</label>
                  <input type="text" value={vNumber} onChange={e => setVNumber(e.target.value)} placeholder="E.G. TN 56 F 0452" className={inputStyle} required />
                </div>
                <div>
                  <label className={labelStyle}>Variant</label>
                  <select value={vVariant} onChange={e => setVVariant(e.target.value)} className={inputStyle}>
                    <option value="Bulker (16-Wheel)">Bulker (16-Wheel)</option>
                    <option value="Bulker (14-Wheel)">Bulker (14-Wheel)</option>
                    <option value="Open Body (10-Wheel)">Open Body (10-Wheel)</option>
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Capacity (MT)</label>
                  <input type="number" step="0.1" value={vCapacity} onChange={e => setVCapacity(e.target.value)} placeholder="35.0" className={inputStyle} required />
                </div>
              </div>

              {/* DOCUMENT EXPIRIES */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-[11px] font-black text-slate-800 uppercase tracking-widest mb-4">Document Expiry Dates</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div><label className={labelStyle}>FC Expiry</label><input type="date" value={vFc} onChange={e => setVFc(e.target.value)} className={inputStyle} /></div>
                  <div><label className={labelStyle}>Insurance</label><input type="date" value={vIns} onChange={e => setVIns(e.target.value)} className={inputStyle} /></div>
                  <div><label className={labelStyle}>Q-Tax</label><input type="date" value={vQtax} onChange={e => setVQtax(e.target.value)} className={inputStyle} /></div>
                  <div><label className={labelStyle}>PUC Emission</label><input type="date" value={vPuc} onChange={e => setVPuc(e.target.value)} className={inputStyle} /></div>
                  <div><label className={labelStyle}>National Permit</label><input type="date" value={vNp} onChange={e => setVNp(e.target.value)} className={inputStyle} /></div>
                  <div><label className={labelStyle}>State Permit</label><input type="date" value={vSp} onChange={e => setVSp(e.target.value)} className={inputStyle} /></div>
                  <div><label className={labelStyle}>Tank Cert</label><input type="date" value={vTank} onChange={e => setVTank(e.target.value)} className={inputStyle} /></div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-1 pt-2">
                <input type="checkbox" checked={vOdoWorking} onChange={e => setVOdoWorking(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-[#FF5A00] focus:ring-[#FF5A00]" />
                <label className="text-[13px] font-bold text-slate-700">✅ Odometer Working</label>
              </div>
              <button type="submit" className={buttonStyle}>{editingId ? "Update Truck" : "Save Truck"}</button>
            </form>
          </div>

          <div className={cardStyle}>
             <h3 className={headingStyle}><span>ACTIVE FLEET ({vehicles.length})</span></h3>
             <div className="space-y-3">
               {vehicles.map(v => (
                 <div key={v.vehicle_id} className="p-4 border border-slate-200 rounded-2xl bg-slate-50 flex flex-col sm:flex-row justify-between gap-3">
                   <div>
                     <p className="font-black text-sm text-slate-900">{v.vehicle_number}</p>
                     <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{v.truck_type} • {v.carrying_capacity_tons} MT</p>
                     <div className="flex gap-2 mt-2 flex-wrap">
                       {v.fc_expiry_date && <span className="text-[9px] bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-bold">FC: {formatDate(v.fc_expiry_date)}</span>}
                       {v.insurance_expiry_date && <span className="text-[9px] bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-bold">INS: {formatDate(v.insurance_expiry_date)}</span>}
                     </div>
                   </div>
                   <div className="flex gap-2 items-start">
                     <button onClick={() => handleEditVehicle(v)} className={`${actionBtnStyle} bg-white text-slate-700 border-slate-300 hover:bg-slate-100`}>Edit</button>
                     <button onClick={() => handleDeleteVehicle(v.vehicle_id)} className={`${actionBtnStyle} bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100`}>Deactivate</button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* 2. DRIVERS */}
      {activeTab === "DRIVERS" && (
        <div className="space-y-6 animate-in fade-in">
          <div className={cardStyle}>
            <h3 className={headingStyle}>
              <span>{editingId ? "EDIT DRIVER" : "ADD NEW DRIVER"}</span>
              {editingId && <button onClick={resetForms} className="text-rose-500 hover:underline">Cancel Edit</button>}
            </h3>
            <form onSubmit={handleSaveDriver} className="space-y-5">
              <div>
                <label className={labelStyle}>Driver Code (Auto Generated)</label>
                <input type="text" value={currentDriverCodeDisplay} disabled className={inputStyle} />
              </div>
              <div>
                <label className={labelStyle}>Full Name *</label>
                <input type="text" value={dName} onChange={e => setDName(e.target.value)} placeholder="Driver Name" className={inputStyle} required />
              </div>
              <div>
                <label className={labelStyle}>Mobile Number</label>
                <input type="text" value={dPhone} onChange={e => setDPhone(e.target.value)} placeholder="10-digit number" className={inputStyle} />
              </div>
              <div>
                <label className={labelStyle}>License Expiry Date</label>
                <input type="date" value={dExpiry} onChange={e => setDExpiry(e.target.value)} className={inputStyle} />
              </div>
              <button type="submit" className={buttonStyle}>{editingId ? "Update Driver" : "Save Driver"}</button>
            </form>
          </div>

          <div className={cardStyle}>
             <h3 className={headingStyle}><span>ACTIVE DRIVERS ({drivers.length})</span></h3>
             <div className="space-y-3">
               {drivers.map(d => (
                 <div key={d.driver_id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 border border-slate-200 rounded-2xl bg-slate-50">
                   <div>
                     <p className="font-black text-sm text-slate-900">{d.driver_code} - {d.full_name}</p>
                     <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                       EXP: <span className="text-slate-800">{formatDate(d.expiry_date)}</span> 
                       {d.phone_number && <span className="ml-3">PH: {d.phone_number}</span>}
                     </p>
                   </div>
                   <div className="flex gap-2">
                     <button onClick={() => handleResetDriverPin(d.driver_id, d.full_name)} className={`${actionBtnStyle} bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100`}>Reset PIN</button>
                     <button onClick={() => handleEditDriver(d)} className={`${actionBtnStyle} bg-white text-slate-700 border-slate-300 hover:bg-slate-100`}>Edit</button>
                     <button onClick={() => handleDeleteDriver(d.driver_id)} className={`${actionBtnStyle} bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100`}>Deactivate</button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* 3. SLABS (FREIGHT) */}
      {activeTab === "SLABS" && (
        <div className="space-y-6 animate-in fade-in">
          <div className={cardStyle}>
            <h3 className={headingStyle}>
              <span>{editingId ? "EDIT FREIGHT SLAB" : "ADD FREIGHT SLAB"}</span>
              {editingId && <button onClick={resetForms} className="text-rose-500 hover:underline">Cancel Edit</button>}
            </h3>
            <form onSubmit={handleSaveSlab} className="space-y-5">
              <div>
                <label className={labelStyle}>Cargo Type</label>
                <select value={sCargo} onChange={e => setSCargo(e.target.value)} className={inputStyle}>
                  <option value="BULK">BULK</option>
                  <option value="BAG">BAG</option>
                </select>
              </div>
              <div>
                <label className={labelStyle}>Origin (From) *</label>
                <input type="text" value={sOrigin} onChange={e => setSOrigin(e.target.value)} placeholder="E.G. COCHIN" className={inputStyle} required />
              </div>
              <div>
                <label className={labelStyle}>Destination (To) *</label>
                <input type="text" value={sDestination} onChange={e => setSDestination(e.target.value)} placeholder="E.G. PALAKKAD" className={inputStyle} required />
              </div>
              <div>
                <label className={labelStyle}>Freight Rate / MT (₹) *</label>
                <input type="number" step="0.01" value={sRate} onChange={e => setSRate(e.target.value)} placeholder="450.00" className={inputStyle} required />
              </div>
              <button type="submit" className={buttonStyle}>{editingId ? "Update Slab" : "Save Freight Slab"}</button>
            </form>
          </div>

          <div className={cardStyle}>
             <h3 className={headingStyle}><span>CONFIGURED SLABS ({freightSlabs.length})</span></h3>
             <div className="space-y-3">
               {freightSlabs.map(f => (
                 <div key={f.destination_id} className="p-4 border border-slate-200 rounded-2xl bg-slate-50 flex flex-col sm:flex-row justify-between gap-3">
                   <div>
                     <div className="flex items-center gap-2 mb-2">
                       <span className="text-[9px] font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase tracking-wider">{f.cargo_type}</span>
                       <p className="font-black text-sm text-slate-900">{f.orgin} ➔ {f.destination_name}</p>
                     </div>
                     <p className="text-[11px] text-slate-500 font-bold uppercase">Freight: <span className="text-[#FF5A00] font-black text-xs ml-1">₹{f.freight_rate_per_ton} / MT</span></p>
                   </div>
                   <div className="flex gap-2 items-start">
                     <button onClick={() => handleEditSlab(f)} className={`${actionBtnStyle} bg-white text-slate-700 border-slate-300 hover:bg-slate-100`}>Edit</button>
                     <button onClick={() => handleDeleteSlab(f.destination_id)} className={`${actionBtnStyle} bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100`}>Delete</button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* 4. BATA SLABS */}
      {activeTab === "BATA" && (
        <div className="space-y-6 animate-in fade-in">
          <div className={cardStyle}>
            <h3 className={headingStyle}><span>ADD BATA SLAB</span></h3>
            <form onSubmit={handleSaveBata} className="space-y-5">
              <div>
                <label className={labelStyle}>Route (Origin ➔ Destination) *</label>
                <select value={bRoute} onChange={e => setBRoute(e.target.value)} className={inputStyle} required>
                  <option value="" disabled>Select route from Freight Slabs...</option>
                  {uniqueRoutes.map(route => (
                    <option key={route} value={route}>{route.replace(' - ', ' ➔ ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelStyle}>Driver Bata / Trip (₹) *</label>
                <input type="number" step="0.01" value={bDriverBata} onChange={e => setBDriverBata(e.target.value)} placeholder="1200.00" className={inputStyle} required />
              </div>
              <div>
                <label className={labelStyle}>Halt Bata / Day (₹)</label>
                <input type="number" step="0.01" value={bHaltBata} onChange={e => setBHaltBata(e.target.value)} placeholder="300.00" className={inputStyle} />
              </div>
              <button type="submit" className={buttonStyle}>Save Bata Details</button>
            </form>
          </div>

          <div className={cardStyle}>
             <h3 className={headingStyle}><span>CONFIGURED BATA ({bataSlabs.length})</span></h3>
             <div className="space-y-3">
               {bataSlabs.map((b, idx) => (
                 <div key={idx} className="p-4 border border-slate-200 rounded-2xl bg-slate-50 flex justify-between">
                   <div>
                     <p className="font-black text-sm text-slate-900 mb-2">{b.route_name}</p>
                     <div className="flex gap-4">
                       <p className="text-[11px] text-slate-500 font-bold uppercase">Driver: <span className="text-emerald-600 font-black text-xs ml-1">₹{b.driver_bata_amount}</span></p>
                       <p className="text-[11px] text-slate-500 font-bold uppercase">Halt: <span className="text-amber-600 font-black text-xs ml-1">₹{b.halt_bata_amount}</span></p>
                     </div>
                   </div>
                   <button onClick={() => handleDeleteBata(b.route_name)} className={`${actionBtnStyle} h-fit bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100`}>Delete</button>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* 5. SYSTEM AUDIT */}
      {activeTab === "AUDIT" && (
        <div className="space-y-6 animate-in fade-in">
          <div className={cardStyle}>
            <h3 className={headingStyle}><span>RECENT ACTIVITY LOGS</span></h3>
            <div className="space-y-3">
              {auditLogs.length === 0 ? (
                <div className="text-center p-8">
                  <p className="text-4xl mb-4">📋</p>
                  <p className="text-xs font-medium text-slate-500">No recent trip activity recorded yet.</p>
                </div>
              ) : (
                auditLogs.map((log, idx) => (
                  <div key={idx} className="p-3 border border-slate-100 rounded-xl bg-slate-50 flex items-start gap-3">
                    <div className="text-xl pt-1">✅</div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        Trip <span className="text-[#FF5A00] font-black">{log.trip_number}</span> status updated to <span className="font-black">{log.trip_status}</span>
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">
                        Route: {log.origin} ➔ {log.destination} • Started: {formatDate(log.trip_start_date)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
