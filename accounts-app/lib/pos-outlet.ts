// Words for the POS outlet's records (migration 051). Copy of the main site's
// lib/pos-outlet.ts (the two apps share no code) — change both.

export const EXPENSE_CATEGORIES = [
  "Vegetables & groceries", "Gas & fuel", "Transport", "Repairs", "Cleaning & supplies", "Staff food", "Other",
] as const;

export const PAID_WITH: Record<string, string> = {
  till_cash: "Cash from the till",
  qr: "QR / online",
  own_money: "Own money (to pay back)",
  other: "Other",
};

export const ISSUE_KINDS: Record<string, string> = {
  equipment: "Equipment", stock: "Stock", customer: "Customer", staff: "Staff", cleaning: "Cleaning", other: "Other",
};

export const REQUEST_KINDS: Record<string, string> = {
  expense_edit: "Change an expense",
  expense_remove: "Remove an expense",
  stock_waste: "Waste",
  stock_count: "Recount",
  stock_fix: "Fix stock that was added",
};

export const METHOD_LABELS: Record<string, string> = { cash: "Cash", qr: "QR", esewa: "eSewa", card: "Card", other: "Other" };

// Every time shown is Nepal time.
const T = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit", hour12: true });
const DT = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
export const npTime = (iso: string) => T.format(new Date(iso));
export const npDayTime = (iso: string) => DT.format(new Date(iso));
