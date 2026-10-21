import Link from "next/link";
import { Paperclip, Reply } from "lucide-react";
import type { InboxAttachment, InboxRow } from "@/lib/inbox";
import { npDayMonthTime } from "@/lib/nepal-time";
import { cn } from "@/lib/utils";

export type InboxListItem = Pick<InboxRow, "id" | "from_email" | "from_name" | "to_emails" | "subject" | "snippet" | "received_at" | "read_at" | "replied_at"> & { attachments: unknown };

/** Admin → Email → Inbox: newest first, unread in bold with an orange dot. */
export default function InboxList({ mails, archived, receiving }: { mails: InboxListItem[]; archived: boolean; receiving: boolean }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3 sm:px-5">
        <h2 className="font-bold text-brand-brown">{archived ? "Archived" : "Inbox"}</h2>
        <Link href={archived ? "/admin/email" : "/admin/email?box=archived"} className="text-xs font-bold text-stone-500 hover:text-brand-orange">
          {archived ? "Back to the inbox" : "Archived"}
        </Link>
      </div>
      <ul className="divide-y divide-stone-100">
        {mails.map((m) => {
          const isNew = !m.read_at;
          const files = (m.attachments as InboxAttachment[]).filter((a) => !a.inline).length;
          const ours = (m.to_emails as string[]).filter((t) => /@thelawalaa\.com>?$/i.test(t))[0];
          return (
            <li key={m.id}>
              <Link href={`/admin/email/inbox/${m.id}`} className="flex gap-3 px-4 py-3 transition hover:bg-orange-50/50 sm:px-5">
                <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", isNew ? "bg-brand-orange" : "bg-transparent")} aria-label={isNew ? "New" : undefined} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={cn("truncate text-sm", isNew ? "font-extrabold text-stone-900" : "font-semibold text-stone-700")}>{m.from_name || m.from_email}</p>
                    <span className="shrink-0 text-xs text-stone-400">{npDayMonthTime(m.received_at)}</span>
                  </div>
                  <p className={cn("truncate text-sm", isNew ? "font-bold text-stone-900" : "text-stone-700")}>{m.subject || "(no subject)"}</p>
                  <p className="flex items-center gap-2 text-xs text-stone-400">
                    {m.replied_at && <span className="flex shrink-0 items-center gap-0.5 font-bold text-green-700"><Reply size={12} /> Replied</span>}
                    {files > 0 && <span className="flex shrink-0 items-center gap-0.5"><Paperclip size={12} /> {files}</span>}
                    <span className="truncate">{m.snippet}</span>
                    {ours && <span className="ml-auto hidden shrink-0 rounded-full bg-stone-100 px-2 py-0.5 font-bold text-stone-500 sm:inline">to {ours.replace(/^.*</, "").replace(/>$/, "")}</span>}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
        {mails.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-stone-400">
            {archived ? "Nothing archived." : receiving ? "No email yet. Replies to our emails will show up here." : "Turn on receiving above and replies will show up here."}
          </li>
        )}
      </ul>
    </section>
  );
}
