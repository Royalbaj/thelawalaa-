-- ============================================================
-- Website text the admin can edit (Admin → Website text). One row per
-- changed piece of text; anything without a row shows the built-in
-- default from lib/site-content.ts, so an empty table = today's site.
-- Public text, so anyone may read it; only the saveSiteText server action
-- (super_admin, service role) writes.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.site_content (
  key        TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_.]{2,60}$'),
  value      TEXT NOT NULL CHECK (char_length(value) <= 2000),
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can read website text" ON public.site_content;
CREATE POLICY "anyone can read website text" ON public.site_content FOR SELECT USING (true);
