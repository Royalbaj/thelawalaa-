-- ============================================================
-- 048 (Oct 2026)
--  1. Feedback: per-aspect scores, quick tags, "would you recommend us?" and
--     "please get back to me" — the /feedback form asks for them.
--  2. Careers: job listings (Admin → Careers) and applications from the
--     public /careers page, with CVs in a PRIVATE bucket. Like feedback, the
--     tables are service-role only (RLS on, no policies): the public page
--     writes through server actions, the admin reads after requireRole().
--  3. Accounts → Running cost: which categories are the business's running
--     costs / income, and a per-entry "one-off" override (setup buys).
-- ============================================================

-- 1. Feedback ------------------------------------------------------------
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS aspects     JSONB,                        -- {"taste":5,"hygiene":4,"speed":3,"value":4}
  ADD COLUMN IF NOT EXISTS tags        TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recommend   BOOLEAN,
  ADD COLUMN IF NOT EXISTS wants_reply BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.feedback ADD CONSTRAINT feedback_tags_size CHECK (cardinality(tags) <= 12);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Careers --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_listings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 80),
  job_type     TEXT NOT NULL DEFAULT 'full_time' CHECK (job_type IN ('full_time', 'part_time', 'shift', 'internship')),
  description  TEXT CHECK (description IS NULL OR char_length(description) <= 3000),
  requirements TEXT CHECK (requirements IS NULL OR char_length(requirements) <= 2000),
  pay          TEXT CHECK (pay IS NULL OR char_length(pay) <= 80),
  openings     SMALLINT NOT NULL DEFAULT 1 CHECK (openings BETWEEN 1 AND 50),
  is_open      BOOLEAN NOT NULL DEFAULT true,
  closes_on    DATE,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.job_applications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   UUID REFERENCES public.job_listings(id) ON DELETE SET NULL,  -- null = "any job" (CV on file)
  position     TEXT NOT NULL CHECK (char_length(position) BETWEEN 1 AND 80), -- the job's title at the time, or what they'd like
  name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  phone        TEXT NOT NULL CHECK (char_length(phone) BETWEEN 7 AND 20),
  email        TEXT CHECK (email IS NULL OR char_length(email) <= 120),
  experience   TEXT CHECK (experience IS NULL OR char_length(experience) <= 80),
  availability TEXT CHECK (availability IS NULL OR char_length(availability) <= 80),
  message      TEXT CHECK (message IS NULL OR char_length(message) <= 2000),
  cv_path      TEXT CHECK (cv_path IS NULL OR cv_path ~ '^cvs/[0-9]{4}/[0-9]{2}/[0-9a-f-]{36}\.(pdf|doc|docx|jpg|png|webp)$'),
  cv_name      TEXT CHECK (cv_name IS NULL OR char_length(cv_name) <= 120),
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'shortlisted', 'interview', 'hired', 'rejected')),
  admin_note   TEXT CHECK (admin_note IS NULL OR char_length(admin_note) <= 1000),
  ip_hash      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS job_applications_created_idx ON public.job_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS job_applications_listing_idx ON public.job_applications (listing_id);
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- CVs: private; uploaded through a signed URL the server hands out, opened by
-- the admin through a 2-minute signed link.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cvs', 'cvs', false, 5242880, ARRAY[
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Accounts → Running cost ----------------------------------------------
-- A category counts as running cost (money out) / running income (money in)
-- unless switched off; a single entry can override it (one_off = true: a
-- setup buy in a running-cost category; false: counted even though its
-- category isn't; NULL: follow the category).
ALTER TABLE public.account_categories ADD COLUMN IF NOT EXISTS is_operating BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.account_transactions ADD COLUMN IF NOT EXISTS one_off BOOLEAN;

-- The money that isn't trading: owners' and lenders' money, and equipment.
UPDATE public.account_categories SET is_operating = false
WHERE (kind = 'in' AND name IN ('Owner investment', 'Loan received'))
   OR (kind = 'out' AND name IN ('Owner withdrawal', 'Equipment'));
