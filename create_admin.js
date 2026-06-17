const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Creating admin user...");
  const { data: user, error } = await supabase.auth.admin.createUser({
    email: 'admin@thelawalaa.com',
    password: 'password123',
    email_confirm: true,
    user_metadata: { full_name: 'Super Admin' },
    app_metadata: { role: 'admin' }
  });

  if (error) {
    console.error("Error creating user:", error);
    return;
  }
  
  // Update the profile table role explicitly just in case the trigger didn't pick up app_metadata correctly
  if (user && user.user) {
    const { error: pErr } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', user.user.id);
    if (pErr) console.error("Profile update error:", pErr);
    else console.log("Admin user created and role updated successfully!");
  }
}
run();
