import Link from "next/link";
import { npr } from "@/lib/utils";

export type BarRow = { id: string; name: string; amount: number; share: number; href?: string };

/** Ranked horizontal bars with the amount and share at the end — a category breakdown that reads like a list. */
export default function BarList({ rows, color, empty = "Nothing yet.", max = 8 }: { rows: BarRow[]; color: string; empty?: string; max?: number }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-stone-400">{empty}</p>;
  // Past `max` rows, the rest fold into "Other" so the list stays scannable.
  const shown = rows.length > max ? [
    ...rows.slice(0, max - 1),
    rows.slice(max - 1).reduce((o, r) => ({ ...o, amount: o.amount + r.amount, share: o.share + r.share }),
      { id: "other", name: `Other (${rows.length - max + 1})`, amount: 0, share: 0 } as BarRow),
  ] : rows;
  const top = Math.max(...shown.map((r) => r.amount), 1);
  return (
    <ul className="space-y-2.5">
      {shown.map((r) => {
        const label = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-bold text-stone-700">{r.name}</span>
              <span className="shrink-0 tabular-nums text-stone-900">
                <b>{npr(r.amount)}</b> <span className="text-xs text-stone-400">{Math.round(r.share * 100)}%</span>
              </span>
            </span>
            <span className="mt-1 block h-2 rounded-full bg-stone-100">
              <span className="block h-2 rounded-full" style={{ width: `${Math.max(2, (r.amount / top) * 100)}%`, background: color }} />
            </span>
          </>
        );
        return (
          <li key={r.id}>
            {r.href ? <Link href={r.href} className="block rounded-lg transition hover:bg-stone-50">{label}</Link> : label}
          </li>
        );
      })}
    </ul>
  );
}
