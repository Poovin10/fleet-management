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
        // Safely check if we saved credentials before WITHOUT waking up the scanner
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

      // Secure the credentials in the Android Keystore for future fingerprint logins
      if (saveToKeystore && isBiometricAvailable) {
        setStatusMsg("Securing biometric profile...");
        try {
          await NativeBiometric.setCredentials({
            username: email,
            password: pass,
            server: SERVER_KEY,
          });
          // Drop a safe flag so the app knows it can show the fingerprint button next time
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

    // Try to save to Keystore if running natively
    await executeSupabaseLogin(formattedEmail, password, isNative);
  };

  const handleFingerprintLogin = async () => {
    setErrorMsg("");
    setIsLoading(true);
    setStatusMsg("Waiting for scan...");
    
    try {
      // THIS is what physically turns on the Android fingerprint UI
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
      setErrorMsg(`Scanner: ${error.message || "Canceled or not recognized."}`);
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
          <div className="space-y-4 relative z-10">
            <button 
              onClick={handleFingerprintLogin}
              disabled={isLoading}
              className="w-full h-20 bg-[#161922] border border-[#2B3142] hover:border-[#FF5A00] text-[#FF5A00] rounded-xl flex flex-col items-center justify-center gap-1 transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              <span className="text-3xl">👆</span>
              <span className="text-xs font-black uppercase tracking-wider">{isLoading ? statusMsg : "Tap to Unlock"}</span>
            </button>
            <button 
              onClick={() => {
                setHasStoredCredentials(false);
                localStorage.removeItem("kss_bio_saved");
              }}
              className="w-full text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider py-2 hover:text-white transition-colors"
            >
              Use Password Instead
            </button>
          </div>
        ) : (
          <form onSubmit={handleManualLogin} className="space-y-5 relative z-10">
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
              className="w-full h-12 mt-4 bg-[#FF5A00] hover:bg-[#e04f00] text-white rounded-lg text-sm font-bold tracking-wide shadow-[0_0_20px_rgba(255,90,0,0.3)] hover:shadow-[0_0_25px_rgba(255,90,0,0.5)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? statusMsg : "Secure Login"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
