"use client";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { npr } from "@/lib/utils";
import { addExpense, deleteExpense } from "@/app/actions/expenses";

type Expense = { id: string; category: string; description: string | null; amount: number; spent_at: string };

const CATEGORIES = ["Ingredients", "Rent", "Utilities", "Salary", "Packaging", "Transport", "Maintenance", "Misc"];

export default function ExpensesManager({ expenses, total }: { expenses: Expense[]; total: number }) {
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-brand-brown">Expenses</h1>
        <p className="text-sm font-bold text-stone-500">This month: <span className="text-brand-red">{npr(total)}</span></p>
      </div>

      <form
        className="card grid gap-3 p-5 sm:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = Object.fromEntries(new FormData(form));
          start(async () => {
            const r = await addExpense(fd);
            if (r?.error) toast.error(r.error);
            else { toast.success("Expense logged"); form.reset(); }
          });
        }}
      >
        <select name="category" className="input" defaultValue="Ingredients">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input name="amount" required type="number" min="0" step="0.01" placeholder="Amount (Rs)" className="input" />
        <input name="spent_at" required type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
        <input name="description" placeholder="Description (optional)" className="input sm:col-span-2" maxLength={200} />
        <button disabled={pending} className="btn-primary sm:col-span-5">{pending ? "Saving…" : "Log expense"}</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-orange-100 text-left text-xs uppercase text-stone-400">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-orange-50 last:border-0">
                <td className="px-4 py-3 text-stone-500">{format(new Date(e.spent_at), "d MMM yyyy")}</td>
                <td className="px-4 py-3"><span className="badge bg-orange-50 text-brand-orange">{e.category}</span></td>
                <td className="px-4 py-3 text-stone-600">{e.description ?? "—"}</td>
                <td className="px-4 py-3 font-bold text-brand-brown">{npr(Number(e.amount))}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => { if (confirm("Delete this expense?")) start(async () => { await deleteExpense(e.id); toast.success("Deleted"); }); }}
                    className="text-stone-400 hover:text-brand-red transition"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">No expenses logged yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
