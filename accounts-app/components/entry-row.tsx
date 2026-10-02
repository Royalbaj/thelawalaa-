import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Paperclip } from "lucide-react";
import { npr } from "@/lib/utils";
import { shortDate } from "@/lib/dates";
import { METHOD_LABELS, SERIES, enteredBy, type Entry } from "@/lib/ledger";

/** One line of the money book — tap to edit. Money in shows "+" (green), money out "−". */
export default function EntryRow({ e, category, showDate = false }: { e: Entry; category: string; showDate?: boolean }) {
  const isIn = e.kind === "in";
  const Icon = isIn ? ArrowDownLeft : ArrowUpRight;
  return (
    <Link href={`/entries/${e.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-orange-50/40">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `${SERIES[e.kind]}1a` }}>
        <Icon size={17} style={{ color: SERIES[e.kind] }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-stone-800">{category}</span>
        <span className="flex items-center gap-1.5 truncate text-xs text-stone-500">
          {e.description && <span className="truncate">{e.description}</span>}
          {e.description && <span aria-hidden>·</span>}
          <span className="shrink-0">{METHOD_LABELS[e.method]}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{enteredBy(e)}</span>
          {e.bill_path && <Paperclip size={12} className="shrink-0 text-stone-400" aria-label="Bill attached" />}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`block font-bold tabular-nums ${isIn ? "text-green-700" : "text-stone-900"}`}>{isIn ? "+" : "−"}{npr(e.amount)}</span>
        {showDate && <span className="block text-xs text-stone-400">{shortDate(e.occurred_on)}</span>}
      </span>
    </Link>
  );
}
