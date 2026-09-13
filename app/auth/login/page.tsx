"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const KssLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="200" height="200" fill="#FF5A00" />
    <rect x="15" y="15" width="170" height="170" fill="#FFFFFF" />
    <path d="M 50 35 L 50 165" stroke="#FF5A00" strokeWidth="24" strokeLinecap="square" />
    <path d="M 50 110 L 140 35" stroke="#FF5A00" strokeWidth="24" strokeLinecap="square" />
    <path d="M 85 85 C 130 95, 145 130, 145 165" stroke="#FF5A00" strokeWidth="24" fill="none" />
  </svg>
);

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    // Secretly format the User ID into an email for Supabase
    const formattedEmail = `${userId.trim().toLowerCase()}@kssroadways.com`;

    const { error } = await supabase.auth.signInWithPassword({
      email: formattedEmail,
      password,
    });

    if (error) {
      setErrorMsg("Invalid User ID or Password.");
      setIsLoading(false);
    } else {
      // Redirect to the main ERP dashboard upon success
      router.push("/");
      router.refresh(); // Force Next.js to update the server components
    }
  };

  const inputStyle = "flex h-12 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm text-slate-100 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A00] focus-visible:border-transparent placeholder:text-slate-500";

  return (
    <div className="relative animate-in fade-in zoom-in duration-500 w-full">
      {/* Subtle background glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-[#FF5A00] to-orange-400 rounded-[24px] blur opacity-20"></div>
      
      <div className="relative bg-slate-950 border border-slate-800 rounded-[24px] shadow-2xl p-8 overflow-hidden">
        
        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="w-14 h-14 rounded-xl overflow-hidden shadow-lg bg-white mb-4">
            <KssLogo className="w-full h-full" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">KSS Roadways</h1>
          <p className="text-[10px] font-bold text-[#FF5A00] uppercase tracking-[0.2em] mt-1">Enterprise Portal</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-center animate-in slide-in-from-top-2">
            <p className="text-xs font-bold text-rose-400">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-5 relative z-10">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Admin User ID</label>
            <input 
              type="text" 
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="e.g. admin" 
              className={inputStyle}
              required 
              autoComplete="off"
              autoCapitalize="none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
              className={inputStyle}
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full h-12 mt-4 bg-[#FF5A00] hover:bg-[#e04f00] text-white rounded-lg text-sm font-bold tracking-wide shadow-[0_0_20px_rgba(255,90,0,0.3)] hover:shadow-[0_0_25px_rgba(255,90,0,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? "Authenticating..." : "Secure Login"}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-800 pt-6">
          <p className="text-[10px] text-slate-500 font-semibold flex items-center justify-center gap-1.5">
            <span>🔒</span> Encrypted 256-bit Connection
          </p>
        </div>
      </div>
    </div>
  );
}
