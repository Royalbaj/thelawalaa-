import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MarkReadButton, MarkAllReadButton } from "@/components/admin/feedback-controls";
import { ASPECTS, RATING_LABELS, VISIT_LABELS, isGoodTag } from "@/lib/feedback";
import { npDateTime } from "@/lib/nepal-time";
import { cn } from "@/lib/utils";
import Stars from "@/components/stars";

export const dynamic = "force-dynamic";

const FILTERS = [["all", "All"], ["new", "New"], ["low", "Unhappy (1–2)"], ["reply", "Wants a reply"]] as const;

type Row = {
  id: string; rating: number; comment: string | null; name: string | null; contact: string | null; order_ref: string | null;
  visit: string | null; is_read: boolean; created_at: string; tags: string[] | null; aspects: Record<string, number> | null;
  recommend: boolean | null; wants_reply: boolean | null;
};

export default async function FeedbackAdminPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireRole(["super_admin"]);
  const show = (await searchParams).show ?? "all";
  let list = supabaseAdmin.from("feedback")
    .select("id, rating, comment, name, contact, order_ref, visit, is_read, created_at, tags, aspects, recommend, wants_reply")
    .order("created_at", { ascending: false }).limit(300);
  if (show === "new") list = list.eq("is_read", false);
  if (show === "low") list = list.lte("rating", 2);
  if (show === "reply") list = list.eq("wants_reply", true);
  const [{ data: items }, { data: all }] = await Promise.all([
    list,
    supabaseAdmin.from("feedback").select("rating, is_read, tags, aspects, recommend, wants_reply"),
  ]);
  const rows = (all ?? []) as Pick<Row, "rating" | "is_read" | "tags" | "aspects" | "recommend" | "wants_reply">[];

  const ratings = rows.map((r) => r.rating);
  const avg = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0;
  const unread = rows.filter((r) => !r.is_read).length;
  const replies = rows.filter((r) => r.wants_reply && !r.is_read).length;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: ratings.filter((r) => r === n).length }));
  const top = Math.max(1, ...dist.map((d) => d.count));

  // The details (each optional), "would recommend", and the most-picked reasons.
  const aspectAvg = ASPECTS.map((a) => {
    const v = rows.map((r) => r.aspects?.[a.key]).filter((x): x is number => typeof x === "number");
    return { ...a, avg: v.length ? v.reduce((s, x) => s + x, 0) / v.length : null, count: v.length };
  });
  const answered = rows.filter((r) => r.recommend != null);
  const recommendShare = answered.length ? answered.filter((r) => r.recommend).length / answered.length : null;
  const tagCounts = new Map<string, number>();
  rows.forEach((r) => (r.tags ?? []).forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)));
  const tagList = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
  const goodTags = tagList.filter(([t]) => isGoodTag(t)).slice(0, 6);
  const badTags = tagList.filter(([t]) => !isGoodTag(t)).slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Average rating</p>
          <p className="mt-1 font-display text-5xl font-bold text-stone-900">{ratings.length ? avg.toFixed(1) : "—"}<span className="text-xl text-stone-400"> / 5</span></p>
          <p className="mt-1 text-sm text-stone-500">{ratings.length} {ratings.length === 1 ? "review" : "reviews"} · {unread} new</p>
          {recommendShare != null && (
            <p className="mt-3 text-sm text-stone-600"><b className="text-stone-900">{Math.round(recommendShare * 100)}%</b> would recommend us <span className="text-stone-400">({answered.length} answered)</span></p>
          )}
          <a href="/feedback" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-bold text-brand-orange">Open the feedback page →</a>
        </div>
        <div className="card p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-400">How people rated us</p>
          <ul className="space-y-2">
            {dist.map((d) => (
              <li key={d.n} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 font-bold text-stone-700">{RATING_LABELS[d.n]}</span>
                <span className="h-2 flex-1 rounded-full bg-stone-100"><span className="block h-2 rounded-full bg-[#2a78d6]" style={{ width: `${(d.count / top) * 100}%` }} /></span>
                <span className="w-8 shrink-0 text-right font-bold tabular-nums text-stone-700">{d.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-400">The details</p>
          <ul className="space-y-2 text-sm">
            {aspectAvg.map((a) => (
              <li key={a.key} className="flex items-center justify-between gap-3">
                <span className="font-bold text-stone-700">{a.label}</span>
                {a.avg == null ? <span className="text-stone-400">—</span> : (
                  <span className="flex items-center gap-2"><Stars value={Math.round(a.avg)} /><b className="tabular-nums text-stone-900">{a.avg.toFixed(1)}</b></span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-400">What people liked</p>
          {goodTags.length ? (
            <ul className="space-y-1.5 text-sm">{goodTags.map(([t, n]) => (
              <li key={t} className="flex justify-between gap-3"><span className="font-bold text-stone-700">{t}</span><span className="tabular-nums text-stone-500">{n}</span></li>
            ))}</ul>
          ) : <p className="text-sm text-stone-400">Nothing picked yet.</p>}
        </div>
        <div className="card p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-400">What went wrong</p>
          {badTags.length ? (
            <ul className="space-y-1.5 text-sm">{badTags.map(([t, n]) => (
              <li key={t} className="flex justify-between gap-3"><span className="font-bold text-stone-700">{t}</span><span className="tabular-nums text-stone-500">{n}</span></li>
            ))}</ul>
          ) : <p className="text-sm text-stone-400">Nothing picked yet.</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([key, label]) => (
            <a key={key} href={`/admin/feedback?show=${key}`}
              className={cn("rounded-full px-4 py-1.5 text-sm font-bold", show === key ? "bg-brand-orange text-white" : "bg-white text-stone-600 ring-1 ring-stone-200")}>
              {label}{key === "new" && unread ? ` (${unread})` : ""}{key === "reply" && replies ? ` (${replies})` : ""}
            </a>
          ))}
        </div>
        {unread > 0 && <MarkAllReadButton />}
      </div>

      <div className="space-y-3">
        {((items ?? []) as Row[]).map((f) => (
          <article key={f.id} className={cn("card p-4", !f.is_read && "ring-2 ring-orange-200", f.rating <= 2 && "border-l-4 border-l-red-400")}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="flex flex-wrap items-center gap-2">
                <Stars value={f.rating} />
                <span className="font-bold text-stone-800">{RATING_LABELS[f.rating]} · {f.rating}/5</span>
                {!f.is_read && <span className="badge bg-orange-100 text-brand-orange">New</span>}
                {f.wants_reply && <span className="badge bg-sky-100 text-sky-800">Wants a reply</span>}
                {f.recommend != null && (
                  <span className={cn("badge", f.recommend ? "bg-green-100 text-green-800" : "bg-stone-100 text-stone-600")}>
                    {f.recommend ? "Would recommend" : "Wouldn't recommend yet"}
                  </span>
                )}
              </p>
              <span className="text-xs text-stone-400">{npDateTime(f.created_at)}</span>
            </div>
            {(f.tags ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(f.tags ?? []).map((t) => (
                  <span key={t} className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", isGoodTag(t) ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800")}>{t}</span>
                ))}
              </div>
            )}
            {f.aspects && Object.keys(f.aspects).length > 0 && (
              <p className="mt-2 text-xs text-stone-500">
                {ASPECTS.filter((a) => f.aspects?.[a.key]).map((a) => `${a.label} ${f.aspects?.[a.key]}/5`).join(" · ")}
              </p>
            )}
            {f.comment && <p className="mt-2 whitespace-pre-line text-sm text-stone-700">{f.comment}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-stone-500">
                {[f.name, f.contact, f.visit && VISIT_LABELS[f.visit], f.order_ref && `Order ${f.order_ref}`].filter(Boolean).join(" · ") || "No contact details"}
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
