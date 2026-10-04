import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pushToStaff } from "@/lib/push";

// Stock that follows the POS (migration 024; managed in the Accounts app's
// Stock tab). Right after a POS or website sale, any stock item linked to
// what was sold is re-checked; if it has just dropped to its warning level,
// or run out, the staff devices get ONE push for that drop. Restocking or
// counting in Accounts resets it (alert_state). Runs in after(), so the sale
// itself never waits for this.
export async function checkStockAfterSale(productIds: string[]) {
  try {
    const ids = [...new Set(productIds)];
    if (!ids.length) return;
    const { data: links } = await supabaseAdmin.from("stock_item_products").select("stock_item_id").in("product_id", ids);
    const itemIds = [...new Set((links ?? []).map((l) => l.stock_item_id))];
    for (const itemId of itemIds) {
      const { data } = await supabaseAdmin.rpc("stock_levels", { p_item: itemId });
      const s = (data as { name: string; unit: string; remaining: number; reorder_level: number; alert_state: string | null }[] | null)?.[0];
      if (!s) continue;
      const remaining = Number(s.remaining);
      const reorder = Number(s.reorder_level);
      const state = remaining <= 0 ? "out" : remaining <= reorder ? "low" : null;
      if (!state || state === s.alert_state || (state === "low" && s.alert_state === "out")) continue;
      // Claim the alert in one statement, so two sales a second apart don't both notify.
      const { data: claimed } = await supabaseAdmin.from("stock_items").update({ alert_state: state }).eq("id", itemId)
        .or(state === "out" ? "alert_state.is.null,alert_state.eq.low" : "alert_state.is.null").select("id");
      if (!claimed?.length) continue;
      const left = `${+remaining.toFixed(2)} ${s.unit}`;
      await pushToStaff({
        title: state === "out" ? `Out of stock: ${s.name}` : `Running low: ${s.name}`,
        body: state === "out"
          ? `${s.name} has run out — restock it, or mark the menu item sold out.`
          : `Only ${left} left (warns at ${+reorder.toFixed(2)}). Restock soon.`,
        tag: `stock-${itemId}`,
        url: "/admin",
      });
    }
  } catch (e) {
    console.error("Stock alert check failed:", (e as Error).message);
  }
}

export type StockLevel = {
  id: string; name: string; unit: string; remaining: number; reorder: number; state: "ok" | "low" | "out";
  soldToday: number; countedAt: string | null; products: string[];
};
/** Kept for the tiles' wording: a level that's low or out. */
export type StockWarning = StockLevel;
export type PosStock = { all: StockLevel[]; warnings: StockLevel[]; byProduct: Record<string, StockLevel> };

const RANK = { out: 0, low: 1, ok: 2 } as const;

/**
 * For the POS (read-only — counting and restocking happen in Accounts →
 * Stock): every stock item with what's left (same stock_levels() maths), the
 * ones running low or out, and which menu items use each, so every linked
 * tile can show its count. Worst first.
 */
export async function getPosStock(): Promise<PosStock> {
  try {
    const [{ data: levels }, { data: links }, { data: products }] = await Promise.all([
      supabaseAdmin.rpc("stock_levels"),
      supabaseAdmin.from("stock_item_products").select("stock_item_id, product_id"),
      supabaseAdmin.from("products").select("id, name"),
    ]);
    const productName = new Map((products ?? []).map((p) => [p.id, (p.name as string).trim()]));
    const all: StockLevel[] = ((levels ?? []) as { id: string; name: string; unit: string; remaining: number; reorder_level: number; sold_today: number; counted_at: string | null }[])
      .map((l) => {
        const remaining = Number(l.remaining), reorder = Number(l.reorder_level);
        return {
          id: l.id, name: l.name, unit: l.unit, remaining: +remaining.toFixed(2), reorder,
          state: remaining <= 0 ? "out" as const : remaining <= reorder ? "low" as const : "ok" as const,
          soldToday: +Number(l.sold_today ?? 0).toFixed(2), countedAt: l.counted_at,
          products: (links ?? []).filter((k) => k.stock_item_id === l.id).map((k) => productName.get(k.product_id) ?? "").filter(Boolean),
        };
      })
      .sort((a, b) => RANK[a.state] - RANK[b.state] || a.remaining - b.remaining || a.name.localeCompare(b.name));
    const byId = new Map(all.map((w) => [w.id, w]));
    const byProduct: Record<string, StockLevel> = {};
    for (const l of links ?? []) {
      const w = byId.get(l.stock_item_id);
      const cur = byProduct[l.product_id];
      // A menu item made from two stock items shows the one that's worse.
      if (w && (!cur || RANK[w.state] < RANK[cur.state] || (w.state === cur.state && w.remaining < cur.remaining))) byProduct[l.product_id] = w;
    }
    return { all, warnings: all.filter((w) => w.state !== "ok"), byProduct };
  } catch {
    return { all: [], warnings: [], byProduct: {} };
  }
}
