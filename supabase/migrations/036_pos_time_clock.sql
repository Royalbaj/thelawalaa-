-- ============================================================
-- POS time clock. The POS login is shared, so each counter person clocks
-- in and out with their OWN 4-digit PIN — the same person + PIN as staff
-- training (training_people, migration 028). The admin picks who may use
-- the clock (pos_clock) and sees the hours in Admin → Staff Hours; the POS
-- only ever shows clock-in/out times, never hours worked.
-- ============================================================

ALTER TABLE public.training_people
  ADD COLUMN IF NOT EXISTS pos_clock BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.staff_shifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Hours outlive the person: removing someone keeps their shifts (with the name).
  person_id   UUID REFERENCES public.training_people(id) ON DELETE SET NULL,
  person_name TEXT NOT NULL CHECK (char_length(person_name) BETWEEN 1 AND 40),
  clock_in    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out   TIMESTAMPTZ,                         -- NULL = still on the clock (or missed, below)
  -- Never clocked out (found open after 16 h): counts as 0 h until the admin sets the time.
  missed_out  BOOLEAN NOT NULL DEFAULT false,
  note        TEXT CHECK (note IS NULL OR char_length(note) <= 120),
  in_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,  -- the login it was punched on
  out_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  edited_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,  -- added / changed in Admin
  edited_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (clock_out IS NULL OR clock_out > clock_in),
  CHECK (NOT (missed_out AND clock_out IS NOT NULL))
);
-- One open shift per person — a double tap can't clock someone in twice.
CREATE UNIQUE INDEX IF NOT EXISTS staff_shifts_one_open
  ON public.staff_shifts (person_id) WHERE clock_out IS NULL AND NOT missed_out;
CREATE INDEX IF NOT EXISTS staff_shifts_clock_in ON public.staff_shifts (clock_in DESC);
CREATE INDEX IF NOT EXISTS staff_shifts_person ON public.staff_shifts (person_id, clock_in DESC);
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;  -- no policies: service role only
