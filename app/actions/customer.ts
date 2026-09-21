"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
