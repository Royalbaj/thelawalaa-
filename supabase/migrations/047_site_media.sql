-- ============================================================
-- Website media the admin uploads in Admin → Website text: the how-to-order
-- video on the homepage and its cover picture. Played by our own player, not
-- YouTube (owner's call, Oct 2026 — the video should look part of the site).
-- Public read (the homepage shows it). Nobody uploads directly: the server
-- hands out a signed upload URL (createSiteMediaUpload, super_admin only), so
-- there are no insert/update policies for anon/authenticated.
-- 50 MB is Supabase's per-file limit on the free plan.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-media', 'site-media', true, 52428800,
        ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
