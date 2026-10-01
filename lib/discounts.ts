// Shared by the POS screen (what it shows) and createPosOrder (what it
// charges) so the two can never drift apart.

export const STUDENT_DISCOUNT_LABEL = "Student 5%";

/** 5% off the items it applies to (products.student_discount_eligible), in whole rupees — the counter deals in cash. */
export function studentDiscount(eligibleSubtotal: number): number {
  return Math.round(eligibleSubtotal * 0.05);
}
