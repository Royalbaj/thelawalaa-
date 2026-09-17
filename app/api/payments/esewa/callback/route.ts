import { NextRequest, NextResponse } from "next/server";
import { decodeEsewaRedirect, verifyEsewaTransaction } from "@/lib/payments/esewa";
import { supabaseAdmin, audit, awardOrderLoyaltyPoints } from "@/lib/supabase/admin";

/**
 * eSewa's success_url. The redirect payload is just what the customer's
 * browser carried back — never trusted on its own. We use it only to
 * find the order, then ask eSewa's status API (server-to-server) whether
 * the transaction actually completed before touching payment_status.
 */
export async function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const data = request.nextUrl.searchParams.get("data");
  const decoded = data ? decodeEsewaRedirect(data) : null;

  if (!decoded?.transaction_uuid) {
    return NextResponse.redirect(`${siteUrl}/?payment=error`);
  }

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, total, payment_status, status, customer_id")
    .eq("gateway_transaction_uuid", decoded.transaction_uuid)
    .single();

  if (!order) {
    return NextResponse.redirect(`${siteUrl}/?payment=error`);
  }

  if (order.payment_status === "paid") {
    // Already confirmed by an earlier hit — idempotent, just send them back.
    return NextResponse.redirect(`${siteUrl}/track/${order.id}?payment=success`);
  }

  const { status, ref_id } = await verifyEsewaTransaction(decoded.transaction_uuid, Number(order.total));

  if (status !== "COMPLETE") {
    return NextResponse.redirect(`${siteUrl}/track/${order.id}?payment=failed`);
  }

  await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "paid",
      gateway_ref_id: ref_id,
      gateway_verified_at: new Date().toISOString(),
      ...(order.status === "pending" ? { status: "confirmed" } : {}),
    })
    .eq("id", order.id);

  await awardOrderLoyaltyPoints(order.customer_id, Number(order.total));

  // actor_id null = confirmed by the system (gateway), not a human admin —
  // stays distinguishable from an admin's manual markOrderPaid.
  await audit({
    actor_id: null,
    action: "GATEWAY_PAYMENT_CONFIRMED",
    target_table: "orders",
    target_id: order.id,
    new_data: { gateway: "esewa", ref_id, amount: order.total },
  });

  return NextResponse.redirect(`${siteUrl}/track/${order.id}?payment=success`);
}
