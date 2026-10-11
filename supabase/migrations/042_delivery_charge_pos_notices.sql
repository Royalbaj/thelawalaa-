-- 042: delivery charge under Rs 99, and notices on the POS screen.

-- ── Delivery charge (owner's call, Oct 2026) ────────────────────────────────
-- Online delivery orders pay `delivery_fee` when the food comes to less than
-- `free_delivery_from` (before vouchers/points); free from there up. 0 = always
-- free. Edited in Admin → Settings → Delivery charge; lib/delivery-fee.ts.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 20 CHECK (delivery_fee >= 0 AND delivery_fee <= 500),
  ADD COLUMN IF NOT EXISTS free_delivery_from numeric NOT NULL DEFAULT 99 CHECK (free_delivery_from >= 0 AND free_delivery_from <= 100000);

-- ── Notices on the POS screen ───────────────────────────────────────────────
-- Admin → Notifications can now write to the counter too: a 'pos' notice stays
-- on the POS screen (till and PIN screen) until the admin removes it.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_audience_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_audience_check
  CHECK (audience IN ('customers', 'drivers', 'pos'));
