"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";

const STANDARD_SOURCES = ["COCHIN", "POTTANERI", "METTUR", "UDUPPI", "COCHIN-ACC", "TUTICORIN"];
const BATA_SLAB_OPTIONS = [
  "25MT Body (Bag)",
  "30MT Body (Bag)",
  "25MT Bulk (Bulker)",
  "30MT Bulk (Bulker)",
  "35MT Bulk (Bulker)"
];

export function SetupModule() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState("TRUCKS");
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);

  const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: "", message: "", type: "info" as "success" | "error" | "info" });

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
  const [dLicense, setDLicense] = useState("");
  const [dExpiry, setDExpiry] = useState("");

  // --- SLAB FORM ---
  const [sCargo, setSCargo] = useState("BULK");
  const [sOrigin, setSOrigin] = useState(STANDARD_SOURCES[0]);
  const [sDestination, setSDestination] = useState("");
  const [sCapacity, setSCapacity] = useState("35.0");
  const [sRate, setSRate] = useState("");
  const [sStdKm, setSStdKm] = useState("0.0");

  // --- BATA FORM ---
  const [bOrigin, setBOrigin] = useState(STANDARD_SOURCES[0]);
  const [bDestination, setBDestination] = useState("");
  const [bTruckSlab, setBTruckSlab] = useState("35MT Bulk (Bulker)");
  const [bDriverBata, setBDriverBata] = useState("");

  const resetForms = () => {
    setEditingId(null);
    setVNumber(""); setVVariant("Bulker (16-Wheel)"); setVCapacity("35.0"); setVOdoWorking(true);
    setVFc(""); setVIns(""); setVQtax(""); setVPuc(""); setVNp(""); setVSp(""); setVTank("");
    setDName(""); setDPhone(""); setDLicense(""); setDExpiry("");
    setSCargo("BULK"); setSOrigin(STANDARD_SOURCES[0]); setSDestination(""); setSCapacity("35.0"); setSRate(""); setSStdKm("0.0");
    setBOrigin(STANDARD_SOURCES[0]); setBDestination(""); setBTruckSlab("35MT Bulk (Bulker)"); setBDriverBata("");
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
      supabase.from("driver_bata_master").select("*").order("destination_name"),
      supabase.from("trips").select("trip_id, trip_number, trip_start_date, vehicle_id, origin, destination, start_km, end_km").order("trip_start_date", { ascending: false }).limit(50)
    ]);

    if (vRes.data) setVehicles(vRes.data);
    if (dRes.data) setDrivers(dRes.data);
    if (fRes.data) setFreightSlabs(fRes.data);
    if (bRes.data) setBataSlabs(bRes.data);
    if (aRes.data) setAuditLogs(aRes.data);
    setIsLoading(false);
  };

  useEffect(() => { fetchAllData(); }, []);

  // --- HELPERS ---
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    if (!dateStr.includes("-")) return dateStr;
    const parts = dateStr.split("T")[0].split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  };

  const getNextDriverCode = () => {
    if (drivers.length === 0) return "DRV-001";
    const nums = drivers.map(d => {
      const match = (d.driver_code || "").match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    });
    const nextNum = Math.max(...nums, 0) + 1;
    return `DRV-${String(nextNum).padStart(3, '0')}`;
  };

  const currentDriverCodeDisplay = editingId && activeTab === "DRIVERS" 
    ? drivers.find(d => d.driver_id === editingId)?.driver_code || ""
    : getNextDriverCode();

  // Parse Bata Slab Selection to DB columns
  const getBataSlabData = (slabName: string) => {
    if (slabName.includes("25MT Body")) return { type: "BAG", cap: 25.0 };
    if (slabName.includes("30MT Body")) return { type: "BAG", cap: 30.0 };
    if (slabName.includes("25MT Bulk")) return { type: "BULK", cap: 25.0 };
    if (slabName.includes("30MT Bulk")) return { type: "BULK", cap: 30.0 };
    return { type: "BULK", cap: 35.0 }; // Default 35MT Bulk
  };

  const formatBataSlabDisplay = (cargo: string, cap: number) => {
    if (cargo === "BAG" && cap === 25) return "25MT Body (Bag)";
    if (cargo === "BAG" && cap === 30) return "30MT Body (Bag)";
    if (cargo === "BULK" && cap === 25) return "25MT Bulk (Bulker)";
    if (cargo === "BULK" && cap === 30) return "30MT Bulk (Bulker)";
    return "35MT Bulk (Bulker)";
  };

  // --- SUBMIT HANDLERS ---
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      vehicle_number: vNumber.trim().toUpperCase(),
      truck_type: vVariant,
      carrying_capacity_tons: Number(vCapacity) || 0,
      odometer_working: vOdoWorking,
      fc_expiry_date: vFc || null, insurance_expiry_date: vIns || null,
      qtax_expiry_date: vQtax || null, puc_expiry_date: vPuc || null,
      np_expiry_date: vNp || null, state_permit_expiry_date: vSp || null,
      tank_cert_expiry_date: vTank || null,
      is_active: true
    };
    const res = editingId ? await supabase.from("vehicles").update(payload).eq("vehicle_id", editingId) : await supabase.from("vehicles").insert([payload]);
    if (res.error) return setAlertConfig({ isOpen: true, title: "Error", message: res.error.message, type: "error" });
    setAlertConfig({ isOpen: true, title: "Success", message: "Truck saved!", type: "success" });
    resetForms(); fetchAllData();
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      driver_code: currentDriverCodeDisplay,
      full_name: dName.trim(),
      phone_number: dPhone.trim(),
      license_number: dLicense.trim().toUpperCase(),
      expiry_date: dExpiry || null,
      is_active: true
    };
    if (!editingId) payload.pin = "1234"; // Setup PIN for driver portal login
    
    const res = editingId ? await supabase.from("drivers").update(payload).eq("driver_id", editingId) : await supabase.from("drivers").insert([payload]);
    if (res.error) return setAlertConfig({ isOpen: true, title: "Error", message: res.error.message, type: "error" });
    setAlertConfig({ isOpen: true, title: "Success", message: "Driver saved!", type: "success" });
    resetForms(); fetchAllData();
  };

  const handleSaveSlab = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      cargo_type: sCargo,
      orgin: sOrigin,
      destination_name: sDestination.trim().toUpperCase(),
      capacity_tons: Number(sCapacity) || 0,
      freight_rate_per_ton: Number(sRate) || 0,
      standard_km: Number(sStdKm) || 0
    };
    const res = editingId ? await supabase.from("destinations_freight_master").update(payload).eq("destination_id", editingId) : await supabase.from("destinations_freight_master").insert([payload]);
    if (res.error) return setAlertConfig({ isOpen: true, title: "Error", message: res.error.message, type: "error" });
    setAlertConfig({ isOpen: true, title: "Success", message: "Slab saved!", type: "success" });
    resetForms(); fetchAllData();
  };

  const handleSaveBata = async (e: React.FormEvent) => {
    e.preventDefault();
    const slabData = getBataSlabData(bTruckSlab);
    const payload = { 
      origin: bOrigin,
      destination_name: bDestination.trim().toUpperCase(),
      cargo_type: slabData.type,
      capacity_tons: slabData.cap,
      standard_bata_inr: Number(bDriverBata), 
      halt_bata_amount: 300 
    };
    const res = await supabase.from("driver_bata_master").insert([payload]);
    if (res.error) return setAlertConfig({ isOpen: true, title: "Error", message: res.error.message, type: "error" });
    setAlertConfig({ isOpen: true, title: "Success", message: "Bata saved!", type: "success" });
    resetForms(); fetchAllData();
  };

  // --- STYLING (Streamlit Replica) ---
  const inputStyle = "w-full h-10 bg-white border border-slate-200 rounded-lg px-3 text-sm text-slate-800 outline-none focus:border-[#FF5A00] focus:ring-1 focus:ring-[#FF5A00] shadow-sm disabled:bg-slate-50 disabled:text-slate-500";
  const labelStyle = "block text-[11px] font-bold text-slate-600 mb-1 ml-0.5";
  const buttonStyle = "w-full h-10 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold text-sm rounded-lg px-6 transition-colors shadow-sm";
  const thStyle = "px-3 py-2 bg-slate-50 border-b border-slate-200 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0";
  const tdStyle = "px-3 py-2 border-b border-slate-100 text-xs text-slate-700 whitespace-nowrap";

  const tabs = [
    { id: "TRUCKS", icon: "🚚", label: "Trucks" },
    { id: "DRIVERS", icon: "👨‍✈️", label: "Drivers" },
    { id: "SLABS", icon: "🛣️", label: "Slabs" },
    { id: "BATA", icon: "💰", label: "Bata" },
    { id: "AUDIT", icon: "📋", label: "System Audit" }
  ];

  return (
    <div className="space-y-6 pb-20" style={{ colorScheme: "light" }}>
      <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} />

      <div>
        <h2 className="text-sm font-black uppercase text-slate-900 tracking-wide mb-4">Master Database Configuration</h2>
        <div className="flex flex-wrap gap-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                activeTab === t.id ? "border-slate-300 bg-white text-slate-900 shadow-sm" : "border-transparent text-slate-500 hover:bg-slate-100"
              }`}
            >
              {activeTab === t.id && <span className="text-[#FF5A00] animate-pulse">●</span>}
              <span className="text-sm">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="w-full h-px bg-slate-200 mt-4"></div>
      </div>

      <div className={`flex flex-col lg:flex-row gap-8 ${activeTab === "AUDIT" ? "lg:flex-col" : ""}`}>
        
        {/* LEFT PANEL: FORM (Hidden on Audit) */}
        {activeTab !== "AUDIT" && (
          <div className="w-full lg:w-[320px] shrink-0 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 h-fit">
            
            {activeTab === "TRUCKS" && (
              <form onSubmit={handleSaveVehicle} className="space-y-4">
                <div><label className={labelStyle}>Truck No *</label><input type="text" value={vNumber} onChange={e => setVNumber(e.target.value)} className={inputStyle} required /></div>
                <div>
                  <label className={labelStyle}>Variant</label>
                  <select value={vVariant} onChange={e => setVVariant(e.target.value)} className={inputStyle}>
                    <option value="Bulker (16-Wheel)">Bulker (16-Wheel)</option>
                    <option value="Bulker (14-Wheel)">Bulker (14-Wheel)</option>
                    <option value="Bulker">Bulker</option>
                    <option value="Body Truck">Body Truck</option>
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Capacity (MT)</label>
                  <select value={vCapacity} onChange={e => setVCapacity(e.target.value)} className={inputStyle}>
                    <option value="25.0">25.0</option><option value="30.0">30.0</option><option value="35.0">35.0</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-1 pb-1">
                  <input type="checkbox" checked={vOdoWorking} onChange={e => setVOdoWorking(e.target.checked)} className="w-4 h-4 rounded text-[#FF5A00]" />
                  <label className="text-xs font-bold text-emerald-700">✅ Odometer Working</label>
                </div>
                
                {/* DOCUMENT EXPIRIES (Added per request) */}
                <div className="border-t border-slate-200 pt-3 mt-2">
                  <label className="block text-[10px] font-black text-slate-800 uppercase tracking-widest mb-2">Expiries</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={labelStyle}>FC</label><input type="date" value={vFc} onChange={e => setVFc(e.target.value)} className={inputStyle} /></div>
                    <div><label className={labelStyle}>Ins</label><input type="date" value={vIns} onChange={e => setVIns(e.target.value)} className={inputStyle} /></div>
                    <div><label className={labelStyle}>Q-Tax</label><input type="date" value={vQtax} onChange={e => setVQtax(e.target.value)} className={inputStyle} /></div>
                    <div><label className={labelStyle}>PUC</label><input type="date" value={vPuc} onChange={e => setVPuc(e.target.value)} className={inputStyle} /></div>
                    <div><label className={labelStyle}>NP</label><input type="date" value={vNp} onChange={e => setVNp(e.target.value)} className={inputStyle} /></div>
                    <div><label className={labelStyle}>SP</label><input type="date" value={vSp} onChange={e => setVSp(e.target.value)} className={inputStyle} /></div>
                    <div className="col-span-2"><label className={labelStyle}>Tank Cert</label><input type="date" value={vTank} onChange={e => setVTank(e.target.value)} className={inputStyle} /></div>
                  </div>
                </div>

                <button type="submit" className={buttonStyle}>{editingId ? "Update Truck" : "Save Truck"}</button>
              </form>
            )}

            {activeTab === "DRIVERS" && (
              <form onSubmit={handleSaveDriver} className="space-y-4">
                <div><label className={labelStyle}>Driver Code *</label><input type="text" value={currentDriverCodeDisplay} onChange={e => setDCode(e.target.value)} className={inputStyle} required /></div>
                <div><label className={labelStyle}>Full Name *</label><input type="text" value={dName} onChange={e => setDName(e.target.value)} className={inputStyle} required /></div>
                <div><label className={labelStyle}>Phone *</label><input type="text" value={dPhone} onChange={e => setDPhone(e.target.value)} className={inputStyle} required /></div>
                <div><label className={labelStyle}>License No</label><input type="text" value={dLicense} onChange={e => setDLicense(e.target.value)} className={inputStyle} /></div>
                <div><label className={labelStyle}>Expiry Date</label><input type="date" value={dExpiry} onChange={e => setDExpiry(e.target.value)} className={inputStyle} /></div>
                <button type="submit" className={buttonStyle}>{editingId ? "Update Driver" : "Save Driver"}</button>
              </form>
            )}

            {activeTab === "SLABS" && (
              <form onSubmit={handleSaveSlab} className="space-y-4">
                <div>
                  <label className={labelStyle}>Cargo</label>
                  <select value={sCargo} onChange={e => setSCargo(e.target.value)} className={inputStyle}><option value="BULK">BULK</option><option value="BAG">BAG</option></select>
                </div>
                <div>
                  <label className={labelStyle}>Origin</label>
                  <select value={sOrigin} onChange={e => setSOrigin(e.target.value)} className={inputStyle}>
                    {STANDARD_SOURCES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div><label className={labelStyle}>Destination *</label><input type="text" value={sDestination} onChange={e => setSDestination(e.target.value)} className={inputStyle} required /></div>
                <div className="flex gap-2">
                  <div className="w-1/2">
                    <label className={labelStyle}>Class (MT)</label>
                    <select value={sCapacity} onChange={e => setSCapacity(e.target.value)} className={inputStyle}>
                      <option value="25.0">25.0</option><option value="30.0">30.0</option><option value="35.0">35.0</option>
                    </select>
                  </div>
                  <div className="w-1/2"><label className={labelStyle}>Std KM</label><input type="number" step="0.1" value={sStdKm} onChange={e => setSStdKm(e.target.value)} className={inputStyle} /></div>
                </div>
                <div><label className={labelStyle}>Rate/MT (₹) *</label><input type="number" step="0.01" value={sRate} onChange={e => setSRate(e.target.value)} className={inputStyle} required /></div>
                <button type="submit" className={buttonStyle}>{editingId ? "Update Route" : "Save Route"}</button>
              </form>
            )}

            {activeTab === "BATA" && (
              <form onSubmit={handleSaveBata} className="space-y-4">
                <div>
                  <label className={labelStyle}>Origin Source *</label>
                  <select value={bOrigin} onChange={e => setBOrigin(e.target.value)} className={inputStyle} required>
                    {STANDARD_SOURCES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Destination *</label>
                  <input type="text" value={bDestination} onChange={e => setBDestination(e.target.value)} className={inputStyle} required />
                </div>
                <div>
                  <label className={labelStyle}>Truck Slab *</label>
                  <select value={bTruckSlab} onChange={e => setBTruckSlab(e.target.value)} className={inputStyle}>
                    {BATA_SLAB_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div><label className={labelStyle}>Bata (₹) *</label><input type="number" value={bDriverBata} onChange={e => setBDriverBata(e.target.value)} className={inputStyle} required /></div>
                <button type="submit" className={buttonStyle}>Save Bata Slab</button>
              </form>
            )}
          </div>
        )}

        {/* RIGHT PANEL: DATA TABLE */}
        <div className="flex-1 w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left border-collapse">
              
              {activeTab === "TRUCKS" && (
                <>
                  <thead><tr><th className={thStyle}>VEHICLE_NUMBER</th><th className={thStyle}>TRUCK_TYPE</th><th className={thStyle}>CARRYING_CAPACITY_TONS</th><th className={thStyle}>CURRENT_STATUS</th><th className={thStyle}>ACTIONS</th></tr></thead>
                  <tbody>
                    {vehicles.map(v => (
                      <tr key={v.vehicle_id} className="hover:bg-slate-50">
                        <td className={`${tdStyle} font-bold`}>{v.vehicle_number}</td>
                        <td className={tdStyle}>{v.truck_type}</td>
                        <td className={tdStyle}>{v.carrying_capacity_tons}</td>
                        <td className={tdStyle}>{v.current_status || "AVAILABLE_FOR_LOAD"}</td>
                        <td className={tdStyle}>
                          <button onClick={() => { 
                            setEditingId(v.vehicle_id); setVNumber(v.vehicle_number); setVVariant(v.truck_type); setVCapacity(v.carrying_capacity_tons);
                            setVFc(v.fc_expiry_date||""); setVIns(v.insurance_expiry_date||""); setVQtax(v.qtax_expiry_date||"");
                            setVPuc(v.puc_expiry_date||""); setVNp(v.np_expiry_date||""); setVSp(v.state_permit_expiry_date||""); setVTank(v.tank_cert_expiry_date||"");
                          }} className="text-blue-600 font-bold">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {activeTab === "DRIVERS" && (
                <>
                  <thead><tr><th className={thStyle}>DRIVER_CODE</th><th className={thStyle}>FULL_NAME</th><th className={thStyle}>PHONE_NUMBER</th><th className={thStyle}>LICENSE_NUMBER</th><th className={thStyle}>ACTIONS</th></tr></thead>
                  <tbody>
                    {drivers.map(d => (
                      <tr key={d.driver_id} className="hover:bg-slate-50">
                        <td className={`${tdStyle} font-bold`}>{d.driver_code}</td>
                        <td className={tdStyle}>{d.full_name}</td>
                        <td className={tdStyle}>{d.phone_number}</td>
                        <td className={tdStyle}>{d.license_number || "-"}</td>
                        <td className={tdStyle}>
                          <button onClick={() => { 
                            setEditingId(d.driver_id); setDCode(d.driver_code); setDName(d.full_name); setDPhone(d.phone_number); setDLicense(d.license_number||""); setDExpiry(d.expiry_date||"");
                          }} className="text-blue-600 font-bold">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {activeTab === "SLABS" && (
                <>
                  <thead><tr><th className={thStyle}>CARGO_TYPE</th><th className={thStyle}>ORGIN</th><th className={thStyle}>DESTINATION_NAME</th><th className={thStyle}>CAPACITY_TONS</th><th className={thStyle}>FREIGHT_RATE_PER_TON</th><th className={thStyle}>STANDARD_KM</th></tr></thead>
                  <tbody>
                    {freightSlabs.map(f => (
                      <tr key={f.destination_id} className="hover:bg-slate-50">
                        <td className={tdStyle}>{f.cargo_type}</td>
                        <td className={`${tdStyle} font-bold`}>{f.orgin}</td>
                        <td className={`${tdStyle} font-bold`}>{f.destination_name}</td>
                        <td className={tdStyle}>{f.capacity_tons}</td>
                        <td className={tdStyle}>{f.freight_rate_per_ton}</td>
                        <td className={tdStyle}>{f.standard_km || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {activeTab === "BATA" && (
                <>
                  <thead><tr><th className={thStyle}>ORIGIN</th><th className={thStyle}>DESTINATION_NAME</th><th className={thStyle}>TRUCK_SLAB</th><th className={thStyle}>STANDARD_BATA_INR</th></tr></thead>
                  <tbody>
                    {bataSlabs.map((b, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className={tdStyle}>{b.origin || "-"}</td>
                        <td className={`${tdStyle} font-bold`}>{b.destination_name}</td>
                        <td className={tdStyle}>{formatBataSlabDisplay(b.cargo_type, b.capacity_tons)}</td>
                        <td className={tdStyle}>{b.standard_bata_inr}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {activeTab === "AUDIT" && (
                <>
                  <thead><tr><th className={thStyle}>TRIP_ID</th><th className={thStyle}>TRIP_NUMBER</th><th className={thStyle}>TRIP_START_DATE</th><th className={thStyle}>VEHICLE_ID</th><th className={thStyle}>ORIGIN</th><th className={thStyle}>DESTINATION</th><th className={thStyle}>START_KM</th><th className={thStyle}>END_KM</th></tr></thead>
                  <tbody>
                    {auditLogs.map(t => (
                      <tr key={t.trip_id} className="hover:bg-slate-50">
                        <td className={tdStyle}>{t.trip_id}</td>
                        <td className={`${tdStyle} font-bold text-blue-700`}>{t.trip_number}</td>
                        <td className={tdStyle}>{formatDate(t.trip_start_date)}</td>
                        <td className={tdStyle}>{t.vehicle_id}</td>
                        <td className={tdStyle}>{t.origin}</td>
                        <td className={tdStyle}>{t.destination}</td>
                        <td className={tdStyle}>{t.start_km || 0}</td>
                        <td className={tdStyle}>{t.end_km || 0}</td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">No trips recorded yet.</td></tr>}
                  </tbody>
                </>
              )}
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
