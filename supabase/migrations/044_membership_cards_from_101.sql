-- 044: membership cards are numbered from 101 — the numbers written on the real
-- cards (owner's call, Oct 2026). Replaces migration 030's 003, 004, …

-- 1. The 001–099 the system gave were off by 100: when it said 001, staff wrote
--    101 on the card, 003 → 103, and so on. Orders keep a copy of the card used
--    for member price (migration 041), so those move too. Numbers typed by hand
--    (e.g. 45667) are left alone — fix them in Admin → Members if they're wrong.
UPDATE public.memberships SET card_number = (card_number::int + 100)::text
WHERE card_number ~ '^\d{1,3}$' AND card_number::int BETWEEN 1 AND 99;
UPDATE public.orders SET member_card = (member_card::int + 100)::text
WHERE member_card ~ '^\d{1,3}$' AND member_card::int BETWEEN 1 AND 99;

-- 2. Automatic numbers cover the first 100 written cards, 101–200, carrying on
--    after the highest one already given. After 200 the POS asks for the number
--    written on the card instead (next_membership_card() returns NULL).
SELECT setval('public.membership_card_seq', GREATEST(100, COALESCE(
  (SELECT max(card_number::int) FROM public.memberships WHERE card_number ~ '^\d{1,6}$' AND card_number::int BETWEEN 101 AND 200), 100)));

CREATE OR REPLACE FUNCTION public.next_membership_card()
RETURNS text
LANGUAGE sql
SET search_path = public
AS $$
  SELECT CASE WHEN n BETWEEN 101 AND 200 THEN n::text ELSE NULL END
  FROM (SELECT nextval('public.membership_card_seq') AS n) s
$$;

-- The next automatic number without using it up (NULL once 101–200 are all given),
-- so the POS can say "give the customer card no. 118" before the sale.
CREATE OR REPLACE FUNCTION public.peek_membership_card()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN n BETWEEN 101 AND 200 THEN n ELSE NULL END
  FROM (SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END AS n FROM public.membership_card_seq) s
$$;
REVOKE EXECUTE ON FUNCTION public.peek_membership_card() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.peek_membership_card() TO service_role;
