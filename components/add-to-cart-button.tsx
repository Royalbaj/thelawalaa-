"use client";
import toast from "react-hot-toast";
import { useCart } from "@/lib/store/cart";
import { UI, type SiteLang } from "@/lib/site-lang";

export default function AddToCartButton({ product, lang = "en" }: { product: { product_id: string; name: string; price: number }; lang?: SiteLang }) {
  const add = useCart((s) => s.add);
  const L = UI[lang];
  return (
    <button
      onClick={() => { add(product); toast.success(L.added(product.name)); }}
      className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white transition hover:brightness-110"
    >
      {L.add}
    </button>
  );
}
