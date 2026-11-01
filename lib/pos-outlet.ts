// Words for the outlet's own records (migration 051) — day expenses, issues,
// stock change requests. Copy in accounts-app/lib/pos-outlet.ts (the Accounts
// app's POS section) — change both.

export const EXPENSE_CATEGORIES = [
  "Vegetables & groceries", "Gas & fuel", "Transport", "Repairs", "Cleaning & supplies", "Staff food", "Other",
] as const;

export const PAID_WITH = {
  till_cash: "Cash from the till",
  qr: "QR / online",
  own_money: "Own money (to pay back)",
  other: "Other",
} as const;
export type PaidWith = keyof typeof PAID_WITH;

export const ISSUE_KINDS = {
  equipment: "Equipment",
  stock: "Stock",
  customer: "Customer",
  staff: "Staff",
  cleaning: "Cleaning",
  other: "Other",
} as const;
export type IssueKind = keyof typeof ISSUE_KINDS;

export const REQUEST_KINDS = {
  expense_edit: "Change an expense",
  expense_remove: "Remove an expense",
  stock_waste: "Waste",
  stock_count: "Recount",
  stock_fix: "Fix stock that was added",
} as const;
export type RequestKind = keyof typeof REQUEST_KINDS;
