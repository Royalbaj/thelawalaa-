"use client";
import { useTransition } from "react";
import toast from "react-hot-toast";
import {
  createProduct, setProductAvailability, deleteProduct, createCategory,
} from "@/app/actions/admin-crud";

export function AvailabilityToggle({ id, available }: { id: string; available: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => {
        const r = await setProductAvailability(id, !available);
        r?.error ? toast.error(r.error) : toast.success(available ? "Marked sold out" : "Back on the menu");
      })}
      className={available ? "badge bg-green-100 text-green-800" : "badge bg-stone-200 text-stone-600"}
    >
      {available ? "Available" : "Sold out"}
    </button>
  );
}

export function DeleteProductButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      className="text-xs font-bold text-brand-red"
      onClick={() => {
        if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
        start(async () => {
          const r = await deleteProduct(id);
          r?.error ? toast.error(r.error) : toast.success("Product deleted");
        });
      }}
    >
      Delete
    </button>
  );
}

export function AddProductForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = Object.fromEntries(new FormData(form));
        start(async () => {
          const r = await createProduct({
            name: fd.name, description: fd.description, category_id: fd.category_id,
            price: fd.price, spice_level: fd.spice_level,
            is_veg: fd.is_veg === "on", is_bestseller: fd.is_bestseller === "on",
          });
          if (r?.error) toast.error(r.error);
          else { toast.success("Product added"); form.reset(); }
        });
      }}
    >
      <h3 className="font-display font-bold text-brand-brown">Add product</h3>
      <input name="name" required placeholder="Name" className="input" maxLength={120} />
      <textarea name="description" placeholder="Description" rows={2} className="input" maxLength={500} />
      <div className="grid grid-cols-2 gap-3">
        <select name="category_id" required className="input">
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input name="price" required type="number" min="1" step="0.01" placeholder="Price Rs" className="input" />
      </div>
      <div className="flex items-center gap-4 text-sm font-bold text-stone-600">
        <label className="flex items-center gap-2"><input type="checkbox" name="is_veg" defaultChecked /> Veg</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="is_bestseller" /> Bestseller</label>
        <label className="flex items-center gap-2">Spice
          <select name="spice_level" className="input !w-16 !py-1">{[0,1,2,3].map((n) => <option key={n}>{n}</option>)}</select>
        </label>
      </div>
      <button disabled={pending} className="btn-primary">{pending ? "Saving…" : "Add product"}</button>
    </form>
  );
}

export function AddCategoryForm() {
  const [pending, start] = useTransition();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const name = String(new FormData(form).get("name") ?? "");
        start(async () => {
          const r = await createCategory(name);
          if (r?.error) toast.error(r.error); else { toast.success("Category added"); form.reset(); }
        });
      }}
    >
      <input name="name" required placeholder="New category" className="input" maxLength={60} />
      <button disabled={pending} className="btn-primary whitespace-nowrap">Add</button>
    </form>
  );
}
