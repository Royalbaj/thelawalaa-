// Shared by the POS screen (what it shows) and createPosOrder (what it
// charges) so the two can never drift apart. An order gets one of these,
// never two: Student 5%, Member price, Staff or Manager.

export const STUDENT_DISCOUNT_LABEL = "Student 5%";
export const MEMBER_PRICE_LABEL = "Member price";
export const STAFF_LABEL = "Staff";
export const MANAGER_LABEL = "Manager";

/** 5% off the items it applies to (products.student_discount_eligible), in whole rupees — the counter deals in cash. */
export function studentDiscount(eligibleSubtotal: number): number {
  return Math.round(eligibleSubtotal * 0.05);
}

// ── Half plates (migration 041) ──────────────────────────────────
// A POS line is 1, 1½, 2, 2½ … plates — never a half on its own. The extra
// half is its own order line (portion 0.5) at products.half_price, and member
// price never applies to it (owner's call). Other deals treat it as one item.

/** What the extra half costs, or null when the item has no half option. Never more than a whole plate (e.g. during the opening offer). */
export function halfPlatePrice(halfPrice: number | string | null | undefined, fullPrice: number): number | null {
  return halfPrice == null ? null : Math.min(Number(halfPrice), fullPrice);
}

/** The extra half's order line: "Chicken Momo (per plate)" → "Chicken Momo (half plate)". */
export function halfPlateName(name: string): string {
  return `${name.replace(/\s*\(per plate\)\s*/i, " ").trim()} (half plate)`;
}

/** 1 → "1", 1 plus a half → "1½". */
export function platesLabel(qty: number, half: boolean): string {
  return `${qty}${half ? "½" : ""}`;
}

/** A member pays products.member_price where an item has one — never more than its normal price. */
export function memberUnitPrice(normalPrice: number, memberPrice: number | string | null | undefined): number {
  return memberPrice == null ? normalPrice : Math.min(normalPrice, Number(memberPrice));
}

/**
 * Staff sale: up to `limit` items cost nothing (app_settings.staff_free_items).
 * The dearest go free first (ties: the earlier line), so it doesn't matter what
 * order they were tapped in; anything over the limit is charged as normal.
 * Membership cards are never free (`eligible: false`).
 * Returns how many of each line are free and what that's worth.
 */
export function staffFreeItems(lines: { price: number; qty: number; eligible: boolean }[], limit: number) {
  const free = lines.map(() => 0);
  let left = Math.max(0, Math.floor(limit));
  let saving = 0;
  const dearestFirst = lines.map((_, i) => i).filter((i) => lines[i].eligible).sort((a, b) => lines[b].price - lines[a].price || a - b);
  for (const i of dearestFirst) {
    if (left === 0) break;
    free[i] = Math.min(left, lines[i].qty);
    left -= free[i];
    saving += free[i] * lines[i].price;
  }
  return { free, saving, used: free.reduce((s, n) => s + n, 0) };
}

/**
 * Manager discount (approved with a manager's own PIN): every item costs
 * nothing except frozen items (products.is_frozen) and membership cards
 * (`eligible: false`), which are charged as normal.
 */
export function managerFreeItems(lines: { price: number; qty: number; eligible: boolean }[]) {
  const free = lines.map((l) => (l.eligible ? l.qty : 0));
  return { free, saving: lines.reduce((s, l, i) => s + free[i] * l.price, 0), used: free.reduce((s, n) => s + n, 0) };
}
