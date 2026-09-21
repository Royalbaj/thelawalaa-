"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { inviteStaffSchema } from "@/lib/validations/staff";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit, awardOrderLoyaltyPoints } from "@/lib/supabase/admin";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Invite POS / driver / admin staff. The role travels in APP metadata
 * (service-role only) — never user metadata — so the signup trigger
 * can trust it. A self-registering customer can never reach this path.
 *
 * Deliberately NOT using supabaseAdmin.auth.admin.inviteUserByEmail():
 * it emails Supabase's own /auth/v1/verify link, a plain GET that
 * consumes the one-time invite token the instant anything requests it —
 * including corporate email security scanners and inbox link-preview
 * bots, which fetch every link in an email automatically. The real
 * person then clicks an already-burned link and sees "expired".
 * generateLink() issues the same token WITHOUT emailing it, so we send
 * our own email whose link only opens a page — the token is consumed
 * client-side, inside the onClick handler of an explicit "Accept
 * invite" button (see app/auth/invite/page.tsx). A bot that fetches
 * the HTML never fires that handler.
 */
export async function inviteStaff(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = inviteStaffSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the form fields" };
  const d = parsed.data;

  const { data: generated, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email: d.email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/invite`,
      data: { full_name: d.full_name, phone: d.phone }, // display-only metadata
    },
  });
  // generateLink fails for an email that's already registered, same as
  // inviteUserByEmail did — no separate duplicate check needed.
  if (error || !generated.user) return { error: error?.message ?? "Invite failed" };

  // Set privileges via app_metadata + profile row (service role only)
  await supabaseAdmin.auth.admin.updateUserById(generated.user.id, {
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
    .eq("id", generated.user.id);

  const acceptUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/invite?token_hash=${generated.properties.hashed_token}&type=invite`;

  if (resend) {
    try {
      await resend.emails.send({
        from: "Thelawalaa <orders@thelawalaa.com>",
        to: d.email,
        subject: "You're invited to the Thelawalaa team",
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:auto">
            <h1 style="color:#F97316">Welcome to the team 🥘</h1>
            <p>${d.full_name}, you've been invited to join Thelawalaa as <b>${d.role.replace("_", " ")}</b>.</p>
            <p>Open this on the device you'll actually use to work, then tap the button below.</p>
            <a href="${acceptUrl}"
               style="display:inline-block;background:#F97316;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold">Accept invite</a>
            <p style="color:#78716c;font-size:12px;margin-top:24px">If you weren't expecting this, you can ignore this email.</p>
          </div>`,
      });
    } catch {
      // Account + role are already set — the admin just needs to know
      // the email didn't go out, so they can resend or share the link.
      await audit({
        actor_id: user.id, action: "INVITE_STAFF", target_table: "profiles",
        target_id: generated.user.id,
        new_data: { role: d.role, branch_id: d.branch_id, email: d.email, email_failed: true },
      });
      revalidatePath("/admin/staff");
      return { error: "Account created, but the invite email failed to send — resend it from the staff list." };
    }
  }

  await audit({
    actor_id: user.id,
    action: "INVITE_STAFF",
    target_table: "profiles",
    target_id: generated.user.id,
    new_data: { role: d.role, branch_id: d.branch_id, email: d.email },
  });
  revalidatePath("/admin/staff");
  return { ok: true };
}

/** Re-send a fresh invite link to someone whose first one expired or bounced. */
export async function resendStaffInvite(targetId: string) {
  const { user } = await requireRole(["super_admin"]);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, role")
    .eq("id", targetId)
    .single();
  if (!profile) return { error: "Staff account not found" };

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(targetId);
  const email = authUser?.user?.email;
  if (!email) return { error: "No email on file for this account" };

  const { data: generated, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/invite` },
  });
  if (error) return { error: error.message };

  const acceptUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/invite?token_hash=${generated.properties.hashed_token}&type=invite`;

  if (resend) {
    try {
      await resend.emails.send({
        from: "Thelawalaa <orders@thelawalaa.com>",
        to: email,
        subject: "Your Thelawalaa team invite",
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:auto">
            <h1 style="color:#F97316">Welcome to the team 🥘</h1>
            <p>${profile.full_name}, here's a fresh invite link for your <b>${profile.role.replace("_", " ")}</b> account.</p>
            <a href="${acceptUrl}"
               style="display:inline-block;background:#F97316;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold">Accept invite</a>
          </div>`,
      });
    } catch {
      return { error: "Link generated but the email failed to send — try again in a moment." };
    }
  }

  await audit({ actor_id: user.id, action: "RESEND_STAFF_INVITE", target_table: "profiles", target_id: targetId });
  return { ok: true };
}

export async function setUserActive(targetId: string, active: boolean) {
  const { user } = await requireRole(["super_admin"]);
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
  const { user } = await requireRole(["super_admin"]);
  if (!["customer", "pos_user", "delivery_driver", "super_admin"].includes(role)) {
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
  const { user } = await requireRole(["super_admin", "pos_user"]);
  if (!ALLOWED_STATUSES.includes(status)) return { error: "Invalid status" };
  await supabaseAdmin.from("orders").update({ status }).eq("id", orderId);
  await audit({ actor_id: user.id, action: "UPDATE_ORDER_STATUS", target_table: "orders", target_id: orderId, new_data: { status } });
  revalidatePath("/admin/orders");
  return { ok: true };
}

export async function assignDriver(orderId: string, driverId: string) {
  const { user } = await requireRole(["super_admin", "pos_user"]);
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
  const { user } = await requireRole(["super_admin", "pos_user"]);
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
  const { user } = await requireRole(["super_admin", "pos_user"]);
  await supabaseAdmin
    .from("orders")
    .update({ payment_status: "pending", paid_confirmed_by: null, paid_confirmed_at: null })
    .eq("id", orderId);
  await audit({ actor_id: user.id, action: "MARK_ORDER_UNPAID", target_table: "orders", target_id: orderId });
  revalidatePath("/admin/orders"); revalidatePath("/admin");
  return { ok: true };
}
