"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";

export function SetupModule() {
  const supabase = createClient();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [alertConfig, setAlertConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info" as "success" | "error" | "info"
  });

  const fetchDrivers = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('drivers').select('*').order('full_name');
    if (data) setDrivers(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchDrivers();
  }, [supabase]);

  // Admin action to reset driver PIN
  const handleResetPin = async (driverId: number, driverName: string) => {
    const newPin = prompt(`Enter new 4-digit security PIN for ${driverName}:`, "1234");
    if (!newPin || newPin.length !== 4) {
      if (newPin !== null) {
        setAlertConfig({ isOpen: true, title: "Invalid PIN", message: "PIN must be exactly 4 digits.", type: "error" });
      }
      return;
    }

    const { error } = await supabase
      .from('drivers')
      .update({ pin: newPin })
      .eq('driver_id', driverId);

    if (error) {
      setAlertConfig({ isOpen: true, title: "Failed", message: "Failed to reset PIN: " + error.message, type: "error" });
    } else {
      setAlertConfig({ isOpen: true, title: "PIN Reset Successful", message: `Security PIN successfully updated to ${newPin} for ${driverName}!`, type: "success" });
      fetchDrivers();
    }
  };

  return (
    <div className="space-y-6" style={{ colorScheme: 'light' }}>
      
      <AlertModal 
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />

      {/* Driver Security & PIN Management Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <h3 className="text-base font-black uppercase text-slate-900">Driver Mobile App Security & PINs</h3>
            <p className="text-xs text-slate-500 mt-0.5">View active driver security PINs or reset them if a driver forgets their code.</p>
          </div>
          <button 
            onClick={fetchDrivers} 
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors"
          >
            🔄 Refresh List
          </button>
        </div>

        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-slate-700 uppercase">
                <th className="p-3 border-b">Driver Code</th>
                <th className="p-3 border-b">Full Name</th>
                <th className="p-3 border-b">Phone Number</th>
                <th className="p-3 border-b">Assigned PIN</th>
                <th className="p-3 border-b text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {drivers.map(d => (
                <tr key={d.driver_id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{d.driver_code}</td>
                  <td className="p-3 font-semibold">{d.full_name}</td>
                  <td className="p-3 text-slate-600">{d.phone_number || '-'}</td>
                  <td className="p-3 font-mono font-black text-[#FF5A00]">
                    {d.pin ? d.pin : <span className="text-slate-400 font-normal italic">Not Set Yet</span>}
                  </td>
                  <td className="p-3 text-center">
                    <button 
                      onClick={() => handleResetPin(d.driver_id, d.full_name)}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold rounded-lg transition-colors shadow-sm"
                    >
                      🔑 Reset PIN
                    </button>
                  </td>
                </tr>
              ))}
              {drivers.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">No drivers found in database.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
