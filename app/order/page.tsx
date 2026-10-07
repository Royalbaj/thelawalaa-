"use client";
import Link from "next/link";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { signOutTo } from "@/lib/sign-out";
import { useCart } from "@/lib/store/cart";
import { createOrder, validatePromoCode } from "@/app/actions/orders";
import { getCheckoutRewards } from "@/app/actions/customer";
import { redeemPlan, fmtPoints, fmtRupees, pointsToRupees } from "@/lib/rewards";
import { getEsewaPaymentForm } from "@/app/actions/payments";
import { npr } from "@/lib/utils";
import { UtensilsCrossed, Sparkles, CupSoda, LocateFixed, Loader2, X, MapPin, Phone, MapPinOff, Clock } from "lucide-react";
import AddToCartButton from "@/components/add-to-cart-button";
import BrandLogo from "@/components/brand-logo";
import { applyOpeningPromoPrice, isOpeningPromoActive, type OpeningPromoSettings } from "@/lib/promo";
import { deliveryArea, outsideArea, distanceKm, fmtKm } from "@/lib/geo";
import { phoneDisplay, telHref } from "@/lib/utils";
import { guestCodeKey } from "@/lib/guest-order";
import { deliveryHours, deliveryOpenNow, deliverySlots, dayWord, minutesLabel, nextStartLabel, slotLabel } from "@/lib/delivery-hours";

type Product = { id: string; name: string; description: string | null; price: number; category_id: string | null; spice_level: number; image_url?: string | null };
type Category = { id: string; name: string };
type Branch = { id: string; name: string; address: string };
type Address = { id: string; label: string; full_address: string; lat: number | null; lng: number | null };
type Pin = { lat: number; lng: number; accuracy: number };

/** eSewa's integration model is a full-page redirect via POSTed form, not a fetch. */
function redirectToEsewa(action: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

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
  const [payment, setPayment] = useState<"cash" | "qr" | "esewa">("cash");
  const [busy, setBusy] = useState(false);

  const [promoDiscount, setPromoDiscount] = useState<number>(0);
  const [promoMessage, setPromoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);

  const [isGuest, setIsGuest] = useState(false);
  // Who this device is signed in as — shown at checkout with "Not you?", since phones get shared.
  // Signed-in customers aren't asked their name: the order uses their account's.
  const [account, setAccount] = useState<{ name: string; email: string; phone: string; role: string } | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  // "Share my location" for delivery — the rider gets the exact pin.
  const [pin, setPin] = useState<Pin | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [settings, setSettings] = useState<{
    esewa_enabled: boolean; delivery_enabled: boolean; delivery_radius_km?: number | null; store_lat?: number | null; store_lng?: number | null;
    // Delivery hours (Admin → Settings): ASAP only inside them; otherwise a booked slot.
    delivery_hours_enabled?: boolean; delivery_start?: string; delivery_end?: string;
    delivery_slot_minutes?: number; delivery_lead_minutes?: number; delivery_days_ahead?: number;
  }>({ esewa_enabled: false, delivery_enabled: false });
  // When to deliver: as soon as possible, or a booked slot (always a slot while delivery is closed).
  const [when, setWhen] = useState<"asap" | "later">("asap");
  const [slotStart, setSlotStart] = useState("");
  const [now, setNow] = useState(() => Date.now());
  // The shop's number (Admin → Website text → WhatsApp number) for "call us to confirm".
  const [shopPhone, setShopPhone] = useState<string | null>(null);
  const [openingPromo, setOpeningPromo] = useState<OpeningPromoSettings | null>(null);
  const [menuLoading, setMenuLoading] = useState(true);
  // Signed-in customers: their points and free item, and whether to use them on this order.
  const [rewards, setRewards] = useState<Awaited<ReturnType<typeof getCheckoutRewards>>>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [useFree, setUseFree] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      setIsGuest(!data.user);
      if (data.user) {
        const { data: profile } = await supabase.from("profiles").select("full_name, phone, role").eq("id", data.user.id).single();
        setAccount({ name: profile?.full_name ?? "", email: data.user.email ?? "", phone: profile?.phone ?? "", role: profile?.role ?? "customer" });
        getCheckoutRewards().then(setRewards).catch(() => null);
        supabase.from("customer_favorites").select("product_id").eq("customer_id", data.user.id).then((res) => {
          setFavorites(res.data?.map(f => f.product_id) ?? []);
        });
      }
    });
    Promise.all([
      supabase.from("products").select("id, name, description, price, category_id, spice_level, image_url").eq("pos_only", false).order("sort_order"),
      supabase.from("categories").select("id, name").order("sort_order"),
      supabase.from("branches").select("id, name, address"),
      supabase.from("addresses").select("id, label, full_address, lat, lng"),
      supabase.from("app_settings").select("esewa_enabled, delivery_enabled, opening_promo_enabled, opening_promo_momo_price, opening_promo_starts_at, opening_promo_ends_at, delivery_radius_km, store_lat, store_lng, delivery_hours_enabled, delivery_start, delivery_end, delivery_slot_minutes, delivery_lead_minutes, delivery_days_ahead").eq("id", 1).single(),
      supabase.from("site_content").select("value").eq("key", "contact.whatsapp").maybeSingle(),
    ]).then(([p, c, b, a, s, phone]) => {
      if (phone.data?.value) setShopPhone(phone.data.value as string);
      setProducts((p.data as Product[]) ?? []);
      setCategories((c.data as Category[]) ?? []);
      setBranches((b.data as Branch[]) ?? []);
      // Auto-select the branch — there's only one store, no reason to make anyone pick it.
      if (b.data && b.data.length > 0) setBranchId(b.data[0].id);
      setAddresses((a.data as Address[]) ?? []);
      // Default to the customer's saved address instead of an empty "new address" box.
      if (a.data && a.data.length > 0) setAddressId(a.data[0].id);
      if (s.data) { setSettings(s.data); setOpeningPromo(s.data); }
      setMenuLoading(false);
    });
  }, []);

  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const priceOf = (p: Product) => applyOpeningPromoPrice(Number(p.price), categoryNameById.get(p.category_id ?? "") ?? null, openingPromo);
  const isDiscounted = (p: Product) => isOpeningPromoActive(openingPromo) && priceOf(p) !== Number(p.price);

  // Signed-in customers aren't asked who they are — their account says. Guests,
  // and staff placing an order for someone else, type a name and number.
  const asksContact = isGuest || (!!account && account.role !== "customer");

  // Delivery area (Admin → Settings): a shared pin, or a saved address with one, outside it can't be delivered to online.
  const area = deliveryArea(settings);
  const savedPinned = addresses.find((a) => a.id === addressId && a.lat != null && a.lng != null);
  const checkPoint = pin ?? (savedPinned ? { lat: Number(savedPinned.lat), lng: Number(savedPinned.lng) } : null);
  const tooFar = type === "delivery" && !!checkPoint && outsideArea(area, checkPoint);

  // Delivery hours (Admin → Settings → Delivery hours). The clock ticks so slots
  // that get too close (under the notice time) drop off while the page is open.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const hours = useMemo(() => deliveryHours(settings), [settings]);
  const openNow = deliveryOpenNow(hours, now);
  const slots = useMemo(() => deliverySlots(hours, now), [hours, now]);
  const scheduling = type === "delivery" && hours.enabled && (!openNow || when === "later");
  const noSlots = type === "delivery" && hours.enabled && !openNow && slots.length === 0;
  // Keep a slot that can still be booked picked (the earliest by default).
  useEffect(() => {
    if (scheduling && !slots.some((sl) => sl.start === slotStart)) setSlotStart(slots[0]?.start ?? "");
  }, [scheduling, slots, slotStart]);
  const pickedSlot = slots.find((sl) => sl.start === slotStart) ?? null;
  const farKm = checkPoint ? distanceKm(area.shop, checkPoint) : 0;

  const subtotal = useMemo(() => items.reduce((t, i) => t + i.price * i.quantity, 0), [items]);
  // Same plan createOrder makes on the server (lib/rewards.ts) — this is only the preview.
  const pointsPlan = usePoints && rewards ? redeemPlan(rewards.points, subtotal - promoDiscount, rewards.settings) : { points: 0, rupees: 0 };
  const finalTotal = Math.max(0, subtotal - promoDiscount - pointsPlan.rupees);

  const visible = activeCat ? products.filter((p) => p.category_id === activeCat) : products;

  // No QR at pickup — staff take cash directly at the counter. QR stays for delivery.
  const paymentOptions = useMemo(() => {
    const opts: ["cash" | "qr" | "esewa", string][] = [["cash", "Cash"]];
    if (type === "delivery") opts.push(["qr", "Scan QR"]);
    if (settings.esewa_enabled) opts.push(["esewa", "eSewa"]);
    return opts;
  }, [type, settings.esewa_enabled]);

  useEffect(() => {
    if (!paymentOptions.some(([v]) => v === payment)) setPayment("cash");
  }, [paymentOptions, payment]);

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

  /** A signed-in customer's new address is saved for next time (with the pin, if shared). */
  async function ensureAddress(): Promise<string | null> {
    if (addressId) return addressId;
    if (newAddress.trim().length < 3) return null;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("addresses")
      .insert({ customer_id: user.id, full_address: newAddress.trim().slice(0, 300), lat: pin?.lat ?? null, lng: pin?.lng ?? null })
      .select("id")
      .single();
    return data?.id ?? null;
  }

  function shareLocation() {
    setLocError(null);
    if (!("geolocation" in navigator)) { setLocError("This phone can't share its location — type your full address instead."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) });
      },
      (err) => {
        setLocating(false);
        setLocError(err.code === err.PERMISSION_DENIED
          ? "Location is blocked for this site. Allow it in your browser settings, or type your full address."
          : "Couldn't get your location — try again outside, or type your full address.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  async function placeOrder() {
    setBusy(true);
    try {
      const needPhone = asksContact || (type === "delivery" && !account?.phone);
      if (asksContact && guestName.trim().length < 2) { toast.error("Please enter your name"); return; }
      if (needPhone && !/^(\+977)?9[6-8]\d{8}$/.test(guestPhone.trim())) {
        toast.error("Please enter a valid Nepali mobile number");
        return;
      }
      const savedAddress = addresses.find((a) => a.id === addressId);
      if (type === "delivery" && !pin && !savedAddress && newAddress.trim().length < 10) {
        toast.error("Add your full address (tole/street, house, landmark) — or share your location");
        return;
      }
      if (type === "pickup" && !branchId) { toast.error("Pick a branch"); return; }
      if (tooFar) { toast.error("We're not delivering to that location right now — please call us to confirm, or choose pickup"); return; }
      if (noSlots) { toast.error("No delivery times left to book — please choose pickup"); return; }
      if (scheduling && !pickedSlot) { toast.error("Pick a delivery time"); return; }

      const delivery_address_id = (type === "delivery" && !isGuest) ? await ensureAddress() : undefined;

      const res = await createOrder({
        type,
        branch_id: type === "pickup" ? branchId : undefined,
        delivery_address_id: delivery_address_id ?? undefined,
        payment_method: payment,
        promo_code: promo || undefined,
        use_points: pointsPlan.points > 0 || undefined,
        use_free_item: useFree || undefined,
        guest_name: asksContact ? guestName.trim() : undefined,
        guest_phone: needPhone ? guestPhone.trim() : undefined,
        guest_address: type === "delivery" && !delivery_address_id ? newAddress.trim() : undefined,
        delivery_location: type === "delivery" && pin ? pin : undefined,
        scheduled_for: scheduling && pickedSlot ? pickedSlot.start : undefined,
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      });
      if ("error" in res && res.error) { toast.error(res.error); return; }
      const ok = res as { orderId: string; orderNumber: string; dailyNumber: number | null; total: number; deliveryCode: string | null };
      // A guest can't sign in to see their delivery code again — keep it for this tab only.
      if (ok.deliveryCode) { try { sessionStorage.setItem(guestCodeKey(ok.orderId), ok.deliveryCode); } catch { /* private mode */ } }

      if (payment === "esewa") {
        const form = await getEsewaPaymentForm({ orderId: ok.orderId });
        if ("error" in form) { toast.error(form.error); return; }
        clear();
        redirectToEsewa(form.action, form.fields); // navigates away — no further code runs
        return;
      }

      const collectionNote = type === "pickup"
        ? ` Your order number is ${ok.dailyNumber ?? ok.orderNumber} — tell this to our counter staff when you arrive.`
        : `${scheduling && pickedSlot ? ` We'll deliver ${slotLabel(pickedSlot).replace(/^Today/, "today").replace(/^Tomorrow/, "tomorrow")}.` : ""}${ok.deliveryCode ? ` Your delivery code is ${ok.deliveryCode} — give it to the rider.` : ""}`;
      toast.success(
        `Order placed!${collectionNote} ${payment === "qr" ? "Scan the QR when your order arrives." : `Keep Rs ${ok.total} cash ready.`}`,
        { duration: 7000 }
      );
      clear();
      // replace, not push: Back shouldn't return to a checkout that's already been placed.
      router.replace(`/track/${ok.orderId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-cream pb-8">
      {/* Sticky Header with Inline Checkout Button */}
      <div className="sticky top-0 z-40 bg-brand-cream/95 backdrop-blur-md border-b border-stone-200/50 shadow-sm py-3 px-4 mb-6">
        <div className="mx-auto max-w-4xl flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <Link href={account ? "/account" : "/"} className="hidden shrink-0 sm:block"><BrandLogo size="sm" /></Link>
            <div className="min-w-0 sm:border-l sm:border-stone-200 sm:pl-4">
              <h1 className="font-display text-2xl font-bold text-brand-brown">Place your order</h1>
              <p className="mt-0.5 text-xs text-stone-500 sm:text-sm">Browse menu → Add items → Checkout</p>
            </div>
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
                {menuLoading && Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="card p-4 animate-pulse">
                    <div className="h-32 w-full rounded-lg bg-stone-200" />
                    <div className="mt-3 h-4 w-2/3 rounded bg-stone-200" />
                    <div className="mt-2 h-3 w-full rounded bg-stone-100" />
                    <div className="mt-4 h-8 w-full rounded-full bg-stone-100" />
                  </div>
                ))}
                {!menuLoading && visible.map((p, idx) => {
                  const isFav = favorites.includes(p.id);
                  return (
                    <div key={p.id} className="card p-4 flex flex-col relative group">
                      {!isGuest && (
                        <button
                          onClick={async () => {
                            const { toggleFavorite } = await import("@/app/actions/customer");
                            const res = await toggleFavorite(p.id);
                            if (res.ok) {
                              setFavorites(prev => res.isFavorite ? [...prev, p.id] : prev.filter(id => id !== p.id));
                              toast.success(res.isFavorite ? "Added to favorites" : "Removed from favorites");
                            }
                          }}
                          className={`absolute top-6 right-6 h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center transition shadow-sm ${isFav ? "text-red-500" : "text-stone-300 hover:text-red-400"}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                        </button>
                      )}
                      {p.image_url ? (
                        <div className="relative mb-3 h-32 w-full overflow-hidden rounded-lg">
                          <Image src={p.image_url} alt={p.name} fill sizes="(min-width: 640px) 300px, 50vw" className="object-cover" priority={idx < 2} />
                        </div>
                      ) : (
                        <div className="h-32 w-full bg-brand-cream rounded-lg mb-3 flex items-center justify-center text-stone-300" aria-hidden><UtensilsCrossed size={32} /></div>
                      )}
                      {isDiscounted(p) && (
                        <span className="absolute left-6 top-6 rounded-full bg-brand-green px-2.5 py-1 text-[10px] font-bold text-white shadow">Opening offer</span>
                      )}
                      <p className="font-bold pr-8">{p.name}</p>
                      <p className="line-clamp-2 text-sm text-stone-600 flex-1">{p.description}</p>
                      <div className="mt-2 flex items-center justify-between">
                        {isDiscounted(p) ? (
                          <p className="font-display font-bold text-brand-orange flex items-center gap-1.5">
                            {npr(priceOf(p))}
                            <span className="text-xs font-normal text-stone-400 line-through">{npr(Number(p.price))}</span>
                          </p>
                        ) : (
                          <p className="font-display font-bold text-brand-orange">{npr(Number(p.price))}</p>
                        )}
                        <AddToCartButton product={{ product_id: p.id, name: p.name, price: priceOf(p) }} />
                      </div>
                    </div>
                  );
                })}
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
                          <button aria-label={`Remove ${i.name}`} onClick={() => remove(i.product_id)} className="ml-1 rounded-full p-1 text-stone-400 hover:text-brand-red"><X size={15} /></button>
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
              {account ? (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-stone-50 px-3 py-2.5 text-sm text-stone-600">
                  <span className="min-w-0">
                    Ordering as <b className="text-stone-800">{account.name || account.email}</b>
                    {account.phone ? <span className="text-stone-400"> · {account.phone}</span> : null}
                  </span>
                  <button type="button" onClick={() => signOutTo("/order")} className="font-bold text-brand-orange">Not you? Sign out</button>
                </div>
              ) : !isGuest ? null : (
                <p className="mb-4 rounded-xl bg-orange-50 px-3 py-2.5 text-sm text-brand-brown">
                  Ordering as a guest. <Link href="/auth/login?redirect=/order" className="font-bold text-brand-orange">Sign in</Link> or <Link href="/auth/signup" className="font-bold text-brand-orange">create an account</Link> to earn points on this order.
                </p>
              )}

              <div className="space-y-5">
                {/* Guests (and staff ordering for someone): who it's for. Not remembered by this phone. */}
                {asksContact && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="guestName">Your name</label>
                      <input id="guestName" name="tw-guest-name" autoComplete="off" className="input" maxLength={100} value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Full name" />
                    </div>
                    <div>
                      <label className="label" htmlFor="guestPhone">Mobile number</label>
                      <input id="guestPhone" name="tw-guest-phone" autoComplete="off" inputMode="tel" className="input" maxLength={20} value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="98XXXXXXXX" />
                    </div>
                  </div>
                )}
                {account && !asksContact && !account.phone && type === "delivery" && (
                  <div>
                    <label className="label" htmlFor="guestPhone">Mobile number for the rider</label>
                    <input id="guestPhone" inputMode="tel" className="input" maxLength={20} value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="98XXXXXXXX" />
                  </div>
                )}

                <div className={settings.delivery_enabled ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
                  {(settings.delivery_enabled ? (["pickup", "delivery"] as const) : (["pickup"] as const)).map((t) => (
                    <button key={t} onClick={() => setType(t)} className={`card p-4 text-center font-bold ${type === t ? "ring-2 ring-brand-orange bg-orange-50" : ""}`}>
                      {t === "pickup" ? "Pickup" : "Delivery"}
                    </button>
                  ))}
                </div>
                
                {type === "pickup" ? (
                  branches.length > 1 ? (
                    <div>
                      <label className="label" htmlFor="branch">Pick a branch</label>
                      <select id="branch" className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                        <option value="">Choose…</option>
                        {branches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.address}</option>)}
                      </select>
                    </div>
                  ) : branches.length === 1 ? (
                    <div className="rounded-xl bg-orange-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-brand-orange">Pickup from</p>
                      <p className="mt-0.5 font-bold text-brand-brown">{branches[0].name}</p>
                      <p className="text-sm text-stone-500">{branches[0].address}</p>
                    </div>
                  ) : null
                ) : (
                  <div className="space-y-4">
                    {/* The exact pin: the rider gets a map and directions to it. */}
                    <div className="rounded-2xl bg-orange-50/70 p-4 ring-1 ring-orange-100">
                      {pin ? (
                        <div className="flex items-start gap-3">
                          <MapPin size={20} className={`mt-0.5 shrink-0 ${outsideArea(area, pin) ? "text-brand-red" : "text-brand-green"}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-brand-brown">Location shared</p>
                            <p className="text-xs text-stone-600">
                              Accurate to about {fmtKm(pin.accuracy / 1000)} · {fmtKm(distanceKm(area.shop, pin))} from our shop
                            </p>
                            {pin.accuracy > 150 && <p className="mt-1 text-xs font-bold text-amber-700">That&apos;s approximate — add a landmark below so the rider finds you.</p>}
                          </div>
                          <button type="button" onClick={() => setPin(null)} aria-label="Remove shared location" className="rounded-full p-1.5 text-stone-400 hover:bg-white hover:text-stone-600"><X size={16} /></button>
                        </div>
                      ) : (
                        <>
                          <button type="button" onClick={shareLocation} disabled={locating}
                            className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-bold text-brand-orange shadow-sm ring-1 ring-orange-200 transition hover:bg-orange-50 disabled:opacity-60">
                            {locating ? <Loader2 size={17} className="animate-spin" /> : <LocateFixed size={17} />}
                            {locating ? "Finding you…" : "Share my current location"}
                          </button>
                          <p className="mt-2 text-center text-xs text-stone-500">Best if you&apos;re at the delivery address now — our rider gets the exact spot on a map.</p>
                          {locError && <p className="mt-2 text-center text-xs font-bold text-brand-red">{locError}</p>}
                        </>
                      )}
                    </div>

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
                        <label className="label" htmlFor="newaddr">
                          {pin ? <>Address details <span className="font-normal text-stone-400">(house, floor, landmark — helps the rider)</span></> : "Full delivery address"}
                        </label>
                        <textarea id="newaddr" name="tw-delivery-address" autoComplete={isGuest ? "off" : "street-address"} className="input" rows={2} maxLength={300}
                          value={newAddress} onChange={(e) => setNewAddress(e.target.value)}
                          placeholder="Tole / street, house or building, nearest landmark" />
                        {!pin && <p className="mt-1 text-xs text-stone-500">No location shared, so we need the full address — e.g. &ldquo;Ward 5, Shanti Tole, blue house behind Banepa Hospital&rdquo;.</p>}
                      </div>
                    )}
                    {tooFar && (
                      <div role="alert" className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
                        <p className="flex items-center gap-2 font-bold text-red-800"><MapPinOff size={18} className="shrink-0" /> We&apos;re not delivering to this location right now</p>
                        <p className="mt-1 text-sm text-red-900/80">
                          It&apos;s about {fmtKm(farKm)} from our shop, and we deliver within {area.radiusKm} km of Godam Chowk. Please call us to confirm whether we can bring it to you — or pick it up instead.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {shopPhone && (
                            <a href={telHref(shopPhone)} className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">
                              <Phone size={15} /> Call {phoneDisplay(shopPhone)}
                            </a>
                          )}
                          <a href="/whatsapp" target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-50">WhatsApp us</a>
                          <button type="button" onClick={() => setType("pickup")} className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-bold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50">Switch to pickup</button>
                        </div>
                      </div>
                    )}
                    {hours.enabled && (
                      <div className="rounded-2xl bg-white p-4 ring-1 ring-orange-100">
                        {!openNow && (
                          <p role="status" className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
                            <Clock size={17} className="mt-0.5 shrink-0" />
                            <span>
                              <b>Delivery isn&apos;t available right now.</b> We start delivering {nextStartLabel(hours, now)}
                              {" "}({minutesLabel(hours.start)} – {minutesLabel(hours.end)}).
                              {slots.length > 0 ? " You can book a delivery time below — or choose pickup." : " Please choose pickup for now."}
                            </span>
                          </p>
                        )}
                        <p className="label">When should we deliver?</p>
                        {openNow && (
                          <div className="grid grid-cols-2 gap-2">
                            {([["asap", "As soon as possible"], ["later", "Schedule for later"]] as const).map(([k, label]) => (
                              <button key={k} type="button" onClick={() => setWhen(k)} aria-pressed={when === k}
                                className={`rounded-xl px-3 py-2.5 text-sm font-bold ring-1 transition ${when === k ? "bg-orange-50 text-brand-orange ring-2 ring-brand-orange" : "bg-white text-stone-600 ring-stone-200 hover:bg-orange-50"}`}>
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                        {scheduling && (
                          slots.length > 0 ? (
                            <select aria-label="Delivery time" className={`input ${openNow ? "mt-2" : ""}`} value={slotStart} onChange={(e) => setSlotStart(e.target.value)}>
                              {[...new Set(slots.map((sl) => dayWord(new Date(sl.start).getTime(), now)))].map((day) => (
                                <optgroup key={day} label={day}>
                                  {slots.filter((sl) => dayWord(new Date(sl.start).getTime(), now) === day).map((sl) => (
                                    <option key={sl.start} value={sl.start}>{slotLabel(sl, now)}</option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          ) : (
                            <p className="mt-2 text-sm font-bold text-stone-600">No delivery times left to book.</p>
                          )
                        )}
                        <p className="mt-2 text-xs text-stone-500">
                          We deliver {minutesLabel(hours.start)} – {minutesLabel(hours.end)} · book at least {hours.lead} minutes ahead
                        </p>
                      </div>
                    )}
                    <p className="text-xs font-bold text-brand-green">Free home delivery within {area.radiusKm} km of Godam Chowk</p>
                  </div>
                )}
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <h2 className="font-display text-xl font-bold border-b pb-2">Payment</h2>

              {rewards && (rewards.points > 0 || rewards.freeItems > 0) && (
                <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-4 ring-1 ring-orange-100">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-brand-brown"><Sparkles size={15} className="text-amber-500" /> Your rewards</p>
                  {(() => {
                    const avail = redeemPlan(rewards.points, subtotal - promoDiscount, rewards.settings);
                    return avail.points > 0 ? (
                      <label className="mt-3 flex cursor-pointer items-center justify-between gap-3">
                        <span className="text-sm text-stone-700">Use <b>{fmtPoints(avail.points)} points</b> — <b className="text-brand-green">−{fmtRupees(avail.rupees)}</b></span>
                        <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} className="h-5 w-5 accent-brand-orange" />
                      </label>
                    ) : (
                      <p className="mt-2 text-xs text-stone-600">
                        You have {fmtPoints(rewards.points)} points ({fmtRupees(pointsToRupees(rewards.points, rewards.settings))}). Use them once you reach {fmtPoints(rewards.settings.min_redeem_points)} — this order gets you closer.
                      </p>
                    );
                  })()}
                  {rewards.freeItems > 0 && rewards.freeItem && (
                    <label className={`mt-3 flex items-center justify-between gap-3 ${rewards.freeItem.available ? "cursor-pointer" : "opacity-50"}`}>
                      <span className="flex items-center gap-1.5 text-sm text-stone-700"><CupSoda size={15} className="text-brand-green" /> Add my free <b>{rewards.freeItem.name}</b>{!rewards.freeItem.available && " (sold out today)"}</span>
                      <input type="checkbox" disabled={!rewards.freeItem.available} checked={useFree} onChange={(e) => setUseFree(e.target.checked)} className="h-5 w-5 accent-brand-orange" />
                    </label>
                  )}
                  {(pointsPlan.rupees > 0 || useFree) && (
                    <p className="mt-3 border-t border-orange-100 pt-2 text-xs font-bold text-brand-green">
                      {[pointsPlan.rupees > 0 && `−${fmtRupees(pointsPlan.rupees)} from points`, useFree && `free ${rewards.freeItem?.name} added`].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              )}
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
                <div className={`grid gap-3 ${paymentOptions.length === 1 ? "grid-cols-1" : paymentOptions.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                  {paymentOptions.map(([v, label]) => (
                    <button key={v} onClick={() => setPayment(v)} className={`card p-4 font-bold ${payment === v ? "ring-2 ring-brand-orange bg-orange-50" : ""}`}>{label}</button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  {payment === "qr"
                    ? "Scan our eSewa/FonePay QR when your order arrives."
                    : payment === "esewa"
                    ? "Pay now with your eSewa balance — you'll be redirected to eSewa to complete it."
                    : type === "pickup"
                    ? "Pay cash to our counter staff when you collect your order."
                    : "Pay in cash when your order arrives."}
                </p>
              </div>
            </div>

            <p className="text-center text-xs text-stone-500">
              By placing this order you agree to our <Link href="/terms" target="_blank" className="font-bold text-brand-orange">Terms &amp; Conditions</Link>. Offers and prices can change without notice.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="rounded-full bg-white px-6 py-3 font-bold border border-stone-200">← Back</button>
              <button onClick={placeOrder} disabled={busy || items.length === 0 || tooFar || noSlots} className="btn-primary flex-1 shadow-lg shadow-orange-500/30">
                {busy ? "Placing order…" : `Place order • ${npr(finalTotal)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
