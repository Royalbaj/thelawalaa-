import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr } from "@/lib/utils";
import PosTerminal from "@/components/pos/pos-terminal";
import LiveOrdersPanel from "@/components/admin/live-orders-panel";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireRole(["super_admin", "admin", "pos_user"]);

  const [{ data: products }, { data: categories }, { data: recentOrders }, { data: drivers }] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id, name, price, image_url, category_id, is_available, is_veg")
      .eq("is_available", true)
      .order("sort_order"),
    supabaseAdmin.from("categories").select("id, name").order("sort_order"),
    supabaseAdmin
      .from("orders")
      .select("id, order_number, status, type, total, payment_status, payment_method, created_at, notes, customer:profiles(full_name, phone)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("profiles")
      .select("id, full_name, is_online")
      .eq("role", "delivery_driver")
      .eq("is_active", true),
  ]);

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col gap-4 xl:flex-row">
      {/* LEFT — POS Terminal */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-orange-100">
        <PosTerminal
          products={(products ?? []) as any}
          categories={(categories ?? []) as any}
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
