-- ============================================================
-- Member pricing at the POS: with "Member" on, an item that has a
-- member_price is charged that instead (never more than its normal
-- price). Every momo starts at Rs 99; Admin → Menu sets any item.
-- ============================================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS member_price NUMERIC(10,2)
  CHECK (member_price IS NULL OR member_price > 0);

UPDATE public.products p SET member_price = 99
FROM public.categories c
WHERE c.id = p.category_id AND c.name ILIKE '%momo%';
