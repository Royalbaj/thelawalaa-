-- ─────────────────────────────────────────────
-- SITE-WIDE FEATURE FLAGS
--
-- Single-row settings table so super_admin can turn eSewa and delivery
-- on/off without a deploy. Both default OFF: launch state is
-- pickup-only, cash/QR-in-person only. Readable by anyone (checkout is
-- reached by guests too), writable only via the service role — see
-- updateAppSettings in app/actions/settings.ts.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_settings (
  id                INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  esewa_enabled     BOOLEAN NOT NULL DEFAULT false,
  delivery_enabled  BOOLEAN NOT NULL DEFAULT false,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_read_all ON app_settings;
CREATE POLICY app_settings_read_all ON app_settings FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policy for anon/authenticated — writes go
-- through the service-role client in updateAppSettings only.
