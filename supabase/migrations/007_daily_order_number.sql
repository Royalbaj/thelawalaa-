-- ─────────────────────────────────────────────
-- 2-DIGIT DAILY ORDER NUMBER
--
-- The full order_number (TW-20260917-000071) stays as the permanent
-- unique record. daily_number is a small, easy-to-remember number
-- (1-99, wraps, resets each day) a customer can say out loud at the
-- counter — "I'm number 42". Computed with an atomic UPSERT so
-- concurrent orders never collide, unlike a plain MAX()+1 query.
-- ─────────────────────────────────────────────

ALTER TABLE orders ADD COLUMN IF NOT EXISTS daily_number SMALLINT;

CREATE TABLE IF NOT EXISTS daily_order_counters (
  day          DATE PRIMARY KEY,
  last_number  INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE daily_order_counters ENABLE ROW LEVEL SECURITY;
-- No client policies — only the trigger (running as the order-inserting
-- service-role statement) ever touches this table.

CREATE OR REPLACE FUNCTION public.generate_daily_number()
RETURNS TRIGGER AS $$
DECLARE
  n INTEGER;
BEGIN
  INSERT INTO daily_order_counters (day, last_number) VALUES (CURRENT_DATE, 1)
  ON CONFLICT (day) DO UPDATE SET last_number = daily_order_counters.last_number + 1
  RETURNING last_number INTO n;
  NEW.daily_number := ((n - 1) % 99) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_daily_number ON orders;
CREATE TRIGGER set_daily_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_daily_number();
