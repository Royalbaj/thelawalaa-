-- ─────────────────────────────────────────────
-- MENU OVERHAUL — Panipuri/Fulki/Combos discontinued.
-- Real live menu is now: Chatpate (Classic, Gilo, Mint, Spicy Ramen),
-- Momo (Veg, Chicken, Buff), and Drinks (Coca-Cola).
--
-- Deactivating rather than deleting: RLS already restricts customer/POS
-- reads to is_active=true categories / is_available=true products
-- ("public read categories"/"public read products" in 001), so a
-- deactivated row is fully invisible to customers and POS — same
-- effect as deleting, but reversible and keeps order history intact
-- (order_items already snapshots name/price at order time regardless).
-- ─────────────────────────────────────────────

UPDATE categories SET is_active = false WHERE name IN ('Panipuri', 'Fulki', 'Combos');

UPDATE products SET is_available = false
WHERE name IN ('Chicken Chatpate', 'Panipuri (1 plate)', 'Sweet Chilli Chatpate', 'Fulki (1 plate)', 'Chatpate + Panipuri Combo');

UPDATE products SET name = 'Chatpate' WHERE name = 'Normal Chatpate';

-- New category for cold drinks
INSERT INTO categories (name, sort_order, is_active)
VALUES ('Drinks', 6, true);

-- New products
INSERT INTO products (category_id, name, description, price, is_veg, spice_level, is_available)
SELECT id, 'Buff Momo (per plate)', 'Steamed buff (buffalo) momo with our signature achar', 110, false, 2, true
FROM categories WHERE name = 'Momo';

INSERT INTO products (category_id, name, description, price, is_veg, spice_level, is_available)
SELECT id, 'Gilo Chatpate', 'A tangy Gilo-style twist on our classic chatpate', 50, true, 2, true
FROM categories WHERE name = 'Chatpate';

INSERT INTO products (category_id, name, description, price, is_veg, spice_level, is_available)
SELECT id, 'Coca-Cola (bottle)', 'Chilled 250ml glass bottle', 60, true, 0, true
FROM categories WHERE name = 'Drinks';
