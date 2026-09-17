-- ─────────────────────────────────────────────
-- FIX: infinite recursion between orders <-> deliveries RLS
--
-- orders."drivers read assigned orders" queried deliveries directly,
-- which re-triggers deliveries' own RLS, including
-- "customers read delivery of own order" — which queries back into
-- orders, which re-evaluates "drivers read assigned orders" again, ad
-- infinitum. Postgres detects this and raises 42P17 ("infinite
-- recursion detected in policy for relation orders").
--
-- This was always latent — it only surfaced once an anonymous/guest
-- request actually reached the orders table (see the guest order
-- tracking migration), because a real customer's own-row match on
-- customer_id short-circuited before ever touching this branch.
--
-- Fix: look up "is this order one of my assigned deliveries" through a
-- SECURITY DEFINER function. Its internal query runs with the function
-- owner's privileges, bypassing deliveries' RLS instead of re-entering
-- it — breaking the cycle while keeping the exact same access rule
-- (a driver can read an order iff they're its assigned driver).
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_my_assigned_delivery(target_order_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM deliveries WHERE order_id = target_order_id AND driver_id = auth.uid()
  )
$$;

DROP POLICY IF EXISTS "drivers read assigned orders" ON orders;
CREATE POLICY "drivers read assigned orders" ON orders
  FOR SELECT USING (
    public.get_my_role() = 'delivery_driver'
    AND public.is_my_assigned_delivery(id)
  );
