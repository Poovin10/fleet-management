"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";

export function SetupModule() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState("TRUCKS");
  const [isLoading, setIsLoading] = useState(false);

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

  // --- VEHICLE FORM ---
  const [vNumber, setVNumber] = useState("");
  const [vVariant, setVVariant] = useState("Bulker (16-Wheel)");
  const [vCapacity, setVCapacity] = useState("35.0 MT");
  const [vOdoWorking, setVOdoWorking] = useState(true);

  // --- DRIVER FORM ---
  const [dCode, setDCode] = useState("");
  const [dName, setDName] = useState("");
  const [dPhone, setDPhone] = useState("");
  const [dPin, setDPin] = useState("");

  // --- SLAB FORM ---
  const [sOrigin, setSOrigin] = useState("");
  const [sDestination, setSDestination] = useState("");
  const [sCargo, setSCargo] = useState("BULK");
  const [sRate, setSRate] = useState("");

  // --- BATA FORM ---
  const [bRoute, setBRoute] = useState("");
  const [bDriverBata, setBDriverBata] = useState("");
  const [bHaltBata, setBHaltBata] = useState("");

  const fetchAllData = async () => {
    setIsLoading(true);
    // Removed the .catch() to fix the TypeScript Vercel Build Error
    const [vRes, dRes, fRes, bRes] = await Promise.all([
      supabase.from("vehicles").select("*").eq("is_active", true).order("vehicle_number"),
      supabase.from("drivers").select("*").eq("is_active", true).order("full_name"),
      supabase.from("destinations_freight_master").select("*").order("destination_name"),
      supabase.from("driver_bata_master").select("*").order("route_name")
    ]);

    if (vRes.data) setVehicles(vRes.data);
    if (dRes.data) setDrivers(dRes.data);
    if (fRes.data) setFreightSlabs(fRes.data);
    if (bRes.data) setBataSlabs(bRes.data);
    setIsLoading(false);
  };

  useEffect(() => { fetchAllData(); }, []);

  // --- HANDLERS ---
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const capacityNum = parseFloat(vCapacity.replace(" MT", ""));
    const payload = {
      vehicle_number: vNumber.trim().toUpperCase(),
      truck_type: vVariant,
      carrying_capacity_tons: capacityNum || 0,
      is_active: true
    };
    
    const { error } = await supabase.from("vehicles").insert([payload]);
    if (error) setAlertConfig({ isOpen: true, title: "Error", message: error.message, type: "error" });
    else {
      setAlertConfig({ isOpen: true, title: "Saved", message: "Truck added successfully!", type: "success" });
      setVNumber(""); setVVariant("Bulker (16-Wheel)"); setVCapacity("35.0 MT");
      fetchAllData();
    }
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      driver_code: dCode.trim().toUpperCase(),
      full_name: dName.trim(),
      phone_number: dPhone.trim(),
      pin: dPin.trim() || "1234",
      is_active: true
    };
    
    const { error } = await supabase.from("drivers").insert([payload]);
    if (error) setAlertConfig({ isOpen: true, title: "Error", message: error.message, type: "error" });
    else {
      setAlertConfig({ isOpen: true, title: "Saved", message: "Driver added successfully!", type: "success" });
      setDCode(""); setDName(""); setDPhone(""); setDPin("");
      fetchAllData();
    }
  };

  const handleResetDriverPin = async (driverId: number, driverName: string) => {
    const newPin = prompt(`Enter new 4-digit PIN for ${driverName}:`, "1234");
    if (!newPin || newPin.length !== 4) return alert("PIN must be exactly 4 digits.");
    
    const { error } = await supabase.from("drivers").update({ pin: newPin }).eq("driver_id", driverId);
    if (error) setAlertConfig({ isOpen: true, title: "Error", message: error.message, type: "error" });
    else {
      setAlertConfig({ isOpen: true, title: "Updated", message: `PIN reset for ${driverName}`, type: "success" });
      fetchAllData();
    }
  };

  const handleSaveSlab = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      orgin: sOrigin.trim().toUpperCase(),
      destination_name: sDestination.trim().toUpperCase(),
      cargo_type: sCargo,
      freight_rate_per_ton: Number(sRate)
    };
    
    const { error } = await supabase.from("destinations_freight_master").insert([payload]);
    if (error) setAlertConfig({ isOpen: true, title: "Error", message: error.message, type: "error" });
    else {
      setAlertConfig({ isOpen: true, title: "Saved", message: "Freight slab added successfully!", type: "success" });
      setSOrigin(""); setSDestination(""); setSRate("");
      fetchAllData();
    }
  };

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
      setAlertConfig({ isOpen: true, title: "Saved", message: "Bata details added successfully!", type: "success" });
      setBRoute(""); setBDriverBata(""); setBHaltBata("");
      fetchAllData();
    }
  };

  // --- KSS BRANDED STYLING ---
  const inputStyle = "w-full h-12 bg-white border border-slate-200 rounded-[14px] px-4 text-sm font-semibold text-slate-900 outline-none focus:border-[#FF5A00] focus:ring-1 focus:ring-[#FF5A00] shadow-sm";
  const labelStyle = "block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1";
  const buttonStyle = "w-full h-12 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-sm rounded-[14px] transition-colors mt-2 shadow-sm active:scale-[0.98]";
  const cardStyle = "bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm";
  const headingStyle = "text-[13px] font-black uppercase text-slate-900 mb-6 tracking-wide border-b border-slate-100 pb-3";

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
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
              activeTab === t.id 
                ? "bg-[#FF5A00] text-white shadow-md" 
                : "bg-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
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
            <h3 className={headingStyle}>ADD NEW TRUCKS</h3>
            <form onSubmit={handleSaveVehicle} className="space-y-5">
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
                <select value={vCapacity} onChange={e => setVCapacity(e.target.value)} className={inputStyle}>
                  <option value="35.0 MT">35.0 MT</option>
                  <option value="30.0 MT">30.0 MT</option>
                  <option value="25.0 MT">25.0 MT</option>
                </select>
              </div>
              <div className="flex items-center gap-2 px-1">
                <input type="checkbox" checked={vOdoWorking} onChange={e => setVOdoWorking(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-[#FF5A00] focus:ring-[#FF5A00]" />
                <label className="text-[13px] font-bold text-slate-700">✅ Odometer Working</label>
              </div>
              <button type="submit" className={buttonStyle}>Save Truck</button>
            </form>
          </div>

          <div className={cardStyle}>
             <h3 className={headingStyle}>ACTIVE FLEET ({vehicles.length})</h3>
             <div className="space-y-3">
               {vehicles.map(v => (
                 <div key={v.vehicle_id} className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
                   <div>
                     <p className="font-black text-sm text-slate-900">{v.vehicle_number}</p>
                     <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{v.truck_type} • {v.carrying_capacity_tons} MT</p>
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
            <h3 className={headingStyle}>ADD NEW DRIVER</h3>
            <form onSubmit={handleSaveDriver} className="space-y-5">
              <div>
                <label className={labelStyle}>Driver Code *</label>
                <input type="text" value={dCode} onChange={e => setDCode(e.target.value)} placeholder="E.G. DRV-01" className={inputStyle} required />
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
                <label className={labelStyle}>App Login PIN (4 Digits)</label>
                <input type="password" maxLength={4} value={dPin} onChange={e => setDPin(e.target.value)} placeholder="Default: 1234" className={inputStyle} />
              </div>
              <button type="submit" className={buttonStyle}>Save Driver</button>
            </form>
          </div>

          <div className={cardStyle}>
             <h3 className={headingStyle}>ACTIVE DRIVERS ({drivers.length})</h3>
             <div className="space-y-3">
               {drivers.map(d => (
                 <div key={d.driver_id} className="flex justify-between items-center p-4 border border-slate-200 rounded-2xl bg-slate-50">
                   <div>
                     <p className="font-black text-sm text-slate-900">{d.driver_code} - {d.full_name}</p>
                     <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">PIN: <span className="font-mono text-[#FF5A00] tracking-widest">{d.pin || "NOT SET"}</span></p>
                   </div>
                   <button onClick={() => handleResetDriverPin(d.driver_id, d.full_name)} className="text-[10px] font-black bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-amber-700 shadow-sm transition-colors hover:bg-amber-100">
                     Reset PIN
                   </button>
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
            <h3 className={headingStyle}>ADD FREIGHT SLAB</h3>
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
              <button type="submit" className={buttonStyle}>Save Freight Slab</button>
            </form>
          </div>

          <div className={cardStyle}>
             <h3 className={headingStyle}>CONFIGURED SLABS ({freightSlabs.length})</h3>
             <div className="space-y-3">
               {freightSlabs.map(f => (
                 <div key={f.destination_id} className="p-4 border border-slate-200 rounded-2xl bg-slate-50">
                   <div className="flex justify-between items-start mb-2">
                     <p className="font-black text-sm text-slate-900">{f.orgin} ➔ {f.destination_name}</p>
                     <span className="text-[9px] font-black bg-slate-200 text-slate-600 px-2 py-1 rounded uppercase tracking-wider">{f.cargo_type}</span>
                   </div>
                   <p className="text-[11px] text-slate-500 font-bold uppercase">Freight: <span className="text-[#FF5A00] font-black text-xs ml-1">₹{f.freight_rate_per_ton} / MT</span></p>
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
            <h3 className={headingStyle}>ADD BATA SLAB</h3>
            <form onSubmit={handleSaveBata} className="space-y-5">
              <div>
                <label className={labelStyle}>Route Name *</label>
                <input type="text" value={bRoute} onChange={e => setBRoute(e.target.value)} placeholder="E.G. COCHIN - PALAKKAD" className={inputStyle} required />
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
             <h3 className={headingStyle}>CONFIGURED BATA ({bataSlabs.length})</h3>
             <div className="space-y-3">
               {bataSlabs.map((b, idx) => (
                 <div key={idx} className="p-4 border border-slate-200 rounded-2xl bg-slate-50">
                   <p className="font-black text-sm text-slate-900 mb-2">{b.route_name}</p>
                   <div className="flex gap-6">
                     <p className="text-[11px] text-slate-500 font-bold uppercase">Driver: <span className="text-emerald-600 font-black text-xs ml-1">₹{b.driver_bata_amount}</span></p>
                     <p className="text-[11px] text-slate-500 font-bold uppercase">Halt: <span className="text-amber-600 font-black text-xs ml-1">₹{b.halt_bata_amount}</span></p>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* 5. SYSTEM AUDIT (Placeholder) */}
      {activeTab === "AUDIT" && (
        <div className="animate-in fade-in text-center p-12 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-4xl mb-4">📋</p>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">System Audit Logs</h3>
          <p className="text-xs font-medium text-slate-500 mt-2">Activity tracking will appear here.</p>
        </div>
      )}
    </div>
  );
}
