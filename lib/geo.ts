import { SITE } from "@/lib/seo";

// Maps helpers for delivery: the customer's shared pin, the rider's map and
// navigation, and how far a pin is from the shop. The shop's coordinates
// come from lib/seo.ts (approximate until verified — see the TODO there).

export type LatLng = { lat: number; lng: number };

export const STORE: LatLng = { lat: SITE.geo.lat, lng: SITE.geo.lng };
/** How far we deliver (km) — the 5 km promise, with a little slack for an approximate shop pin. */
export const DELIVERY_RADIUS_KM = 5;

export function distanceKm(a: LatLng, b: LatLng) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

/** Turn-by-turn directions in Google Maps (opens the app on phones). */
export const directionsUrl = (p: LatLng) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
/** A typed address, searched in Google Maps — when the customer didn't share a pin. */
export const searchUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, Banepa`)}`;
/** The small map shown inside the rider's screen (www.google.com is allowed in the CSP's frame-src). */
export const embedUrl = (p: LatLng) => `https://www.google.com/maps?q=${p.lat},${p.lng}&z=17&output=embed`;
