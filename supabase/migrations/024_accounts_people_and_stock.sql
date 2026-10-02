-- ============================================================
-- Accounts app, part 2.
-- 1. People: the admin adds each person who uses Accounts with a name
--    and their own 4-digit PIN. The PIN screen works out who it is, and
--    every entry / stock change records that person.
-- 2. Stock that follows the POS: a stock item (e.g. "Buff momo", 50
--    plates) can be linked to POS menu items. What's left is worked out
--    live — last count + restocks − waste − POS sales since the count —
--    so a cancelled order puts its stock back by itself.
-- Same rule as 023: RLS on, no policies — service role only, after the
-- app's own sign-in + PIN checks.
-- ============================================================

-- 1. People ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  pin_hash   TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
ALTER TABLE public.account_users ENABLE ROW LEVEL SECURITY;

-- The shared PIN everyone used so far becomes the first person, so nobody
-- is locked out; the admin renames them and adds the others.
INSERT INTO public.account_users (name, pin_hash)
SELECT 'Manager', pin_hash FROM public.account_settings
WHERE id = 1 AND NOT EXISTS (SELECT 1 FROM public.account_users);

ALTER TABLE public.account_transactions
  ADD COLUMN IF NOT EXISTS entered_by UUID REFERENCES public.account_users(id),
  ADD COLUMN IF NOT EXISTS edited_by  UUID REFERENCES public.account_users(id);

-- 2. Stock ------------------------------------------------------------
-- stock_items.quantity is now "what we counted at counted_at"; everything
-- after that is added (restock) or taken away (waste, POS sales).
ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS counted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Last alert sent ('low' / 'out'), so each drop only notifies once.
  ADD COLUMN IF NOT EXISTS alert_state TEXT CHECK (alert_state IN ('low', 'out'));

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS entered_by UUID REFERENCES public.account_users(id);

-- Which POS menu items use this stock, and how much per one sold.
CREATE TABLE IF NOT EXISTS public.stock_item_products (
  stock_item_id  UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  units_per_sale NUMERIC(10,3) NOT NULL DEFAULT 1 CHECK (units_per_sale > 0),
  PRIMARY KEY (stock_item_id, product_id)
);
ALTER TABLE public.stock_item_products ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS order_items_product_idx ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS orders_created_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_item_idx ON public.stock_movements (stock_item_id, created_at);
CREATE INDEX IF NOT EXISTS stock_item_products_product_idx ON public.stock_item_products (product_id);

-- What's left of each active stock item right now (or just one).
CREATE OR REPLACE FUNCTION public.stock_levels(p_item UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID, name TEXT, unit TEXT, reorder_level NUMERIC, counted NUMERIC, counted_at TIMESTAMPTZ,
  added NUMERIC, used NUMERIC, sold NUMERIC, remaining NUMERIC,
  sold_today NUMERIC, sold_7d NUMERIC, alert_state TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.unit, s.reorder_level, s.quantity, s.counted_at,
         COALESCE(m.added, 0), COALESCE(m.used, 0), COALESCE(x.sold, 0),
         s.quantity + COALESCE(m.added, 0) - COALESCE(m.used, 0) - COALESCE(x.sold, 0),
         COALESCE(x.sold_today, 0), COALESCE(x.sold_7d, 0), s.alert_state
  FROM stock_items s
  LEFT JOIN LATERAL (
    SELECT SUM(mv.quantity) FILTER (WHERE mv.type = 'restock') AS added,
           SUM(mv.quantity) FILTER (WHERE mv.type IN ('usage', 'wastage')) AS used
    FROM stock_movements mv
    WHERE mv.stock_item_id = s.id AND mv.created_at > s.counted_at
  ) m ON true
  LEFT JOIN LATERAL (
    SELECT SUM(oi.quantity * l.units_per_sale) FILTER (WHERE o.created_at >= s.counted_at) AS sold,
           SUM(oi.quantity * l.units_per_sale) FILTER (
             WHERE o.created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kathmandu') AT TIME ZONE 'Asia/Kathmandu')
           ) AS sold_today,
           SUM(oi.quantity * l.units_per_sale) FILTER (WHERE o.created_at >= now() - interval '7 days') AS sold_7d
    FROM stock_item_products l
    JOIN order_items oi ON oi.product_id = l.product_id
    JOIN orders o ON o.id = oi.order_id AND o.status <> 'cancelled'
    WHERE l.stock_item_id = s.id
      AND o.created_at >= LEAST(s.counted_at, now() - interval '7 days')
  ) x ON true
  WHERE s.is_active AND (p_item IS NULL OR s.id = p_item)
  ORDER BY s.name;
$$;
REVOKE ALL ON FUNCTION public.stock_levels(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_levels(UUID) TO service_role;
