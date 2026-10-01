-- ============================================================
-- POS devices (the counter iPad) subscribe to Web Push so a new online
-- order alerts them even when the POS isn't open. customer_id holds the
-- profile that subscribed — staff devices included. One row per device
-- endpoint, so turning alerts on again updates it in place.
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_key ON public.push_subscriptions (endpoint);
COMMENT ON COLUMN public.push_subscriptions.customer_id IS 'Profile that subscribed — customers and staff devices alike.';
