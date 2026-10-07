-- ============================================================
-- POS staff login (builds on 036's time clock). The shared POS login is
-- locked behind a PIN screen: a counter person types their PIN, which
-- unlocks the till for them AND clocks them in. Each POS order remembers
-- who sold it (a copy of the name, so it survives the person being removed).
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS staff_person_id UUID REFERENCES public.training_people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS staff_name TEXT CHECK (staff_name IS NULL OR char_length(staff_name) BETWEEN 1 AND 40);
