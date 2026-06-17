"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { MapPin, Phone } from "lucide-react";
import {
  setDriverOnline, driverAdvanceStatus, verifyDeliveryOtp, getCustomerTelLink,
} from "@/app/actions/delivery";
import { npr, STATUS_COLORS, cn } from "@/lib/utils";

export type DriverOrder = {
  id: string; order_number: string; status: string; total: number;
  payment_method: string | null; payment_status: string;
  customer_first_name: string; address: string; items_count: number; assigned_at: string | null;
};

export default function DriverPortal({
  name, online, orders, completedToday,
}: { name: string; online: boolean; orders: DriverOrder[]; completedToday: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [otpFor, setOtpFor] = useState<string | null>(null);
  const [otp, setOtp] = useState("");

  const advance = (id: string) =>
    start(async () => {
      const r = await driverAdvanceStatus(id);
      r?.error ? toast.error(r.error) : router.refresh();
    });

  const submitOtp = () =>
    start(async () => {
      const r = await verifyDeliveryOtp(otpFor!, otp);
      if (r?.error) toast.error(r.error);
      else { toast.success("Delivered! 🎉"); setOtpFor(null); setOtp(""); router.refresh(); }
    });

  const call = (id: string) =>
    start(async () => {
      // Phone number is fetched on demand — it never sits in this page's HTML.
      const r = await getCustomerTelLink(id);
      if ("error" in r && r.error) toast.error(r.error);
      else if ("tel" in r && r.tel) window.location.href = r.tel;
    });

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="card flex items-center justify-between p-4">
        <div>
          <p className="font-display font-bold text-brand-brown">{name}</p>
          <p className={cn("text-xs font-bold", online ? "text-brand-green" : "text-stone-400")}>
            {online ? "● Online — you can get orders" : "○ Offline"}
          </p>
        </div>
        <button
          disabled={pending}
          onClick={() => start(async () => { await setDriverOnline(!online); router.refresh(); })}
          className={cn("rounded-full px-5 py-2.5 text-sm font-bold text-white",
            online ? "bg-stone-400" : "bg-brand-green")}
        >
          {online ? "Go offline" : "Go online"}
        </button>
      </div>

      {orders.length === 0 && (
        <div className="card p-8 text-center text-sm text-stone-500">
          No deliveries assigned right now.{online ? " Hang tight!" : " Go online to receive orders."}
        </div>
      )}

      {orders.map((o) => (
        <div key={o.id} className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="font-mono font-bold">{o.order_number}</p>
            <div className="flex gap-2">
              <span className={cn("badge", o.payment_status === "paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800")}>
                {o.payment_status === "paid" ? "PAID ✓" : `COLLECT ${npr(Number(o.total))}`}
              </span>
              <span className={cn("badge", STATUS_COLORS[o.status])}>{o.status.replace(/_/g, " ")}</span>
            </div>
          </div>
          <p className="text-sm"><span className="font-bold">{o.customer_first_name}</span> · {o.items_count} items</p>
          <p className="text-sm text-stone-600">{o.address}</p>
          <div className="flex gap-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}`}
              target="_blank" rel="noopener noreferrer"
              className="btn-outline flex flex-1 items-center justify-center gap-1.5 !py-2 text-sm"
            >
              <MapPin size={15} /> Maps
            </a>
            <button onClick={() => call(o.id)} disabled={pending}
              className="btn-outline flex flex-1 items-center justify-center gap-1.5 !py-2 text-sm">
              <Phone size={15} /> Call
            </button>
          </div>
          {o.status === "assigned" && (
            <button onClick={() => advance(o.id)} disabled={pending} className="btn-primary w-full !py-3">Confirm pickup ✓</button>
          )}
          {o.status === "picked_up" && (
            <button onClick={() => advance(o.id)} disabled={pending} className="btn-primary w-full !py-3">I&apos;m on the way ✓</button>
          )}
          {o.status === "on_the_way" && (
            <button onClick={() => { setOtpFor(o.id); setOtp(""); }} disabled={pending}
              className="w-full rounded-full bg-brand-green py-3 font-bold text-white">Mark delivered ✓</button>
          )}
        </div>
      ))}

      <div className="card p-4 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Delivered today</p>
        <p className="font-display text-3xl font-bold text-brand-green">{completedToday}</p>
      </div>

      {otpFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-xs space-y-4 p-6 text-center">
            <h2 className="font-display font-bold text-brand-brown">Customer&apos;s 4-digit OTP</h2>
            <p className="text-xs text-stone-500">It&apos;s in their order confirmation email.</p>
            <input
              value={otp} inputMode="numeric" maxLength={4} autoFocus
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="input text-center font-mono text-2xl tracking-[0.5em]"
            />
            <div className="flex gap-2">
              <button onClick={() => setOtpFor(null)} className="btn-outline flex-1">Cancel</button>
              <button onClick={submitOtp} disabled={pending || otp.length !== 4} className="btn-primary flex-1 disabled:opacity-50">
                Verify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
