"use client";
import { saveStaffPushSubscription } from "@/app/actions/push";

// The device side of Web Push (lib/push.ts is the server side), shared by
// the POS bell and the driver app. On iPhone/iPad, push only works for a
// web app added to the Home Screen (iOS 16.4+), so outside one we say how.

export const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushState = "checking" | "off" | "on" | "blocked" | "install" | "unsupported" | "unconfigured";

function urlBase64ToUint8Array(base64: string) {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function detectPush(): PushState {
  if (!VAPID_KEY) return "unconfigured";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (supported) return Notification.permission === "denied" ? "blocked" : "checking";
  // iPadOS Safari reports itself as a Mac — touch points give it away.
  const apple = /iP(ad|hone|od)/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return apple && !installed ? "install" : "unsupported";
}

/** Is this device already subscribed? Re-saves it so the server always has it. */
export async function currentPushState(): Promise<PushState> {
  const state = detectPush();
  if (state !== "checking") return state;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    const sub = await reg.pushManager.getSubscription();
    if (sub && Notification.permission === "granted") {
      await saveStaffPushSubscription(JSON.parse(JSON.stringify(sub))).catch(() => {});
      return "on";
    }
    return "off";
  } catch {
    return "unsupported";
  }
}

/** Must run straight from a tap — iOS only shows the permission prompt for a direct user action. */
export async function enablePush(): Promise<{ state: PushState; error?: string }> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { state: permission === "denied" ? "blocked" : "off" };
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_KEY) });
  const r = await saveStaffPushSubscription(JSON.parse(JSON.stringify(sub)));
  if (r?.error) return { state: "off", error: r.error };
  return { state: "on" };
}
