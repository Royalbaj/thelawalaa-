// Delivery charge (migration 042, owner's call Oct 2026): Rs 20 when the food
// comes to less than Rs 99, free from Rs 99. Both numbers are app_settings
// (Admin → Settings → Delivery area). "The food" is the items' total before any
// voucher or points — what the customer sees as Subtotal. Shared by checkout
// (what it shows) and createOrder (what it charges), so the two can't drift.

export type DeliveryFeeSettings = { delivery_fee?: number | string | null; free_delivery_from?: number | string | null } | null | undefined;

export function deliveryFeeRules(s: DeliveryFeeSettings) {
  return { fee: Math.max(0, Number(s?.delivery_fee ?? 20)), freeFrom: Math.max(0, Number(s?.free_delivery_from ?? 99)) };
}

/** What a delivery order pays for delivery, given its food subtotal. */
export function deliveryFeeFor(subtotal: number, s: DeliveryFeeSettings): number {
  const { fee, freeFrom } = deliveryFeeRules(s);
  return fee > 0 && subtotal < freeFrom ? fee : 0;
}

/** How much more food makes delivery free (0 = it's free already, or always). */
export function toFreeDelivery(subtotal: number, s: DeliveryFeeSettings): number {
  const { fee, freeFrom } = deliveryFeeRules(s);
  return fee > 0 && subtotal < freeFrom ? freeFrom - subtotal : 0;
}
