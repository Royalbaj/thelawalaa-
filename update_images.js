const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const IMAGE_MAP = {
  'Chatpate (Spicy)': '/images/menu/chatpate-classic.png',
  'Chicken Chatpate': '/images/menu/chatpate-chicken.png',
  'Spicy Ramen Chatpate': '/images/menu/chatpate-ramen.png',
  'Mint Chatpate': '/images/menu/chatpate-mint.png',
  'Sweet Chilly Chatpate': '/images/menu/chatpate-sweet-chili.png',
  'Panipuri': '/images/menu/panipuri.png',
  'Momo (Buff)': '/images/menu/momo.png',
};

async function run() {
  for (const [name, url] of Object.entries(IMAGE_MAP)) {
    const { error } = await supabase.from('products').update({ image_url: url }).eq('name', name);
    if (error) console.error(`Error updating ${name}:`, error.message);
    else console.log(`✅ ${name} → ${url}`);
  }
}
run();
