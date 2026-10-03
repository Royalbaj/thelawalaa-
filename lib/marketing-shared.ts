// Marketing maths and labels — shared by Admin → Marketing (server) and the
// ROI calculator (browser). Revenue here is what customers actually paid
// (after discounts); profit = revenue × gross margin (what's left after the
// food, packaging and other per-order costs).

export const CHANNELS = {
  facebook: "Facebook ads", instagram: "Instagram ads", tiktok: "TikTok ads", google: "Google ads",
  poster: "Posters / QR", flyer: "Flyers", influencer: "Influencer", sms: "SMS / Viber",
  event: "Event / stall", print: "Newspaper / print", radio: "Radio", other: "Other",
} as const;
export type Channel = keyof typeof CHANNELS;

export const LANDINGS = { "/": "Homepage", "/order": "Order page", "/auth/signup": "Sign-up page" } as const;
export type Landing = keyof typeof LANDINGS;

/** The cookie a /go/<code> visit leaves (30 days): which campaign brought them. */
export const CAMPAIGN_COOKIE = "tw_c";
export const CAMPAIGN_DAYS = 30;

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "campaign";

export type Results = { spend: number; revenue: number; orders: number; signups: number; clicks: number };

export function metrics(r: Results, marginPct: number) {
  const margin = marginPct / 100;
  const grossProfit = r.revenue * margin;
  const net = grossProfit - r.spend;
  return {
    grossProfit,
    net,
    /** (profit − spend) ÷ spend: 1 = every rupee spent came back doubled. */
    roi: r.spend > 0 ? net / r.spend : null,
    /** Revenue per rupee spent. */
    roas: r.spend > 0 ? r.revenue / r.spend : null,
    costPerOrder: r.spend > 0 && r.orders ? r.spend / r.orders : null,
    costPerSignup: r.spend > 0 && r.signups ? r.spend / r.signups : null,
    conversion: r.clicks ? r.orders / r.clicks : null,
    /** Revenue needed for the spend to pay for itself. */
    breakEvenRevenue: margin > 0 ? r.spend / margin : null,
  };
}

export const pct = (x: number | null, digits = 0) => (x == null || !isFinite(x) ? "—" : `${(x * 100).toFixed(digits)}%`);
export const times = (x: number | null) => (x == null || !isFinite(x) ? "—" : `${x.toFixed(1)}×`);

/** ROI calculator: a plan, before spending. */
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
