import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MarkReadButton, MarkAllReadButton } from "@/components/admin/feedback-controls";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FACES = ["", "😞", "😕", "😐", "🙂", "😍"];
const LABELS = ["", "Terrible", "Not good", "Okay", "Good", "Loved it"];
const VISIT: Record<string, string> = { dine_in: "Ate here", pickup: "Picked up", delivery: "Delivery" };
const FILTERS = [["all", "All"], ["new", "New"], ["low", "Unhappy (1–2)"]] as const;
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

export default async function FeedbackAdminPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireRole(["super_admin"]);
  const show = (await searchParams).show ?? "all";
  let list = supabaseAdmin.from("feedback")
    .select("id, rating, comment, name, contact, order_ref, visit, is_read, created_at")
    .order("created_at", { ascending: false }).limit(300);
  if (show === "new") list = list.eq("is_read", false);
  if (show === "low") list = list.lte("rating", 2);
  const [{ data: items }, { data: all }] = await Promise.all([
    list,
    supabaseAdmin.from("feedback").select("rating, is_read"),
  ]);

  const ratings = (all ?? []).map((r) => r.rating as number);
  const avg = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0;
  const unread = (all ?? []).filter((r) => !r.is_read).length;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: ratings.filter((r) => r === n).length }));
  const top = Math.max(1, ...dist.map((d) => d.count));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Average rating</p>
          <p className="mt-1 font-display text-5xl font-bold text-stone-900">{ratings.length ? avg.toFixed(1) : "—"}<span className="text-xl text-stone-400"> / 5</span></p>
          <p className="mt-1 text-sm text-stone-500">{ratings.length} {ratings.length === 1 ? "review" : "reviews"} · {unread} new</p>
          <a href="/feedback" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-bold text-brand-orange">Open the feedback page →</a>
        </div>
        <div className="card p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-400">How people rated us</p>
          <ul className="space-y-2">
            {dist.map((d) => (
              <li key={d.n} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 font-bold text-stone-700"><span aria-hidden>{FACES[d.n]}</span> {LABELS[d.n]}</span>
                <span className="h-2 flex-1 rounded-full bg-stone-100"><span className="block h-2 rounded-full bg-[#2a78d6]" style={{ width: `${(d.count / top) * 100}%` }} /></span>
                <span className="w-8 shrink-0 text-right font-bold tabular-nums text-stone-700">{d.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([key, label]) => (
            <a key={key} href={`/admin/feedback?show=${key}`}
              className={cn("rounded-full px-4 py-1.5 text-sm font-bold", show === key ? "bg-brand-orange text-white" : "bg-white text-stone-600 ring-1 ring-stone-200")}>
              {label}{key === "new" && unread ? ` (${unread})` : ""}
            </a>
          ))}
        </div>
        {unread > 0 && <MarkAllReadButton />}
      </div>

      <div className="space-y-3">
        {(items ?? []).map((f) => (
          <article key={f.id} className={cn("card p-4", !f.is_read && "ring-2 ring-orange-200", f.rating <= 2 && "border-l-4 border-l-red-400")}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden>{FACES[f.rating]}</span>
                <span className="font-bold text-stone-800">{LABELS[f.rating]} · {f.rating}/5</span>
                {!f.is_read && <span className="badge bg-orange-100 text-brand-orange">New</span>}
              </p>
              <span className="text-xs text-stone-400">{when(f.created_at)}</span>
            </div>
            {f.comment && <p className="mt-2 whitespace-pre-line text-sm text-stone-700">{f.comment}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-stone-500">
                {[f.name, f.contact, f.visit && VISIT[f.visit], f.order_ref && `Order ${f.order_ref}`].filter(Boolean).join(" · ") || "No contact details"}
              </p>
              {!f.is_read && <MarkReadButton id={f.id} />}
            </div>
          </article>
        ))}
        {(items ?? []).length === 0 && (
          <div className="card px-4 py-12 text-center text-stone-500">
            {show === "all" ? "No feedback yet — share thelawalaa.com/feedback with customers (a QR on the counter works well)." : "Nothing here."}
          </div>
        )}
      </div>
    </div>
  );
}
