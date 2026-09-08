"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SetupModule() {
  const supabase = createClient();
  const [sTab, setSTab] = useState("Trucks");
  const [isProcessing, setIsProcessing] = useState(false);

  // New Truck State
  const [truckNo, setTruckNo] = useState("");
  const [variant, setVariant] = useState("Bulker (16-Wheel)");
  const [capacity, setCapacity] = useState("35.0 MT");
  const [odoWorking, setOdoWorking] = useState(true);

  const handleSaveTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckNo.trim()) return alert("Please enter truck number.");
    setIsProcessing(true);

    const capNum = parseFloat(capacity.replace(/[^0-9.]/g, '')) || 35.0;

    const { error } = await supabase.from('vehicles').insert([{
      vehicle_number: truckNo.toUpperCase().trim(),
      truck_type: variant,
      carrying_capacity_tons: capNum,
      current_status: "WAITING_FOR_LOAD",
      is_active: true
    }]);

    if (error) alert("Error adding truck: " + error.message);
    else {
      alert("Truck added successfully!");
      setTruckNo("");
    }
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Sub-Navigation (Uniform Orange Active Pills) */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {[
          { label: "Trucks", icon: "🚛" },
          { label: "Drivers", icon: "👨‍✈️" },
          { label: "Slabs", icon: "🛣️" },
          { label: "Bata", icon: "💰" },
          { label: "System Audit", icon: "📋" }
        ].map((tab) => (
          <button
            key={tab.label}
            onClick={() => setSTab(tab.label)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
              sTab === tab.label
                ? "bg-orange-600 text-white shadow-sm ring-1 ring-orange-600"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {sTab === "Trucks" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm max-w-xl mx-auto">
          <h3 className="text-sm font-black text-slate-900 uppercase border-b border-slate-100 pb-3 mb-6">Add New Trucks</h3>
          
          <form onSubmit={handleSaveTruck} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Truck No *</label>
              <input 
                type="text" 
                value={truckNo} 
                onChange={e => setTruckNo(e.target.value)} 
                placeholder="E.G. TN 56 F 0452" 
                className="w-full text-sm p-3 rounded-xl border border-slate-300 uppercase outline-none focus:ring-2 focus:ring-orange-500 font-bold" 
                required 
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Variant</label>
              <select 
                value={variant} 
                onChange={e => setVariant(e.target.value)} 
                className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
              >
                <option value="Bulker (16-Wheel)">Bulker (16-Wheel)</option>
                <option value="Bulker (14-Wheel)">Bulker (14-Wheel)</option>
                <option value="Open Body (10-Wheel)">Open Body (10-Wheel)</option>
                <option value="Trailer">Trailer</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Capacity (MT)</label>
              <select 
                value={capacity} 
                onChange={e => setCapacity(e.target.value)} 
                className="w-full text-sm p-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
              >
                <option value="35.0 MT">35.0 MT</option>
                <option value="30.0 MT">30.0 MT</option>
                <option value="25.0 MT">25.0 MT</option>
              </select>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={odoWorking} 
                  onChange={e => setOdoWorking(e.target.checked)} 
                  className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500" 
                />
                <span className="text-xs font-bold text-slate-700">✅ Odometer Working</span>
              </label>
            </div>

            <div className="pt-3">
              <button 
                type="submit" 
                disabled={isProcessing} 
                className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-black text-sm rounded-xl transition-all shadow-sm active:scale-95"
              >
                {isProcessing ? "Saving..." : "Save Truck"}
              </button>
            </div>
          </form>
        </div>
      )}

      {sTab !== "Trucks" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-xl mx-auto text-center py-12">
          <p className="text-sm font-bold text-slate-500">{sTab} management view mounted and aligned.</p>
        </div>
      )}

    </div>
  );
}
