"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// 🚀 FIX: Increased to 1600px / 80% Quality. Crystal clear for AI, but still small enough for Vercel!
const compressImageBase64 = (base64Str: string, maxWidth = 1600, quality = 0.8): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = "data:image/jpeg;base64," + base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      if (width > height && width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      } else if (height > maxWidth) {
        width *= maxWidth / height;
        height = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
    };
    img.onerror = () => resolve(base64Str);
  });
};

export function UploadHub() {
  const supabase = createClient();
  const [activeWorkflow, setActiveWorkflow] = useState<string | null>(null);
  const [selectionModalFor, setSelectionModalFor] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: "", message: "", type: "info" as "success" | "error" | "info" });
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') setIsMobile(/android|iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()));
  }, []);

  const handleWebUpload = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = "image/png, image/jpeg, image/jpg";
      input.onchange = (e: any) => {
        const file = e.target.files[0]; if (!file) return resolve("");
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = (err) => reject(err);
      };
      input.click();
    });
  };

  const triggerScanner = async (docType: string, sourceSelection: any) => {
    setSelectionModalFor(null);
    let rawBase64 = "";

    try {
      if (sourceSelection === "WEB") {
        rawBase64 = await handleWebUpload();
      } else {
        // 🚀 FIX: Capacitor camera bumped to high-res mode
        const image = await Camera.getPhoto({
          quality: 80, width: 1600, allowEditing: true, resultType: CameraResultType.Base64, source: sourceSelection 
        });
        rawBase64 = image.base64String || "";
      }

      if (!rawBase64) return;
      setActiveWorkflow(docType);

      const finalBase64 = await compressImageBase64(rawBase64, 1600, 0.8);
      const apiDocType = docType === "INVOICE" ? "TRIP_INVOICE" : docType === "FUEL" ? "FUEL_SLIP" : "POD_CLOSURE";

      const response = await fetch('/api/parse-document', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: finalBase64, documentType: apiDocType }) 
      });

      const responseText = await response.text();
      if (!response.ok) {
        if (response.status === 413 || responseText.includes("Request Entity Too Large")) throw new Error("Image too large. Step back slightly.");
        if (response.status === 504) throw new Error("Server Timeout. The AI took too long. Try again.");
        
        let serverErrMsg = responseText || `Unknown Error (Status ${response.status})`;
        try {
          const parsed = JSON.parse(responseText);
          if (parsed.error) serverErrMsg = parsed.error;
        } catch (e) {}
        throw new Error(serverErrMsg);
      }

      const { data, error } = JSON.parse(responseText);
      if (error) throw new Error(error);

      if (docType === "INVOICE") {
        const extractedLr = data.lrNo ? String(data.lrNo).toUpperCase().trim() : null;
        let shouldInsert = true;
        if (extractedLr) {
          const { data: existingScan } = await supabase.from('pending_scans').select('scan_id').eq('lr_number', extractedLr).eq('status', 'PENDING').single();
          if (existingScan) {
            shouldInsert = false;
            await supabase.from('pending_scans').update({ tonnage_extracted: data.tonnage ? Number(data.tonnage) : null, destination: data.destination ? String(data.destination).toUpperCase() : null, source: data.source ? String(data.source).toUpperCase() : null, truck_number: data.truckNo ? String(data.truckNo).toUpperCase() : null, cargo_type: data.cargoType ? String(data.cargoType).toUpperCase() : null, raw_json_result: data }).eq('scan_id', existingScan.scan_id);
          }
        }
        if (shouldInsert) {
          await supabase.from('pending_scans').insert([{ document_type: apiDocType, lr_number: extractedLr, tonnage_extracted: data.tonnage ? Number(data.tonnage) : null, destination: data.destination ? String(data.destination).toUpperCase() : null, source: data.source ? String(data.source).toUpperCase() : null, truck_number: data.truckNo ? String(data.truckNo).toUpperCase() : null, cargo_type: data.cargoType ? String(data.cargoType).toUpperCase() : null, raw_json_result: data, status: 'PENDING' }]);
        }
        setAlertConfig({ isOpen: true, title: "Inbox Updated ✨", message: "Invoice digitized and sent to Trip Creation Inbox.", type: "success" });
      } else {
        await supabase.from('pending_scans').insert([{ document_type: apiDocType, raw_json_result: data, status: 'PENDING' }]);
        setAlertConfig({ isOpen: true, title: "Uploaded ✨", message: `${docType} sent to office successfully.`, type: "success" });
      }
    } catch (err: any) {
      console.error("Scanner Error:", err);
      const errMsg = err.message || String(err);
      if (!errMsg.toLowerCase().includes("cancel") && !errMsg.toLowerCase().includes("dismissed")) {
        setAlertConfig({ isOpen: true, title: "Scan Failed", message: errMsg, type: "error" });
      }
    } finally {
      setActiveWorkflow(null);
    }
  };

  const isBusy = activeWorkflow !== null || selectionModalFor !== null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300 relative bg-[#12141C] border border-[#222634] rounded-2xl p-6 sm:p-8 shadow-xl">
      <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} />

      {selectionModalFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#12141C] border border-[#2B3142] rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-black text-white mb-4 text-center uppercase tracking-wide">Upload Source</h3>
            <div className="space-y-3">
              {isMobile ? (
                <>
                  <button onClick={() => triggerScanner(selectionModalFor, CameraSource.Camera)} className="w-full flex items-center justify-center gap-3 p-4 bg-[#1A1F2C] hover:bg-[#FF5A00]/20 border border-[#2B3142] hover:border-[#FF5A00] rounded-xl transition-all group text-white font-bold"><span className="text-2xl group-hover:scale-110 transition-transform">📸</span> Take New Photo</button>
                  <button onClick={() => triggerScanner(selectionModalFor, CameraSource.Photos)} className="w-full flex items-center justify-center gap-3 p-4 bg-[#1A1F2C] hover:bg-[#FF5A00]/20 border border-[#2B3142] hover:border-[#FF5A00] rounded-xl transition-all group text-white font-bold"><span className="text-2xl group-hover:scale-110 transition-transform">🖼️</span> Select from Gallery</button>
                </>
              ) : (
                <button onClick={() => triggerScanner(selectionModalFor, "WEB")} className="w-full flex items-center justify-center gap-3 p-4 bg-[#1A1F2C] hover:bg-sky-500/20 border border-[#2B3142] hover:border-sky-500 rounded-xl transition-all group text-white font-bold"><span className="text-2xl group-hover:scale-110 transition-transform">📂</span> Choose File from Computer</button>
              )}
              <button onClick={() => setSelectionModalFor(null)} className="w-full p-3 mt-2 text-sm text-slate-500 font-bold hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-[#222634] pb-4">
        <h2 className="text-xl font-black text-white uppercase tracking-tight">Document Processing Hub</h2>
        <p className="text-sm text-slate-400 mt-1">Select a document type to scan and digitize.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button onClick={() => setSelectionModalFor("INVOICE")} disabled={isBusy} className="bg-[#1A1F2C] border border-[#2B3142] hover:border-[#FF5A00] disabled:opacity-50 disabled:cursor-not-allowed p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group">
          <div className="h-12 w-12 bg-[#FF5A00]/10 text-[#FF5A00] rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">{activeWorkflow === "INVOICE" ? "⏳" : "📄"}</div>
          <h3 className="text-sm font-black text-white uppercase">{activeWorkflow === "INVOICE" ? "Parsing AI..." : "Trip Invoice"}</h3>
          <p className="text-[10px] text-slate-400 text-center font-bold">Scans to Pending Inbox for Trip Creation</p>
        </button>
        <button onClick={() => setSelectionModalFor("FUEL")} disabled={isBusy} className="bg-[#1A1F2C] border border-[#2B3142] hover:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group">
          <div className="h-12 w-12 bg-sky-500/10 text-sky-400 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">{activeWorkflow === "FUEL" ? "⏳" : "⛽"}</div>
          <h3 className="text-sm font-black text-white uppercase">{activeWorkflow === "FUEL" ? "Parsing AI..." : "Diesel Slip"}</h3>
          <p className="text-[10px] text-slate-400 text-center font-bold">Attach fuel & manual KM to an active trip</p>
        </button>
        <button onClick={() => setSelectionModalFor("POD")} disabled={isBusy} className="bg-[#1A1F2C] border border-[#2B3142] hover:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all group">
          <div className="h-12 w-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">{activeWorkflow === "POD" ? "⏳" : "⚖️"}</div>
          <h3 className="text-sm font-black text-white uppercase">{activeWorkflow === "POD" ? "Parsing AI..." : "POD / Weighment"}</h3>
          <p className="text-[10px] text-slate-400 text-center font-bold">Auto-calculate shortage & close trip</p>
        </button>
      </div>
    </div>
  );
}
