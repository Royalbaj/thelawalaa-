"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";

// ── Menu ─────────────────────────────────────────────────────────
const productSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().or(z.literal("")),
  category_id: z.string().uuid(),
  price: z.coerce.number().positive().max(100000),
  is_veg: z.coerce.boolean().default(true),
  spice_level: z.coerce.number().int().min(0).max(3).default(0),
  is_bestseller: z.coerce.boolean().default(false),
});

export async function createProduct(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the product fields" };
  const { data, error } = await supabaseAdmin.from("products").insert(parsed.data).select("id").single();
  if (error) return { error: "Couldn't create product" };
  await audit({ actor_id: user.id, action: "CREATE_PRODUCT", target_table: "products", target_id: data.id, new_data: parsed.data });
  revalidatePath("/admin/menu"); revalidatePath("/");
  return { ok: true };
}

export async function updateProduct(productId: string, input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(productId).success) return { error: "Bad id" };
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the product fields" };

  const { data: old } = await supabaseAdmin.from("products").select("name, price").eq("id", productId).single();
  const { error } = await supabaseAdmin.from("products").update(parsed.data).eq("id", productId);
  if (error) return { error: "Couldn't update product" };
  await audit({ actor_id: user.id, action: "UPDATE_PRODUCT", target_table: "products", target_id: productId, old_data: old, new_data: parsed.data });
  revalidatePath("/admin/menu"); revalidatePath("/");
  return { ok: true };
}

export async function setProductAvailability(productId: string, available: boolean) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(productId).success) return { error: "Bad id" };
  await supabaseAdmin.from("products").update({ is_available: available }).eq("id", productId);
  await audit({ actor_id: user.id, action: "TOGGLE_PRODUCT", target_table: "products", target_id: productId, new_data: { available } });
  revalidatePath("/admin/menu"); revalidatePath("/");
  return { ok: true };
}

export async function deleteProduct(productId: string) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(productId).success) return { error: "Bad id" };
  await supabaseAdmin.from("products").delete().eq("id", productId);
  await audit({ actor_id: user.id, action: "DELETE_PRODUCT", target_table: "products", target_id: productId });
  revalidatePath("/admin/menu"); revalidatePath("/");
  return { ok: true };
}

export async function createCategory(name: string) {
  const { user } = await requireRole(["super_admin"]);
  const v = z.string().min(2).max(60).safeParse(name);
  if (!v.success) return { error: "Category name 2–60 chars" };
  const { data, error } = await supabaseAdmin.from("categories").insert({ name: v.data }).select("id").single();
  if (error) return { error: "Couldn't create category" };
  await audit({ actor_id: user.id, action: "CREATE_CATEGORY", target_table: "categories", target_id: data.id });
  revalidatePath("/admin/menu"); revalidatePath("/");
  return { ok: true };
}

// ── Announcements ────────────────────────────────────────────────
const announcementSchema = z.object({
  message: z.string().min(3).max(200),
  link_url: z.string().url().optional().or(z.literal("")),
  ends_at: z.string().optional().or(z.literal("")),
});

export async function createAnnouncement(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the announcement fields" };
  const { data, error } = await supabaseAdmin.from("announcements").insert({
    message: parsed.data.message,
    link_url: parsed.data.link_url || null,
    ends_at: parsed.data.ends_at ? new Date(parsed.data.ends_at).toISOString() : null,
    created_by: user.id,
  }).select("id").single();
  if (error) return { error: "Couldn't create announcement" };
  await audit({ actor_id: user.id, action: "CREATE_ANNOUNCEMENT", target_table: "announcements", target_id: data.id });
  revalidatePath("/admin/announcements"); revalidatePath("/");
  return { ok: true };
}

export async function setAnnouncementActive(id: string, active: boolean) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  await supabaseAdmin.from("announcements").update({ is_active: active }).eq("id", id);
  await audit({ actor_id: user.id, action: "TOGGLE_ANNOUNCEMENT", target_table: "announcements", target_id: id, new_data: { active } });
  revalidatePath("/admin/announcements"); revalidatePath("/");
  return { ok: true };
}

// ── Promo codes ──────────────────────────────────────────────────
const promoSchema = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Z0-9]+$/, "Uppercase letters and digits only"),
  discount_type: z.enum(["percent", "flat"]),
  discount_value: z.coerce.number().positive().max(10000),
  min_order_amount: z.coerce.number().min(0).default(0),
  max_uses: z.coerce.number().int().positive().optional(),
  expires_at: z.string().optional().or(z.literal("")),
});

export async function createPromoCode(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Check the promo fields" };
  if (parsed.data.discount_type === "percent" && parsed.data.discount_value > 90) {
    return { error: "Percent discount capped at 90%" };
  }
  const { data, error } = await supabaseAdmin.from("promo_codes").insert({
    code: parsed.data.code,
    discount_type: parsed.data.discount_type,
    discount_value: parsed.data.discount_value,
    min_order_amount: parsed.data.min_order_amount,
    max_uses: parsed.data.max_uses ?? null,
    expires_at: parsed.data.expires_at ? new Date(parsed.data.expires_at).toISOString() : null,
  }).select("id").single();
  if (error) return { error: "Code already exists?" };
  await audit({ actor_id: user.id, action: "CREATE_PROMO", target_table: "promo_codes", target_id: data.id, new_data: { code: parsed.data.code } });
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function setPromoActive(id: string, active: boolean) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  await supabaseAdmin.from("promo_codes").update({ is_active: active }).eq("id", id);
  await audit({ actor_id: user.id, action: "TOGGLE_PROMO", target_table: "promo_codes", target_id: id, new_data: { active } });
  revalidatePath("/admin/settings");
  return { ok: true };
}

// ── Branches ─────────────────────────────────────────────────────
const branchSchema = z.object({
  name: z.string().min(2).max(80),
  address: z.string().min(5).max(300),
  phone: z.string().max(20).optional().or(z.literal("")),
});

export async function createBranch(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = branchSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the branch fields" };
  const { data, error } = await supabaseAdmin.from("branches").insert({
    name: parsed.data.name, address: parsed.data.address, phone: parsed.data.phone || null,
  }).select("id").single();
  if (error) return { error: "Couldn't create branch" };
  await audit({ actor_id: user.id, action: "CREATE_BRANCH", target_table: "branches", target_id: data.id });
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function setBranchActive(id: string, active: boolean) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  await supabaseAdmin.from("branches").update({ is_active: active }).eq("id", id);
  await audit({ actor_id: user.id, action: "TOGGLE_BRANCH", target_table: "branches", target_id: id, new_data: { active } });
  revalidatePath("/admin/settings");
  return { ok: true };
}
