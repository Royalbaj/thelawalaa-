-- ============================================================
-- Waste & loss (owner's call, Nov 2026) — Accounts app → Stock → Waste & loss.
--
-- A record of what the shop lost: food wasted or spoiled, things broken or
-- damaged, things missing, any other loss. What it was, how much it was worth
-- (a guess is fine), why, who wrote it, and an optional photo (PRIVATE
-- `account-bills` bucket, losses/YYYY/MM/<uuid>.ext, opened only through
-- /loss-photos/[id]).
--
-- NOT part of the money book: the money was already spent when it was bought,
-- so a loss is never a money-out entry.
--
-- When it's a stock item, the amount also comes off stock: a 'wastage'
-- stock_movements row is written with it (movement_id). Removing the loss
-- removes that movement, so the stock comes back.
--
-- stock_items.cost_per_unit (unused until now, default 0) is set on the stock
-- item ("Cost per unit") and values stock losses — and the waste recorded
-- straight on the Stock page or approved from the POS, which the Waste & loss
-- page lists too.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.account_losses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_on   DATE NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('waste', 'broken', 'missing', 'other')),
  what          TEXT NOT NULL CHECK (char_length(what) BETWEEN 2 AND 120),
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE SET NULL,
  quantity      NUMERIC(12,3) CHECK (quantity IS NULL OR quantity > 0),
  unit          TEXT CHECK (unit IS NULL OR char_length(unit) <= 20),
  movement_id   UUID REFERENCES public.stock_movements(id) ON DELETE SET NULL,
  value         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (value >= 0 AND value <= 10000000),
  reason        TEXT CHECK (reason IS NULL OR char_length(reason) <= 300),
  photo_path    TEXT CHECK (photo_path IS NULL OR photo_path ~ '^losses/\d{4}/\d{2}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'),
  entered_by    UUID REFERENCES public.account_users(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS account_losses_day ON public.account_losses (occurred_on DESC);
CREATE INDEX IF NOT EXISTS account_losses_movement ON public.account_losses (movement_id) WHERE movement_id IS NOT NULL;
ALTER TABLE public.account_losses ENABLE ROW LEVEL SECURITY;  -- no policies: service role only, after requireAuth()

-- Waste-page queries by day.
CREATE INDEX IF NOT EXISTS stock_movements_wastage ON public.stock_movements (created_at DESC) WHERE type = 'wastage';
