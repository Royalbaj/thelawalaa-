-- ============================================================
-- Rewards v2 + customer accounts.
--
-- Rules (all editable in Admin → Rewards, one row in reward_settings):
--   earn   : every Rs 100 paid earns points worth Rs `earn_rupees_per_100` (2)
--   value  : `points_per_rupee` points = Rs 1 (100 → 1,000 points = Rs 10)
--   use    : only once a customer has `min_redeem_points` (1,000), in whole rupees
--   stamp  : every `free_item_orders` (25) paid orders → one free `free_item_product_id`
--   welcome: `welcome_points` on signup (50)
--
-- All balance changes go through the functions below (service role only),
-- each keyed on the order so a retry/double-click can't pay out twice:
--   loyalty_award(order)     — order became paid: points + a stamp
--   loyalty_unaward(order)   — paid was undone: take them back
--   loyalty_take(...)        — checkout: atomically spend points / a free item
--   loyalty_give_back(...)   — checkout failed after taking: return them
--   loyalty_on_cancel(order) — cancelled: refund what it spent, undo what it earned
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reward_settings (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  enabled              BOOLEAN NOT NULL DEFAULT true,
  earn_rupees_per_100  NUMERIC(6,2) NOT NULL DEFAULT 2 CHECK (earn_rupees_per_100 BETWEEN 0 AND 100),
  points_per_rupee     INTEGER NOT NULL DEFAULT 100 CHECK (points_per_rupee BETWEEN 1 AND 10000),
  min_redeem_points    INTEGER NOT NULL DEFAULT 1000 CHECK (min_redeem_points >= 0),
  welcome_points       INTEGER NOT NULL DEFAULT 50 CHECK (welcome_points BETWEEN 0 AND 100000),
  free_item_enabled    BOOLEAN NOT NULL DEFAULT true,
  free_item_orders     INTEGER NOT NULL DEFAULT 25 CHECK (free_item_orders BETWEEN 1 AND 1000),
  free_item_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  updated_by           UUID REFERENCES public.profiles(id),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.reward_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can read reward rules" ON public.reward_settings;
CREATE POLICY "anyone can read reward rules" ON public.reward_settings FOR SELECT USING (true);
INSERT INTO public.reward_settings (id, free_item_product_id)
VALUES (1, (SELECT id FROM public.products WHERE name ILIKE 'coca%' ORDER BY created_at LIMIT 1))
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.loyalty_points
  ADD COLUMN IF NOT EXISTS order_count INTEGER NOT NULL DEFAULT 0,  -- stamps towards the next free item
  ADD COLUMN IF NOT EXISTS free_items  INTEGER NOT NULL DEFAULT 0;  -- free items ready to claim

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS points_redeemed    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_discount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_item_redeemed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS points_earned      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_counted    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loyalty_refunded   BOOLEAN NOT NULL DEFAULT false;

-- History keeps its rows if an order is deleted (Admin → Settings → reset sales data).
ALTER TABLE public.loyalty_transactions DROP CONSTRAINT IF EXISTS loyalty_transactions_order_id_fkey;
ALTER TABLE public.loyalty_transactions ADD CONSTRAINT loyalty_transactions_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

-- Welcome email is sent once, after the customer verifies.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS welcomed_at TIMESTAMPTZ;
UPDATE public.profiles p SET welcomed_at = NOW()
FROM auth.users u
WHERE u.id = p.id AND p.role = 'customer' AND u.email_confirmed_at IS NOT NULL AND p.welcomed_at IS NULL;

-- ── Earning ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.loyalty_award(p_order UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o orders%ROWTYPE; s reward_settings%ROWTYPE;
  pts INTEGER := 0; per INTEGER := 0; new_free INTEGER := 0;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND OR o.customer_id IS NULL OR o.loyalty_counted
     OR o.payment_status <> 'paid' OR o.status = 'cancelled' THEN RETURN; END IF;
  SELECT * INTO s FROM reward_settings WHERE id = 1;
  IF FOUND AND s.enabled THEN
    pts := FLOOR(o.total * s.earn_rupees_per_100 / 100 * s.points_per_rupee);
    IF s.free_item_enabled THEN per := s.free_item_orders; END IF;
  END IF;

  INSERT INTO loyalty_points (customer_id, points, total_earned) VALUES (o.customer_id, 0, 0)
  ON CONFLICT (customer_id) DO NOTHING;
  UPDATE loyalty_points SET
    points       = points + pts,
    total_earned = total_earned + pts,
    free_items   = free_items + CASE WHEN per > 0 THEN (order_count + 1) / per ELSE 0 END,
    order_count  = CASE WHEN per > 0 THEN (order_count + 1) % per ELSE order_count + 1 END,
    updated_at   = NOW()
  WHERE customer_id = o.customer_id
  RETURNING CASE WHEN per > 0 AND order_count = 0 THEN 1 ELSE 0 END INTO new_free;

  UPDATE orders SET points_earned = pts, loyalty_counted = true WHERE id = p_order;
  IF pts > 0 THEN
    INSERT INTO loyalty_transactions (customer_id, order_id, points_change, reason)
    VALUES (o.customer_id, p_order, pts, 'order_reward');
  END IF;
  IF new_free = 1 THEN
    INSERT INTO loyalty_transactions (customer_id, order_id, points_change, reason)
    VALUES (o.customer_id, p_order, 0, 'free_item_earned');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.loyalty_unaward(p_order UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE; per INTEGER;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND OR o.customer_id IS NULL OR NOT o.loyalty_counted THEN RETURN; END IF;
  SELECT CASE WHEN free_item_enabled THEN free_item_orders ELSE 0 END INTO per FROM reward_settings WHERE id = 1;
  UPDATE loyalty_points SET
    points       = GREATEST(points - o.points_earned, 0),
    total_earned = GREATEST(total_earned - o.points_earned, 0),
    -- Take the stamp back; if that stamp had just completed a card, take the unclaimed free item back too.
    free_items   = CASE WHEN order_count = 0 AND free_items > 0 THEN free_items - 1 ELSE free_items END,
    order_count  = CASE WHEN order_count > 0 THEN order_count - 1
                        WHEN free_items > 0 AND COALESCE(per, 0) > 0 THEN per - 1 ELSE 0 END,
    updated_at   = NOW()
  WHERE customer_id = o.customer_id;
  IF o.points_earned > 0 THEN
    INSERT INTO loyalty_transactions (customer_id, order_id, points_change, reason)
    VALUES (o.customer_id, p_order, -o.points_earned, 'reversal');
  END IF;
  UPDATE orders SET points_earned = 0, loyalty_counted = false WHERE id = p_order;
END $$;

-- ── Spending at checkout ───────────────────────────────────────
-- One conditional UPDATE: succeeds only if the balance is still there,
-- so two checkouts racing can't spend the same points twice.
CREATE OR REPLACE FUNCTION public.loyalty_take(p_customer UUID, p_points INTEGER, p_free BOOLEAN)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_points <= 0 AND NOT p_free THEN RETURN true; END IF;
  UPDATE loyalty_points SET
    points      = points - GREATEST(p_points, 0),
    total_spent = total_spent + GREATEST(p_points, 0),
    free_items  = free_items - CASE WHEN p_free THEN 1 ELSE 0 END,
    updated_at  = NOW()
  WHERE customer_id = p_customer
    AND points >= GREATEST(p_points, 0)
    AND (NOT p_free OR free_items >= 1);
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.loyalty_give_back(p_customer UUID, p_points INTEGER, p_free BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE loyalty_points SET
    points      = points + GREATEST(p_points, 0),
    total_spent = GREATEST(total_spent - GREATEST(p_points, 0), 0),
    free_items  = free_items + CASE WHEN p_free THEN 1 ELSE 0 END,
    updated_at  = NOW()
  WHERE customer_id = p_customer;
END $$;

CREATE OR REPLACE FUNCTION public.loyalty_on_cancel(p_order UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND OR o.customer_id IS NULL THEN RETURN; END IF;
  IF NOT o.loyalty_refunded AND (o.points_redeemed > 0 OR o.free_item_redeemed) THEN
    PERFORM loyalty_give_back(o.customer_id, o.points_redeemed, o.free_item_redeemed);
    INSERT INTO loyalty_transactions (customer_id, order_id, points_change, reason)
    VALUES (o.customer_id, p_order, o.points_redeemed, 'refund');
    UPDATE orders SET loyalty_refunded = true WHERE id = p_order;
  END IF;
  PERFORM loyalty_unaward(p_order);
END $$;

-- The welcome bonus now comes from the settings (0 turns it off).
CREATE OR REPLACE FUNCTION public.give_signup_loyalty()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pts INTEGER;
BEGIN
  IF NEW.role = 'customer' THEN
    SELECT CASE WHEN enabled THEN welcome_points ELSE 0 END INTO pts FROM reward_settings WHERE id = 1;
    pts := COALESCE(pts, 0);
    INSERT INTO loyalty_points (customer_id, points, total_earned) VALUES (NEW.id, pts, pts)
    ON CONFLICT (customer_id) DO NOTHING;
    IF pts > 0 THEN
      INSERT INTO loyalty_transactions (customer_id, points_change, reason) VALUES (NEW.id, pts, 'signup');
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- ── Sign-up / reset helpers ────────────────────────────────────
-- Whether an email already has an account (and is verified) — for the
-- server-side sign-up and reset flows, which never reveal it to the caller.
CREATE OR REPLACE FUNCTION public.auth_user_status(p_email TEXT)
RETURNS TABLE (id UUID, confirmed BOOLEAN, full_name TEXT, role TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT u.id, u.email_confirmed_at IS NOT NULL, p.full_name, p.role
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = lower(btrim(p_email))
  LIMIT 1;
$$;

-- Throttle for account emails (sign-up, resend, reset): keyed hashes only.
CREATE TABLE IF NOT EXISTS public.email_throttle (
  id         BIGSERIAL PRIMARY KEY,
  kind       TEXT NOT NULL,
  key_hash   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_throttle_lookup ON public.email_throttle (kind, key_hash, created_at DESC);
ALTER TABLE public.email_throttle ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['loyalty_award(uuid)', 'loyalty_unaward(uuid)', 'loyalty_take(uuid,integer,boolean)',
                           'loyalty_give_back(uuid,integer,boolean)', 'loyalty_on_cancel(uuid)', 'auth_user_status(text)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
