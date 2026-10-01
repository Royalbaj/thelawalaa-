"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { Search, X, Trash2, ShoppingCart, ChevronUp, UtensilsCrossed, CheckCircle2, Minus, Plus, GraduationCap, Crown } from "lucide-react";
import { createPosOrder } from "@/app/actions/pos";
import { npr, cn } from "@/lib/utils";
import { applyOpeningPromoPrice, isOpeningPromoActive, type OpeningPromoSettings } from "@/lib/promo";
import { studentDiscount, memberUnitPrice } from "@/lib/discounts";

type Product = {
  id: string; name: string; price: number; is_available: boolean; category_id: string | null;
  image_url?: string | null; student_discount_eligible?: boolean; member_price?: number | string | null;
};
type Category = { id: string; name: string };
type Line = { product: Product; qty: number };
type Deal = "none" | "student" | "member";
type Done = {
  orderNumber: string; dailyNumber: number | null; total: number;
  discount: number; discountLabel: string | null;
  method: "cash" | "qr"; received: number | null;
};

const MAX_QTY = 50; // per line — the same cap createPosOrder enforces
// After the exact amount, the next few notes a customer is likely to hand over.
const NOTES = [100, 500, 1000, 2000, 5000];

/** Two-option switch (Dine-in/Pickup, Cash/QR) — one row instead of two. */
function Segmented<T extends string>({ value, onChange, options, activeClass }: {
  value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[]; activeClass: string;
}) {
  return (
    <div className="flex rounded-xl bg-orange-50 p-1 dark:bg-stone-800">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
          className={cn("flex-1 touch-manipulation rounded-lg py-2.5 text-sm font-bold transition",
            value === v ? activeClass : "text-stone-600 dark:text-stone-300")}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function PosTerminal({
  products, categories, openingPromo,
}: { products: Product[]; categories: Category[]; openingPromo?: OpeningPromoSettings | null }) {
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [type, setType] = useState<"dine_in" | "pickup">("dine_in");
  const [method, setMethod] = useState<"cash" | "qr">("cash");
  const [cashReceived, setCashReceived] = useState("");
  // Student 5% and member price never stack — picking one switches the other off.
  const [deal, setDeal] = useState<Deal>("none");
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();

  const promoActive = isOpeningPromoActive(openingPromo);
  const categoryName = useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.name]));
    return (p: Product) => m.get(p.category_id ?? "") ?? null;
  }, [categories]);
  const priceOf = (p: Product) => applyOpeningPromoPrice(Number(p.price), categoryName(p), openingPromo);
  const memberApplies = (p: Product) => deal === "member" && memberUnitPrice(priceOf(p), p.member_price) < priceOf(p);
  // What this sale charges for one: the member price when Member is on and the item has one.
  const unitOf = (p: Product) => (memberApplies(p) ? memberUnitPrice(priceOf(p), p.member_price) : priceOf(p));
  const isPromo = (p: Product) => promoActive && priceOf(p) !== Number(p.price);

  const visible = useMemo(
    () => products.filter((p) =>
      (cat === "all" || p.category_id === cat) &&
      p.name.toLowerCase().includes(q.toLowerCase())),
    [products, cat, q]
  );
  // Same sums, in the same order, as createPosOrder — the screen and the charge can't drift apart.
  let subtotal = 0, eligible = 0, memberSaving = 0, itemCount = 0;
  for (const l of cart) {
    const price = priceOf(l.product);
    subtotal += price * l.qty;
    // Coca-Cola, and anything else Admin → Menu excludes, doesn't count towards the student discount.
    if (l.product.student_discount_eligible !== false) eligible += price * l.qty;
    memberSaving += (price - memberUnitPrice(price, l.product.member_price)) * l.qty;
    itemCount += l.qty;
  }
  const discount = deal === "member" ? Math.round(memberSaving * 100) / 100 : deal === "student" ? studentDiscount(eligible) : 0;
  const total = subtotal - discount;
  const received = Number(cashReceived) || 0;
  const change = method === "cash" && received > total ? received - total : 0;
  const short = method === "cash" && received > 0 && received < total ? total - received : 0;
  // One tap for the usual cash handed over: the exact amount, or a note bigger than the total.
  const quickCash = [total, ...NOTES.filter((n) => n > total).slice(0, 3)];

  // The confirmation shouldn't block the next customer — it clears itself,
  // a little later when there's change to count out.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(null), done.received ? 20_000 : 8_000);
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
  const toggleDeal = (d: Exclude<Deal, "none">) => setDeal((cur) => (cur === d ? "none" : d));

  const placeOrder = () =>
    start(async () => {
      const r = await createPosOrder({
        type, payment_method: method,
        student_discount: deal === "student",
        member: deal === "member",
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
      });
      if (r?.error) { toast.error(r.error); return; }
      setDone({
        orderNumber: r.orderNumber!, dailyNumber: r.dailyNumber ?? null, total: Number(r.total),
        discount: Number(r.discount ?? 0), discountLabel: r.discountLabel ?? null,
        method, received: method === "cash" && received > 0 ? received : null,
      });
      // Ready for the next customer: back to cash, no discount.
      setCart([]); setCashReceived(""); setDeal("none"); setMethod("cash"); setCartOpen(false);
    });

  const dealButton = (d: Exclude<Deal, "none">, Icon: typeof Crown, label: string) => {
    const on = deal === d;
    return (
      <button onClick={() => toggleDeal(d)} aria-pressed={on}
        className={cn("flex touch-manipulation flex-col items-center justify-center rounded-xl border px-2 py-1.5 transition",
          on
            ? "border-brand-green bg-green-50 text-brand-green dark:bg-green-950/40 dark:text-green-400"
            : "border-orange-100 bg-white text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300")}>
        <span className="flex items-center gap-1.5 text-sm font-bold"><Icon size={15} /> {label}</span>
        <span className="text-[11px] font-bold opacity-80">{on ? (discount ? `−${npr(discount)}` : "On") : "Off"}</span>
      </button>
    );
  };

  const CartContents = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-1 pt-3">
        <p className="font-display font-bold text-brand-brown dark:text-orange-100">Order{itemCount ? ` · ${itemCount}` : ""}</p>
        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <button onClick={clearCart} className="flex touch-manipulation items-center gap-1 p-1 text-xs font-bold text-brand-red">
              <Trash2 size={13} /> Clear
            </button>
          )}
          <button onClick={() => setCartOpen(false)} aria-label="Close cart"
            className="touch-manipulation rounded-full bg-orange-50 p-2 dark:bg-stone-800 lg:hidden"><X size={18} /></button>
        </div>
      </div>

      {/* Phones and iPad portrait: the lines and the options scroll as one, so
          the pinned footer (total + Place order) is always on screen.
          lg+ (iPad landscape, laptops): the lines scroll on their own and the options stay put. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:flex lg:flex-col lg:overflow-hidden">
        <div className="px-4 py-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
          {cart.length === 0 && <p className="py-10 text-center text-sm text-stone-400 dark:text-stone-500">Tap items to add them.</p>}
          {cart.map((l) => (
            // Name on its own line so it wraps instead of being cut off in the narrow cart.
            <div key={l.product.id} className="border-b border-orange-50 py-2.5 last:border-0 dark:border-stone-800">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-bold leading-snug">{l.product.name}</p>
                <p className="shrink-0 text-sm font-bold">
                  {unitOf(l.product) < priceOf(l.product) && (
                    <s className="mr-1.5 text-xs font-normal text-stone-400">{npr(priceOf(l.product) * l.qty)}</s>
                  )}
                  {npr(unitOf(l.product) * l.qty)}
                </p>
              </div>
              {memberApplies(l.product) ? (
                <p className="text-xs font-bold text-brand-green">Member price {npr(unitOf(l.product))} each</p>
              ) : isPromo(l.product) && <p className="text-xs font-bold text-brand-green">Opening offer</p>}
              <div className="mt-1.5 flex items-center gap-1.5">
                <button onClick={() => changeQty(l.product, (n) => n - 1)} aria-label={`One less ${l.product.name}`}
                  className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full bg-orange-50 transition active:scale-90 dark:bg-stone-800">
                  <Minus size={16} />
                </button>
                <input
                  type="number" inputMode="numeric" min={1} max={MAX_QTY} value={l.qty}
                  aria-label={`Quantity of ${l.product.name}`}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => { const n = parseInt(e.target.value, 10); if (n >= 1) changeQty(l.product, () => n); }}
                  className="h-10 w-12 rounded-lg border border-orange-100 bg-white text-center text-base font-bold outline-none focus:border-brand-orange dark:border-stone-700 dark:bg-stone-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button onClick={() => changeQty(l.product, (n) => n + 1)} aria-label={`One more ${l.product.name}`}
                  className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full bg-orange-50 transition active:scale-90 dark:bg-stone-800">
                  <Plus size={16} />
                </button>
                <button onClick={() => changeQty(l.product, () => 0)} aria-label={`Remove ${l.product.name}`}
                  className="ml-auto flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-brand-red dark:hover:bg-red-950/40">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2.5 border-t border-orange-100 p-4 dark:border-stone-800 lg:shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <Segmented value={type} onChange={setType} activeClass="bg-brand-orange text-white shadow-sm"
              options={[["dine_in", "Dine-in"], ["pickup", "Pickup"]] as const} />
            <Segmented value={method} onChange={setMethod} activeClass="bg-brand-green text-white shadow-sm"
              options={[["cash", "Cash"], ["qr", "QR"]] as const} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {dealButton("student", GraduationCap, "Student 5%")}
            {dealButton("member", Crown, "Member")}
          </div>
          {method === "cash" && (
            <>
              <div className="flex items-center gap-2">
                <label htmlFor="pos-cash-received" className="text-xs font-bold text-stone-500 dark:text-stone-400">
                  Cash received <span className="font-normal">(optional)</span>
                </label>
                {/* Whole rupees only; 16px so iPhone Safari doesn't zoom in on focus. */}
                <input
                  id="pos-cash-received" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Rs" className="input ml-auto !w-28 !py-1.5 text-right !text-base"
                />
              </div>
              {cart.length > 0 && (
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
            </>
          )}
        </div>
      </div>

      {/* Always on screen, whatever the phone. */}
      <div className="shrink-0 border-t border-orange-100 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">Total</p>
            <p className="font-display text-2xl font-bold leading-none">
              {npr(total)}
              {discount > 0 && <s className="ml-1.5 text-sm font-normal text-stone-400">{npr(subtotal)}</s>}
            </p>
            {change > 0 && <p className="mt-1 text-sm font-extrabold text-brand-green">Return {npr(change)}</p>}
            {short > 0 && <p className="mt-1 text-sm font-extrabold text-brand-red">{npr(short)} short</p>}
          </div>
          <button onClick={placeOrder} disabled={pending || cart.length === 0}
            className="btn-primary min-w-0 flex-1 touch-manipulation !px-4 !py-4 text-base disabled:opacity-50">
            {pending ? "Placing…" : "Place order"}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden lg:flex-row">
      {/* Product grid */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-orange-100 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
          <div className="relative shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            {/* 16px on phones — iPhone Safari zooms the page into any smaller input */}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="input !w-32 !py-1.5 !pl-9 text-base sm:!w-40 sm:text-sm" />
          </div>
          {[{ id: "all", name: "All" }, ...categories].map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)}
              className={cn("shrink-0 touch-manipulation rounded-full px-4 py-2 text-sm font-bold",
                cat === c.id ? "bg-brand-orange text-white" : "bg-orange-50 text-stone-600 dark:bg-stone-800 dark:text-stone-300")}>
              {c.name}
            </button>
          ))}
        </div>
        {/* Columns: phone 2 · iPad portrait 4 · beside the cart (iPad landscape, laptop) 3 · wide 4 */}
        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto overscroll-contain bg-brand-cream p-3 pb-24 dark:bg-stone-950 sm:grid-cols-3 sm:p-4 sm:pb-24 md:grid-cols-4 lg:grid-cols-3 lg:pb-4 2xl:grid-cols-4">
          {visible.map((p) => {
            const qty = qtyOf(p.id);
            const shown = unitOf(p);
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
                  {memberApplies(p) ? (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow"><Crown size={10} /> Member</span>
                  ) : isPromo(p) && (
                    <span className="absolute left-2 top-2 rounded-full bg-brand-green px-2 py-0.5 text-[10px] font-bold text-white shadow">Opening offer</span>
                  )}
                  <div className="p-3">
                    <p className="font-bold leading-tight">{p.name}</p>
                    {shown < Number(p.price) ? (
                      <p className="mt-1 flex items-center gap-1.5 font-display">
                        <span className="text-brand-orange">{npr(shown)}</span>
                        <span className="text-xs font-normal text-stone-400 line-through">{npr(Number(p.price))}</span>
                      </p>
                    ) : (
                      <p className="mt-1 font-display text-brand-orange">{npr(shown)}</p>
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
          "absolute inset-x-0 bottom-0 z-50 flex max-h-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-t-3xl bg-white transition-transform duration-300 ease-out dark:bg-stone-900 lg:static lg:z-auto lg:h-full lg:max-h-none lg:w-80 lg:translate-y-0 lg:rounded-none lg:border-l lg:border-orange-100 lg:dark:border-stone-800 2xl:w-96",
          cartOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0"
        )}
      >
        {CartContents}
      </div>

      {/* Success modal — print:only isolates this from the rest of the app */}
      {done && (
        <div onClick={() => setDone(null)} className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 print:static print:bg-white print:p-0">
          <div id="pos-receipt" onClick={(e) => e.stopPropagation()} className="card max-h-full w-full max-w-sm overflow-y-auto p-6 text-center print:bg-white print:text-black print:shadow-none print:ring-0 print:border-0">
            <CheckCircle2 size={36} className="mx-auto text-brand-green" />
            <h2 className="mt-1 font-display text-xl font-bold text-brand-brown dark:text-orange-100">Order placed</h2>
            {done.dailyNumber != null && (
              <p className="mt-1 font-mono text-4xl font-extrabold text-brand-orange">#{String(done.dailyNumber).padStart(2, "0")}</p>
            )}
            <p className="mt-1 font-mono text-sm text-stone-500 dark:text-stone-400">{done.orderNumber}</p>
            {done.discount > 0 && <p className="mt-1 text-sm font-bold text-brand-green">{done.discountLabel ?? "Discount"} −{npr(done.discount)}</p>}
            <p className="mt-1 font-bold">{npr(done.total)} · paid by {done.method === "cash" ? "cash" : "QR"}</p>
            {/* Cash with an amount entered: what to hand back, big enough to read at arm's length. */}
            {done.received != null && (
              <div className={cn("mt-3 rounded-2xl p-3", done.received >= done.total ? "bg-green-50 dark:bg-green-950/40" : "bg-red-50 dark:bg-red-950/40")}>
                <p className="text-sm font-bold text-stone-600 dark:text-stone-300">Received {npr(done.received)}</p>
                {done.received > done.total ? (
                  <p className="font-display text-3xl font-extrabold text-brand-green">Return {npr(done.received - done.total)}</p>
                ) : done.received === done.total ? (
                  <p className="font-bold text-brand-green">Exact amount — nothing to return</p>
                ) : (
                  <p className="font-display text-xl font-extrabold text-brand-red">{npr(done.total - done.received)} still to collect</p>
                )}
              </div>
            )}
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
