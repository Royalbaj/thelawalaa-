"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";

const stockItemSchema = z.object({
  name: z.string().trim().min(2).max(100),
  unit: z.string().trim().min(1).max(20),
  reorder_level: z.coerce.number().min(0),
  cost_per_unit: z.coerce.number().min(0),
});

export async function addStockItem(input: unknown) {
  const { user } = await requireAuth();
  const parsed = stockItemSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the form fields" };

  const { data, error } = await supabaseAdmin.from("stock_items").insert(parsed.data).select("id").single();
  if (error) return { error: "Could not add item" };

  await audit({ actor_id: user.id, action: "ADD_STOCK_ITEM", target_table: "stock_items", target_id: data.id, new_data: parsed.data });
  revalidatePath("/stock");
  return { ok: true };
}

export async function setStockItemActive(id: string, active: boolean) {
  const { user } = await requireAuth();
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  await supabaseAdmin.from("stock_items").update({ is_active: active }).eq("id", id);
  await audit({ actor_id: user.id, action: "TOGGLE_STOCK_ITEM", target_table: "stock_items", target_id: id, new_data: { active } });
  revalidatePath("/stock");
  return { ok: true };
}

const movementSchema = z.object({
  stock_item_id: z.string().uuid(),
  type: z.enum(["restock", "usage", "wastage", "adjustment"]),
  quantity: z.coerce.number(),
  note: z.string().trim().max(200).optional(),
});

/** Records a movement and updates the running quantity in one place, atomically. */
export async function recordStockMovement(input: unknown) {
  const { user } = await requireAuth();
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the form fields" };
  const d = parsed.data;

  const signedQty = d.type === "restock" ? Math.abs(d.quantity) : -Math.abs(d.quantity);
  const delta = d.type === "adjustment" ? d.quantity : signedQty;

  const { data: item } = await supabaseAdmin.from("stock_items").select("quantity").eq("id", d.stock_item_id).single();
  if (!item) return { error: "Item not found" };
  const newQty = Number(item.quantity) + delta;
  if (newQty < 0) return { error: "That would make stock negative" };

  await supabaseAdmin.from("stock_items").update({ quantity: newQty, updated_at: new Date().toISOString() }).eq("id", d.stock_item_id);
  await supabaseAdmin.from("stock_movements").insert({
    stock_item_id: d.stock_item_id, type: d.type, quantity: delta, note: d.note || null, created_by: user.id,
  });

  await audit({ actor_id: user.id, action: "STOCK_MOVEMENT", target_table: "stock_items", target_id: d.stock_item_id, new_data: { type: d.type, delta } });
  revalidatePath("/stock");
  revalidatePath("/reports");
  return { ok: true };
}
