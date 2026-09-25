"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ConfirmModal";
import { AlertModal } from "@/components/AlertModal";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export function ApprovalQueue() {
 const supabase = createClient();
 const [queue, setQueue] = useState<any[]>([]);
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

 return (
 <div className="animate-tab-focus liquid-glass p-6 sm:p-8 shadow-xl max-w-5xl mx-auto animate-in fade-in duration-300">
 
 <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} />

 <ConfirmModal isOpen={rejectId !== null} title="Reject Request" message="Are you sure you want to REJECT this driver request? This cannot be undone." isDanger={true} confirmText="Yes, Reject" onConfirm={executeReject} onCancel={() => setRejectId(null)} isProcessing={isProcessing} />

 {approveData.isOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
 <div className="liquid-glass">
 <form onSubmit={executeApprove}>
 <div className="p-6">
 <h3 className="text-lg font-semibold text-fg  tracking-wide mb-1">Approve Fuel Request</h3>
 <p className="text-xs text-fg-secondary mb-6">Review the details and confirm the final bill amount.</p>
 
 <div className="kss-surface-raised p-4 rounded-lg border border-border mb-6 space-y-3 text-sm">
 <div className="flex justify-between items-center"><span className="text-[10px] text-fg-secondary font-bold  tracking-wider">Truck</span> <span className="text-fg font-semibold">{approveData.req?.truck_number}</span></div>
 <div className="flex justify-between items-center"><span className="text-[10px] text-fg-secondary font-bold  tracking-wider">Driver</span> <span className="text-fg-secondary font-bold">{approveData.req?.driver_code}</span></div>
 <div className="flex justify-between items-center pt-2 border-t border-border"><span className="text-[10px] text-fg-secondary font-bold  tracking-wider">Requested Litres</span> <span className="text-accent font-semibold text-lg">{approveData.req?.litres} L</span></div>
 </div>

 <label className="block text-[10px] font-bold text-success  mb-2">Final Bill Amount () *</label>
 <input type="number" step="0.01" required value={approveData.amount} onChange={e => setApproveData({...approveData, amount: e.target.value})} className="w-full text-xl p-4 rounded-lg border border-border input-glass text-fg font-semibold outline-none focus:border-success focus:ring-1 focus:ring-success transition-all" />
 </div>
 <div className="flex gap-3 p-6 pt-0">
 <Button type="button" variant="glass" className="flex-1" onClick={() => setApproveData({isOpen: false, req: null, amount: ""})} disabled={isProcessing}>Cancel</Button>
 <Button type="submit" variant="default" size="lg" className="flex-[2]" disabled={isProcessing}>
 {isProcessing ? "Processing..." : "Approve & Log Expense"}
 </Button>
 </div>
 </form>
 </div>
 </div>
 )}

 <div className="flex justify-between items-center border-b border-border pb-3 mb-6">
 <h3 className="text-sm font-semibold text-fg  tracking-wide">Driver Submissions Approval Queue</h3>
 <span className="px-3 py-1 bg-warning-soft text-warning text-[10px] font-bold rounded-lg  tracking-normal">{queue.length} Pending</span>
 </div>

 <div className="overflow-x-auto w-full">
 <Table className="min-w-full text-xs text-left whitespace-nowrap">
 <TableHeader className="text-fg-secondary font-bold">
 <TableRow>
 <TableHead className="p-4 border-b border-border">Submitted At</TableHead>
 <TableHead className="p-4 border-b border-border">Driver / Truck</TableHead>
 <TableHead className="p-4 border-b border-border">Request Details</TableHead>
 <TableHead className="p-4 border-b border-border">Driver Remarks</TableHead>
 <TableHead className="p-4 border-b border-border text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody className="">
 {queue.map(req => (
 <TableRow key={req.entry_id} className="">
 <TableCell className="p-4 font-semibold text-fg-secondary">{formatDateTime(req.submitted_at)}</TableCell>
 <TableCell className="p-4"><span className="font-semibold text-fg">{req.truck_number}</span><br/><span className="text-[10px] font-bold text-accent">{req.driver_code}</span></TableCell>
 <TableCell className="p-4">
 <span className="px-2 py-1 rounded bg-info-soft text-info font-semibold text-[10px]  mr-2">{req.entry_type}</span>
 <span className="font-bold text-fg/90">
 {req.entry_type === 'FUEL' ? `${req.litres} Litres (Odo: ${req.odometer_km})` : `${req.odometer_km} KM logged`}
 </span>
 </TableCell>
 <TableCell className="p-4 text-fg-secondary italic text-[11px] max-w-[200px] truncate" title={req.receipt_remarks}>{req.receipt_remarks || "No remarks"}</TableCell>
 <TableCell className="p-4 text-right space-x-2">
 <Button type="button" variant="destructive" size="sm" onClick={() => setRejectId(req.entry_id)}>Reject</Button>
 <Button type="button" variant="secondary" size="sm" onClick={() => handleApproveClick(req)}>
 {req.entry_type === 'FUEL' ? 'Approve' : 'Acknowledge'}
 </Button>
 </TableCell>
 </TableRow>
 ))}
 {queue.length === 0 && !isLoading && (
 <TableRow><TableCell colSpan={5} className="p-8 text-center text-fg-muted font-medium">All driver requests have been processed. The queue is currently empty.</TableCell></TableRow>
 )}
 </TableBody>
 </Table>
 </div>
 </div>
 );
}
