"use client";

import { useState, useTransition, useEffect } from "react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { npr, cn } from "@/lib/utils";
import { setDriverOnline, driverAdvanceStatus, verifyDeliveryOtp, getCustomerTelLink } from "@/app/actions/delivery";

interface DeliveryOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  payment_status: string;
  payment_method: string | null;
  created_at: string;
  notes: string | null;
  customer?: { full_name: string; phone: string | null } | null;
  address?: { full_address: string } | null;
}

interface Delivery {
  id: string;
  assigned_at: string;
  picked_up_at: string | null;
  on_the_way_at: string | null;
  delivered_at: string | null;
  otp_verified: boolean;
  orders: DeliveryOrder;
}

const STATUS_FLOW = ["assigned", "picked_up", "on_the_way", "delivered"];
const STATUS_LABELS: Record<string, string> = {
  assigned: "Go Pick Up",
  picked_up: "Picked Up → On the Way",
  on_the_way: "Arrived → Enter OTP",
};

export default function DriverDashboard({
  driverName,
  isOnline,
  deliveries,
  totalDelivered,
}: {
  driverName: string;
  isOnline: boolean;
  deliveries: Delivery[];
  totalDelivered: number;
}) {
  const router = useRouter();
  const [online, setOnline] = useState(isOnline);
  const [otp, setOtp] = useState("");
  const [activeOtp, setActiveOtp] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const active = deliveries.filter((d) => !d.otp_verified && d.orders.status !== "delivered" && d.orders.status !== "cancelled");
  const completed = deliveries.filter((d) => d.otp_verified || d.orders.status === "delivered");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("driver-deliveries")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => {
        toast("🔔 New delivery update!", { icon: "🛵" });
        router.refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        router.refresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [router]);

  function toggleOnline() {
    startTransition(async () => {
      await setDriverOnline(!online);
      setOnline(!online);
      toast.success(online ? "You're offline" : "You're online!");
      router.refresh();
    });
  }

  function advanceOrder(orderId: string) {
    startTransition(async () => {
      const res = await driverAdvanceStatus(orderId);
      if ("error" in res) { toast.error(res.error as string); return; }
      toast.success(`Status updated!`);
      router.refresh();
    });
  }

  function submitOtp(orderId: string) {
    if (otp.length !== 4) return toast.error("Enter 4-digit OTP");
    startTransition(async () => {
      const res = await verifyDeliveryOtp(orderId, otp);
      if ("error" in res) { toast.error(res.error as string); return; }
      toast.success("✅ Delivery confirmed!");
      setOtp("");
      setActiveOtp(null);
      router.refresh();
    });
  }

  async function callCustomer(orderId: string) {
    const res = await getCustomerTelLink(orderId);
    if ("error" in res) { toast.error(res.error as string); return; }
    window.open(res.tel, "_self");
  }

  function getCustomerName(o: DeliveryOrder) {
    if (o.customer) return o.customer.full_name;
    if (!o.notes) return "Customer";
    const match = o.notes.match(/Name:\s*([^\n]+)/);
    return match ? match[1] : "Customer";
  }

  function getCustomerPhone(o: DeliveryOrder) {
    if (o.customer) return o.customer.phone;
    if (!o.notes) return null;
    const match = o.notes.match(/Phone:\s*([^\n]+)/);
    return match ? match[1] : null;
  }

  function getAddress(o: DeliveryOrder) {
    if (o.address) return o.address.full_address;
    if (!o.notes) return null;
    const match = o.notes.match(/Address:\s*([^\n]+)/);
    return match ? match[1] : null;
  }

  return (
    <div className="space-y-4">
      {/* Online Toggle */}
      <div className="flex items-center justify-between rounded-2xl bg-white/5 p-4 border border-white/10">
        <div>
          <p className="font-bold text-sm">Status</p>
          <p className={cn("text-xs font-bold", online ? "text-green-400" : "text-red-400")}>
            {online ? "🟢 Online — Accepting deliveries" : "🔴 Offline"}
          </p>
        </div>
        <button
          onClick={toggleOnline}
          disabled={isPending}
          className={cn(
            "rounded-full px-5 py-2 text-sm font-bold transition",
            online ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-green-500/20 text-green-400 border border-green-500/30"
          )}
        >
          {online ? "Go Offline" : "Go Online"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/5 p-3 border border-white/10 text-center">
          <p className="text-2xl font-bold text-brand-orange">{active.length}</p>
          <p className="text-[10px] text-white/40 font-bold">Active</p>
        </div>
        <div className="rounded-xl bg-white/5 p-3 border border-white/10 text-center">
          <p className="text-2xl font-bold text-green-400">{totalDelivered}</p>
          <p className="text-[10px] text-white/40 font-bold">Total Delivered</p>
        </div>
        <div className="rounded-xl bg-white/5 p-3 border border-white/10 text-center">
          <p className="text-2xl font-bold text-white">{completed.length}</p>
          <p className="text-[10px] text-white/40 font-bold">Today</p>
        </div>
      </div>

      {/* Active Deliveries */}
      <div>
        <h2 className="font-bold text-sm mb-2 text-white/60 uppercase tracking-wider">Active Deliveries</h2>
        {active.length === 0 ? (
          <div className="rounded-2xl bg-white/5 p-8 border border-white/10 text-center">
            <p className="text-3xl mb-2">📦</p>
            <p className="text-sm text-white/40">No active deliveries</p>
            <p className="text-[10px] text-white/20 mt-1">Stay online to receive orders</p>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((d) => {
              const o = d.orders;
              const statusIdx = STATUS_FLOW.indexOf(o.status);
              return (
                <div key={d.id} className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                  {/* Progress Bar */}
                  <div className="h-1 bg-white/10">
                    <div className="h-full bg-brand-orange transition-all" style={{ width: `${((statusIdx + 1) / 4) * 100}%` }} />
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-mono text-sm font-bold">{o.order_number}</p>
                        <p className="text-xs text-white/50">{getCustomerName(o)}</p>
                        {getCustomerPhone(o) && <p className="text-[10px] text-white/40">{getCustomerPhone(o)}</p>}
                      </div>
                      <span className="font-bold text-brand-orange">{npr(Number(o.total))}</span>
                    </div>

                    {getAddress(o) && (
                      <div className="rounded-lg bg-white/5 p-2.5 border border-white/5">
                        <p className="text-[10px] text-white/40 font-bold mb-0.5">📍 Deliver to:</p>
                        <p className="text-xs font-bold">{getAddress(o)}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-bold rounded-full px-2 py-0.5", o.payment_status === "paid" ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400")}>
                        {o.payment_status === "paid" ? "✅ Paid" : `💵 Collect ${npr(Number(o.total))}`}
                      </span>
                      <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-white/10 text-white/50">
                        {o.payment_method ?? "cash"}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {STATUS_LABELS[o.status] && o.status !== "on_the_way" && (
                        <button
                          onClick={() => advanceOrder(o.id)}
                          disabled={isPending}
                          className="flex-1 rounded-xl bg-brand-orange text-white py-2.5 text-sm font-bold hover:brightness-110 transition"
                        >
                          {STATUS_LABELS[o.status]}
                        </button>
                      )}
                      {o.status === "on_the_way" && (
                        <div className="flex-1 space-y-2">
                          {activeOtp !== d.id ? (
                            <button
                              onClick={() => setActiveOtp(d.id)}
                              className="w-full rounded-xl bg-green-600 text-white py-2.5 text-sm font-bold hover:brightness-110 transition"
                            >
                              🔑 Enter Delivery OTP
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <input
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                placeholder="4-digit OTP"
                                className="flex-1 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-center font-mono text-lg font-bold tracking-widest text-white"
                                maxLength={4}
                                autoFocus
                              />
                              <button onClick={() => submitOtp(o.id)} disabled={isPending} className="rounded-xl bg-green-600 text-white px-4 font-bold hover:brightness-110 transition">✓</button>
                            </div>
                          )}
                        </div>
                      )}
                      <button onClick={() => callCustomer(o.id)} className="rounded-xl bg-white/10 border border-white/10 px-3 py-2.5 text-sm font-bold hover:bg-white/20 transition">📞</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h2 className="font-bold text-sm mb-2 text-white/60 uppercase tracking-wider">Completed</h2>
          <div className="space-y-2">
            {completed.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl bg-white/5 p-3 border border-white/5">
                <div>
                  <p className="font-mono text-xs font-bold">{d.orders.order_number}</p>
                  <p className="text-[10px] text-white/30">{d.delivered_at ? format(new Date(d.delivered_at), "d MMM, h:mm a") : "—"}</p>
                </div>
                <span className="text-xs font-bold text-green-400">✅ Delivered</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sign Out */}
      <button
        onClick={async () => {
          const { createClient } = await import("@/lib/supabase/client");
          await createClient().auth.signOut();
          window.location.href = "/auth/login";
        }}
        className="w-full rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 py-2.5 text-sm font-bold mt-4"
      >
        Sign Out
      </button>
    </div>
  );
}
