// Marketing budget & ROI — labels and maths shared by Admin → Marketing &
// ROI (server) and its forms / ROI planner (browser).
//
// Expenses = money spent on marketing. Returns = what it brought back
// (extra sales, event takings, catering won, cards sold…), entered by hand.
// ROI = (returns − expenses) ÷ expenses. "Profit ROI" counts returns at the
// gross margin instead — what's left after the food and packaging.

export const CATEGORIES = {
  printing: "Printing — posters, flyers, cards",
  social: "Social media",
  events: "Events & sponsorships",
  samples: "Free samples & tastings",
  offers: "Offers & giveaways",
  signage: "Signage & branding",
  influencers: "Influencers & promoters",
  media: "Newspaper, radio & media",
  other: "Other",
} as const;
export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as [Category, ...Category[]];
/** Short names for charts and tight spaces. */
export const CATEGORY_SHORT: Record<Category, string> = {
  printing: "Printing", social: "Social media", events: "Events", samples: "Samples", offers: "Offers",
  signage: "Signage", influencers: "Influencers", media: "Media", other: "Other",
};

export const PAYMENT_METHODS = { cash: "Cash", bank: "Bank", qr: "QR / eSewa", other: "Other" } as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export type Ym = string; // "2026-10"
export const ymOf = (ymd: string): Ym => ymd.slice(0, 7);
export const monthStart = (ym: Ym) => `${ym}-01`;
export const shiftMonth = (ym: Ym, n: number): Ym => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
export const monthName = (ym: Ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
export const monthShort = (ym: Ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });

export function roiOf(expenses: number, returns: number, marginPct: number) {
  return {
    net: returns - expenses,
    /** (returns − expenses) ÷ expenses — 1 = every rupee spent came back doubled. */
    roi: expenses > 0 ? (returns - expenses) / expenses : null,
    /** Returns for every Rs 1 spent. */
    perRupee: expenses > 0 ? returns / expenses : null,
    /** Same, counting returns at the gross margin (what's left after food & packaging). */
    profitRoi: expenses > 0 ? (returns * (marginPct / 100) - expenses) / expenses : null,
  };
}

export const pct = (x: number | null | undefined, digits = 0) => (x == null || !isFinite(x) ? "—" : `${(x * 100).toFixed(digits)}%`);
export const times = (x: number | null | undefined) => (x == null || !isFinite(x) ? "—" : `${x.toFixed(1)}×`);

/** ROI planner: is an idea worth it, before spending? */
export type Plan = { spend: number; reach: number; conversionPct: number; aov: number; ordersPerCustomer: number; discountPerOrder: number; marginPct: number };

export function planOutcome(p: Plan) {
  const customers = Math.round(p.reach * (p.conversionPct / 100));
  const orders = customers * p.ordersPerCustomer;
  const netAov = Math.max(0, p.aov - p.discountPerOrder);
  const revenue = orders * netAov;
  const profitPerCustomer = p.ordersPerCustomer * netAov * (p.marginPct / 100);
  const grossProfit = customers * profitPerCustomer;
  const net = grossProfit - p.spend;
  return {
    customers, orders, revenue, grossProfit, net,
    roi: p.spend > 0 ? net / p.spend : null,
    roas: p.spend > 0 ? revenue / p.spend : null,
    costPerCustomer: customers ? p.spend / customers : null,
    profitPerCustomer,
    breakEvenCustomers: profitPerCustomer > 0 ? Math.ceil(p.spend / profitPerCustomer) : null,
    maxSpendPerCustomer: profitPerCustomer,
  };
}
