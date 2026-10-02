import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAuth } from "@/lib/supabase/server";
import { getCategories } from "@/lib/ledger";
import { nepalToday } from "@/lib/dates";
import EntryForm from "@/components/entry-form";

export const dynamic = "force-dynamic";

const safeBack = (b?: string) => (b && b.startsWith("/") && !b.startsWith("//") ? b : "/entries");

export default async function NewEntryPage({ searchParams }: { searchParams: Promise<{ kind?: string; back?: string }> }) {
  await requireAuth();
  const sp = await searchParams;
  const kind = sp.kind === "in" ? "in" : "out";
  const categories = await getCategories();
  const back = safeBack(sp.back);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href={back} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-stone-500"><ChevronLeft size={16} /> Back</Link>
      <h1 className="mb-4 font-display text-2xl font-bold text-brand-brown">New entry</h1>
      <EntryForm categories={categories} defaultKind={kind} today={nepalToday()} back={back} />
    </div>
  );
}
