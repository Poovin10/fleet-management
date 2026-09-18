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
    <div className="animate-tab-focus fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-full ${isDanger ? 'bg-rose-100 text-rose-600' : 'bg-orange-100 text-orange-600'}`}>
              {isDanger ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
              )}
            </div>
            <h3 className="text-xl font-bold text-fg">{title}</h3>
          </div>
          <p className="text-sm text-fg-secondary font-medium leading-relaxed">
            {message}
          </p>
        </div>

        <div className="p-4 bg-app border-t border-border flex justify-end gap-3">
          <button 
            onClick={onCancel}
            disabled={isProcessing}
            className="px-5 py-2.5 text-sm font-bold text-fg-secondary hover:text-fg hover:bg-surface-raised bg-surface border border-border rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 min-w-[120px] ${
              isDanger 
                ? "bg-rose-600 hover:bg-rose-700 active:bg-rose-800" 
                : "bg-orange-600 hover:bg-orange-700 active:bg-orange-800"
            } disabled:opacity-70`}
          >
            {isProcessing ? (
               <>
                 <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg> 
                 Processing...
               </>
            ) : (
               confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
