const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data: p, error: pe } = await supabase.from('products').select('*');
  const { data: c, error: ce } = await supabase.from('categories').select('*');
  console.log('Products:', p?.length, pe);
  console.log('Categories:', c?.length, ce);
}
run();
