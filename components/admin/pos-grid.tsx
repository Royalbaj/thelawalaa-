"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { npr } from "@/lib/utils";
import { createOrder } from "@/app/actions/orders";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category_id: string;
  is_available: boolean;
  is_veg: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
}

export default function POSGrid({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<"pickup" | "delivery">("pickup");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [payment, setPayment] = useState<"cash" | "qr">("cash");
  const [isPending, startTransition] = useTransition();

  const visible = activeCat ? products.filter((p) => p.category_id === activeCat) : products;
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  function addItem(p: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) return prev.map((i) => (i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { product_id: p.id, name: p.name, price: Number(p.price), quantity: 1 }];
    });
  }

  function setQty(id: string, qty: number) {
    if (qty <= 0) return setCart((prev) => prev.filter((i) => i.product_id !== id));
    setCart((prev) => prev.map((i) => (i.product_id === id ? { ...i, quantity: qty } : i)));
  }

  function placeOrder() {
    if (cart.length === 0) return toast.error("Add items to the cart first");
    if (!customerName.trim()) return toast.error("Enter customer name");

    startTransition(async () => {
      const res = await createOrder({
        items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        type: orderType,
        payment_method: payment,
        guest_name: customerName,
        guest_phone: customerPhone.trim() ? customerPhone : undefined,
        guest_address: orderType === "delivery" ? customerAddress : undefined,
      });
      if ("error" in res && res.error) { toast.error(res.error as string); return; }
      const ok = res as { orderId: string; orderNumber: string; total: number };
      toast.success(`✅ Order ${ok.orderNumber} placed — ${npr(ok.total)}`);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-3 shrink-0">
        <button onClick={() => setActiveCat(null)} className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${!activeCat ? "bg-brand-orange text-white" : "bg-white text-stone-600 border border-stone-200"}`}>All</button>
        {categories.map((c) => (
          <button key={c.id} onClick={() => setActiveCat(c.id)} className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${activeCat === c.id ? "bg-brand-orange text-white" : "bg-white text-stone-600 border border-stone-200"}`}>{c.name}</button>
        ))}
      </div>

      {/* Product Grid + Cart side by side */}
      <div className="flex-1 min-h-0 grid gap-3 lg:grid-cols-[1fr_280px]">
        {/* Products */}
        <div className="overflow-y-auto pr-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {visible.map((p) => {
              const inCart = cart.find((i) => i.product_id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => addItem(p)}
                  className={`relative rounded-xl p-2 text-left transition-all hover:shadow-md border-2 ${inCart ? "border-brand-orange bg-orange-50" : "border-transparent bg-white"}`}
                >
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-20 object-cover rounded-lg mb-1.5" loading="lazy" />
                  ) : (
                    <div className="w-full h-20 bg-brand-cream rounded-lg mb-1.5 flex items-center justify-center text-2xl">🥣</div>
                  )}
                  <p className="text-xs font-bold text-brand-brown truncate">{p.name}</p>
                  <p className="text-xs font-bold text-brand-orange">{npr(Number(p.price))}</p>
                  {inCart && (
                    <span className="absolute top-1 right-1 bg-brand-orange text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center">
                      {inCart.quantity}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="bg-white rounded-xl border border-stone-200 p-3 flex flex-col overflow-y-auto">
          <h3 className="font-bold text-sm text-brand-brown border-b border-stone-100 pb-2 mb-2">🛒 POS Cart</h3>
          
          {cart.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-4">Tap items to add</p>
          ) : (
            <ul className="space-y-2 flex-1 overflow-y-auto mb-2">
              {cart.map((i) => (
                <li key={i.product_id} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-brand-brown truncate flex-1">{i.name}</span>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button onClick={() => setQty(i.product_id, i.quantity - 1)} className="h-5 w-5 rounded bg-stone-100 font-bold text-xs">−</button>
                    <span className="w-4 text-center font-bold">{i.quantity}</span>
                    <button onClick={() => setQty(i.product_id, i.quantity + 1)} className="h-5 w-5 rounded bg-stone-100 font-bold text-xs">+</button>
                  </div>
                  <span className="ml-2 font-bold text-brand-orange w-14 text-right">{npr(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-stone-100 pt-2 space-y-2">
            <div className="flex justify-between font-bold text-sm">
              <span>Total</span>
              <span className="text-brand-orange">{npr(subtotal + (orderType === "delivery" ? 20 : 0))}</span>
            </div>

            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name *" className="input !text-xs !py-1.5" />
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone (optional)" className="input !text-xs !py-1.5" />

            <div className="flex gap-1">
              <button onClick={() => setOrderType("pickup")} className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${orderType === "pickup" ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-stone-50 text-stone-500"}`}>🏪 Pickup</button>
              <button onClick={() => setOrderType("delivery")} className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${orderType === "delivery" ? "bg-purple-100 text-purple-700 border border-purple-200" : "bg-stone-50 text-stone-500"}`}>🛵 Delivery</button>
            </div>

            {orderType === "delivery" && (
              <input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Delivery address *" className="input !text-xs !py-1.5" />
            )}

            <div className="flex gap-1">
              <button onClick={() => setPayment("cash")} className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${payment === "cash" ? "bg-green-100 text-green-700 border border-green-200" : "bg-stone-50 text-stone-500"}`}>💵 Cash</button>
              <button onClick={() => setPayment("qr")} className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${payment === "qr" ? "bg-violet-100 text-violet-700 border border-violet-200" : "bg-stone-50 text-stone-500"}`}>📱 QR</button>
            </div>

            <button
              onClick={placeOrder}
              disabled={isPending || cart.length === 0}
              className="w-full btn-primary !py-2.5 !text-sm"
            >
              {isPending ? "Placing…" : `Place Order • ${npr(subtotal + (orderType === "delivery" ? 20 : 0))}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
