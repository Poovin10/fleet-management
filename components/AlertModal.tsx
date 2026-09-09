// components/AlertModal.tsx
import React from 'react';

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

export function AlertModal({ isOpen, title, message, type = 'info', onClose }: AlertModalProps) {
  if (!isOpen) return null;

  const isSuccess = type === 'success';
  const isError = type === 'error';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
        
        <div className="p-6 sm:p-8 text-center">
          {/* Dynamic Icon */}
          <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-inner ${
            isSuccess ? 'bg-emerald-100 text-emerald-600' : 
            isError ? 'bg-rose-100 text-rose-600' : 
            'bg-blue-100 text-blue-600'
          }`}>
            {isSuccess && (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            )}
            {isError && (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            )}
            {!isSuccess && !isError && (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
          </div>
          
          <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">{title}</h3>
          <p className="text-sm font-semibold text-slate-500 leading-relaxed">{message}</p>
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onClose}
            className={`w-full py-4 text-white font-black text-sm rounded-2xl transition-all shadow-md active:scale-95 ${
              isSuccess ? 'bg-emerald-600 hover:bg-emerald-700' : 
              isError ? 'bg-rose-600 hover:bg-rose-700' : 
              'bg-[#FF5A00] hover:bg-[#e04f00]'
            }`}
          >
            {isSuccess ? "Awesome, thanks!" : "OK, Got it"}
          </button>
        </div>

      </div>
    </div>
  );
}
