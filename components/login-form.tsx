"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        alert("Authentication Failed: " + error.message);
      } else {
        alert("Access Authorized. Initializing Fleet Telemetry...");
        router.push("/");
        router.refresh();
      }
    });
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#05070B] font-sans selection:bg-[#FF5A00] selection:text-white">
      
      {/* Immersive Fleet Telemetry Background Grid & Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,90,0,0.15),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293d15_1px,transparent_1px),linear-gradient(to_bottom,#1f293d15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      {/* Floating Ambient Orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#FF5A00]/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px] pointer-events-none" />

      {/* iOS Liquidglass Authentication Card */}
      <div className="relative z-10 w-full max-w-md p-8 sm:p-10 mx-4 rounded-3xl bg-[#121622]/60 backdrop-blur-3xl saturate-200 border border-white/[0.12] shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-tab-focus">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF5A00] to-[#C93B00] flex items-center justify-center shadow-[0_0_32px_rgba(255,90,0,0.4)] mb-4 border border-white/20">
            <span className="text-2xl font-bold text-white tracking-wider font-mono">K</span>
          </div>
          <h1 className="text-xl font-semibold text-white/95 tracking-tight">KSS ROADWAYS ERP</h1>
          <p className="text-xs text-white/50 mt-1 font-medium">Enterprise Fleet Intelligence & Logistics Suite</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium text-center">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-white/60 tracking-wide uppercase">
              Corporate Username / Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="superadmin@kss.com"
              required
              className="w-full px-4 py-3.5 rounded-xl bg-black/40 border border-white/[0.08] text-white/90 placeholder-white/20 text-sm font-medium focus:outline-none focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20 transition-all shadow-inner"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-white/60 tracking-wide uppercase">
              Secure Passcode
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full px-4 py-3.5 rounded-xl bg-black/40 border border-white/[0.08] text-white/90 placeholder-white/20 text-sm font-medium focus:outline-none focus:border-[#FF5A00] focus:ring-2 focus:ring-[#FF5A00]/20 transition-all shadow-inner"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-2 py-4 rounded-xl bg-gradient-to-r from-[#FF5A00] to-[#E04F00] hover:brightness-110 text-white font-semibold text-sm tracking-wide shadow-[0_8px_24px_rgba(255,90,0,0.35)] transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {isPending ? "Authorizing Session..." : "Authorize Access"}
          </button>
        </form>

        {/* Ultrafleet Watermark */}
        <div className="mt-8 pt-6 border-t border-white/[0.06] text-center">
          <span className="text-[10px] font-medium text-white/40 tracking-wider uppercase block">
            Powered by <strong className="text-white/70 font-semibold">Ultrafleet Solutions</strong>
          </span>
        </div>

      </div>
    </div>
  );
}
