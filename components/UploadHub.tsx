"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export function UploadHub() {
  const supabase = createClient();
  const [activeWorkflow, setActiveWorkflow] = useState<string | null>(null);
  const [cameraStartingFor, setCameraStartingFor] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: "", message: "", type: "info" as "success" | "error" | "info" });

  const triggerScanner = async (docType: string) => {
    // 1. Instantly show "Opening Camera..." so the user knows the app is responding
    setCameraStartingFor(docType); 
    
    try {
      const image = await Camera.getPhoto({
        quality: 50,
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt 
      });

      // 2. Camera closes. Clear the "Opening" state.
      setCameraStartingFor(null);

      // If they closed the camera without taking a photo, just stop.
      if (!image.base64String) return;

      // 3. Photo confirmed! Now lock the UI and show "Parsing AI..."
      setActiveWorkflow(docType);

      const response = await fetch('/api/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: image.base64String,
          documentType: docType === "INVOICE" ? "TRIP_INVOICE" : docType 
        })
      });

      const { data, error } = await response.json();
      if (error) throw new Error(error);

      // Route the AI output to the correct database table
      if (docType === "INVOICE") {
        const { error: dbError } = await supabase.from('pending_scans').insert([{
          document_type: 'TRIP_INVOICE',
          lr_number: data.lrNo ? String(data.lrNo).toUpperCase() : null,
          tonnage_extracted: data.tonnage ? Number(data.tonnage) : null,
          destination: data.destination ? String(data.destination).toUpperCase() : null,
          source: data.source ? String(data.source).toUpperCase() : null,
          truck_number: data.truckNo ? String(data.truckNo).toUpperCase() : null,
          cargo_type: data.cargoType ? String(data.cargoType).toUpperCase() : null,
          raw_json_result: data,
          status: 'PENDING'
        }]);

        if (dbError) throw new Error(dbError.message);
        
        setAlertConfig({ isOpen: true, title: "Inbox Updated ✨", message: "Invoice digitized and sent to Trip Creation Inbox.", type: "success" });
      } 

    } catch (err: any) {
      console.error("Scanner Error:", err);
      setCameraStartingFor(null);
      
      const errMsg = err.message || String(err);
      // Capacitor throws "cancel" if a web browser doesn't have PWA camera elements installed
      if (!errMsg.toLowerCase().includes("cancel")) {
        setAlertConfig({ isOpen: true, title: "Camera / Scan Failed", message: errMsg, type: "error" });
      } else if (typeof window !== "undefined" && !window.navigator.userAgent.includes("Android")) {
        // Helpful warning if you are testing on a computer instead of your Android phone
        setAlertConfig({ isOpen: true, title: "Web Camera Not Supported", message: "You are testing on a web browser. Please test this on your Android app to open the native camera.", type: "info" });
      }
    } finally {
      setActiveWorkflow(null);
    }
  };

  const isBusy = activeWorkflow !== null || cameraStartingFor !== null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300 relative bg-[#12141C] border border-[#222634] rounded-2xl p-6 sm:p-8 shadow-xl">
      <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} />

      <div className="border-b border-[#222634] pb-4">
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Document Processing Hub</h2>
        <p className="text-sm text-slate-400 mt-1">Select a document type to scan and digitize.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* INVOICE BUTTON */}
        <button onClick={() => triggerScanner("INVOICE")} disabled={isBusy} className="bg-[#1A1F2C] border border-[#2B3142] hover:border-[#FF5A00] disabled:opacity-50 disabled:cursor-not-allowed p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group">
          <div className="h-12 w-12 bg-[#FF5A00]/10 text-[#FF5A00] rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
            {activeWorkflow === "INVOICE" ? "⏳" : cameraStartingFor === "INVOICE" ? "📸" : "📄"}
          </div>
          <h3 className="text-sm font-black text-white uppercase">
            {activeWorkflow === "INVOICE" ? "Parsing AI..." : cameraStartingFor === "INVOICE" ? "Opening Camera..." : "Trip Invoice"}
          </h3>
          <p className="text-[10px] text-slate-400 text-center font-bold">Scans to Pending Inbox for Trip Creation</p>
        </button>

        {/* FUEL BUTTON */}
        <button onClick={() => triggerScanner("FUEL")} disabled={isBusy} className="bg-[#1A1F2C] border border-[#2B3142] hover:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group">
          <div className="h-12 w-12 bg-sky-500/10 text-sky-400 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
            {activeWorkflow === "FUEL" ? "⏳" : cameraStartingFor === "FUEL" ? "📸" : "⛽"}
          </div>
          <h3 className="text-sm font-black text-white uppercase">
            {activeWorkflow === "FUEL" ? "Parsing AI..." : cameraStartingFor === "FUEL" ? "Opening Camera..." : "Diesel Slip"}
          </h3>
          <p className="text-[10px] text-slate-400 text-center font-bold">Attach fuel & manual KM to an active trip</p>
        </button>

        {/* POD BUTTON */}
        <button onClick={() => triggerScanner("POD")} disabled={isBusy} className="bg-[#1A1F2C] border border-[#2B3142] hover:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group">
          <div className="h-12 w-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
            {activeWorkflow === "POD" ? "⏳" : cameraStartingFor === "POD" ? "📸" : "⚖️"}
          </div>
          <h3 className="text-sm font-black text-white uppercase">
            {activeWorkflow === "POD" ? "Parsing AI..." : cameraStartingFor === "POD" ? "Opening Camera..." : "POD / Weighment"}
          </h3>
          <p className="text-[10px] text-slate-400 text-center font-bold">Auto-calculate shortage & close trip</p>
        </button>
      </div>

      <div className="pt-8">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4">Future Modules</h4>
        <div className="grid grid-cols-2 gap-4 opacity-50 grayscale pointer-events-none">
           <div className="bg-[#1A1F2C] border border-[#2B3142] p-4 rounded-xl flex items-center gap-4">
              <span className="text-xl">🔧</span><span className="text-xs font-bold text-slate-300">Service Bills</span>
           </div>
           <div className="bg-[#1A1F2C] border border-[#2B3142] p-4 rounded-xl flex items-center gap-4">
              <span className="text-xl">🛞</span><span className="text-xs font-bold text-slate-300">Tyre & Retread Bills</span>
           </div>
        </div>
      </div>
    </div>
  );
}
