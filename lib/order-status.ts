// The order journey people see is three steps: Ordered → Confirmed →
// Ready to collect (delivery: → On the way). orders.status keeps its wider
// DB set — the driver flow still uses assigned/picked_up, and older orders
// may sit in 'preparing' — so everything shown to a customer or used at the
// counter goes through these helpers, which fold those in-between values
// into the nearest step.

const PICKUP_STEPS = ["Ordered", "Confirmed", "Ready to collect"];
const DELIVERY_STEPS = ["Ordered", "Confirmed", "On the way"];

export function orderSteps(type: string): string[] {
  return type === "delivery" ? DELIVERY_STEPS : PICKUP_STEPS;
}

/** Step the order is on (0–2), 3 once it's been handed over, -1 if cancelled. */
export function orderStep(status: string, type: string): number {
  switch (status) {
    case "pending": return 0;
    case "confirmed": case "preparing": case "assigned": return 1;
    case "ready": return type === "delivery" ? 1 : 2; // delivery: food waits for a driver
    case "picked_up": case "on_the_way": return 2;
    case "delivered": return 3;
    default: return -1;
  }
}

export function orderStatusLabel(status: string, type: string): string {
  if (status === "cancelled") return "Cancelled";
  if (status === "delivered") return type === "delivery" ? "Delivered" : type === "dine_in" ? "Served" : "Collected";
  return orderSteps(type)[orderStep(status, type)] ?? status;
}

/**
 * The one tap that moves an order on at the counter — null once it's out of the counter's hands.
 * `counter`: a POS order (placed_by set) — ONE tap after the sale, straight to
 * Served/Collected (owner's call); online orders keep "Ready" so customers know when to come.
 */
export function nextCounterAction(status: string, type: string, counter = false): { status: string; label: string } | null {
  switch (status) {
    case "pending": return { status: "confirmed", label: "Confirm" };
    case "confirmed": case "preparing":
      if (counter && type !== "delivery") return { status: "delivered", label: type === "dine_in" ? "Served" : "Collected" };
      return { status: "ready", label: type === "delivery" ? "Ready for driver" : "Ready" };
    case "ready": return type === "delivery" ? null : { status: "delivered", label: type === "dine_in" ? "Served" : "Collected" };
    default: return null;
  }
}

/** Staff list filters. 'confirmed' also catches legacy 'preparing' rows. */
export const STATUS_FILTERS: { key: string; label: string; statuses: string[] }[] = [
  { key: "pending", label: "New", statuses: ["pending"] },
  { key: "confirmed", label: "Confirmed", statuses: ["confirmed", "preparing"] },
  { key: "ready", label: "Ready", statuses: ["ready"] },
  { key: "delivered", label: "Done", statuses: ["delivered"] },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
];
