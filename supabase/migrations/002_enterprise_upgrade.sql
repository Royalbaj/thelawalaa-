-- ============================================================
-- THELAWALAA — Enterprise upgrade migration
-- Adds: super_admin role, offers, loyalty, favorites, ratings
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Add 'super_admin' to allowed roles
-- ─────────────────────────────────────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin','admin','pos_user','delivery_driver','customer'));

-- Upgrade existing admin(s) to super_admin
UPDATE profiles SET role = 'super_admin' WHERE role = 'admin';

-- Update the trigger to accept new role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  requested_role TEXT := COALESCE(NEW.raw_app_meta_data->>'role', 'customer');
BEGIN
  IF requested_role NOT IN ('super_admin','admin','pos_user','delivery_driver','customer') THEN
    requested_role := 'customer';
  END IF;
  INSERT INTO profiles (id, full_name, phone, role, branch_id, vehicle_type, vehicle_number)
  VALUES (
    NEW.id,
    LEFT(COALESCE(NEW.raw_user_meta_data->>'full_name', 'Customer'), 100),
    LEFT(NEW.raw_user_meta_data->>'phone', 20),
    requested_role,
    NULLIF(NEW.raw_app_meta_data->>'branch_id','')::uuid,
    NULLIF(NEW.raw_app_meta_data->>'vehicle_type',''),
    LEFT(NEW.raw_app_meta_data->>'vehicle_number', 20)
  );
  RETURN NEW;
END;
$$;

-- Update privilege guard to allow super_admin changes via service role
CREATE OR REPLACE FUNCTION public.prevent_privilege_self_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'authenticated' THEN
    NEW.role      := OLD.role;
    NEW.is_active := OLD.is_active;
    NEW.branch_id := OLD.branch_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Update role helper
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true
$$;

-- ─────────────────────────────────────────────
-- 2. OFFERS / DEALS (like McDonald's deals)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  image_url       TEXT,
  offer_type      TEXT NOT NULL CHECK (offer_type IN ('deal','banner','reward')),
  -- deal: links to a promo code; banner: just visual; reward: loyalty redeem
  promo_code_id   UUID REFERENCES promo_codes(id),
  product_ids     UUID[] DEFAULT '{}',       -- featured products in this deal
  discount_label  TEXT,                       -- e.g. "20% OFF" or "Buy 1 Get 1"
  is_active       BOOLEAN NOT NULL DEFAULT true,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at         TIMESTAMPTZ,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all','new','returning','loyalty')),
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 3. LOYALTY POINTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_points (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points       INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent  INTEGER NOT NULL DEFAULT 0,
  tier         TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id)
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id        UUID REFERENCES orders(id),
  points_change   INTEGER NOT NULL, -- positive = earned, negative = spent
  reason          TEXT NOT NULL,     -- 'order_reward', 'redemption', 'bonus', 'signup'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 4. CUSTOMER FAVORITES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_favorites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_id, product_id)
);

-- ─────────────────────────────────────────────
-- 5. ORDER RATINGS / FEEDBACK
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_ratings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  customer_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  food_rating    INTEGER NOT NULL CHECK (food_rating BETWEEN 1 AND 5),
  delivery_rating INTEGER CHECK (delivery_rating BETWEEN 1 AND 5),
  comment        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 6. RLS POLICIES for new tables
-- ─────────────────────────────────────────────
ALTER TABLE offers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points      ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_favorites  ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_ratings       ENABLE ROW LEVEL SECURITY;

-- Offers: public read of active offers
CREATE POLICY "public read active offers" ON offers
  FOR SELECT USING (is_active = true AND starts_at <= NOW() AND (ends_at IS NULL OR ends_at > NOW()));

-- Loyalty: customers read their own
CREATE POLICY "own loyalty" ON loyalty_points
  FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "own loyalty transactions" ON loyalty_transactions
  FOR SELECT USING (auth.uid() = customer_id);

-- Favorites: customers CRUD their own
CREATE POLICY "own favorites" ON customer_favorites
  FOR ALL USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);

-- Ratings: customers can insert their own
CREATE POLICY "insert own rating" ON order_ratings
  FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "read own ratings" ON order_ratings
  FOR SELECT USING (auth.uid() = customer_id);

-- ─────────────────────────────────────────────
-- 7. UPDATED TRIGGER for updated_at
-- ─────────────────────────────────────────────
CREATE TRIGGER loyalty_points_updated_at BEFORE UPDATE ON loyalty_points FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─────────────────────────────────────────────
-- 8. Give signup bonus
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.give_signup_loyalty()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.role = 'customer' THEN
    INSERT INTO loyalty_points (customer_id, points, total_earned)
    VALUES (NEW.id, 50, 50)
    ON CONFLICT (customer_id) DO NOTHING;
    INSERT INTO loyalty_transactions (customer_id, points_change, reason)
    VALUES (NEW.id, 50, 'signup');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_customer_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.give_signup_loyalty();
