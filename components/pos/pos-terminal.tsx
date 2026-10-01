"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { Search, X, Trash2, ShoppingCart, ChevronUp, UtensilsCrossed, CheckCircle2, Minus, Plus, GraduationCap } from "lucide-react";
import { createPosOrder } from "@/app/actions/pos";
import { npr, cn } from "@/lib/utils";
import { applyOpeningPromoPrice, isOpeningPromoActive, type OpeningPromoSettings } from "@/lib/promo";
import { studentDiscount } from "@/lib/discounts";

type Product = {
  id: string; name: string; price: number; is_available: boolean; category_id: string | null;
  image_url?: string | null; student_discount_eligible?: boolean;
};
type Category = { id: string; name: string };
type Line = { product: Product; qty: number };

const MAX_QTY = 50; // per line — the same cap createPosOrder enforces

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
  const [student, setStudent] = useState(false);
  const [done, setDone] = useState<{ orderNumber: string; dailyNumber: number | null; total: number; discount: number } | null>(null);
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
  const subtotal = useMemo(() => cart.reduce((s, l) => s + priceOf(l.product) * l.qty, 0), [cart, openingPromo]);
  // Coca-Cola, and anything else Admin → Menu excludes, doesn't count towards the student discount.
  const eligible = useMemo(
    () => cart.reduce((s, l) => s + (l.product.student_discount_eligible === false ? 0 : priceOf(l.product) * l.qty), 0),
    [cart, openingPromo]
  );
  const discount = student ? studentDiscount(eligible) : 0;
  const total = subtotal - discount;
  const itemCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);
  const received = Number(cashReceived) || 0;
  const change = method === "cash" && received > total ? received - total : 0;
  // One tap for the usual cash handed over: the exact amount, or a note bigger than the total.
  const quickCash = [total, ...[100, 500, 1000].filter((n) => n > total)];

  // The confirmation shouldn't block the next customer — it clears itself.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(null), 8000);
    return () => clearTimeout(t);
  }, [done]);

  const qtyOf = (id: string) => cart.find((l) => l.product.id === id)?.qty ?? 0;
  // Every quantity change goes through here: clamped to 0–MAX_QTY, and 0 removes the line.
  const changeQty = (p: Product, next: (qty: number) => number) =>
    setCart((c) => {
      const cur = c.find((l) => l.product.id === p.id)?.qty ?? 0;
      const qty = Math.max(0, Math.min(next(cur), MAX_QTY));
      if (qty === 0) return c.filter((l) => l.product.id !== p.id);
      return cur ? c.map((l) => (l.product.id === p.id ? { ...l, qty } : l)) : [...c, { product: p, qty }];
    });
  const add = (p: Product) => { if (p.is_available) changeQty(p, (n) => n + 1); };
  const clearCart = () => { if (cart.length && confirm("Clear the whole cart?")) setCart([]); };

  const placeOrder = () =>
    start(async () => {
      const r = await createPosOrder({
        type, payment_method: method,
        customer_name: name || undefined,
        customer_phone: phone || undefined,
        student_discount: student,
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
      });
      if (r?.error) { toast.error(r.error); return; }
      setDone({ orderNumber: r.orderNumber!, dailyNumber: r.dailyNumber ?? null, total: Number(r.total), discount: Number(r.discount ?? 0) });
      setCart([]); setName(""); setPhone(""); setCashReceived(""); setStudent(false); setCartOpen(false);
    });

  const CartContents = (
    <>
      <div className="flex items-center justify-between px-4 pt-4 lg:px-0 lg:pt-0">
        <p className="font-display font-bold text-brand-brown dark:text-orange-100 lg:hidden">Cart</p>
        <div className="flex items-center gap-3 lg:hidden">
          {cart.length > 0 && (
            <button onClick={clearCart} className="flex touch-manipulation items-center gap-1 p-1 text-xs font-bold text-brand-red">
              <Trash2 size={13} /> Clear
            </button>
          )}
          <button onClick={() => setCartOpen(false)} className="touch-manipulation rounded-full bg-orange-50 p-2 dark:bg-stone-800"><X size={18} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {cart.length === 0 && <p className="py-12 text-center text-sm text-stone-400 dark:text-stone-500">Tap items to add them.</p>}
        {cart.map((l) => (
          <div key={l.product.id} className="mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{l.product.name}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {npr(priceOf(l.product) * l.qty)}
                {isDiscounted(l.product) && <span className="ml-1 font-bold text-brand-green">Opening offer</span>}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => changeQty(l.product, (n) => n - 1)} aria-label={`One less ${l.product.name}`}
                className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full bg-orange-50 transition active:scale-90 dark:bg-stone-800">
                <Minus size={16} />
              </button>
              <input
                type="number" inputMode="numeric" min={1} max={MAX_QTY} value={l.qty}
                aria-label={`Quantity of ${l.product.name}`}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => { const n = parseInt(e.target.value, 10); if (n >= 1) changeQty(l.product, () => n); }}
                className="h-11 w-12 rounded-lg border border-orange-100 bg-white text-center font-bold outline-none focus:border-brand-orange dark:border-stone-700 dark:bg-stone-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button onClick={() => changeQty(l.product, (n) => n + 1)} aria-label={`One more ${l.product.name}`}
                className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full bg-orange-50 transition active:scale-90 dark:bg-stone-800">
                <Plus size={16} />
              </button>
              <button onClick={() => changeQty(l.product, () => 0)} aria-label={`Remove ${l.product.name}`}
                className="ml-1 flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-brand-red dark:hover:bg-red-950/40">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t border-orange-100 p-4 dark:border-stone-800">
        <div className="flex gap-2">
          {(["dine_in", "pickup"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={cn("flex-1 touch-manipulation rounded-xl py-3 text-sm font-bold capitalize",
                type === t ? "bg-brand-orange text-white" : "bg-orange-50 text-stone-600 dark:bg-stone-800 dark:text-stone-300")}>
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
        <button
          onClick={() => setStudent((s) => !s)}
          aria-pressed={student}
          className={cn("flex w-full touch-manipulation items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-bold transition",
            student
              ? "border-brand-green bg-green-50 text-brand-green dark:bg-green-950/40 dark:text-green-400"
              : "border-orange-100 bg-white text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300")}
        >
          <span className="flex items-center gap-2"><GraduationCap size={16} /> Student discount 5%</span>
          <span>{student ? (discount ? `−${npr(discount)}` : "On") : "Off"}</span>
        </button>
        <div className="flex gap-2">
          {([["cash", "Cash"], ["qr", "QR"], ["card", "Card"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setMethod(v)}
              className={cn("flex-1 touch-manipulation rounded-xl py-3 text-sm font-bold",
                method === v ? "bg-brand-green text-white" : "bg-orange-50 text-stone-600 dark:bg-stone-800 dark:text-stone-300")}>
              {label}
            </button>
          ))}
        </div>
        {method === "cash" && (
          <div className="flex items-center gap-2 rounded-xl bg-orange-50/60 p-2.5 dark:bg-stone-800/60">
            <label className="shrink-0 text-xs font-bold text-stone-500 dark:text-stone-400">Cash received</label>
            <input
              type="number" min="0" inputMode="decimal" value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              placeholder="Rs" className="input !w-24 !py-1.5 !text-sm ml-auto"
            />
            {change > 0 && <span className="shrink-0 text-sm font-extrabold text-brand-green">Change {npr(change)}</span>}
          </div>
        )}
        {method === "cash" && cart.length > 0 && (
          <div className="flex gap-1.5">
            {quickCash.map((v, i) => (
              <button key={v} onClick={() => setCashReceived(String(v))}
                className={cn("flex-1 touch-manipulation rounded-lg border py-2 text-xs font-bold transition active:scale-95",
                  received === v
                    ? "border-brand-green bg-green-50 text-brand-green dark:bg-green-950/40"
                    : "border-orange-100 bg-white text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300")}>
                {i === 0 ? "Exact" : npr(v)}
              </button>
            ))}
          </div>
        )}
        {discount > 0 && (
          <div className="space-y-0.5 text-sm text-stone-500 dark:text-stone-400">
            <p className="flex justify-between"><span>Subtotal</span><span>{npr(subtotal)}</span></p>
            <p className="flex justify-between font-bold text-brand-green"><span>Student discount</span><span>−{npr(discount)}</span></p>
          </div>
        )}
        <div className="flex justify-between font-display text-lg font-bold">
          <span>Total ({itemCount})</span><span>{npr(total)}</span>
        </div>
        <button onClick={placeOrder} disabled={pending || cart.length === 0}
          className="btn-primary w-full touch-manipulation !py-4 text-base disabled:opacity-50">
          {pending ? "Placing…" : "Place order"}
        </button>
      </div>
    </>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden lg:flex-row">
      {/* Product grid */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 overflow-x-auto border-b border-orange-100 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
          <div className="relative shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="input !w-36 !py-1.5 !pl-9 text-sm sm:!w-40" />
          </div>
          {[{ id: "all", name: "All" }, ...categories].map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)}
              className={cn("shrink-0 touch-manipulation rounded-full px-4 py-2 text-sm font-bold",
                cat === c.id ? "bg-brand-orange text-white" : "bg-orange-50 text-stone-600 dark:bg-stone-800 dark:text-stone-300")}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto bg-brand-cream p-4 pb-24 dark:bg-stone-950 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 lg:pb-4">
          {visible.map((p) => {
            const qty = qtyOf(p.id);
            return (
              <div key={p.id} className={cn("card relative overflow-hidden", !p.is_available && "opacity-40", qty > 0 && "ring-2 ring-brand-orange")}>
                <button onClick={() => add(p)} disabled={!p.is_available}
                  className="block w-full touch-manipulation text-left transition-transform active:scale-[0.97]">
                  {p.image_url ? (
                    <div className="relative h-20 w-full">
                      <Image src={p.image_url} alt="" fill sizes="200px" className="object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-20 w-full items-center justify-center bg-brand-cream text-stone-300 dark:bg-stone-800 dark:text-stone-600"><UtensilsCrossed size={24} /></div>
                  )}
                  {isDiscounted(p) && (
                    <span className="absolute left-2 top-2 rounded-full bg-brand-green px-2 py-0.5 text-[10px] font-bold text-white shadow">Opening offer</span>
                  )}
                  <div className="p-3">
                    <p className="font-bold leading-tight">{p.name}</p>
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
                </button>
                {/* Change the quantity right on the tile — no need to open the cart. */}
                {qty > 0 && (
                  <div className="flex items-center border-t border-orange-100 dark:border-stone-800">
                    <button onClick={() => changeQty(p, (n) => n - 1)} aria-label={`One less ${p.name}`}
                      className="flex h-10 flex-1 touch-manipulation items-center justify-center text-brand-orange active:bg-orange-50 dark:active:bg-stone-800">
                      <Minus size={18} />
                    </button>
                    <span className="min-w-[2rem] text-center font-display text-lg font-bold">{qty}</span>
                    <button onClick={() => add(p)} aria-label={`One more ${p.name}`}
                      className="flex h-10 flex-1 touch-manipulation items-center justify-center text-brand-orange active:bg-orange-50 dark:active:bg-stone-800">
                      <Plus size={18} />
                    </button>
                  </div>
                )}
              </div>
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
          className="absolute inset-x-3 bottom-3 z-30 flex touch-manipulation items-center justify-between rounded-2xl bg-brand-orange px-5 py-3.5 text-white shadow-lg shadow-orange-900/30 lg:hidden"
        >
          <span className="flex items-center gap-2 font-bold"><ShoppingCart size={18} /> {itemCount} item{itemCount > 1 ? "s" : ""}</span>
          <span className="flex items-center gap-1.5 font-display font-bold">{npr(total)} <ChevronUp size={18} /></span>
        </button>
      )}

      {/* Mobile backdrop + slide-up cart */}
      {cartOpen && <div className="absolute inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setCartOpen(false)} />}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-50 flex max-h-[85%] flex-col rounded-t-3xl bg-white transition-transform duration-300 ease-out dark:bg-stone-900 lg:static lg:z-auto lg:h-full lg:w-80 lg:max-h-none lg:translate-y-0 lg:rounded-none lg:border-l lg:border-orange-100 lg:dark:border-stone-800 xl:w-96",
          cartOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0"
        )}
      >
        {CartContents}
      </div>

      {/* Success modal — print:only isolates this from the rest of the app */}
      {done && (
        <div onClick={() => setDone(null)} className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 print:static print:bg-white print:p-0">
          <div id="pos-receipt" onClick={(e) => e.stopPropagation()} className="card w-full max-w-sm p-6 text-center print:bg-white print:text-black print:shadow-none print:ring-0 print:border-0">
            <CheckCircle2 size={40} className="mx-auto text-brand-green" />
            <h2 className="mt-2 font-display text-xl font-bold text-brand-brown dark:text-orange-100">Order placed</h2>
            {done.dailyNumber != null && (
              <p className="mt-2 font-mono text-4xl font-extrabold text-brand-orange">#{String(done.dailyNumber).padStart(2, "0")}</p>
            )}
            <p className="mt-1 font-mono text-sm text-stone-500 dark:text-stone-400">{done.orderNumber}</p>
            {done.discount > 0 && <p className="mt-1 text-sm font-bold text-brand-green">Student discount −{npr(done.discount)}</p>}
            <p className="mt-1 font-bold">{npr(done.total)} · paid</p>
            <div className="mt-4 flex gap-2 print:hidden">
              <button onClick={() => window.print()} className="btn-outline flex-1 touch-manipulation !border-stone-300 !text-brand-brown hover:!bg-stone-100 dark:!border-stone-600 dark:!text-stone-200 dark:hover:!bg-stone-800">Print</button>
              <button onClick={() => setDone(null)} className="btn-primary flex-1 touch-manipulation">New order</button>
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
