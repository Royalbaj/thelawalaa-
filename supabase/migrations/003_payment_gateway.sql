-- ─────────────────────────────────────────────
-- ONLINE PAYMENT GATEWAY (eSewa ePay v2)
--
-- Cash/QR-in-person orders keep the existing manual flow: they start
-- payment_status 'pending' and only an admin can flip them via
-- markOrderPaid (audited, actor = the admin).
--
-- Gateway orders (payment_method = 'esewa') are different: the gateway
-- itself is the source of truth for "did the money move". Our callback
-- route re-verifies the transaction server-side against eSewa's status
-- API (never trusts the redirect payload alone) and flips payment_status
-- to 'paid' automatically. That audit row has actor_id NULL — "the
-- system", not a human — so it stays distinguishable from an admin's
-- manual confirmation.
-- ─────────────────────────────────────────────

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cash','qr','card','esewa'));

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT
    CHECK (payment_gateway IN ('esewa')),
  ADD COLUMN IF NOT EXISTS gateway_transaction_uuid TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS gateway_ref_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS orders_gateway_txn_idx ON orders(gateway_transaction_uuid);
