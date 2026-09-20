"use client";
import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { Search, X, Trash2, ShoppingCart, ChevronUp, UtensilsCrossed, CheckCircle2 } from "lucide-react";
import { createPosOrder } from "@/app/actions/pos";
import { npr, cn } from "@/lib/utils";
import { applyOpeningPromoPrice, isOpeningPromoActive, type OpeningPromoSettings } from "@/lib/promo";

type Product = { id: string; name: string; price: number; is_available: boolean; category_id: string | null; image_url?: string | null };
type Category = { id: string; name: string };
type Line = { product: Product; qty: number };

export default function PosTerminal({
  products, categories, openingPromo,
}: { products: Product[]; categories: Category[]; openingPromo?: OpeningPromoSettings | null }) {
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [type, setType] = useState<"dine_in" | "pickup">("dine_in");
  const [method, setMethod] = useState<"cash" | "qr" | "card">("cash");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [done, setDone] = useState<{ orderNumber: string; dailyNumber: number | null; total: number } | null>(null);
  const [pending, start] = useTransition();

  const promoActive = isOpeningPromoActive(openingPromo);
  const categoryName = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.name]));
    return (p: Product) => m.get(p.category_id ?? "") ?? null;
  }, [categories]);
  const priceOf = (p: Product) => applyOpeningPromoPrice(Number(p.price), categoryName(p), openingPromo);
  const isDiscounted = (p: Product) => promoActive && priceOf(p) !== Number(p.price);

  const visible = useMemo(
    () => products.filter((p) =>
      (cat === "all" || p.category_id === cat) &&
      p.name.toLowerCase().includes(q.toLowerCase())),
    [products, cat, q]
  );
  const subtotal = cart.reduce((s, l) => s + priceOf(l.product) * l.qty, 0);
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);
  const received = Number(cashReceived) || 0;
  const change = method === "cash" && received > subtotal ? received - subtotal : 0;

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
  const removeLine = (id: string) => setCart((c) => c.filter((l) => l.product.id !== id));
  const clearCart = () => { if (cart.length && confirm("Clear the whole cart?")) setCart([]); };

  const placeOrder = () =>
    start(async () => {
      const r = await createPosOrder({
        type, payment_method: method,
        customer_name: name || undefined,
        customer_phone: phone || undefined,
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
      });
      if (r?.error) { toast.error(r.error); return; }
      setDone({ orderNumber: r.orderNumber!, dailyNumber: r.dailyNumber ?? null, total: Number(r.total) });
      setCart([]); setName(""); setPhone(""); setCashReceived(""); setCartOpen(false);
    });

  const CartContents = (
    <>
      <div className="flex items-center justify-between px-4 pt-4 lg:px-0 lg:pt-0">
        <p className="font-display font-bold text-brand-brown lg:hidden">Cart</p>
        <div className="flex items-center gap-3 lg:hidden">
          {cart.length > 0 && (
            <button onClick={clearCart} className="flex items-center gap-1 text-xs font-bold text-brand-red">
              <Trash2 size={13} /> Clear
            </button>
          )}
          <button onClick={() => setCartOpen(false)} className="rounded-full bg-orange-50 p-1.5"><X size={18} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {cart.length === 0 && <p className="py-12 text-center text-sm text-stone-400">Tap items to add them.</p>}
        {cart.map((l) => (
          <div key={l.product.id} className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{l.product.name}</p>
              <p className="text-xs text-stone-500">
                {npr(priceOf(l.product) * l.qty)}
                {isDiscounted(l.product) && <span className="ml-1 font-bold text-brand-green">Opening offer</span>}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => bump(l.product.id, -1)} className="h-9 w-9 shrink-0 rounded-full bg-orange-50 text-lg font-bold active:scale-90 transition">−</button>
              <span className="w-6 text-center font-bold">{l.qty}</span>
              <button onClick={() => bump(l.product.id, 1)} className="h-9 w-9 shrink-0 rounded-full bg-orange-50 text-lg font-bold active:scale-90 transition">+</button>
              <button onClick={() => removeLine(l.product.id)} className="ml-1 h-9 w-9 shrink-0 rounded-full text-stone-400 hover:bg-red-50 hover:text-brand-red transition flex items-center justify-center">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t border-orange-100 p-4">
        <div className="flex gap-2">
          {(["dine_in", "pickup"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={cn("flex-1 rounded-xl py-2.5 text-sm font-bold capitalize",
                type === t ? "bg-brand-orange text-white" : "bg-orange-50 text-stone-600")}>
              {t.replace("_", "-")}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 100))}
            placeholder="Customer name" className="input !py-2.5 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 13))}
            placeholder="Phone (optional)" className="input !py-2.5 text-sm" />
        </div>
        <div className="flex gap-2">
          {([["cash", "Cash"], ["qr", "QR"], ["card", "Card"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setMethod(v)}
              className={cn("flex-1 rounded-xl py-2.5 text-sm font-bold",
                method === v ? "bg-brand-green text-white" : "bg-orange-50 text-stone-600")}>
              {label}
            </button>
          ))}
        </div>
        {method === "cash" && (
          <div className="flex items-center gap-2 rounded-xl bg-orange-50/60 p-2.5">
            <label className="shrink-0 text-xs font-bold text-stone-500">Cash received</label>
            <input
              type="number" min="0" inputMode="decimal" value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              placeholder="Rs" className="input !w-24 !py-1.5 !text-sm ml-auto"
            />
            {change > 0 && <span className="shrink-0 text-sm font-extrabold text-brand-green">Change {npr(change)}</span>}
          </div>
        )}
        <div className="flex justify-between font-display text-lg font-bold">
          <span>Total ({itemCount})</span><span>{npr(subtotal)}</span>
        </div>
        <button onClick={placeOrder} disabled={pending || cart.length === 0}
          className="btn-primary w-full !py-3.5 text-base disabled:opacity-50">
          {pending ? "Placing…" : "Place order"}
        </button>
      </div>
    </>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden lg:flex-row">
      {/* Product grid */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 overflow-x-auto border-b border-orange-100 bg-white p-3">
          <div className="relative shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="input !w-36 !py-1.5 !pl-9 text-sm sm:!w-40" />
          </div>
          {[{ id: "all", name: "All" }, ...categories].map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)}
              className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm font-bold",
                cat === c.id ? "bg-brand-orange text-white" : "bg-orange-50 text-stone-600")}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto bg-brand-cream p-4 pb-24 sm:grid-cols-3 xl:grid-cols-4 lg:pb-4">
          {visible.map((p) => {
            const inCart = cart.find((l) => l.product.id === p.id);
            return (
              <button key={p.id} onClick={() => add(p)} disabled={!p.is_available}
                className={cn("card relative overflow-hidden text-left transition-transform",
                  p.is_available ? "hover:scale-[1.02] active:scale-95" : "opacity-40",
                  inCart && "ring-2 ring-brand-orange")}>
                {p.image_url ? (
                  <div className="relative h-20 w-full">
                    <Image src={p.image_url} alt="" fill sizes="200px" className="object-cover" />
                  </div>
                ) : (
                  <div className="flex h-20 w-full items-center justify-center bg-brand-cream text-stone-300"><UtensilsCrossed size={24} /></div>
                )}
                {isDiscounted(p) && (
                  <span className="absolute left-2 top-2 rounded-full bg-brand-green px-2 py-0.5 text-[10px] font-bold text-white shadow">Opening offer</span>
                )}
                <div className="p-3">
                  <p className="font-bold leading-tight pr-6">{p.name}</p>
                  {isDiscounted(p) ? (
                    <p className="mt-1 flex items-center gap-1.5 font-display">
                      <span className="text-brand-orange">{npr(priceOf(p))}</span>
                      <span className="text-xs font-normal text-stone-400 line-through">{npr(Number(p.price))}</span>
                    </p>
                  ) : (
                    <p className="mt-1 font-display text-brand-orange">{npr(Number(p.price))}</p>
                  )}
                  {!p.is_available && <p className="text-xs font-bold text-brand-red">Sold out</p>}
                </div>
                {inCart && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-orange text-xs font-bold text-white">
                    {inCart.qty}
                  </span>
                )}
              </button>
            );
          })}
          {visible.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-stone-400">No items match.</p>
          )}
        </div>
      </div>

      {/* Mobile cart bar */}
      {cart.length > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="absolute inset-x-3 bottom-3 z-30 flex items-center justify-between rounded-2xl bg-brand-orange px-5 py-3.5 text-white shadow-lg shadow-orange-900/30 lg:hidden"
        >
          <span className="flex items-center gap-2 font-bold"><ShoppingCart size={18} /> {itemCount} item{itemCount > 1 ? "s" : ""}</span>
          <span className="flex items-center gap-1.5 font-display font-bold">{npr(subtotal)} <ChevronUp size={18} /></span>
        </button>
      )}

      {/* Mobile backdrop + slide-up cart */}
      {cartOpen && <div className="absolute inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setCartOpen(false)} />}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-50 flex max-h-[85%] flex-col rounded-t-3xl bg-white transition-transform duration-300 ease-out lg:static lg:z-auto lg:h-full lg:w-80 lg:max-h-none lg:translate-y-0 lg:rounded-none lg:border-l lg:border-orange-100 xl:w-96",
          cartOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0"
        )}
      >
        {CartContents}
      </div>

      {/* Success modal — print:only isolates this from the rest of the app */}
      {done && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 print:static print:bg-white print:p-0">
          <div id="pos-receipt" className="card w-full max-w-sm p-6 text-center print:shadow-none print:border-0">
            <CheckCircle2 size={40} className="mx-auto text-brand-green" />
            <h2 className="mt-2 font-display text-xl font-bold text-brand-brown">Order placed</h2>
            {done.dailyNumber != null && (
              <p className="mt-2 font-mono text-4xl font-extrabold text-brand-orange">#{String(done.dailyNumber).padStart(2, "0")}</p>
            )}
            <p className="mt-1 font-mono text-sm text-stone-500">{done.orderNumber}</p>
            <p className="mt-1 font-bold">{npr(done.total)} · paid</p>
            <div className="mt-4 flex gap-2 print:hidden">
              <button onClick={() => window.print()} className="btn-outline flex-1 !border-stone-300 !text-brand-brown hover:!bg-stone-100">Print</button>
              <button onClick={() => setDone(null)} className="btn-primary flex-1">New order</button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #pos-receipt, #pos-receipt * { visibility: visible; }
          #pos-receipt { position: fixed; inset: 0; margin: auto; }
        }
      `}</style>
    </div>
  );
}
