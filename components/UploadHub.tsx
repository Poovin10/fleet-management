"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertModal } from "@/components/AlertModal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
} from "@/components/ui/dialog";

export function UploadHub() {
 const supabase = createClient();
 const [documentType, setDocumentType] = useState("TRIP_INVOICE");
 const [rawText, setRawText] = useState("");
 const [parsedResult, setParsedResult] = useState<any>(null);
 const [isProcessing, setIsProcessing] = useState(false);
 const [isSaving, setIsSaving] = useState(false);
 const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);

 const [alertConfig, setAlertConfig] = useState<{
  isOpen: boolean;
  title: string;
  message: string;
  type: "success" | "error" | "info";
 }>({
  isOpen: false,
  title: "",
  message: "",
  type: "info",
 });

 const showAlert = (
  title: string,
  message: string,
  type: "success" | "error" | "info" = "info",
 ) => {
  setAlertConfig({
   isOpen: true,
   title,
   message,
   type,
  });
 };

 const closeAlert = () => {
  setAlertConfig((current) => ({
   ...current,
   isOpen: false,
  }));
 };

 const handleParseText = async () => {
 if (!rawText.trim()) {
 showAlert(
 "Missing Document Details",
 "Please enter invoice or slip details.",
 "error",
);
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
 showAlert(
 "Document Parsing Failed",
 json.error || "The document could not be parsed.",
 "error",
);
 }
 } catch (err: any) {
 showAlert(
 "Parsing Error",
 err?.message || "A network error occurred while processing the document.",
 "error",
);
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
 raw_json_result: parsedResult,
 status: 'PENDING'
 }]);

 if (error) throw error;
 showAlert(
 "Document Queued",
 "Document saved to verification queue successfully.",
 "success",
);
 setParsedResult(null);
 setRawText("");
 } catch (err: any) {
 showAlert(
 "Queue Save Failed",
 err?.message || "A database error occurred while saving the document.",
 "error",
);
 } finally {
 setIsSaving(false);
 }
 };

 return (
 <>
  <AlertModal
   isOpen={alertConfig.isOpen}
   title={alertConfig.title}
   message={alertConfig.message}
   type={alertConfig.type}
   onClose={closeAlert}
  />

  <div className="animate-tab-focus space-y-5 max-w-5xl mx-auto">
   {!isWorkspaceOpen && (
    <div className="liquid-glass rounded-2xl border border-border p-6 shadow-xl">
     <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div>
       <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
        Document Intake
       </p>
       <h3 className="mt-2 text-lg font-semibold text-fg">
        Manual Document Entry Hub
       </h3>
       <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-muted">
        Process invoice, fuel slip and POD document details into the ERP verification queue.
       </p>
      </div>

      <Button
       type="button"
       variant="default"
       onClick={() => setIsWorkspaceOpen(true)}
       className="shrink-0 rounded-xl px-5 py-3 text-xs font-semibold tracking-wider"
      >
       Open Upload Hub
      </Button>
     </div>
    </div>
   )}

   <Dialog open={isWorkspaceOpen} onOpenChange={setIsWorkspaceOpen}>
    <DialogContent size="xl">
     <DialogHeader>
      <DialogTitle>Manual Document Entry</DialogTitle>
      <DialogDescription>
       Process document details and place the verified result into the ERP queue.
      </DialogDescription>
     </DialogHeader>

     <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
       <div>
        <label className="mb-1 block text-xs font-semibold text-fg-secondary">
         Document Type
        </label>
        <Select
         value={documentType}
         onChange={(e) => setDocumentType(e.target.value)}
         className="h-auto rounded-xl px-3 py-3 font-semibold"
        >
         <option value="TRIP_INVOICE">
          Trip Invoice (JSW / UltraTech / ACC)
         </option>
         <option value="FUEL_SLIP">Diesel / Fuel Slip</option>
         <option value="POD_CLOSURE">POD Weighment Slip</option>
        </Select>
       </div>

       <div>
        <label className="mb-1 block text-xs font-semibold text-fg-secondary">
         Document Details
        </label>
        <textarea
         rows={4}
         value={rawText}
         onChange={(e) => setRawText(e.target.value)}
         placeholder="Vehicle, LR, tonnage, source, destination, invoice or slip details..."
         className="input-glass w-full rounded-xl border border-border bg-surface-raised/50 p-3 text-sm font-mono text-fg outline-none focus:border-accent"
        />
       </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
       <Button
        type="button"
        variant="glass"
        onClick={() => setIsWorkspaceOpen(false)}
        disabled={isProcessing || isSaving}
        className="rounded-xl px-5"
       >
        Close
       </Button>

       <Button
        type="button"
        variant="default"
        onClick={handleParseText}
        disabled={isProcessing}
        className="rounded-xl px-6 py-3 text-xs font-semibold tracking-wider"
       >
        {isProcessing ? "Processing..." : "Process Entry"}
       </Button>
      </div>

      {parsedResult && (
       <div className="liquid-glass rounded-2xl border border-border p-5 shadow-lg">
        <div className="mb-4">
         <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-success">
          Processed Fields
         </p>
         <p className="mt-1 text-xs text-fg-muted">
          Review the extracted values before sending them to the ERP verification queue.
         </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
         {Object.entries(parsedResult).map(([key, value]) => (
          <div
           key={key}
           className="input-glass rounded-xl border border-border bg-surface-raised/50 p-3"
          >
           <p className="text-[10px] font-semibold text-fg-secondary">
            {key}
           </p>
           <p className="mt-1 break-words text-sm font-semibold text-fg">
            {String(value)}
           </p>
          </div>
         ))}
        </div>

        <div className="flex justify-end">
         <Button
          type="button"
          variant="default"
          onClick={handleSaveToDatabase}
          disabled={isSaving}
          className="rounded-xl px-6 py-3 text-xs font-semibold tracking-wider"
         >
          {isSaving ? "Saving..." : "Confirm & Push to ERP Queue"}
         </Button>
        </div>
       </div>
      )}
     </div>
    </DialogContent>
   </Dialog>
  </div>
 </>
 );

}
