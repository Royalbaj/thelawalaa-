"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { z as zod } from "zod";
import { supabaseAdmin, getRewardSettings, audit } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/signed-links";
import { phoneNP } from "@/lib/validations/auth";

export async function toggleFavorite(productId: string) {
  const { user } = await requireRole(["customer", "super_admin"]);
  
  const { data: existing } = await supabaseAdmin
    .from("customer_favorites")
    .select("id")
    .eq("customer_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();
    
  if (existing) {
    await supabaseAdmin.from("customer_favorites").delete().eq("id", existing.id);
  } else {
    await supabaseAdmin.from("customer_favorites").insert({
      customer_id: user.id,
      product_id: productId
    });
  }
  
  revalidatePath("/account");
  revalidatePath("/order");
  return { ok: true, isFavorite: !existing };
}

export async function submitOrderRating(orderId: string, foodRating: number, deliveryRating: number | null, comment: string | null) {
  const { user } = await requireRole(["customer"]);
  
  const { error } = await supabaseAdmin.from("order_ratings").insert({
    order_id: orderId,
    customer_id: user.id,
    food_rating: foodRating,
    delivery_rating: deliveryRating,
    comment: comment || null
  });
  
  if (error) return { error: "Could not submit rating" };
  
  revalidatePath("/account/orders");
  revalidatePath(`/track/${orderId}`);
  return { ok: true };
}

// ── Customer portal (app/account) ────────────────────────────────

/** Name + mobile number. (Email changes go through support; the password through the form, client-side.) */
export async function updateMyProfile(input: unknown) {
  const { user } = await requireRole(["customer"]);
  const parsed = zod.object({ full_name: zod.string().trim().min(2, "Enter your full name").max(100), phone: phoneNP }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details" };
  const { error } = await supabaseAdmin.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { error: "Couldn't save — please try again" };
  revalidatePath("/account", "layout");
  return { ok: true };
}

/** "Order again": that order's items at TODAY's menu and prices (anything no longer sold is skipped). */
export async function getReorderItems(orderId: string) {
  const { user } = await requireRole(["customer"]);
  if (!zod.string().uuid().safeParse(orderId).success) return { error: "Order not found" };
  const { data: order } = await supabaseAdmin.from("orders").select("id, customer_id").eq("id", orderId).single();
  if (!order || order.customer_id !== user.id) return { error: "Order not found" };
  const { data: lines } = await supabaseAdmin.from("order_items").select("product_id, quantity, product_price").eq("order_id", orderId);
  const paid = (lines ?? []).filter((l) => l.product_id && Number(l.product_price) > 0); // not the free reward line
  const ids = [...new Set(paid.map((l) => l.product_id as string))];
  const { data: products } = ids.length
    ? await supabaseAdmin.from("products").select("id, name, price, is_available, pos_only").in("id", ids)
    : { data: [] };
  const live = new Map((products ?? []).filter((p) => p.is_available && !p.pos_only).map((p) => [p.id, p]));
  const items = paid.filter((l) => live.has(l.product_id as string)).map((l) => {
    const p = live.get(l.product_id as string)!;
    return { product_id: p.id, name: p.name, price: Number(p.price), quantity: l.quantity as number };
  });
  return { ok: true, items, skipped: paid.length - items.length };
}

/** What the signed-in customer can use at checkout right now. */
export async function getCheckoutRewards() {
  const { user } = await requireRole(["customer"]).catch(() => ({ user: null }));
  if (!user) return null;
  const [settings, { data: bal }] = await Promise.all([
    getRewardSettings(),
    supabaseAdmin.from("loyalty_points").select("points, free_items").eq("customer_id", user.id).maybeSingle(),
  ]);
  if (!settings.enabled) return null;
  const { data: freeItem } = settings.free_item_enabled && settings.free_item_product_id
    ? await supabaseAdmin.from("products").select("id, name, is_available").eq("id", settings.free_item_product_id).maybeSingle()
    : { data: null };
  return {
    settings,
    points: bal?.points ?? 0,
    freeItems: settings.free_item_enabled ? bal?.free_items ?? 0 : 0,
    freeItem: freeItem ? { name: freeItem.name, available: freeItem.is_available } : null,
  };
}

// ── Offers & competitions (opt-in only, migration 029) ───────────

/** "Join offers & competitions" / "Leave" in the customer's account. */
export async function setMarketingOptIn(join: boolean) {
  const { user } = await requireRole(["customer"]);
  const { error } = await supabaseAdmin.from("profiles")
    .update({ marketing_opt_in: !!join, marketing_opt_in_at: join ? new Date().toISOString() : null })
    .eq("id", user.id);
  if (error) return { error: "Couldn't save — please try again" };
  await audit({ actor_id: user.id, action: join ? "MARKETING_OPT_IN" : "MARKETING_OPT_OUT", target_table: "profiles", target_id: user.id });
  revalidatePath("/account", "layout");
  return { ok: true, joined: !!join };
}

/**
 * The unsubscribe link in an offers email — works without signing in. No
 * requireRole on purpose (like submitFeedback): the signed token proves the
 * link came from us for this person, and it can only ever switch offers OFF.
 */
export async function unsubscribeByLink(profileId: unknown, token: unknown) {
  const ok = zod.object({ id: zod.string().uuid(), token: zod.string().min(20).max(100) }).safeParse({ id: profileId, token });
  if (!ok.success || !verifyUnsubscribeToken(ok.data.id, ok.data.token)) return { error: "This unsubscribe link isn't valid — sign in and use your profile instead." };
  await supabaseAdmin.from("profiles").update({ marketing_opt_in: false, marketing_opt_in_at: null }).eq("id", ok.data.id);
  await audit({ actor_id: ok.data.id, action: "MARKETING_OPT_OUT", target_table: "profiles", target_id: ok.data.id, new_data: { via: "email_link" } });
  return { ok: true };
}
