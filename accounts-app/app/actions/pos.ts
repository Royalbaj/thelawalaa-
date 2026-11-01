"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { syncAlertState } from "@/lib/stock";

// The POS section (migration 051): an Accounts person approves or rejects the
// changes the counter asked for (stock waste / recount / fixing an add, and
// changing or removing a day expense), and closes issues. Approving applies the
// change here, in one place, with their name on it.

const uuid = z.string().uuid();
const note = z.string().trim().max(300, "Keep the note under 300 characters").optional().transform((v) => v || null);
const refresh = () => revalidatePath("/", "layout");

type Req = { id: string; kind: string; target_id: string; payload: Record<string, unknown>; reason: string; person_name: string };

/** Approve = apply the change and mark it approved; reject = mark it (nothing changes). */
export async function decideRequest(id: string, approve: boolean, input?: unknown) {
  const { user, person } = await requireAuth();
  if (!uuid.safeParse(id).success) return { error: "Bad request" };
  const parsedNote = note.safeParse((input as { note?: unknown } | undefined)?.note);
  if (!parsedNote.success) return { error: parsedNote.error.issues[0]?.message ?? "Check the note" };
  const decisionNote = parsedNote.data;

  // Claim it first, so two people deciding at once can't both apply it.
  const { data: claimed } = await supabaseAdmin.from("pos_change_requests")
    .update({ status: approve ? "approved" : "rejected", decided_by: person.id, decided_name: person.name, decided_at: new Date().toISOString(), decision_note: decisionNote })
    .eq("id", id).eq("status", "pending").select("id, kind, target_id, payload, reason, person_name");
  const req = claimed?.[0] as Req | undefined;
  if (!req) return { error: "Someone already decided this one — refresh" };

  if (approve) {
    const applied = await apply(req, user.id, person);
    if ("error" in applied) {
      // Couldn't apply (e.g. the item was removed) — put it back so it can be rejected or retried.
      await supabaseAdmin.from("pos_change_requests")
        .update({ status: "pending", decided_by: null, decided_name: null, decided_at: null, decision_note: null }).eq("id", id);
      return applied;
    }
  }
  await audit({ actor_id: user.id, action: approve ? "POS_REQUEST_APPROVE" : "POS_REQUEST_REJECT", target_table: "pos_change_requests", target_id: id,
    new_data: { kind: req.kind, target_id: req.target_id, payload: req.payload, asked_by: req.person_name, person: person.name, note: decisionNote } });
  refresh();
  return { ok: true };
}

async function apply(req: Req, userId: string, person: { id: string; name: string }): Promise<{ ok: true } | { error: string }> {
  const p = req.payload;
  const now = new Date().toISOString();
  const asked = `POS · ${req.person_name}: ${req.reason}`.slice(0, 200);
  switch (req.kind) {
    case "expense_edit": {
      const patch: Record<string, unknown> = { edited_at: now, edited_by: person.name };
      for (const k of ["amount", "reason", "category", "paid_with"] as const) if (p[k] !== undefined) patch[k] = p[k];
      const { data } = await supabaseAdmin.from("pos_expenses").update(patch).eq("id", req.target_id).is("removed_at", null).select("id");
      return data?.length ? { ok: true } : { error: "That expense is gone" };
    }
    case "expense_remove": {
      const { data } = await supabaseAdmin.from("pos_expenses").update({ removed_at: now, edited_at: now, edited_by: person.name })
        .eq("id", req.target_id).is("removed_at", null).select("id");
      return data?.length ? { ok: true } : { error: "That expense is already removed" };
    }
    case "stock_waste": {
      const qty = Number(p.quantity);
      if (!(qty > 0)) return { error: "Nothing to take off" };
      const { error } = await supabaseAdmin.from("stock_movements").insert({
        stock_item_id: req.target_id, type: "wastage", quantity: qty, note: asked, created_by: userId, entered_by: person.id,
      });
      if (error) return { error: "Couldn't record the waste — is the item still there?" };
      await syncAlertState(req.target_id);
      return { ok: true };
    }
    case "stock_count": {
      const qty = Number(p.quantity);
      if (!(qty >= 0)) return { error: "Bad amount" };
      const { data } = await supabaseAdmin.from("stock_items").update({ quantity: qty, counted_at: now, updated_at: now })
        .eq("id", req.target_id).eq("is_active", true).select("id");
      if (!data?.length) return { error: "That stock item is gone" };
      await supabaseAdmin.from("stock_movements").insert({
        stock_item_id: req.target_id, type: "adjustment", quantity: qty, note: `Counted — ${asked}`.slice(0, 200), created_by: userId, entered_by: person.id,
      });
      await syncAlertState(req.target_id);
      return { ok: true };
    }
    case "stock_fix": {
      const qty = Number(p.quantity);
      const { data: m } = await supabaseAdmin.from("stock_movements").select("id, stock_item_id, source, type").eq("id", req.target_id).maybeSingle();
      if (!m || m.source !== "pos" || m.type !== "restock") return { error: "That stock add is gone" };
      const { error } = qty > 0
        ? await supabaseAdmin.from("stock_movements").update({ quantity: qty, note: `Fixed — ${asked}`.slice(0, 200) }).eq("id", m.id)
        : await supabaseAdmin.from("stock_movements").delete().eq("id", m.id);
      if (error) return { error: "Couldn't fix the stock" };
      await syncAlertState(m.stock_item_id);
      return { ok: true };
    }
    default:
      return { error: "Unknown change" };
  }
}

// ── Issues ───────────────────────────────────────────────────────
export async function resolveIssue(id: string, input?: unknown) {
  const { user, person } = await requireAuth();
  if (!uuid.safeParse(id).success) return { error: "Bad issue" };
  const parsed = note.safeParse((input as { resolution?: unknown } | undefined)?.resolution);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the note" };
  const { data } = await supabaseAdmin.from("pos_issues")
    .update({ resolved_at: new Date().toISOString(), resolved_by: person.name, resolution: parsed.data }).eq("id", id).is("resolved_at", null).select("id");
  if (!data?.length) return { error: "Already sorted — refresh" };
  await audit({ actor_id: user.id, action: "POS_ISSUE_RESOLVE", target_table: "pos_issues", target_id: id, new_data: { resolution: parsed.data, person: person.name } });
  refresh();
  return { ok: true };
}

export async function reopenIssue(id: string) {
  const { user, person } = await requireAuth();
  if (!uuid.safeParse(id).success) return { error: "Bad issue" };
  await supabaseAdmin.from("pos_issues").update({ resolved_at: null, resolved_by: null, resolution: null }).eq("id", id);
  await audit({ actor_id: user.id, action: "POS_ISSUE_REOPEN", target_table: "pos_issues", target_id: id, new_data: { person: person.name } });
  refresh();
  return { ok: true };
}
