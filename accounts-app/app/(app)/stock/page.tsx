import { requireAuth } from "@/lib/supabase/server";
import { getStockLevels, getStockLinks, getMenuProducts, getRecentStockChanges } from "@/lib/stock";
import { getLossStockItems } from "@/lib/losses";
import StockBoard from "@/components/stock-board";
import { StockTabs } from "@/components/stock-tabs";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  await requireAuth();
  const [levels, links, products, changes, items] = await Promise.all([
    getStockLevels(), getStockLinks(), getMenuProducts(), getRecentStockChanges(), getLossStockItems(),
  ]);
  // Cost per unit — set on each item, it values waste on the Waste & loss tab.
  const costs = Object.fromEntries(items.map((i) => [i.id, i.cost]));
  return (
    <div className="space-y-4">
      <StockTabs current="stock" />
      <StockBoard levels={levels} links={links} products={products} changes={changes} costs={costs} />
    </div>
  );
}
