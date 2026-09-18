"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const KssLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="200" height="200" fill="#FF5A00" />
    <rect x="15" y="15" width="170" height="170" fill="#07080B" />
    <path d="M 50 35 L 50 165" stroke="#FF5A00" strokeWidth="24" strokeLinecap="square" />
    <path d="M 50 110 L 140 35" stroke="#FF5A00" strokeWidth="24" strokeLinecap="square" />
    <path d="M 85 85 C 130 95, 145 130, 145 165" stroke="#FF5A00" strokeWidth="24" fill="none" />
  </svg>
);

export function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please enter both credentials.");
      return;
    }
    setLoading(true);
    setErrorMsg("");

    const formattedEmail = email.includes("@") ? email.trim() : `${email.trim().toLowerCase()}@kssroadways.com`;

    const { error } = await supabase.auth.signInWithPassword({
      email: formattedEmail,
      password: password.trim()
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      router.replace("/");
    }
  };

  return (
    <div className="min-h-screen bg-[#07080B] flex flex-col items-center justify-center p-4 selection:bg-[#FF5A00]/20 selection:text-[#FF5A00]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,90,0,0.12),rgba(255,255,255,0))] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="glass-panel rounded-3xl p-8 sm:p-10 shadow-2xl border border-[#1E2230] glow-primary">
          
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#101218] border border-[#1E2230] flex items-center justify-center shadow-lg mb-4 overflow-hidden">
              <KssLogo className="w-12 h-12" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">KSS Roadways ERP</h1>
            <p className="text-xs text-slate-400 font-semibold mt-1">Enterprise Fleet Intelligence & Logistics Suite</p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-950/30 border border-rose-900/50 text-rose-400 text-xs font-bold animate-in slide-in-from-top-2 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Username / Corporate Email</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. superadmin"
                className="w-full text-sm p-3.5 rounded-xl border border-[#1E2230] bg-[#101218] text-white font-bold outline-none focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20 transition-all placeholder:text-slate-600"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Secure Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm p-3.5 rounded-xl border border-[#1E2230] bg-[#101218] text-white font-bold outline-none focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20 transition-all placeholder:text-slate-600"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-2 bg-[#FF5A00] hover:bg-[#E04F00] active:scale-[0.98] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-[#FF5A00]/25 disabled:bg-slate-800 disabled:text-slate-500 uppercase tracking-wider cursor-pointer"
            >
              {loading ? "Authenticating Session..." : "Authorize Access"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#1E2230] text-center">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Secured Enterprise Node • Cochin Operations</p>
          </div>

        </div>
      </div>
    </div>
  );
}
