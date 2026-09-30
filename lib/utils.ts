import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** Nepali rupees — "Rs 1,250" */
export const npr = (n: number) => `Rs ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;

// One colour per customer-facing step (lib/order-status.ts) — in-between DB
// statuses share their step's colour.
export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-blue-100 text-blue-800",
  ready: "bg-emerald-100 text-emerald-800",
  assigned: "bg-blue-100 text-blue-800",
  picked_up: "bg-sky-100 text-sky-800",
  on_the_way: "bg-sky-100 text-sky-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};
