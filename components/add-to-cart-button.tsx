"use client";
import toast from "react-hot-toast";
import { useCart } from "@/lib/store/cart";

export default function AddToCartButton({ product }: { product: { product_id: string; name: string; price: number } }) {
  const add = useCart((s) => s.add);
  return (
    <button
      onClick={() => { add(product); toast.success(`${product.name} added`); }}
      className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition hover:brightness-110"
    >
      Add
    </button>
  );
}
