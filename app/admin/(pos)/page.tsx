import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchLiveOrders } from "@/lib/live-orders";
import { getPosStock } from "@/lib/stock-alerts";
import PosWorkspace from "@/components/pos/pos-workspace";
import { getPosStaff, posLockOn, posLoginKey } from "@/lib/pos-staff";
import { hasManager } from "@/lib/manager-pin";

export const dynamic = "force-dynamic";

// pos_user only — see app/admin/(pos)/layout.tsx for why super_admin no
// longer reaches this screen at all.
export default async function AdminDashboard() {
  const { user } = await requireRole(["pos_user"]);
  // Locked till: the layout shows the PIN screen, so don't load the menu and orders.
  if (await posLockOn() && !(await getPosStaff(posLoginKey(user)))) return null;

  const [{ data: products }, { data: categories }, { data: recentOrders }, { data: drivers }, { data: settings }, stock, managerDeal] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, name, price, image_url, category_id, is_available, is_veg, student_discount_eligible, member_price, is_membership_card, is_frozen")
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
      .select("opening_promo_enabled, opening_promo_momo_price, opening_promo_starts_at, opening_promo_ends_at, pos_can_cancel, staff_free_items")
      .eq("id", 1)
      .single(),
    getPosStock(),
    hasManager(), // the Manager button shows once the admin has picked a manager
  ]);

  return (
    <PosWorkspace
      products={(products ?? []) as any}
      categories={(categories ?? []) as any}
      openingPromo={settings ?? null}
      canCancel={settings?.pos_can_cancel ?? true}
      staffFreeItems={Number(settings?.staff_free_items ?? 0)}
      managerDeal={managerDeal}
      initialOrders={(recentOrders ?? []) as any}
      drivers={(drivers ?? []) as any}
      stock={stock}
    />
  );
}
