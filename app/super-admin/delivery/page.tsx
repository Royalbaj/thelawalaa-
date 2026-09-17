import { format } from "date-fns";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr, STATUS_COLORS, cn } from "@/lib/utils";
import AssignDriver from "@/components/admin/assign-driver";

export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  await requireRole(["super_admin"]);

  const [{ data: drivers }, { data: unassigned }, { data: active }] = await Promise.all([
    supabaseAdmin.from("profiles")
      .select("id, full_name, is_online, vehicle_type, vehicle_number, last_seen_at")
      .eq("role", "delivery_driver").eq("is_active", true).order("full_name"),
    supabaseAdmin.from("orders")
      .select("id, order_number, total, created_at, status, deliveries!inner(driver_id)")
      .eq("type", "delivery").is("deliveries.driver_id", null)
      .in("status", ["confirmed", "preparing", "ready"]).order("created_at"),
    supabaseAdmin.from("orders")
      .select("id, order_number, total, status, deliveries!inner(driver_id, assigned_at, profiles:driver_id(full_name))")
      .eq("type", "delivery").in("status", ["assigned", "picked_up", "on_the_way"]).order("created_at"),
  ]);

  const onlineDrivers = (drivers ?? []).filter((d) => d.is_online).map((d) => ({ id: d.id, full_name: d.full_name }));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section>
          <h2 className="mb-2 font-display font-bold text-slate-900">Waiting for a driver</h2>
          <div className="card divide-y divide-slate-100">
            {(unassigned ?? []).map((o: any) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-mono font-bold">{o.order_number}</p>
                  <p className="text-xs text-slate-500">{format(new Date(o.created_at), "h:mm a")} · {npr(Number(o.total))}</p>
                </div>
                <AssignDriver orderId={o.id} drivers={onlineDrivers} />
              </div>
            ))}
            {(unassigned ?? []).length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">Nothing waiting 🎉</p>}
          </div>
        </section>
        <section>
          <h2 className="mb-2 font-display font-bold text-slate-900">Out for delivery</h2>
          <div className="card divide-y divide-slate-100">
            {(active ?? []).map((o: any) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-mono font-bold">{o.order_number}</p>
                  <p className="text-xs text-slate-500">Driver: {o.deliveries?.profiles?.full_name ?? "—"}</p>
                </div>
                <span className={cn("badge", STATUS_COLORS[o.status])}>{o.status.replace(/_/g, " ")}</span>
              </div>
            ))}
            {(active ?? []).length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">No active deliveries.</p>}
          </div>
        </section>
      </div>
      <section>
        <h2 className="mb-2 font-display font-bold text-slate-900">Drivers</h2>
        <div className="card divide-y divide-slate-100">
          {(drivers ?? []).map((d) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-bold">{d.full_name}</p>
                <p className="text-xs text-slate-500">{d.vehicle_type ?? "—"} {d.vehicle_number ?? ""}</p>
              </div>
              <span className={cn("flex items-center gap-1.5 text-xs font-bold", d.is_online ? "text-brand-green" : "text-slate-400")}>
                <span className={cn("h-2 w-2 rounded-full", d.is_online ? "bg-brand-green" : "bg-slate-300")} />
                {d.is_online ? "Online" : "Offline"}
              </span>
            </div>
          ))}
          {(drivers ?? []).length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">No drivers yet — invite some from Staff.</p>}
        </div>
      </section>
    </div>
  );
}
