-- ─────────────────────────────────────────────────────────────
-- Thelawalaa seed data — launch market: Butwal–Manigram, Nepal
-- ─────────────────────────────────────────────────────────────

-- Branch (single store at launch; more added from the admin console)
INSERT INTO branches (name, address, phone) VALUES
  ('Manigram Store', 'Manigram, Tilottama, Butwal, Rupandehi 32907', '+977 9801011111');

-- Categories
INSERT INTO categories (name, sort_order) VALUES
  ('Chatpate', 1), ('Panipuri', 2), ('Fulki', 3), ('Momo', 4), ('Combos', 5);

-- ── Chatpate (our signature — five varieties) ──
INSERT INTO products (category_id, name, description, price, is_bestseller, spice_level, is_veg)
SELECT id, 'Spicy Chatpate', 'The original fiery chatpate — puffed rice, aloo, lemon and our house masala', 60, true, 3, true
FROM categories WHERE name = 'Chatpate';

INSERT INTO products (category_id, name, description, price, is_bestseller, spice_level, is_veg)
SELECT id, 'Chicken Chatpate', 'Loaded with tender spiced chicken over classic chatpate', 120, true, 2, false
FROM categories WHERE name = 'Chatpate';

INSERT INTO products (category_id, name, description, price, is_bestseller, spice_level, is_veg)
SELECT id, 'Spicy Ramen Chatpate', 'Crunchy ramen twist on chatpate with extra heat', 100, true, 3, true
FROM categories WHERE name = 'Chatpate';

INSERT INTO products (category_id, name, description, price, spice_level, is_veg)
SELECT id, 'Mint Chatpate', 'Cool, zingy mint chutney chatpate — refreshing and tangy', 80, 1, true
FROM categories WHERE name = 'Chatpate';

INSERT INTO products (category_id, name, description, price, spice_level, is_veg)
SELECT id, 'Sweet Chilly Chatpate', 'Sweet-and-spicy chilly glaze over crunchy chatpate', 80, 2, true
FROM categories WHERE name = 'Chatpate';

-- ── Panipuri ──
INSERT INTO products (category_id, name, description, price, is_bestseller, spice_level, is_veg)
SELECT id, 'Panipuri (6 pcs)', 'Crispy puris with spiced tamarind-mint pani and aloo filling', 50, true, 2, true
FROM categories WHERE name = 'Panipuri';

INSERT INTO products (category_id, name, description, price, spice_level, is_veg)
SELECT id, 'Panipuri (10 pcs)', 'The full plate — ten crispy puris with our signature teekha pani', 80, 2, true
FROM categories WHERE name = 'Panipuri';

-- ── Fulki ──
INSERT INTO products (category_id, name, description, price, spice_level, is_veg)
SELECT id, 'Fulki (6 pcs)', 'Light, crisp fulki with tangy spiced water — melt-in-mouth crunch', 50, 2, true
FROM categories WHERE name = 'Fulki';

INSERT INTO products (category_id, name, description, price, spice_level, is_veg)
SELECT id, 'Dahi Fulki', 'Fulki topped with creamy dahi, sweet chutney and sev', 80, 1, true
FROM categories WHERE name = 'Fulki';

-- ── Momo ──
INSERT INTO products (category_id, name, description, price, is_bestseller, spice_level, is_veg)
SELECT id, 'Veg Momo (10 pcs)', 'Steamed veg momo with fiery house achar', 100, true, 2, true
FROM categories WHERE name = 'Momo';

INSERT INTO products (category_id, name, description, price, is_bestseller, spice_level, is_veg)
SELECT id, 'Chicken Momo (10 pcs)', 'Juicy chicken momo with our signature achar', 130, true, 2, false
FROM categories WHERE name = 'Momo';

INSERT INTO products (category_id, name, description, price, spice_level, is_veg)
SELECT id, 'C Momo (10 pcs)', 'Chilli momo tossed in spicy-tangy sauce', 150, 3, false
FROM categories WHERE name = 'Momo';

-- ── Combos ──
INSERT INTO products (category_id, name, description, price, is_bestseller, spice_level, is_veg)
SELECT id, 'Thela Special Combo', 'Spicy Chatpate + Panipuri (6) + Veg Momo (5) — the full tasting plate', 220, true, 2, true
FROM categories WHERE name = 'Combos';
