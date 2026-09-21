"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";

// Not a secret worth rotating through env — it's a speed bump against an
// accidental tap, not access control (role check above already gates this).
const RESET_PIN = "8848";

/**
 * Archives every order (with items + delivery) into sales_archives, then
 * wipes orders/loyalty-from-orders/daily counters/promo usage so the site
 * can start clean on opening day. Returns the snapshot so the caller can
 * also hand the admin a downloadable file — the DB row is the durable copy.
 */
export async function resetSalesData(pin: string) {
  const { user } = await requireRole(["super_admin"]);
  if (pin !== RESET_PIN) return { error: "Wrong PIN" };

  const { data: archiveId, error } = await supabaseAdmin.rpc("reset_sales_data", { p_actor: user.id });
  if (error) return { error: "Reset failed — nothing was deleted" };

  const { data: archive } = await supabaseAdmin
    .from("sales_archives")
    .select("id, order_count, total_revenue, snapshot, created_at")
    .eq("id", archiveId)
    .single();

  await audit({
    actor_id: user.id,
    action: "RESET_SALES_DATA",
    target_table: "sales_archives",
    target_id: archiveId as string,
    new_data: { order_count: archive?.order_count, total_revenue: archive?.total_revenue },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/settings");
  return { ok: true, archive };
}
