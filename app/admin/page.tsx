import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr } from "@/lib/utils";
import PosTerminal from "@/components/pos/pos-terminal";
import LiveOrdersPanel from "@/components/admin/live-orders-panel";

export const dynamic = "force-dynamic";

// pos_user only — see app/admin/layout.tsx for why super_admin no
// longer reaches this screen at all.
export default async function AdminDashboard() {
  await requireRole(["pos_user"]);

  const [{ data: products }, { data: categories }, { data: recentOrders }, { data: drivers }, { data: settings }] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, name, price, image_url, category_id, is_available, is_veg")
      .eq("is_available", true)
      .order("sort_order"),
    supabaseAdmin.from("categories").select("id, name").order("sort_order"),
    supabaseAdmin
      .from("orders")
      .select("id, order_number, status, type, total, payment_status, payment_method, created_at, notes, customer:profiles!customer_id(full_name, phone)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, is_online")
      .eq("role", "delivery_driver")
      .eq("is_active", true),
    supabaseAdmin
      .from("app_settings")
      .select("opening_promo_enabled, opening_promo_momo_price, opening_promo_starts_at, opening_promo_ends_at")
      .eq("id", 1)
      .single(),
  ]);

  return (
    <div className="flex h-full flex-col gap-3 p-2 xl:flex-row xl:gap-4 xl:p-4">
      {/* LEFT — POS Terminal */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-orange-100">
        <PosTerminal
          products={(products ?? []) as any}
          categories={(categories ?? []) as any}
          openingPromo={settings ?? null}
        />
      </div>

      {/* RIGHT — Live Orders */}
      <div className="min-h-0 flex-1 overflow-hidden xl:w-[400px] xl:flex-none">
        <LiveOrdersPanel
          initialOrders={(recentOrders ?? []) as any}
          drivers={(drivers ?? []) as any}
        />
      </div>
    </div>
  );
}
