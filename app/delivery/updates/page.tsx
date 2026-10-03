import Link from "next/link";
import { Megaphone } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { getInbox } from "@/lib/notifications";
import MarkSeen from "@/components/mark-seen";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

export default async function UpdatesPage() {
  const { user, profile } = await requireRole(["delivery_driver", "super_admin"]);
  const inbox = await getInbox(user.id, "drivers");
  return (
    <div className="space-y-4">
      <MarkSeen when={profile.role === "delivery_driver" && inbox.unread > 0} />
      <div>
        <h1 className="font-display text-2xl font-extrabold">Updates</h1>
        <p className="text-sm text-white/50">Messages from the shop.</p>
      </div>
      {inbox.items.length === 0 ? (
        <div className="rounded-3xl bg-white/[0.04] px-6 py-12 text-center ring-1 ring-white/10">
          <Megaphone size={32} className="mx-auto mb-3 text-white/30" />
          <p className="font-bold text-white/80">No messages</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {inbox.items.map((n, i) => (
            <li key={n.id} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold text-white">{n.title}</p>
                {i < inbox.unread && <span className="shrink-0 rounded-full bg-brand-orange px-2 py-0.5 text-[10px] font-extrabold uppercase">New</span>}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-white/70">{n.body}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-white/40">
                <span>{when(n.created_at)}</span>
                {n.link_url && <Link href={n.link_url} className="font-bold text-orange-300">Open →</Link>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
