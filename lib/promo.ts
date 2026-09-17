export type OpeningPromoSettings = {
  opening_promo_enabled: boolean;
  opening_promo_momo_price: number;
  opening_promo_starts_at: string | null;
  opening_promo_ends_at: string | null;
};

/** Everyone gets it automatically within the window — no signup, no code. */
export function isOpeningPromoActive(s: OpeningPromoSettings | null | undefined): boolean {
  if (!s?.opening_promo_enabled) return false;
  const now = Date.now();
  if (s.opening_promo_starts_at && now < new Date(s.opening_promo_starts_at).getTime()) return false;
  if (s.opening_promo_ends_at && now > new Date(s.opening_promo_ends_at).getTime()) return false;
  return true;
}

/** Momo-only, per the opening poster — everything else keeps its normal price. */
export function applyOpeningPromoPrice(
  price: number,
  categoryName: string | null | undefined,
  settings: OpeningPromoSettings | null | undefined
): number {
  if (categoryName !== "Momo") return price;
  if (!isOpeningPromoActive(settings)) return price;
  return Number(settings!.opening_promo_momo_price);
}
