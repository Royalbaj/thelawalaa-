-- ============================================================
-- Accounts app (accounts.thelawalaa.com) — a simple money-in /
-- money-out book the manager keeps by hand. Deliberately NOT fed
-- from orders: sales are entered manually (e.g. the day's takings).
--
-- No RLS policies on purpose: only the Accounts app's server actions
-- touch these tables, with the service role, after checking the user
-- is super_admin/accountant AND has unlocked the app with the PIN.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.account_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       TEXT NOT NULL CHECK (kind IN ('in', 'out')),
  name       TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS account_categories_kind_name ON public.account_categories (kind, lower(btrim(name)));
ALTER TABLE public.account_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.account_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT NOT NULL CHECK (kind IN ('in', 'out')),
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category_id UUID NOT NULL REFERENCES public.account_categories(id),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 300),
  occurred_on DATE NOT NULL,
  -- How the money moved: cash, bank transfer/cheque, or QR / eSewa / Fonepay.
  method      TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'bank', 'qr')),
  -- Photo or PDF of the bill, in the private `account-bills` bucket.
  bill_path   TEXT,
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES public.profiles(id),
  updated_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS account_transactions_by_day ON public.account_transactions (occurred_on DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS account_transactions_by_category ON public.account_transactions (category_id);
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

-- One row: the money on hand when the book was started, and the PIN
-- (scrypt hash) that opens the app after sign-in. Default PIN: 8848,
-- changeable in Accounts → Settings.
CREATE TABLE IF NOT EXISTS public.account_settings (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  pin_hash        TEXT NOT NULL,
  updated_by      UUID REFERENCES public.profiles(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.account_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.account_settings (id, pin_hash)
VALUES (1, 'scrypt$16384$8$1$FtOHb0yVtqH/9LGvom029Q==$CHXTO7N8LSY3ibbUbaAR+SqPhbc8cBF5vYo8J5/g6w4=')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.account_categories (kind, name, sort_order) VALUES
  ('in',  'Sales',                 1),
  ('in',  'Owner investment',      2),
  ('in',  'Loan received',         3),
  ('in',  'Other income',          9),
  ('out', 'Ingredients',           1),
  ('out', 'Meat & vegetables',     2),
  ('out', 'Gas (LPG)',             3),
  ('out', 'Packaging',             4),
  ('out', 'Staff salary',          5),
  ('out', 'Rent',                  6),
  ('out', 'Electricity & water',   7),
  ('out', 'Transport',             8),
  ('out', 'Repairs & maintenance', 9),
  ('out', 'Marketing',            10),
  ('out', 'Equipment',            11),
  ('out', 'Owner withdrawal',     12),
  ('out', 'Other expense',        19)
ON CONFLICT DO NOTHING;

-- Money in / out, all time or before a date (for "balance left" and the
-- running-balance chart) — PostgREST has no SUM, so one small function.
CREATE OR REPLACE FUNCTION public.account_totals(p_before DATE DEFAULT NULL)
RETURNS TABLE (total_in NUMERIC, total_out NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(amount) FILTER (WHERE kind = 'in'), 0),
         COALESCE(SUM(amount) FILTER (WHERE kind = 'out'), 0)
  FROM account_transactions
  WHERE p_before IS NULL OR occurred_on < p_before;
$$;
REVOKE ALL ON FUNCTION public.account_totals(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_totals(DATE) TO service_role;

-- Bill photos / PDFs. Private: the app hands out short-lived signed links.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('account-bills', 'account-bills', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;
