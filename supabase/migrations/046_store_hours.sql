-- ============================================================
-- Store opening hours (Admin → Settings → Store hours).
-- Website orders are "as soon as possible" only while the shop is open; when
-- it's closed, checkout says when it opens and the customer books a pickup
-- time for after opening. Delivery keeps its own hours (migration 039); with
-- delivery hours off, delivery follows the store hours. The POS isn't affected.
-- Times are Banepa (Nepal) local times. Starts ON, 9:00 am – 7:00 pm (the
-- owner's hours, Oct 2026).
-- ============================================================

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS store_hours_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS store_open  TIME NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS store_close TIME NOT NULL DEFAULT '19:00',
  ADD COLUMN IF NOT EXISTS pickup_slot_minutes INTEGER NOT NULL DEFAULT 30
    CHECK (pickup_slot_minutes BETWEEN 15 AND 240),
  ADD COLUMN IF NOT EXISTS pickup_days_ahead INTEGER NOT NULL DEFAULT 2
    CHECK (pickup_days_ahead BETWEEN 1 AND 7);

-- A booked pickup uses the same orders.scheduled_for / scheduled_until as a
-- booked delivery (migration 039) — nothing new is needed on orders.
