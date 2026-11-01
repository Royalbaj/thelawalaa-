import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addDays, type Ymd } from "@/lib/dates";
import { LOSS_KIND_KEYS, type LossKind } from "@/lib/loss-kinds";

// Waste & loss (migration 052): what was written on the Waste & loss page,
// plus stock waste recorded elsewhere (the Stock page's Waste button, or POS
// waste an Accounts person approved) — so the page is the one complete list.
// Stock waste is valued at the item's cost per unit. Never part of the money book.

export type LossRow = {
  id: string;
  from: "loss" | "stock" | "pos"; // loss = this page (can be removed here); the others are stock movements
  day: Ymd; createdAt: string; kind: LossKind; what: string; item: string | null;
  quantity: number | null; unit: string | null;
  value: number; valued: boolean; // false = no worth known (stock item without a cost per unit)
  reason: string | null; person: string; hasPhoto: boolean;
};

const startOf = (d: Ymd) => `${d}T00:00:00+05:45`;
const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" });
const nepalDay = (iso: string): Ymd => DAY.format(new Date(iso));
const money = (n: number) => Math.round(n * 100) / 100;

export async function getLosses(from: Ymd, to: Ymd) {
  const [{ data: losses }, { data: moves }] = await Promise.all([
    supabaseAdmin.from("account_losses")
      .select("id, occurred_on, created_at, kind, what, quantity, unit, value, reason, photo_path, stock_items(name), person:account_users!account_losses_entered_by_fkey(name)")
      .gte("occurred_on", from).lte("occurred_on", to).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }),
    supabaseAdmin.from("stock_movements")
      .select("id, created_at, quantity, note, source, pos_person_name, stock_items(name, unit, cost_per_unit), person:account_users!stock_movements_entered_by_fkey(name)")
      .eq("type", "wastage").gte("created_at", startOf(from)).lt("created_at", startOf(addDays(to, 1))).order("created_at", { ascending: false }).limit(500),
  ]);
  // Movements written by this page are already in the list as their loss.
  const ids = (moves ?? []).map((m) => m.id);
  const { data: linked } = ids.length
    ? await supabaseAdmin.from("account_losses").select("movement_id").in("movement_id", ids)
    : { data: [] as { movement_id: string }[] };
  const mine = new Set((linked ?? []).map((l) => l.movement_id));

  const rows: LossRow[] = [
    ...(losses ?? []).map((l): LossRow => ({
      id: l.id, from: "loss", day: l.occurred_on, createdAt: l.created_at, kind: l.kind as LossKind, what: l.what,
      item: (l.stock_items as unknown as { name: string } | null)?.name ?? null,
      quantity: l.quantity == null ? null : Number(l.quantity), unit: l.unit,
      value: Number(l.value), valued: Number(l.value) > 0, reason: l.reason,
      person: (l.person as unknown as { name: string } | null)?.name ?? "—", hasPhoto: !!l.photo_path,
    })),
    ...(moves ?? []).filter((m) => !mine.has(m.id)).map((m): LossRow => {
      const item = m.stock_items as unknown as { name: string; unit: string; cost_per_unit: number } | null;
      const cost = Number(item?.cost_per_unit ?? 0);
      const qty = Number(m.quantity);
      // POS waste approved in Accounts → POS carries "POS · <name>: <why>" as its note.
      const fromPos = m.source === "pos" || (m.note ?? "").startsWith("POS · ");
      return {
        id: m.id, from: fromPos ? "pos" : "stock", day: nepalDay(m.created_at), createdAt: m.created_at, kind: "waste",
        what: item?.name ?? "Stock item", item: item?.name ?? null, quantity: qty, unit: item?.unit ?? null,
        value: money(qty * cost), valued: cost > 0, reason: m.note,
        person: m.source === "pos" ? `POS · ${m.pos_person_name ?? "counter"}` : (m.person as unknown as { name: string } | null)?.name ?? "—",
        hasPhoto: false,
      };
    }),
  ].sort((a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt));

  const total = money(rows.reduce((s, r) => s + r.value, 0));
  const byKind = LOSS_KIND_KEYS.map((k) => {
    const of = rows.filter((r) => r.kind === k);
    return { kind: k, count: of.length, value: money(of.reduce((s, r) => s + r.value, 0)) };
  });
  const items = new Map<string, number>();
  for (const r of rows) items.set(r.item ?? r.what, (items.get(r.item ?? r.what) ?? 0) + r.value);
  const byWhat = [...items.entries()].map(([name, value]) => ({ name, value: money(value) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  return { rows, total, byKind, byWhat, unvalued: rows.filter((r) => !r.valued).length };
}

/** Stock items for the form: name, unit and cost per unit (to work out what a loss was worth). */
export async function getLossStockItems() {
  const { data } = await supabaseAdmin.from("stock_items").select("id, name, unit, cost_per_unit").eq("is_active", true).order("name");
  return (data ?? []).map((s) => ({ id: s.id, name: s.name, unit: s.unit, cost: Number(s.cost_per_unit) }));
}
