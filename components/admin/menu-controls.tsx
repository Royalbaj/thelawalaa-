"use client";
import { useState, useTransition } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { UtensilsCrossed } from "lucide-react";
import { npr, cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  createProduct, updateProduct, setProductAvailability, deleteProduct, createCategory,
  createProductPhotoUpload, setProductPhoto,
} from "@/app/actions/admin-crud";

type EditableProduct = {
  id: string; name: string; description: string | null; category_id: string;
  price: number; is_available: boolean; is_veg: boolean; spice_level: number; is_bestseller: boolean;
  image_url: string | null; pos_only: boolean; student_discount_eligible: boolean;
  member_price: number | string | null; is_membership_card?: boolean;
};

/** "Where it's sold" + discount options, shared by the add and edit forms. */
function SalesOptions({ posOnly = false, studentDiscount = true, memberPrice = null, membershipCard = false }: {
  posOnly?: boolean; studentDiscount?: boolean; memberPrice?: number | string | null; membershipCard?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-stone-600">
      <label className="flex items-center gap-2" title="Shown on the POS only — hidden from the website and online orders">
        <input type="checkbox" name="pos_only" defaultChecked={posOnly} /> POS only
      </label>
      <label className="flex items-center gap-2" title="The POS student discount (5%) applies to this item">
        <input type="checkbox" name="student_discount_eligible" defaultChecked={studentDiscount} /> Student discount applies
      </label>
      <label className="flex items-center gap-2" title="What a member pays when the POS has Member switched on. Leave blank for no member price.">
        Member price
        <input name="member_price" type="number" min="1" step="0.01" defaultValue={memberPrice ?? ""} placeholder="—" className="input !w-24 !py-1" />
      </label>
      <label className="flex items-center gap-2" title="Selling it at the POS asks for the new member's name and mobile number (Admin → Members). Always POS only.">
        <input type="checkbox" name="is_membership_card" defaultChecked={membershipCard} /> Membership card
      </label>
    </div>
  );
}

// Phone photos are 3–10 MB; the menu never shows one wider than ~600px, so
// shrink to 1200px JPEG before uploading — much faster on mobile data.
async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    .catch(() => { throw new Error("Use a JPG, PNG or WebP photo"); });
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNGs would otherwise turn black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo"))), "image/jpeg", 0.85));
}

/** Pick a photo → shrink it → upload straight to Storage → point the product at it. */
export function ProductPhotoButton({ productId, hasPhoto }: { productId: string; hasPhoto: boolean }) {
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const photo = await shrinkPhoto(file);
      const slot = await createProductPhotoUpload(productId);
      if (!slot.path || !slot.token) throw new Error(slot.error ?? "Couldn't start the upload");
      const { error } = await createClient().storage.from("products")
        .uploadToSignedUrl(slot.path, slot.token, photo, { contentType: "image/jpeg" });
      if (error) throw new Error("Upload failed — check the connection and try again");
      const r = await setProductPhoto(productId, slot.path);
      if (r?.error) throw new Error(r.error);
      toast.success("Photo updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className={cn("cursor-pointer text-xs font-bold text-brand-orange", busy && "pointer-events-none opacity-50")}>
      {busy ? "Uploading…" : hasPhoto ? "Change photo" : "Add photo"}
      <input
        type="file" accept="image/*" className="hidden" disabled={busy}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }}
      />
    </label>
  );
}

/** One product row: summary + actions, with an inline edit form that expands below (not inside the actions flex row, so it lays out full-width regardless of sibling wrapping). */
export function ProductRow({ product, categories }: { product: EditableProduct; categories: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-orange-50">
            {product.image_url ? (
              <Image src={product.image_url} alt="" fill sizes="48px" className="object-cover" />
            ) : (
              <UtensilsCrossed size={18} className="absolute inset-0 m-auto text-stone-300" />
            )}
          </div>
          <div>
            <p className="font-bold">
              {product.name} {product.is_bestseller && <span className="badge ml-1.5 bg-orange-100 text-brand-orange">Bestseller</span>}
              {product.pos_only && <span className="badge ml-1.5 bg-stone-800 text-white">POS only</span>}
              {product.is_membership_card && <span className="badge ml-1.5 bg-amber-100 text-amber-800">Membership card</span>}
            </p>
            <p className="text-xs text-stone-500">
              {npr(Number(product.price))} · spice {product.spice_level ? `${product.spice_level}/3` : "mild"}
              {product.member_price != null && ` · member ${npr(Number(product.member_price))}`}
              {!product.student_discount_eligible && " · no student discount"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AvailabilityToggle id={product.id} available={product.is_available} />
          <ProductPhotoButton productId={product.id} hasPhoto={!!product.image_url} />
          <button onClick={() => setEditing((v) => !v)} className="text-xs font-bold text-brand-orange">{editing ? "Close" : "Edit"}</button>
          <DeleteProductButton id={product.id} name={product.name} />
        </div>
      </div>
      {editing && (
        <form
          className="mt-3 space-y-2 rounded-xl bg-orange-50/50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = Object.fromEntries(new FormData(e.currentTarget));
            start(async () => {
              const r = await updateProduct(product.id, {
                name: fd.name, description: fd.description, category_id: fd.category_id,
                price: fd.price, spice_level: fd.spice_level,
                is_veg: fd.is_veg === "on", is_bestseller: fd.is_bestseller === "on",
                pos_only: fd.pos_only === "on", student_discount_eligible: fd.student_discount_eligible === "on",
                member_price: fd.member_price, is_membership_card: fd.is_membership_card === "on",
              });
              if (r?.error) toast.error(r.error);
              else { toast.success("Product updated"); setEditing(false); }
            });
          }}
        >
          <input name="name" required defaultValue={product.name} placeholder="Name" className="input" maxLength={120} />
          <textarea name="description" defaultValue={product.description ?? ""} placeholder="Description" rows={2} className="input" maxLength={500} />
          <div className="grid grid-cols-2 gap-2">
            <select name="category_id" required defaultValue={product.category_id} className="input">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input name="price" required type="number" min="1" step="0.01" defaultValue={product.price} placeholder="Price Rs" className="input" />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-stone-600">
            <label className="flex items-center gap-2"><input type="checkbox" name="is_veg" defaultChecked={product.is_veg} /> Veg</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="is_bestseller" defaultChecked={product.is_bestseller} /> Bestseller</label>
            <label className="flex items-center gap-2">Spice
              <select name="spice_level" defaultValue={product.spice_level} className="input !w-16 !py-1">{[0, 1, 2, 3].map((n) => <option key={n}>{n}</option>)}</select>
            </label>
          </div>
          <SalesOptions posOnly={product.pos_only} studentDiscount={product.student_discount_eligible} memberPrice={product.member_price} membershipCard={product.is_membership_card} />
          <div className="flex gap-2">
            <button disabled={pending} className="btn-primary !py-1.5 text-sm">{pending ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full bg-white px-4 py-1.5 text-sm font-bold border border-stone-200">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

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
            pos_only: fd.pos_only === "on", student_discount_eligible: fd.student_discount_eligible === "on",
            member_price: fd.member_price, is_membership_card: fd.is_membership_card === "on",
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
      <SalesOptions />
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
