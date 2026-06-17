import { startOfDay } from "date-fns";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import DriverPortal, { type DriverOrder } from "@/components/delivery/driver-portal";

export const dynamic = "force-dynamic";

/**
 * Driver data is shaped SERVER-SIDE to the minimum a driver needs:
 * first name only, delivery address, totals. Full names, emails and
 * phone numbers never reach this page's HTML — the call button asks
 * the server on demand instead.
 */
export default async function DeliveryPage() {
  const { user, profile } = await requireRole(["delivery_driver", "admin"]);

  const { data: rows } = await supabaseAdmin
    .from("deliveries")
    .select(`
      assigned_at,
      orders!inner(
        id, order_number, status, total, payment_method, payment_status, delivery_address_id,
        profiles:customer_id(full_name),
        order_items(quantity)
      )
    `)
    .eq("driver_id", user.id)
    .in("orders.status", ["assigned", "picked_up", "on_the_way"])
    .order("assigned_at", { ascending: true });

  // Resolve addresses with the service role (drivers have no RLS path to addresses)
  const addressIds = (rows ?? []).map((r: any) => r.orders.delivery_address_id).filter(Boolean);
  const { data: addresses } = addressIds.length
    ? await supabaseAdmin.from("addresses").select("id, full_address").in("id", addressIds)
    : { data: [] as { id: string; full_address: string }[] };

  const orders: DriverOrder[] = (rows ?? []).map((r: any) => ({
    id: r.orders.id,
    order_number: r.orders.order_number,
    status: r.orders.status,
    total: Number(r.orders.total),
    payment_method: r.orders.payment_method,
    payment_status: r.orders.payment_status,
    customer_first_name: (r.orders.profiles?.full_name ?? "Customer").split(" ")[0],
    address: addresses?.find((a) => a.id === r.orders.delivery_address_id)?.full_address ?? "Address unavailable",
    items_count: (r.orders.order_items ?? []).reduce((s: number, i: any) => s + i.quantity, 0),
    assigned_at: r.assigned_at,
  }));

  const { count: completedToday } = await supabaseAdmin
    .from("deliveries")
    .select("id", { count: "exact", head: true })
    .eq("driver_id", user.id)
    .eq("otp_verified", true)
    .gte("delivered_at", startOfDay(new Date()).toISOString());

  return (
    <DriverPortal
      name={profile.full_name}
      online={!!profile.is_online}
      orders={orders}
      completedToday={completedToday ?? 0}
    />
  );
}
