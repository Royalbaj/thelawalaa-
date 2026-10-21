"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Archive, ArchiveRestore, MailOpen } from "lucide-react";
import { markInboxRead, setInboxState } from "@/app/actions/inbox";

/** Opening an email marks it read (here, not while the page renders, so prefetching can't). */
export function MarkInboxRead({ id, unread }: { id: string; unread: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (unread) markInboxRead(id).then(() => router.refresh()).catch(() => null);
  }, [id, unread, router]);
  return null;
}

export function InboxMessageActions({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const act = (patch: { archived?: boolean; unread?: boolean }, done: string) => start(async () => {
    const r = await setInboxState({ id, ...patch });
    if (r.error) { toast.error(r.error); return; }
    toast.success(done);
    router.push(archived && patch.archived === false ? `/admin/email/inbox/${id}` : "/admin/email");
    router.refresh();
  });
  const btn = "inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-4 py-2 text-sm font-bold text-stone-700 hover:bg-stone-200 disabled:opacity-50";
  return (
    <>
      <button type="button" disabled={busy} onClick={() => act({ unread: true }, "Marked unread")} className={btn}><MailOpen size={15} /> Mark unread</button>
      {archived
        ? <button type="button" disabled={busy} onClick={() => act({ archived: false }, "Moved back to the inbox")} className={btn}><ArchiveRestore size={15} /> Move to inbox</button>
        : <button type="button" disabled={busy} onClick={() => act({ archived: true }, "Archived")} className={btn}><Archive size={15} /> Archive</button>}
    </>
  );
}
