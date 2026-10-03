import Link from "next/link";
import { BellOff, Megaphone } from "lucide-react";
import { getVerifiedUser } from "@/lib/supabase/server";
import { getInbox } from "@/lib/notifications";
import { OffersJoinCard } from "@/components/account/offers-join";
import MarkSeen from "@/components/mark-seen";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

export default async function NotificationsPage() {
  const { profile } = await getVerifiedUser();
  if (!profile) return null;
  const inbox = profile.role === "customer" ? await getInbox(profile.id, "customers") : { items: [], unread: 0, joined: false };

  return (
    <div className="space-y-5 pb-4">
      <MarkSeen when={inbox.unread > 0} />
      <div>
        <h1 className="font-display text-2xl font-extrabold text-brand-brown">Inbox</h1>
        <p className="text-sm text-stone-500">New offers, competitions and news from Thelawalaa.</p>
      </div>

      {!inbox.joined ? (
        <>
          <OffersJoinCard joined={false} />
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-stone-100">
            <BellOff size={30} className="mx-auto mb-2 text-stone-300" />
            <p className="font-bold text-stone-600">You haven&apos;t joined offers</p>
            <p className="mt-1 text-sm text-stone-500">We only send offers to people who ask for them. Join above to see them here.</p>
          </div>
        </>
      ) : inbox.items.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-stone-100">
          <Megaphone size={30} className="mx-auto mb-2 text-stone-300" />
          <p className="font-bold text-stone-600">Nothing new yet</p>
          <p className="mt-1 text-sm text-stone-500">You&apos;re in — new offers and competitions will show up here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {inbox.items.map((n, i) => (
            <li key={n.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold text-brand-brown">{n.title}</p>
                {i < inbox.unread && <span className="shrink-0 rounded-full bg-brand-orange px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">New</span>}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-stone-600">{n.body}</p>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                <span className="text-stone-400">{when(n.created_at)}</span>
                {n.link_url && (
                  <Link href={n.link_url} className="font-bold text-brand-orange" {...(n.link_url.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>Open →</Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-center text-xs text-stone-400">Offers can change or end at any time without notice. <Link href="/terms#offers" className="font-bold">Terms</Link></p>
    </div>
  );
}
