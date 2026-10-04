-- Delivery area (Admin → Settings → Delivery area): how far we deliver, from
-- where. A delivery whose pin is farther than this is refused at checkout
-- (and again in createOrder) with "call us to confirm". The shop's exact
-- spot is set from the shop itself ("use this device's location"); until
-- then lib/seo.ts's approximate coordinates are used.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS delivery_radius_km NUMERIC(5,2) NOT NULL DEFAULT 5 CHECK (delivery_radius_km BETWEEN 0.5 AND 50),
  ADD COLUMN IF NOT EXISTS store_lat DOUBLE PRECISION CHECK (store_lat IS NULL OR store_lat BETWEEN 26.3 AND 30.5),
  ADD COLUMN IF NOT EXISTS store_lng DOUBLE PRECISION CHECK (store_lng IS NULL OR store_lng BETWEEN 80 AND 88.3);
