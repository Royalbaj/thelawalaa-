// Shared by the POS screen (what it shows) and createPosOrder (what it
// charges) so the two can never drift apart. An order gets one of these,
// never both.

export const STUDENT_DISCOUNT_LABEL = "Student 5%";
export const MEMBER_PRICE_LABEL = "Member price";

/** 5% off the items it applies to (products.student_discount_eligible), in whole rupees — the counter deals in cash. */
export function studentDiscount(eligibleSubtotal: number): number {
  return Math.round(eligibleSubtotal * 0.05);
}

/** A member pays products.member_price where an item has one — never more than its normal price. */
export function memberUnitPrice(normalPrice: number, memberPrice: number | string | null | undefined): number {
  return memberPrice == null ? normalPrice : Math.min(normalPrice, Number(memberPrice));
}
