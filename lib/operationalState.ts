export function extractFleetRawStatus(vehicle: any): string {
  return String(
    vehicle?.status ||
    vehicle?.current_status ||
    vehicle?.vehicle_status ||
    vehicle?.STATUS ||
    ""
  ).trim().toUpperCase();
}

export type FleetOperationalState =
  | "READY"
  | "PLANT_LOADING"
  | "IN_TRANSIT"
  | "WAITING_FOR_UNLOAD"
  | "UNLOADED"
  | "RETURNING"
  | "WORKSHOP"
  | "DRIVER_UNAVAILABLE"
  | "OTHER";

export function resolveFleetOperationalState(
  rawStatus: string | null | undefined
): FleetOperationalState {
  const status = String(rawStatus || "WAITING_FOR_LOAD")
    .trim()
    .toUpperCase();

  if (
    status.includes("WORKSHOP") ||
    status.includes("REPAIR") ||
    status.includes("BREAKDOWN")
  ) {
    return "WORKSHOP";
  }

  if (
    status.includes("DRIVER") ||
    status.includes("UNAVAILABLE") ||
    status.includes("NO_DRIVER") ||
    status.includes("LEAVE")
  ) {
    return "DRIVER_UNAVAILABLE";
  }

  if (status === "WAITING_FOR_UNLOAD" || status === "WAITING FOR UNLOAD") {
    return "WAITING_FOR_UNLOAD";
  }

  if (status === "UNLOADED") {
    return "UNLOADED";
  }

  if (status === "RETURNING") {
    return "RETURNING";
  }

  if (status.includes("TRANSIT")) {
    return "IN_TRANSIT";
  }

  if (
    status === "WAITING_FOR_LOAD" ||
    status.includes("PLANT") ||
    status.includes("LOADING")
  ) {
    return "PLANT_LOADING";
  }

  if (
    status === "AVAILABLE_FOR_LOAD" ||
    status === "READY_FOR_DISPATCH"
  ) {
    return "READY";
  }

  return "OTHER";
}

export function fleetStateLabel(state: FleetOperationalState): string {
  switch (state) {
    case "READY":
      return "Ready For Dispatch";
    case "PLANT_LOADING":
      return "Plant Loading";
    case "IN_TRANSIT":
      return "In Transit";
    case "WAITING_FOR_UNLOAD":
      return "Waiting For Unload";
    case "UNLOADED":
      return "Unloaded";
    case "RETURNING":
      return "Returning";
    case "WORKSHOP":
      return "Workshop / Repairs";
    case "DRIVER_UNAVAILABLE":
      return "No Driver / Leave";
    default:
      return "Other";
  }
}


export function fleetStateColor(
  state: FleetOperationalState
): "success" | "warning" | "info" | "danger" | "muted" {
  switch (state) {
    case "READY":
      return "success";
    case "PLANT_LOADING":
      return "warning";
    case "IN_TRANSIT":
    case "WAITING_FOR_UNLOAD":
    case "UNLOADED":
    case "RETURNING":
      return "info";
    case "WORKSHOP":
      return "danger";
    case "DRIVER_UNAVAILABLE":
      return "warning";
    default:
      return "muted";
  }
}
