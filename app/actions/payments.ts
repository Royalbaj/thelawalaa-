"use server";

import { z } from "zod";
import { buildEsewaFormPayload } from "@/lib/payments/esewa";
import { supabaseAdmin } from "@/lib/supabase/admin";

const inputSchema = z.object({ orderId: z.string().uuid() });

/**
 * Returns the signed form fields for a hidden auto-submit form that
 * redirects the browser to eSewa. Open to guests (no requireRole) since
 * anonymous checkout is allowed — the order id is an unguessable UUID
 * and this never mutates payment_status, only gateway bookkeeping.
 */
export async function getEsewaPaymentForm(
  input: unknown
): Promise<{ error: string } | { action: string; fields: Record<string, string> }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid order" };

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, total, payment_method, payment_status")
    .eq("id", parsed.data.orderId)
    .single();

  if (!order) return { error: "Order not found" };
  if (order.payment_method !== "esewa") return { error: "This order isn't set up for eSewa" };
  if (order.payment_status === "paid") return { error: "This order is already paid" };

  const { data: settings } = await supabaseAdmin.from("app_settings").select("esewa_enabled").eq("id", 1).single();
  if (!settings?.esewa_enabled) return { error: "eSewa isn't available right now" };

  // Fresh uuid per attempt so a retry after a failed/abandoned payment
  // doesn't collide with eSewa's dedup on transaction_uuid.
  const transactionUuid = `${order.id}-${Date.now()}`;

  await supabaseAdmin
    .from("orders")
    .update({ payment_gateway: "esewa", gateway_transaction_uuid: transactionUuid })
    .eq("id", order.id);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { action, fields } = buildEsewaFormPayload({
    transactionUuid,
    totalAmount: Number(order.total),
    successUrl: `${siteUrl}/api/payments/esewa/callback`,
    failureUrl: `${siteUrl}/api/payments/esewa/failure?order=${order.id}`,
  });

  return { action, fields };
}
