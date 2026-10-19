"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { resendClient, EMAIL_SITE } from "@/lib/email";
import { companyEmail } from "@/lib/company-email";
import { MAX_RECIPIENTS } from "@/lib/company-email-templates";

// Admin → Email: the company writes to people by hand — a job applicant, a
// supplier, a customer who asked for a reply — in the Thelawalaa layout.
// Everyone gets their own copy (nobody sees the other addresses); replies go
// to the reply-to address (the admin's own by default: hello@thelawalaa.com
// can't receive mail yet). Offers to customers stay in Admin → Notifications,
// which only emails people who joined offers and adds the unsubscribe link.

const FROM = "Thelawalaa <hello@thelawalaa.com>";

const draftSchema = z.object({
  subject: z.string().trim().max(150, "Keep the subject under 150 characters"),
  heading: z.string().trim().max(120, "Keep the heading under 120 characters").default(""),
  body: z.string().trim().max(5000, "Keep the message under 5,000 characters"),
  note: z.string().trim().max(600, "Keep the highlighted note under 600 characters").default(""),
  buttonLabel: z.string().trim().max(40, "Keep the button text short").default(""),
  buttonUrl: z.string().trim().max(500).default(""),
  greeting: z.boolean().default(true),
  signoff: z.enum(["team", "personal"]).default("team"),
});
type Draft = z.infer<typeof draftSchema>;

const recipientSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(80).nullable().optional(),
});

/** What makes a draft ready to send (the preview shows anything). */
function readyError(d: Draft) {
  if (!d.subject) return "Write a subject";
  if (!d.body) return "Write the message";
  if (d.buttonLabel && !d.buttonUrl) return "Add the button's link (or clear the button text)";
  if (d.buttonUrl && !/^https?:\/\/\S+$/i.test(d.buttonUrl)) return "The button link must start with https://";
  if (d.buttonUrl && !d.buttonLabel) return "Add the button's text (or clear the link)";
  return null;
}

/** The email as it will look, for the composer's preview pane. */
export async function previewCompanyEmail(input: unknown) {
  const { profile } = await requireRole(["super_admin"]);
  const parsed = z.object({ draft: draftSchema, name: z.string().max(80).nullable().optional() }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the email" };
  const { draft, name } = parsed.data;
  const mail = companyEmail({
    ...draft,
    subject: draft.subject || "(no subject yet)",
    body: draft.body || "Your message will appear here.",
    // A button without a valid link isn't shown — same as when it's sent.
    buttonUrl: /^https?:\/\/\S+$/i.test(draft.buttonUrl) ? draft.buttonUrl : "",
    name: name ?? null, sender: profile.full_name,
  });
  // The preview frame inherits this site's CSP (img-src 'self'), so the logos load from here, not www.
  return { html: mail.html.replaceAll(`${EMAIL_SITE}/images/email/`, "/images/email/"), subject: mail.subject };
}

/** Send to the people chosen — or, with `test`, only to the admin sending it. */
export async function sendCompanyEmail(input: unknown) {
  const { user, profile } = await requireRole(["super_admin"]);
  const parsed = z.object({
    draft: draftSchema,
    recipients: z.array(recipientSchema).max(MAX_RECIPIENTS * 2),
    replyTo: z.string().trim().toLowerCase().email("Check the reply-to address").or(z.literal("")).default(""),
    test: z.boolean().default(false),
  }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the email" };
  const { draft, replyTo, test } = parsed.data;
  const problem = readyError(draft);
  if (problem) return { error: problem };

  // Each address once; the test goes to the admin alone.
  const seen = new Set<string>();
  const people = (test ? [{ email: (user.email ?? "").toLowerCase(), name: profile.full_name }] : parsed.data.recipients)
    .filter((r) => r.email && !seen.has(r.email) && seen.add(r.email));
  if (!people.length) return { error: test ? "Your login has no email address to send a test to" : "Add at least one email address" };
  if (people.length > MAX_RECIPIENTS) return { error: `Up to ${MAX_RECIPIENTS} people at a time — send it in parts` };

  const resend = resendClient();
  if (!resend) return { error: "Email isn't set up — there's no Resend key (Admin → Settings → Email setup)" };

  const reply = replyTo || user.email || undefined;
  let sent = 0;
  let error: string | null = null;
  for (let i = 0; i < people.length; i += 100) {
    const batch = people.slice(i, i + 100).map((r) => {
      const mail = companyEmail({ ...draft, name: r.name ?? null, sender: profile.full_name });
      return {
        from: FROM, to: r.email, replyTo: reply,
        subject: test ? `[Test] ${mail.subject}` : mail.subject, html: mail.html, text: mail.text,
      };
    });
    const { error: sendError } = await resend.batch.send(batch);
    if (sendError) { error = sendError.message; console.error("[email] Company email not sent:", sendError.message); break; }
    sent += batch.length;
  }
  const failed = people.length - sent;

  if (!test) {
    const { data: row } = await supabaseAdmin.from("company_emails").insert({
      subject: draft.subject, heading: draft.heading || draft.subject, body: draft.body, note: draft.note || null,
      button_label: draft.buttonLabel || null, button_url: draft.buttonUrl || null, reply_to: reply ?? null,
      recipients: people.map((r) => r.email).slice(0, 200), sent_count: sent, failed_count: failed, error, sent_by: user.id,
    }).select("id").single();
    await audit({ actor_id: user.id, action: "COMPANY_EMAIL_SEND", target_table: "company_emails", target_id: row?.id ?? null,
      new_data: { subject: draft.subject, recipients: people.length, sent, failed } });
    revalidatePath("/admin/email");
  }
  if (!sent) return { error: error ? `Not sent — ${error}` : "Not sent" };
  return { ok: true, sent, failed, error };
}
