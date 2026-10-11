"use client";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { Search, X, Trash2, ShoppingCart, ChevronUp, UtensilsCrossed, CheckCircle2, Minus, Plus, GraduationCap, Crown, ChefHat, IdCard, AlertTriangle, ChevronDown, ShieldCheck, Snowflake, Delete } from "lucide-react";
import { createPosOrder, getPosStock, checkManagerPin, checkMemberCard } from "@/app/actions/pos";
import PinPad from "@/components/pin-pad";
import { newMemberSchema } from "@/lib/validations/order";
import { REFRESH_EVENT } from "@/components/refresh-button";
import type { PosStock } from "@/lib/stock-alerts";
import { npr, cn } from "@/lib/utils";
import { applyOpeningPromoPrice, isOpeningPromoActive, type OpeningPromoSettings } from "@/lib/promo";
import { studentDiscount, memberUnitPrice, staffFreeItems, managerFreeItems, halfPlatePrice, platesLabel, MANAGER_LABEL, MEMBER_PRICE_LABEL } from "@/lib/discounts";

type Product = {
  id: string; name: string; price: number; is_available: boolean; category_id: string | null;
  image_url?: string | null; student_discount_eligible?: boolean; member_price?: number | string | null;
  is_membership_card?: boolean; is_frozen?: boolean;
  half_price?: number | string | null; // Admin → Menu "Half plate price"; none = no half option
};
type Category = { id: string; name: string };
// qty whole plates, plus an extra half plate when `half` (1½, 2½ …) — never a half on its own.
type Line = { product: Product; qty: number; half: boolean };
type Deal = "none" | "student" | "member" | "staff" | "manager";
type Done = {
  orderNumber: string; dailyNumber: number | null; total: number;
  discount: number; discountLabel: string | null;
  method: "cash" | "qr"; received: number | null;
  members: { name: string; phone: string; card: string | null }[];
};
// The member whose card was checked for this sale (createPosOrder checks it again).
type MemberCard = { digits: string; name: string; card: string };
// A new member, typed in while selling them a membership card.
type MemberForm = { full_name: string; phone: string; card_number: string };
const BLANK_MEMBER: MemberForm = { full_name: "", phone: "", card_number: "" };
const STOCK_POLL_MS = 60_000;

const MAX_QTY = 50; // per line — the same cap createPosOrder enforces
// After the exact amount, the next few notes a customer is likely to hand over.
const NOTES = [100, 500, 1000, 2000, 5000];

/** Manager deal: a manager types their own PIN to make this sale free (frozen items still charged). */
function ManagerApproval({ onClose, onApproved }: { onClose: () => void; onApproved: (m: { pin: string; name: string }) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const submit = useCallback(async (pin: string) => {
    const r = await checkManagerPin(pin);
    if ("error" in r) return r.error;
    onApproved({ pin, name: r.name });
    return null;
  }, [onApproved]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Manager approval"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
      <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-5 text-center shadow-2xl ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
        <div className="flex items-start justify-between gap-2 text-left">
          <div>
            <p className="flex items-center gap-1.5 font-display text-lg font-extrabold text-brand-brown dark:text-orange-100"><ShieldCheck size={18} /> Manager discount</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">Everything in this sale becomes Rs 0, except frozen items. A manager types their own PIN.</p>
          </div>
          <button onClick={onClose} aria-label="Cancel" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800"><X size={18} /></button>
        </div>
        <PinPad submit={submit} idle="Manager's 4-digit PIN" />
      </div>
    </div>
  );
}

/** Member deal: the counter types the last 3 digits of the member's card before member price applies. */
function MemberCardCheck({ onClose, onFound }: { onClose: () => void; onFound: (m: MemberCard) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const submit = useCallback(async (digits: string) => {
    const r = await checkMemberCard(digits);
    if ("error" in r) return r.error;
    onFound({ digits, name: r.name, card: r.card });
    return null;
  }, [onFound]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Member card"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
      <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-5 text-center shadow-2xl ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
        <div className="flex items-start justify-between gap-2 text-left">
          <div>
            <p className="flex items-center gap-1.5 font-display text-lg font-extrabold text-brand-brown dark:text-orange-100"><Crown size={18} /> Member price</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">Ask for the membership card and type the last 3 digits of its number.</p>
          </div>
          <button onClick={onClose} aria-label="Cancel" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800"><X size={18} /></button>
        </div>
        <PinPad submit={submit} idle="Last 3 digits of the card" length={3} />
      </div>
    </div>
  );
}

/**
 * Cash sale: Place order first asks "कति रुपैयाँ प्राप्त भयो?" (how much cash was
 * handed over) and shows what to give back; the order is placed only once it
 * covers the total. Its own keypad, not the phone/iPad keyboard, which would
 * cover the button. A keyboard still works (digits, Backspace, Enter, Esc).
 */
function CashReceived({ total, pending, onClose, onConfirm }: {
  total: number; pending: boolean; onClose: () => void; onConfirm: (received: number) => void;
}) {
  const [value, setValue] = useState("");
  const received = Number(value) || 0;
  const enough = value !== "" && received >= total;
  const press = useCallback((key: string) => {
    setValue((v) => (key === "back" ? v.slice(0, -1) : (v + key).replace(/^0+/, "").slice(0, 6)));
  }, []);
  const confirm = useCallback(() => { if (enough && !pending) onConfirm(received); }, [enough, pending, onConfirm, received]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
      else if (e.key === "Enter") { e.preventDefault(); confirm(); }
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, confirm, onClose]);
  // The exact amount, then the next few notes bigger than the total.
  const quick = [total, ...NOTES.filter((n) => n > total).slice(0, 3)];
  const key = "h-12 touch-manipulation rounded-xl bg-stone-100 font-display text-xl font-bold text-brand-brown transition active:scale-95 active:bg-orange-100 disabled:opacity-50 dark:bg-stone-800 dark:text-orange-100 dark:active:bg-orange-950";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Cash received"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
      <div className="flex max-h-full w-full max-w-sm flex-col overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-xl font-extrabold leading-tight text-brand-brown dark:text-orange-100" lang="ne">कति रुपैयाँ प्राप्त भयो?</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">Cash received · total <b className="text-stone-700 dark:text-stone-200">{npr(total)}</b></p>
          </div>
          <button onClick={onClose} aria-label="Cancel" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800"><X size={18} /></button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-orange-50 px-3 py-2 dark:bg-stone-800">
            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">Received</p>
            <p className="font-display text-2xl font-extrabold" aria-live="polite">{value ? npr(received) : <span className="text-stone-300 dark:text-stone-600">Rs —</span>}</p>
          </div>
          {/* What to hand back — the big number staff look for. */}
          <div className={cn("rounded-2xl px-3 py-2",
            !value ? "bg-stone-50 dark:bg-stone-800/60" : enough ? "bg-green-50 dark:bg-green-950/40" : "bg-red-50 dark:bg-red-950/40")}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              {value && !enough ? <><span lang="ne">कम</span> · Short</> : <><span lang="ne">फिर्ता</span> · Return</>}
            </p>
            <p className={cn("font-display text-2xl font-extrabold", !value ? "text-stone-300 dark:text-stone-600" : enough ? "text-brand-green" : "text-brand-red")} aria-live="polite">
              {!value ? "Rs —" : npr(Math.abs(received - total))}
            </p>
          </div>
        </div>

        <div className="mt-2.5 flex gap-1.5">
          {quick.map((v, i) => (
            <button key={v} onClick={() => setValue(String(v))} disabled={pending}
              className={cn("flex-1 touch-manipulation rounded-lg border py-2 text-xs font-bold transition active:scale-95",
                received === v && value
                  ? "border-brand-green bg-green-50 text-brand-green dark:bg-green-950/40"
                  : "border-orange-100 bg-white text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300")}>
              {i === 0 ? "Exact" : npr(v)}
            </button>
          ))}
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0"].map((d) => (
            <button key={d} onClick={() => press(d)} disabled={pending} className={key}>{d}</button>
          ))}
          <button onClick={() => press("back")} aria-label="Delete last digit" disabled={pending}
            className="flex h-12 touch-manipulation items-center justify-center rounded-xl text-stone-500 transition active:scale-95">
            <Delete size={22} />
          </button>
        </div>

        <button onClick={confirm} disabled={!enough || pending}
          className="btn-primary mt-3 w-full touch-manipulation !py-4 text-base disabled:opacity-50">
          {pending ? "Placing…"
            : enough ? (received > total ? `Place order · return ${npr(received - total)}` : "Place order · exact amount")
            : value ? `${npr(total - received)} short` : "Type the cash received"}
        </button>
      </div>
    </div>
  );
}

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
  products, categories, openingPromo, initialStock, staffFreeItems: staffLimit = 0, managerDeal = false,
}: {
  products: Product[]; categories: Category[]; openingPromo?: OpeningPromoSettings | null; initialStock?: PosStock;
  staffFreeItems?: number; // Admin → Settings → Staff sale; 0 = no Staff button
  managerDeal?: boolean; // someone is a manager (Admin → Staff Hours) → the Manager button
}) {
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [type, setType] = useState<"dine_in" | "pickup">("dine_in");
  const [method, setMethod] = useState<"cash" | "qr">("cash");
  // Cash sales: Place order asks how much cash was handed over (CashReceived) before placing.
  const [askCash, setAskCash] = useState(false);
  // Student 5%, member price, staff and manager never stack — picking one switches the others off.
  const [deal, setDeal] = useState<Deal>("none");
  // Manager discount: approved with a manager's own PIN, kept only for this sale (createPosOrder checks it again).
  const [manager, setManager] = useState<{ pin: string; name: string } | null>(null);
  const [askManager, setAskManager] = useState(false);
  // Member price: only once a member's card (last 3 digits) has been checked — for this sale only.
  const [memberCard, setMemberCard] = useState<MemberCard | null>(null);
  const [askMember, setAskMember] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [members, setMembers] = useState<MemberForm[]>([]);
  const [stock, setStock] = useState<PosStock>(initialStock ?? { all: [], warnings: [], byProduct: {} });
  const [stockOpen, setStockOpen] = useState(false);
  const [pending, start] = useTransition();

  // Stock warnings: fresh from the server on load, every minute while on screen,
  // after each sale and on the header's refresh button.
  useEffect(() => { if (initialStock) setStock(initialStock); }, [initialStock]);
  // The manager switched staff sales off while this screen was open.
  useEffect(() => { if (staffLimit <= 0) setDeal((d) => (d === "staff" ? "none" : d)); }, [staffLimit]);
  // …or nobody is a manager any more.
  useEffect(() => { if (!managerDeal) { setDeal((d) => (d === "manager" ? "none" : d)); setManager(null); } }, [managerDeal]);
  useEffect(() => {
    const reload = () => { if (document.visibilityState === "visible") getPosStock().then(setStock).catch(() => {}); };
    const poll = setInterval(reload, STOCK_POLL_MS);
    window.addEventListener(REFRESH_EVENT, reload);
    document.addEventListener("visibilitychange", reload);
    return () => { clearInterval(poll); window.removeEventListener(REFRESH_EVENT, reload); document.removeEventListener("visibilitychange", reload); };
  }, []);

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
  // The extra half plate's price, or null when the item has no half option.
  const halfOf = (p: Product) => (p.is_membership_card ? null : halfPlatePrice(p.half_price, priceOf(p)));

  const visible = useMemo(
    () => products.filter((p) =>
      (cat === "all" || p.category_id === cat) &&
      p.name.toLowerCase().includes(q.toLowerCase())),
    [products, cat, q]
  );
  // The order lines this cart becomes — the same list, in the same order, as
  // createPosOrder: each item's whole plates, then its extra half plate as a
  // line of its own. Every sum below comes from it, so the screen and the charge can't drift apart.
  const rows = cart.flatMap((l, line) => {
    const whole = { line, half: false, product: l.product, price: priceOf(l.product), qty: l.qty };
    const half = l.half ? halfOf(l.product) : null;
    return half == null ? [whole] : [whole, { line, half: true, product: l.product, price: half, qty: 1 }];
  });
  let subtotal = 0, eligible = 0, memberSaving = 0, plates = 0;
  for (const r of rows) {
    subtotal += r.price * r.qty;
    // Coca-Cola, and anything else Admin → Menu excludes, doesn't count towards the student discount.
    if (r.product.student_discount_eligible !== false) eligible += r.price * r.qty;
    // Member price is for whole plates only — never the extra half.
    if (!r.half) memberSaving += (r.price - memberUnitPrice(r.price, r.product.member_price)) * r.qty;
    plates += r.half ? 0.5 : r.qty;
  }
  const itemCount = platesLabel(Math.floor(plates), plates % 1 !== 0);
  // One set of member details per membership card in the cart.
  const cardCount = cart.reduce((n, l) => n + (l.product.is_membership_card ? l.qty : 0), 0);
  const memberAt = (i: number) => members[i] ?? BLANK_MEMBER;
  const setMember = (i: number, patch: Partial<MemberForm>) =>
    setMembers((cur) => { const next = [...cur]; next[i] = { ...(cur[i] ?? BLANK_MEMBER), ...patch }; return next; });
  // Staff sale: the dearest items go free, up to the limit — same function createPosOrder uses.
  const staff = deal === "staff"
    ? staffFreeItems(rows.map((r) => ({ price: r.price, qty: r.qty, eligible: !r.product.is_membership_card })), staffLimit)
    : null;
  const staffFreeLeft = staff ? staffLimit - staff.used : 0;
  // Manager discount: everything free except frozen items and membership cards — same function createPosOrder uses.
  const managerOn = deal === "manager" && !!manager;
  const memberOn = deal === "member" && !!memberCard;
  const managerFree = managerOn
    ? managerFreeItems(rows.map((r) => ({ price: r.price, qty: r.qty, eligible: !r.product.is_membership_card && !r.product.is_frozen })))
    : null;
  const managerFreeOf = (p: Product) => managerOn && !p.is_membership_card && !p.is_frozen;
  // A tile shows Rs 0 while this staff sale still has free items left, or under the manager discount.
  const tileFree = (p: Product) => (staffFreeLeft > 0 && !p.is_membership_card) || managerFreeOf(p);
  const discount = managerFree ? managerFree.saving
    : staff ? staff.saving
    : deal === "member" ? Math.round(memberSaving * 100) / 100
    : deal === "student" ? studentDiscount(eligible) : 0;
  const total = subtotal - discount;

  // The confirmation shouldn't block the next customer — it clears itself,
  // a little later when there's change to count out.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(null), done.received ? 20_000 : 8_000);
    return () => clearTimeout(t);
  }, [done]);

  const lineOf = (id: string) => cart.find((l) => l.product.id === id);
  const qtyOf = (id: string) => lineOf(id)?.qty ?? 0;
  // Every quantity change goes through here: clamped to 0–MAX_QTY whole plates, and 0
  // removes the line (its extra half too — a half is never sold on its own).
  const changeQty = (p: Product, next: (qty: number) => number) =>
    setCart((c) => {
      const cur = c.find((l) => l.product.id === p.id)?.qty ?? 0;
      const qty = Math.max(0, Math.min(next(cur), MAX_QTY));
      if (qty === 0) return c.filter((l) => l.product.id !== p.id);
      return cur ? c.map((l) => (l.product.id === p.id ? { ...l, qty } : l)) : [...c, { product: p, qty, half: false }];
    });
  // "+½": 1 → 1½, 2 → 2½ … and back. Only on a line that already has a whole plate.
  const toggleHalf = (p: Product) =>
    setCart((c) => c.map((l) => (l.product.id === p.id ? { ...l, half: !l.half } : l)));
  const add = (p: Product) => {
    if (!p.is_available) return;
    // Stock says it's gone: sell it if it's really there, but say so once.
    if (stock.byProduct[p.id]?.state === "out" && qtyOf(p.id) === 0) {
      toast(`Stock shows ${stock.byProduct[p.id].name} as finished — check before selling`, { id: `stock-${p.id}` });
    }
    changeQty(p, (n) => n + 1);
  };
  const clearCart = () => { if (cart.length && confirm("Clear the whole cart?")) { setCart([]); setMembers([]); } };
  const toggleDeal = (d: Exclude<Deal, "none">) => {
    // Manager needs a manager's PIN first, Member the member's card; switching either
    // (or to another deal) off forgets the approval.
    if (d === "manager" && deal !== "manager") { setAskManager(true); return; }
    if (d === "member" && deal !== "member") { setAskMember(true); return; }
    setManager(null);
    setMemberCard(null);
    setDeal((cur) => (cur === d ? "none" : d));
  };

  // cashIn: the cash handed over, from CashReceived. A cash sale with something to pay asks for it first.
  const placeOrder = (cashIn?: number) => {
    // Selling membership cards: each needs the new member's name and number first.
    const newMembers: { full_name: string; phone: string; card_number?: string }[] = [];
    for (let i = 0; i < cardCount; i++) {
      const m = newMemberSchema.safeParse(memberAt(i));
      if (!m.success) {
        const field = String(m.error.issues[0].path[0] ?? "full_name");
        toast.error(`${cardCount > 1 ? `Card ${i + 1}: ` : ""}${m.error.issues[0].message}`);
        setCartOpen(true);
        setTimeout(() => document.getElementById(`member-${i}-${field}`)?.focus(), 350);
        return;
      }
      newMembers.push(m.data);
    }
    if (method === "cash" && total > 0 && cashIn == null) { setAskCash(true); return; }
    start(async () => {
      const r = await createPosOrder({
        type, payment_method: method,
        student_discount: deal === "student",
        member: memberOn,
        member_card: memberOn ? memberCard!.digits : undefined,
        staff: deal === "staff",
        manager: managerOn,
        manager_pin: managerOn ? manager!.pin : undefined,
        members: cardCount ? newMembers : undefined,
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.qty, ...(l.half && halfOf(l.product) != null ? { half: true } : {}) })),
      });
      if (r?.error) { toast.error(r.error); return; }
      setDone({
        orderNumber: r.orderNumber!, dailyNumber: r.dailyNumber ?? null, total: Number(r.total),
        discount: Number(r.discount ?? 0),
        discountLabel: r.discountLabel === MANAGER_LABEL && manager ? `${MANAGER_LABEL} · ${manager.name}`
          : r.discountLabel === MEMBER_PRICE_LABEL && r.member ? `${MEMBER_PRICE_LABEL} · card ${r.member.card} (${r.member.name})`
          : r.discountLabel ?? null,
        method, received: method === "cash" && cashIn != null ? cashIn : null,
        members: r.members ?? [],
      });
      // Ready for the next customer: back to cash, no discount.
      setAskCash(false);
      setCart([]); setMembers([]); setDeal("none"); setManager(null); setMemberCard(null); setMethod("cash"); setCartOpen(false);
      getPosStock().then(setStock).catch(() => {}); // that sale may have used the last of something
    });
  };

  // Two or four deals: two across. Three: three across, compact (narrow beside the cart on an iPad).
  const dealCount = 2 + (staffLimit > 0 ? 1 : 0) + (managerDeal ? 1 : 0);
  const threeDeals = dealCount === 3;
  const dealButton = (d: Exclude<Deal, "none">, Icon: typeof Crown, label: string, onText?: string) => {
    const on = deal === d;
    return (
      <button onClick={() => toggleDeal(d)} aria-pressed={on}
        className={cn("flex touch-manipulation flex-col items-center justify-center rounded-xl border py-1.5 transition",
          threeDeals ? "px-1" : "px-2",
          on
            ? "border-brand-green bg-green-50 text-brand-green dark:bg-green-950/40 dark:text-green-400"
            : "border-orange-100 bg-white text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300")}>
        {/* Three across is narrow beside the cart on an iPad — the icon goes above the name. */}
        <span className={cn("flex items-center font-bold", threeDeals ? "flex-col gap-0.5 text-[13px] leading-tight" : "gap-1.5 text-sm")}>
          <Icon size={15} /> {label}
        </span>
        <span className="text-[11px] font-bold opacity-80">{on ? (onText ?? (discount ? `−${npr(discount)}` : "On")) : "Off"}</span>
      </button>
    );
  };
  // What a cart line charges (its whole plates + its extra half): free staff/manager
  // items cost nothing, member price where it applies (never on the half).
  const freeItems = managerFree ?? staff;
  const lineRows = (i: number) => rows.map((r, k) => ({ r, k })).filter(({ r }) => r.line === i);
  const lineCharge = (i: number) => lineRows(i).reduce((s, { r, k }) =>
    s + (freeItems ? (r.qty - freeItems.free[k]) * r.price : r.half ? r.price : unitOf(r.product) * r.qty), 0);
  const lineFull = (i: number) => lineRows(i).reduce((s, { r }) => s + r.price * r.qty, 0);
  // Staff sale: how many of this line's items (a half plate counts as one) are free.
  const lineFree = (i: number) => lineRows(i).reduce((n, { k }) => n + (freeItems?.free[k] ?? 0), 0);
  const lineItems = (i: number) => lineRows(i).reduce((n, { r }) => n + r.qty, 0);

  const CartContents = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-1 pt-3">
        <p className="font-display font-bold text-brand-brown dark:text-orange-100">Order{plates ? ` · ${itemCount}` : ""}</p>
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
          {cart.map((l, lineIndex) => {
            // Member details for this line's cards come after any earlier card lines'.
            const firstCard = cart.slice(0, lineIndex).reduce((n, x) => n + (x.product.is_membership_card ? x.qty : 0), 0);
            const half = halfOf(l.product);
            const withHalf = l.half && half != null;
            return (
            // Name on its own line so it wraps instead of being cut off in the narrow cart.
            <div key={l.product.id} className="border-b border-orange-50 py-2.5 last:border-0 dark:border-stone-800">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-bold leading-snug">{l.product.name}</p>
                <p className="shrink-0 text-sm font-bold">
                  {lineCharge(lineIndex) < lineFull(lineIndex) && (
                    <s className="mr-1.5 text-xs font-normal text-stone-400">{npr(lineFull(lineIndex))}</s>
                  )}
                  {npr(lineCharge(lineIndex))}
                </p>
              </div>
              {withHalf && (
                <p className="text-xs font-bold text-brand-orange">{platesLabel(l.qty, true)} plates · half plate {npr(half)}</p>
              )}
              {managerFree ? (
                lineFree(lineIndex) > 0
                  ? <p className="text-xs font-bold text-brand-green">Manager · free</p>
                  : l.product.is_frozen ? <p className="text-xs font-bold text-sky-600 dark:text-sky-400">Frozen · full price</p> : null
              ) : staff && lineFree(lineIndex) > 0 ? (
                <p className="text-xs font-bold text-brand-green">
                  Staff · {lineFree(lineIndex) === lineItems(lineIndex) ? "free" : `${lineFree(lineIndex)} of ${lineItems(lineIndex)} free`}
                </p>
              ) : memberApplies(l.product) ? (
                <p className="text-xs font-bold text-brand-green">
                  Member price {npr(unitOf(l.product))} a plate{withHalf ? " · half plate at normal price" : ""}
                </p>
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
                {half != null && (
                  <button onClick={() => toggleHalf(l.product)} aria-pressed={l.half}
                    aria-label={l.half ? `Take the half plate off ${l.product.name}` : `Add a half plate of ${l.product.name}`}
                    className={cn("h-10 shrink-0 touch-manipulation rounded-full border px-3 text-sm font-bold transition active:scale-95",
                      l.half
                        ? "border-brand-orange bg-brand-orange text-white"
                        : "border-orange-200 bg-white text-brand-orange dark:border-stone-700 dark:bg-stone-800")}>
                    {l.half ? "½ added" : "+ ½ plate"}
                  </button>
                )}
                <button onClick={() => changeQty(l.product, () => 0)} aria-label={`Remove ${l.product.name}`}
                  className="ml-auto flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-brand-red dark:hover:bg-red-950/40">
                  <Trash2 size={15} />
                </button>
              </div>
              {l.product.is_membership_card && Array.from({ length: l.qty }, (_, k) => {
                const i = firstCard + k, m = memberAt(i);
                const field = "input !py-2 text-base sm:!text-sm dark:!border-stone-700 dark:!bg-stone-800 dark:!text-stone-100";
                return (
                  <div key={i} className="mt-2 space-y-1.5 rounded-xl bg-amber-50 p-2.5 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                      <IdCard size={14} /> New member{l.qty > 1 || cardCount > 1 ? ` ${i + 1}` : ""}
                    </p>
                    <input id={`member-${i}-full_name`} value={m.full_name} onChange={(e) => setMember(i, { full_name: e.target.value })}
                      placeholder="Full name" aria-label="Member's full name" autoComplete="off" maxLength={100} className={field} />
                    <input id={`member-${i}-phone`} value={m.phone} onChange={(e) => setMember(i, { phone: e.target.value.replace(/[^\d+ -]/g, "").slice(0, 16) })}
                      placeholder="Mobile 98XXXXXXXX" aria-label="Member's mobile number" inputMode="tel" autoComplete="off" className={field} />
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">The card number is given automatically when the order is placed.</p>
                  </div>
                );
              })}
            </div>
            );
          })}
        </div>

        <div className="space-y-2.5 border-t border-orange-100 p-4 dark:border-stone-800 lg:shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <Segmented value={type} onChange={setType} activeClass="bg-brand-orange text-white shadow-sm"
              options={[["dine_in", "Dine-in"], ["pickup", "Pickup"]] as const} />
            <Segmented value={method} onChange={setMethod} activeClass="bg-brand-green text-white shadow-sm"
              options={[["cash", "Cash"], ["qr", "QR"]] as const} />
          </div>
          <div className={cn("grid gap-2", threeDeals ? "grid-cols-3" : "grid-cols-2")}>
            {dealButton("student", GraduationCap, "Student 5%")}
            {dealButton("member", Crown, "Member", memberCard ? `${memberCard.name.split(" ")[0]} · ${discount ? `−${npr(discount)}` : "on"}` : undefined)}
            {staffLimit > 0 && dealButton("staff", ChefHat, "Staff", `${staff?.used ?? 0} of ${staffLimit} free`)}
            {managerDeal && dealButton("manager", ShieldCheck, "Manager", manager ? `${manager.name.split(" ")[0]} · ${discount ? `−${npr(discount)}` : "on"}` : undefined)}
          </div>
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
          </div>
          <button onClick={() => placeOrder()} disabled={pending || cart.length === 0}
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
        {/* Stock running low / out (Accounts → Stock, linked to menu items) */}
        {stock.warnings.length > 0 && (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/40">
            <button onClick={() => setStockOpen((v) => !v)} aria-expanded={stockOpen} className="flex w-full touch-manipulation items-center gap-2 text-left">
              <AlertTriangle size={16} className="shrink-0 text-amber-600" />
              <span className="min-w-0 flex-1 truncate font-bold text-amber-900 dark:text-amber-200">
                {stock.warnings.map((w) => w.state === "out" ? `${w.name}: out` : `${w.name}: ${w.remaining} ${w.unit} left`).join(" · ")}
              </span>
              <ChevronDown size={16} className={cn("shrink-0 text-amber-700 transition", stockOpen && "rotate-180")} />
            </button>
            {stockOpen && (
              <ul className="mt-2 space-y-1 pb-1">
                {stock.warnings.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-2">
                    <span className="font-bold text-stone-700 dark:text-stone-200">{w.name}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-extrabold",
                      w.state === "out" ? "bg-red-100 text-brand-red dark:bg-red-950/60" : "bg-amber-200/70 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200")}>
                      {w.state === "out" ? "Out of stock" : `${w.remaining} ${w.unit} left`}
                    </span>
                  </li>
                ))}
                <li className="pt-1 text-xs text-stone-500 dark:text-stone-400">Restock or recount in Accounts → Stock and this clears.</li>
              </ul>
            )}
          </div>
        )}
        {/* Columns: phone 2 · iPad portrait 4 · beside the cart (iPad landscape, laptop) 3 · wide 4 */}
        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto overscroll-contain bg-brand-cream p-3 pb-24 dark:bg-stone-950 sm:grid-cols-3 sm:p-4 sm:pb-24 md:grid-cols-4 lg:grid-cols-3 lg:pb-4 2xl:grid-cols-4">
          {visible.map((p) => {
            const qty = qtyOf(p.id);
            const half = halfOf(p);
            const withHalf = !!lineOf(p.id)?.half && half != null;
            const shown = tileFree(p) ? 0 : unitOf(p);
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
                  {/* Every menu item linked to stock shows what's left (read-only — counted in Accounts → Stock) */}
                  {stock.byProduct[p.id] && (
                    <span className={cn("absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow",
                      stock.byProduct[p.id].state === "out" ? "bg-brand-red" : stock.byProduct[p.id].state === "low" ? "bg-amber-500" : "bg-stone-900/70")}>
                      {stock.byProduct[p.id].state === "out" ? "Stock out" : `${stock.byProduct[p.id].remaining} left`}
                    </span>
                  )}
                  {managerFreeOf(p) ? (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-brand-green px-2 py-0.5 text-[10px] font-bold text-white shadow"><ShieldCheck size={10} /> Manager · free</span>
                  ) : managerOn && p.is_frozen ? (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white shadow"><Snowflake size={10} /> Frozen · full price</span>
                  ) : tileFree(p) ? (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-brand-green px-2 py-0.5 text-[10px] font-bold text-white shadow"><ChefHat size={10} /> Staff · free</span>
                  ) : memberApplies(p) ? (
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
                    {half != null && <p className="text-[11px] font-bold text-stone-400">Half plate {npr(half)}</p>}
                    {!p.is_available && <p className="text-xs font-bold text-brand-red">Sold out</p>}
                  </div>
                </button>
                {/* Change the quantity right on the tile — no need to open the cart. ½ adds a half plate (1½, 2½ …). */}
                {qty > 0 && (
                  <div className="flex items-center border-t border-orange-100 dark:border-stone-800">
                    <button onClick={() => changeQty(p, (n) => n - 1)} aria-label={`One less ${p.name}`}
                      className="flex h-10 flex-1 touch-manipulation items-center justify-center text-brand-orange active:bg-orange-50 dark:active:bg-stone-800">
                      <Minus size={18} />
                    </button>
                    <span className="min-w-[2rem] text-center font-display text-lg font-bold">{platesLabel(qty, withHalf)}</span>
                    <button onClick={() => add(p)} aria-label={`One more ${p.name}`}
                      className="flex h-10 flex-1 touch-manipulation items-center justify-center text-brand-orange active:bg-orange-50 dark:active:bg-stone-800">
                      <Plus size={18} />
                    </button>
                    {half != null && (
                      <button onClick={() => toggleHalf(p)} aria-pressed={withHalf}
                        aria-label={withHalf ? `Take the half plate off ${p.name}` : `Add a half plate of ${p.name}`}
                        className={cn("flex h-10 flex-1 touch-manipulation items-center justify-center border-l border-orange-100 font-display text-base font-bold dark:border-stone-800",
                          withHalf ? "bg-brand-orange text-white" : "text-brand-orange active:bg-orange-50 dark:active:bg-stone-800")}>
                        ½
                      </button>
                    )}
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
          <span className="flex items-center gap-2 font-bold"><ShoppingCart size={18} /> {itemCount} item{plates > 1 ? "s" : ""}</span>
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
            <p className="mt-1 font-bold">{done.total > 0 ? <>{npr(done.total)} · paid by {done.method === "cash" ? "cash" : "QR"}</> : "Nothing to pay"}</p>
            {done.members.map((m, i) => (
              <p key={i} className="mt-1.5 flex items-center justify-center gap-1.5 text-sm text-amber-800 dark:text-amber-300">
                <IdCard size={15} className="shrink-0" /> New member: <b>{m.name}</b> · {m.phone}{m.card ? <> · card no. <b className="text-base">{m.card}</b></> : ""}
              </p>
            ))}
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
      {askManager && (
        <ManagerApproval
          onClose={() => setAskManager(false)}
          onApproved={(m) => { setManager(m); setMemberCard(null); setDeal("manager"); setAskManager(false); }}
        />
      )}
      {askCash && (
        <CashReceived total={total} pending={pending} onClose={() => setAskCash(false)} onConfirm={(received) => placeOrder(received)} />
      )}
      {askMember && (
        <MemberCardCheck
          onClose={() => setAskMember(false)}
          onFound={(m) => { setMemberCard(m); setManager(null); setDeal("member"); setAskMember(false); toast.success(`Member: ${m.name} · card ${m.card}`); }}
        />
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
