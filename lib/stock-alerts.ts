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
