-- High-quality, professional food photography from Unsplash to replace generic/street-food photos
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&q=80&w=800' WHERE name ILIKE '%fries%' OR name ILIKE '%chips%';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=800' WHERE name ILIKE '%burger%';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&q=80&w=800' WHERE name ILIKE '%pasta%';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800' WHERE name ILIKE '%salad%';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=800' WHERE name ILIKE '%chicken%';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1525648199074-cee30ba79a4a?auto=format&fit=crop&q=80&w=800' WHERE name ILIKE '%momo%' OR name ILIKE '%dumpling%';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&q=80&w=800' WHERE name ILIKE '%juice%' OR name ILIKE '%drink%' OR name ILIKE '%shake%';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1624300608552-a6f9f60c6d7a?auto=format&fit=crop&q=80&w=800' WHERE name ILIKE '%wrap%' OR name ILIKE '%roll%';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1564834724105-918b73d1b9e0?auto=format&fit=crop&q=80&w=800' WHERE name ILIKE '%chatpate%' OR name ILIKE '%chaat%';
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1564834724105-918b73d1b9e0?auto=format&fit=crop&q=80&w=800' WHERE name ILIKE '%panipuri%' OR name ILIKE '%puri%';

-- A generic fallback for any remaining items that don't have an image
UPDATE products SET image_url = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800' WHERE image_url IS NULL OR image_url = '';
