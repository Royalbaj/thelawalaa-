import { SITE } from "@/lib/seo";

// Maps helpers for delivery: the customer's shared pin, the rider's map and
// navigation, and how far a pin is from the shop. The shop's position and the
// delivery radius are set in Admin → Settings → Delivery area (app_settings);
// lib/seo.ts's approximate coordinates are only the fallback.

export type LatLng = { lat: number; lng: number };

/** Fallback shop position (approximate) until Admin → Settings → Delivery area sets the real one. */
export const STORE: LatLng = { lat: SITE.geo.lat, lng: SITE.geo.lng };
export const DEFAULT_RADIUS_KM = 5;

/** The shop and how far it delivers, from app_settings (migration 033). */
export type DeliveryArea = { shop: LatLng; radiusKm: number; shopIsSet: boolean };
export function deliveryArea(s: { store_lat?: number | null; store_lng?: number | null; delivery_radius_km?: number | string | null } | null | undefined): DeliveryArea {
  const set = s?.store_lat != null && s?.store_lng != null;
  return {
    shop: set ? { lat: Number(s!.store_lat), lng: Number(s!.store_lng) } : STORE,
    radiusKm: s?.delivery_radius_km != null ? Number(s.delivery_radius_km) : DEFAULT_RADIUS_KM,
    shopIsSet: set,
  };
}
/** Is this spot outside the delivery area? (A few metres of GPS wobble is allowed.) */
export const outsideArea = (area: DeliveryArea, p: LatLng) => distanceKm(area.shop, p) > area.radiusKm + 0.05;

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
