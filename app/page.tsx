"use client";

import { useState, useEffect } from "react";
import { DriverPortal } from "@/components/DriverPortal";

export default function SaaS_ERPDashboard() {
  // --- 1. Routing & Loading State ---
  const [isDriverRoute, setIsDriverRoute] = useState(false);
  const [isCheckingRoute, setIsCheckingRoute] = useState(true);

  // --- 2. Auth State (Keep your existing auth logic here) ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Example state for a simple login form (replace with your actual Supabase/auth state)
  const [password, setPassword] = useState("");

  useEffect(() => {
    // Safely check the URL path on the client side
    if (typeof window !== "undefined") {
      if (window.location.pathname.startsWith('/driver')) {
        setIsDriverRoute(true);
      }
    }
    setIsCheckingRoute(false);
  }, []);

  // Show a blank screen briefly while checking the URL to prevent UI flashing
  if (isCheckingRoute) {
    return <div className="min-h-screen bg-slate-900" />;
  }

  // ==========================================
  // VIEW 1: PUBLIC DRIVER PORTAL (Bypasses Login)
  // ==========================================
  if (isDriverRoute) {
    return (
      <div className="min-h-screen bg-slate-900 py-6 px-4" style={{ colorScheme: 'light' }}>
        <div className="max-w-md mx-auto mb-6 text-center">
          <h1 className="text-xl font-black text-white">KSS Roadways</h1>
          <p className="text-xs text-[#FF5A00] uppercase tracking-widest font-bold">Driver Highway Portal</p>
        </div>
        <DriverPortal />
      </div>
    );
  }

  // ==========================================
  // VIEW 2: SECURE ERP DASHBOARD (Login Gate)
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-4">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">KSS Roadways</h1>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ERP System</h2>
          </div>
          
          <div className="space-y-4">
            <input
              type="password"
              placeholder="Enter Access Key..."
              className="w-full p-3 border border-slate-300 dark:border-slate-700 rounded bg-transparent text-slate-900 dark:text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              onClick={() => {
                // TODO: Replace with your actual authentication check
                if (password.length > 0) setIsAuthenticated(true);
              }}
              className="w-full bg-[#FF5A00] text-white font-bold p-3 rounded hover:bg-[#e04f00] transition-colors"
            >
              Secure Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: MAIN ERP DASHBOARD 
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Top Navigation */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Operations Dashboard</h1>
            <p className="text-xs text-slate-500">KSS Roadways ERP</p>
          </div>
          <button 
            onClick={() => setIsAuthenticated(false)}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>
      
      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* PASTE YOUR EXISTING TABS AND APPROVAL QUEUE COMPONENTS HERE */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Driver Approvals & Corrections</h2>
          
          <div className="text-slate-500 dark:text-slate-400 text-sm">
            {/* Example: <ApprovalQueue /> */}
            <p>Your operations modules, live status notifications, and inline editing queues go here.</p>
          </div>
        </div>

      </main>
    </div>
  );
}
