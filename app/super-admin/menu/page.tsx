import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr } from "@/lib/utils";
import {
  AvailabilityToggle, DeleteProductButton, AddProductForm, AddCategoryForm,
} from "@/components/admin/menu-controls";

export const dynamic = "force-dynamic";

export default async function MenuManager() {
  await requireRole(["admin"]);
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabaseAdmin.from("categories").select("id, name").order("sort_order"),
    supabaseAdmin.from("products").select("id, name, price, is_available, is_bestseller, spice_level, category_id").order("sort_order"),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {(categories ?? []).map((c) => (
          <section key={c.id}>
            <h2 className="mb-2 font-display font-bold text-brand-brown">{c.name}</h2>
            <div className="card divide-y divide-orange-50">
              {(products ?? []).filter((p) => p.category_id === c.id).map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-bold">{p.name} {p.is_bestseller && "⭐"}</p>
                    <p className="text-xs text-stone-500">{npr(Number(p.price))} · spice {"🌶".repeat(p.spice_level) || "—"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <AvailabilityToggle id={p.id} available={p.is_available} />
                    <DeleteProductButton id={p.id} name={p.name} />
                  </div>
                </div>
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
