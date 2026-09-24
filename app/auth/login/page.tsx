"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setError(error.message);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app flex flex-col justify-center items-center relative overflow-hidden font-sans">
      {/* Dynamic Refraction Layers */}
      <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-accent/10 rounded-full blur-[120px] animate-pulse pointer-events-none mix-blend-screen" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-accent/10 rounded-full blur-[100px] animate-pulse pointer-events-none mix-blend-screen" style={{ animationDuration: '12s' }} />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />

      {/* True Liquid Glass Panel */}
      <div className="w-full max-w-md mx-auto p-10 rounded-[40px] liquid-glass relative z-10 mx-4">
        <div className="mb-10 text-center">
          <div className="w-16 h-16 rounded-[22px] bg-accent mx-auto flex items-center justify-center shadow-orange mb-6">
            <svg className="w-8 h-8 text-accent-fg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-fg tracking-[-0.03em]">KSS Roadways</h1>
          <p className="text-sm text-fg-muted mt-2 font-medium tracking-wide">Enterprise Telemetry Network</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <Input type="email" placeholder="System Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="password" placeholder="Authorization Key" value={password} onChange={(e) => setPassword(e.target.value)} required />
          
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm text-center backdrop-blur-md">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="default"
            disabled={loading}
            className="w-full h-auto rounded-2xl py-4 text-[15px] mt-4"
          >
            {loading ? "Authenticating..." : "Initialize Session"}
          </Button>
        </form>
      </div>
    </div>
  );
}
