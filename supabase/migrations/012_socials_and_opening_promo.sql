-- ─────────────────────────────────────────────
-- SOCIAL LINKS — editable from Super Admin, shown in the site footer
-- and on the /qr page. Not hardcoded to exactly Facebook/Instagram/
-- TikTok — "platform" is free text so more channels can be added later.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform    TEXT NOT NULL,   -- 'facebook' | 'instagram' | 'tiktok' | free text for anything else
  url         TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE social_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read active social links" ON social_links;
CREATE POLICY "public read active social links" ON social_links FOR SELECT USING (is_active = true);
-- Writes go through the service role only (super_admin server action).

-- Seed with the handles already used in lib/seo.ts / matching the print poster's "/thelawalaa" handle.
INSERT INTO social_links (platform, url, sort_order) VALUES
  ('facebook', 'https://www.facebook.com/thelawalaa', 1),
  ('instagram', 'https://www.instagram.com/thelawalaa', 2),
  ('tiktok', 'https://www.tiktok.com/@thelawalaa', 3)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- OPENING-DAY PROMO — "momo @ Rs 11/plate" for everyone, no signup or
-- code needed, active only within a date window super_admin sets. Off
-- by default (no dates set yet) so this can be built and shipped ahead
-- of the actual opening date being decided.
-- ─────────────────────────────────────────────

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS opening_promo_enabled     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opening_promo_momo_price  NUMERIC(10,2) NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS opening_promo_starts_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opening_promo_ends_at     TIMESTAMPTZ;
