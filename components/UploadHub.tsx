"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function UploadHub() {
 const supabase = createClient();
 const [documentType, setDocumentType] = useState("TRIP_INVOICE");
 const [rawText, setRawText] = useState("");
 const [parsedResult, setParsedResult] = useState<any>(null);
 const [isProcessing, setIsProcessing] = useState(false);
 const [isSaving, setIsSaving] = useState(false);

 const handleParseText = async () => {
 if (!rawText.trim()) {
 alert("Please enter invoice or slip details.");
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
 <div className="animate-tab-focus space-y-6 max-w-4xl mx-auto">
 <div className="liquid-glass border border-border rounded-2xl p-6 shadow-xl">
 <h3 className="text-sm font-semibold text-fg  tracking-wider mb-4">Manual Document Entry Hub</h3>
 
 <div className="mb-4">
 <label className="block text-xs font-bold text-fg-secondary mb-1">Select Document Type</label>
 <Select
 value={documentType}
 onChange={(e) => setDocumentType(e.target.value)}
 className="h-auto rounded-xl px-3 py-3 font-bold"
 >
 <option value="TRIP_INVOICE">Trip Invoice (JSW / UltraTech / ACC)</option>
 <option value="FUEL_SLIP">Diesel / Fuel Slip</option>
 <option value="POD_CLOSURE">POD Weighment Slip</option>
 </Select>
 </div>

 <div className="mb-4">
 <label className="block text-xs font-bold text-fg-secondary mb-1">Enter Details (Vehicle, LR, Tonnage, etc.)</label>
 <textarea 
 rows={4}
 value={rawText}
 onChange={(e) => setRawText(e.target.value)}
 placeholder="Type details e.g., VEHICLE: TN88K8413, LR: 687/2026, QTY: 34.400 MT..."
 className="w-full text-sm p-3 rounded-xl border border-border input-glass bg-surface-raised/50 text-fg font-mono outline-none focus:border-accent"
 />
 </div>

 <Button
 type="button"
 variant="default"
 onClick={handleParseText}
 disabled={isProcessing}
 className="h-auto rounded-xl px-6 py-3 text-xs font-semibold tracking-wider"
 >
 {isProcessing ? "Processing..." : " Process Entry"}
 </Button>
 </div>

 {parsedResult && (
 <div className="liquid-glass border border-border rounded-2xl p-6 shadow-xl animate-in fade-in">
 <h4 className="text-xs font-semibold text-success  tracking-wider mb-4">Processed Fields Preview</h4>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
 {Object.entries(parsedResult).map(([key, value]) => (
 <div key={key} className="input-glass bg-surface-raised/50 border border-border p-3 rounded-xl">
 <p className="text-[10px] font-bold text-fg-secondary ">{key}</p>
 <p className="text-sm font-semibold text-fg mt-1">{String(value)}</p>
 </div>
 ))}
 </div>

 <Button
 type="button"
 variant="default"
 onClick={handleSaveToDatabase}
 disabled={isSaving}
 className="w-full h-auto rounded-xl py-3 text-xs font-semibold tracking-wider"
 >
 {isSaving ? "Saving..." : " Confirm & Push to ERP Queue"}
 </Button>
 </div>
 )}
 </div>
 );
}
