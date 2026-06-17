"use client";
import { useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Search } from "lucide-react";
import { createPosOrder } from "@/app/actions/pos";
import { npr, cn } from "@/lib/utils";

type Product = { id: string; name: string; price: number; is_available: boolean; category_id: string | null };
type Category = { id: string; name: string };
type Line = { product: Product; qty: number };

export default function PosTerminal({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [type, setType] = useState<"dine_in" | "pickup">("dine_in");
  const [method, setMethod] = useState<"cash" | "qr" | "card">("cash");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState<{ orderNumber: string; total: number } | null>(null);
  const [pending, start] = useTransition();

  const visible = useMemo(
    () => products.filter((p) =>
      (cat === "all" || p.category_id === cat) &&
      p.name.toLowerCase().includes(q.toLowerCase())),
    [products, cat, q]
  );
  const subtotal = cart.reduce((s, l) => s + Number(l.product.price) * l.qty, 0);

  const add = (p: Product) => {
    if (!p.is_available) return;
    setCart((c) => {
      const i = c.findIndex((l) => l.product.id === p.id);
      if (i >= 0) { const n = [...c]; n[i] = { ...n[i], qty: Math.min(n[i].qty + 1, 20) }; return n; }
      return [...c, { product: p, qty: 1 }];
    });
  };
  const bump = (id: string, d: number) =>
    setCart((c) => c.map((l) => l.product.id === id ? { ...l, qty: l.qty + d } : l).filter((l) => l.qty > 0));

  const placeOrder = () =>
    start(async () => {
      const r = await createPosOrder({
        type, payment_method: method,
        customer_phone: phone || undefined,
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
      });
      if (r?.error) toast.error(r.error);
      else { setDone({ orderNumber: r.orderNumber!, total: Number(r.total) }); setCart([]); setPhone(""); }
    });

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Product grid */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 overflow-x-auto border-b border-orange-100 bg-white p-3">
          <div className="relative shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="input !w-40 !py-1.5 !pl-9 text-sm" />
          </div>
          {[{ id: "all", name: "All" }, ...categories].map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)}
              className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm font-bold",
                cat === c.id ? "bg-brand-orange text-white" : "bg-orange-50 text-stone-600")}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto bg-brand-cream p-4 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <button key={p.id} onClick={() => add(p)} disabled={!p.is_available}
              className={cn("card min-h-[100px] p-4 text-left transition-transform",
                p.is_available ? "hover:scale-[1.02] active:scale-95" : "opacity-40")}>
              <p className="font-bold leading-tight">{p.name}</p>
              <p className="mt-2 font-display text-brand-orange">{npr(Number(p.price))}</p>
              {!p.is_available && <p className="text-xs font-bold text-brand-red">Sold out</p>}
            </button>
          ))}
        </div>
      </div>

      {/* Cart panel */}
      <div className="flex w-80 shrink-0 flex-col border-l border-orange-100 bg-white xl:w-96">
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 && <p className="py-12 text-center text-sm text-stone-400">Tap items to add them.</p>}
          {cart.map((l) => (
            <div key={l.product.id} className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{l.product.name}</p>
                <p className="text-xs text-stone-500">{npr(Number(l.product.price) * l.qty)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => bump(l.product.id, -1)} className="h-8 w-8 rounded-full bg-orange-50 font-bold">−</button>
                <span className="w-5 text-center font-bold">{l.qty}</span>
                <button onClick={() => bump(l.product.id, 1)} className="h-8 w-8 rounded-full bg-orange-50 font-bold">+</button>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-3 border-t border-orange-100 p-4">
          <div className="flex gap-2">
            {(["dine_in", "pickup"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={cn("flex-1 rounded-xl py-2 text-sm font-bold capitalize",
                  type === t ? "bg-brand-orange text-white" : "bg-orange-50 text-stone-600")}>
                {t.replace("_", "-")}
              </button>
            ))}
          </div>
          <input value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 13))}
            placeholder="Customer phone (optional)" className="input !py-2 text-sm" />
          <div className="flex gap-2">
            {([["cash", "Cash"], ["qr", "QR"], ["card", "Card"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setMethod(v)}
                className={cn("flex-1 rounded-xl py-2 text-sm font-bold",
                  method === v ? "bg-brand-green text-white" : "bg-orange-50 text-stone-600")}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex justify-between font-display text-lg font-bold">
            <span>Total</span><span>{npr(subtotal)}</span>
          </div>
          <button onClick={placeOrder} disabled={pending || cart.length === 0}
            className="btn-primary w-full !py-3 text-base disabled:opacity-50">
            {pending ? "Placing…" : "Place order"}
          </button>
        </div>
      </div>

      {/* Success modal */}
      {done && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-sm p-6 text-center print:shadow-none">
            <p className="text-4xl">✅</p>
            <h2 className="mt-2 font-display text-xl font-bold text-brand-brown">Order placed</h2>
            <p className="mt-1 font-mono text-lg font-bold">{done.orderNumber}</p>
            <p className="font-bold">{npr(done.total)} · paid</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => window.print()} className="btn-outline flex-1">Print</button>
              <button onClick={() => setDone(null)} className="btn-primary flex-1">New order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
