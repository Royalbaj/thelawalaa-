-- ============================================================
-- 1. Consent: customers are never signed up for offers by default — they
--    tick the box at sign-up or tap "Join" in their account. Accepting the
--    Terms is recorded too. Both are written by the server only.
-- 2. Delivery location: the address text and the exact pin a customer
--    shares at checkout, kept on the order for the driver's map.
-- 3. Notifications: messages the admin sends to customers who joined
--    offers, or to delivery drivers (shown in their portal, plus email/push).
-- ============================================================

-- ── 1. Consent ────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_opt_in      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_accepted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notifications_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_marketing_opt_in ON public.profiles (id) WHERE marketing_opt_in;

-- A signed-in user writing their own profile row (RLS "update own profile")
-- can't change their role — nor, now, their consent record.
CREATE OR REPLACE FUNCTION public.prevent_privilege_self_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'authenticated' THEN
    NEW.role                := OLD.role;
    NEW.is_active           := OLD.is_active;
    NEW.branch_id           := OLD.branch_id;
    NEW.marketing_opt_in    := OLD.marketing_opt_in;
    NEW.marketing_opt_in_at := OLD.marketing_opt_in_at;
    NEW.terms_accepted_at   := OLD.terms_accepted_at;
  END IF;
  RETURN NEW;
END $$;

-- ── 2. Delivery location ──────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address    TEXT CHECK (delivery_address IS NULL OR char_length(delivery_address) <= 300),
  ADD COLUMN IF NOT EXISTS delivery_lat        DOUBLE PRECISION CHECK (delivery_lat IS NULL OR delivery_lat BETWEEN -90 AND 90),
  ADD COLUMN IF NOT EXISTS delivery_lng        DOUBLE PRECISION CHECK (delivery_lng IS NULL OR delivery_lng BETWEEN -180 AND 180),
  ADD COLUMN IF NOT EXISTS delivery_accuracy_m INTEGER CHECK (delivery_accuracy_m IS NULL OR delivery_accuracy_m >= 0);

-- Past delivery orders: the address was only in the notes header.
-- (updated_at is left alone — these orders didn't really change.)
ALTER TABLE public.orders DISABLE TRIGGER orders_updated_at;
UPDATE public.orders
SET delivery_address = left(trim(substring(notes FROM 'Address:\s*([^\n]+)')), 300)
WHERE type = 'delivery' AND delivery_address IS NULL AND notes ~ 'Address:';
ALTER TABLE public.orders ENABLE TRIGGER orders_updated_at;

-- ── 3. Notifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience   TEXT NOT NULL CHECK (audience IN ('customers', 'drivers')),
  title      TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 80),
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 2 AND 500),
  link_url   TEXT CHECK (link_url IS NULL OR char_length(link_url) <= 300),
  emailed    INTEGER NOT NULL DEFAULT 0,
  pushed     INTEGER NOT NULL DEFAULT 0,
  sent_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_audience_created ON public.notifications (audience, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;  -- no policies: service role only, after a role check
