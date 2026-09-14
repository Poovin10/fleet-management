"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; 
import { createClient } from "@/lib/supabase/client";
import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "capacitor-native-biometric";

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
  const [supabase, setSupabase] = useState<any>(null);

  // Biometric States
  const [isNative, setIsNative] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPlainPassword, setShowPlainPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Secure Login");

  const SERVER_KEY = "kss-erp-admin-auth";

  useEffect(() => {
    try {
      setSupabase(createClient());
    } catch (err) {
      console.warn("Supabase client failed to initialize", err);
    }

    if (Capacitor.isNativePlatform()) {
      setIsNative(true);
      checkBiometrics();
    }
  }, []);

  const checkBiometrics = async () => {
    try {
      const result = await NativeBiometric.isAvailable();
      if (result.isAvailable) {
        setIsBiometricAvailable(true);
        const hasSaved = localStorage.getItem("kss_bio_saved") === "true";
        setHasStoredCredentials(hasSaved);
      }
    } catch (err) {
      console.warn("Biometrics not supported on this device.");
    }
  };

  const executeSupabaseLogin = async (email: string, pass: string, saveToKeystore: boolean) => {
    setIsLoading(true);
    setErrorMsg("");
    setStatusMsg("Authenticating...");

    try {
      const loginPromise = supabase.auth.signInWithPassword({
        email: email,
        password: pass,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timed out. Check network.")), 6000)
      );

      const response: any = await Promise.race([loginPromise, timeoutPromise]);
      const { data, error } = response;

      if (error || !data?.session) {
        setErrorMsg(error?.message || "Invalid Admin ID or Password.");
        setIsLoading(false);
        setStatusMsg("Secure Login");
        return;
      }

      if (saveToKeystore && isBiometricAvailable) {
        setStatusMsg("Securing biometric profile...");
        try {
          await NativeBiometric.setCredentials({
            username: email,
            password: pass,
            server: SERVER_KEY,
          });
          localStorage.setItem("kss_bio_saved", "true");
          setHasStoredCredentials(true);
        } catch (bioError) {
          console.warn("Could not save to Android Keystore", bioError);
        }
      }

      setStatusMsg("Success! Redirecting...");
      window.location.href = "/";

    } catch (err: any) {
      console.error("Login catch error:", err);
      setErrorMsg(err.message || "An error occurred during login.");
      setIsLoading(false);
      setStatusMsg("Secure Login");
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    const formattedEmail = userId.includes("@") 
      ? userId.trim() 
      : `${userId.trim().toLowerCase()}@kss.com`;

    await executeSupabaseLogin(formattedEmail, password, isNative);
  };

  const handleFingerprintLogin = async () => {
    setErrorMsg("");
    setIsLoading(true);
    setStatusMsg("Waiting for scan...");

    try {
      await NativeBiometric.verifyIdentity({
        reason: "Scan fingerprint to unlock KSS Roadways",
        title: "Enterprise Authentication",
        subtitle: "Verify your identity to proceed",
      });

      const credentials = await NativeBiometric.getCredentials({
        server: SERVER_KEY,
      });

      if (credentials) {
        setStatusMsg("Fingerprint accepted!");
        await executeSupabaseLogin(credentials.username, credentials.password, false);
      }
    } catch (error: any) {
      setIsLoading(false);
      setStatusMsg("Tap to Unlock");
      if (error.code !== "user_canceled") {
        setErrorMsg(`Scanner: ${error.message || "Not recognized."}`);
      }
    }
  };

  const inputStyle = "flex h-12 w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-2 text-sm text-slate-100 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A00] focus-visible:border-transparent placeholder:text-slate-500";

  return (
    <div className="relative animate-in fade-in zoom-in duration-500 w-full">
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

        {isNative && isBiometricAvailable && hasStoredCredentials ? (
          <div className="flex flex-col items-center justify-center space-y-6 relative z-10 py-4">
            <button 
              onClick={handleFingerprintLogin}
              disabled={isLoading}
              className="relative w-28 h-28 bg-transparent border border-[#FF5A00]/30 hover:border-[#FF5A00] rounded-full flex items-center justify-center transition-all duration-300 shadow-[0_0_15px_rgba(255,90,0,0.1)] hover:shadow-[0_0_30px_rgba(255,90,0,0.3)] group active:scale-95 disabled:opacity-50"
            >
              <div className="absolute inset-0 rounded-full border border-[#FF5A00] animate-ping opacity-20"></div>

              <svg 
                className={`w-12 h-12 text-[#FF5A00] ${isLoading ? 'animate-pulse' : 'group-hover:scale-110 transition-transform duration-300'}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth="1.2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
            </button>

            <div className="text-center space-y-1">
              <p className="text-xs font-black text-[#FF5A00] uppercase tracking-widest">
                {isLoading ? statusMsg : "Tap to Unlock"}
              </p>
              <button 
                onClick={() => {
                  setHasStoredCredentials(false);
                  localStorage.removeItem("kss_bio_saved");
                }}
                className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-4 hover:text-white transition-colors"
              >
                Use Password Instead
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleManualLogin} className="space-y-5 relative z-10" autoComplete="off">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Admin User ID</label>
              <input 
                type="text" 
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. superadmin" 
                className={inputStyle}
                required 
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                data-lpignore="true"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input 
                  type={showPlainPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className={`${inputStyle} pr-16`}
                  required 
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  data-lpignore="true"
                />
                <button
                  type="button"
                  onClick={() => setShowPlainPassword(!showPlainPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded"
                >
                  {showPlainPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-12 mt-4 bg-[#FF5A00] hover:bg-[#e04f00] text-white rounded-lg text-sm font-bold tracking-wide shadow-[0_0_20px_rgba(255,90,0,0.3)] hover:shadow-[0_0_25px_rgba(255,90,0,0.5)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? statusMsg : "Secure Login"}
            </button>
          </form>
        )}

        <div className="mt-8 text-center border-t border-slate-800 pt-6">
          <p className="text-[10px] text-slate-500 font-semibold flex items-center justify-center gap-1.5">
            <span>🔒</span> Encrypted 256-bit Connection
          </p>
        </div>
      </div>
    </div>
  );
}
