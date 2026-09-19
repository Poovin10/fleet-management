"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); } 
    else { router.push("/"); router.refresh(); }
  };

  return (
    <div className="min-h-screen bg-[#020203] flex flex-col justify-center items-center relative overflow-hidden font-sans">
      {/* Dynamic Refraction Layers */}
      <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-orange-600/10 rounded-full blur-[120px] animate-pulse pointer-events-none mix-blend-screen" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-amber-500/10 rounded-full blur-[100px] animate-pulse pointer-events-none mix-blend-screen" style={{ animationDuration: '12s' }} />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />

      {/* True Liquid Glass Panel */}
      <div className="w-full max-w-md mx-auto p-10 rounded-[40px] liquid-glass relative z-10 mx-4">
        <div className="mb-10 text-center">
          <div className="w-16 h-16 rounded-[22px] bg-gradient-to-b from-[#FFB340] to-[#FF9F0A] mx-auto flex items-center justify-center shadow-[0_10px_30px_rgba(255,159,10,0.4)] inset-shadow-sm mb-6 ios-spring">
            <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-[-0.03em]">KSS Roadways</h1>
          <p className="text-sm text-white/40 mt-2 font-medium tracking-wide">Enterprise Telemetry Network</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <input type="email" placeholder="System Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full liquid-input" required />
          <input type="password" placeholder="Authorization Key" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full liquid-input" required />
          
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm text-center backdrop-blur-md">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full btn-orange-glow rounded-2xl py-4 text-[15px] mt-4 disabled:opacity-50">
            {loading ? "Authenticating..." : "Initialize Session"}
          </button>
        </form>
      </div>
    </div>
  );
}