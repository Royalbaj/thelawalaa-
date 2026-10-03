"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { resendClient, EMAIL_SITE } from "@/lib/email";
import { offerNoticeEmail } from "@/lib/account-emails";
import { unsubscribeToken } from "@/lib/signed-links";
import { pushToDrivers } from "@/lib/push";

// Admin → Notifications. Customers only ever get these if they joined offers
// (profiles.marketing_opt_in); drivers get theirs in the driver portal.

const linkSchema = z.string().trim().max(300)
  .refine((v) => v === "" || /^\/[A-Za-z0-9/_\-?=&#.%]*$/.test(v) || /^https:\/\/[^\s]+$/.test(v), "Links must start with / (a page on this site) or https://")
  .optional();

const noticeSchema = z.object({
  audience: z.enum(["customers", "drivers"]),
  title: z.string().trim().min(2, "Add a title").max(80, "Keep the title under 80 characters"),
  body: z.string().trim().min(2, "Write the message").max(500, "Keep the message under 500 characters"),
  link_url: linkSchema,
  email: z.boolean().default(false),
  push: z.boolean().default(false),
});

const absolute = (link: string | null) => (link ? (link.startsWith("/") ? `${EMAIL_SITE}${link}` : link) : null);

/** Every opted-in, active customer with a confirmed email. */
async function optedInCustomers() {
  const { data: profiles } = await supabaseAdmin.from("profiles")
    .select("id, full_name").eq("role", "customer").eq("is_active", true).eq("marketing_opt_in", true);
  const wanted = new Map((profiles ?? []).map((p) => [p.id, p.full_name as string]));
  const out: { id: string; name: string; email: string }[] = [];
  for (let page = 1; wanted.size > out.length && page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data.users.length) break;
    for (const u of data.users) {
      if (u.email && u.email_confirmed_at && wanted.has(u.id)) out.push({ id: u.id, name: wanted.get(u.id)!, email: u.email });
    }
    if (data.users.length < 1000) break;
  }
  return out;
}

export async function sendNotification(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = noticeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the message" };
  const d = parsed.data;
  const link = d.link_url || null;

  const { data: notice, error } = await supabaseAdmin.from("notifications")
    .insert({ audience: d.audience, title: d.title, body: d.body, link_url: link, sent_by: user.id })
    .select("id").single();
  if (error || !notice) return { error: "Couldn't save the message — try again" };

  let emailed = 0;
  let pushed = 0;
  let emailProblem: string | null = null;

  if (d.audience === "customers" && d.email) {
    const resend = resendClient();
    if (!resend) emailProblem = "Email isn't set up (no Resend key)";
    else {
      const people = await optedInCustomers();
      for (let i = 0; i < people.length; i += 100) {
        const batch = people.slice(i, i + 100).map((c) => {
          const unsubscribeUrl = `${EMAIL_SITE}/unsubscribe?u=${c.id}&t=${unsubscribeToken(c.id)}`;
          const mail = offerNoticeEmail({ name: c.name, title: d.title, body: d.body, url: absolute(link), unsubscribeUrl });
          return {
            from: "Thelawalaa <hello@thelawalaa.com>", replyTo: "hello@thelawalaa.com", to: c.email,
            subject: mail.subject, html: mail.html, text: mail.text,
            headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
          };
        });
        const { error: sendError } = await resend.batch.send(batch);
        if (sendError) { emailProblem = sendError.message; console.error("[email] Offers batch not sent:", sendError.message); break; }
        emailed += batch.length;
      }
    }
  }

  if (d.audience === "drivers" && d.push) {
    const r = await pushToDrivers({ title: d.title, body: d.body, tag: `notice-${notice.id}`, url: "/delivery/updates" });
    pushed = r.sent;
  }

  await supabaseAdmin.from("notifications").update({ emailed, pushed }).eq("id", notice.id);
  await audit({ actor_id: user.id, action: "SEND_NOTIFICATION", target_table: "notifications", target_id: notice.id, new_data: { audience: d.audience, title: d.title, emailed, pushed } });
  revalidatePath("/admin/notifications");
  return { ok: true, emailed, pushed, emailProblem };
}

export async function deleteNotification(id: string) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Not found" };
  await supabaseAdmin.from("notifications").delete().eq("id", id);
  await audit({ actor_id: user.id, action: "DELETE_NOTIFICATION", target_table: "notifications", target_id: id });
  revalidatePath("/admin/notifications");
  return { ok: true };
}

/** Opening the inbox marks everything in it as read. */
export async function markNotificationsSeen() {
  const { user } = await requireRole(["customer", "delivery_driver"]);
  await supabaseAdmin.from("profiles").update({ notifications_seen_at: new Date().toISOString() }).eq("id", user.id);
  revalidatePath("/account", "layout");
  revalidatePath("/delivery");
  return { ok: true };
}
