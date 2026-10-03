"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal";
import { AlertModal } from "@/components/AlertModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/components/ui/usePagination";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ApprovalQueue() {
 const supabase = createClient();
 const [queue, setQueue] = useState<any[]>([]);
 const [showApprovalQueue, setShowApprovalQueue] = useState(false);
 const [queueSearch, setQueueSearch] = useState("");
 const [isLoading, setIsLoading] = useState(true);
 const [isProcessing, setIsProcessing] = useState(false);
 const [dieselRate, setDieselRate] = useState(95.0);

 const [rejectId, setRejectId] = useState<number | null>(null);
 const [approveData, setApproveData] = useState<{ isOpen: boolean; req: any; amount: string }>({ isOpen: false, req: null, amount: "" });
 const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: "", message: "", type: "info" as "success" | "error" | "info" });

 const fetchQueue = async () => {
 setIsLoading(true);
 
 const { data: dData } = await supabase.from('diesel_fuel_logs').select('diesel_rate_per_litre').order('fuel_date', { ascending: false }).limit(1);
 if (dData && dData.length > 0) setDieselRate(Number(dData[0].diesel_rate_per_litre));

 const { data: qData, error: qError } = await supabase.from('driver_pending_entries').select('*').eq('status', 'PENDING').order('submitted_at', { ascending: false });

 if (qError) {
 console.error("Error fetching queue:", qError);
 setAlertConfig({ isOpen: true, title: "Database Error", message: qError.message, type: "error" });
 }

 if (qData && qData.length > 0) {
 const { data: vData } = await supabase.from('vehicles').select('vehicle_id, vehicle_number');
 const mappedQueue = qData.map(req => {
 const truck = vData?.find(v => v.vehicle_id === req.vehicle_id);
 return { ...req, truck_number: truck ? truck.vehicle_number : `Truck ID: ${req.vehicle_id}` };
 });
 setQueue(mappedQueue);
 } else {
 setQueue([]);
 }
 
 setIsLoading(false);
 };

 useEffect(() => { fetchQueue(); }, []);

 const handleApproveClick = async (req: any) => {
 if (req.entry_type === 'FUEL') {
 const estimatedCost = Math.round((Number(req.litres) || 0) * dieselRate);
 setApproveData({ isOpen: true, req, amount: String(estimatedCost) });
 } else {
 setAlertConfig({
 isOpen: true,
 title: "Legacy Request",
 message: "This request type is no longer approved from this queue. Start Trip requests are handled directly by the atomic driver workflow.",
 type: "error"
 });
 }
 };

 const executeApprove = async (e: React.FormEvent) => {
 e.preventDefault();
 const { req, amount } = approveData;
 if (!req || !amount) return;

 setIsProcessing(true);

 const finalCost = Number(amount);

 if (!Number.isFinite(finalCost) || finalCost <= 0) {
 setIsProcessing(false);
 return setAlertConfig({
 isOpen: true,
 title: "Invalid Amount",
 message: "Please enter a valid diesel cost greater than zero.",
 type: "error"
 });
 }

 const { error } = await supabase.rpc("approve_driver_fuel_atomic", {
 p_entry_id: Number(req.entry_id),
 p_final_cost: finalCost,
 p_entered_by: "ApprovalQueue"
 });

 if (error) {
 setIsProcessing(false);
 setApproveData({ isOpen: false, req: null, amount: "" });

 let title = "Fuel Approval Failed";
 const message = error.message || "Unable to approve fuel request.";

 if (message.includes("PENDING_ENTRY_ALREADY_PROCESSED")) {
 title = "Already Processed";
 } else if (message.includes("FUEL_ODOMETER_REQUIRED")) {
 title = "Odometer Required";
 } else if (message.includes("ODOMETER_MUST_INCREASE_PREVIOUS")) {
 title = "Invalid Odometer";
 } else if (message.includes("VEHICLE_NOT_FOUND")) {
 title = "Vehicle Not Found";
 } else if (message.includes("FUEL_LITRES_INVALID")) {
 title = "Invalid Fuel Quantity";
 }

 return setAlertConfig({
 isOpen: true,
 title,
 message,
 type: "error"
 });
 }

 setIsProcessing(false);
 setApproveData({ isOpen: false, req: null, amount: "" });
 setAlertConfig({
 isOpen: true,
 title: "Approved!",
 message: "Fuel request approved and added to expenses.",
 type: "success"
 });
 fetchQueue();
 };

 const executeReject = async () => {
 if (!rejectId) return;

 setIsProcessing(true);

 const { error } = await supabase.rpc("reject_driver_pending_entry_atomic", {
 p_entry_id: Number(rejectId),
 p_rejection_reason: "Rejected from Approval Queue"
 });

 if (error) {
 setIsProcessing(false);

 let title = "Reject Failed";
 const message = error.message || "Unable to reject driver request.";

 if (message.includes("PENDING_ENTRY_ALREADY_PROCESSED")) {
 title = "Already Processed";
 }

 return setAlertConfig({
 isOpen: true,
 title,
 message,
 type: "error"
 });
 }

 setRejectId(null);
 setIsProcessing(false);
 fetchQueue();
 };

 const formatDateTime = (dateStr: string) => {
 if (!dateStr) return 'N/A';
 const d = new Date(dateStr);
 return `${d.toLocaleDateString('en-GB')} at ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
 };

 const filteredQueue = queue.filter(req => {
   const query = queueSearch.trim().toLowerCase();
   if (!query) return true;
   return [
     req.truck_number,
     req.driver_code,
     req.entry_type,
     req.receipt_remarks,
     req.submitted_at,
     req.litres,
     req.odometer_km,
   ].some(value => String(value ?? "").toLowerCase().includes(query));
 });
 const queuePagination = usePagination(filteredQueue, { pageSize: 10 });

 return (
 <div className="animate-tab-focus liquid-glass w-full max-w-none p-6 sm:p-8 shadow-xl animate-in fade-in duration-300">
 
 {!showApprovalQueue ? (
   <div className="liquid-glass w-full rounded-2xl p-5 sm:p-6">
     <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
       <div>
         <p className="kss-eyebrow text-accent">Operations · Driver Workflow</p>
         <h2 className="mt-1 text-xl font-semibold text-fg">Driver Approvals</h2>
         <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-secondary">
           Review pending driver submissions and approve or reject eligible
           operational entries.
         </p>
       </div>

       <Button
         type="button"
         size="lg"
         className="min-h-11 shrink-0 sm:min-w-48"
         onClick={() => setShowApprovalQueue(true)}
       >
         Open Approval Queue
       </Button>
     </div>
   </div>
 ) : null}

 <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} />

 <ConfirmModal isOpen={rejectId !== null} title="Reject Request" message="Are you sure you want to REJECT this driver request? This cannot be undone." isDanger={true} confirmText="Yes, Reject" onConfirm={executeReject} onCancel={() => setRejectId(null)} isProcessing={isProcessing} />

 <Dialog
   open={approveData.isOpen}
   onOpenChange={(open) => {
     if (!open && !isProcessing) {
       setApproveData({ isOpen: false, req: null, amount: "" });
     }
   }}
 >
   <DialogContent
     layout="modal"
     size="md"
     className="flex max-h-[88dvh] flex-col overflow-hidden p-0"
   >
     <DialogHeader className="px-6 py-5">
       <DialogTitle>Approve Fuel Request</DialogTitle>
       <p className="text-xs text-fg-secondary">Review the details and confirm the final bill amount.</p>
     </DialogHeader>

     <DialogBody className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
       <form onSubmit={executeApprove} className="space-y-6">
         <div className="kss-surface-raised space-y-3 rounded-lg border border-border p-4 text-sm">
           <div className="flex items-center justify-between">
             <span className="text-[10px] font-bold tracking-wider text-fg-secondary">Truck</span>
             <span className="font-semibold text-fg">{approveData.req?.truck_number}</span>
           </div>
           <div className="flex items-center justify-between">
             <span className="text-[10px] font-bold tracking-wider text-fg-secondary">Driver</span>
             <span className="font-bold text-fg-secondary">{approveData.req?.driver_code}</span>
           </div>
           <div className="flex items-center justify-between border-t border-border pt-2">
             <span className="text-[10px] font-bold tracking-wider text-fg-secondary">Requested Litres</span>
             <span className="text-lg font-semibold text-accent">{approveData.req?.litres} L</span>
           </div>
         </div>

         <div>
           <label className="mb-2 block text-[10px] font-bold text-success">Final Bill Amount *</label>
           <input
             type="number"
             step="0.01"
             required
             value={approveData.amount}
             onChange={e => setApproveData({...approveData, amount: e.target.value})}
             className="input-glass w-full rounded-lg border border-border p-4 text-xl font-semibold text-fg outline-none transition-all focus:border-success focus:ring-1 focus:ring-success"
           />
         </div>

         <div className="flex gap-3 border-t border-border pt-5">
           <Button
             type="button"
             variant="glass"
             className="flex-1"
             onClick={() => setApproveData({isOpen: false, req: null, amount: ""})}
             disabled={isProcessing}
           >
             Cancel
           </Button>
           <Button type="submit" variant="default" size="lg" className="flex-[2]" disabled={isProcessing}>
             {isProcessing ? "Processing..." : "Approve & Log Expense"}
           </Button>
         </div>
       </form>
     </DialogBody>
   </DialogContent>
 </Dialog>

 <Dialog
   open={showApprovalQueue}
   onOpenChange={(open) => {
     if (!open && !isProcessing) {
       setShowApprovalQueue(false);
     }
   }}
 >
   <DialogContent
     layout="modal"
     size="full"
     className="flex h-[92dvh] max-h-[92dvh] flex-col overflow-hidden p-0"
   >
     <DialogHeader className="px-5 py-4 sm:px-6">
       <DialogTitle className="text-lg">Driver Submissions Approval Queue</DialogTitle>
     </DialogHeader>

     <DialogBody className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
       <div className="mx-auto w-full max-w-[1450px]">
         <p className="mb-4 text-xs text-fg-muted">
           {filteredQueue.length} of {queue.length} pending submissions
         </p>

         <Input
           value={queueSearch}
           onChange={e => setQueueSearch(e.target.value)}
           placeholder="Search driver, truck, request type or remarks..."
           aria-label="Search approval queue"
           className="mb-4 w-full max-w-lg"
         />

         <div className="max-h-[62vh] overflow-auto rounded-xl border border-border">
           <Table className="min-w-[760px] text-xs text-left whitespace-nowrap">
             <TableHeader className="sticky top-0 z-10 bg-surface-raised text-fg-secondary font-bold">
               <TableRow>
                 <TableHead className="p-4 border-b border-border">Submitted At</TableHead>
                 <TableHead className="p-4 border-b border-border">Driver / Truck</TableHead>
                 <TableHead className="p-4 border-b border-border">Request Details</TableHead>
                 <TableHead className="p-4 border-b border-border">Driver Remarks</TableHead>
                 <TableHead className="p-4 border-b border-border text-right">Actions</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {queuePagination.paginatedItems.map(req => (
                 <TableRow key={req.entry_id}>
                   <TableCell className="p-4 font-semibold text-fg-secondary">{formatDateTime(req.submitted_at)}</TableCell>
                   <TableCell className="p-4">
                     <span className="font-semibold text-fg">{req.truck_number}</span><br/>
                     <span className="text-[10px] font-bold text-accent">{req.driver_code}</span>
                   </TableCell>
                   <TableCell className="p-4">
                     <span className="mr-2 rounded bg-info-soft px-2 py-1 text-[10px] font-semibold text-info">{req.entry_type}</span>
                     <span className="font-bold text-fg/90">
                       {req.entry_type === 'FUEL' ? `${req.litres} Litres (Odo: ${req.odometer_km})` : `${req.odometer_km} KM logged`}
                     </span>
                   </TableCell>
                   <TableCell className="max-w-[200px] truncate p-4 text-[11px] italic text-fg-secondary" title={req.receipt_remarks}>
                     {req.receipt_remarks || "No remarks"}
                   </TableCell>
                   <TableCell className="space-x-2 p-4 text-right">
                     <Button type="button" variant="destructive" size="sm" onClick={() => setRejectId(req.entry_id)}>
                       Reject
                     </Button>
                     <Button type="button" variant="secondary" size="sm" onClick={() => handleApproveClick(req)}>
                       {req.entry_type === 'FUEL' ? 'Approve' : 'Acknowledge'}
                     </Button>
                   </TableCell>
                 </TableRow>
               ))}
               {filteredQueue.length === 0 && (
                 <TableRow>
                   <TableCell colSpan={5} className="p-8 text-center text-fg-muted font-medium">
                     {queueSearch.trim() ? "No pending submissions match this search." : "The approval queue is currently empty."}
                   </TableCell>
                 </TableRow>
               )}
             </TableBody>
           </Table>
         </div>

         <Pagination
           page={queuePagination.page}
           totalPages={queuePagination.totalPages}
           onPageChange={queuePagination.setPage}
         />
       </div>
     </DialogBody>
   </DialogContent>
 </Dialog>

 </div>
 );
}
