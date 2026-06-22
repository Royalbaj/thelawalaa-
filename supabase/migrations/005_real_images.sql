UPDATE products SET image_url = '/images/products/normal_chatpate.png' WHERE name ILIKE '%Normal Chatpate%';
UPDATE products SET image_url = '/images/products/mint_chatpate.png' WHERE name ILIKE '%Mint Chatpate%';
UPDATE products SET image_url = '/images/products/chicken_chatpate.png' WHERE name ILIKE '%Chicken Chatpate%';
UPDATE products SET image_url = '/images/products/ramen_chatpate.png' WHERE name ILIKE '%Ramen Chatpate%';
UPDATE products SET image_url = '/images/products/panipuri.png' WHERE name ILIKE '%Panipuri%';
UPDATE products SET image_url = '/images/products/veg_momo.png' WHERE name ILIKE '%Veg Momo%';
UPDATE products SET image_url = '/images/products/chicken_momo.png' WHERE name ILIKE '%Chicken Momo%' AND name NOT ILIKE '%Veg%';
