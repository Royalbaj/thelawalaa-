-- ============================================================
-- 1. FIX: orders had NO read policy for admin/super_admin at all,
--    so Realtime postgres_changes (which enforces RLS using the
--    caller's own JWT, unlike the service-role page-load fetch)
--    silently delivered zero events to the POS Live Orders panel
--    and the Dashboard feed whenever a new order came in.
-- ============================================================
DROP POLICY IF EXISTS "pos reads own-branch recent orders" ON orders;
DROP POLICY IF EXISTS "staff read all orders" ON orders;
CREATE POLICY "staff read all orders" ON orders
  FOR SELECT USING (public.get_my_role() IN ('pos_user', 'admin', 'super_admin'));

-- ============================================================
-- 2. MERGE super_admin -> admin (one management tier, not two)
-- ============================================================
UPDATE profiles SET role = 'admin' WHERE role = 'super_admin';

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
WHERE raw_app_meta_data->>'role' = 'super_admin';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'pos_user', 'delivery_driver', 'customer', 'accountant'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  requested_role TEXT := COALESCE(NEW.raw_app_meta_data->>'role', 'customer');
BEGIN
  IF requested_role NOT IN ('admin', 'pos_user', 'delivery_driver', 'customer', 'accountant') THEN
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

-- ============================================================
-- 3. Reset-to-launch: archive every order (with items + delivery)
--    into one JSON snapshot, then wipe sales data so the site can
--    start clean on opening day. Callable only via service role —
--    the admin server action checks role + PIN before ever calling it.
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_archives (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_by      UUID REFERENCES profiles(id),
  order_count   INTEGER NOT NULL,
  total_revenue NUMERIC(12,2) NOT NULL,
  snapshot      JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE sales_archives ENABLE ROW LEVEL SECURITY;
-- No client policies — service role only, same convention as audit_logs.

CREATE OR REPLACE FUNCTION public.reset_sales_data(p_actor UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_snapshot JSONB;
  v_order_count INTEGER;
  v_total_revenue NUMERIC(12,2);
  v_archive_id UUID;
BEGIN
  SELECT
    COALESCE(jsonb_agg(to_jsonb(o) || jsonb_build_object(
      'items', (SELECT COALESCE(jsonb_agg(to_jsonb(oi)), '[]'::jsonb) FROM order_items oi WHERE oi.order_id = o.id),
      'delivery', (SELECT to_jsonb(d) FROM deliveries d WHERE d.order_id = o.id)
    )), '[]'::jsonb),
    COUNT(*),
    COALESCE(SUM(o.total) FILTER (WHERE o.payment_status = 'paid'), 0)
  INTO v_snapshot, v_order_count, v_total_revenue
  FROM orders o;

  INSERT INTO sales_archives (reset_by, order_count, total_revenue, snapshot)
  VALUES (p_actor, v_order_count, v_total_revenue, v_snapshot)
  RETURNING id INTO v_archive_id;

  DELETE FROM loyalty_transactions WHERE order_id IS NOT NULL;
  UPDATE loyalty_points lp SET
    points = COALESCE((SELECT SUM(points_change) FROM loyalty_transactions lt WHERE lt.customer_id = lp.customer_id), 0),
    total_earned = COALESCE((SELECT SUM(points_change) FROM loyalty_transactions lt WHERE lt.customer_id = lp.customer_id AND points_change > 0), 0),
    updated_at = NOW();

  DELETE FROM orders;  -- cascades to order_items, deliveries, ratings
  DELETE FROM daily_order_counters;
  UPDATE promo_codes SET uses_count = 0;

  RETURN v_archive_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reset_sales_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_sales_data(UUID) TO service_role;

-- ============================================================
-- 4. Accounts app — stock/inventory + expenses, separate subdomain.
--    Read/write only via that app's server actions (service role,
--    after checking role = 'accountant' or 'admin').
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  unit          TEXT NOT NULL DEFAULT 'kg',
  quantity      NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_level NUMERIC(12,3) NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS stock_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('restock', 'usage', 'wastage', 'adjustment')),
  quantity      NUMERIC(12,3) NOT NULL,
  note          TEXT,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL,
  description   TEXT,
  amount        NUMERIC(12,2) NOT NULL,
  spent_at      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
