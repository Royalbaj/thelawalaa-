-- 041: half plates at the POS, and member price only with a member's card.

-- ── Half plates ─────────────────────────────────────────────────────────────
-- An item can be sold as 1, 1½, 2, 2½ … plates at the counter — never a half
-- on its own. The extra half is its own order line at the item's half price
-- (set in Admin → Menu; blank = no half option) with portion 0.5, so stock
-- counts half a plate. Member price never applies to the half (owner's call).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS half_price numeric CHECK (half_price IS NULL OR half_price > 0);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS portion numeric NOT NULL DEFAULT 1 CHECK (portion > 0 AND portion <= 1);

-- Stock (migration 024) counts a half plate as half of what a plate uses.
CREATE OR REPLACE FUNCTION public.stock_levels(p_item uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, name text, unit text, reorder_level numeric, counted numeric, counted_at timestamp with time zone, added numeric, used numeric, sold numeric, remaining numeric, sold_today numeric, sold_7d numeric, alert_state text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    SELECT SUM(oi.quantity * oi.portion * l.units_per_sale) FILTER (WHERE o.created_at >= s.counted_at) AS sold,
           SUM(oi.quantity * oi.portion * l.units_per_sale) FILTER (
             WHERE o.created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kathmandu') AT TIME ZONE 'Asia/Kathmandu')
           ) AS sold_today,
           SUM(oi.quantity * oi.portion * l.units_per_sale) FILTER (WHERE o.created_at >= now() - interval '7 days') AS sold_7d
    FROM stock_item_products l
    JOIN order_items oi ON oi.product_id = l.product_id
    JOIN orders o ON o.id = oi.order_id AND o.status <> 'cancelled'
    WHERE l.stock_item_id = s.id
      AND o.created_at >= LEAST(s.counted_at, now() - interval '7 days')
  ) x ON true
  WHERE s.is_active AND (p_item IS NULL OR s.id = p_item)
  ORDER BY s.name;
$function$;

-- ── Member price needs the member's card ────────────────────────────────────
-- The POS asks for the last 3 digits of the card number; createPosOrder checks
-- them again and records whose card it was (card_number copied, so the order
-- keeps it if the card is renumbered or removed).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS member_card text;
CREATE INDEX IF NOT EXISTS orders_membership_id_idx ON public.orders (membership_id) WHERE membership_id IS NOT NULL;
