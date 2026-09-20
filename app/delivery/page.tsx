import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import DriverDashboard from "@/components/delivery/driver-dashboard";

export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  const { user, profile } = await requireRole(["delivery_driver", "admin"]);

  // Fetch assigned deliveries
  const { data: myDeliveries } = await supabaseAdmin
    .from("deliveries")
    .select(`
      id, assigned_at, picked_up_at, on_the_way_at, delivered_at, otp_verified,
      orders!inner(
        id, order_number, status, type, total, payment_status, payment_method,
        created_at, notes, delivery_address_id,
        customer:profiles(full_name, phone),
        address:addresses(full_address)
      )
    `)
    .eq("driver_id", user.id)
    .order("assigned_at", { ascending: false })
    .limit(20);

  // Fetch delivery history stats
  const { count: totalDelivered } = await supabaseAdmin
    .from("deliveries")
    .select("id", { count: "exact", head: true })
    .eq("driver_id", user.id)
    .eq("otp_verified", true);

  return (
    <DriverDashboard
      driverName={profile.full_name}
      isOnline={profile.is_online}
      deliveries={(myDeliveries ?? []) as any}
      totalDelivered={totalDelivered ?? 0}
    />
  );
}
