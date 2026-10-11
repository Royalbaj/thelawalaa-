"use client";
import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { getPosNotices } from "@/app/actions/notifications";
import type { PosNotice } from "@/lib/notifications";
import { REFRESH_EVENT } from "@/components/refresh-button";
import { cn } from "@/lib/utils";

const POLL_MS = 60_000;

/**
 * Messages from the manager (Admin → Notifications → POS, migration 042):
 * always on screen while the POS is open — under the header on the till and
 * on the PIN screen — until the admin removes them. No dismiss button on
 * purpose. New ones show within a minute, on Refresh, or when the app comes
 * back to the front. A long message shows two lines; tap it for the rest.
 */
export default function PosNotices({ initial }: { initial: PosNotice[] }) {
  const [notices, setNotices] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { setNotices(initial); }, [initial]);
  useEffect(() => {
    const reload = () => { if (document.visibilityState === "visible") getPosNotices().then(setNotices).catch(() => {}); };
    const poll = setInterval(reload, POLL_MS);
    window.addEventListener(REFRESH_EVENT, reload);
    document.addEventListener("visibilitychange", reload);
    return () => { clearInterval(poll); window.removeEventListener(REFRESH_EVENT, reload); document.removeEventListener("visibilitychange", reload); };
  }, []);

  if (!notices.length) return null;
  return (
    <div className="shrink-0 space-y-1 border-b border-amber-300/60 bg-amber-100 px-3 py-1.5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100" role="status" aria-label="Messages from the manager">
      {notices.map((n) => (
        <button key={n.id} onClick={() => setOpen((cur) => (cur === n.id ? null : n.id))}
          className="flex w-full touch-manipulation items-start gap-2 text-left">
          <Megaphone size={15} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
          <span className={cn("min-w-0 flex-1 text-sm leading-snug", open !== n.id && "line-clamp-2")}>
            <b>{n.title}</b>
            <span className="text-amber-900/80 dark:text-amber-200/80"> — <span className="whitespace-pre-line">{n.body}</span></span>
          </span>
        </button>
      ))}
    </div>
  );
}
