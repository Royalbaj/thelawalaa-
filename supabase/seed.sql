-- ─────────────────────────────────────────────────────────────
-- Thelawalaa seed data — launch market: Banepa–Godam Chowk, Nepal
-- ─────────────────────────────────────────────────────────────

-- Branch (single store at launch; more added from the admin console)
INSERT INTO branches (name, address, phone) VALUES
  ('Godam Chowk Store', 'Godam Chowk, Banepa, Kavrepalanchok 45210', '+977 9801011111');

-- Categories
INSERT INTO categories (name, sort_order) VALUES
  ('Chatpate', 1), ('Panipuri', 2), ('Fulki', 3), ('Momo', 4), ('Combos', 5);

-- ── Chatpate (our signature) ──
INSERT INTO products (category_id, name, description, price, is_bestseller, spice_level, is_veg, image_url)
SELECT id, 'Normal Chatpate', 'Classic street style (3 levels of spice)', 50, true, 3, true, '/images/products/normal_chatpate.png'
FROM categories WHERE name = 'Chatpate';

INSERT INTO products (category_id, name, description, price, is_bestseller, spice_level, is_veg, image_url)
SELECT id, 'Mint Chatpate', 'Refreshing minty twist on the classic', 50, true, 1, true, '/images/products/mint_chatpate.png'
FROM categories WHERE name = 'Chatpate';

INSERT INTO products (category_id, name, description, price, is_bestseller, spice_level, is_veg, image_url)
SELECT id, 'Chicken Chatpate', 'Loaded with tender spiced chicken', 90, true, 2, false, '/images/products/chicken_chatpate.png'
FROM categories WHERE name = 'Chatpate';

INSERT INTO products (category_id, name, description, price, is_bestseller, spice_level, is_veg, image_url)
SELECT id, 'Spicy Ramen Chatpate', 'Crunchy ramen twist on chatpate with extra heat', 60, true, 3, true, '/images/products/spicy_ramen_chatpate.png'
FROM categories WHERE name = 'Chatpate';

-- ── Panipuri ──
INSERT INTO products (category_id, name, description, price, is_bestseller, spice_level, is_veg, image_url)
SELECT id, 'Panipuri (1 plate)', 'Crispy puris with spiced tamarind-mint pani', 50, true, 2, true, '/images/products/panipuri.png'
FROM categories WHERE name = 'Panipuri';

-- ── Momo ──
INSERT INTO products (category_id, name, description, price, is_bestseller, spice_level, is_veg, image_url)
SELECT id, 'Veg Momo (per plate)', 'Steamed veg momo with fiery house achar', 90, true, 2, true, '/images/products/momo.png'
FROM categories WHERE name = 'Momo';

INSERT INTO products (category_id, name, description, price, is_bestseller, spice_level, is_veg, image_url)
SELECT id, 'Chicken Momo (per plate)', 'Juicy chicken momo with our signature achar', 120, true, 2, false, '/images/products/momo.png'
FROM categories WHERE name = 'Momo';
