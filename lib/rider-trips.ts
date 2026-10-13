import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deliveryArea, distanceKm, type LatLng } from "@/lib/geo";

// Riders' trips, for paying fuel money (migration 045, owner's call Oct 2026):
// how far each delivery was and how long it took.
//  - Where: the rider's phone GPS when they tap Delivered (deliveries.drop_lat/lng),
//    or the customer's shared pin when there's no GPS (the shop confirmed it, say).
//  - How far: the ROAD distance from the shop by Google Maps (Routes API), one
//    way. If Google can't be asked — no key, or the key isn't allowed to — a
//    straight line is stored and marked 'straight', and Admin → Deliveries can
//    work it out again once a key is set ("Recalculate road distance").
//  - How long: on the way (or picked up) → delivered, already on the delivery row.
// Key: GOOGLE_MAPS_SERVER_KEY (a server key with the Routes API on), else NEXT_PUBLIC_GOOGLE_MAPS_KEY.

const mapsKey = () => process.env.GOOGLE_MAPS_SERVER_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

/** Road km from a to b (Google Routes API), or null if Google couldn't answer. */
async function roadKm(a: LatLng, b: LatLng): Promise<number | null> {
  const key = mapsKey();
  if (!key) return null;
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.distanceMeters" },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: a.lat, longitude: a.lng } } },
        destination: { location: { latLng: { latitude: b.lat, longitude: b.lng } } },
        travelMode: "DRIVE",
      }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) { console.error("[rider-trips] Google Routes:", res.status, (await res.text()).slice(0, 200)); return null; }
    const meters = (await res.json())?.routes?.[0]?.distanceMeters;
    return typeof meters === "number" ? Math.round(meters / 10) / 100 : null;
  } catch (e) {
    console.error("[rider-trips] Google Routes failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Shop → this spot: by road when Google answers, else a straight line (marked as such). */
export async function tripDistance(to: LatLng): Promise<{ km: number; source: "road" | "straight" }> {
  const { data: settings } = await supabaseAdmin.from("app_settings").select("store_lat, store_lng, delivery_radius_km").eq("id", 1).single();
  const shop = deliveryArea(settings).shop;
  const road = await roadKm(shop, to);
  return road != null ? { km: road, source: "road" } : { km: Math.round(distanceKm(shop, to) * 100) / 100, source: "straight" };
}

/** Work out (or re-work out) one delivery's distance from where it ended — the rider's GPS, else the customer's pin. */
export async function measureDelivery(orderId: string) {
  const { data: d } = await supabaseAdmin.from("deliveries")
    .select("id, drop_lat, drop_lng, orders!inner(delivery_lat, delivery_lng)").eq("order_id", orderId).maybeSingle();
  if (!d) return;
  const order = d.orders as unknown as { delivery_lat: number | null; delivery_lng: number | null };
  const to = d.drop_lat != null && d.drop_lng != null ? { lat: Number(d.drop_lat), lng: Number(d.drop_lng) }
    : order.delivery_lat != null && order.delivery_lng != null ? { lat: Number(order.delivery_lat), lng: Number(order.delivery_lng) }
    : null;
  if (!to) return; // no GPS and no pin — distance unknown
  const { km, source } = await tripDistance(to);
  await supabaseAdmin.from("deliveries").update({ distance_km: km, distance_source: source }).eq("id", d.id);
}

export type RiderTrip = {
  orderId: string; orderNumber: string; dailyNumber: number | null; deliveredAt: string;
  km: number | null; source: "road" | "straight" | null; minutes: number | null;
};
export type RiderSummary = { driverId: string; name: string; trips: number; kmOneWay: number; unmeasured: number; minutes: number; timed: number; list: RiderTrip[] };

/** Every delivered trip in [fromIso, toIso), grouped by rider, newest first. */
export async function getRiderTrips(fromIso: string, toIso: string): Promise<RiderSummary[]> {
  const { data } = await supabaseAdmin.from("deliveries")
    .select("order_id, driver_id, picked_up_at, on_the_way_at, delivered_at, distance_km, distance_source, driver:profiles!deliveries_driver_id_fkey(full_name), orders!inner(order_number, daily_number, status)")
    .not("delivered_at", "is", null).not("driver_id", "is", null)
    .gte("delivered_at", fromIso).lt("delivered_at", toIso)
    .order("delivered_at", { ascending: false }).limit(2000);
  const byRider = new Map<string, RiderSummary>();
  for (const r of data ?? []) {
    const order = r.orders as unknown as { order_number: string; daily_number: number | null; status: string };
    if (order.status === "cancelled") continue;
    const start = r.on_the_way_at ?? r.picked_up_at;
    const minutes = start ? Math.max(0, Math.round((new Date(r.delivered_at!).getTime() - new Date(start).getTime()) / 60_000)) : null;
    const trip: RiderTrip = {
      orderId: r.order_id, orderNumber: order.order_number, dailyNumber: order.daily_number, deliveredAt: r.delivered_at!,
      km: r.distance_km != null ? Number(r.distance_km) : null, source: (r.distance_source as RiderTrip["source"]) ?? null,
      // Anything over 3 h is a forgotten tap, not a trip.
      minutes: minutes != null && minutes <= 180 ? minutes : null,
    };
    const name = (r.driver as unknown as { full_name: string } | null)?.full_name ?? "Rider";
    const s: RiderSummary = byRider.get(r.driver_id!) ?? { driverId: r.driver_id!, name, trips: 0, kmOneWay: 0, unmeasured: 0, minutes: 0, timed: 0, list: [] };
    s.trips += 1;
    if (trip.km != null) s.kmOneWay += trip.km; else s.unmeasured += 1;
    if (trip.minutes != null) { s.minutes += trip.minutes; s.timed += 1; }
    s.list.push(trip);
    byRider.set(r.driver_id!, s);
  }
  return [...byRider.values()].sort((a, b) => b.trips - a.trips);
}
