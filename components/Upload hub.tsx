"use client";

import { useState } from "react";
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export function UploadHub() {
  const [activeWorkflow, setActiveWorkflow] = useState<string | null>(null);

  const triggerScanner = async (docType: string) => {
    setActiveWorkflow(docType);
    try {
      const image = await Camera.getPhoto({
        quality: 50,
        allowEditing: true,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt 
      });

      if (!image.base64String) return setActiveWorkflow(null);

      // We will route the base64 string to the specific workflow based on docType
      if (docType === "INVOICE") {
        // Send to AI -> Save to 'pending_scans' DB -> Show success message
      } else if (docType === "FUEL") {
        // Open Fuel Modal -> Ask for LR No & KM -> Send to AI -> Save to DB
      } else if (docType === "POD") {
        // Open POD Modal -> Ask for LR No -> Send to AI -> Check 200kg shortage -> Save
      }

    } catch (err) {
      console.error(err);
      setActiveWorkflow(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-[#222634] pb-4">
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Document Processing Hub</h2>
        <p className="text-sm text-slate-400 mt-1">Select a document type to scan and digitize.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* TRIP INVOICE */}
        <button onClick={() => triggerScanner("INVOICE")} className="bg-[#1A1F2C] border border-[#2B3142] hover:border-[#FF5A00] p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group">
          <div className="h-12 w-12 bg-[#FF5A00]/10 text-[#FF5A00] rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📄</div>
          <h3 className="text-sm font-black text-white uppercase">Trip Invoice</h3>
          <p className="text-[10px] text-slate-400 text-center font-bold">Scans to Pending Inbox for Trip Creation</p>
        </button>

        {/* FUEL SLIP */}
        <button onClick={() => triggerScanner("FUEL")} className="bg-[#1A1F2C] border border-[#2B3142] hover:border-sky-500 p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group">
          <div className="h-12 w-12 bg-sky-500/10 text-sky-400 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">⛽</div>
          <h3 className="text-sm font-black text-white uppercase">Diesel Slip</h3>
          <p className="text-[10px] text-slate-400 text-center font-bold">Attach fuel & manual KM to an active trip</p>
        </button>

        {/* POD CLOSURE */}
        <button onClick={() => triggerScanner("POD")} className="bg-[#1A1F2C] border border-[#2B3142] hover:border-emerald-500 p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group">
          <div className="h-12 w-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">⚖️</div>
          <h3 className="text-sm font-black text-white uppercase">POD / Weighment</h3>
          <p className="text-[10px] text-slate-400 text-center font-bold">Auto-calculate shortage & close trip</p>
        </button>
      </div>

      <div className="pt-8">
        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4">Future Modules</h4>
        <div className="grid grid-cols-2 gap-4 opacity-50 grayscale pointer-events-none">
           <div className="bg-[#12141C] border border-[#222634] p-4 rounded-xl flex items-center gap-4">
              <span className="text-xl">🔧</span><span className="text-xs font-bold text-slate-300">Service Bills</span>
           </div>
           <div className="bg-[#12141C] border border-[#222634] p-4 rounded-xl flex items-center gap-4">
              <span className="text-xl">🛞</span><span className="text-xs font-bold text-slate-300">Tyre & Retread Bills</span>
           </div>
        </div>
      </div>
    </div>
  );
}
