-- ============================================================
-- 049 (Oct 2026) — Admin → Email: emails the company sends to people by
-- hand (a job applicant, a supplier, a customer who asked for a reply…) in
-- the Thelawalaa email layout. One row per send, for the history list.
-- Service role only (RLS on, no policies): written by sendCompanyEmail after
-- requireRole('super_admin'), read by the admin page.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.company_emails (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject      TEXT NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 150),
  heading      TEXT NOT NULL CHECK (char_length(heading) BETWEEN 1 AND 120),
  body         TEXT NOT NULL CHECK (char_length(body) <= 5000),
  note         TEXT CHECK (note IS NULL OR char_length(note) <= 600),
  button_label TEXT CHECK (button_label IS NULL OR char_length(button_label) <= 40),
  button_url   TEXT CHECK (button_url IS NULL OR char_length(button_url) <= 500),
  reply_to     TEXT CHECK (reply_to IS NULL OR char_length(reply_to) <= 200),
  recipients   TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(recipients) <= 200),
  sent_count   INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  error        TEXT,
  sent_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS company_emails_created_idx ON public.company_emails (created_at DESC);
ALTER TABLE public.company_emails ENABLE ROW LEVEL SECURITY;
