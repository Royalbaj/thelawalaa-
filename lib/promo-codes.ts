import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { codeDiscount } from "@/lib/discounts";

// Discount codes (promo_codes): made in Admin → Settings → Discount codes, used
// at online checkout and at the POS. One lookup and one set of rules for both.

export type PromoCode = {
  id: string; code: string; discount_type: "percent" | "flat"; discount_value: number;
  min_order_amount: number; max_uses: number | null; uses_count: number; expires_at: string | null;
};

// Codes match exactly, in any letter case. ilike treats % and _ as wildcards,
// so they're escaped — otherwise "%" would match any live code.
const exactCode = (code: string) => code.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function findCode(code: string): Promise<PromoCode | null> {
  const { data } = await supabaseAdmin.from("promo_codes").select("*")
    .ilike("code", exactCode(code.trim())).eq("is_active", true).maybeSingle();
  return (data as PromoCode | null) ?? null;
}

/** Why this code can't be used on this much food, or null when it can. */
export function codeProblem(p: PromoCode | null, subtotal: number): string | null {
  if (!p) return "That code isn't valid";
  if (p.expires_at && new Date(p.expires_at) < new Date()) return "That code has expired";
  if (p.max_uses != null && p.uses_count >= p.max_uses) return "That code has been used up";
  if (subtotal < Number(p.min_order_amount)) return `That code needs an order of at least Rs ${Number(p.min_order_amount)}`;
  return null;
}

export const codeAmount = (p: PromoCode, subtotal: number) => codeDiscount(p.discount_type, p.discount_value, subtotal);

/** Count one use — conditional, so two sales can't both take the last one. */
export async function useCode(p: PromoCode): Promise<boolean> {
  const { data } = await supabaseAdmin.from("promo_codes").update({ uses_count: p.uses_count + 1 })
    .eq("id", p.id).eq("uses_count", p.uses_count).select("id");
  return !!data?.length;
}
