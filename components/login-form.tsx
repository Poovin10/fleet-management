"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-app font-sans selection:bg-accent selection:text-accent-fg">
      
      {/* Immersive Fleet Telemetry Background Grid & Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,90,0,0.15),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293d15_1px,transparent_1px),linear-gradient(to_bottom,#1f293d15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      {/* Floating Ambient Orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px] pointer-events-none" />

      {/* iOS Liquidglass Authentication Card */}
      <div className="relative z-10 w-full max-w-md p-8 sm:p-10 mx-4 rounded-3xl bg-surface-raised/70 backdrop-blur-3xl saturate-200 border border-border-strong shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-tab-focus">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center shadow-orange mb-4 border border-border-strong">
            <span className="text-2xl font-bold text-white tracking-wider font-mono">K</span>
          </div>
          <h1 className="text-xl font-semibold text-fg tracking-tight">KSS ROADWAYS ERP</h1>
          <p className="text-xs text-fg-muted mt-1 font-medium">Enterprise Fleet Intelligence & Logistics Suite</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-medium text-center">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-fg-secondary tracking-wide uppercase">
              Corporate Username / Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="superadmin@kss.com"
              required
              className="h-auto rounded-xl px-4 py-3.5"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium text-fg-secondary tracking-wide uppercase">
              Secure Passcode
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="h-auto rounded-xl px-4 py-3.5"
            />
          </div>

          <Button
            type="submit"
            variant="default"
            disabled={isPending}
            className="w-full mt-2 h-auto rounded-full py-4 text-sm tracking-wide"
          >
            {isPending ? "Authorizing Session..." : "Authorize Access"}
          </Button>
        </form>

        {/* Ultrafleet Watermark */}
        <div className="mt-8 pt-6 border-t border-border-subtle text-center">
          <span className="text-[10px] font-medium text-fg-muted tracking-wider uppercase block">
            Powered by <strong className="text-fg-secondary font-semibold">Ultrafleet Solutions</strong>
          </span>
        </div>

      </div>
    </div>
  );
}
