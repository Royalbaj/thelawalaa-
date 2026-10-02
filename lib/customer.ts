import "server-only";
import { supabaseAdmin, getRewardSettings } from "@/lib/supabase/admin";
import type { RewardsState } from "@/components/account/rewards-card";

/** A customer's rewards: balance, stamps, and the rules (for the portal pages). */
export async function getCustomerRewards(customerId: string): Promise<RewardsState> {
  const [settings, { data: bal }] = await Promise.all([
    getRewardSettings(),
    supabaseAdmin.from("loyalty_points").select("points, free_items, order_count").eq("customer_id", customerId).maybeSingle(),
  ]);
  const { data: freeItem } = settings.free_item_product_id
    ? await supabaseAdmin.from("products").select("name").eq("id", settings.free_item_product_id).maybeSingle()
    : { data: null };
  return {
    settings,
    points: bal?.points ?? 0,
    freeItems: bal?.free_items ?? 0,
    orderCount: bal?.order_count ?? 0,
    freeItemName: freeItem?.name ?? null,
  };
}

/** "Good morning" etc. by the time in Banepa, not the server's. */
export function greeting() {
  const h = (new Date().getUTCHours() + 5 + (new Date().getUTCMinutes() + 45 >= 60 ? 1 : 0)) % 24;
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
