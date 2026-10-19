import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import EmailComposer, { type Recipient, type RecipientGroup } from "@/components/admin/email-composer";
import { npDateTime } from "@/lib/nepal-time";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@<>(),;]+@[^\s@<>(),;]+\.[^\s@<>(),;]+$/;
const STAFF_ROLES = ["super_admin", "pos_user", "delivery_driver", "accountant"];

/** Sign-in emails for these profile ids (they live in Supabase Auth, not in profiles). */
async function authEmails(ids: Set<string>) {
  const out = new Map<string, string>();
  for (let page = 1; ids.size && page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data.users.length) break;
    for (const u of data.users) if (u.email && ids.has(u.id)) out.set(u.id, u.email.toLowerCase());
    if (data.users.length < 1000) break;
  }
  return out;
}

/**
 * Admin → Email: write to people in the Thelawalaa email layout. Quick-add
 * groups are the people the business is already talking to — job applicants,
 * customers who asked for a reply in feedback, the team. Offers to customers
 * go through Admin → Notifications (consent + unsubscribe link).
 */
export default async function EmailPage() {
  const { user, profile } = await requireRole(["super_admin"]);
  const [{ data: applicants }, { data: replies }, { data: staff }, { data: history }] = await Promise.all([
    supabaseAdmin.from("job_applications").select("name, email, position, status").not("email", "is", null)
      .in("status", ["new", "shortlisted", "interview"]).order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("feedback").select("name, contact").eq("wants_reply", true).order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("profiles").select("id, full_name").in("role", STAFF_ROLES).eq("is_active", true),
    supabaseAdmin.from("company_emails").select("id, subject, recipients, sent_count, failed_count, error, created_at, sender:profiles!company_emails_sent_by_fkey(full_name)")
      .order("created_at", { ascending: false }).limit(30),
  ]);

  const staffEmails = await authEmails(new Set((staff ?? []).map((s) => s.id)));
  const groups: RecipientGroup[] = [
    {
      id: "applicants", label: "Job applicants", hint: "People who applied on the careers page (still in the running) and gave an email",
      people: (applicants ?? []).filter((a) => a.email && EMAIL.test(a.email)).map((a) => ({ email: a.email!.toLowerCase(), name: a.name })),
    },
    {
      id: "feedback", label: "Feedback — wants a reply", hint: "Customers who ticked \"Please get back to me\" and left an email",
      people: (replies ?? []).filter((f) => f.contact && EMAIL.test(f.contact.trim())).map((f) => ({ email: f.contact!.trim().toLowerCase(), name: f.name })),
    },
    {
      id: "staff", label: "Our team", hint: "Everyone with a staff login",
      people: (staff ?? []).flatMap((s): Recipient[] => staffEmails.has(s.id) ? [{ email: staffEmails.get(s.id)!, name: s.full_name }] : []),
    },
  ].filter((g) => g.people.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-brand-brown">Email</h1>
        <p className="text-sm text-stone-500">
          Write to anyone in the Thelawalaa email layout — an applicant, a supplier, a customer. To send offers to every customer
          who joined them, use <a href="/admin/notifications" className="font-bold text-brand-orange">Notifications</a>.
        </p>
      </div>

      <EmailComposer groups={groups} me={{ name: profile.full_name, email: user.email ?? "" }} />

      <section className="card overflow-hidden">
        <h2 className="px-5 pt-5 font-bold text-brand-brown">Sent</h2>
        <ul className="mt-2 divide-y divide-stone-100">
          {(history ?? []).map((h) => {
            const sender = (h.sender as unknown as { full_name: string } | null)?.full_name;
            return (
              <li key={h.id} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-bold text-stone-900">{h.subject}</p>
                  <span className="text-xs text-stone-400">{npDateTime(h.created_at)}{sender ? ` · ${sender}` : ""}</span>
                </div>
                <p className="text-xs text-stone-500">
                  Sent to {h.sent_count} {h.sent_count === 1 ? "person" : "people"}
                  {h.failed_count ? <span className="font-bold text-brand-red"> · {h.failed_count} not sent{h.error ? ` (${h.error})` : ""}</span> : null}
                  {" · "}<span className="text-stone-400">{(h.recipients as string[]).slice(0, 4).join(", ")}{(h.recipients as string[]).length > 4 ? ` +${(h.recipients as string[]).length - 4} more` : ""}</span>
                </p>
              </li>
            );
          })}
          {(history ?? []).length === 0 && <li className="px-5 py-8 text-center text-sm text-stone-400">Nothing sent yet.</li>}
        </ul>
      </section>
    </div>
  );
}
