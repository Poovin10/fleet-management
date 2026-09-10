"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal"; 

export function SetupModule() {
  const supabase = createClient();
  const [sTab, setSTab] = useState("Trucks");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentUsername, setCurrentUsername] = useState("");

  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: "", message: "", isDanger: false, confirmText: "Confirm", action: async () => {} });
  const triggerModal = (title: string, message: string, isDanger: boolean, confirmText: string, action: () => Promise<void>) => setModalConfig({ isOpen: true, title, message, isDanger, confirmText, action });
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  const [trucksList, setTrucksList] = useState<any[]>([]);
  const [driversList, setDriversList] = useState<any[]>([]);
  const [slabsList, setSlabsList] = useState<any[]>([]);
  const [bataList, setBataList] = useState<any[]>([]);
  const [auditList, setAuditList] = useState<any[]>([]);
  const [systemUsers, setSystemUsers] = useState<any[]>([]);

  // Selected truck for Compliance Editing
  const [selectedTruckForCompliance, setSelectedTruckForCompliance] = useState<any>(null);
  const [fcExp, setFcExp] = useState("");
  const [insExp, setInsExp] = useState("");
  const [qtaxExp, setQtaxExp] = useState("");
  const [pucExp, setPucExp] = useState("");
  const [npExp, setNpExp] = useState("");
  const [spExp, setSpExp] = useState("");
  const [tankExp, setTankExp] = useState("");

  // New User Form States
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("VIEWER");

  // Edit states
  const [editTruckId, setEditTruckId] = useState<number | null>(null);
  const [editDriverId, setEditDriverId] = useState<number | null>(null);
  const [editSlabId, setEditSlabId] = useState<number | null>(null);
  const [editBataId, setEditBataId] = useState<number | null>(null);

  // Form States
  const [truckNo, setTruckNo] = useState("");
  const [variant, setVariant] = useState("Bulker (16-Wheel)");
  const [capacity, setCapacity] = useState("35.0 MT");
  
  const [driverName, setDriverName] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [isActiveDriver, setIsActiveDriver] = useState(true);
  
  const STANDARD_SOURCES = ["COCHIN", "POTTANERI", "METTUR", "UDUPPI", "COCHIN-ACC", "TUTICORIN"];
  
  const [src, setSrc] = useState("COCHIN");
  const [customSrc, setCustomSrc] = useState("");
  const [dest, setDest] = useState("");
  const [customDest, setCustomDest] = useState("");
  
  const [cType, setCType] = useState("BULK");
  const [cap, setCap] = useState("35"); // For Freight Form
  const [bataCap, setBataCap] = useState("35"); // For Bata Form
  const [fRate, setFRate] = useState<number | "">("");
  const [avgKms, setAvgKms] = useState<number | "">(""); 
  const [bataAmt, setBataAmt] = useState<number | "">("");

  const fetchData = async () => {
    const loggedUser = sessionStorage.getItem("kss_username") || "superadmin";
    setCurrentUsername(loggedUser);

    const [v, d, s, b, a, u] = await Promise.all([
      supabase.from('vehicles').select('*').order('vehicle_number'),
      supabase.from('drivers').select('*').order('full_name'),
      supabase.from('destinations_freight_master').select('*').order('destination_name'),
      supabase.from('driver_bata_master').select('*').order('destination_name'),
      supabase.from('trips').select('trip_id, trip_number, trip_start_date, trip_status, origin, destination, vehicles(vehicle_number), drivers(full_name)').order('trip_start_date', { ascending: false }).limit(50),
      supabase.from('app_users').select('*').order('username')
    ]);
    
    if (v.data) setTrucksList(v.data);
    if (d.data) setDriversList(d.data);
    if (s.data) setSlabsList(s.data);
    if (b.data) setBataList(b.data);
    if (a.data) setAuditList(a.data);
    if (u.data) setSystemUsers(u.data);
  };

  useEffect(() => { fetchData(); }, []);

  // Clear Handlers
  const clearTruckForm = () => { setEditTruckId(null); setTruckNo(""); setVariant("Bulker (16-Wheel)"); setCapacity("35.0 MT"); };
  const clearDriverForm = () => { setEditDriverId(null); setDriverName(""); setMobileNo(""); setLicenseNo(""); setExpiryDate(""); setIsActiveDriver(true); };
  const clearSlabForm = () => { setEditSlabId(null); setSrc("COCHIN"); setCustomSrc(""); setDest(""); setCustomDest(""); setCType("BULK"); setCap("35"); setFRate(""); setAvgKms(""); };
  const clearBataForm = () => { setEditBataId(null); setSrc("COCHIN"); setCustomSrc(""); setDest(""); setCustomDest(""); setCType("BULK"); setBataCap("35"); setBataAmt(""); };

  // Click-to-Edit Handlers
  const handleEditDriver = (d: any) => {
    setEditDriverId(d.driver_id);
    setDriverName(d.full_name);
    setMobileNo(d.phone_number || "");
    setLicenseNo(d.license_number || "");
    setExpiryDate(d.license_expiry_date || "");
    setIsActiveDriver(d.is_active);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditTruck = (t: any) => {
    setEditTruckId(t.vehicle_id);
    setTruckNo(t.vehicle_number);
    setVariant(t.truck_type || "Bulker (16-Wheel)");
    setCapacity(`${t.carrying_capacity_tons}.0 MT`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditSlab = (s: any) => {
    setEditSlabId(s.id);
    if (originOptions.includes(s.origin)) { setSrc(s.origin); setCustomSrc(""); } else { setSrc("CUSTOM"); setCustomSrc(s.origin); }
    if (destOptions.includes(s.destination_name)) { setDest(s.destination_name); setCustomDest(""); } else { setDest("CUSTOM"); setCustomDest(s.destination_name); }
    setCType(s.cargo_type);
    setCap(s.capacity_tons);
    setFRate(s.freight_rate_per_ton);
    setAvgKms(s.standard_km || "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditBata = (b: any) => {
    setEditBataId(b.id);
    if (originOptions.includes(b.origin)) { setSrc(b.origin); setCustomSrc(""); } else { setSrc("CUSTOM"); setCustomSrc(b.origin); }
    if (destOptions.includes(b.destination_name)) { setDest(b.destination_name); setCustomDest(""); } else { setDest("CUSTOM"); setCustomDest(b.destination_name); }
    setCType(b.cargo_type);
    setBataCap(b.capacity_tons);
    setBataAmt(b.standard_bata_inr);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (selectedTruckForCompliance) {
      setFcExp(selectedTruckForCompliance.fc_expiry_date || "");
      setInsExp(selectedTruckForCompliance.insurance_expiry_date || "");
      setQtaxExp(selectedTruckForCompliance.qtax_expiry_date || "");
      setPucExp(selectedTruckForCompliance.puc_expiry_date || "");
      setNpExp(selectedTruckForCompliance.np_expiry_date || "");
      setSpExp(selectedTruckForCompliance.state_permit_expiry_date || "");
      setTankExp(selectedTruckForCompliance.tank_cert_expiry_date || "");
    }
  }, [selectedTruckForCompliance]);

  const handleSaveTruckCompliance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTruckForCompliance) return;

    triggerModal("Update Compliance", `Save document expiry dates for ${selectedTruckForCompliance.vehicle_number}?`, false, "Save Dates", async () => {
      setIsProcessing(true);
      const { error } = await supabase.from('vehicles').update({
        fc_expiry_date: fcExp || null,
        insurance_expiry_date: insExp || null,
        qtax_expiry_date: qtaxExp || null,
        puc_expiry_date: pucExp || null,
        np_expiry_date: npExp || null,
        state_permit_expiry_date: spExp || null,
        tank_cert_expiry_date: tankExp || null
      }).eq('vehicle_id', selectedTruckForCompliance.vehicle_id);

      if (error) alert("Error updating compliance: " + error.message);
      else {
        alert("Truck compliance records updated successfully!");
        fetchData();
      }
      setIsProcessing(false);
      closeModal();
    });
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;

    triggerModal("Create User", `Create new ${newRole} account for ${newUsername.trim().toLowerCase()}?`, false, "Create User", async () => {
      setIsProcessing(true);
      const { error } = await supabase.from('app_users').insert([{
        username: newUsername.trim().toLowerCase(),
        password: newPassword.trim(),
        role: newRole
      }]);

      if (error) alert("Error creating user: " + error.message);
      else {
        setNewUsername("");
        setNewPassword("");
        fetchData();
      }
      setIsProcessing(false);
      closeModal();
    });
  };

  const handleDeleteUser = (username: string) => {
    if (username === "superadmin") return alert("Cannot delete the primary Super Admin account.");
    triggerModal("Delete User", `Are you sure you want to revoke access for ${username}?`, true, "Delete", async () => {
      setIsProcessing(true);
      await supabase.from('app_users').delete().eq('username', username);
      fetchData();
      setIsProcessing(false);
      closeModal();
    });
  };

  const handleResetDriverPin = async (driverId: number, driverName: string) => {
    const newPin = prompt(`Enter a new 4-digit PIN for ${driverName}'s App Login:`, "1234");
    if (!newPin) return; 
    if (newPin.length !== 4 || isNaN(Number(newPin))) {
      alert("Invalid PIN. It must be exactly 4 digits.");
      return;
    }

    setIsProcessing(true);
    const { error } = await supabase.from('drivers').update({ pin: newPin }).eq('driver_id', driverId);
    if (error) {
      alert("Error resetting PIN: " + error.message);
    } else {
      alert(`PIN for ${driverName} successfully reset to ${newPin}`);
      fetchData();
    }
    setIsProcessing(false);
  };

  const originOptions = Array.from(new Set([
    ...STANDARD_SOURCES,
    ...slabsList.map(s => s.origin),
    ...bataList.map(b => b.origin)
  ])).filter(Boolean).sort();

  const destOptions = Array.from(new Set([
    ...slabsList.map(s => s.destination_name),
    ...bataList.map(b => b.destination_name)
  ])).filter(Boolean).sort();

  // Save Operations
  const handleSaveTruck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckNo.trim()) return;
    const isUpdate = editTruckId !== null;
    triggerModal(isUpdate ? "Update Truck" : "Add Truck", isUpdate ? `Update details for ${truckNo.toUpperCase()}?` : `Register ${truckNo.toUpperCase()} to the fleet?`, false, "Save Truck", async () => {
      setIsProcessing(true);
      const payload = { vehicle_number: truckNo.toUpperCase().trim(), truck_type: variant, carrying_capacity_tons: parseFloat(capacity), is_active: true };
      
      if (isUpdate) {
        await supabase.from('vehicles').update(payload).eq('vehicle_id', editTruckId);
      } else {
        await supabase.from('vehicles').insert([{ ...payload, current_status: "WAITING_FOR_LOAD" }]);
      }
      clearTruckForm(); fetchData(); setIsProcessing(false); closeModal();
    });
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim()) return;
    const isUpdate = editDriverId !== null;

    try {
      let autoGenCode = "";
      if (!isUpdate) {
        const { data: existingDrivers } = await supabase.from('drivers').select('driver_code');
        let nextNumber = 1;
        if (existingDrivers && existingDrivers.length > 0) {
          const numbers = existingDrivers.map(d => {
            const match = String(d.driver_code || "").match(/(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
          }).filter(n => !isNaN(n));
          if (numbers.length > 0) nextNumber = Math.max(...numbers) + 1;
        }
        autoGenCode = `DRV-${String(nextNumber).padStart(3, '0')}`;
      }

      triggerModal(isUpdate ? "Update Driver" : "Add Driver", isUpdate ? `Update profile for ${driverName.toUpperCase()}?` : `Register ${driverName.toUpperCase()} as ${autoGenCode}?`, false, "Save Driver", async () => {
        setIsProcessing(true);
        const payload = { 
          full_name: driverName.toUpperCase().trim(), 
          phone_number: mobileNo.trim() || null,
          license_number: licenseNo.toUpperCase().trim() || null, 
          license_expiry_date: expiryDate || null, 
          is_active: isActiveDriver 
        };

        if (isUpdate) {
          const { error } = await supabase.from('drivers').update(payload).eq('driver_id', editDriverId);
          if (error) alert("Error updating driver: " + error.message);
        } else {
          const { error } = await supabase.from('drivers').insert([{ ...payload, driver_code: autoGenCode, pin: "1234" }]);
          if (error) alert("Error adding driver: " + error.message);
        }
        
        clearDriverForm(); fetchData(); setIsProcessing(false); closeModal();
      });
    } catch (err: any) {
      alert("Error handling driver code: " + err.message);
      setIsProcessing(false);
    }
  };

  const handleSaveSlab = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSrc = src === "CUSTOM" ? customSrc : src;
    const finalDest = dest === "CUSTOM" ? customDest : dest;
    if (!finalDest.trim() || !fRate || !avgKms) return;
    const isUpdate = editSlabId !== null;
    
    triggerModal(isUpdate ? "Update Freight Slab" : "Add Freight Slab", isUpdate ? `Update rate for ${finalSrc.toUpperCase()} to ${finalDest.toUpperCase()}?` : `Lock in ₹${fRate}/MT for ${finalSrc.toUpperCase()} to ${finalDest.toUpperCase()}?`, false, "Save Slab", async () => {
      setIsProcessing(true);
      const payload = { 
        origin: finalSrc.toUpperCase().trim(), 
        destination_name: finalDest.toUpperCase().trim(), 
        cargo_type: cType, 
        capacity_tons: cap, 
        standard_km: Number(avgKms), 
        freight_rate_per_ton: Number(fRate), 
        is_active: true 
      };

      let error;
      if (isUpdate) {
        const res = await supabase.from('destinations_freight_master').update(payload).eq('id', editSlabId);
        error = res.error;
      } else {
        const res = await supabase.from('destinations_freight_master').insert([payload]);
        error = res.error;
      }

      if (error) alert("DATABASE REJECTION ERROR:\n\n" + error.message);
      else { clearSlabForm(); fetchData(); }
      setIsProcessing(false); closeModal();
    });
  };

  const handleSaveBata = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSrc = src === "CUSTOM" ? customSrc : src;
    const finalDest = dest === "CUSTOM" ? customDest : dest;
    if (!finalDest.trim() || !bataAmt) return;
    const isUpdate = editBataId !== null;
    
    triggerModal(isUpdate ? "Update Bata Master" : "Add Bata Master", isUpdate ? `Update Bata for ${finalSrc.toUpperCase()} to ${finalDest.toUpperCase()}?` : `Set ₹${bataAmt} default Bata for ${finalSrc.toUpperCase()} to ${finalDest.toUpperCase()}?`, false, "Save Bata", async () => {
      setIsProcessing(true);
      const payload = { 
        origin: finalSrc.toUpperCase().trim(), 
        destination_name: finalDest.toUpperCase().trim(), 
        cargo_type: cType, 
        capacity_tons: bataCap, 
        standard_bata_inr: Number(bataAmt) 
      };

      let error;
      if (isUpdate) {
        const res = await supabase.from('driver_bata_master').update(payload).eq('id', editBataId);
        error = res.error;
      } else {
        const res = await supabase.from('driver_bata_master').insert([payload]);
        error = res.error;
      }

      if (error) alert("DATABASE REJECTION ERROR:\n\n" + error.message);
      else { clearBataForm(); fetchData(); }
      setIsProcessing(false); closeModal();
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} isDanger={modalConfig.isDanger} confirmText={modalConfig.confirmText} onConfirm={modalConfig.action} onCancel={closeModal} isProcessing={isProcessing} />

      <div className="flex flex-wrap gap-2 border-b border-[#272B36] pb-4">
        {[
          { label: "Trucks", icon: "🚛" }, 
          { label: "Drivers", icon: "👨‍✈️" }, 
          { label: "Freight Slabs", icon: "🛣️" }, 
          { label: "Bata", icon: "💰" }, 
          { label: "System Audit", icon: "📋" }, 
          { label: "🚚 Truck Compliance", icon: "🛡️" },
          { label: "🔐 User Control", icon: "⚙️" }
        ].map((tab) => (
          <button 
            key={tab.label} onClick={() => setSTab(tab.label)} 
            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${sTab === tab.label ? "bg-[#FF5A00] text-white shadow-lg shadow-[#FF5A00]/20 ring-1 ring-[#FF5A00]" : "bg-[#161922] text-slate-400 hover:text-white hover:bg-[#1E222D] border border-[#272B36]"}`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-[#161922] border border-[#272B36] rounded-2xl p-6 sm:p-8 shadow-xl max-w-5xl mx-auto">
        
        {/* TRUCKS */}
        {sTab === "Trucks" && (
          <>
            <div className="flex justify-between items-center border-b border-[#272B36] pb-3 mb-6">
              <h3 className="text-sm font-black text-white uppercase tracking-wide">
                {editTruckId ? "Edit Existing Truck" : "Add New Truck"}
              </h3>
              {editTruckId && <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded-lg uppercase tracking-widest animate-pulse">Editing Mode</span>}
            </div>
            
            <form onSubmit={handleSaveTruck} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="md:col-span-1"><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Truck No *</label><input type="text" value={truckNo} onChange={e=>setTruckNo(e.target.value)} placeholder="E.G. TN 56 F 0452" className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none font-bold uppercase bg-[#0F1117] text-white focus:border-[#FF5A00]" required /></div>
              <div className="md:col-span-1"><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Variant</label><select value={variant} onChange={e=>setVariant(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none font-semibold bg-[#0F1117] text-white"><option>Bulker (16-Wheel)</option><option>Bulker (14-Wheel)</option><option>Open Body (10-Wheel)</option><option>Trailer</option></select></div>
              <div className="md:col-span-1"><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Capacity</label><select value={capacity} onChange={e=>setCapacity(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none font-semibold bg-[#0F1117] text-white"><option>35.0 MT</option><option>30.0 MT</option><option>25.0 MT</option></select></div>
              
              <div className="md:col-span-2 flex gap-2 w-full">
                {editTruckId && <button type="button" onClick={clearTruckForm} className="flex-1 py-3 bg-[#0F1117] text-slate-300 font-bold rounded-xl hover:bg-[#272B36] transition-colors border border-[#272B36]">Cancel</button>}
                <button type="submit" disabled={isProcessing} className="flex-[2] py-3 bg-[#FF5A00] text-white font-black rounded-xl hover:bg-[#e04f00] transition-colors shadow-lg shadow-[#FF5A00]/20 active:scale-95">{editTruckId ? "Update Truck" : "Save Truck"}</button>
              </div>
            </form>
            
            <div className="mt-8 border-t border-[#272B36] pt-6">
              <h4 className="text-xs font-black text-slate-400 uppercase mb-3">Registered Fleet (Click to Edit)</h4>
              <div className="flex flex-wrap gap-2">
                {trucksList.map(t => (
                  <button key={t.vehicle_id} onClick={() => handleEditTruck(t)} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${editTruckId === t.vehicle_id ? 'bg-[#FF5A00] text-white border-[#FF5A00]' : 'bg-[#0F1117] text-slate-300 border-[#272B36] hover:border-[#FF5A00]/50 hover:text-white'}`}>
                    {t.vehicle_number}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* DRIVERS */}
        {sTab === "Drivers" && (
          <>
            <div className="flex justify-between items-center border-b border-[#272B36] pb-3 mb-6">
              <h3 className="text-sm font-black text-white uppercase tracking-wide">
                {editDriverId ? "Edit Existing Driver Profile" : "Add New Driver"}
              </h3>
              {editDriverId && <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded-lg uppercase tracking-widest animate-pulse">Editing Mode</span>}
            </div>

            <form onSubmit={handleSaveDriver} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Driver Code</label>
                  <input type="text" value={editDriverId ? "LOCKED IN EDIT MODE" : `DRV-[Auto-Generated]`} disabled className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none font-black uppercase bg-[#0F1117] text-[#FF5A00] cursor-not-allowed" />
                </div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Full Name *</label><input type="text" value={driverName} onChange={e=>setDriverName(e.target.value)} placeholder="e.g. ANEESH CR" className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none font-bold uppercase bg-[#1A1F2C] text-white focus:border-[#FF5A00]" required /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mobile Number</label><input type="tel" value={mobileNo} onChange={e=>setMobileNo(e.target.value)} placeholder="e.g. 9876543210" className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none font-semibold bg-[#1A1F2C] text-white focus:border-[#FF5A00]" /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">License Number</label><input type="text" value={licenseNo} onChange={e=>setLicenseNo(e.target.value)} placeholder="e.g. KL123456789" className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none font-semibold uppercase bg-[#1A1F2C] text-white focus:border-[#FF5A00]" /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">License Expiry Date</label><input type="date" value={expiryDate} onChange={e=>setExpiryDate(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none font-semibold bg-[#1A1F2C] text-white focus:border-[#FF5A00]" /></div>
                
                <div className="flex flex-col justify-end h-full pt-4">
                  <label className="flex items-center gap-3 cursor-pointer select-none bg-[#0F1117] p-3 rounded-xl border border-[#272B36] w-full">
                    <input type="checkbox" checked={isActiveDriver} onChange={(e) => setIsActiveDriver(e.target.checked)} className="w-4 h-4 rounded text-[#FF5A00] focus:ring-[#FF5A00] bg-[#1A1F2C] border-[#272B36]" />
                    <span className={`text-xs font-black uppercase ${isActiveDriver ? 'text-emerald-400' : 'text-rose-400'}`}>{isActiveDriver ? "✅ Active Driver" : "🛑 Suspended"}</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex gap-3 w-full md:w-auto">
                {editDriverId && <button type="button" onClick={clearDriverForm} className="flex-1 md:flex-none px-6 py-3 bg-[#0F1117] text-slate-300 font-bold rounded-xl border border-[#272B36] hover:bg-[#272B36] transition-colors">Cancel Edit</button>}
                <button type="submit" disabled={isProcessing} className="flex-[2] md:flex-none px-8 py-3 bg-[#FF5A00] text-white font-black rounded-xl hover:bg-[#e04f00] transition-colors shadow-lg shadow-[#FF5A00]/20 active:scale-95">{editDriverId ? "Update Driver" : "Save Driver"}</button>
              </div>
            </form>
            
            <div className="mt-8 border-t border-[#272B36] pt-6 w-full">
              <h4 className="text-xs font-black text-slate-400 uppercase mb-3">Registered Drivers (Click to Edit)</h4>
              <div className="overflow-x-auto border border-[#272B36] rounded-xl w-full max-h-80">
                <table className="min-w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-[#0F1117] text-slate-400 uppercase font-bold sticky top-0">
                    <tr><th className="p-3">Code</th><th className="p-3">Full Name</th><th className="p-3">Phone</th><th className="p-3">License Info</th><th className="p-3">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#272B36] bg-[#161922]">
                    {driversList.map(d => (
                      <tr key={d.driver_id} onClick={() => handleEditDriver(d)} className={`cursor-pointer transition-colors ${editDriverId === d.driver_id ? 'bg-[#FF5A00]/10 border-l-2 border-l-[#FF5A00]' : 'hover:bg-[#1E222D] border-l-2 border-transparent'}`}>
                        <td className="p-3 font-bold text-[#FF5A00]">{d.driver_code}</td>
                        <td className="p-3 font-bold text-white">{d.full_name}</td>
                        <td className="p-3 text-slate-300 font-semibold">{d.phone_number || '-'}</td>
                        <td className="p-3 text-slate-300"><span className="font-semibold">{d.license_number || '-'}</span>{d.license_expiry_date && <span className="ml-2 text-[10px] text-slate-400">Exp: {d.license_expiry_date}</span>}</td>
                        <td className="p-3"><span className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${d.is_active ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>{d.is_active ? 'Active' : 'Suspended'}</span></td>
                      </tr>
                    ))}
                    {driversList.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">No drivers active.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* FREIGHT SLABS */}
        {sTab === "Freight Slabs" && (
          <>
            <div className="flex justify-between items-center border-b border-[#272B36] pb-3 mb-6">
              <h3 className="text-sm font-black text-white uppercase tracking-wide">
                {editSlabId ? "Edit Existing Freight Slab" : "Add New Freight Slab"}
              </h3>
              {editSlabId && <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded-lg uppercase tracking-widest animate-pulse">Editing Mode</span>}
            </div>

            <form onSubmit={handleSaveSlab} className="grid grid-cols-1 md:grid-cols-7 gap-4 items-start">
              <div className="md:col-span-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Source</label>
                <select value={src} onChange={e=>setSrc(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none font-bold bg-[#0F1117] text-white">
                  {originOptions.map(s=><option key={s} value={s}>{s}</option>)}
                  <option value="CUSTOM">-- TYPE NEW --</option>
                </select>
                {src === "CUSTOM" && <input type="text" value={customSrc} onChange={e=>setCustomSrc(e.target.value)} placeholder="New Source" className="w-full text-sm p-3 mt-2 rounded-xl border border-[#272B36] outline-none uppercase font-bold bg-[#0F1117] text-white" required />}
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Destination *</label>
                <select value={dest} onChange={e=>setDest(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none font-bold bg-[#0F1117] text-white uppercase" required>
                  <option value="">-- SELECT DEST --</option>
                  {destOptions.map(d=><option key={d} value={d}>{d}</option>)}
                  <option value="CUSTOM">-- TYPE NEW --</option>
                </select>
                {dest === "CUSTOM" && <input type="text" value={customDest} onChange={e=>setCustomDest(e.target.value)} placeholder="New Destination" className="w-full text-sm p-3 mt-2 rounded-xl border border-[#272B36] outline-none uppercase font-bold bg-[#0F1117] text-white" required />}
              </div>
              
              <div className="md:col-span-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cargo</label>
                <select value={cType} onChange={e => { setCType(e.target.value); if (e.target.value === "BAG") { setCap("25/30"); } if (e.target.value === "BULK" && cap !== "35") setCap("25/30"); }} className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none bg-[#0F1117] text-white">
                  <option value="BULK">BULK</option>
                  <option value="BAG">BAG</option>
                </select>
              </div>
              
              <div className="md:col-span-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cap (MT)</label>
                <select value={cap} onChange={e=>setCap(e.target.value)} disabled={cType === "BAG"} className={`w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none bg-[#0F1117] ${cType === "BAG" ? "text-slate-500 cursor-not-allowed" : "text-white"}`}>
                  {cType === "BAG" ? <option value="25/30">25/30 MT</option> : <><option value="25/30">25/30 MT</option><option value="35">35 MT</option></>}
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Rate(₹)</label>
                <input type="number" value={fRate} onChange={e=>setFRate(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none font-black text-emerald-400 bg-[#0F1117]" required />
              </div>

              <div className="md:col-span-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Avg KMs</label>
                <input type="number" value={avgKms} onChange={e=>setAvgKms(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none font-black text-sky-400 bg-[#0F1117]" required />
              </div>
              
              <div className="md:col-span-7 flex gap-3 mt-2">
                {editSlabId && <button type="button" onClick={clearSlabForm} className="flex-1 py-3 bg-[#0F1117] text-slate-300 font-bold rounded-xl border border-[#272B36] hover:bg-[#272B36] transition-colors">Cancel</button>}
                <button type="submit" disabled={isProcessing} className="flex-[4] py-3 bg-[#FF5A00] text-white font-black rounded-xl hover:bg-[#e04f00] transition-colors shadow-lg shadow-[#FF5A00]/20 active:scale-95">{editSlabId ? "Update Slab" : "Save Freight Rule"}</button>
              </div>
            </form>
            
            <div className="mt-8 border-t border-[#272B36] pt-6 w-full">
              <h4 className="text-xs font-black text-slate-400 uppercase mb-3">Freight Slabs List (Click to Edit)</h4>
              <div className="overflow-x-auto border border-[#272B36] rounded-xl w-full max-h-80">
                <table className="min-w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-[#0F1117] text-slate-400 uppercase font-bold sticky top-0">
                    <tr><th className="p-3">Route</th><th className="p-3">Type</th><th className="p-3 text-center">Avg KMs</th><th className="p-3 text-right">Rate/MT</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#272B36] bg-[#161922]">
                    {slabsList.map(s => (
                      <tr key={s.id} onClick={() => handleEditSlab(s)} className={`cursor-pointer transition-colors ${editSlabId === s.id ? 'bg-[#FF5A00]/10 border-l-2 border-l-[#FF5A00]' : 'hover:bg-[#1E222D] border-l-2 border-transparent'}`}>
                        <td className="p-3 font-bold text-white">{s.origin} ➔ {s.destination_name}</td>
                        <td className="p-3 text-slate-300">{s.capacity_tons}MT {s.cargo_type}</td>
                        <td className="p-3 text-slate-300 text-center">{s.standard_km ? `${s.standard_km} KM` : '-'}</td>
                        <td className="p-3 font-black text-emerald-400 text-right">₹{s.freight_rate_per_ton}</td>
                      </tr>
                    ))}
                    {slabsList.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">No slabs active.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* BATA */}
        {sTab === "Bata" && (
          <>
            <div className="flex justify-between items-center border-b border-[#272B36] pb-3 mb-6">
              <h3 className="text-sm font-black text-white uppercase tracking-wide">
                {editBataId ? "Edit Existing Bata Rule" : "Add Bata Rule"}
              </h3>
              {editBataId && <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-[10px] font-bold rounded-lg uppercase tracking-widest animate-pulse">Editing Mode</span>}
            </div>

            <form onSubmit={handleSaveBata} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-start">
              
              <div className="md:col-span-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Source</label>
                <select value={src} onChange={e=>setSrc(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none font-bold bg-[#0F1117] text-white">
                  {originOptions.map(s=><option key={s} value={s}>{s}</option>)}
                  <option value="CUSTOM">-- TYPE NEW --</option>
                </select>
                {src === "CUSTOM" && <input type="text" value={customSrc} onChange={e=>setCustomSrc(e.target.value)} placeholder="New Source" className="w-full text-sm p-3 mt-2 rounded-xl border border-[#272B36] outline-none uppercase font-bold bg-[#0F1117] text-white" required />}
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Destination *</label>
                <select value={dest} onChange={e=>setDest(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none uppercase font-bold bg-[#0F1117] text-white" required>
                  <option value="">-- SELECT DEST --</option>
                  {destOptions.map(d=><option key={d} value={d}>{d}</option>)}
                  <option value="CUSTOM">-- TYPE NEW --</option>
                </select>
                {dest === "CUSTOM" && <input type="text" value={customDest} onChange={e=>setCustomDest(e.target.value)} placeholder="New Destination" className="w-full text-sm p-3 mt-2 rounded-xl border border-[#272B36] outline-none uppercase font-bold bg-[#0F1117] text-white" required />}
              </div>

              <div className="md:col-span-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cargo</label>
                <select value={cType} onChange={e => { setCType(e.target.value); if (e.target.value === "BAG" && bataCap === "35") setBataCap("30"); }} className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none bg-[#0F1117] text-white">
                  <option value="BULK">BULK</option>
                  <option value="BAG">BAG</option>
                </select>
              </div>
              
              <div className="md:col-span-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cap (MT)</label>
                <select value={bataCap} onChange={e=>setBataCap(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none bg-[#0F1117] text-white">
                  {cType === "BAG" ? <><option value="25">25 MT</option><option value="30">30 MT</option></> : <><option value="25">25 MT</option><option value="30">30 MT</option><option value="35">35 MT</option></>}
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bata(₹)</label>
                <input type="number" value={bataAmt} onChange={e=>setBataAmt(parseFloat(e.target.value))} className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none font-black text-[#FF5A00] bg-[#0F1117]" required />
              </div>
              
              <div className="md:col-span-6 flex gap-3 mt-2">
                {editBataId && <button type="button" onClick={clearBataForm} className="flex-1 py-3 bg-[#0F1117] text-slate-300 font-bold rounded-xl border border-[#272B36] hover:bg-[#272B36] transition-colors">Cancel</button>}
                <button type="submit" disabled={isProcessing} className="flex-[4] py-3 bg-[#FF5A00] text-white font-black rounded-xl hover:bg-[#e04f00] transition-colors shadow-lg shadow-[#FF5A00]/20 active:scale-95">{editBataId ? "Update Bata Rule" : "Save Bata Rule"}</button>
              </div>
            </form>
            
            <div className="mt-8 border-t border-[#272B36] pt-6 w-full">
              <h4 className="text-xs font-black text-slate-400 uppercase mb-3">Bata Master List (Click to Edit)</h4>
              <div className="overflow-x-auto border border-[#272B36] rounded-xl w-full max-h-80">
                <table className="min-w-full text-xs text-left whitespace-nowrap">
                  <thead className="bg-[#0F1117] text-slate-400 uppercase font-bold sticky top-0"><tr><th className="p-3">Route</th><th className="p-3">Type</th><th className="p-3 text-right">Bata Amt</th></tr></thead>
                  <tbody className="divide-y divide-[#272B36] bg-[#161922]">
                    {bataList.map(b => (
                      <tr key={b.id} onClick={() => handleEditBata(b)} className={`cursor-pointer transition-colors ${editBataId === b.id ? 'bg-[#FF5A00]/10 border-l-2 border-l-[#FF5A00]' : 'hover:bg-[#1E222D] border-l-2 border-transparent'}`}>
                        <td className="p-3 font-bold text-white">{b.origin} ➔ {b.destination_name}</td>
                        <td className="p-3 text-slate-300">{b.capacity_tons}MT {b.cargo_type}</td>
                        <td className="p-3 font-black text-[#FF5A00] text-right">₹{b.standard_bata_inr}</td>
                      </tr>
                    ))}
                    {bataList.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-slate-400">No bata rules active.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* SYSTEM AUDIT */}
        {sTab === "System Audit" && (
          <>
            <h3 className="text-sm font-black text-white uppercase border-b border-[#272B36] pb-3 mb-6 tracking-wide">Recent Trip Activity Log</h3>
            <div className="overflow-x-auto rounded-xl border border-[#272B36] w-full max-h-[500px]">
              <table className="min-w-full text-xs text-left whitespace-nowrap">
                <thead className="bg-[#0F1117] text-slate-400 uppercase font-bold sticky top-0">
                  <tr><th className="p-3">Date</th><th className="p-3">Trip LR</th><th className="p-3">Truck & Driver</th><th className="p-3">Route</th><th className="p-3 text-center">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-[#272B36] bg-[#161922]">
                  {auditList.map(a => (
                    <tr key={a.trip_id} className="hover:bg-[#1E222D]">
                      <td className="p-3 font-semibold text-slate-300">{a.trip_start_date}</td>
                      <td className="p-3 font-bold text-white">{a.trip_number}</td>
                      <td className="p-3 text-slate-300"><span className="font-bold text-white">{a.vehicles?.vehicle_number}</span><br/><span className="text-[10px] text-slate-400">{a.drivers?.full_name}</span></td>
                      <td className="p-3 text-slate-300">{a.origin} ➔ {a.destination}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${a.trip_status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                          {a.trip_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {auditList.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No recent system activity.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* 🚚 TRUCK COMPLIANCE & PERMITS */}
        {sTab === "🚚 Truck Compliance" && (
          <div>
            <h3 className="text-sm font-black text-white uppercase border-b border-[#272B36] pb-3 mb-6 tracking-wide">Truck Document & Permit Expiries</h3>
            
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Select Truck to Manage Permits</label>
              <select 
                value={selectedTruckForCompliance ? selectedTruckForCompliance.vehicle_id : ""} 
                onChange={e => {
                  const found = trucksList.find(t => String(t.vehicle_id) === e.target.value);
                  setSelectedTruckForCompliance(found || null);
                }}
                className="w-full text-sm p-3 rounded-xl border border-[#272B36] bg-[#0F1117] font-bold outline-none focus:border-[#FF5A00] text-white"
              >
                <option value="">-- SELECT TRUCK --</option>
                {trucksList.map(t => (
                  <option key={t.vehicle_id} value={t.vehicle_id}>
                    {t.vehicle_number} [{t.truck_type}]
                  </option>
                ))}
              </select>
            </div>

            {selectedTruckForCompliance && (
              <form onSubmit={handleSaveTruckCompliance} className="space-y-6 animate-in slide-in-from-bottom-4">
                <div className="bg-[#0F1117] p-4 rounded-xl border border-[#272B36] flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Selected Vehicle</p>
                    <p className="text-base font-black text-[#FF5A00]">{selectedTruckForCompliance.vehicle_number}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase">Variant</p>
                    <p className="text-sm font-bold text-white">{selectedTruckForCompliance.truck_type}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">FC Test Expiry</label>
                    <input type="date" value={fcExp} onChange={e => setFcExp(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] font-semibold bg-[#0F1117] text-white outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Insurance Expiry</label>
                    <input type="date" value={insExp} onChange={e => setInsExp(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] font-semibold bg-[#0F1117] text-white outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Quarterly Tax (Q-Tax) Expiry</label>
                    <input type="date" value={qtaxExp} onChange={e => setQtaxExp(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] font-semibold bg-[#0F1117] text-white outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">PUC Expiry</label>
                    <input type="date" value={pucExp} onChange={e => setPucExp(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] font-semibold bg-[#0F1117] text-white outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">National Permit (NP) Expiry</label>
                    <input type="date" value={npExp} onChange={e => setNpExp(e.target.value)} placeholder="Leave blank if N/A" className="w-full text-sm p-3 rounded-xl border border-[#272B36] font-semibold bg-[#0F1117] text-white outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">State Permit Expiry</label>
                    <input type="date" value={spExp} onChange={e => setSpExp(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] font-semibold bg-[#0F1117] text-white outline-none" />
                  </div>

                  {String(selectedTruckForCompliance.truck_type).toUpperCase().includes("BULK") && (
                    <div className="sm:col-span-2 md:col-span-3 bg-amber-950/40 p-4 rounded-xl border border-amber-800/50">
                      <label className="block text-[10px] font-black text-amber-400 uppercase mb-1">⚡ Bulker Tank / Pressure Certificate Expiry</label>
                      <input type="date" value={tankExp} onChange={e => setTankExp(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-amber-800 font-semibold bg-[#0F1117] text-white outline-none" />
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-[#272B36] flex justify-end">
                  <button type="submit" disabled={isProcessing} className="px-8 py-3 bg-[#FF5A00] hover:bg-[#e04f00] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20 active:scale-95">
                    Save Compliance Dates
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* 🔐 USER CONTROL (SUPERADMIN ONLY) */}
        {sTab === "🔐 User Control" && (
          <>
            {currentUsername.toLowerCase() !== "superadmin" && currentUsername !== "" ? (
              <div className="p-8 text-center bg-rose-950/40 border border-rose-900 rounded-2xl">
                <p className="text-xl font-black text-rose-400">Access Denied</p>
                <p className="text-sm text-rose-300 mt-1">This module is strictly restricted to the Super Admin account (<span className="font-mono font-bold text-white">superadmin</span>).</p>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-black text-white uppercase border-b border-[#272B36] pb-3 mb-6 tracking-wide">Create New System User</h3>
                <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-8">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Username *</label>
                    <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="e.g. manager2" className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none bg-[#0F1117] text-white font-bold focus:border-[#FF5A00]" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Password *</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none bg-[#0F1117] text-white font-bold focus:border-[#FF5A00]" required />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Role *</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full text-sm p-3 rounded-xl border border-[#272B36] outline-none bg-[#0F1117] text-white font-bold">
                      <option value="VIEWER">VIEWER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>
                  <button type="submit" disabled={isProcessing} className="w-full py-3 bg-[#FF5A00] text-white font-black rounded-xl hover:bg-[#e04f00] transition-colors shadow-lg shadow-[#FF5A00]/20 active:scale-95">Add User</button>
                </form>

                <h4 className="text-xs font-black text-slate-300 uppercase mb-3">Active System Accounts</h4>
                <div className="overflow-x-auto border border-[#272B36] rounded-xl w-full max-h-80 mb-8">
                  <table className="min-w-full text-xs text-left whitespace-nowrap">
                    <thead className="bg-[#0F1117] text-slate-400 uppercase font-bold sticky top-0">
                      <tr><th className="p-3">Username</th><th className="p-3">Role</th><th className="p-3 text-center">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#272B36] bg-[#161922]">
                      {systemUsers.map(u => (
                        <tr key={u.user_id} className="hover:bg-[#1E222D]">
                          <td className="p-3 font-bold text-white">{u.username}</td>
                          <td className="p-3"><span className={`px-2 py-1 rounded text-[10px] font-bold ${u.role === 'ADMIN' ? 'bg-[#FF5A00]/20 text-[#FF5A00]' : 'bg-[#0F1117] text-slate-300 border border-[#272B36]'}`}>{u.role}</span></td>
                          <td className="p-3 text-center">
                            {u.username !== 'superadmin' ? (
                              <button onClick={() => handleDeleteUser(u.username)} className="px-3 py-1 bg-rose-950 text-rose-400 font-bold rounded-lg hover:bg-rose-900 transition-colors border border-rose-800">Revoke</button>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">Protected</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h4 className="text-xs font-black text-slate-300 uppercase mb-3 border-t border-[#272B36] pt-8">Driver App Access (PIN Management)</h4>
                <div className="overflow-x-auto border border-[#272B36] rounded-xl w-full max-h-80">
                  <table className="min-w-full text-xs text-left whitespace-nowrap">
                    <thead className="bg-[#0F1117] text-slate-400 uppercase font-bold sticky top-0">
                      <tr><th className="p-3">Driver Code</th><th className="p-3">Full Name</th><th className="p-3 text-center">App Access</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[#272B36] bg-[#161922]">
                      {driversList.map(d => (
                        <tr key={d.driver_id} className="hover:bg-[#1E222D]">
                          <td className="p-3 font-bold text-[#FF5A00]">{d.driver_code}</td>
                          <td className="p-3 text-white font-semibold">{d.full_name}</td>
                          <td className="p-3 text-center">
                            <button 
                              onClick={() => handleResetDriverPin(d.driver_id, d.full_name)} 
                              className="px-4 py-1.5 bg-amber-950 text-amber-400 font-bold rounded-lg hover:bg-amber-900 transition-colors border border-amber-800"
                            >
                              Reset PIN
                            </button>
                          </td>
                        </tr>
                      ))}
                      {driversList.length === 0 && (
                        <tr><td colSpan={3} className="p-4 text-center text-slate-400">No drivers available.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
