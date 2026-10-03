"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { setDriverOnline } from "@/app/actions/delivery";
import { cn } from "@/lib/utils";

/** Online = the shop can give you deliveries. */
export default function OnlineToggle({ online: initial }: { online: boolean }) {
  const router = useRouter();
  const [online, setOnline] = useState(initial);
  const [pending, start] = useTransition();
  const flip = () => start(async () => {
    const r = await setDriverOnline(!online).catch(() => ({ ok: false }));
    if (!r.ok) { toast.error("Couldn't change — try again"); return; }
    setOnline(!online);
    toast.success(!online ? "You're online — deliveries can come to you" : "You're offline");
    router.refresh();
  });
  return (
    <button onClick={flip} disabled={pending} role="switch" aria-checked={online}
      className={cn("flex w-full items-center justify-between gap-4 rounded-3xl p-4 text-left ring-1 transition active:scale-[0.99]",
        online ? "bg-green-500/15 ring-green-400/30" : "bg-white/[0.06] ring-white/10")}>
      <span>
        <span className={cn("flex items-center gap-2 text-base font-extrabold", online ? "text-green-300" : "text-white/80")}>
          <span className={cn("h-2.5 w-2.5 rounded-full", online ? "animate-pulse bg-green-400" : "bg-white/30")} />
          {online ? "You're online" : "You're offline"}
        </span>
        <span className="mt-0.5 block text-xs text-white/50">{online ? "The shop can give you deliveries. Tap to go offline." : "Tap to go online and start getting deliveries."}</span>
      </span>
      <span className={cn("relative h-8 w-14 shrink-0 rounded-full transition", online ? "bg-green-500" : "bg-white/20")}>
        <span className={cn("absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all", online ? "left-7" : "left-1")} />
      </span>
    </button>
  );
}
