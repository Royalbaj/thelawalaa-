"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteApplication, deleteJobListing, saveJobListing, updateApplication } from "@/app/actions/careers";
import { APPLICATION_STATUS, JOB_TYPES, type ApplicationStatus, type JobType } from "@/lib/careers";
import { cn } from "@/lib/utils";

export type AdminJob = {
  id: string; title: string; job_type: JobType; description: string | null; requirements: string | null;
  pay: string | null; openings: number; closes_on: string | null; is_open: boolean;
};

/** Add or edit a job (Admin → Careers → Jobs). */
export function JobForm({ job, onDone }: { job?: AdminJob; onDone?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(job?.is_open ?? true);
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = Object.fromEntries(new FormData(form));
      start(async () => {
        const r = await saveJobListing(job?.id ?? null, { ...fd, is_open: open });
        if (r?.error) { toast.error(r.error); return; }
        toast.success(job ? "Job saved" : open ? "Job added — it's on the careers page now" : "Job saved (closed)");
        if (!job) form.reset();
        onDone?.();
        router.refresh();
      });
    }}>
      <label className="sm:col-span-2">
        <span className="label">Job title</span>
        <input name="title" defaultValue={job?.title} required maxLength={80} placeholder="e.g. Kitchen helper" className="input" />
      </label>
      <label>
        <span className="label">Type</span>
        <select name="job_type" defaultValue={job?.job_type ?? "full_time"} className="input">
          {Object.entries(JOB_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label>
        <span className="label">Pay <span className="font-normal text-stone-400">(optional)</span></span>
        <input name="pay" defaultValue={job?.pay ?? ""} maxLength={80} placeholder="e.g. Rs 15,000 a month + meals" className="input" />
      </label>
      <label>
        <span className="label">People needed</span>
        <input name="openings" type="number" min={1} max={50} defaultValue={job?.openings ?? 1} className="input" />
      </label>
      <label>
        <span className="label">Apply by <span className="font-normal text-stone-400">(optional)</span></span>
        <input name="closes_on" type="date" defaultValue={job?.closes_on ?? ""} className="input" />
      </label>
      <label className="sm:col-span-2">
        <span className="label">About the job</span>
        <textarea name="description" defaultValue={job?.description ?? ""} rows={3} maxLength={3000} className="input"
          placeholder="What they'll do, the hours, where" />
      </label>
      <label className="sm:col-span-2">
        <span className="label">What we&apos;re looking for <span className="font-normal text-stone-400">(one per line)</span></span>
        <textarea name="requirements" defaultValue={job?.requirements ?? ""} rows={3} maxLength={2000} className="input"
          placeholder={"Friendly with customers\nCan work weekends"} />
      </label>
      <label className="flex items-center gap-2 text-sm font-bold text-stone-700 sm:col-span-2">
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} className="h-4 w-4 accent-[#f97316]" />
        Open — show it on the careers page
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button disabled={pending} className="btn-primary !py-2.5">{pending ? "Saving…" : job ? "Save job" : <><Plus size={16} /> Add job</>}</button>
        {onDone && <button type="button" onClick={onDone} className="rounded-full px-4 py-2.5 text-sm font-bold text-stone-500 hover:bg-stone-100">Cancel</button>}
      </div>
    </form>
  );
}

/** One job in the list: edit, open/close, delete. */
export function JobRow({ job, applications }: { job: AdminJob; applications: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string } | { ok: boolean } | undefined>, done: string) => start(async () => {
    const r = await fn();
    if (r && "error" in r && r.error) toast.error(r.error); else { toast.success(done); router.refresh(); }
  });
  if (editing) return <li className="card p-5"><JobForm job={job} onDone={() => setEditing(false)} /></li>;
  return (
    <li className={cn("card flex flex-wrap items-center gap-3 p-4", !job.is_open && "opacity-70")}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <b className="text-stone-900">{job.title}</b>
          <span className={cn("badge", job.is_open ? "bg-green-100 text-green-800" : "bg-stone-100 text-stone-600")}>{job.is_open ? "Open" : "Closed"}</span>
        </p>
        <p className="text-xs text-stone-500">
          {JOB_TYPES[job.job_type]}{job.pay ? ` · ${job.pay}` : ""} · {job.openings} needed · {applications} {applications === 1 ? "application" : "applications"}
          {job.closes_on ? ` · apply by ${job.closes_on}` : ""}
        </p>
      </div>
      <button disabled={pending} onClick={() => run(() => saveJobListing(job.id, { ...job, description: job.description ?? "", requirements: job.requirements ?? "", pay: job.pay ?? "", closes_on: job.closes_on ?? "", is_open: !job.is_open }),
        job.is_open ? "Closed — it's off the careers page" : "Open again")}
        className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-200">
        {job.is_open ? "Close" : "Open"}
      </button>
      <button onClick={() => setEditing(true)} aria-label={`Edit ${job.title}`} className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-brand-orange"><Pencil size={16} /></button>
      <button disabled={pending} aria-label={`Delete ${job.title}`}
        onClick={() => confirm(`Delete "${job.title}"? Its applications stay.`) && run(() => deleteJobListing(job.id), "Job deleted")}
        className="rounded-full p-2 text-stone-400 hover:bg-red-50 hover:text-brand-red"><Trash2 size={16} /></button>
    </li>
  );
}

/** An application's status, the admin's own note, and delete. */
export function ApplicationControls({ id, status, note, name }: { id: string; status: ApplicationStatus; note: string | null; name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [text, setText] = useState(note ?? "");
  const [pending, start] = useTransition();
  const save = (patch: { status?: ApplicationStatus; admin_note?: string }, done: string) => start(async () => {
    const r = await updateApplication(id, patch);
    if (r?.error) toast.error(r.error); else { toast.success(done); router.refresh(); }
  });
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <select value={value} disabled={pending} aria-label={`Status for ${name}`}
        onChange={(e) => { const s = e.target.value as ApplicationStatus; setValue(s); save({ status: s }, `Marked ${APPLICATION_STATUS[s].toLowerCase()}`); }}
        className="input !py-2 text-sm">
        {Object.entries(APPLICATION_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); save({ admin_note: text }, "Note saved"); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Your note (only admins see it)" className="input !py-2 text-sm" />
        {text !== (note ?? "") && <button disabled={pending} className="shrink-0 rounded-full bg-brand-orange px-3 text-xs font-bold text-white">Save</button>}
      </form>
      <button disabled={pending} aria-label={`Delete ${name}'s application`}
        onClick={() => confirm(`Delete ${name}'s application and CV? This can't be undone.`) && start(async () => {
          const r = await deleteApplication(id);
          if (r?.error) toast.error(r.error); else { toast.success("Deleted"); router.refresh(); }
        })}
        className="justify-self-end rounded-full p-2 text-stone-400 hover:bg-red-50 hover:text-brand-red"><Trash2 size={16} /></button>
    </div>
  );
}
