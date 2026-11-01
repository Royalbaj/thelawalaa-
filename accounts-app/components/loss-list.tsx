"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";
import { deleteLoss } from "@/app/actions/losses";
import { LOSS_KINDS } from "@/lib/loss-kinds";
import type { LossRow } from "@/lib/losses";
import { longDate } from "@/lib/dates";
import { npDayTime } from "@/lib/pos-outlet";
import { npr, cn } from "@/lib/utils";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));
const FROM = { loss: null, stock: "Waste on the Stock page", pos: "Waste from the POS" } as const;

function Row({ r }: { r: LossRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const remove = () => {
    if (!confirm(`Remove "${r.what}"?${r.quantity && r.item ? ` The ${fmt(r.quantity)} ${r.unit ?? ""} goes back on stock.` : ""}`)) return;
    start(async () => {
      const res = await deleteLoss(r.id);
      if ("error" in res) { toast.error(res.error ?? "Couldn't remove it"); return; }
      toast.success("Removed"); router.refresh();
    });
  };
  return (
    <li className={cn("flex items-start justify-between gap-3 px-4 py-3", pending && "opacity-50")}>
      <div className="min-w-0 text-sm">
        <p className="font-bold text-stone-800">
          {r.what}{r.quantity != null && <span className="font-normal text-stone-500"> · {fmt(r.quantity)} {r.unit}</span>}
        </p>
        <p className="text-xs text-stone-500">
          <span className="font-bold text-brand-orange">{LOSS_KINDS[r.kind].label}</span>
          {FROM[r.from] && <> · {FROM[r.from]}</>} · {r.person} · {npDayTime(r.createdAt)}
        </p>
        {r.reason && <p className="mt-0.5 text-xs text-stone-600">{r.reason}</p>}
        {r.hasPhoto && <a href={`/loss-photos/${r.id}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-orange">See the photo</a>}
      </div>
      <div className="flex shrink-0 items-start gap-1">
        <p className={cn("text-right font-display font-bold tabular-nums", !r.valued && "text-stone-400")}>
          {r.valued ? npr(r.value) : <span className="text-xs font-bold">worth not known</span>}
        </p>
        {r.from === "loss" && (
          <button onClick={remove} disabled={pending} aria-label={`Remove ${r.what}`} className="-mr-2 -mt-1 p-2 text-stone-300 hover:text-brand-red"><Trash2 size={15} /></button>
        )}
      </div>
    </li>
  );
}

/** The period's losses, a block per day with that day's total. */
export default function LossList({ rows }: { rows: LossRow[] }) {
  const days = [...new Set(rows.map((r) => r.day))];
  return (
    <div className="space-y-3">
      {days.map((d) => {
        const of = rows.filter((r) => r.day === d);
        return (
          <section key={d} className="card overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 border-b border-stone-100 bg-stone-50 px-4 py-2 text-sm">
              <span className="font-bold text-stone-700">{longDate(d)}</span>
              <span className="font-bold tabular-nums text-stone-600">{npr(of.reduce((s, r) => s + r.value, 0))}</span>
            </div>
            <ul className="divide-y divide-stone-100">{of.map((r) => <Row key={`${r.from}-${r.id}`} r={r} />)}</ul>
          </section>
        );
      })}
    </div>
  );
}
