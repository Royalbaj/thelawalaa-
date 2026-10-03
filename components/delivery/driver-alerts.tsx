"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BellRing } from "lucide-react";
import { sendTestPush } from "@/app/actions/push";
import { currentPushState, enablePush, type PushState } from "@/lib/push-client";

/** "Alerts on this phone": a notification for every delivery given to this rider, even with the app closed. */
export default function DriverAlerts() {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  useEffect(() => { currentPushState().then(setState); }, []);

  const turnOn = async () => {
    setBusy(true);
    try {
      const r = await enablePush();
      setState(r.state);
      if (r.error) toast.error(r.error);
      else if (r.state === "on") toast.success("Alerts on — you'll be notified of new deliveries");
    } catch { toast.error("Couldn't turn alerts on — try again"); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true);
    const r = await sendTestPush().catch(() => ({ error: "Couldn't reach the server" }));
    setBusy(false);
    if (r && "error" in r && r.error) toast.error(r.error); else toast.success("Test alert sent");
  };

  return (
    <section className="rounded-3xl bg-white/[0.06] p-5 ring-1 ring-white/10">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white"><BellRing size={18} className="text-brand-orange" /> Alerts on this phone</h2>
      <p className="mt-1 text-sm text-white/55">Get a notification with sound for every new delivery — even when the app is closed.</p>
      <div className="mt-4 text-sm">
        {state === "checking" && <p className="text-white/40">Checking…</p>}
        {state === "on" && (
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold text-green-300">On for this phone ✓</p>
            <button disabled={busy} onClick={test} className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white">Send a test</button>
          </div>
        )}
        {state === "off" && <button disabled={busy} onClick={turnOn} className="btn-primary w-full !py-3">{busy ? "Turning on…" : "Turn on alerts"}</button>}
        {state === "install" && (
          <p className="leading-relaxed text-white/70">On iPhone this needs the driver app on your Home Screen: tap <b>Share</b> → <b>Add to Home Screen</b>, open <b>Thelawalaa Driver</b> from there, sign in, then turn alerts on here.</p>
        )}
        {state === "blocked" && <p className="leading-relaxed text-white/70">Notifications are blocked. Allow them in your phone&apos;s <b>Settings → Notifications</b>, then reopen the app.</p>}
        {state === "unsupported" && <p className="text-white/70">This browser can&apos;t get alerts while closed — keep the app open while you work.</p>}
        {state === "unconfigured" && <p className="text-white/70">Alerts aren&apos;t set up on the server yet.</p>}
      </div>
    </section>
  );
}
