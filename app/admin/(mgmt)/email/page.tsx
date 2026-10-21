import Link from "next/link";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import EmailComposer, { type Recipient, type RecipientGroup, type ReplyTo } from "@/components/admin/email-composer";
import { InboxForward, InboxSetup } from "@/components/admin/inbox-setup";
import InboxList from "@/components/admin/inbox-list";
import { receivingStatus } from "@/app/actions/inbox";
import { inboxSettings, syncInbox } from "@/lib/inbox";
import { npDateTime } from "@/lib/nepal-time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@<>(),;]+@[^\s@<>(),;]+\.[^\s@<>(),;]+$/;
const STAFF_ROLES = ["super_admin", "pos_user", "delivery_driver", "accountant"];
const UUID = /^[0-9a-f-]{36}$/;

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
 * Admin → Email: the Inbox (everything sent to an @thelawalaa.com address —
 * replies to our emails included), Write (an email in the Thelawalaa layout:
 * applicants, suppliers, a customer who asked for a reply, or an answer to an
 * inbox email) and Sent. Offers to customers go through Admin → Notifications
 * (consent + unsubscribe link).
 */
export default async function EmailPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user, profile } = await requireRole(["super_admin"]);
  const sp = await searchParams;
  const replyId = sp.reply && UUID.test(sp.reply) ? sp.reply : null;
  // Sent → "Write to them again": one earlier send's people, or "all" of them.
  const again = sp.again === "all" || (sp.again && UUID.test(sp.again)) ? sp.again : null;
  const tab = replyId || again || sp.tab === "write" ? "write" : sp.tab === "sent" ? "sent" : "inbox";

  const { count: unread } = await supabaseAdmin.from("inbox_emails").select("id", { count: "exact", head: true })
    .is("read_at", null).is("archived_at", null);
  const tabs = [
    { id: "inbox", label: "Inbox", href: "/admin/email", count: unread ?? 0 },
    { id: "write", label: "Write", href: "/admin/email?tab=write", count: 0 },
    { id: "sent", label: "Sent", href: "/admin/email?tab=sent", count: 0 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-brand-brown">Email</h1>
          <p className="text-sm text-stone-500">
            Email to and from @thelawalaa.com, in the Thelawalaa layout. To send offers to every customer who joined
            them, use <a href="/admin/notifications" className="font-bold text-brand-orange">Notifications</a>.
          </p>
        </div>
        <nav className="flex rounded-full bg-stone-100 p-1" aria-label="Email">
          {tabs.map((t) => (
            <Link key={t.id} href={t.href} aria-current={tab === t.id ? "page" : undefined}
              className={cn("flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition",
                tab === t.id ? "bg-white text-brand-brown shadow-sm" : "text-stone-500 hover:text-stone-800")}>
              {t.label}
              {t.count > 0 && <span className="rounded-full bg-brand-red px-1.5 text-[10px] font-extrabold text-white">{t.count}</span>}
            </Link>
          ))}
        </nav>
      </div>

      {tab === "inbox" && <Inbox archived={sp.box === "archived"} />}
      {tab === "write" && <Write replyId={replyId} again={again} starter={sp.starter} me={{ name: profile.full_name, email: user.email ?? "" }} />}
      {tab === "sent" && <Sent />}
    </div>
  );
}

async function Inbox({ archived }: { archived: boolean }) {
  const status = await receivingStatus();
  // The webhook brings new email straight in; this catches anything it missed.
  if (status.state === "on") await syncInbox();
  let q = supabaseAdmin.from("inbox_emails")
    .select("id, from_email, from_name, to_emails, subject, snippet, attachments, received_at, read_at, replied_at")
    .order("received_at", { ascending: false }).limit(100);
  q = archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
  const [{ data: mails }, settings] = await Promise.all([q, inboxSettings()]);

  return (
    <div className="space-y-4">
      <InboxSetup status={status} forwardTo={settings.forward_to} />

      <InboxList mails={mails ?? []} archived={archived} receiving={status.state === "on"} />

      {status.state === "on" && status.webhook && settings.forward_to && (
        <section className="card p-4 sm:p-5"><InboxForward current={settings.forward_to} /></section>
      )}
    </div>
  );
}

async function Write({ replyId, again, starter, me }: { replyId: string | null; again: string | null; starter?: string; me: { name: string; email: string } }) {
  const [{ data: applicants }, { data: replies }, { data: staff }, { data: answering }, { data: earlier }] = await Promise.all([
    supabaseAdmin.from("job_applications").select("name, email, position, status").not("email", "is", null)
      .in("status", ["new", "shortlisted", "interview"]).order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("feedback").select("name, contact").eq("wants_reply", true).order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("profiles").select("id, full_name").in("role", STAFF_ROLES).eq("is_active", true),
    replyId
      ? supabaseAdmin.from("inbox_emails").select("id, from_email, from_name, reply_to, subject, snippet, text_body, received_at").eq("id", replyId).maybeSingle()
      : Promise.resolve({ data: null }),
    again
      ? (again === "all"
        ? supabaseAdmin.from("company_emails").select("recipients").order("created_at", { ascending: false }).limit(200)
        : supabaseAdmin.from("company_emails").select("recipients").eq("id", again))
      : Promise.resolve({ data: null }),
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

  const reply: ReplyTo | null = answering ? {
    inboxId: answering.id,
    to: { email: answering.reply_to || answering.from_email, name: answering.from_name },
    subject: answering.subject,
    quote: (answering.text_body ?? answering.snippet ?? "").split(/\r?\n/).filter((l: string) => !/^\s*>/.test(l)).join("\n").trim().slice(0, 1200),
    when: `${answering.from_name ?? answering.from_email} wrote on ${npDateTime(answering.received_at)}`,
  } : null;

  // Everyone from those sends, once each, with a name when we know it (applicants, feedback, team).
  const known = new Map(groups.flatMap((g) => g.people).filter((p) => p.name).map((p) => [p.email, p.name]));
  const initialTo: Recipient[] = [...new Set((earlier ?? []).flatMap((e) => e.recipients as string[]))]
    .map((email) => ({ email, name: known.get(email) ?? null }));

  return <EmailComposer key={reply?.inboxId ?? again ?? "new"} groups={groups} me={me} reply={reply}
    initialTo={initialTo} initialStarter={again ? (starter ?? "again") : starter} />;
}

async function Sent() {
  const { data: history } = await supabaseAdmin.from("company_emails")
    .select("id, subject, recipients, sent_count, failed_count, error, created_at, sender:profiles!company_emails_sent_by_fkey(full_name)")
    .order("created_at", { ascending: false }).limit(50);
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
        <h2 className="font-bold text-brand-brown">Sent</h2>
        {(history ?? []).length > 0 && (
          <Link href="/admin/email?again=all" className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-brand-orange ring-1 ring-orange-100 hover:bg-orange-100">
            Ask everyone to reply again
          </Link>
        )}
      </div>
      <ul className="mt-2 divide-y divide-stone-100">
        {(history ?? []).map((h) => {
          const sender = (h.sender as unknown as { full_name: string } | null)?.full_name;
          const to = h.recipients as string[];
          return (
            <li key={h.id} className="px-5 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold text-stone-900">{h.subject}</p>
                <span className="text-xs text-stone-400">{npDateTime(h.created_at)}{sender ? ` · ${sender}` : ""}</span>
              </div>
              <Link href={`/admin/email?again=${h.id}&starter=blank`} className="float-right ml-3 text-xs font-bold text-brand-orange hover:underline">Write to them again</Link>
              <p className="text-xs text-stone-500">
                Sent to {h.sent_count} {h.sent_count === 1 ? "person" : "people"}
                {h.failed_count ? <span className="font-bold text-brand-red"> · {h.failed_count} not sent{h.error ? ` (${h.error})` : ""}</span> : null}
                {" · "}<span className="text-stone-400">{to.slice(0, 4).join(", ")}{to.length > 4 ? ` +${to.length - 4} more` : ""}</span>
              </p>
            </li>
          );
        })}
        {(history ?? []).length === 0 && <li className="px-5 py-8 text-center text-sm text-stone-400">Nothing sent yet.</li>}
      </ul>
    </section>
  );
}
