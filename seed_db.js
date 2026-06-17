const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Seeding branch...");
  const { error: bErr } = await supabase.from('branches').insert([
    { name: 'Manigram Store', address: 'Manigram, Tilottama, Butwal, Rupandehi 32907', phone: '+977 9801011111' }
  ]);
  if (bErr) console.error("Branch err:", bErr);

  console.log("Seeding categories...");
  const categories = [
    { name: 'Chatpate', sort_order: 1 },
    { name: 'Panipuri', sort_order: 2 },
    { name: 'Fulki', sort_order: 3 },
    { name: 'Momo', sort_order: 4 },
    { name: 'Combos', sort_order: 5 }
  ];
  const { data: cats, error: cErr } = await supabase.from('categories').insert(categories).select();
  if (cErr) console.error("Category err:", cErr);
  
  const catMap = {};
  for (const c of cats) catMap[c.name] = c.id;

  console.log("Seeding products...");
  const products = [
    { category_id: catMap['Chatpate'], name: 'Normal Chatpate', description: 'Classic street style (3 levels of spice)', price: 50, is_bestseller: true, spice_level: 3, is_veg: true, image_url: '/images/products/normal_chatpate.png' },
    { category_id: catMap['Chatpate'], name: 'Mint Chatpate', description: 'Refreshing minty twist on the classic', price: 50, is_bestseller: true, spice_level: 1, is_veg: true, image_url: '/images/products/mint_chatpate.png' },
    { category_id: catMap['Chatpate'], name: 'Chicken Chatpate', description: 'Loaded with tender spiced chicken', price: 90, is_bestseller: true, spice_level: 2, is_veg: false, image_url: '/images/products/chicken_chatpate.png' },
    { category_id: catMap['Chatpate'], name: 'Spicy Ramen Chatpate', description: 'Crunchy ramen twist on chatpate with extra heat', price: 60, is_bestseller: true, spice_level: 3, is_veg: true, image_url: '/images/products/spicy_ramen_chatpate.png' },
    { category_id: catMap['Panipuri'], name: 'Panipuri (1 plate)', description: 'Crispy puris with spiced tamarind-mint pani', price: 50, is_bestseller: true, spice_level: 2, is_veg: true, image_url: '/images/products/panipuri.png' },
    { category_id: catMap['Momo'], name: 'Veg Momo (per plate)', description: 'Steamed veg momo with fiery house achar', price: 90, is_bestseller: true, spice_level: 2, is_veg: true, image_url: '/images/products/momo.png' },
    { category_id: catMap['Momo'], name: 'Chicken Momo (per plate)', description: 'Juicy chicken momo with our signature achar', price: 120, is_bestseller: true, spice_level: 2, is_veg: false, image_url: '/images/products/momo.png' }
  ];
  const { error: pErr } = await supabase.from('products').insert(products);
  if (pErr) console.error("Product err:", pErr);
  else console.log("SUCCESSFULLY SEEDED EVERYTHING!");
}
run();
