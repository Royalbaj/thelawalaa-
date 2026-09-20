import { requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import StockManager from "@/components/stock-manager";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  await requireAuth();
  const { data: items } = await supabaseAdmin
    .from("stock_items")
    .select("id, name, unit, quantity, reorder_level, cost_per_unit")
    .eq("is_active", true)
    .order("name");

  return <StockManager items={(items ?? []) as never} />;
}
