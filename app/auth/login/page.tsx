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
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] flex flex-col justify-center items-center relative overflow-hidden font-sans">
      {/* Telemetry Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      
      {/* Orange Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-500/25 mix-blend-screen rounded-full blur-[120px] pointer-events-none" />

      {/* Liquidglass Panel */}
      <div className="w-full max-w-sm mx-auto p-8 rounded-[32px] bg-white/[0.06] backdrop-blur-3xl border border-white/[0.2] shadow-2xl relative z-10">
        <div className="mb-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 mx-auto flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.3)] mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">KSS Roadways</h1>
          <p className="text-sm text-white/40 mt-1 font-mono uppercase tracking-wider">Secure Telemetry Access</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="System Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all font-mono text-sm"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Authorization Key"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all font-mono text-sm"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(249,115,22,0.2)] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Authenticating..." : "Initialize Session"}
          </button>
        </form>
      </div>

      {/* Watermark */}
      <div className="absolute bottom-8 text-[10px] text-white/20 font-mono uppercase tracking-[0.3em]">
        Powered by Ultrafleet Solutions
      </div>
    </div>
  );
}
