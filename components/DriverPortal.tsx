"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function DriverPortal() {
  const [supabase, setSupabase] = useState<any>(null);

  useEffect(() => {
    try {
      setSupabase(createClient());
    } catch (err) {
      console.error("Failed to initialize Supabase in DriverPortal", err);
    }
  }, []);

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  
  // ... rest of your DriverPortal code ...
