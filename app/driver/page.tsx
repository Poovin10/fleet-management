// app/driver/page.tsx
"use client";

import { DriverPortal } from "@/components/DriverPortal";

export default function DriverPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <DriverPortal />
    </div>
  );
}
