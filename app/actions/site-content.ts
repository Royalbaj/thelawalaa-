"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { SITE_TEXT_INPUTS } from "@/lib/site-content";
import { MAX_VIDEO_MB, SITE_MEDIA_BUCKET, bucketPath, ownMediaUrl } from "@/lib/site-media";

// The two fields that point at a file (the how-to-order video and its cover).
const MEDIA_KEYS = ["order.video", "order.video_poster"];

// Admin → Website text. Only known fields are accepted, each within its own
// length limit; text that matches the default (or is left empty) is stored
// as "no change", so the built-in wording shows. Nepali versions ("ne.<key>",
// the /ne homepage) are fields of their own.
export async function saveSiteText(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = z.record(z.string(), z.string()).safeParse(input);
  if (!parsed.success) return { error: "Nothing to save" };

  const upserts: { key: string; value: string; updated_by: string; updated_at: string }[] = [];
  const resets: string[] = [];
  for (const field of SITE_TEXT_INPUTS) {
    if (!(field.key in parsed.data)) continue;
    let value = parsed.data[field.key].replace(/\r\n/g, "\n").trim();
    if (!field.multiline) value = value.replace(/\s+/g, " ");
    if (field.key === "contact.whatsapp" && value) {
      value = value.replace(/\D/g, "");
      if (!/^977\d{9,10}$/.test(value)) return { error: "WhatsApp number: digits only, starting with 977 (e.g. 9779812345678)" };
    }
    // Only our own files (public/videos or the site-media bucket) — see lib/site-media.ts.
    if (field.key === "order.video" && value && value.toLowerCase() !== "off" && !ownMediaUrl(value, "video")) {
      return { error: "How-to-order video: use “Upload a new video” (or type off to hide it)" };
    }
    if (field.key === "order.video_poster" && value && value.toLowerCase() !== "none" && !ownMediaUrl(value, "image")) {
      return { error: "Video cover picture: upload a video and it's made for you" };
    }
    if (value.length > field.max) return { error: `“${field.label}” is too long — keep it under ${field.max} characters` };
    if (!value || value === field.default) resets.push(field.key);
    else upserts.push({ key: field.key, value, updated_by: user.id, updated_at: new Date().toISOString() });
  }

  const { data: mediaBefore } = await supabaseAdmin.from("site_content").select("key, value").in("key", MEDIA_KEYS);

  if (upserts.length) {
    const { error } = await supabaseAdmin.from("site_content").upsert(upserts, { onConflict: "key" });
    if (error) return { error: "Couldn't save — try again" };
  }
  if (resets.length) {
    const { error } = await supabaseAdmin.from("site_content").delete().in("key", resets);
    if (error) return { error: "Couldn't save — try again" };
  }

  // A video / cover that was replaced or reset: delete the old upload.
  const replaced = (mediaBefore ?? []).filter((r) => {
    const now = upserts.find((u) => u.key === r.key)?.value ?? (resets.includes(r.key) ? null : r.value);
    return now !== r.value;
  }).map((r) => bucketPath(r.value)).filter((p): p is string => !!p);
  if (replaced.length) await supabaseAdmin.storage.from(SITE_MEDIA_BUCKET).remove(replaced);

  await audit({ actor_id: user.id, action: "SITE_TEXT_SAVE", target_table: "site_content",
    new_data: { changed: upserts.map((u) => u.key), reset_to_default: resets.length } });
  // The homepage, footer and anything else showing this text.
  revalidatePath("/", "layout");
  return { ok: true, changed: upserts.length };
}

const MEDIA_TYPES = {
  video: { types: { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" } as Record<string, string>, maxBytes: MAX_VIDEO_MB * 1024 * 1024 },
  image: { types: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>, maxBytes: 5 * 1024 * 1024 },
};

/**
 * Admin → Website text → "Upload a new video": a one-time signed upload URL in
 * the site-media bucket. The browser uploads straight to Storage (videos are
 * too big to pass through a server action), then the field gets the public
 * link and the admin presses Save as usual.
 */
export async function createSiteMediaUpload(input: unknown) {
  await requireRole(["super_admin"]);
  const parsed = z.object({ kind: z.enum(["video", "image"]), type: z.string().max(60), size: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { error: "Bad upload" };
  const { kind, type, size } = parsed.data;
  const ext = MEDIA_TYPES[kind].types[type];
  if (!ext) return { error: kind === "video" ? "Choose an MP4 video" : "Choose a JPG, PNG or WebP picture" };
  if (size > MEDIA_TYPES[kind].maxBytes) {
    return { error: kind === "video" ? `That video is too big — up to ${MAX_VIDEO_MB} MB (export it at 720p)` : "That picture is too big — up to 5 MB" };
  }
  const { data, error } = await supabaseAdmin.storage
    .from(SITE_MEDIA_BUCKET)
    .createSignedUploadUrl(`how-to-order/${crypto.randomUUID()}.${ext}`);
  if (error || !data) return { error: "Couldn't start the upload — try again" };
  const url = supabaseAdmin.storage.from(SITE_MEDIA_BUCKET).getPublicUrl(data.path).data.publicUrl;
  return { path: data.path, token: data.token, url };
}
