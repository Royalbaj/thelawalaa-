// Rewards rules (reward_settings, migration 027 — edited in Admin → Rewards).
// The maths here is shared by checkout (what the customer sees) and
// createOrder (what's charged), so the two can't drift apart; the balance
// itself only ever changes inside the loyalty_* SQL functions.

export type RewardSettings = {
  enabled: boolean;
  earn_rupees_per_100: number;   // Rs of points per Rs 100 paid (2)
  points_per_rupee: number;      // points that make Rs 1 (100 → 1,000 = Rs 10)
  min_redeem_points: number;     // can't use points below this (1,000)
  welcome_points: number;
  free_item_enabled: boolean;
  free_item_orders: number;      // every N paid orders → one free item (25)
  free_item_product_id: string | null;
};

export const DEFAULT_REWARDS: RewardSettings = {
  enabled: true, earn_rupees_per_100: 2, points_per_rupee: 100, min_redeem_points: 1000,
  welcome_points: 50, free_item_enabled: true, free_item_orders: 25, free_item_product_id: null,
};

export function normaliseRewards(row: Partial<Record<keyof RewardSettings, unknown>> | null | undefined): RewardSettings {
  if (!row) return DEFAULT_REWARDS;
  return {
    enabled: row.enabled !== false,
    earn_rupees_per_100: Number(row.earn_rupees_per_100 ?? DEFAULT_REWARDS.earn_rupees_per_100),
    points_per_rupee: Math.max(1, Number(row.points_per_rupee ?? DEFAULT_REWARDS.points_per_rupee)),
    min_redeem_points: Number(row.min_redeem_points ?? DEFAULT_REWARDS.min_redeem_points),
    welcome_points: Number(row.welcome_points ?? DEFAULT_REWARDS.welcome_points),
    free_item_enabled: row.free_item_enabled !== false,
    free_item_orders: Math.max(1, Number(row.free_item_orders ?? DEFAULT_REWARDS.free_item_orders)),
    free_item_product_id: (row.free_item_product_id as string | null) ?? null,
  };
}

/** Points a paid order of this total earns (same formula as loyalty_award in SQL). */
export const pointsForTotal = (total: number, s: RewardSettings) =>
  // toFixed: SQL does this in exact NUMERIC, so drop float noise (5.8 * 100 = 579.999…) before flooring.
  s.enabled ? Math.floor(Number(((total * s.earn_rupees_per_100 * s.points_per_rupee) / 100).toFixed(6))) : 0;

/** Rupee value of a points balance, e.g. 1,580 → 15.8. */
export const pointsToRupees = (points: number, s: RewardSettings) => points / s.points_per_rupee;

/**
 * What using points on an order of `payable` rupees does: whole rupees only,
 * never more than the order, and nothing below the minimum balance.
 */
export function redeemPlan(balance: number, payable: number, s: RewardSettings) {
  if (!s.enabled || balance < s.min_redeem_points || payable <= 0) return { points: 0, rupees: 0 };
  const rupees = Math.min(Math.floor(balance / s.points_per_rupee), Math.floor(payable));
  return { points: rupees * s.points_per_rupee, rupees };
}

export const fmtPoints = (n: number) => new Intl.NumberFormat("en-IN").format(Math.max(0, Math.round(n)));
/** "Rs 15.80" — points are worth paisa, so keep two decimals when they matter. */
export const fmtRupees = (n: number) =>
  `Rs ${new Intl.NumberFormat("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n)}`;

/** One-line summaries of the rules for customers (rewards page, emails, checkout). */
export function describeRewards(s: RewardSettings, freeItemName?: string | null) {
  const per1000 = (1000 / s.points_per_rupee);
  return {
    earn: `Every Rs 100 you spend earns ${fmtRupees(s.earn_rupees_per_100)} in points (${fmtPoints(100 * s.earn_rupees_per_100 * s.points_per_rupee / 100)} points).`,
    value: `${fmtPoints(1000)} points = ${fmtRupees(per1000)}. Use them at checkout once you have ${fmtPoints(s.min_redeem_points)}.`,
    free: s.free_item_enabled && freeItemName ? `Every ${s.free_item_orders}th order earns a free ${freeItemName}.` : null,
  };
}
