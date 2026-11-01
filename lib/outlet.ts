import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { nepalToday } from "@/lib/dates";

// The outlet's own records, written at the POS (migration 051): day expenses,
// issues & notes, stock added, and change requests waiting for an Accounts
// person. Kept apart from the Accounts money book; the Accounts app's POS
// section shows them all.

export type OutletExpense = {
  id: string; occurredOn: string; amount: number; reason: string; category: string; paidWith: string;
  hasBill: boolean; personName: string; personId: string | null; createdAt: string; edited: boolean;
  pending: string | null; // a change waiting for approval ("Change an expense" …)
};
export type OutletIssue = {
  id: string; title: string; details: string | null; kind: string; urgent: boolean; personName: string; createdAt: string;
  resolvedAt: string | null; resolvedBy: string | null; resolution: string | null;
};
export type OutletRequest = {
  id: string; kind: string; reason: string; personName: string; createdAt: string; status: string;
  decidedName: string | null; decisionNote: string | null; label: string;
};
export type PosStockAdd = { id: string; itemId: string; item: string; unit: string; quantity: number; note: string | null; personName: string; createdAt: string };

/** What the POS outlet sheet shows: today's expenses (and the till cash they used), issues, stock adds, requests. */
export async function getOutletDay() {
  const today = nepalToday();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ data: expenses }, { data: issues }, { data: adds }, { data: requests }] = await Promise.all([
    supabaseAdmin.from("pos_expenses")
      .select("id, occurred_on, amount, reason, category, paid_with, bill_path, person_name, person_id, created_at, edited_at")
      .gte("occurred_on", today).is("removed_at", null).order("created_at", { ascending: false }),
    // Open ones (any day) and ones closed in the last week.
    supabaseAdmin.from("pos_issues").select("id, title, details, kind, urgent, person_name, created_at, resolved_at, resolved_by, resolution")
      .or(`resolved_at.is.null,resolved_at.gte.${since}`).order("created_at", { ascending: false }).limit(60),
    supabaseAdmin.from("stock_movements").select("id, stock_item_id, quantity, note, pos_person_name, created_at, stock_items(name, unit)")
      .eq("source", "pos").eq("type", "restock").gte("created_at", since).order("created_at", { ascending: false }).limit(40),
    supabaseAdmin.from("pos_change_requests").select("id, kind, target_id, reason, person_name, created_at, status, decided_name, decision_note, payload")
      .or(`status.eq.pending,decided_at.gte.${since}`).order("created_at", { ascending: false }).limit(60),
  ]);

  const pendingFor = new Map<string, string>();
  for (const r of requests ?? []) if (r.status === "pending") pendingFor.set(r.target_id, r.kind);

  const ex: OutletExpense[] = (expenses ?? []).map((e) => ({
    id: e.id, occurredOn: e.occurred_on, amount: Number(e.amount), reason: e.reason, category: e.category, paidWith: e.paid_with,
    hasBill: !!e.bill_path, personName: e.person_name, personId: e.person_id, createdAt: e.created_at, edited: !!e.edited_at,
    pending: pendingFor.get(e.id) ?? null,
  }));
  return {
    today,
    expenses: ex,
    expensesTotal: ex.reduce((s, e) => s + e.amount, 0),
    tillCashUsed: ex.filter((e) => e.paidWith === "till_cash").reduce((s, e) => s + e.amount, 0),
    issues: (issues ?? []).map((i): OutletIssue => ({
      id: i.id, title: i.title, details: i.details, kind: i.kind, urgent: i.urgent, personName: i.person_name, createdAt: i.created_at,
      resolvedAt: i.resolved_at, resolvedBy: i.resolved_by, resolution: i.resolution,
    })),
    stockAdds: (adds ?? []).map((m): PosStockAdd => {
      const item = m.stock_items as unknown as { name: string; unit: string } | null;
      return {
        id: m.id, itemId: m.stock_item_id, item: item?.name ?? "—", unit: item?.unit ?? "", quantity: Number(m.quantity),
        note: m.note, personName: m.pos_person_name ?? "POS", createdAt: m.created_at,
      };
    }),
    requests: (requests ?? []).map((r): OutletRequest => ({
      id: r.id, kind: r.kind, reason: r.reason, personName: r.person_name, createdAt: r.created_at, status: r.status,
      decidedName: r.decided_name, decisionNote: r.decision_note, label: requestLabel(r.kind, r.payload as Record<string, unknown>),
    })),
  };
}

/** "Waste · 3 kg Chicken" — a short line for a change request. */
function requestLabel(kind: string, p: Record<string, unknown>) {
  const qty = p.quantity != null ? `${p.quantity}${p.unit ? ` ${p.unit}` : ""}` : "";
  switch (kind) {
    case "stock_waste": return `Waste · ${qty} ${p.item ?? ""}`.trim();
    case "stock_count": return `Recount · ${p.item ?? ""} is ${qty}`.trim();
    case "stock_fix": return Number(p.quantity) === 0 ? `Remove an add · ${p.item ?? ""}` : `Fix an add · ${p.item ?? ""} to ${qty}`;
    case "expense_remove": return `Remove expense · Rs ${p.old_amount ?? ""} ${p.old_reason ? `(${p.old_reason})` : ""}`.trim();
    case "expense_edit": return `Change expense · Rs ${p.old_amount ?? ""} → Rs ${p.amount ?? p.old_amount ?? ""}`;
    default: return kind;
  }
}

/**
 * Cash taken out of the till for expenses since `fromIso` — what the drawer
 * no longer holds at Close shift (removed expenses don't count).
 */
export async function tillCashExpensesSince(fromIso: string) {
  const fromDay = new Date(new Date(fromIso).getTime() + (5 * 60 + 45) * 60_000).toISOString().slice(0, 10);
  const { data } = await supabaseAdmin.from("pos_expenses").select("amount, created_at")
    .eq("paid_with", "till_cash").is("removed_at", null).gte("occurred_on", fromDay).gte("created_at", fromIso);
  return Math.round((data ?? []).reduce((s, e) => s + Number(e.amount), 0) * 100) / 100;
}

/** After stock is added: remember whether it's still low/out, so the next sale only alerts on a real drop. */
export async function syncStockAlert(itemId: string) {
  const { data } = await supabaseAdmin.rpc("stock_levels", { p_item: itemId });
  const s = (data as { remaining: number; reorder_level: number }[] | null)?.[0];
  if (!s) return;
  const remaining = Number(s.remaining), reorder = Number(s.reorder_level);
  const state = remaining <= 0 ? "out" : remaining <= reorder ? "low" : null;
  await supabaseAdmin.from("stock_items").update({ alert_state: state }).eq("id", itemId);
}

/** For Admin → Dashboard: what's waiting at the outlet. */
export async function outletCounts() {
  const [{ count: openIssues }, { count: pending }] = await Promise.all([
    supabaseAdmin.from("pos_issues").select("id", { count: "exact", head: true }).is("resolved_at", null),
    supabaseAdmin.from("pos_change_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return { openIssues: openIssues ?? 0, pending: pending ?? 0 };
}
