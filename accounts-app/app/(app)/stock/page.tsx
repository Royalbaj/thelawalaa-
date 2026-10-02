import { requireAuth } from "@/lib/supabase/server";
import { getStockLevels, getStockLinks, getMenuProducts, getRecentStockChanges } from "@/lib/stock";
import StockBoard from "@/components/stock-board";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  await requireAuth();
  const [levels, links, products, changes] = await Promise.all([
    getStockLevels(), getStockLinks(), getMenuProducts(), getRecentStockChanges(),
  ]);
  return <StockBoard levels={levels} links={links} products={products} changes={changes} />;
}
