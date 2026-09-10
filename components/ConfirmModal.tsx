"use client";

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  isDanger = false,
  onConfirm,
  onCancel,
  isProcessing = false
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header & Body */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-full ${isDanger ? 'bg-rose-100 text-rose-600' : 'bg-orange-100 text-orange-600'}`}>
              {isDanger ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
              )}
            </div>
            <h3 className="text-xl font-black text-slate-900">{title}</h3>
          </div>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            {message}
          </p>
        </div>

        {/* Modal Footer (Actions) */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button 
            onClick={onCancel}
            disabled={isProcessing}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 bg-surface border border-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-colors shadow-sm flex items-center gap-2 ${
              isDanger 
                ? "bg-rose-600 hover:bg-rose-700 active:bg-rose-800" 
                : "bg-orange-600 hover:bg-orange-700 active:bg-orange-800"
            } disabled:opacity-70`}
          >
            {isProcessing ? (
               <><span className="animate-spin text-lg leading-none">⚙️</span> Processing...</>
            ) : (
               confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
