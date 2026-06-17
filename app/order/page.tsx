"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/lib/store/cart";
import { createOrder, validatePromoCode } from "@/app/actions/orders";
import { npr } from "@/lib/utils";
import AddToCartButton from "@/components/add-to-cart-button";

type Product = { id: string; name: string; description: string | null; price: number; category_id: string | null; spice_level: number; image_url?: string | null };
type Category = { id: string; name: string };
type Branch = { id: string; name: string; address: string };
type Address = { id: string; label: string; full_address: string };

export default function OrderPage() {
  const router = useRouter();
  const { items, setQty, remove, clear } = useCart();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [type, setType] = useState<"pickup" | "delivery">("pickup");
  const [branchId, setBranchId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [promo, setPromo] = useState("");
  const [payment, setPayment] = useState<"cash" | "qr">("cash");
  const [busy, setBusy] = useState(false);

  const [promoDiscount, setPromoDiscount] = useState<number>(0);
  const [promoMessage, setPromoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);

  const [isGuest, setIsGuest] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsGuest(!data.user));
    Promise.all([
      supabase.from("products").select("id, name, description, price, category_id, spice_level, image_url").order("sort_order"),
      supabase.from("categories").select("id, name").order("sort_order"),
      supabase.from("branches").select("id, name, address"),
      supabase.from("addresses").select("id, label, full_address"),
    ]).then(([p, c, b, a]) => {
      setProducts((p.data as Product[]) ?? []);
      setCategories((c.data as Category[]) ?? []);
      setBranches((b.data as Branch[]) ?? []);
      setAddresses((a.data as Address[]) ?? []);
    });
  }, []);

  const subtotal = useMemo(() => items.reduce((t, i) => t + i.price * i.quantity, 0), [items]);
  const deliveryFee = type === "delivery" ? 20 : 0;
  const finalTotal = Math.max(0, subtotal + deliveryFee - promoDiscount);
  
  const visible = activeCat ? products.filter((p) => p.category_id === activeCat) : products;

  async function applyPromo() {
    if (!promo) {
      setPromoMessage({ type: "error", text: "Please enter a code" });
      setPromoDiscount(0);
      return;
    }
    setCheckingPromo(true);
    setPromoMessage(null);
    const res = await validatePromoCode(promo, subtotal);
    if (res.error) {
      setPromoMessage({ type: "error", text: res.error });
      setPromoDiscount(0);
    } else if (res.success && res.discount != null) {
      setPromoMessage({ type: "success", text: `Voucher applied: -${npr(res.discount)}` });
      setPromoDiscount(res.discount);
    }
    setCheckingPromo(false);
  }

  async function ensureAddress(): Promise<string | null> {
    if (addressId) return addressId;
    if (!newAddress.trim()) return null;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("addresses")
      .insert({ customer_id: user.id, full_address: newAddress.trim().slice(0, 300) })
      .select("id")
      .single();
    return data?.id ?? null;
  }

  async function placeOrder() {
    setBusy(true);
    try {
      if (isGuest && (!guestName.trim() || !guestPhone.trim())) {
        toast.error("Please enter your name and phone number");
        return;
      }
      if (isGuest && guestPhone && !/^(\+977)?9[6-8]\d{8}$/.test(guestPhone.trim())) {
        toast.error("Please enter a valid Nepali mobile number");
        return;
      }
      
      const delivery_address_id = (type === "delivery" && !isGuest) ? await ensureAddress() : undefined;
      if (type === "delivery" && !isGuest && !delivery_address_id) { toast.error("Add a delivery address"); return; }
      if (type === "delivery" && isGuest && !newAddress.trim()) { toast.error("Add a delivery address"); return; }
      if (type === "pickup" && !branchId) { toast.error("Pick a branch"); return; }

      const res = await createOrder({
        type,
        branch_id: type === "pickup" ? branchId : undefined,
        delivery_address_id: delivery_address_id ?? undefined,
        payment_method: payment,
        promo_code: promo || undefined,
        guest_name: isGuest ? guestName.trim() : undefined,
        guest_phone: isGuest ? guestPhone.trim() : undefined,
        guest_address: isGuest && type === "delivery" ? newAddress.trim() : undefined,
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      });
      if ("error" in res && res.error) { toast.error(res.error); return; }
      const ok = res as { orderId: string; orderNumber: string; total: number };
      toast.success(`Order placed! ${payment === "qr" ? "Scan the QR when your order arrives." : `Keep Rs ${ok.total} cash ready.`}`);
      clear();
      router.push(`/track/${ok.orderId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-cream pb-8">
      {/* Sticky Header with Inline Checkout Button */}
      <div className="sticky top-0 z-40 bg-brand-cream/95 backdrop-blur-md border-b border-stone-200/50 shadow-sm py-4 px-4 mb-6">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-brown">Place Your Order</h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5">Browse menu → Add items → Checkout</p>
          </div>
          
          {step === 1 && items.length > 0 && (
            <button
              onClick={() => setStep(2)}
              className="lg:hidden flex items-center gap-2 rounded-full bg-brand-orange px-4 py-2 font-bold text-white shadow-md shadow-orange-500/30 text-sm hover:brightness-110 transition"
            >
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{items.length}</span>
              <span>Checkout →</span>
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-0">
        <ol className="flex flex-wrap gap-2 text-sm font-bold" aria-label="Order steps">
          {["Browse Menu", "Checkout & Pay"].map((label, i) => (
            <li key={label} className={`rounded-full px-5 py-2 transition-all ${step === i + 1 ? "bg-brand-orange text-white shadow-sm" : step > i + 1 ? "bg-green-100 text-green-700" : "bg-white text-stone-400 border border-stone-200"}`}>
              {step > i + 1 ? "✓" : i + 1}. {label}
            </li>
          ))}
        </ol>

        {step === 1 && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setActiveCat(null)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${!activeCat ? "bg-brand-orange text-white" : "bg-white"}`}>All</button>
                {categories.map((c) => (
                  <button key={c.id} onClick={() => setActiveCat(c.id)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${activeCat === c.id ? "bg-brand-orange text-white" : "bg-white"}`}>{c.name}</button>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {visible.map((p) => (
                  <div key={p.id} className="card p-4 flex flex-col">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-32 w-full object-cover rounded-lg mb-3" />
                    ) : (
                      <div className="h-32 w-full bg-brand-cream rounded-lg mb-3 flex items-center justify-center text-4xl" aria-hidden>🥣</div>
                    )}
                    <p className="font-bold">{p.name}</p>
                    <p className="line-clamp-2 text-sm text-stone-600 flex-1">{p.description}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="font-display font-bold text-brand-orange">{npr(Number(p.price))}</p>
                      <AddToCartButton product={{ product_id: p.id, name: p.name, price: Number(p.price) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <aside className="card h-fit p-5 sticky top-20 flex flex-col max-h-[80vh]">
              <div className="flex justify-between items-center border-b border-orange-50 pb-3 mb-3">
                <h2 className="font-display text-lg font-bold">Your cart</h2>
                {items.length > 0 && <button onClick={() => setStep(2)} className="bg-brand-orange text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-sm hover:brightness-110">Checkout →</button>}
              </div>
              {items.length === 0 ? (
                <p className="mt-3 text-sm text-stone-500">Cart&apos;s empty — add something crispy!</p>
              ) : (
                <>
                  <ul className="mt-3 space-y-3 flex-1 overflow-y-auto pr-2">
                    {items.map((i) => (
                      <li key={i.product_id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-bold">{i.name}</span>
                        <span className="flex items-center gap-1.5">
                          <button aria-label={`Reduce ${i.name}`} onClick={() => setQty(i.product_id, i.quantity - 1)} className="h-7 w-7 rounded-full bg-brand-cream font-bold">−</button>
                          <span className="w-5 text-center font-bold">{i.quantity}</span>
                          <button aria-label={`Increase ${i.name}`} onClick={() => setQty(i.product_id, i.quantity + 1)} className="h-7 w-7 rounded-full bg-brand-cream font-bold">+</button>
                          <button aria-label={`Remove ${i.name}`} onClick={() => remove(i.product_id)} className="ml-1 text-brand-red">✕</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 flex justify-between border-t pt-3 font-bold"><span>Subtotal</span><span>{npr(subtotal)}</span></p>
                  <button onClick={() => setStep(2)} className="btn-primary mt-4 w-full">Continue →</button>
                </>
              )}
            </aside>
          </div>
        )}

        {step === 2 && (
          <div className="mt-6 max-w-xl space-y-6">
            <div className="card p-5">
              <h2 className="font-display text-xl font-bold border-b pb-2 mb-4">Checkout Details</h2>
              
              <div className="space-y-5">
                {isGuest && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label" htmlFor="guestName">Your name</label>
                      <input id="guestName" className="input" maxLength={100} value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Full name" />
                    </div>
                    <div>
                      <label className="label" htmlFor="guestPhone">Mobile number</label>
                      <input id="guestPhone" className="input" maxLength={20} value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="98XXXXXXXX" />
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  {(["pickup", "delivery"] as const).map((t) => (
                    <button key={t} onClick={() => setType(t)} className={`card p-4 text-center font-bold ${type === t ? "ring-2 ring-brand-orange bg-orange-50" : ""}`}>
                      {t === "pickup" ? "🏪 Pickup" : "🛵 Delivery"}
                    </button>
                  ))}
                </div>
                
                {type === "pickup" ? (
                  <div>
                    <label className="label" htmlFor="branch">Pick a branch</label>
                    <select id="branch" className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                      <option value="">Choose…</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.address}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addresses.length > 0 && (
                      <div>
                        <label className="label" htmlFor="addr">Saved addresses</label>
                        <select id="addr" className="input" value={addressId} onChange={(e) => setAddressId(e.target.value)}>
                          <option value="">Use a new address</option>
                          {addresses.map((a) => <option key={a.id} value={a.id}>{a.label} — {a.full_address}</option>)}
                        </select>
                      </div>
                    )}
                    {!addressId && (
                      <div>
                        <label className="label" htmlFor="newaddr">Delivery address</label>
                        <textarea id="newaddr" className="input" rows={2} maxLength={300} value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Flat, building, street, landmark, area" />
                      </div>
                    )}
                    <p className="text-xs font-bold text-brand-green">Home delivery: flat Nrs 20 (within 5km of Manigram)</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <h2 className="font-display text-xl font-bold border-b pb-2">Payment</h2>

              <div>
                <label className="label" htmlFor="promo">Voucher / Promo Code (optional)</label>
                <div className="flex gap-2">
                  <input id="promo" className="input" maxLength={30} value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} placeholder="Enter code" />
                  <button type="button" onClick={applyPromo} disabled={checkingPromo} className="px-5 py-2 rounded-xl font-bold border-2 border-brand-orange text-brand-orange bg-white hover:bg-orange-50 disabled:opacity-50">
                    {checkingPromo ? "..." : "Apply"}
                  </button>
                </div>
                {promoMessage && (
                  <p className={`text-xs font-bold mt-1 ${promoMessage.type === "success" ? "text-brand-green" : "text-brand-red"}`}>{promoMessage.text}</p>
                )}
              </div>
              
              <div>
                <label className="label">Pay with</label>
                <div className="grid grid-cols-2 gap-3">
                  {([["cash", "💵 Cash"], ["qr", "📱 QR (eSewa/FonePay)"]] as const).map(([v, label]) => (
                    <button key={v} onClick={() => setPayment(v)} className={`card p-4 font-bold ${payment === v ? "ring-2 ring-brand-orange bg-orange-50" : ""}`}>{label}</button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  {payment === "qr"
                    ? "Scan our eSewa/FonePay QR when your order arrives."
                    : "Pay in cash when you collect or receive your order."}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="rounded-full bg-white px-6 py-3 font-bold border border-stone-200">← Back</button>
              <button onClick={placeOrder} disabled={busy || items.length === 0} className="btn-primary flex-1 shadow-lg shadow-orange-500/30">
                {busy ? "Placing order…" : `Place order • ${npr(finalTotal)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
