-- 045: delivery orders taken at the POS, and how far / how long each delivery
-- took — for paying riders' fuel money (owner's call, Oct 2026).

-- The POS "Delivery" order type, switched on/off in Admin → Settings → Feature
-- flags (separate from website delivery), and the fuel rate for Admin → Deliveries.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS pos_delivery_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fuel_rate_per_km numeric CHECK (fuel_rate_per_km IS NULL OR (fuel_rate_per_km >= 0 AND fuel_rate_per_km <= 1000));

-- Where the rider was when they tapped Delivered (their phone's GPS), and the
-- distance from the shop to there: by road (Google Maps) or, if Google couldn't
-- be asked, a straight line — marked so it can be worked out again later.
-- distance_km is ONE way; the fuel report doubles it (there and back).
-- Time taken = on_the_way_at (or picked_up_at) → delivered_at, already stored.
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS drop_lat numeric CHECK (drop_lat IS NULL OR drop_lat BETWEEN 26.3 AND 30.5),
  ADD COLUMN IF NOT EXISTS drop_lng numeric CHECK (drop_lng IS NULL OR drop_lng BETWEEN 80 AND 88.3),
  ADD COLUMN IF NOT EXISTS drop_accuracy_m integer,
  ADD COLUMN IF NOT EXISTS distance_km numeric CHECK (distance_km IS NULL OR (distance_km >= 0 AND distance_km < 500)),
  ADD COLUMN IF NOT EXISTS distance_source text CHECK (distance_source IS NULL OR distance_source IN ('road', 'straight'));
