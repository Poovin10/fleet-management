 "use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function UploadHub() {
  const supabase = createClient();
  const [documentType, setDocumentType] = useState("TRIP_INVOICE");
  const [rawText, setRawText] = useState("");
  const [parsedResult, setParsedResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Handle file selection and convert to readable text simulation or preview
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Read file name or pre-fill text context for quick parsing
    setRawText(`FILE: ${file.name} | UPLOADED ON: ${new Date().toLocaleDateString()}`);
  };

  const handleParseText = async () => {
    if (!rawText.trim()) {
      alert("Please upload an image or enter invoice details.");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch("/api/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          rawOcrText: rawText
        })
      });

      const json = await res.json();
      if (json.success) {
        setParsedResult(json.data);
      } else {
        alert("Parsing error: " + json.error);
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!parsedResult) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('pending_scans').insert([{
        document_type: documentType,
        extracted_data: parsedResult,
        status: 'PENDING'
      }]);

      if (error) throw error;
      alert("Document saved to verification queue successfully!");
      setParsedResult(null);
      setRawText("");
    } catch (err: any) {
      alert("Database error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-[#161922] border border-[#222634] rounded-2xl p-6 shadow-xl">
        <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4">Local Document Processing Hub</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Select Document Type</label>
            <select 
              value={documentType} 
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#1A1F2C] text-white font-bold outline-none focus:border-[#FF5A00]"
            >
              <option value="TRIP_INVOICE">Trip Invoice (JSW / UltraTech / ACC)</option>
              <option value="FUEL_SLIP">Diesel / Fuel Slip</option>
              <option value="POD_CLOSURE">POD Weighment Slip</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">Upload Invoice Image / Photo</label>
            <input 
              type="file" 
              accept="image/*"
              onChange={handleFileUpload}
              className="w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-[#FF5A00] file:text-white hover:file:bg-[#e04f00] cursor-pointer bg-[#1A1F2C] border border-[#2B3142] rounded-xl p-1.5"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-400 mb-1">Invoice Details / OCR Text Data</label>
          <textarea 
            rows={4}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Enter or paste details e.g., VEHICLE: TN88K8413, LR: 687/2026, QTY: 34.400 MT..."
            className="w-full text-sm p-3 rounded-xl border border-[#2B3142] bg-[#1A1F2C] text-white font-mono outline-none focus:border-[#FF5A00]"
          />
        </div>

        <button 
          onClick={handleParseText}
          disabled={isProcessing}
          className="px-6 py-3 bg-[#FF5A00] hover:bg-[#e04f00] disabled:bg-slate-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-[#FF5A00]/20"
        >
          {isProcessing ? "Processing..." : "⚡ Parse & Extract Fields"}
        </button>
      </div>

      {parsedResult && (
        <div className="bg-[#161922] border border-[#222634] rounded-2xl p-6 shadow-xl animate-in fade-in">
          <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider mb-4">Extracted Fields Preview</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            {Object.entries(parsedResult).map(([key, value]) => (
              <div key={key} className="bg-[#1A1F2C] border border-[#2B3142] p-3 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase">{key}</p>
                <p className="text-sm font-black text-white mt-1">{String(value)}</p>
              </div>
            ))}
          </div>

          <button 
            onClick={handleSaveToDatabase}
            disabled={isSaving}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg"
          >
            {isSaving ? "Saving..." : "💾 Confirm & Push to ERP Queue"}
          </button>
        </div>
      )}
    </div>
  );
}
