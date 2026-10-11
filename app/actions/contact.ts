"use server";

import { contactSchema } from "@/lib/validations/contact";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { throttled, clientIp } from "@/lib/throttle";

// 5 messages per IP per 10 minutes, counted in the database so it holds
// across every server instance.
export async function submitContact(input: unknown) {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { error: "Please check the form" };
  if (parsed.data.website) return { ok: true }; // honeypot tripped — pretend success

  if (await throttled("contact", [await clientIp()], 5, 10)) return { error: "Too many messages — try again later" };

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
