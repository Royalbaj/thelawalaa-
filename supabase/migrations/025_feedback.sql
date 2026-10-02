-- ============================================================
-- Customer feedback from /feedback (public), read in Admin → Feedback.
-- RLS on, no policies: written only by the submitFeedback server action
-- (validated + throttled), read only by super_admin pages — both through
-- the service role. The IP is never stored, only a keyed hash used to
-- throttle repeat submissions.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT CHECK (comment IS NULL OR char_length(comment) <= 1000),
  name       TEXT CHECK (name IS NULL OR char_length(name) <= 80),
  contact    TEXT CHECK (contact IS NULL OR char_length(contact) <= 80),
  order_ref  TEXT CHECK (order_ref IS NULL OR char_length(order_ref) <= 30),
  visit      TEXT CHECK (visit IN ('dine_in', 'pickup', 'delivery')),
  ip_hash    TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS feedback_created_idx ON public.feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_ip_idx ON public.feedback (ip_hash, created_at DESC);
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
