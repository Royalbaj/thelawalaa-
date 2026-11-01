-- ============================================================
-- POS roles + the outlet's own records (owner's call, Nov 2026).
--
-- 1. Roles: named feature sets for counter people (Admin → POS team & roles).
--    One role per person (training_people.role_id). No role = Counter staff's
--    old abilities (lib/pos-features.ts DEFAULT_FEATURES). Selling is never gated.
-- 2. Day expenses, issues & notes, written at the POS by whoever's role allows
--    it — kept APART from the Accounts money book (not connected to it); shown
--    in the Accounts app's POS section. Till-cash expenses come off the cash a
--    shift should hold.
-- 3. Stock added at the POS counts straight away (stock_movements, source
--    'pos'); EDITS (waste, recount, fixing an add) and expense edits are change
--    requests an Accounts person approves in the Accounts app.
-- ============================================================

-- ── 1. Roles ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pos_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  features   TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS pos_roles_name ON public.pos_roles (lower(name));
ALTER TABLE public.pos_roles ENABLE ROW LEVEL SECURITY;  -- no policies: service role only

ALTER TABLE public.training_people
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.pos_roles(id) ON DELETE SET NULL;

-- The starting roles. Counter staff keeps what everyone could do before;
-- the manager discount moves from training_people.is_manager to a role.
INSERT INTO public.pos_roles (name, features, sort_order) VALUES
  ('Counter staff',      ARRAY['close_shift','cancel_orders'], 1),
  ('Outlet coordinator', ARRAY['close_shift','cancel_orders','expenses','issues','stock_add','stock_edit'], 2),
  ('Manager',            ARRAY['close_shift','cancel_orders','expenses','issues','stock_add','stock_edit','manager_discount'], 3)
ON CONFLICT DO NOTHING;
UPDATE public.training_people SET role_id = (SELECT id FROM public.pos_roles WHERE name = 'Manager')
  WHERE is_manager AND role_id IS NULL;
UPDATE public.training_people SET role_id = (SELECT id FROM public.pos_roles WHERE name = 'Counter staff')
  WHERE role_id IS NULL;

-- ── 2. Day expenses, issues ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pos_expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_on DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'Asia/Kathmandu')::date),
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0 AND amount <= 1000000),
  reason      TEXT NOT NULL CHECK (char_length(reason) BETWEEN 2 AND 300),
  category    TEXT NOT NULL CHECK (char_length(category) BETWEEN 1 AND 40),
  paid_with   TEXT NOT NULL CHECK (paid_with IN ('till_cash', 'qr', 'own_money', 'other')),
  bill_path   TEXT,                                   -- private bucket pos-bills
  person_id   UUID REFERENCES public.training_people(id) ON DELETE SET NULL,
  person_name TEXT NOT NULL CHECK (char_length(person_name) BETWEEN 1 AND 40),
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- the POS login
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at  TIMESTAMPTZ,                            -- removed after an approved request
  edited_at   TIMESTAMPTZ,
  edited_by   TEXT                                    -- the Accounts person who approved the change
);
CREATE INDEX IF NOT EXISTS pos_expenses_day ON public.pos_expenses (occurred_on DESC, created_at DESC);
ALTER TABLE public.pos_expenses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.pos_issues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  details     TEXT CHECK (details IS NULL OR char_length(details) <= 1000),
  kind        TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('equipment', 'stock', 'customer', 'staff', 'cleaning', 'other')),
  urgent      BOOLEAN NOT NULL DEFAULT false,
  person_id   UUID REFERENCES public.training_people(id) ON DELETE SET NULL,
  person_name TEXT NOT NULL CHECK (char_length(person_name) BETWEEN 1 AND 40),
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,                                   -- name of whoever closed it (Accounts person or admin)
  resolution  TEXT CHECK (resolution IS NULL OR char_length(resolution) <= 300)
);
CREATE INDEX IF NOT EXISTS pos_issues_open ON public.pos_issues (created_at DESC) WHERE resolved_at IS NULL;
ALTER TABLE public.pos_issues ENABLE ROW LEVEL SECURITY;

-- ── 3. Stock from the POS + change requests ────────────────────
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'accounts' CHECK (source IN ('accounts', 'pos')),
  ADD COLUMN IF NOT EXISTS pos_person_id UUID REFERENCES public.training_people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pos_person_name TEXT CHECK (pos_person_name IS NULL OR char_length(pos_person_name) <= 40);

CREATE TABLE IF NOT EXISTS public.pos_change_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          TEXT NOT NULL CHECK (kind IN ('expense_edit', 'expense_remove', 'stock_waste', 'stock_count', 'stock_fix')),
  target_id     UUID NOT NULL,           -- pos_expenses.id · stock_items.id · stock_movements.id (stock_fix)
  payload       JSONB NOT NULL DEFAULT '{}',
  reason        TEXT NOT NULL CHECK (char_length(reason) BETWEEN 2 AND 300),
  person_id     UUID REFERENCES public.training_people(id) ON DELETE SET NULL,
  person_name   TEXT NOT NULL CHECK (char_length(person_name) BETWEEN 1 AND 40),
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by    UUID REFERENCES public.account_users(id) ON DELETE SET NULL,
  decided_name  TEXT,
  decided_at    TIMESTAMPTZ,
  decision_note TEXT CHECK (decision_note IS NULL OR char_length(decision_note) <= 300)
);
CREATE INDEX IF NOT EXISTS pos_change_requests_pending ON public.pos_change_requests (created_at) WHERE status = 'pending';
ALTER TABLE public.pos_change_requests ENABLE ROW LEVEL SECURITY;

-- Bill photos for POS expenses — private; only opened through a short signed link.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pos-bills', 'pos-bills', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;
