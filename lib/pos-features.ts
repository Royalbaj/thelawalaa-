// What a POS role can do (migration 051, Admin → POS team & roles). Selling is
// never gated — these are the extras. A person without a role gets
// DEFAULT_FEATURES (what every counter person could do before roles).

export const POS_FEATURES = [
  { key: "close_shift", label: "Close shift", hint: "Count the cash and close the shift (Today sheet)" },
  { key: "cancel_orders", label: "Cancel orders", hint: "Only while Admin → Settings lets the counter cancel at all" },
  { key: "expenses", label: "Day expenses", hint: "Write down money spent today and why — shown in Accounts → POS" },
  { key: "issues", label: "Issues & notes", hint: "Note problems at the outlet — closed from Accounts → POS" },
  { key: "stock_add", label: "Add stock", hint: "Add stock that has arrived — counts straight away" },
  { key: "stock_edit", label: "Fix stock (needs approval)", hint: "Waste, a recount or a wrong add — an Accounts person approves it" },
  { key: "manager_discount", label: "Approve manager discount", hint: "Their PIN makes a POS sale free (frozen items still charged)" },
] as const;

export type PosFeature = (typeof POS_FEATURES)[number]["key"];
export const POS_FEATURE_KEYS = POS_FEATURES.map((f) => f.key) as PosFeature[];
export const DEFAULT_FEATURES: PosFeature[] = ["close_shift", "cancel_orders"];

/** A role's stored features, keeping only ones this code knows. */
export const cleanFeatures = (list: unknown): PosFeature[] =>
  Array.isArray(list) ? POS_FEATURE_KEYS.filter((k) => list.includes(k)) : [];

/** Any of these lets the person load the outlet's records (getOutletDay). */
export const OUTLET_FEATURES: PosFeature[] = ["expenses", "issues", "stock_add", "stock_edit"];
/** The Outlet sheet (day expenses, issues & notes). */
export const NOTE_FEATURES: PosFeature[] = ["expenses", "issues"];
/** Stock work inside the Stock sheet (add, waste / recount / fix). */
export const STOCK_FEATURES: PosFeature[] = ["stock_add", "stock_edit"];

/** What the header was drawn for — when the server's answer differs (a new role, switched off), the till redraws. */
export const posRoleStamp = (staff: { name: string; role: string | null; features: readonly string[] } | null | undefined) =>
  staff ? `${staff.name}|${staff.role ?? ""}|${[...staff.features].sort().join(",")}` : "";
