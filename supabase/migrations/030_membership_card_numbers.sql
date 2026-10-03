-- Membership cards are numbered automatically when sold at the POS:
-- 003, 004, … (cards 001 and 002 were sold before numbering began).
-- The database hands them out, so two tills selling at once can't clash,
-- and no two cards can share a number (the admin can still edit one).

CREATE SEQUENCE IF NOT EXISTS public.membership_card_seq START WITH 3;

CREATE OR REPLACE FUNCTION public.next_membership_card()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT CASE WHEN n < 1000 THEN lpad(n::text, 3, '0') ELSE n::text END
  FROM (SELECT nextval('public.membership_card_seq') AS n) s
$$;

REVOKE ALL ON FUNCTION public.next_membership_card() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.membership_card_seq FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_membership_card() TO service_role;
GRANT USAGE ON SEQUENCE public.membership_card_seq TO service_role;

ALTER TABLE public.memberships ALTER COLUMN card_number SET DEFAULT public.next_membership_card();
CREATE UNIQUE INDEX IF NOT EXISTS memberships_card_number_key ON public.memberships (card_number) WHERE card_number IS NOT NULL;
