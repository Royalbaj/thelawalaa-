import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Paperclip, Reply } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { inboxBody, type InboxRow } from "@/lib/inbox";
import { InboxMessageActions, MarkInboxRead } from "@/components/admin/inbox-message-actions";
import { npDateTime } from "@/lib/nepal-time";

export const dynamic = "force-dynamic";

const size = (b: number) => (b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * One received email. Its HTML is shown in a sandboxed frame — no scripts, no
 * access to this page — that inherits the site's CSP, so pictures from other
 * websites (tracking pixels included) don't load; pictures inside the email do.
 */
export default async function InboxEmailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super_admin"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data } = await supabaseAdmin.from("inbox_emails").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const mail = data as InboxRow;
  const body = await inboxBody(mail);
  const files = mail.attachments.filter((a) => !a.inline);
  const srcDoc = body.html
    ? `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><meta name="referrer" content="no-referrer">
<style>body{margin:16px;font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1c1917;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${body.html}</body></html>`
    : null;

  return (
    <div className="space-y-4">
      <MarkInboxRead id={mail.id} unread={!mail.read_at} />
      <Link href={mail.archived_at ? "/admin/email?box=archived" : "/admin/email"} className="inline-flex items-center gap-1.5 text-sm font-bold text-stone-500 hover:text-brand-orange">
        <ArrowLeft size={15} /> {mail.archived_at ? "Archived" : "Inbox"}
      </Link>

      <section className="card overflow-hidden">
        <div className="space-y-3 border-b border-stone-100 p-4 sm:p-5">
          <h1 className="font-display text-xl font-bold text-stone-900">{mail.subject || "(no subject)"}</h1>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 text-sm">
              <p className="truncate"><b className="text-stone-900">{mail.from_name || mail.from_email}</b>{mail.from_name && <span className="text-stone-500"> &lt;{mail.from_email}&gt;</span>}</p>
              <p className="truncate text-xs text-stone-500">To {mail.to_emails.join(", ")}{mail.cc.length ? ` · Cc ${mail.cc.join(", ")}` : ""}</p>
              {mail.reply_to && <p className="truncate text-xs text-stone-500">Replies go to {mail.reply_to}</p>}
            </div>
            <p className="shrink-0 text-xs text-stone-400">{npDateTime(mail.received_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/email?reply=${mail.id}`} className="btn-primary px-5 py-2 text-sm"><Reply size={15} /> Reply</Link>
            <InboxMessageActions id={mail.id} archived={!!mail.archived_at} />
          </div>
          {(mail.replied_at || mail.forwarded_to) && (
            <p className="text-xs text-stone-400">
              {mail.replied_at && <>Replied {npDateTime(mail.replied_at)}. </>}
              {mail.forwarded_to && <>A copy went to {mail.forwarded_to}.</>}
            </p>
          )}
        </div>

        {srcDoc ? (
          // allow-popups: links open in a new tab; no allow-scripts / allow-same-origin.
          <iframe title="Email" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={srcDoc} className="block h-[70vh] min-h-[420px] w-full bg-white" />
        ) : (
          <div className="whitespace-pre-wrap break-words p-4 text-[15px] leading-relaxed text-stone-800 sm:p-5">{body.text || "(This email has no text.)"}</div>
        )}

        {files.length > 0 && (
          <div className="border-t border-stone-100 p-4 sm:p-5">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">Attachments</p>
            <ul className="flex flex-wrap gap-2">
              {files.map((f) => (
                <li key={f.id}>
                  <a href={`/admin/email/inbox/${mail.id}/file/${f.id}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm font-bold text-stone-700 ring-1 ring-stone-200 hover:text-brand-orange">
                    <Paperclip size={14} /> <span className="max-w-[16rem] truncate">{f.filename || "Attachment"}</span>
                    <span className="text-xs font-normal text-stone-400">{size(f.size)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
