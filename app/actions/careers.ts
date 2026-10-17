"use server";

import { z } from "zod";
import { randomUUID, createHmac } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { throttled, clientIp } from "@/lib/throttle";
import { phoneNP } from "@/lib/validations/auth";
import { nepalToday } from "@/lib/dates";
import { APPLICATION_STATUS, AVAILABILITY, CV_PATH, CV_TYPES, EXPERIENCE, JOB_TYPES, MAX_CV_MB } from "@/lib/careers";

// Careers. /careers is public, so applyForJob and createCvUpload are mutations
// without requireRole (like submitFeedback): Zod-checked, a honeypot, and
// rate-limited in the database by a keyed hash of the IP (lib/throttle.ts).
// CVs go into the PRIVATE "cvs" bucket through a one-time signed upload URL;
// only the admin ever opens one (a 2-minute link, /admin/careers/cv/[id]).
const CVS = "cvs";
const refreshPublic = () => { revalidatePath("/careers"); revalidatePath("/admin/careers"); };
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

// ── Public: send a CV ────────────────────────────────────────────
export async function createCvUpload(input: unknown) {
  const parsed = z.object({ type: z.string().max(120), size: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { error: "Choose your CV file" };
  const ext = CV_TYPES[parsed.data.type];
  if (!ext) return { error: "Send your CV as a PDF, Word file or a photo" };
  if (parsed.data.size > MAX_CV_MB * 1024 * 1024) return { error: `That file is too big — up to ${MAX_CV_MB} MB` };
  if (await throttled("cv-upload", [await clientIp()], 8, 60)) return { error: "Too many tries — please wait a little and try again" };
  const now = new Date();
  const path = `${CVS}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from(CVS).createSignedUploadUrl(path.slice(CVS.length + 1));
  if (error || !data) return { error: "Couldn't start the upload — try again" };
  return { path, uploadPath: data.path, token: data.token };
}

const applySchema = z.object({
  listing_id: z.preprocess(blank, z.string().uuid().optional()),
  position: z.preprocess(blank, z.string().trim().min(2, "Say which job you'd like").max(80).optional()),
  name: z.string().trim().min(2, "Type your name").max(80, "Keep your name under 80 characters"),
  phone: z.string().trim().transform((v) => v.replace(/[\s-]/g, "")).pipe(phoneNP),
  email: z.preprocess(blank, z.string().trim().email("Check your email address").max(120).optional()),
  experience: z.preprocess(blank, z.enum(EXPERIENCE).optional()),
  availability: z.preprocess(blank, z.enum(AVAILABILITY).optional()),
  message: z.preprocess(blank, z.string().trim().max(2000, "Keep it under 2,000 characters").optional()),
  cv_path: z.preprocess(blank, z.string().regex(CV_PATH).optional()),
  cv_name: z.preprocess(blank, z.string().trim().max(120).optional()),
  website: z.string().optional(), // honeypot
});

function ipHash(ip: string) {
  const key = process.env.OTP_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "local-dev";
  return createHmac("sha256", `careers|${key}`).update(ip).digest("hex").slice(0, 32);
}

export async function applyForJob(input: unknown) {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  const { website, ...d } = parsed.data;
  if (website) return { ok: true }; // a bot filled the hidden field — pretend it worked

  const ip = await clientIp();
  if (await throttled("job-apply", [ip, d.phone], 3, 60)) return { error: "We've got your application — no need to send it again." };

  // A listing must still be open; without one, it's a CV on file for any job.
  let position = d.position ?? null;
  if (d.listing_id) {
    const { data: job } = await supabaseAdmin.from("job_listings").select("id, title, is_open, closes_on").eq("id", d.listing_id).maybeSingle();
    if (!job?.is_open || (job.closes_on && job.closes_on < nepalToday())) return { error: "That job has just closed — you can still send your CV for any role." };
    position = job.title;
  }
  if (!position) return { error: "Say which job you'd like" };

  // The CV must be one this page uploaded (its path is ours, and it's really there).
  if (d.cv_path) {
    const dir = d.cv_path.slice(CVS.length + 1).split("/").slice(0, 2).join("/");
    const file = d.cv_path.split("/").pop()!;
    const { data: found } = await supabaseAdmin.storage.from(CVS).list(dir, { search: file, limit: 1 });
    if (!found?.some((f) => f.name === file)) return { error: "Your CV didn't finish uploading — please attach it again" };
  }

  const { error } = await supabaseAdmin.from("job_applications").insert({
    listing_id: d.listing_id ?? null, position, name: d.name, phone: d.phone, email: d.email ?? null,
    experience: d.experience ?? null, availability: d.availability ?? null, message: d.message ?? null,
    cv_path: d.cv_path ?? null, cv_name: d.cv_name ?? null, ip_hash: ipHash(ip),
  });
  if (error) return { error: "Couldn't send it — please try again" };
  revalidatePath("/admin/careers");
  revalidatePath("/admin", "layout"); // the menu's "new applications" count
  return { ok: true };
}

// ── Admin: job listings ──────────────────────────────────────────
const listingSchema = z.object({
  title: z.string().trim().min(2, "Give the job a title").max(80),
  job_type: z.enum(Object.keys(JOB_TYPES) as [keyof typeof JOB_TYPES, ...(keyof typeof JOB_TYPES)[]]),
  description: z.preprocess(blank, z.string().trim().max(3000).optional()),
  requirements: z.preprocess(blank, z.string().trim().max(2000).optional()),
  pay: z.preprocess(blank, z.string().trim().max(80).optional()),
  openings: z.coerce.number().int().min(1).max(50),
  closes_on: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a closing date").optional()),
  is_open: z.boolean(),
});

export async function saveJobListing(id: string | null, input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  if (id !== null && !z.string().uuid().safeParse(id).success) return { error: "Bad job" };
  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const row = {
    ...parsed.data, description: parsed.data.description ?? null, requirements: parsed.data.requirements ?? null,
    pay: parsed.data.pay ?? null, closes_on: parsed.data.closes_on ?? null, updated_at: new Date().toISOString(),
  };
  const { data, error } = id === null
    ? await supabaseAdmin.from("job_listings").insert({ ...row, created_by: user.id }).select("id").single()
    : await supabaseAdmin.from("job_listings").update(row).eq("id", id).select("id").single();
  if (error || !data) return { error: "Couldn't save the job" };
  await audit({ actor_id: user.id, action: id === null ? "JOB_LISTING_ADD" : "JOB_LISTING_EDIT", target_table: "job_listings", target_id: data.id, new_data: row });
  refreshPublic();
  return { ok: true, id: data.id };
}

export async function deleteJobListing(id: string) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad job" };
  // Applications stay (their position is copied); they just lose the link.
  const { error } = await supabaseAdmin.from("job_listings").delete().eq("id", id);
  if (error) return { error: "Couldn't delete the job" };
  await audit({ actor_id: user.id, action: "JOB_LISTING_DELETE", target_table: "job_listings", target_id: id });
  refreshPublic();
  return { ok: true };
}

// ── Admin: applications ──────────────────────────────────────────
const statusKeys = Object.keys(APPLICATION_STATUS) as [keyof typeof APPLICATION_STATUS, ...(keyof typeof APPLICATION_STATUS)[]];

export async function updateApplication(id: string, input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad application" };
  const parsed = z.object({
    status: z.enum(statusKeys).optional(),
    admin_note: z.string().trim().max(1000, "Keep the note under 1,000 characters").optional(),
  }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const patch = { ...parsed.data, ...(parsed.data.admin_note !== undefined ? { admin_note: parsed.data.admin_note || null } : {}), updated_at: new Date().toISOString() };
  const { error } = await supabaseAdmin.from("job_applications").update(patch).eq("id", id);
  if (error) return { error: "Couldn't save" };
  await audit({ actor_id: user.id, action: "JOB_APPLICATION_EDIT", target_table: "job_applications", target_id: id, new_data: parsed.data });
  revalidatePath("/admin/careers");
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function deleteApplication(id: string) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad application" };
  const { data: old } = await supabaseAdmin.from("job_applications").select("name, position, cv_path").eq("id", id).maybeSingle();
  if (!old) return { ok: true };
  const { error } = await supabaseAdmin.from("job_applications").delete().eq("id", id);
  if (error) return { error: "Couldn't delete it" };
  if (old.cv_path) await supabaseAdmin.storage.from(CVS).remove([old.cv_path.slice(CVS.length + 1)]);
  await audit({ actor_id: user.id, action: "JOB_APPLICATION_DELETE", target_table: "job_applications", target_id: id, old_data: { name: old.name, position: old.position } });
  revalidatePath("/admin/careers");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
