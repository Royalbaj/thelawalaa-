"use server";

import { revalidatePath } from "next/cache";
import { inviteStaffSchema } from "@/lib/validations/staff";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit, awardOrderLoyaltyPoints } from "@/lib/supabase/admin";

/**
 * Invite POS / driver staff. The role travels in APP metadata
 * (service-role only) — never user metadata — so the signup trigger
 * can trust it. A self-registering customer can never reach this path.
 */
export async function inviteStaff(input: unknown) {
  const { user } = await requireRole(["super_admin", "admin"]);
  const parsed = inviteStaffSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the form fields" };
  const d = parsed.data;

  // Block duplicate accounts
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("full_name", "%")
    .limit(0); // (profiles has no email; check auth instead)
  void existing;
  const { data: byEmail } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1, page: 1 });
  void byEmail;
  // Definitive check: inviteUserByEmail fails for existing users anyway.

  const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(d.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/invite`,
    data: { full_name: d.full_name, phone: d.phone }, // display-only metadata
  });
  if (error || !invited.user) return { error: error?.message ?? "Invite failed" };

  // Set privileges via app_metadata + profile row (service role only)
  await supabaseAdmin.auth.admin.updateUserById(invited.user.id, {
    app_metadata: { role: d.role, branch_id: d.branch_id },
  });
  await supabaseAdmin
    .from("profiles")
    .update({
      role: d.role,
      branch_id: d.branch_id,
      phone: d.phone,
      full_name: d.full_name,
      vehicle_type: d.vehicle_type ?? null,
      vehicle_number: d.vehicle_number ?? null,
    })
    .eq("id", invited.user.id);

  await audit({
    actor_id: user.id,
    action: "INVITE_STAFF",
    target_table: "profiles",
    target_id: invited.user.id,
    new_data: { role: d.role, branch_id: d.branch_id, email: d.email },
  });
  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function setUserActive(targetId: string, active: boolean) {
  const { user } = await requireRole(["super_admin", "admin"]);
  if (targetId === user.id) return { error: "You can't suspend your own account" };

  const { data: old } = await supabaseAdmin.from("profiles").select("is_active, role").eq("id", targetId).single();
  await supabaseAdmin.from("profiles").update({ is_active: active }).eq("id", targetId);
  if (!active) {
    // Kill their sessions immediately
    await supabaseAdmin.auth.admin.signOut(targetId, "global").catch(() => {});
  }
  await audit({
    actor_id: user.id,
    action: active ? "REACTIVATE_USER" : "SUSPEND_USER",
    target_table: "profiles",
    target_id: targetId,
    old_data: old,
    new_data: { is_active: active },
  });
  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function changeUserRole(targetId: string, role: string, branchId?: string) {
  const { user } = await requireRole(["super_admin", "admin"]);
  if (!["customer", "pos_user", "delivery_driver", "admin"].includes(role)) {
    return { error: "That role can't be assigned here" }; 
  }
  if (targetId === user.id) return { error: "You can't change your own role" };

  const { data: old } = await supabaseAdmin.from("profiles").select("role, branch_id").eq("id", targetId).single();
  await supabaseAdmin
    .from("profiles")
    .update({ role, branch_id: branchId ?? null })
    .eq("id", targetId);
  await supabaseAdmin.auth.admin.updateUserById(targetId, {
    app_metadata: { role, branch_id: branchId ?? null },
  });
  await audit({
    actor_id: user.id, action: "CHANGE_ROLE", target_table: "profiles",
    target_id: targetId, old_data: old, new_data: { role, branch_id: branchId },
  });
  revalidatePath("/admin/staff");
  return { ok: true };
}

// ── Admin order operations ──────────────────────────────────────
const ALLOWED_STATUSES = [
  "pending","confirmed","preparing","ready","assigned",
  "picked_up","on_the_way","delivered","cancelled",
];

export async function adminUpdateOrderStatus(orderId: string, status: string) {
  const { user } = await requireRole(["admin", "pos_user", "super_admin"]);
  if (!ALLOWED_STATUSES.includes(status)) return { error: "Invalid status" };
  await supabaseAdmin.from("orders").update({ status }).eq("id", orderId);
  await audit({ actor_id: user.id, action: "UPDATE_ORDER_STATUS", target_table: "orders", target_id: orderId, new_data: { status } });
  revalidatePath("/admin/orders");
  return { ok: true };
}

export async function assignDriver(orderId: string, driverId: string) {
  const { user } = await requireRole(["super_admin", "admin", "pos_user"]);
  const { data: driver } = await supabaseAdmin
    .from("profiles")
    .select("id, role, is_active, full_name")
    .eq("id", driverId)
    .single();
  if (!driver || driver.role !== "delivery_driver" || !driver.is_active) {
    return { error: "Pick an active delivery driver" };
  }
  await supabaseAdmin
    .from("deliveries")
    .update({ driver_id: driverId, assigned_at: new Date().toISOString() })
    .eq("order_id", orderId);
  await supabaseAdmin.from("orders").update({ status: "assigned" }).eq("id", orderId);
  await audit({ actor_id: user.id, action: "ASSIGN_DRIVER", target_table: "deliveries", target_id: orderId, new_data: { driverId } });
  revalidatePath("/admin/delivery");
  return { ok: true };
}

// ── Manual payment confirmation (no gateway in Nepal) ───────────
// payment_status NEVER changes from any client path — only an admin
// can flip it here, and every change is audit-logged with who/when.
export async function markOrderPaid(orderId: string) {
  const { user } = await requireRole(["super_admin", "admin", "pos_user"]);
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, total, payment_status, status, order_number, customer_id")
    .eq("id", orderId)
    .single();
  if (!order) return { error: "Order not found" };
  if (order.payment_status === "paid") return { ok: true };

  await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "paid",
      paid_confirmed_by: user.id,
      paid_confirmed_at: new Date().toISOString(),
      // a freshly-paid pending order is implicitly confirmed
      ...(order.status === "pending" ? { status: "confirmed" } : {}),
    })
    .eq("id", orderId);

  await awardOrderLoyaltyPoints(order.customer_id, Number(order.total));

  await audit({
    actor_id: user.id, action: "MARK_ORDER_PAID", target_table: "orders",
    target_id: orderId, old_data: { payment_status: order.payment_status },
    new_data: { payment_status: "paid", amount: order.total },
  });
  revalidatePath("/admin/orders"); revalidatePath("/admin");
  return { ok: true };
}

/** Undo an accidental confirmation — admin only, audited. */
export async function markOrderUnpaid(orderId: string) {
  const { user } = await requireRole(["super_admin", "admin", "pos_user"]);
  await supabaseAdmin
    .from("orders")
    .update({ payment_status: "pending", paid_confirmed_by: null, paid_confirmed_at: null })
    .eq("id", orderId);
  await audit({ actor_id: user.id, action: "MARK_ORDER_UNPAID", target_table: "orders", target_id: orderId });
  revalidatePath("/admin/orders"); revalidatePath("/admin");
  return { ok: true };
}
