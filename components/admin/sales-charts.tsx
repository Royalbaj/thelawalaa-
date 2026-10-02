"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { npr } from "@/lib/utils";

// Chart chrome (light surface): recessive hairline grid, muted axis text.
const GRID = "#e1e0d9";
const AXIS = "#c3c2b7";
const MUTED = "#898781";
// Validated categorical pair: slot 1 blue, slot 2 orange.
export const SERIES_1 = "#2a78d6";
export const SERIES_2 = "#eb6834";

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
const tick = { fill: MUTED, fontSize: 11 };

type Series = { key: string; label: string; color: string };

function Tip({ title, rows, money }: { title: string; rows: { color: string; label: string; value: number }[]; money: boolean }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-stone-900">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-4 text-stone-600">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: r.color }} />{r.label}</span>
          <span className="font-bold tabular-nums text-stone-900">{money ? npr(r.value) : r.value}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Columns per day/hour: one series (no legend — the title names it) or a few
 * side by side (legend above). Thin bars, rounded tops, hover tooltip, and a
 * "show as table" view underneath.
 */
export function Columns({ data, series, money = true, height = 240, empty = "No sales in this period yet.", tableLabel = "Date" }: {
  data: Record<string, string | number>[]; series: Series[]; money?: boolean; height?: number; empty?: string; tableLabel?: string;
}) {
  const isEmpty = data.every((d) => series.every((s) => !Number(d[s.key])));
  const fmt = (v: number) => (money ? npr(v) : String(v));
  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-4">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs font-bold text-stone-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      )}
      {isEmpty ? (
        <p className="flex items-center justify-center rounded-xl bg-stone-50 text-sm text-stone-400" style={{ height }}>{empty}</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: AXIS }} interval="preserveStartEnd" minTickGap={14} />
            <YAxis tick={tick} tickLine={false} axisLine={false} width={44} allowDecimals={money}
              tickFormatter={(v: number) => (money ? compact.format(v) : String(v))} />
            <Tooltip
              cursor={{ fill: "rgba(11,11,11,0.04)" }}
              content={({ active, payload, label }) => active && payload?.length ? (
                <Tip title={String(label)} money={money}
                  rows={series.map((s) => ({ color: s.color, label: s.label, value: Number(payload[0]?.payload[s.key] ?? 0) }))} />
              ) : null}
            />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
      {!isEmpty && (
        <details className="mt-2 text-xs text-stone-500">
          <summary className="cursor-pointer font-bold">Show as table</summary>
          <table className="mt-2 w-full tabular-nums">
            <thead>
              <tr className="text-left text-stone-400">
                <th className="py-1">{tableLabel}</th>
                {series.map((s) => <th key={s.key} className="py-1 text-right">{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.filter((d) => series.some((s) => Number(d[s.key]))).map((d) => (
                <tr key={String(d.label)} className="border-t border-stone-100">
                  <td className="py-1">{d.label}</td>
                  {series.map((s) => <td key={s.key} className="py-1 text-right">{fmt(Number(d[s.key] ?? 0))}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
