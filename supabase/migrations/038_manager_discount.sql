-- ============================================================
-- Manager discount at the POS. A manager (a staff person the admin marks as
-- manager in Admin → Staff Hours → POS staff · PINs) approves it with their
-- own PIN: every item in the sale costs Rs 0 except frozen items (and
-- membership cards). The order keeps who approved it.
-- ============================================================

ALTER TABLE public.training_people
  ADD COLUMN IF NOT EXISTS is_manager BOOLEAN NOT NULL DEFAULT false;

-- Frozen items keep their full price under the manager discount (Admin → Menu).
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN NOT NULL DEFAULT false;
-- The frozen momo packs (owner's call, 7 Oct 2026).
UPDATE public.products SET is_frozen = true WHERE name ILIKE '55 pcs%' AND NOT is_frozen;

-- Who approved a manager discount (a copy of the name, like orders.staff_name).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_approved_by TEXT
  CHECK (discount_approved_by IS NULL OR char_length(discount_approved_by) BETWEEN 1 AND 40);
