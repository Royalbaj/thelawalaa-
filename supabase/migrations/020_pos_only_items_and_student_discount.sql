-- ============================================================
-- Items sold only at the counter: shown on the POS, hidden from the
-- website menus, and refused by online checkout (createOrder).
-- ============================================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pos_only BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- Whether the POS student discount (5%) applies to an item. Coca-Cola is
-- excluded to start with; Admin → Menu can change any item.
-- ============================================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS student_discount_eligible BOOLEAN NOT NULL DEFAULT true;
UPDATE public.products SET student_discount_eligible = false WHERE name ~* 'coca[- ]?cola|\mcoke\M';

-- What an order's discount_amount was for, e.g. 'Student 5%'.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_label TEXT;
