"use server";

import { z } from "zod";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";

// /feedback is public, so this is the one action without requireRole: it is
// Zod-validated, has a honeypot, and throttles by a keyed hash of the IP
// (never the IP itself) — 3 per 10 minutes, counted in the table so it holds
// across every server instance.
const MAX_PER_WINDOW = 3;
const WINDOW_MINUTES = 10;

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const feedbackSchema = z.object({
  rating: z.coerce.number().int().min(1, "Pick how it was").max(5),
  comment: z.preprocess(blank, z.string().trim().max(1000, "Keep it under 1,000 characters").optional()),
  name: z.preprocess(blank, z.string().trim().max(80).optional()),
  contact: z.preprocess(blank, z.string().trim().max(80).optional()),
  order_ref: z.preprocess(blank, z.string().trim().max(30).optional()),
  visit: z.preprocess(blank, z.enum(["dine_in", "pickup", "delivery"]).optional()),
  website: z.string().optional(), // honeypot — people never see it
});

function ipHash(ip: string) {
  const key = process.env.OTP_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "local-dev";
  return createHmac("sha256", `feedback|${key}`).update(ip).digest("hex").slice(0, 32);
}

export async function submitFeedback(input: unknown) {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  const { website, ...d } = parsed.data;
  if (website) return { ok: true }; // a bot filled the hidden field — pretend it worked

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const hash = ipHash(ip);
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await supabaseAdmin.from("feedback").select("id", { count: "exact", head: true })
    .eq("ip_hash", hash).gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_WINDOW) return { error: "Thanks — we've just had a few from you. Try again in a few minutes." };

  const { error } = await supabaseAdmin.from("feedback").insert({
    rating: d.rating, comment: d.comment ?? null, name: d.name ?? null, contact: d.contact ?? null,
    order_ref: d.order_ref ?? null, visit: d.visit ?? null, ip_hash: hash,
  });
  if (error) return { error: "Couldn't send it — please try again" };
  revalidatePath("/admin/feedback");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

/** Admin → Feedback: mark one (or every) piece of feedback as read. */
export async function markFeedbackRead(id: string | "all") {
  const { user } = await requireRole(["super_admin"]);
  if (id !== "all" && !z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  const q = supabaseAdmin.from("feedback").update({ is_read: true });
  const { error } = id === "all" ? await q.eq("is_read", false) : await q.eq("id", id);
  if (error) return { error: "Couldn't update" };
  await audit({ actor_id: user.id, action: "FEEDBACK_READ", target_table: "feedback", target_id: id === "all" ? null : id });
  revalidatePath("/admin/feedback");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}
