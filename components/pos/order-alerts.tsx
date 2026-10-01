"use client";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Bell, BellOff, BellRing, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { unlockOrderSound, orderSoundReady } from "@/lib/order-sound";
import { saveStaffPushSubscription, sendTestPush } from "@/app/actions/push";

// Order alerts for the POS device:
//  1. Sound on this screen — needs one tap after loading (iPad rule).
//  2. Push notifications (with the system sound) when the POS is closed or
//     the iPad is asleep. On iPad/iPhone that only works for a web app added
//     to the Home Screen (iPadOS 16.4+), so outside one we explain how.
const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type PushState = "checking" | "off" | "on" | "blocked" | "install" | "unsupported" | "unconfigured";

function urlBase64ToUint8Array(base64: string) {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function detectPush(): PushState {
  if (!VAPID_KEY) return "unconfigured";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (supported) return Notification.permission === "denied" ? "blocked" : "checking";
  // iPadOS Safari reports itself as a Mac — touch points give it away.
  const apple = /iP(ad|hone|od)/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return apple && !installed ? "install" : "unsupported";
}

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

  // Is this device already subscribed? Re-save it so the server always has it.
  useEffect(() => {
    const state = detectPush();
    if (state !== "checking") { setPush(state); return; }
    navigator.serviceWorker.register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        if (sub && Notification.permission === "granted") {
          await saveStaffPushSubscription(JSON.parse(JSON.stringify(sub))).catch(() => {});
          setPush("on");
        } else setPush("off");
      })
      .catch(() => setPush("unsupported"));
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!panel.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  async function enablePush() {
    setBusy(true);
    try {
      // First thing in the tap — iOS only shows the permission prompt for a direct user action.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setPush(permission === "denied" ? "blocked" : "off"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_KEY) });
      const r = await saveStaffPushSubscription(JSON.parse(JSON.stringify(sub)));
      if (r?.error) { toast.error(r.error); return; }
      setPush("on");
      toast.success("Alerts on — this device will be notified of online orders");
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
          <p className="font-bold">🔊 Sound on this screen</p>
          <p className={cn("mb-3 text-xs", soundOn ? "text-brand-green" : "text-amber-600")}>
            {soundOn ? "On — a chime plays for every new online order." : "Tap anywhere on the POS once to turn it on."}
          </p>
          <p className="font-bold">📲 Alerts when the POS is closed</p>
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
