import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCategories } from "@/lib/ledger";
import { nepalToday, longDate } from "@/lib/dates";
import EntryForm, { type EditableEntry } from "@/components/entry-form";

export const dynamic = "force-dynamic";

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ data: entry }, categories] = await Promise.all([
    supabaseAdmin.from("account_transactions")
      .select("id, kind, amount, category_id, description, occurred_on, method, bill_path, created_at, updated_at, creator:profiles!account_transactions_created_by_fkey(full_name), editor:profiles!account_transactions_updated_by_fkey(full_name)")
      .eq("id", id).single(),
    getCategories(),
  ]);
  if (!entry) notFound();
  const who = (p: unknown) => (p as { full_name?: string } | null)?.full_name ?? "someone";
  const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/entries" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-stone-500"><ChevronLeft size={16} /> Entries</Link>
      <h1 className="font-display text-2xl font-bold text-brand-brown">Edit entry</h1>
      <p className="mb-4 text-xs text-stone-400">
        For {longDate(entry.occurred_on)} · added by {who(entry.creator)} on {when(entry.created_at)}
        {entry.updated_at && <> · last changed by {who(entry.editor)} on {when(entry.updated_at)}</>}
      </p>
      <EntryForm categories={categories} entry={{ ...entry, amount: Number(entry.amount) } as EditableEntry}
        defaultKind={entry.kind as "in" | "out"} today={nepalToday()} back="/entries" />
    </div>
  );
}
