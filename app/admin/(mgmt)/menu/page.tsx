import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  AddProductForm, AddCategoryForm, ProductRow,
} from "@/components/admin/menu-controls";

export const dynamic = "force-dynamic";

export default async function MenuManager() {
  await requireRole(["admin"]);
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabaseAdmin.from("categories").select("id, name").order("sort_order"),
    supabaseAdmin.from("products").select("id, name, description, price, is_available, is_veg, is_bestseller, spice_level, category_id").order("sort_order"),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {(categories ?? []).map((c) => (
          <section key={c.id}>
            <h2 className="mb-2 font-display font-bold text-brand-brown">{c.name}</h2>
            <div className="card divide-y divide-orange-50">
              {(products ?? []).filter((p) => p.category_id === c.id).map((p) => (
                <ProductRow key={p.id} product={p} categories={(categories ?? []) as never} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="space-y-4">
        <AddProductForm categories={(categories ?? []) as never} />
        <AddCategoryForm />
      </div>
    </div>
  );
}
