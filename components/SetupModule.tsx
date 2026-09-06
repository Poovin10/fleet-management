"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function SetupModule() {
  const [activeTab, setActiveTab] = useState("Slabs");
  
  // Data States
  const [slabs, setSlabs] = useState<any[]>([]);
  const [bataRates, setBataRates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function fetchMasterData() {
      setIsLoading(true);
      
      // Fetch Slabs (Adjust table name 'freight_rates' if yours is different in Supabase)
      const { data: slabData, error: slabError } = await supabase
        .from('freight_rates')
        .select('*')
        .order('destination_name', { ascending: true });
        
      if (slabData) setSlabs(slabData);

      // Fetch Bata Rates (Adjust table name 'bata_rates' if yours is different)
      const { data: bataData } = await supabase
        .from('bata_rates')
        .select('*');
        
      if (bataData) setBataRates(bataData);
      
      setIsLoading(false);
    }
    
    fetchMasterData();
  }, [supabase]);

  const setupTabs = ["Trucks", "Drivers", "Slabs", "Bata", "System Audit"];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Master Database Configuration</h2>
        <p className="text-sm text-slate-500 mt-1">Manage core fleet parameters, routing, and standard rate tables.</p>
      </div>

      {/* Setup Sub-Navigation */}
      <div className="flex flex-wrap gap-2 pb-4">
        {setupTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
              activeTab === tab
                ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {tab === "Trucks" && "🚛 "}
            {tab === "Drivers" && "👨‍✈️ "}
            {tab === "Slabs" && "🛣️ "}
            {tab === "Bata" && "💰 "}
            {tab === "System Audit" && "📋 "}
            {tab}
          </button>
        ))}
      </div>

      {/* ---------------- SLABS TAB ---------------- */}
      {activeTab === "Slabs" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: Data Entry Form */}
          <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2">Add New Route Slab</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Cargo</label>
                <select className="w-full text-sm p-2.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option>BULK</option>
                  <option>BAGS</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Origin</label>
                <select className="w-full text-sm p-2.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option>COCHIN</option>
                  <option>COCHIN-ACC</option>
                  <option>POTTANERI</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Destination *</label>
                <input type="text" placeholder="e.g. ALAPPUZHA" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 bg-white uppercase focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Class (MT)</label>
                <select className="w-full text-sm p-2.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option>25.0</option>
                  <option>30.0</option>
                  <option>35.0</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Rate/MT (₹) *</label>
                  <input type="number" placeholder="0.00" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Std KM</label>
                  <input type="number" placeholder="0.0" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <button type="button" className="w-full mt-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-lg transition-colors shadow-sm active:scale-95">
                Save Route
              </button>
            </form>
          </div>

          {/* RIGHT: Data Table */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Active Rate Slabs ({slabs.length})</h3>
              <div className="flex gap-2">
                <button className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
              </div>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Cargo</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Origin</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Destination</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Cap (MT)</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Rate/MT (₹)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {isLoading ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Loading master data...</td></tr>
                  ) : slabs.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No slabs found.</td></tr>
                  ) : (
                    slabs.map((slab, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-600">{slab.cargo_type || "BULK"}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{slab.origin || "COCHIN"}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{slab.destination_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{slab.capacity_tons}</td>
                        <td className="px-4 py-3 text-sm font-bold text-indigo-600 text-right">{slab.freight_rate_per_ton}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- BATA TAB ---------------- */}
      {activeTab === "Bata" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in">
          <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2">Add Driver Bata</h3>
            <form className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Route / Type</label>
                <input type="text" placeholder="e.g. COCHIN to ALAPPUZHA" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 bg-white uppercase outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Vehicle Class</label>
                <select className="w-full text-sm p-2.5 rounded-lg border border-slate-300 bg-white outline-none">
                  <option>10 Wheeler</option>
                  <option>14 Wheeler</option>
                  <option>16 Wheeler</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Standard Bata (₹) *</label>
                <input type="number" placeholder="0.00" className="w-full text-sm p-2.5 rounded-lg border border-slate-300 bg-white outline-none" />
              </div>
              <button type="button" className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg shadow-sm">
                Save Bata Rule
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full min-h-[400px]">
             <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-900">Bata Rules Register</h3>
             </div>
             <div className="p-8 text-center text-slate-500 text-sm">
                {bataRates.length > 0 ? "Bata data loaded." : "No standard bata rules defined yet."}
             </div>
          </div>
        </div>
      )}

      {/* Placeholders for other tabs */}
      {(activeTab === "Trucks" || activeTab === "Drivers" || activeTab === "System Audit") && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
          <p className="text-slate-500 font-medium">Master module for {activeTab} is currently syncing...</p>
        </div>
      )}

    </div>
  );
}
