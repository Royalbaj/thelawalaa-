"use client";
import { useEffect, useState } from "react";
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import BarList, { type BarRow } from "@/components/admin/bar-list";
import { SERIES_1, SERIES_2 } from "@/components/admin/sales-charts";
import { cn, npr } from "@/lib/utils";

// Admin → Reports: every chart can be shown more than one way (the choice is
// remembered on this device), and the sales trend carries a projection — the
// selected period's average, carried forward, drawn lighter and dashed so it
// never reads as real sales.

const GRID = "#e1e0d9";
const AXIS = "#c3c2b7";
const MUTED = "#898781";
const OTHER = "#a8a29e"; // "Other" in a pie: neutral, never a categorical hue
// Validated categorical order (dataviz palette, light): fixed slots, never cycled.
// Slots 3, 4 and 5 sit under 3:1 on white, so pies always carry a labelled legend.
const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
const tick = { fill: MUTED, fontSize: 11 };

/** A chart-type choice, remembered on this device (not on the server — it's only a view). */
function useChoice<T extends string>(id: string, options: readonly T[], fallback: T) { // options: a module-level constant
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`tw-report-${id}`) as T | null;
      if (saved && options.includes(saved)) setValue(saved);
    } catch { /* private mode */ }
  }, [id, options]);
  const choose = (v: T) => {
    setValue(v);
    try { localStorage.setItem(`tw-report-${id}`, v); } catch { /* private mode */ }
  };
  return [value, choose] as const;
}

export function TypePicker<T extends string>({ value, options, onChange, label }: {
  value: T; options: readonly { key: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 gap-0.5 rounded-full bg-stone-100 p-0.5 print:hidden">
      {options.map((o) => (
        <button key={o.key} type="button" role="radio" aria-checked={value === o.key} onClick={() => onChange(o.key)}
          className={cn("rounded-full px-2.5 py-1 text-xs font-bold transition",
            value === o.key ? "bg-white text-brand-brown shadow-sm" : "text-stone-500 hover:text-stone-800")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Tip({ title, rows, money = true, note }: { title: string; rows: { color: string; label: string; value: number }[]; money?: boolean; note?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-stone-900">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-4 text-stone-600">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: r.color }} />{r.label}</span>
          <span className="font-bold tabular-nums text-stone-900">{money ? npr(Math.round(r.value)) : r.value}</span>
        </p>
      ))}
      {note && <p className="mt-1 text-[11px] text-stone-400">{note}</p>}
    </div>
  );
}

function Legend({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((s) => (
        <span key={s.label} className="flex items-center gap-1.5 text-xs font-bold text-stone-600">
          {s.dashed
            ? <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: s.color }} />
            : <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />}
          {s.label}
        </span>
      ))}
    </div>
  );
}

// ── Sales over time ──────────────────────────────────────────────────────
type Period = { label: string; counter: number; online: number; orders: number };
type Future = { label: string; days: number };
const TREND = [
  { key: "bars", label: "Bars" }, { key: "stacked", label: "Stacked" }, { key: "line", label: "Line" }, { key: "area", label: "Area" },
] as const;
type TrendType = (typeof TREND)[number]["key"];
const TREND_KEYS = TREND.map((t) => t.key);

/**
 * Paid sales per day (or month), counter vs online, as bars, stacked bars, lines
 * or areas — plus, when "Projection" is on, the next stretch at the period's
 * average a day, split the way the period split (lighter + dashed).
 */
export function SalesTrend({ periods, future, unit, perDay }: { periods: Period[]; future: Future[]; unit: "day" | "month"; perDay: number }) {
  const [type, setType] = useChoice<TrendType>("trend", TREND_KEYS, "bars");
  const [project, setProject] = useState(true);

  const totalCounter = periods.reduce((s, p) => s + p.counter, 0);
  const totalOnline = periods.reduce((s, p) => s + p.online, 0);
  const total = totalCounter + totalOnline;
  const isEmpty = total === 0;
  const counterShare = total ? totalCounter / total : 0.5;

  type Point = { label: string; counter?: number; online?: number; counterP?: number; onlineP?: number; future?: boolean };
  const data: Point[] = periods.map((p) => ({ label: p.label, counter: p.counter, online: p.online }));
  const lines = type === "line" || type === "area";
  if (project && !isEmpty) {
    // Lines/areas: a separate dashed series, starting at the last real point so it continues from it.
    // Bars: the same two bars (so every bar keeps its width), drawn lighter and dashed.
    if (lines) {
      const last = data[data.length - 1];
      if (last) { last.counterP = last.counter; last.onlineP = last.online; }
    }
    for (const f of future) {
      const amount = perDay * f.days;
      const c = amount * counterShare, o = amount * (1 - counterShare);
      data.push(lines ? { label: f.label, counterP: c, onlineP: o, future: true } : { label: f.label, counter: c, online: o, counterP: c, onlineP: o, future: true });
    }
  }
  // A projected bar: the series colour, faint, with a dashed outline.
  const barCells = (color: string) => data.map((d, i) => (
    <Cell key={i} fill={color} fillOpacity={d.future ? 0.22 : 1} stroke={d.future ? color : undefined} strokeDasharray={d.future ? "4 3" : undefined} />
  ));
  const avgPerUnit = unit === "day" ? perDay : perDay * 30.4;

  const legend = [
    { color: SERIES_1, label: "Counter (POS)" }, { color: SERIES_2, label: "Online" },
    ...(project && !isEmpty ? [{ color: MUTED, label: `Projected — ${npr(Math.round(perDay))} a day`, dashed: true }] : []),
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Legend items={legend} />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-stone-600 print:hidden">
            <input type="checkbox" checked={project} onChange={(e) => setProject(e.target.checked)} className="h-4 w-4 accent-[#eb6834]" />
            Projection
          </label>
          <TypePicker label="Chart type" value={type} options={TREND} onChange={setType} />
        </div>
      </div>
      {isEmpty ? (
        <p className="flex h-[260px] items-center justify-center rounded-xl bg-stone-50 text-sm text-stone-400">No sales in this period yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: AXIS }} interval="preserveStartEnd" minTickGap={14} />
            <YAxis tick={tick} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => compact.format(v)} />
            <Tooltip
              cursor={{ fill: "rgba(11,11,11,0.04)", stroke: AXIS }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Point;
                return p.future
                  ? <Tip title={`${label} · projected`} note={`At ${npr(Math.round(perDay))} a day, this period's average`}
                      rows={[{ color: SERIES_1, label: "Counter (POS)", value: p.counterP ?? 0 }, { color: SERIES_2, label: "Online", value: p.onlineP ?? 0 }]} />
                  : <Tip title={String(label)}
                      rows={[{ color: SERIES_1, label: "Counter (POS)", value: p.counter ?? 0 }, { color: SERIES_2, label: "Online", value: p.online ?? 0 },
                        { color: MUTED, label: "Total", value: (p.counter ?? 0) + (p.online ?? 0) }]} />;
              }}
            />
            {type === "stacked" && (
              <ReferenceLine y={avgPerUnit} stroke={MUTED} strokeDasharray="6 4"
                label={{ value: `avg ${compact.format(avgPerUnit)}`, position: "insideTopRight", fill: MUTED, fontSize: 11 }} />
            )}
            {(type === "bars" || type === "stacked") && <>
              <Bar dataKey="counter" name="Counter (POS)" stackId={type === "stacked" ? "s" : undefined} fill={SERIES_1}
                radius={type === "stacked" ? [0, 0, 0, 0] : [4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>{barCells(SERIES_1)}</Bar>
              <Bar dataKey="online" name="Online" stackId={type === "stacked" ? "s" : undefined} fill={SERIES_2}
                radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>{barCells(SERIES_2)}</Bar>
            </>}
            {type === "line" && <>
              <Line dataKey="counter" stroke={SERIES_1} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls={false} />
              <Line dataKey="online" stroke={SERIES_2} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls={false} />
              <Line dataKey="counterP" stroke={SERIES_1} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
              <Line dataKey="onlineP" stroke={SERIES_2} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
            </>}
            {type === "area" && <>
              <Area dataKey="counter" stackId="a" stroke={SERIES_1} strokeWidth={2} fill={SERIES_1} fillOpacity={0.18} isAnimationActive={false} />
              <Area dataKey="online" stackId="a" stroke={SERIES_2} strokeWidth={2} fill={SERIES_2} fillOpacity={0.18} isAnimationActive={false} />
              <Area dataKey="counterP" stackId="p" stroke={SERIES_1} strokeWidth={2} strokeDasharray="6 4" fill={SERIES_1} fillOpacity={0.06} isAnimationActive={false} />
              <Area dataKey="onlineP" stackId="p" stroke={SERIES_2} strokeWidth={2} strokeDasharray="6 4" fill={SERIES_2} fillOpacity={0.06} isAnimationActive={false} />
            </>}
          </ComposedChart>
        </ResponsiveContainer>
      )}
      {!isEmpty && (
        <details className="mt-2 text-xs text-stone-500">
          <summary className="cursor-pointer font-bold">Show as table</summary>
          <table className="mt-2 w-full tabular-nums">
            <thead><tr className="text-left text-stone-400"><th className="py-1">{unit === "day" ? "Date" : "Month"}</th><th className="py-1 text-right">Counter (POS)</th><th className="py-1 text-right">Online</th><th className="py-1 text-right">Total</th></tr></thead>
            <tbody>
              {data.filter((d) => d.future || (d.counter ?? 0) + (d.online ?? 0) > 0).map((d) => {
                const c = d.future ? d.counterP ?? 0 : d.counter ?? 0, o = d.future ? d.onlineP ?? 0 : d.online ?? 0;
                return (
                  <tr key={d.label} className={cn("border-t border-stone-100", d.future && "italic text-stone-400")}>
                    <td className="py-1">{d.label}{d.future ? " (projected)" : ""}</td>
                    <td className="py-1 text-right">{npr(Math.round(c))}</td><td className="py-1 text-right">{npr(Math.round(o))}</td>
                    <td className="py-1 text-right font-bold">{npr(Math.round(c + o))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

// ── Busiest hours ────────────────────────────────────────────────────────
const HOURS = [{ key: "bars", label: "Bars" }, { key: "line", label: "Line" }] as const;
type HoursType = (typeof HOURS)[number]["key"];
const HOUR_KEYS = HOURS.map((h) => h.key);

export function HoursChart({ hours }: { hours: { label: string; count: number }[] }) {
  const [type, setType] = useChoice<HoursType>("hours", HOUR_KEYS, "bars");
  const isEmpty = hours.every((h) => !h.count);
  return (
    <div>
      <div className="mb-3 flex justify-end"><TypePicker label="Chart type" value={type} options={HOURS} onChange={setType} /></div>
      {isEmpty ? (
        <p className="flex h-[200px] items-center justify-center rounded-xl bg-stone-50 text-sm text-stone-400">No orders in this period yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={hours} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: AXIS }} interval="preserveStartEnd" minTickGap={10} />
            <YAxis tick={tick} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <Tooltip cursor={{ fill: "rgba(11,11,11,0.04)", stroke: AXIS }}
              content={({ active, payload, label }) => active && payload?.length
                ? <Tip title={String(label)} money={false} rows={[{ color: SERIES_1, label: "Orders", value: Number(payload[0].payload.count) }]} /> : null} />
            {type === "bars"
              ? <Bar dataKey="count" fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
              : <Line dataKey="count" stroke={SERIES_1} strokeWidth={2} dot={{ r: 3, fill: SERIES_1 }} activeDot={{ r: 5 }} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Breakdowns (category, payment method, order type) ──────────────────
const BREAKDOWN = [{ key: "bars", label: "Bars" }, { key: "pie", label: "Pie" }] as const;
type BreakdownType = (typeof BREAKDOWN)[number]["key"];
const BREAKDOWN_KEYS = BREAKDOWN.map((b) => b.key);

/**
 * A part-to-whole as ranked bars or a donut. The donut keeps each thing's
 * colour fixed by its place in `order` (the same colour every period, never by
 * rank), shows at most 5 slices + "Other", and always has a labelled legend.
 */
export function Breakdown({ id, title, rows, order, empty, note }: { id: string; title: string; rows: BarRow[]; order: string[]; empty: string; note?: string }) {
  const [type, setType] = useChoice<BreakdownType>(`breakdown-${id}`, BREAKDOWN_KEYS, "bars");
  const colorOf = (rowId: string) => {
    const i = order.indexOf(rowId);
    return i >= 0 && i < CATEGORICAL.length ? CATEGORICAL[i] : null;
  };
  // Slices: things with a colour slot, biggest first, up to 5; everything else is "Other".
  const own = rows.filter((r) => colorOf(r.id)).slice(0, 5);
  const rest = rows.filter((r) => !own.includes(r));
  const slices = [
    ...own.map((r) => ({ ...r, color: colorOf(r.id)! })),
    ...(rest.length ? [{ id: "other", name: rest.length === 1 ? rest[0].name : `Other (${rest.length})`, color: OTHER,
      amount: rest.reduce((s, r) => s + r.amount, 0), share: rest.reduce((s, r) => s + r.share, 0) }] : []),
  ].filter((s) => s.amount > 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-bold text-brand-brown">{title}</h2>
        {rows.length > 0 && <TypePicker label="Chart type" value={type} options={BREAKDOWN} onChange={setType} />}
      </div>
      {type === "bars" || !rows.length ? (
        <BarList color={SERIES_1} rows={rows} empty={empty} />
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-44 w-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slices} dataKey="amount" nameKey="name" innerRadius="58%" outerRadius="100%" paddingAngle={1.5}
                  stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                  {slices.map((s) => <Cell key={s.id} fill={s.color} />)}
                </Pie>
                <Tooltip content={({ active, payload }) => active && payload?.length ? (
                  <Tip title={String(payload[0].name)} note={`${Math.round(Number(payload[0].payload.share) * 100)}% of the total`}
                    rows={[{ color: String(payload[0].payload.color), label: "Sales", value: Number(payload[0].value) }]} />
                ) : null} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full space-y-1.5 text-sm">
            {slices.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate font-bold text-stone-700">{s.name}</span></span>
                <span className="shrink-0 tabular-nums text-stone-900"><b>{npr(s.amount)}</b> <span className="text-xs text-stone-400">{Math.round(s.share * 100)}%</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {note && <p className="mt-2 text-[11px] text-stone-400">{note}</p>}
    </div>
  );
}

// ── Projection ────────────────────────────────────────────────────────────
type Avg = { days: number; sellingDays: number; perDay: number; perSellingDay: number; ordersPerDay: number };
const BASIS = ["all", "selling"] as const;

/**
 * What the selected period's average adds up to if it carries on: the next
 * week, month and year. The basis can be every day of the period or only the
 * days something was sold (closed days left out).
 */
export function Projection({ avg }: { avg: Avg }) {
  const [basis, setBasis] = useChoice<(typeof BASIS)[number]>("projection-basis", BASIS, "all");
  const perDay = basis === "all" ? avg.perDay : avg.perSellingDay;
  const ordersPerDay = basis === "all" ? avg.ordersPerDay : (avg.sellingDays ? avg.ordersPerDay * avg.days / avg.sellingDays : 0);
  const rows = [
    { label: "Next 7 days", days: 7 },
    { label: "Next 30 days", days: 30 },
    { label: "A year", days: 365 },
  ];
  if (!avg.days || !perDay) return <p className="py-4 text-center text-sm text-stone-400">No paid sales in this period to project from.</p>;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-stone-500">Average a day</p>
          <p className="font-display text-3xl font-bold text-stone-900">{npr(Math.round(perDay))}</p>
          <p className="text-xs text-stone-400">
            {basis === "all" ? `over ${avg.days} ${avg.days === 1 ? "day" : "days"}` : `over ${avg.sellingDays} selling ${avg.sellingDays === 1 ? "day" : "days"}`}
            {" · "}{ordersPerDay.toFixed(1)} paid orders a day
          </p>
        </div>
        <TypePicker label="Average over" value={basis} onChange={setBasis}
          options={[{ key: "all", label: "Every day" }, { key: "selling", label: "Selling days" }]} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl bg-stone-50 p-3">
            <p className="text-xs font-bold text-stone-500">{r.label}</p>
            <p className="mt-0.5 whitespace-nowrap font-display text-base font-bold text-stone-900">{npr(Math.round(perDay * r.days))}</p>
            <p className="text-[11px] text-stone-400">≈ {Math.round(ordersPerDay * r.days)} orders</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
        If the selected period&apos;s pace carries on. A longer period gives a steadier estimate; festivals, weather and
        offers will move the real numbers.
      </p>
    </div>
  );
}
