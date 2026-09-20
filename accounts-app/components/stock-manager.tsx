"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Plus, X } from "lucide-react";
import { npr } from "@/lib/utils";
import { addStockItem, recordStockMovement } from "@/app/actions/stock";

type Item = { id: string; name: string; unit: string; quantity: number; reorder_level: number; cost_per_unit: number };

export default function StockManager({ items }: { items: Item[] }) {
  const [pending, start] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-brand-brown">Stock</h1>
        <button onClick={() => setShowAdd((s) => !s)} className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2 text-sm font-bold text-white hover:brightness-110 transition">
          {showAdd ? <X size={15} /> : <Plus size={15} />} {showAdd ? "Cancel" : "Add item"}
        </button>
      </div>

      {showAdd && (
        <form
          className="card grid gap-3 p-5 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = Object.fromEntries(new FormData(form));
            start(async () => {
              const r = await addStockItem(fd);
              if (r?.error) toast.error(r.error);
              else { toast.success("Item added"); form.reset(); setShowAdd(false); }
            });
          }}
        >
          <input name="name" required placeholder="Item name (e.g. Chicken)" className="input sm:col-span-2" maxLength={100} />
          <input name="unit" required placeholder="Unit (kg, pcs, litre…)" className="input" maxLength={20} defaultValue="kg" />
          <input name="cost_per_unit" required type="number" min="0" step="0.01" placeholder="Cost / unit (Rs)" className="input" />
          <input name="reorder_level" required type="number" min="0" step="0.01" placeholder="Reorder below" className="input" />
          <button disabled={pending} className="btn-primary sm:col-span-4">{pending ? "Adding…" : "Add item"}</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-orange-100 text-left text-xs uppercase text-stone-400">
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Quantity</th>
              <th className="px-4 py-3">Reorder at</th>
              <th className="px-4 py-3">Cost/unit</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const low = Number(i.quantity) <= Number(i.reorder_level);
              return (
                <tr key={i.id} className="border-b border-orange-50 last:border-0">
                  <td className="px-4 py-3 font-bold text-brand-brown">{i.name}</td>
                  <td className={`px-4 py-3 font-bold ${low ? "text-brand-red" : ""}`}>{Number(i.quantity)} {i.unit}</td>
                  <td className="px-4 py-3 text-stone-500">{Number(i.reorder_level)} {i.unit}</td>
                  <td className="px-4 py-3 text-stone-500">{npr(Number(i.cost_per_unit))}</td>
                  <td className="px-4 py-3 font-bold">{npr(Number(i.quantity) * Number(i.cost_per_unit))}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setMovingId(movingId === i.id ? null : i.id)} className="text-xs font-bold text-brand-orange hover:underline">
                      {movingId === i.id ? "Close" : "Update"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-400">No stock items yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {movingId && (
        <form
          className="card flex flex-wrap items-end gap-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = Object.fromEntries(new FormData(form));
            start(async () => {
              const r = await recordStockMovement({ ...fd, stock_item_id: movingId });
              if (r?.error) toast.error(r.error);
              else { toast.success("Recorded"); form.reset(); setMovingId(null); }
            });
          }}
        >
          <div>
            <label className="label">Type</label>
            <select name="type" className="input" defaultValue="usage">
              <option value="restock">Restock (add)</option>
              <option value="usage">Usage (used in kitchen)</option>
              <option value="wastage">Wastage (spoiled/lost)</option>
              <option value="adjustment">Adjustment (+/-)</option>
            </select>
          </div>
          <div>
            <label className="label">Quantity</label>
            <input name="quantity" required type="number" step="0.01" placeholder="0" className="input !w-32" />
          </div>
          <div className="flex-1">
            <label className="label">Note (optional)</label>
            <input name="note" placeholder="e.g. from Kalimati market" className="input" maxLength={200} />
          </div>
          <button disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save"}</button>
        </form>
      )}
    </div>
  );
}
