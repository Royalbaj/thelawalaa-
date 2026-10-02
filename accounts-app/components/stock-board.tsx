"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus, PackagePlus, ClipboardCheck, Trash2, Pencil, X, CheckCircle2, AlertTriangle, XCircle, Search, Link2 } from "lucide-react";
import { createStockItem, updateStockItem, changeStock, removeStockItem } from "@/app/actions/stock";
import { cn } from "@/lib/utils";

type Level = {
  id: string; name: string; unit: string; reorder_level: number; counted: number; counted_at: string;
  added: number; used: number; sold: number; remaining: number; sold_today: number; sold_7d: number;
};
type Link = { stock_item_id: string; product_id: string; units_per_sale: number; product_name: string };
type Product = { id: string; name: string; category: string };
type Change = { id: string; type: string; quantity: number; note: string | null; created_at: string; item: string; unit: string; person: string };

// Status colours are reserved for state and always carry an icon + a word.
const STATUS = {
  ok: { label: "In stock", icon: CheckCircle2, fill: "#0ca30c", pill: "bg-green-50 text-green-800 ring-green-200" },
  low: { label: "Running low", icon: AlertTriangle, fill: "#fab219", pill: "bg-amber-50 text-amber-800 ring-amber-300" },
  out: { label: "Out of stock", icon: XCircle, fill: "#d03b3b", pill: "bg-red-50 text-red-700 ring-red-200" },
} as const;
const statusOf = (s: Level) => (s.remaining <= 0 ? "out" : s.remaining <= s.reorder_level ? "low" : "ok");
const UNITS = ["plates", "pcs", "kg", "litres", "bottles", "packets"];
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

const ACTIONS = {
  restock: { label: "Add stock", icon: PackagePlus, ask: (u: string) => `How many ${u} came in?` },
  count: { label: "Count", icon: ClipboardCheck, ask: (u: string) => `How many ${u} do you have right now?` },
  waste: { label: "Waste", icon: Trash2, ask: (u: string) => `How many ${u} were wasted or spoiled?` },
} as const;
type ActionKind = keyof typeof ACTIONS;

function QuickChange({ item, kind, onDone }: { item: Level; kind: ActionKind; onDone: () => void }) {
  const router = useRouter();
  const [qty, setQty] = useState(kind === "count" ? fmt(Math.max(0, item.remaining)) : "");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  return (
    <form className="mt-3 space-y-2 rounded-xl bg-stone-50 p-3" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await changeStock({ item: item.id, kind, quantity: qty, note });
        if (r?.error) { toast.error(r.error); return; }
        toast.success(kind === "restock" ? "Stock added" : kind === "count" ? "Count saved" : "Waste recorded");
        onDone();
        router.refresh();
      });
    }}>
      <label className="block text-xs font-bold text-stone-600">{ACTIONS[kind].ask(item.unit)}</label>
      <div className="flex gap-2">
        <input value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" autoFocus required
          className="input !py-2 text-lg font-bold" placeholder="0" aria-label="Amount" />
        <button disabled={pending} className="btn-primary shrink-0 !px-5 !py-2">{pending ? "…" : "Save"}</button>
        <button type="button" onClick={onDone} aria-label="Cancel" className="shrink-0 p-2 text-stone-400"><X size={18} /></button>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Note (optional)"
        className="input !py-2 text-base sm:text-sm" />
    </form>
  );
}

function StockCard({ s, links, onEdit }: { s: Level; links: Link[]; onEdit: () => void }) {
  const [action, setAction] = useState<ActionKind | null>(null);
  const st = STATUS[statusOf(s)];
  const full = Math.max(s.counted + s.added, s.remaining, 1);
  const perDay = s.sold_7d / 7;
  const days = perDay > 0 ? Math.max(0, s.remaining) / perDay : null;
  return (
    <div className={cn("card flex flex-col p-4", statusOf(s) !== "ok" && "ring-2", statusOf(s) === "low" && "ring-amber-200", statusOf(s) === "out" && "ring-red-200")}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-stone-800">{s.name}</p>
        <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1", st.pill)}>
          <st.icon size={12} /> {st.label}
        </span>
      </div>
      <p className="mt-1 font-display text-3xl font-bold text-stone-900">
        {fmt(Math.max(0, s.remaining))} <span className="text-base font-bold text-stone-500">{s.unit} left</span>
      </p>
      <div className="mt-2 h-2 rounded-full bg-stone-100" role="meter" aria-valuemin={0} aria-valuemax={full} aria-valuenow={Math.max(0, s.remaining)}
        aria-label={`${s.name}: ${fmt(Math.max(0, s.remaining))} ${s.unit} left`}>
        <div className="h-2 rounded-full" style={{ width: `${Math.min(100, Math.max(0, s.remaining) / full * 100)}%`, background: st.fill }} />
      </div>
      <p className="mt-2 text-xs text-stone-600">
        Sold today <b>{fmt(s.sold_today)}</b>
        {days !== null && <> · lasts about <b>{days < 1 ? "less than a day" : `${Math.floor(days)} day${Math.floor(days) === 1 ? "" : "s"}`}</b></>}
        {" · "}warns at {fmt(s.reorder_level)}
      </p>
      <p className="mt-0.5 text-[11px] text-stone-400">
        Counted {fmt(s.counted)} on {when(s.counted_at)}
        {s.added > 0 && <> · +{fmt(s.added)} added</>}
        {s.sold > 0 && <> · −{fmt(s.sold)} sold</>}
        {s.used > 0 && <> · −{fmt(s.used)} wasted</>}
      </p>
      <p className="mt-1 flex items-start gap-1 text-[11px] text-stone-500">
        <Link2 size={12} className="mt-0.5 shrink-0" />
        {links.length ? links.map((l) => `${l.product_name}${l.units_per_sale !== 1 ? ` (×${fmt(l.units_per_sale)})` : ""}`).join(", ") : "Not linked to the POS — sales won't count down"}
      </p>
      {action ? <QuickChange item={s} kind={action} onDone={() => setAction(null)} /> : (
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {(Object.keys(ACTIONS) as ActionKind[]).map((k) => {
            const A = ACTIONS[k];
            return (
              <button key={k} onClick={() => setAction(k)}
                className={cn("flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-bold transition active:scale-95",
                  k === "restock" ? "bg-brand-orange text-white" : "bg-stone-100 text-stone-700")}>
                <A.icon size={16} /> {A.label}
              </button>
            );
          })}
          <button onClick={onEdit} className="flex flex-col items-center gap-0.5 rounded-xl bg-stone-100 py-2 text-[11px] font-bold text-stone-700 transition active:scale-95">
            <Pencil size={16} /> Edit
          </button>
        </div>
      )}
    </div>
  );
}

function ItemForm({ item, links, products, onClose }: { item: Level | null; links: Link[]; products: Product[]; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "plates");
  const [quantity, setQuantity] = useState("");
  const [warnAt, setWarnAt] = useState(item ? fmt(item.reorder_level) : "10");
  const [chosen, setChosen] = useState<Map<string, string>>(new Map(links.map((l) => [l.product_id, fmt(l.units_per_sale)])));
  const [search, setSearch] = useState("");
  const [pending, start] = useTransition();
  const groups = useMemo(() => {
    const m = new Map<string, Product[]>();
    products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      .forEach((p) => m.set(p.category, [...(m.get(p.category) ?? []), p]));
    return [...m.entries()];
  }, [products, search]);
  const toggle = (id: string) => setChosen((c) => { const n = new Map(c); if (n.has(id)) n.delete(id); else n.set(id, "1"); return n; });

  const save = () => start(async () => {
    const payload = { name, unit, reorder_level: warnAt, links: [...chosen.entries()].map(([product_id, u]) => ({ product_id, units_per_sale: u || "1" })) };
    const r = item ? await updateStockItem(item.id, payload) : await createStockItem({ ...payload, quantity });
    if (r?.error) { toast.error(r.error); return; }
    toast.success(item ? "Saved" : "Stock item added");
    onClose();
    router.refresh();
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save(); }}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h2 className="font-display text-lg font-bold text-brand-brown">{item ? `Edit ${item.name}` : "New stock item"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <label className="block"><span className="label">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="e.g. Buff momo" className="input text-base sm:text-sm" autoFocus={!item} />
          </label>
          <div>
            <span className="label">Counted in</span>
            <div className="flex flex-wrap gap-2">
              {[...new Set([...UNITS, unit])].map((u) => (
                <button key={u} type="button" onClick={() => setUnit(u)}
                  className={cn("rounded-full px-3.5 py-1.5 text-sm font-bold", unit === u ? "bg-brand-brown text-white" : "bg-white text-stone-600 ring-1 ring-stone-200")}>{u}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!item && (
              <label className="block"><span className="label">How many now</span>
                <input value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" required placeholder="e.g. 50" className="input text-base sm:text-sm" />
              </label>
            )}
            <label className="block"><span className="label">Warn me at</span>
              <input value={warnAt} onChange={(e) => setWarnAt(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" required className="input text-base sm:text-sm" />
            </label>
          </div>
          <div>
            <span className="label">POS menu items that use it</span>
            <p className="mb-2 text-xs text-stone-500">Each one the POS or website sells takes this much off. E.g. a 2-plate combo uses 2.</p>
            {products.length > 8 && (
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a menu item" className="input !py-2 !pl-8 text-base sm:text-sm" />
              </div>
            )}
            <div className="space-y-3">
              {groups.map(([cat, list]) => (
                <div key={cat}>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">{cat}</p>
                  <ul className="divide-y divide-stone-100 rounded-xl ring-1 ring-stone-200">
                    {list.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                        <input type="checkbox" checked={chosen.has(p.id)} onChange={() => toggle(p.id)} className="h-5 w-5 accent-brand-orange" id={`p-${p.id}`} />
                        <label htmlFor={`p-${p.id}`} className="flex-1 text-sm font-bold text-stone-700">{p.name}</label>
                        {chosen.has(p.id) && (
                          <label className="flex items-center gap-1 text-xs text-stone-500">uses
                            <input value={chosen.get(p.id)} onChange={(e) => setChosen((c) => new Map(c).set(p.id, e.target.value.replace(/[^\d.]/g, "")))}
                              inputMode="decimal" className="input !w-16 !px-2 !py-1 text-center text-base sm:text-sm" aria-label={`${unit} used per ${p.name}`} />
                          </label>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 border-t border-stone-100 px-5 py-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          {item && (
            <button type="button" disabled={pending} onClick={() => {
              if (!confirm(`Stop tracking ${item.name}? Its history stays.`)) return;
              start(async () => { const r = await removeStockItem(item.id); if (r?.error) toast.error(r.error); else { toast.success("Removed"); onClose(); router.refresh(); } });
            }} className="rounded-full px-4 text-sm font-bold text-brand-red ring-1 ring-red-200">Remove</button>
          )}
          <button disabled={pending} className="btn-primary flex-1">{pending ? "Saving…" : item ? "Save" : "Add item"}</button>
        </div>
      </form>
    </div>
  );
}

export default function StockBoard({ levels, links, products, changes }: { levels: Level[]; links: Link[]; products: Product[]; changes: Change[] }) {
  const [editing, setEditing] = useState<Level | "new" | null>(null);
  const linksOf = (id: string) => links.filter((l) => l.stock_item_id === id);
  const low = levels.filter((s) => statusOf(s) !== "ok");
  const sorted = [...levels].sort((a, b) => ({ out: 0, low: 1, ok: 2 }[statusOf(a)] - { out: 0, low: 1, ok: 2 }[statusOf(b)]) || a.name.localeCompare(b.name));
  const TYPE: Record<string, string> = { restock: "Added", wastage: "Wasted", usage: "Used", adjustment: "Counted" };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-brown">Stock</h1>
          <p className="text-sm text-stone-500">Counts down by itself as the POS sells.</p>
        </div>
        <button onClick={() => setEditing("new")} className="btn-primary shrink-0 whitespace-nowrap !px-4 !py-2.5 text-sm"><Plus size={16} /> New item</button>
      </div>

      {low.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-bold">{low.length === 1 ? "1 item needs" : `${low.length} items need`} restocking</p>
            <p>{low.map((s) => `${s.name} (${s.remaining <= 0 ? "out" : `${fmt(s.remaining)} ${s.unit} left`})`).join(" · ")}</p>
          </div>
        </div>
      )}

      {levels.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-bold text-brand-brown">Nothing tracked yet</p>
          <p className="mt-1 text-sm text-stone-500">Add an item — e.g. &ldquo;Buff momo, 50 plates&rdquo; — and link it to the POS menu items that use it.</p>
          <button onClick={() => setEditing("new")} className="btn-primary mt-4 !py-2.5 text-sm"><Plus size={16} /> Add the first item</button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((s) => <StockCard key={s.id} s={s} links={linksOf(s.id)} onEdit={() => setEditing(s)} />)}
        </div>
      )}

      {changes.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-brand-brown">Recent changes</h2>
          <div className="card divide-y divide-stone-100">
            {changes.map((c) => (
              <div key={c.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <b className="text-stone-800">{TYPE[c.type] ?? c.type} {c.type === "restock" ? "+" : c.type === "wastage" || c.type === "usage" ? "−" : ""}{fmt(c.quantity)} {c.unit}</b>
                  <span className="text-stone-600"> · {c.item}</span>
                  {c.note && <span className="text-stone-400"> · {c.note}</span>}
                </span>
                <span className="shrink-0 text-right text-xs text-stone-400">{c.person} · {when(c.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {editing && (
        <ItemForm item={editing === "new" ? null : editing} links={editing === "new" ? [] : linksOf(editing.id)}
          products={products} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
