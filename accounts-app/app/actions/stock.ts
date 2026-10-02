"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { syncAlertState } from "@/lib/stock";

const id = z.string().uuid();
const amount = (label: string) => z.coerce.number({ invalid_type_error: `Enter ${label}` }).min(0, `Enter ${label}`).max(1_000_000)
  .transform((v) => Math.round(v * 1000) / 1000);
const note = z.string().trim().max(200).optional().transform((v) => v || null);

const itemSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(60),
  unit: z.string().trim().min(1, "Pick a unit").max(20),
  reorder_level: amount("when to warn"),
  // POS menu items that use this stock, and how much of it each one sold uses.
  links: z.array(z.object({ product_id: id, units_per_sale: z.coerce.number().positive("Uses per sale must be more than 0").max(1000) })).max(60),
});

const refresh = () => revalidatePath("/", "layout");

async function saveLinks(stockItemId: string, links: { product_id: string; units_per_sale: number }[]) {
  await supabaseAdmin.from("stock_item_products").delete().eq("stock_item_id", stockItemId);
  if (links.length) {
    const { error } = await supabaseAdmin.from("stock_item_products")
      .insert(links.map((l) => ({ stock_item_id: stockItemId, ...l })));
    if (error) throw new Error("Couldn't link the menu items");
  }
}

export async function createStockItem(input: unknown) {
  const { user, person } = await requireAuth();
  const parsed = itemSchema.extend({ quantity: amount("how much you have now") }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { links, quantity, ...item } = parsed.data;
  const { data, error } = await supabaseAdmin.from("stock_items")
    .insert({ ...item, quantity, counted_at: new Date().toISOString() }).select("id").single();
  if (error || !data) return { error: "Couldn't add the item" };
  try { await saveLinks(data.id, links); } catch (e) { return { error: (e as Error).message }; }
  await supabaseAdmin.from("stock_movements").insert({
    stock_item_id: data.id, type: "adjustment", quantity, note: "Started with this much", created_by: user.id, entered_by: person.id,
  });
  await syncAlertState(data.id);
  await audit({ actor_id: user.id, action: "STOCK_ITEM_ADD", target_table: "stock_items", target_id: data.id, new_data: { ...parsed.data, person: person.name } });
  refresh();
  return { ok: true };
}

export async function updateStockItem(itemId: string, input: unknown) {
  const { user, person } = await requireAuth();
  if (!id.safeParse(itemId).success) return { error: "Bad item" };
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const { links, ...item } = parsed.data;
  const { error } = await supabaseAdmin.from("stock_items").update({ ...item, updated_at: new Date().toISOString() }).eq("id", itemId);
  if (error) return { error: "Couldn't save" };
  try { await saveLinks(itemId, links); } catch (e) { return { error: (e as Error).message }; }
  await syncAlertState(itemId);
  await audit({ actor_id: user.id, action: "STOCK_ITEM_EDIT", target_table: "stock_items", target_id: itemId, new_data: { ...parsed.data, person: person.name } });
  refresh();
  return { ok: true };
}

const changeSchema = z.object({
  item: id,
  // restock: +qty · waste: −qty · count: "we actually have qty right now"
  kind: z.enum(["restock", "waste", "count"]),
  quantity: amount("the amount"),
  note,
});

export async function changeStock(input: unknown) {
  const { user, person } = await requireAuth();
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the amount" };
  const { item, kind, quantity, note: n } = parsed.data;
  if (kind !== "count" && quantity <= 0) return { error: "Enter the amount" };

  if (kind === "count") {
    // A fresh count: what's left is now exactly this; earlier sales/restocks no longer matter.
    const { error } = await supabaseAdmin.from("stock_items")
      .update({ quantity, counted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", item);
    if (error) return { error: "Couldn't save the count" };
  }
  const { error } = await supabaseAdmin.from("stock_movements").insert({
    stock_item_id: item, type: kind === "restock" ? "restock" : kind === "waste" ? "wastage" : "adjustment",
    quantity, note: n ?? (kind === "count" ? "Counted" : null), created_by: user.id, entered_by: person.id,
  });
  if (error) return { error: "Couldn't save" };
  await syncAlertState(item);
  await audit({ actor_id: user.id, action: `STOCK_${kind.toUpperCase()}`, target_table: "stock_items", target_id: item, new_data: { quantity, note: n, person: person.name } });
  refresh();
  return { ok: true };
}

export async function removeStockItem(itemId: string) {
  const { user, person } = await requireAuth();
  if (!id.safeParse(itemId).success) return { error: "Bad item" };
  await supabaseAdmin.from("stock_items").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", itemId);
  await audit({ actor_id: user.id, action: "STOCK_ITEM_REMOVE", target_table: "stock_items", target_id: itemId, new_data: { person: person.name } });
  refresh();
  return { ok: true };
}
