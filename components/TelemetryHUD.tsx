"use client";

import { DashboardOwnerCommandCenter } from "@/components/DashboardOwnerCommandCenter";

type DashboardAction = "Trips" | "POD Closure" | "Driver Approvals" | "Quick Status" | "Fuel" | "Workshop & Tyres" | "Driver Settlement" | "Reports" | "Fleet Analytics" | "Master";

type TelemetryHUDProps = {
  onNavigate: (destination: DashboardAction) => void;
  canAccessOperations: boolean;
  onFleetSnapshot?: (vehicles: Array<{
    vehicle_id: number;
    vehicle_number: string;
    carrying_capacity_tons: number;
    truck_type: string | null;
    current_status: string | null;
    status_remarks: string | null;
    status_updated_at: string | null;
  }>) => void;
};

export default function TelemetryHUD(props: TelemetryHUDProps) {
  return <DashboardOwnerCommandCenter {...props} />;
}
