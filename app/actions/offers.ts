"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";

const offerSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(300).optional().or(z.literal("")),
  offer_type: z.enum(["deal", "banner", "reward"]),
  discount_label: z.string().max(50).optional().or(z.literal("")),
  target_audience: z.enum(["all", "new", "returning", "loyalty"]).default("all"),
  ends_at: z.string().optional().or(z.literal("")),
});

export async function createOffer(input: unknown) {
  const { user } = await requireRole(["admin"]);
  const parsed = offerSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the offer fields" };

  const { data, error } = await supabaseAdmin.from("offers").insert({
    title: parsed.data.title,
    description: parsed.data.description || null,
    offer_type: parsed.data.offer_type,
    discount_label: parsed.data.discount_label || null,
    target_audience: parsed.data.target_audience,
    ends_at: parsed.data.ends_at ? new Date(parsed.data.ends_at).toISOString() : null,
    created_by: user.id,
  }).select("id").single();

  if (error) return { error: "Couldn't create offer" };
  await audit({ actor_id: user.id, action: "CREATE_OFFER", target_table: "offers", target_id: data.id, new_data: parsed.data });
  revalidatePath("/admin/offers");
  return { ok: true };
}

export async function setOfferActive(id: string, active: boolean) {
  const { user } = await requireRole(["admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  await supabaseAdmin.from("offers").update({ is_active: active }).eq("id", id);
  await audit({ actor_id: user.id, action: "TOGGLE_OFFER", target_table: "offers", target_id: id, new_data: { active } });
  revalidatePath("/admin/offers");
  return { ok: true };
}

export async function deleteOffer(id: string) {
  const { user } = await requireRole(["admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  await supabaseAdmin.from("offers").delete().eq("id", id);
  await audit({ actor_id: user.id, action: "DELETE_OFFER", target_table: "offers", target_id: id });
  revalidatePath("/admin/offers");
  return { ok: true };
}
