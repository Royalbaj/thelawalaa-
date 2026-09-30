-- ============================================================
-- 1. Live updates. The supabase_realtime publication had NO tables, so
--    postgres_changes never fired: the POS Live Orders panel, the admin
--    dashboard feed and the driver dashboard only changed on a manual
--    refresh. Realtime still enforces RLS per subscriber ("staff read all
--    orders", "drivers read own deliveries").
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders, public.deliveries;

-- ============================================================
-- 2. reset_sales_data always failed with "UPDATE requires a WHERE clause":
--    it's called through the API, whose connections preload pg-safeupdate,
--    and that refuses any UPDATE/DELETE without a WHERE — even inside a
--    function. Same function with explicit WHERE clauses; CREATE OR REPLACE
--    keeps the grants (service_role only, see 016).
-- ============================================================
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
    updated_at = NOW()
  WHERE true;

  DELETE FROM orders WHERE true;  -- cascades to order_items, deliveries, ratings
  DELETE FROM daily_order_counters WHERE true;
  UPDATE promo_codes SET uses_count = 0 WHERE true;

  RETURN v_archive_id;
END;
$$;
