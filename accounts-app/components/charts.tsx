"use client";
import { Bar, BarChart, Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { npr } from "@/lib/utils";

// Chart chrome (light surface): recessive hairline grid, muted axis text.
const GRID = "#e1e0d9";
const AXIS = "#c3c2b7";
const MUTED = "#898781";
// Validated pair — blue: money in, orange: money out.
export const IN_COLOR = "#2a78d6";
export const OUT_COLOR = "#eb6834";

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
const tick = { fill: MUTED, fontSize: 11 };

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-bold text-stone-600">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}

type TipRow = { color: string; label: string; value: number };
function Tip({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-stone-900">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-4 text-stone-600">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: r.color }} />{r.label}</span>
          <span className="font-bold tabular-nums text-stone-900">{npr(r.value)}</span>
        </p>
      ))}
    </div>
  );
}

export type InOutPoint = { label: string; in: number; out: number };

/** Money in vs money out per day (or month): grouped columns, legend above, table below. */
export function InOutColumns({ data, height = 240 }: { data: InOutPoint[]; height?: number }) {
  const empty = data.every((d) => !d.in && !d.out);
  return (
    <div>
      <div className="mb-2 flex gap-4"><Key color={IN_COLOR} label="Money in" /><Key color={OUT_COLOR} label="Money out" /></div>
      {empty ? (
        <p className="flex items-center justify-center rounded-xl bg-stone-50 text-sm text-stone-400" style={{ height }}>Nothing entered for these dates yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: AXIS }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={tick} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => compact.format(v)} />
            <Tooltip
              cursor={{ fill: "rgba(11,11,11,0.04)" }}
              content={({ active, payload, label }) => active && payload?.length ? (
                <Tip title={String(label)} rows={[
                  { color: IN_COLOR, label: "Money in", value: Number(payload[0]?.payload.in ?? 0) },
                  { color: OUT_COLOR, label: "Money out", value: Number(payload[0]?.payload.out ?? 0) },
                ]} />
              ) : null}
            />
            <Bar dataKey="in" name="Money in" fill={IN_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            <Bar dataKey="out" name="Money out" fill={OUT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
      {!empty && (
        <details className="mt-2 text-xs text-stone-500">
          <summary className="cursor-pointer font-bold">Show as table</summary>
          <table className="mt-2 w-full tabular-nums">
            <thead><tr className="text-left text-stone-400"><th className="py-1">Date</th><th className="py-1 text-right">In</th><th className="py-1 text-right">Out</th><th className="py-1 text-right">Net</th></tr></thead>
            <tbody>
              {data.filter((d) => d.in || d.out).map((d) => (
                <tr key={d.label} className="border-t border-stone-100">
                  <td className="py-1">{d.label}</td><td className="py-1 text-right">{npr(d.in)}</td>
                  <td className="py-1 text-right">{npr(d.out)}</td><td className="py-1 text-right font-bold">{npr(d.in - d.out)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

/** Money left at the end of each day/month — one series, so no legend box. */
export function BalanceArea({ data, height = 220 }: { data: { label: string; balance: number }[]; height?: number }) {
  const min = Math.min(...data.map((d) => d.balance));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: AXIS }} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tick={tick} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => compact.format(v)} />
        {min < 0 && <ReferenceLine y={0} stroke={AXIS} />}
        <Tooltip
          cursor={{ stroke: AXIS, strokeWidth: 1 }}
          content={({ active, payload, label }) => active && payload?.length ? (
            <Tip title={String(label)} rows={[{ color: IN_COLOR, label: "Balance", value: Number(payload[0].value ?? 0) }]} />
          ) : null}
        />
        <Area type="monotone" dataKey="balance" stroke={IN_COLOR} strokeWidth={2} fill={IN_COLOR} fillOpacity={0.1}
          activeDot={{ r: 5, stroke: "#fcfcfb", strokeWidth: 2 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
