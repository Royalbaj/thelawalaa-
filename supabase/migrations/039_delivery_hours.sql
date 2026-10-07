-- ============================================================
-- Delivery hours + scheduled deliveries (Admin → Settings → Delivery hours).
-- With the hours switched on, website delivery is "as soon as possible" only
-- inside them; outside, checkout says when delivery starts and lets the
-- customer book a later time slot. Slots are `delivery_slot_minutes` long and
-- must be booked at least `delivery_lead_minutes` before they start.
-- Times are Banepa (Nepal) local times. Off = delivery any time, as before.
-- ============================================================

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS delivery_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_start TIME NOT NULL DEFAULT '11:00',
  ADD COLUMN IF NOT EXISTS delivery_end   TIME NOT NULL DEFAULT '20:00',
  ADD COLUMN IF NOT EXISTS delivery_slot_minutes INTEGER NOT NULL DEFAULT 30
    CHECK (delivery_slot_minutes BETWEEN 15 AND 240),
  ADD COLUMN IF NOT EXISTS delivery_lead_minutes INTEGER NOT NULL DEFAULT 30
    CHECK (delivery_lead_minutes BETWEEN 30 AND 720),
  ADD COLUMN IF NOT EXISTS delivery_days_ahead INTEGER NOT NULL DEFAULT 2
    CHECK (delivery_days_ahead BETWEEN 1 AND 7);

-- A booked delivery slot (NULL = as soon as possible).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS scheduled_for   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_until TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS orders_scheduled_for ON public.orders (scheduled_for) WHERE scheduled_for IS NOT NULL;
