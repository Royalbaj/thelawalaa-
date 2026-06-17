const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: p } = await supabase.from('products').select('*');
  const { data: c } = await supabase.from('categories').select('*');
  console.log('Products:', p?.length || p);
  console.log('Categories:', c?.length || c);
}
run();
