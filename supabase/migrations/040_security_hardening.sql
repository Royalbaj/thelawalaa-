-- 040: security hardening (Oct 2026 audit).
-- Everything here closes a way in through the public API (the anon key is in
-- every browser, so anything a policy allows, anyone can do with curl).

-- ── 1. Leftover tables from the old business-card (/vcard) app ─────────────
-- Not used by this repo, but their policies let ANYONE read, change and delete
-- every row — admins holds emails, phones and plain-text passwords. With RLS on
-- and no policies they're service-role only, like the other private tables.
DROP POLICY IF EXISTS "Anyone can modify info" ON public.admins;
DROP POLICY IF EXISTS "Public can view info" ON public.admins;
DROP POLICY IF EXISTS "Anyone can select orders" ON public.buy_requests;
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.buy_requests;
DROP POLICY IF EXISTS "Anyone can view messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow public delete messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Public can submit messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Anyone can modify home config" ON public.home_page_sections;
DROP POLICY IF EXISTS "Anyone can read home config" ON public.home_page_sections;
DROP POLICY IF EXISTS "Public can insert exchange contacts" ON public.exchange_contacts;

-- ── 2. Writes the app makes on the server only ─────────────────────────────
-- submitContact (throttled, honeypot) and submitOrderRating (own orders only)
-- insert with the service role. These policies let anyone skip those checks
-- by inserting straight through the API.
DROP POLICY IF EXISTS "anyone can submit contact form" ON public.contact_submissions;
DROP POLICY IF EXISTS "insert own rating" ON public.order_ratings;

-- ── 3. Profiles: a user can't change their own row behind the server's back ─
-- RLS lets a signed-in user update their own profile row; the guard used to
-- protect only role/is_active/branch/consent. Now the ONLY column they can set
-- themselves is invite_accepted_at (the staff invite page, once). Name, phone,
-- driver fields, welcome/notification stamps… go through server actions
-- (updateMyProfile etc., Zod-validated, service role), which this doesn't touch.
CREATE OR REPLACE FUNCTION public.prevent_privilege_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accepted timestamptz;
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'authenticated' THEN
    accepted := CASE WHEN OLD.invite_accepted_at IS NULL AND NEW.invite_accepted_at IS NOT NULL
                     THEN now() ELSE OLD.invite_accepted_at END;
    NEW := OLD;
    NEW.invite_accepted_at := accepted;
  END IF;
  RETURN NEW;
END $$;

-- ── 4. Saved addresses (written from the browser, RLS "own addresses") ──────
-- The same limits as the form, enforced where they can't be skipped.
ALTER TABLE public.addresses
  ADD CONSTRAINT addresses_label_len CHECK (label IS NULL OR char_length(label) <= 30),
  ADD CONSTRAINT addresses_full_address_len CHECK (char_length(full_address) BETWEEN 1 AND 300),
  ADD CONSTRAINT addresses_pin_in_nepal CHECK (
    (lat IS NULL AND lng IS NULL)
    OR (lat BETWEEN 26.3 AND 30.5 AND lng BETWEEN 80 AND 88.3)
  );

-- ── 5. Trigger functions aren't API endpoints ───────────────────────────────
-- They were callable as /rest/v1/rpc/<name>. Triggers still fire: Postgres
-- checks EXECUTE when a trigger is created, not each time it runs.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_privilege_self_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.give_signup_loyalty() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_daily_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.stamp_order_times() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.update_updated_at() SET search_path = public;
-- get_my_role / get_my_branch / is_my_assigned_delivery stay callable: RLS
-- policies use them, and they only ever answer about the caller.

-- TRUNCATE is the one table privilege RLS doesn't filter. The API never uses
-- it, so the browser roles don't need it.
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- ── 6. Storage ──────────────────────────────────────────────────────────────
-- avatars: nothing in the app uploads avatars, but any signed-in customer could
-- put ANY file (any type, any size) in their folder and get a public link to
-- it — free hosting for malware/phishing on our Supabase address.
DROP POLICY IF EXISTS "avatar owner write" ON storage.objects;
DROP POLICY IF EXISTS "avatar owner update" ON storage.objects;
-- Public buckets hold images only, with a size cap (menu photos are uploaded
-- as JPEG through a signed URL from Admin → Menu).
UPDATE storage.buckets
SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id IN ('avatars', 'products');
