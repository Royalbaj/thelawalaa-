CREATE TABLE IF NOT EXISTS faqs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read active faqs" ON faqs;
CREATE POLICY "public read active faqs" ON faqs FOR SELECT USING (is_active = true);

INSERT INTO faqs (question, answer, sort_order) VALUES
  ('What does Thelawalaa serve?', 'Our signature chatpate in four varieties — Classic, Gilo, Mint and Spicy Ramen — plus Veg, Chicken and Buff momo, and ice-cold Coca-Cola, all made fresh and hygienically to order.', 1),
  ('Do you deliver in Banepa and Godam Chowk?', 'Yes. We offer home delivery within 5km of our Godam Chowk store for a flat Nrs 20. Enter your address at checkout and we''ll confirm you''re inside the delivery zone.', 2),
  ('How much is delivery?', 'A flat Nrs 20 anywhere within 5km of the store — no hidden charges and no minimum order. You can also choose pickup and collect it hot from our Godam Chowk counter.', 3),
  ('What chatpate varieties can I order?', 'Four: our Classic Chatpate, tangy Gilo Chatpate, refreshing Mint Chatpate, and crunchy Spicy Ramen Chatpate.', 4),
  ('How do I order online?', 'Create a free account, add your chatpate, momo or a cold drink to the cart, and check out for pickup or home delivery. You''ll get a live tracking link right away.', 5),
  ('What payment methods do you accept?', 'Cash, or scan our eSewa / FonePay QR when your order arrives — our team confirms the payment on the spot. No prepayment needed.', 6),
  ('Is the food hygienically prepared?', 'Hygiene is one of our core promises. Everything is made fresh in a clean kitchen, handled with care, and sealed for delivery so it reaches you safe and hot.', 7),
  ('Can I choose how spicy my order is?', 'Yes — every item has a spice rating from mild to extra teekha, and you can leave a customisation note per item when you order.', 8);
