import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addDays, dayCount, eachDay, eachMonth, monthLabel, shortDate, startOfMonth, type Ymd } from "@/lib/dates";

// The money book: entries the manager types in (account_transactions), never
// order data. Everything here runs after requireAuth() (signed in + PIN).

export type Kind = "in" | "out";
export type Method = "cash" | "bank" | "qr";
export type Category = { id: string; kind: Kind; name: string; sort_order: number; is_active: boolean };
export type Entry = {
  id: string; kind: Kind; amount: number; category_id: string; description: string | null;
  occurred_on: Ymd; method: Method; bill_path: string | null; created_at: string;
  // Who typed it: the person who unlocked with their PIN (entries from
  // before per-person PINs only have the login's name).
  person?: { name: string } | null;
  creator?: { full_name: string } | null;
};
export const enteredBy = (e: Pick<Entry, "person" | "creator">) => e.person?.name ?? e.creator?.full_name ?? "—";

export const METHOD_LABELS: Record<Method, string> = { cash: "Cash", bank: "Bank", qr: "QR / eSewa" };
export const KIND_LABELS: Record<Kind, string> = { in: "Money in", out: "Money out" };
// Chart series colours (validated pair: blue = money in, orange = money out).
export const SERIES = { in: "#2a78d6", out: "#eb6834" } as const;

/** Everyone who has ever been set up (switched-off people still own their old entries). */
export async function getPeople(): Promise<{ id: string; name: string; is_active: boolean }[]> {
  const { data } = await supabaseAdmin.from("account_users").select("id, name, is_active").order("name");
  return data ?? [];
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await supabaseAdmin.from("account_categories")
    .select("id, kind, name, sort_order, is_active").order("sort_order").order("name");
  return (data ?? []) as Category[];
}

export type EntryFilter = { kind?: Kind; categoryId?: string; q?: string; missingBill?: boolean; personId?: string };

/** Entries in a date range, newest first. Pages through Supabase's 1,000-row cap. */
export async function getEntries(from: Ymd, to: Ymd, f: EntryFilter = {}, max = 20_000): Promise<Entry[]> {
  const out: Entry[] = [];
  for (let offset = 0; offset < max; offset += 1000) {
    let q = supabaseAdmin.from("account_transactions")
      .select("id, kind, amount, category_id, description, occurred_on, method, bill_path, created_at, person:account_users!account_transactions_entered_by_fkey(name), creator:profiles!account_transactions_created_by_fkey(full_name)")
      .gte("occurred_on", from).lte("occurred_on", to)
      .order("occurred_on", { ascending: false }).order("created_at", { ascending: false })
      .range(offset, Math.min(offset + 999, max - 1));
    if (f.kind) q = q.eq("kind", f.kind);
    if (f.categoryId) q = q.eq("category_id", f.categoryId);
    if (f.q) q = q.ilike("description", `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
    if (f.missingBill) q = q.is("bill_path", null);
    if (f.personId) q = q.eq("entered_by", f.personId);
    const { data, error } = await q;
    if (error) throw new Error(`Couldn't load entries: ${error.message}`);
    out.push(...((data ?? []) as unknown as Entry[]).map((e) => ({ ...e, amount: Number(e.amount) })));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Opening balance + everything entered (optionally only before a date). */
export async function getBalance(before?: Ymd) {
  const [{ data: settings }, { data: totals, error }] = await Promise.all([
    supabaseAdmin.from("account_settings").select("opening_balance").eq("id", 1).single(),
    supabaseAdmin.rpc("account_totals", { p_before: before ?? null }),
  ]);
  if (error) throw new Error(`Couldn't work out the balance: ${error.message}`);
  const row = (Array.isArray(totals) ? totals[0] : totals) as { total_in: number; total_out: number } | undefined;
  const opening = Number(settings?.opening_balance ?? 0);
  const totalIn = Number(row?.total_in ?? 0);
  const totalOut = Number(row?.total_out ?? 0);
  return { opening, totalIn, totalOut, balance: opening + totalIn - totalOut };
}

// ── Sums (pure) ─────────────────────────────────────────────────
export function totals(entries: Entry[]) {
  let moneyIn = 0, moneyOut = 0;
  for (const e of entries) (e.kind === "in" ? (moneyIn += e.amount) : (moneyOut += e.amount));
  return { moneyIn, moneyOut, net: moneyIn - moneyOut, count: entries.length };
}

export const within = (entries: Entry[], from: Ymd, to: Ymd) => entries.filter((e) => e.occurred_on >= from && e.occurred_on <= to);

export type Slice = { id: string; name: string; amount: number; share: number };
/** Money in or out by category, biggest first. */
export function byCategory(entries: Entry[], categories: Category[], kind: Kind): Slice[] {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const sums = new Map<string, number>();
  for (const e of entries) if (e.kind === kind) sums.set(e.category_id, (sums.get(e.category_id) ?? 0) + e.amount);
  const total = [...sums.values()].reduce((s, v) => s + v, 0);
  return [...sums.entries()]
    .map(([id, amount]) => ({ id, name: names.get(id) ?? "Unknown", amount, share: total ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export function byMethod(entries: Entry[], kind: Kind): Slice[] {
  const sums = new Map<Method, number>();
  for (const e of entries) if (e.kind === kind) sums.set(e.method, (sums.get(e.method) ?? 0) + e.amount);
  const total = [...sums.values()].reduce((s, v) => s + v, 0);
  return (Object.keys(METHOD_LABELS) as Method[])
    .filter((m) => sums.has(m))
    .map((m) => ({ id: m, name: METHOD_LABELS[m], amount: sums.get(m)!, share: total ? sums.get(m)! / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export type Bucket = { key: Ymd; label: string; fullLabel: string; in: number; out: number };
/** Money in/out per day — or per month once the range is longer than ~2 months. */
export function byPeriod(entries: Entry[], from: Ymd, to: Ymd): { unit: "day" | "month"; buckets: Bucket[] } {
  const unit = dayCount(from, to) > 62 ? "month" : "day";
  const keys = unit === "day" ? eachDay(from, to) : eachMonth(from, to);
  const index = new Map(keys.map((k, i) => [k, i]));
  const buckets: Bucket[] = keys.map((k) => ({
    key: k,
    label: unit === "day" ? shortDate(k) : monthLabel(k),
    fullLabel: unit === "day" ? shortDate(k) : monthLabel(k),
    in: 0, out: 0,
  }));
  for (const e of entries) {
    const i = index.get(unit === "day" ? e.occurred_on : startOfMonth(e.occurred_on));
    if (i !== undefined) buckets[i][e.kind] += e.amount;
  }
  return { unit, buckets };
}

/** Balance at the end of each day/month of the range, starting from the balance before it. */
export function runningBalance(startBalance: number, buckets: Bucket[]) {
  let bal = startBalance;
  return buckets.map((b) => {
    bal += b.in - b.out;
    return { key: b.key, label: b.label, balance: Math.round(bal * 100) / 100 };
  });
}

export const daysIn = (from: Ymd, to: Ymd) => dayCount(from, to);
export const yesterdayOf = (d: Ymd) => addDays(d, -1);
