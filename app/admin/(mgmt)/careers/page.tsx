import Link from "next/link";
import { FileText, Mail, Phone } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { APPLICATION_STATUS, type ApplicationStatus } from "@/lib/careers";
import { npDateTime } from "@/lib/nepal-time";
import { ApplicationControls, JobForm, JobRow, type AdminJob } from "@/components/admin/careers-admin";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Application = {
  id: string; listing_id: string | null; position: string; name: string; phone: string; email: string | null;
  experience: string | null; availability: string | null; message: string | null; cv_path: string | null; cv_name: string | null;
  status: ApplicationStatus; admin_note: string | null; created_at: string;
};

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  new: "bg-orange-100 text-brand-orange", shortlisted: "bg-sky-100 text-sky-800", interview: "bg-violet-100 text-violet-800",
  hired: "bg-green-100 text-green-800", rejected: "bg-stone-100 text-stone-600",
};

/**
 * Admin → Careers: everyone who applied (CVs open through a 2-minute private
 * link), and the jobs shown on /careers. "CVs on file" counts the people
 * still in the running by the kind of job they want — who to call before
 * advertising when someone is needed.
 */
export default async function CareersAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string; role?: string }> }) {
  await requireRole(["super_admin"]);
  const sp = await searchParams;
  const tab = sp.tab === "jobs" ? "jobs" : "applications";
  const status = sp.status && sp.status in APPLICATION_STATUS ? (sp.status as ApplicationStatus) : null;

  const [{ data: jobs }, { data: apps }] = await Promise.all([
    supabaseAdmin.from("job_listings").select("id, title, job_type, description, requirements, pay, openings, closes_on, is_open")
      .order("is_open", { ascending: false }).order("created_at", { ascending: false }),
    supabaseAdmin.from("job_applications")
      .select("id, listing_id, position, name, phone, email, experience, availability, message, cv_path, cv_name, status, admin_note, created_at")
      .order("created_at", { ascending: false }).limit(500),
  ]);
  const all = (apps ?? []) as Application[];
  const listings = (jobs ?? []) as AdminJob[];
  const inRunning = all.filter((a) => a.status !== "rejected" && a.status !== "hired");
  const byRole = [...inRunning.reduce((m, a) => m.set(a.position, (m.get(a.position) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]);
  const shown = all.filter((a) => (!status || a.status === status) && (!sp.role || a.position === sp.role));
  const perJob = new Map<string, number>();
  all.forEach((a) => a.listing_id && perJob.set(a.listing_id, (perJob.get(a.listing_id) ?? 0) + 1));
  const href = (p: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ tab, status: status ?? undefined, role: sp.role, ...p }).filter(([, v]) => v) as [string, string][]);
    return `/admin/careers${q.size ? `?${q}` : ""}`;
  };

  const tiles = [
    { label: "New applications", value: all.filter((a) => a.status === "new").length },
    { label: "In the running", value: inRunning.length },
    { label: "With a CV", value: inRunning.filter((a) => a.cv_path).length },
    { label: "Open jobs", value: listings.filter((j) => j.is_open).length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-brand-brown">Careers</h1>
          <p className="text-sm text-stone-500">Applications and CVs from the careers page, and the jobs it shows.</p>
        </div>
        <a href="/careers" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-brand-orange">Open the careers page →</a>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card p-4">
            <p className="text-xs font-bold text-stone-500">{t.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-stone-900">{t.value}</p>
          </div>
        ))}
      </div>

      <nav className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-stone-200 sm:w-fit">
        {([["applications", `Applications (${all.length})`], ["jobs", `Jobs (${listings.length})`]] as const).map(([key, label]) => (
          <Link key={key} href={`/admin/careers${key === "jobs" ? "?tab=jobs" : ""}`}
            className={cn("flex-1 rounded-full px-4 py-1.5 text-center text-sm font-bold sm:flex-none", tab === key ? "bg-brand-orange text-white" : "text-stone-600")}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === "applications" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Link href={href({ status: undefined })} className={cn("rounded-full px-3.5 py-1.5 text-sm font-bold", !status ? "bg-brand-brown text-white" : "bg-white text-stone-600 ring-1 ring-stone-200")}>All</Link>
              {Object.entries(APPLICATION_STATUS).map(([k, v]) => (
                <Link key={k} href={href({ status: k })}
                  className={cn("rounded-full px-3.5 py-1.5 text-sm font-bold", status === k ? "bg-brand-brown text-white" : "bg-white text-stone-600 ring-1 ring-stone-200")}>
                  {v} ({all.filter((a) => a.status === k).length})
                </Link>
              ))}
              {sp.role && <Link href={href({ role: undefined })} className="rounded-full bg-orange-50 px-3.5 py-1.5 text-sm font-bold text-brand-orange">{sp.role} ✕</Link>}
            </div>

            {shown.map((a) => (
              <article key={a.id} className={cn("card p-4", a.status === "new" && "ring-2 ring-orange-200")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="flex flex-wrap items-center gap-2">
                      <b className="text-lg text-stone-900">{a.name}</b>
                      <span className={cn("badge", STATUS_BADGE[a.status])}>{APPLICATION_STATUS[a.status]}</span>
                    </p>
                    <p className="text-sm font-bold text-brand-brown">{a.position}{a.listing_id ? "" : <span className="font-normal text-stone-400"> · CV on file</span>}</p>
                  </div>
                  <span className="text-xs text-stone-400">{npDateTime(a.created_at)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 font-bold text-stone-700 hover:bg-stone-200"><Phone size={14} /> {a.phone}</a>
                  {a.email && <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 font-bold text-stone-700 hover:bg-stone-200"><Mail size={14} /> {a.email}</a>}
                  {a.cv_path
                    ? <a href={`/admin/careers/cv/${a.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-brand-orange px-3 py-1.5 font-bold text-white hover:brightness-110"><FileText size={14} /> Open CV</a>
                    : <span className="inline-flex items-center rounded-full px-3 py-1.5 text-stone-400">No CV attached</span>}
                </div>
                {(a.experience || a.availability) && (
                  <p className="mt-2 text-xs text-stone-500">{[a.experience, a.availability].filter(Boolean).join(" · ")}</p>
                )}
                {a.message && <p className="mt-2 whitespace-pre-line text-sm text-stone-700">{a.message}</p>}
                <ApplicationControls id={a.id} status={a.status} note={a.admin_note} name={a.name} />
              </article>
            ))}
            {shown.length === 0 && (
              <div className="card px-4 py-12 text-center text-stone-500">
                {all.length ? "Nothing here." : "No applications yet — the careers page is at thelawalaa.com/careers (it's in the website footer)."}
              </div>
            )}
          </div>

          <aside className="card h-fit p-5">
            <h2 className="font-bold text-brand-brown">CVs on file</h2>
            <p className="mb-3 text-xs text-stone-500">People still in the running, by the job they want — call them first when you need someone.</p>
            {byRole.length ? (
              <ul className="space-y-1.5 text-sm">
                {byRole.map(([role, n]) => (
                  <li key={role}>
                    <Link href={href({ role, status: undefined })} className="flex justify-between gap-3 rounded-lg px-2 py-1 hover:bg-stone-50">
                      <span className="truncate font-bold text-stone-700">{role}</span><span className="tabular-nums text-stone-500">{n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-stone-400">None yet.</p>}
          </aside>
        </div>
      ) : (
        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="mb-3 font-bold text-brand-brown">Add a job</h2>
            <JobForm />
            <p className="mt-3 text-xs text-stone-500">With no job open, the careers page still takes CVs for any role.</p>
          </section>
          <ul className="space-y-3">
            {listings.map((j) => <JobRow key={j.id} job={j} applications={perJob.get(j.id) ?? 0} />)}
          </ul>
          {listings.length === 0 && <p className="text-center text-sm text-stone-400">No jobs yet.</p>}
        </div>
      )}
    </div>
  );
}
