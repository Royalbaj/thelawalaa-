import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Member price at the POS needs the member's card: the counter types the last
// 3 digits of its number (003, 012, … — migration 030). Checked when Member is
// tapped AND again when the order is placed; the screen is never trusted.

/** The last 3 digits of a card number, as the counter would type them ("7" → "007", "45667" → "667"). */
const lastThree = (card: string) => card.replace(/\D/g, "").padStart(3, "0").slice(-3);

export async function memberForCard(digits: unknown): Promise<{ member: { id: string; name: string; card: string } } | { error: string }> {
  if (typeof digits !== "string" || !/^\d{3}$/.test(digits)) return { error: "Type the last 3 digits of the card" };
  const { data, error } = await supabaseAdmin.from("memberships").select("id, full_name, card_number").not("card_number", "is", null);
  if (error) return { error: "Couldn't check the card — try again" };
  const hits = (data ?? []).filter((m) => lastThree(m.card_number as string) === digits);
  if (!hits.length) return { error: `No membership card ends in ${digits}` };
  // Card numbers typed by hand in Admin → Members could share their last 3 digits.
  if (hits.length > 1) return { error: `${hits.length} cards end in ${digits} — ask the manager to fix the numbers in Admin → Members` };
  return { member: { id: hits[0].id, name: hits[0].full_name, card: hits[0].card_number as string } };
}
