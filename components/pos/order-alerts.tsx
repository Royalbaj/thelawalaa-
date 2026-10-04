"use client";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Bell, BellOff, BellRing, X, Volume2, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { unlockOrderSound, orderSoundReady } from "@/lib/order-sound";
import { sendTestPush } from "@/app/actions/push";
import { currentPushState, enablePush as subscribeThisDevice, type PushState } from "@/lib/push-client";

// Order alerts for the POS device:
//  1. Sound on this screen — needs one tap after loading (iPad rule).
//  2. Push notifications (with the system sound) when the POS is closed or
//     the iPad is asleep. On iPad/iPhone that only works for a web app added
//     to the Home Screen (iPadOS 16.4+), so outside one we explain how.
export default function OrderAlertsButton() {
  const [soundOn, setSoundOn] = useState(false);
  const [push, setPush] = useState<PushState>("checking");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  // Any tap anywhere on the POS unlocks sound (and re-unlocks it after iOS suspends it).
  useEffect(() => {
    const onTap = () => { unlockOrderSound().then(setSoundOn); };
    const onShow = () => setSoundOn(orderSoundReady());
    window.addEventListener("pointerdown", onTap, { capture: true });
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.removeEventListener("pointerdown", onTap, { capture: true });
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  // Is this device already subscribed? (Re-saved so the server always has it.)
  useEffect(() => { currentPushState().then(setPush); }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!panel.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  async function enablePush() {
    setBusy(true);
    try {
      const r = await subscribeThisDevice();
      setPush(r.state);
      if (r.error) { toast.error(r.error); return; }
      if (r.state === "on") toast.success("Alerts on — this device will be notified of online orders");
    } catch {
      toast.error("Couldn't turn alerts on — try again");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const r = await sendTestPush().catch(() => ({ error: "Couldn't reach the server" }));
    setBusy(false);
    if (r?.error) toast.error(r.error);
    else toast.success("Test alert sent — it should appear in a moment");
  }

  const Icon = push === "on" ? BellRing : soundOn ? Bell : BellOff;
  return (
    <div ref={panel} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Order alerts"
        title={soundOn ? "Order alerts" : "Tap anywhere to turn on order sounds"}
        className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
      >
        <Icon size={15} />
        {!soundOn && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />}
        {push === "on" && soundOn && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand-green" />}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-[70] w-72 rounded-2xl bg-white p-4 text-sm text-stone-700 shadow-xl ring-1 ring-black/5 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display font-bold text-brand-brown dark:text-orange-100">Order alerts</p>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-stone-400"><X size={16} /></button>
          </div>
          <p className="flex items-center gap-1.5 font-bold"><Volume2 size={15} /> Sound on this screen</p>
          <p className={cn("mb-3 text-xs", soundOn ? "text-brand-green" : "text-amber-600")}>
            {soundOn ? "On — a chime plays for every new online order." : "Tap anywhere on the POS once to turn it on."}
          </p>
          <p className="flex items-center gap-1.5 font-bold"><Smartphone size={15} /> Alerts when the POS is closed</p>
          {push === "on" && (
            <div className="text-xs">
              <p className="text-brand-green">On for this device.</p>
              <button disabled={busy} onClick={test} className="mt-2 font-bold text-brand-orange">Send a test alert</button>
            </div>
          )}
          {push === "off" && (
            <button disabled={busy} onClick={enablePush} className="btn-primary mt-1 w-full !py-2 text-sm">
              {busy ? "Turning on…" : "Turn on alerts"}
            </button>
          )}
          {push === "checking" && <p className="text-xs text-stone-400">Checking…</p>}
          {push === "install" && (
            <p className="text-xs leading-relaxed">
              On iPad/iPhone this needs the POS as an app: tap <b>Share</b> → <b>Add to Home Screen</b>,
              open <b>Thelawalaa POS</b> from the Home Screen, sign in, then turn alerts on here.
            </p>
          )}
          {push === "blocked" && (
            <p className="text-xs leading-relaxed">Notifications are blocked. Allow them in <b>Settings → Notifications → Thelawalaa POS</b>, then reopen the POS.</p>
          )}
          {push === "unsupported" && <p className="text-xs">This browser can&apos;t receive alerts while closed — keep the POS open.</p>}
          {push === "unconfigured" && <p className="text-xs">Alerts aren&apos;t set up on the server yet (VAPID keys).</p>}
        </div>
      )}
    </div>
  );
}
