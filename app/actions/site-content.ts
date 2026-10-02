"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { SITE_TEXT_FIELDS, SITE_TEXT_DEFAULTS } from "@/lib/site-content";

// Admin → Website text. Only known fields are accepted, each within its own
// length limit; text that matches the default (or is left empty) is stored
// as "no change", so the built-in wording shows.
export async function saveSiteText(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = z.record(z.string(), z.string()).safeParse(input);
  if (!parsed.success) return { error: "Nothing to save" };

  const upserts: { key: string; value: string; updated_by: string; updated_at: string }[] = [];
  const resets: string[] = [];
  for (const field of SITE_TEXT_FIELDS) {
    if (!(field.key in parsed.data)) continue;
    let value = parsed.data[field.key].replace(/\r\n/g, "\n").trim();
    if (!field.multiline) value = value.replace(/\s+/g, " ");
    if (field.key === "contact.whatsapp" && value) {
      value = value.replace(/\D/g, "");
      if (!/^977\d{9,10}$/.test(value)) return { error: "WhatsApp number: digits only, starting with 977 (e.g. 9779812345678)" };
    }
    if (value.length > field.max) return { error: `“${field.label}” is too long — keep it under ${field.max} characters` };
    if (!value || value === SITE_TEXT_DEFAULTS[field.key as keyof typeof SITE_TEXT_DEFAULTS]) resets.push(field.key);
    else upserts.push({ key: field.key, value, updated_by: user.id, updated_at: new Date().toISOString() });
  }

  if (upserts.length) {
    const { error } = await supabaseAdmin.from("site_content").upsert(upserts, { onConflict: "key" });
    if (error) return { error: "Couldn't save — try again" };
  }
  if (resets.length) {
    const { error } = await supabaseAdmin.from("site_content").delete().in("key", resets);
    if (error) return { error: "Couldn't save — try again" };
  }
  await audit({ actor_id: user.id, action: "SITE_TEXT_SAVE", target_table: "site_content",
    new_data: { changed: upserts.map((u) => u.key), reset_to_default: resets.length } });
  // The homepage, footer and anything else showing this text.
  revalidatePath("/", "layout");
  return { ok: true, changed: upserts.length };
}
