-- ─────────────────────────────────────────────
-- GUEST ORDER TRACKING
--
-- Guest checkouts have customer_id = NULL and, until now, NO read policy
-- matched that row at all — not even the guest who placed it could ever
-- load /track/[orderId] (nor the "Track your order" link emailed to
-- them). The order id is an unguessable UUID, so "you have the link" is
-- the intended authorization model here, same as most guest-checkout
-- order trackers — this does not weaken access to any order that has a
-- real customer_id (still gated by "customers read own orders").
-- ─────────────────────────────────────────────

CREATE POLICY "guest orders readable by id" ON orders
  FOR SELECT USING (customer_id IS NULL);
