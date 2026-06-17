"use server";

import { headers } from "next/headers";
import { contactSchema } from "@/lib/validations/contact";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Naive per-IP throttle (resets per server instance). For hard guarantees
// add Upstash Ratelimit or Vercel WAF rules.
const recent = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

export async function submitContact(input: unknown) {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { error: "Please check the form" };
  if (parsed.data.website) return { ok: true }; // honeypot tripped — pretend success

  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) return { error: "Too many messages — try again later" };
  recent.set(ip, [...hits, now]);

  const { error } = await supabaseAdmin.from("contact_submissions").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    subject: parsed.data.subject || null,
    message: parsed.data.message,
  });
  if (error) return { error: "Couldn't send your message — try again" };
  return { ok: true };
}
