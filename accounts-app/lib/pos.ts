import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addDays, type Ymd } from "@/lib/dates";

// The POS section (migration 051): everything the counter recorded, kept APART
// from the money book — sales and shift cash counts from the POS, the outlet's
// day expenses, issues & notes, stock added on the POS, and the changes the
// counter asked for (approved here). The book itself still never reads sales.

const startOf = (d: Ymd) => `${d}T00:00:00+05:45`;

export type PosRequest = {
  id: string; kind: string; targetId: string; payload: Record<string, unknown>; reason: string; personName: string; createdAt: string;
  status: string; decidedName: string | null; decidedAt: string | null; decisionNote: string | null;
};
export type PosExpense = {
  id: string; occurredOn: string; amount: number; reason: string; category: string; paidWith: string; hasBill: boolean;
  personName: string; createdAt: string; removed: boolean; editedBy: string | null;
};
export type PosIssue = {
  id: string; title: string; details: string | null; kind: string; urgent: boolean; personName: string; createdAt: string;
  resolvedAt: string | null; resolvedBy: string | null; resolution: string | null;
};
export type ShiftClose = {
  at: string; by: string | null; countedBy: string | null; expected: number; counted: number; difference: number;
  tillExpenses: number; sales: number;
};

const mapRequest = (r: Record<string, unknown>): PosRequest => ({
  id: r.id as string, kind: r.kind as string, targetId: r.target_id as string, payload: (r.payload ?? {}) as Record<string, unknown>,
  reason: r.reason as string, personName: r.person_name as string, createdAt: r.created_at as string, status: r.status as string,
  decidedName: (r.decided_name as string) ?? null, decidedAt: (r.decided_at as string) ?? null, decisionNote: (r.decision_note as string) ?? null,
});

/** Changes the counter asked for that nobody has decided yet — oldest first. */
export async function getPendingRequests(): Promise<PosRequest[]> {
  const { data } = await supabaseAdmin.from("pos_change_requests").select("*").eq("status", "pending").order("created_at");
  return (data ?? []).map(mapRequest);
}

/** For the menu badge: what's waiting for someone here. */
export async function posWaiting() {
  const [{ count: pending }, { count: urgent }] = await Promise.all([
    supabaseAdmin.from("pos_change_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabaseAdmin.from("pos_issues").select("id", { count: "exact", head: true }).is("resolved_at", null).eq("urgent", true),
  ]);
  return (pending ?? 0) + (urgent ?? 0);
}

async function salesIn(from: Ymd, to: Ymd) {
  const rows: { total: number; status: string; payment_status: string; payment_method: string | null; placed_by: string | null; discount_amount: number | null }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data } = await supabaseAdmin.from("orders").select("total, status, payment_status, payment_method, placed_by, discount_amount")
      .gte("created_at", startOf(from)).lt("created_at", startOf(addDays(to, 1))).range(offset, offset + 999);
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < 1000) break;
  }
  const paid = rows.filter((o) => o.status !== "cancelled" && o.payment_status === "paid");
  const byMethod = new Map<string, { amount: number; count: number }>();
  for (const o of paid) {
    const m = byMethod.get(o.payment_method ?? "other") ?? { amount: 0, count: 0 };
    m.amount += Number(o.total); m.count += 1;
    byMethod.set(o.payment_method ?? "other", m);
  }
  const sum = (list: typeof rows) => list.reduce((s, o) => s + Number(o.total), 0);
  return {
    total: sum(paid), orders: paid.length,
    counter: sum(paid.filter((o) => o.placed_by)), online: sum(paid.filter((o) => !o.placed_by)),
    byMethod: [...byMethod.entries()].map(([method, v]) => ({ method, ...v })).sort((a, b) => b.amount - a.amount),
    discounts: rows.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.discount_amount ?? 0), 0),
    cancelled: rows.filter((o) => o.status === "cancelled").length,
    unpaid: sum(rows.filter((o) => o.status !== "cancelled" && o.payment_status !== "paid")),
  };
}

/** Everything the POS recorded in a period (Nepal days). */
export async function getPosReport(from: Ymd, to: Ymd) {
  const since = startOf(from), until = startOf(addDays(to, 1));
  const [sales, { data: expenses }, { data: issues }, { data: adds }, { data: decided }, pending, { data: closes }] = await Promise.all([
    salesIn(from, to),
    supabaseAdmin.from("pos_expenses").select("id, occurred_on, amount, reason, category, paid_with, bill_path, person_name, created_at, removed_at, edited_by")
      .gte("occurred_on", from).lte("occurred_on", to).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(2000),
    // Open ones from any day, plus ones written in the period.
    supabaseAdmin.from("pos_issues").select("id, title, details, kind, urgent, person_name, created_at, resolved_at, resolved_by, resolution")
      .or(`resolved_at.is.null,and(created_at.gte.${since},created_at.lt.${until})`).order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("stock_movements").select("id, quantity, note, pos_person_name, created_at, stock_items(name, unit)")
      .eq("source", "pos").eq("type", "restock").gte("created_at", since).lt("created_at", until).order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("pos_change_requests").select("*").neq("status", "pending").gte("decided_at", since).lt("decided_at", until)
      .order("decided_at", { ascending: false }).limit(500),
    getPendingRequests(),
    supabaseAdmin.from("audit_logs").select("created_at, new_data, actor:profiles!audit_logs_actor_id_fkey(full_name)")
      .eq("action", "SHIFT_CLOSE").gte("created_at", since).lt("created_at", until).order("created_at", { ascending: false }).limit(200),
  ]);

  const ex: PosExpense[] = (expenses ?? []).map((e) => ({
    id: e.id, occurredOn: e.occurred_on, amount: Number(e.amount), reason: e.reason, category: e.category, paidWith: e.paid_with,
    hasBill: !!e.bill_path, personName: e.person_name, createdAt: e.created_at, removed: !!e.removed_at, editedBy: e.edited_by,
  }));
  const live = ex.filter((e) => !e.removed);
  const group = (key: (e: PosExpense) => string) => {
    const m = new Map<string, number>();
    for (const e of live) m.set(key(e), (m.get(key(e)) ?? 0) + e.amount);
    return [...m.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  };

  return {
    sales,
    expenses: ex,
    expenseTotal: live.reduce((s, e) => s + e.amount, 0),
    tillCash: live.filter((e) => e.paidWith === "till_cash").reduce((s, e) => s + e.amount, 0),
    byCategory: group((e) => e.category),
    byPerson: group((e) => e.personName),
    issues: (issues ?? []).map((i): PosIssue => ({
      id: i.id, title: i.title, details: i.details, kind: i.kind, urgent: i.urgent, personName: i.person_name, createdAt: i.created_at,
      resolvedAt: i.resolved_at, resolvedBy: i.resolved_by, resolution: i.resolution,
    })),
    stockAdds: (adds ?? []).map((m) => {
      const it = m.stock_items as unknown as { name: string; unit: string } | null;
      return { id: m.id, item: it?.name ?? "—", unit: it?.unit ?? "", quantity: Number(m.quantity), note: m.note, personName: m.pos_person_name ?? "POS", createdAt: m.created_at };
    }),
    pending,
    decided: (decided ?? []).map(mapRequest),
    closes: (closes ?? []).map((c): ShiftClose => {
      const d = (c.new_data ?? {}) as Record<string, unknown>;
      return {
        at: c.created_at, by: (c.actor as unknown as { full_name: string } | null)?.full_name ?? null, countedBy: (d.counted_by as string) ?? null,
        expected: Number(d.expected_cash ?? 0), counted: Number(d.counted_cash ?? 0), difference: Number(d.difference ?? 0),
        tillExpenses: Number(d.till_expenses ?? 0), sales: Number(d.sales ?? 0),
      };
    }),
  };
}
