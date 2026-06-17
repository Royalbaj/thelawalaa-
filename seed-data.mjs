import { createClient } from "@supabase/supabase-js";


const supabaseUrl = "https://yxeosqdjiwokwxbcaiiv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4ZW9zcWRqaXdva3d4YmNhaWl2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDUwNzYwMCwiZXhwIjoyMDk2MDgzNjAwfQ.7ewN8me_QO0Y3ZbUn4eWsdXtn_rSvrOoZ_atf-ZqzKw";

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("Seeding branch...");
  let { data: branch } = await supabase.from("branches").select("id").eq("name", "Manigram Store").single();
  if (!branch) {
    const { data, error } = await supabase.from("branches").insert({
      name: "Manigram Store",
      address: "Manigram, Tilottama",
      is_active: true
    }).select("id").single();
    if (error) throw error;
    branch = data;
    console.log("Branch created:", branch.id);
  } else {
    console.log("Branch exists:", branch.id);
  }

  console.log("Seeding categories...");
  const catNames = ["Chatpate", "Panipuri", "Momo", "Specials"];
  const categories = {};
  for (const name of catNames) {
    let { data: cat } = await supabase.from("categories").select("id").eq("name", name).single();
    if (!cat) {
      const { data, error } = await supabase.from("categories").insert({ name, is_active: true }).select("id").single();
      if (error) throw error;
      cat = data;
    }
    categories[name] = cat.id;
  }

  console.log("Seeding products...");
  const products = [
    { name: "Panipuri (8 pc)", description: "Crispy puri, spicy jal, sweet chutney", price: 50, category_id: categories["Panipuri"], spice_level: 2, is_veg: true, is_bestseller: true },
    { name: "Normal Chatpate", description: "Authentic street style with puffed rice, spices, and lime.", price: 50, category_id: categories["Chatpate"], spice_level: 3, is_veg: true, is_bestseller: true },
    { name: "Mint Chatpate", description: "Refreshing minty twist on the classic.", price: 50, category_id: categories["Chatpate"], spice_level: 1, is_veg: true },
    { name: "Chicken Chatpate", description: "Spicy chicken bits mixed with classic chatpate.", price: 90, category_id: categories["Chatpate"], spice_level: 2, is_veg: false, is_bestseller: true },
    { name: "Spicy Ramen Chatpate", description: "Korean ramen noodles mixed in local street style.", price: 60, category_id: categories["Specials"], spice_level: 3, is_veg: true },
    { name: "Chicken Momo", description: "Juicy steamed chicken momos (10 pc).", price: 120, category_id: categories["Momo"], spice_level: 1, is_veg: false, is_bestseller: true },
    { name: "Veg Momo", description: "Fresh vegetable momos (10 pc).", price: 90, category_id: categories["Momo"], spice_level: 1, is_veg: true }
  ];

  for (const p of products) {
    // Upsert by name
    const { data: existing } = await supabase.from("products").select("id").eq("name", p.name).single();
    if (existing) {
      console.log(`Product ${p.name} exists, updating...`);
      await supabase.from("products").update(p).eq("id", existing.id);
    } else {
      console.log(`Inserting product ${p.name}...`);
      const { error } = await supabase.from("products").insert(p);
      if (error) console.error("Error inserting", p.name, error);
    }
  }

  console.log("Done!");
}

seed().catch(console.error);
