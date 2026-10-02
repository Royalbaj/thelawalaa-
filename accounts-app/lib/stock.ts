import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Stock that follows the POS (migration 024). An item is counted at some
// moment; after that restocks add, waste takes away, and every POS / website
// sale of a linked menu item takes away `units_per_sale` each — worked out
// live by the stock_levels() SQL function, so a cancelled order puts its
// stock back by itself. Low-stock push alerts are sent by the main site
// right after a sale (lib/stock-alerts.ts there).

export type StockLevel = {
  id: string; name: string; unit: string; reorder_level: number; counted: number; counted_at: string;
  added: number; used: number; sold: number; remaining: number; sold_today: number; sold_7d: number;
  alert_state: "low" | "out" | null;
};
export type StockStatus = "ok" | "low" | "out";

export const stockStatus = (s: { remaining: number; reorder_level: number }): StockStatus =>
  s.remaining <= 0 ? "out" : s.remaining <= s.reorder_level ? "low" : "ok";

/** Roughly how many days the stock lasts at last week's pace (null if nothing sold). */
export const daysLeft = (s: StockLevel) => (s.sold_7d > 0 ? Math.max(0, s.remaining) / (s.sold_7d / 7) : null);

const num = (v: unknown) => Math.round(Number(v ?? 0) * 1000) / 1000;

export async function getStockLevels(itemId?: string): Promise<StockLevel[]> {
  const { data, error } = await supabaseAdmin.rpc("stock_levels", { p_item: itemId ?? null });
  if (error) throw new Error(`Couldn't load stock: ${error.message}`);
  return ((data ?? []) as StockLevel[]).map((s) => ({
    ...s, reorder_level: num(s.reorder_level), counted: num(s.counted), added: num(s.added), used: num(s.used),
    sold: num(s.sold), remaining: num(s.remaining), sold_today: num(s.sold_today), sold_7d: num(s.sold_7d),
  }));
}

export async function getLowStock() {
  return (await getStockLevels()).filter((s) => stockStatus(s) !== "ok")
    .sort((a, b) => a.remaining - a.reorder_level - (b.remaining - b.reorder_level));
}

export type StockLink = { stock_item_id: string; product_id: string; units_per_sale: number; product_name: string };
export async function getStockLinks(): Promise<StockLink[]> {
  const { data } = await supabaseAdmin.from("stock_item_products").select("stock_item_id, product_id, units_per_sale, products(name)");
  return (data ?? []).map((l) => ({
    stock_item_id: l.stock_item_id, product_id: l.product_id, units_per_sale: Number(l.units_per_sale),
    product_name: (l.products as unknown as { name: string } | null)?.name ?? "Removed item",
  }));
}

export type MenuProduct = { id: string; name: string; category: string };
/** The POS menu, grouped-ready, for linking stock to what's sold. */
export async function getMenuProducts(): Promise<MenuProduct[]> {
  const { data } = await supabaseAdmin.from("products").select("id, name, sort_order, categories(name, sort_order)").order("sort_order");
  return (data ?? [])
    .map((p) => {
      const c = p.categories as unknown as { name: string; sort_order: number } | null;
      return { id: p.id, name: p.name, category: c?.name ?? "Other", order: c?.sort_order ?? 999 };
    })
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...p }) => p);
}

export type StockChange = {
  id: string; type: "restock" | "usage" | "wastage" | "adjustment"; quantity: number; note: string | null; created_at: string;
  item: string; unit: string; person: string;
};
export async function getRecentStockChanges(limit = 25): Promise<StockChange[]> {
  const { data } = await supabaseAdmin.from("stock_movements")
    .select("id, type, quantity, note, created_at, stock_items(name, unit), person:account_users!stock_movements_entered_by_fkey(name)")
    .order("created_at", { ascending: false }).limit(limit);
  return (data ?? []).map((m) => {
    const item = m.stock_items as unknown as { name: string; unit: string } | null;
    return {
      id: m.id, type: m.type, quantity: Number(m.quantity), note: m.note, created_at: m.created_at,
      item: item?.name ?? "—", unit: item?.unit ?? "", person: (m.person as unknown as { name: string } | null)?.name ?? "—",
    };
  });
}

/** After a restock / count / waste: remember the current state, so the next sale only alerts on a real drop. */
export async function syncAlertState(itemId: string) {
  const [level] = await getStockLevels(itemId);
  if (!level) return;
  const status = stockStatus(level);
  await supabaseAdmin.from("stock_items").update({ alert_state: status === "ok" ? null : status }).eq("id", itemId);
}
