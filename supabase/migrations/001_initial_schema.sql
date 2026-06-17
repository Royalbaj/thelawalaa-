-- ============================================================
-- THELAWALAA — initial schema (security hardened)
-- Key fixes vs naive version:
--  1. Roles are NEVER read from raw_user_meta_data (client-settable!).
--     They come from raw_app_meta_data (service-role only) or default 'customer'.
--  2. RLS helper functions are SECURITY DEFINER to avoid infinite
--     recursion when policies need to read profiles.
--  3. Delivery OTP is stored as an HMAC hash, never plaintext.
--  4. Order numbers use a sequence (random 4 digits collide).
--  5. Audit logs have zero client policies (service role only).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- BRANCHES
-- ─────────────────────────────────────────────
CREATE TABLE branches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  address     TEXT NOT NULL,
  lat         NUMERIC,
  lng         NUMERIC,
  phone       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ─────────────────────────────────────────────
CREATE TABLE profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                TEXT NOT NULL DEFAULT 'customer'
                        CHECK (role IN ('admin','pos_user','delivery_driver','customer')),
  full_name           TEXT NOT NULL,
  phone               TEXT,
  avatar_url          TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  branch_id           UUID REFERENCES branches(id),
  vehicle_type        TEXT CHECK (vehicle_type IN ('bike','scooter','cycle')),
  vehicle_number      TEXT,
  is_online           BOOLEAN NOT NULL DEFAULT false,
  invite_accepted_at  TIMESTAMPTZ,
  last_seen_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- SECURITY-DEFINER HELPERS (prevent RLS recursion + centralize checks)
-- search_path pinned to stop search-path hijacking.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true
$$;

CREATE OR REPLACE FUNCTION public.get_my_branch()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT branch_id FROM profiles WHERE id = auth.uid() AND is_active = true
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_role()  FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_branch() FROM anon;

-- ─────────────────────────────────────────────
-- ADDRESSES
-- ─────────────────────────────────────────────
CREATE TABLE addresses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label        TEXT NOT NULL DEFAULT 'Home',
  full_address TEXT NOT NULL,
  lat          NUMERIC,
  lng          NUMERIC,
  is_default   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- CATEGORIES / PRODUCTS
-- ─────────────────────────────────────────────
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  image_url     TEXT,
  is_available  BOOLEAN NOT NULL DEFAULT true,
  is_veg        BOOLEAN NOT NULL DEFAULT true,
  spice_level   INTEGER NOT NULL DEFAULT 0 CHECK (spice_level BETWEEN 0 AND 3),
  is_bestseller BOOLEAN NOT NULL DEFAULT false,
  is_featured   BOOLEAN NOT NULL DEFAULT false,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- PROMO CODES
-- ─────────────────────────────────────────────
CREATE TABLE promo_codes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT UNIQUE NOT NULL,
  description      TEXT,
  discount_type    TEXT NOT NULL CHECK (discount_type IN ('percent','flat')),
  discount_value   NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_uses         INTEGER,
  uses_count       INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- ORDERS
-- ─────────────────────────────────────────────
CREATE SEQUENCE order_number_seq;

CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        TEXT UNIQUE NOT NULL,
  customer_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  placed_by           UUID REFERENCES profiles(id), -- POS operator, if any
  branch_id           UUID REFERENCES branches(id),
  type                TEXT NOT NULL CHECK (type IN ('pickup','delivery','dine_in')),
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                          'pending','confirmed','preparing','ready',
                          'assigned','picked_up','on_the_way','delivered','cancelled'
                        )),
  subtotal            NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  delivery_fee        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  discount_amount     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total               NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  delivery_address_id UUID REFERENCES addresses(id),
  pickup_time         TIMESTAMPTZ,
  payment_method      TEXT CHECK (payment_method IN ('cash','qr','card')),
  payment_status      TEXT NOT NULL DEFAULT 'pending'
                        CHECK (payment_status IN ('pending','paid','failed','refunded')),
  -- Manual payment confirmation (no gateway in Nepal yet):
  paid_confirmed_by   UUID REFERENCES profiles(id),
  paid_confirmed_at   TIMESTAMPTZ,
  promo_code_id       UUID REFERENCES promo_codes(id),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX orders_customer_idx ON orders(customer_id, created_at DESC);
CREATE INDEX orders_branch_day_idx ON orders(branch_id, created_at DESC);
CREATE INDEX orders_status_idx ON orders(status);

CREATE TABLE order_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id           UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name         TEXT NOT NULL,          -- snapshot
  product_price        NUMERIC(10,2) NOT NULL, -- snapshot
  quantity             INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  customization_notes  TEXT,
  line_total           NUMERIC(10,2) NOT NULL
);
CREATE INDEX order_items_order_idx ON order_items(order_id);

-- ─────────────────────────────────────────────
-- DELIVERIES — OTP stored as hash only
-- ─────────────────────────────────────────────
CREATE TABLE deliveries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at       TIMESTAMPTZ,
  picked_up_at      TIMESTAMPTZ,
  on_the_way_at     TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  delivery_otp_hash TEXT,                       -- HMAC-SHA256, computed server-side
  otp_attempts      INTEGER NOT NULL DEFAULT 0,
  otp_verified      BOOLEAN NOT NULL DEFAULT false,
  driver_notes      TEXT,
  rating            INTEGER CHECK (rating BETWEEN 1 AND 5),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX deliveries_driver_idx ON deliveries(driver_id, assigned_at DESC);

-- ─────────────────────────────────────────────
-- ANNOUNCEMENTS / CONTACT / AUDIT
-- ─────────────────────────────────────────────
CREATE TABLE announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message     TEXT NOT NULL,
  link_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  starts_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at     TIMESTAMPTZ,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contact_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  subject     TEXT,
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  target_table TEXT,
  target_id    UUID,
  old_data     JSONB,
  new_data     JSONB,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────

-- SECURITY FIX: role comes from raw_APP_meta_data only.
-- raw_user_meta_data is fully controlled by the signing-up client and
-- must NEVER decide privileges. app_metadata can only be set with the
-- service role key (staff invite flow does this server-side).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  requested_role TEXT := COALESCE(NEW.raw_app_meta_data->>'role', 'customer');
BEGIN
  IF requested_role NOT IN ('admin','pos_user','delivery_driver','customer') THEN
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Collision-free human-readable order numbers: TW-YYYYMMDD-000123
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.order_number := 'TW-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD(nextval('order_number_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER orders_updated_at   BEFORE UPDATE ON orders   FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Hard guard: a client can never change its own role / is_active / branch,
-- even if a permissive UPDATE policy slips in later. Service role bypasses
-- triggers? No — it doesn't, so we check the JWT claim role.
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

CREATE TRIGGER profiles_privilege_guard
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_privilege_self_escalation();

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs          ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- (role/is_active/branch changes are still blocked by the trigger above;
--  admin reads/writes of OTHER profiles happen server-side via service role)

-- ADDRESSES
CREATE POLICY "own addresses" ON addresses
  FOR ALL USING (auth.uid() = customer_id) WITH CHECK (auth.uid() = customer_id);

-- BRANCHES — public read of active branches only
CREATE POLICY "public read active branches" ON branches
  FOR SELECT USING (is_active = true);

-- CATEGORIES / PRODUCTS — public read
CREATE POLICY "public read categories" ON categories
  FOR SELECT USING (is_active = true);
CREATE POLICY "public read products" ON products
  FOR SELECT USING (is_available = true);

-- PROMO CODES — no client read. Validation happens via server action with
-- the service role so codes can't be enumerated.

-- ORDERS
CREATE POLICY "customers read own orders" ON orders
  FOR SELECT USING (auth.uid() = customer_id);
-- NOTE: customers do NOT get an INSERT policy. Orders are created only by
-- the createOrder server action (service role) which recalculates totals
-- server-side. This blocks crafted inserts with fake totals/fees.

CREATE POLICY "pos reads own-branch recent orders" ON orders
  FOR SELECT USING (
    public.get_my_role() = 'pos_user'
    AND branch_id = public.get_my_branch()
    AND created_at > NOW() - INTERVAL '1 day'
  );

CREATE POLICY "drivers read assigned orders" ON orders
  FOR SELECT USING (
    public.get_my_role() = 'delivery_driver'
    AND id IN (SELECT order_id FROM deliveries WHERE driver_id = auth.uid())
  );

-- ORDER ITEMS
CREATE POLICY "read items of visible orders" ON order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders)  -- delegates to orders RLS
  );

-- DELIVERIES
CREATE POLICY "drivers read own deliveries" ON deliveries
  FOR SELECT USING (auth.uid() = driver_id);
CREATE POLICY "customers read delivery of own order" ON deliveries
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
  );
-- Status transitions + OTP verification go through server actions only
-- (no client UPDATE policy), so attempt counters can't be reset and
-- timestamps can't be forged.

-- ANNOUNCEMENTS
CREATE POLICY "public read live announcements" ON announcements
  FOR SELECT USING (
    is_active = true AND starts_at <= NOW()
    AND (ends_at IS NULL OR ends_at > NOW())
  );

-- CONTACT — insert only, nobody can read from the client
CREATE POLICY "anyone can submit contact form" ON contact_submissions
  FOR INSERT WITH CHECK (true);

-- AUDIT LOGS — zero policies: completely invisible to clients.

-- ─────────────────────────────────────────────
-- STORAGE BUCKETS (avatars + product images)
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars','avatars', true),
  ('products','products', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "avatar owner write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "avatar owner update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "public read images" ON storage.objects
  FOR SELECT USING (bucket_id IN ('avatars','products'));
-- product image uploads: service role only (admin server actions)
