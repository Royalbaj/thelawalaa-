import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchLiveOrders } from "@/lib/live-orders";
import { getPosStock } from "@/lib/stock-alerts";
import PosWorkspace from "@/components/pos/pos-workspace";

export const dynamic = "force-dynamic";

// pos_user only — see app/admin/(pos)/layout.tsx for why super_admin no
// longer reaches this screen at all.
export default async function AdminDashboard() {
  await requireRole(["pos_user"]);

  const [{ data: products }, { data: categories }, { data: recentOrders }, { data: drivers }, { data: settings }, stock] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, name, price, image_url, category_id, is_available, is_veg, student_discount_eligible, member_price, is_membership_card")
      .eq("is_available", true)
      .order("sort_order"),
    supabaseAdmin.from("categories").select("id, name").order("sort_order"),
    fetchLiveOrders().then((data) => ({ data })),
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, is_online")
      .eq("role", "delivery_driver")
      .eq("is_active", true),
    supabaseAdmin
      .from("app_settings")
      .select("opening_promo_enabled, opening_promo_momo_price, opening_promo_starts_at, opening_promo_ends_at, pos_can_cancel")
      .eq("id", 1)
      .single(),
    getPosStock(),
  ]);

  return (
    <PosWorkspace
      products={(products ?? []) as any}
      categories={(categories ?? []) as any}
      openingPromo={settings ?? null}
      canCancel={settings?.pos_can_cancel ?? true}
      initialOrders={(recentOrders ?? []) as any}
      drivers={(drivers ?? []) as any}
      stock={stock}
    />
  );
}
