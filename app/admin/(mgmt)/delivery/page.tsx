import { MapPin, Navigation, Bike, Clock } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr, cn } from "@/lib/utils";
import { orderStatusLabel } from "@/lib/order-status";
import { noteField } from "@/lib/order-notes";
import { directionsUrl, searchUrl, distanceKm, fmtKm, deliveryArea, type LatLng } from "@/lib/geo";
import { nepalToday, resolveRange, addDays, type RangeKey } from "@/lib/dates";
import AssignDriver from "@/components/admin/assign-driver";
import { slotLabel } from "@/lib/delivery-hours";
import { npTime, npDayMonthTime } from "@/lib/nepal-time";
import { getRiderTrips } from "@/lib/rider-trips";
import RangePicker from "@/components/admin/range-picker";
import { FuelRateForm, RecalcDistances } from "@/components/admin/rider-fuel";

export const dynamic = "force-dynamic";

type Row = {
  id: string; order_number: string; daily_number: number | null; total: number; status: string; created_at: string; payment_status: string;
  notes: string | null; delivery_address: string | null; delivery_lat: number | null; delivery_lng: number | null;
  scheduled_for: string | null; scheduled_until: string | null;
  items: { product_name: string; quantity: number }[];
  deliveries: { driver_id: string | null; assigned_at: string | null; profiles: { full_name: string } | null } | null;
};

const SELECT = "id, order_number, daily_number, total, status, created_at, payment_status, notes, delivery_address, delivery_lat, delivery_lng, scheduled_for, scheduled_until, items:order_items(product_name, quantity), deliveries!inner(driver_id, assigned_at, profiles:driver_id(full_name))";

function Where({ o, shop }: { o: Row; shop: LatLng }) {
  const address = o.delivery_address ?? noteField(o.notes, "Address");
  const pin = o.delivery_lat != null && o.delivery_lng != null ? { lat: o.delivery_lat, lng: o.delivery_lng } : null;
  return (
    <div className="mt-1.5 space-y-1 text-xs text-stone-600">
      {o.scheduled_for && o.scheduled_until && (
        <p className="flex gap-1.5 font-bold text-sky-800"><Clock size={13} className="mt-0.5 shrink-0" /> Deliver {slotLabel({ start: o.scheduled_for, end: o.scheduled_until })}</p>
      )}
      <p className="flex gap-1.5"><MapPin size={13} className="mt-0.5 shrink-0 text-brand-orange" /> {address ?? "Shared location"}</p>
      <a href={pin ? directionsUrl(pin) : searchUrl(address ?? "")} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-brand-orange">
        <Navigation size={12} /> {pin ? `Exact pin · ${fmtKm(distanceKm(shop, pin))} away` : "No pin — find the address"}
      </a>
    </div>
  );
}

const TRIP_RANGES: RangeKey[] = ["today", "week", "month", "last-month", "custom"];
const kmLabel = (km: number) => `${km.toFixed(1)} km`;
const minutesLabel = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);

export default async function DeliveryPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requireRole(["super_admin"]);
  // Riders' trips for the fuel money (migration 045): Nepal days, delivered in the period.
  const range = resolveRange(await searchParams, "month");
  const tripFrom = `${range.from}T00:00:00+05:45`;
  const tripTo = `${addDays(range.to, 1)}T00:00:00+05:45`;

  const [{ data: drivers }, { data: unassigned }, { data: active }, { data: doneToday }, { data: settings }] = await Promise.all([
    supabaseAdmin.from("profiles")
      .select("id, full_name, is_online, vehicle_type, vehicle_number, last_seen_at")
      .eq("role", "delivery_driver").eq("is_active", true).order("full_name"),
    supabaseAdmin.from("orders").select(SELECT)
      .eq("type", "delivery").is("deliveries.driver_id", null)
      .in("status", ["pending", "confirmed", "preparing", "ready"]).order("created_at"),
    supabaseAdmin.from("orders").select(SELECT)
      .eq("type", "delivery").in("status", ["assigned", "picked_up", "on_the_way"]).order("created_at"),
    supabaseAdmin.from("orders").select("id, deliveries!inner(driver_id)")
      .eq("type", "delivery").eq("status", "delivered").gte("served_at", `${nepalToday()}T00:00:00+05:45`),
    supabaseAdmin.from("app_settings").select("delivery_radius_km, store_lat, store_lng, fuel_rate_per_km").eq("id", 1).maybeSingle(),
  ]);
  const riders = await getRiderTrips(tripFrom, tripTo);
  const fuelRate = settings?.fuel_rate_per_km != null ? Number(settings.fuel_rate_per_km) : null;
  const notByRoad = riders.reduce((n, r) => n + r.list.filter((t) => t.source !== "road").length, 0);
  const { shop } = deliveryArea(settings);
  const perDriver = new Map<string, number>();
  for (const o of (doneToday ?? []) as unknown as { deliveries: { driver_id: string | null } }[]) {
    if (o.deliveries?.driver_id) perDriver.set(o.deliveries.driver_id, (perDriver.get(o.deliveries.driver_id) ?? 0) + 1);
  }
  const riderChoices = (drivers ?? []).map((d) => ({ id: d.id, full_name: d.full_name, is_online: d.is_online }));
  const no = (o: Row) => (o.daily_number != null ? `#${String(o.daily_number).padStart(2, "0")}` : o.order_number);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section>
          <h2 className="mb-2 font-display font-bold text-brand-brown">Waiting for a rider</h2>
          <div className="card divide-y divide-orange-50">
            {((unassigned ?? []) as unknown as Row[]).map((o) => (
              <div key={o.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-extrabold text-brand-brown">{no(o)}</span>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-stone-600">{orderStatusLabel(o.status, "delivery")}</span>
                    <span className="text-xs text-stone-400">{npTime(o.created_at)} · {npr(Number(o.total))}{o.payment_status === "paid" ? " · paid" : ""}</span>
                  </p>
                  <p className="mt-1 text-xs text-stone-600">{o.items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ")}</p>
                  <Where o={o} shop={shop} />
                </div>
                <AssignDriver orderId={o.id} drivers={riderChoices} />
              </div>
            ))}
            {(unassigned ?? []).length === 0 && <p className="px-4 py-6 text-center text-sm text-stone-500">Nothing waiting.</p>}
          </div>
        </section>
        <section>
          <h2 className="mb-2 font-display font-bold text-brand-brown">Out for delivery</h2>
          <div className="card divide-y divide-orange-50">
            {((active ?? []) as unknown as Row[]).map((o) => (
              <div key={o.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2">
                    <span className="font-display text-lg font-extrabold text-brand-brown">{no(o)}</span>
                    <span className="flex items-center gap-1 text-xs font-bold text-stone-500"><Bike size={13} /> {o.deliveries?.profiles?.full_name ?? "—"}</span>
                  </p>
                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold",
                    o.status === "on_the_way" ? "bg-sky-100 text-sky-800" : o.status === "picked_up" ? "bg-indigo-100 text-indigo-800" : "bg-blue-100 text-blue-800")}>
                    {o.status === "assigned" ? "Rider on the way to the shop" : o.status === "picked_up" ? "Picked up" : "On the way to customer"}
                  </span>
                </div>
                <Where o={o} shop={shop} />
              </div>
            ))}
            {(active ?? []).length === 0 && <p className="px-4 py-6 text-center text-sm text-stone-500">No active deliveries.</p>}
          </div>
        </section>
      </div>
      <section>
        <h2 className="mb-2 font-display font-bold text-brand-brown">Riders</h2>
        <div className="card divide-y divide-orange-50">
          {(drivers ?? []).map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-bold">{d.full_name}</p>
                <p className="text-xs text-stone-500">{[d.vehicle_type, d.vehicle_number].filter(Boolean).join(" ") || "—"} · {perDriver.get(d.id) ?? 0} delivered today</p>
              </div>
              <span className={cn("flex shrink-0 items-center gap-1.5 text-xs font-bold", d.is_online ? "text-brand-green" : "text-stone-400")}>
                <span className={cn("h-2 w-2 rounded-full", d.is_online ? "bg-brand-green" : "bg-stone-300")} />
                {d.is_online ? "Online" : "Offline"}
              </span>
            </div>
          ))}
          {(drivers ?? []).length === 0 && <p className="px-4 py-6 text-center text-sm text-stone-500">No riders yet — invite them from Staff &amp; Users (role: delivery driver).</p>}
        </div>
        <p className="mt-3 text-xs text-stone-500">Riders use <b>/delivery</b> on their phone: map and directions to each customer, a Call button, and alerts for new deliveries. Send them a message from <a href="/admin/notifications" className="font-bold text-brand-orange">Notifications</a>.</p>
      </section>

      {/* Riders' trips: how far and how long, for paying fuel money. */}
      <section className="space-y-3 lg:col-span-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-brand-brown">Rider trips &amp; fuel money</h2>
            <p className="text-xs text-stone-500">
              Distance is by road from the shop to where the rider tapped Delivered (their phone&apos;s location), counted there and back.
              Time is from &quot;On the way&quot; to Delivered. {range.label}.
            </p>
          </div>
          <FuelRateForm rate={fuelRate} />
        </div>
        <RangePicker current={range.key} from={range.from} to={range.to} keys={TRIP_RANGES} />
        {riders.length === 0 ? (
          <div className="card px-4 py-8 text-center text-sm text-stone-500">No deliveries finished in this period.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {riders.map((r) => {
              const back = r.kmOneWay * 2;
              return (
                <div key={r.driverId} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-display text-lg font-bold text-brand-brown">{r.name}</p>
                    {fuelRate != null && <p className="text-right"><span className="block text-[11px] font-bold uppercase text-stone-400">Fuel money</span><span className="font-display text-xl font-extrabold text-brand-orange">{npr(Math.round(back * fuelRate))}</span></p>}
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-orange-50 py-2"><dt className="text-[11px] font-bold uppercase text-stone-500">Trips</dt><dd className="font-display text-lg font-bold">{r.trips}</dd></div>
                    <div className="rounded-xl bg-orange-50 py-2"><dt className="text-[11px] font-bold uppercase text-stone-500">There &amp; back</dt><dd className="font-display text-lg font-bold">{kmLabel(back)}</dd></div>
                    <div className="rounded-xl bg-orange-50 py-2"><dt className="text-[11px] font-bold uppercase text-stone-500">Avg time</dt><dd className="font-display text-lg font-bold">{r.timed ? minutesLabel(Math.round(r.minutes / r.timed)) : "—"}</dd></div>
                  </dl>
                  {r.unmeasured > 0 && <p className="mt-2 text-xs text-amber-700">{r.unmeasured} trip{r.unmeasured > 1 ? "s" : ""} without a location — not in the km.</p>}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-bold text-brand-orange">Every trip</summary>
                    <ul className="mt-2 divide-y divide-orange-50 text-sm">
                      {r.list.map((t) => (
                        <li key={t.orderId} className="flex items-center justify-between gap-2 py-1.5">
                          <span className="text-stone-600">{npDayMonthTime(t.deliveredAt)} · <b>{t.dailyNumber != null ? `#${String(t.dailyNumber).padStart(2, "0")}` : t.orderNumber}</b></span>
                          <span className="shrink-0 text-right text-xs text-stone-500">
                            {t.km != null ? <>{kmLabel(t.km)}{t.source === "straight" && <span className="text-amber-700"> approx</span>}</> : "no location"}
                            {t.minutes != null && ` · ${minutesLabel(t.minutes)}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              );
            })}
          </div>
        )}
        {notByRoad > 0 && (
          <p className="text-xs text-stone-500">
            {notByRoad} trip{notByRoad > 1 ? "s are" : " is"} not by road yet (&quot;approx&quot; = straight line, which reads a little short).{" "}
            <RecalcDistances from={tripFrom} to={tripTo} count={notByRoad} />
          </p>
        )}
      </section>
    </div>
  );
}
