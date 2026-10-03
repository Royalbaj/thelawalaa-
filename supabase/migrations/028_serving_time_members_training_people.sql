-- ============================================================
-- 1. Serving time: when an order became ready, and when it was handed over.
-- 2. Memberships: who bought a membership card at the POS (name + number).
-- 3. Training people: each staff member has their own PIN and their own
--    list of training videos (the POS login is shared, so the login alone
--    can't say who watched).
-- ============================================================

-- ── 1. Serving time ────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ready_at  TIMESTAMPTZ,   -- first time it reached "Ready" (or later)
  ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ;   -- first time it was Served / Collected / Delivered

-- Stamped by the database on every status change, whoever makes it (POS,
-- admin, driver) — the first time only, so stepping back doesn't move it.
CREATE OR REPLACE FUNCTION public.stamp_order_times()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('ready', 'picked_up', 'on_the_way', 'delivered') AND NEW.ready_at IS NULL THEN
      NEW.ready_at := NOW();
    END IF;
    IF NEW.status = 'delivered' AND NEW.served_at IS NULL THEN
      NEW.served_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_stamp_times ON public.orders;
CREATE TRIGGER orders_stamp_times BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.stamp_order_times();

-- Past orders: the same moments, from the status-change audit trail.
-- (updated_at is left alone — these orders didn't really change.)
ALTER TABLE public.orders DISABLE TRIGGER orders_updated_at;
UPDATE public.orders o SET ready_at = a.t
FROM (SELECT target_id, MIN(created_at) AS t FROM public.audit_logs
      WHERE action = 'UPDATE_ORDER_STATUS' AND new_data->>'status' IN ('ready', 'picked_up', 'on_the_way', 'delivered')
      GROUP BY target_id) a
WHERE a.target_id = o.id AND o.ready_at IS NULL;
UPDATE public.orders o SET served_at = a.t
FROM (SELECT target_id, MIN(created_at) AS t FROM public.audit_logs
      WHERE action = 'UPDATE_ORDER_STATUS' AND new_data->>'status' = 'delivered'
      GROUP BY target_id) a
WHERE a.target_id = o.id AND o.served_at IS NULL;
ALTER TABLE public.orders ENABLE TRIGGER orders_updated_at;

-- ── 2. Memberships ─────────────────────────────────────────────
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_membership_card BOOLEAN NOT NULL DEFAULT false;
UPDATE public.products SET is_membership_card = true WHERE name ILIKE 'membership%' AND NOT is_membership_card;

CREATE TABLE IF NOT EXISTS public.memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 100),
  phone       TEXT NOT NULL CHECK (phone ~ '^(\+977)?9[6-8][0-9]{8}$'),
  card_number TEXT CHECK (card_number IS NULL OR char_length(card_number) BETWEEN 1 AND 30),
  order_id    UUID REFERENCES public.orders(id) ON DELETE SET NULL,  -- survives the sales reset
  sold_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS memberships_created ON public.memberships (created_at DESC);
CREATE INDEX IF NOT EXISTS memberships_phone ON public.memberships (phone);
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;  -- no policies: service role only

-- ── 3. Training people ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.training_people (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  pin_hash   TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.training_assignments (
  person_id  UUID NOT NULL REFERENCES public.training_people(id) ON DELETE CASCADE,
  video_id   UUID NOT NULL REFERENCES public.training_videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (person_id, video_id)
);
CREATE TABLE IF NOT EXISTS public.training_people_progress (
  person_id    UUID NOT NULL REFERENCES public.training_people(id) ON DELETE CASCADE,
  video_id     UUID NOT NULL REFERENCES public.training_videos(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (person_id, video_id)
);
ALTER TABLE public.training_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_people_progress ENABLE ROW LEVEL SECURITY;
