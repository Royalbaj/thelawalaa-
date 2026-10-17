"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Briefcase, CheckCircle2, FileText, Paperclip, Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { applyForJob, createCvUpload } from "@/app/actions/careers";
import { ANY_ROLE, AVAILABILITY, CV_TYPES, EXPERIENCE, JOB_TYPES, MAX_CV_MB, ROLE_IDEAS, type JobType } from "@/lib/careers";
import { npDate } from "@/lib/nepal-time";
import { cn } from "@/lib/utils";

export type Listing = {
  id: string; title: string; job_type: JobType; description: string | null; requirements: string | null;
  pay: string | null; openings: number; closes_on: string | null;
};
type Text = { noneTitle: string; noneText: string; formTitle: string; privacy: string };

const chip = (on: boolean) => cn("rounded-full px-3.5 py-2 text-sm font-bold ring-1 transition active:scale-95",
  on ? "bg-brand-brown text-white ring-brand-brown dark:bg-orange-500 dark:ring-orange-500"
    : "bg-white text-stone-600 ring-stone-200 hover:bg-stone-50 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700");

/** A job's requirements: one per line ("- " optional) → bullets. */
const lines = (text: string | null) => (text ?? "").split("\n").map((l) => l.replace(/^\s*[-•]\s*/, "").trim()).filter(Boolean);

/**
 * /careers: the open jobs (Admin → Careers), then one form — for a listed job
 * or, with nothing open (or nothing that fits), a CV kept on file for any role.
 */
export default function CareersBoard({ listings, text }: { listings: Listing[]; text: Text }) {
  const [jobId, setJobId] = useState<string>(listings[0]?.id ?? ANY_ROLE);
  const [wanted, setWanted] = useState("");
  const [cv, setCv] = useState<File | null>(null);
  const [sent, setSent] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyFor = (id: string) => {
    setJobId(id);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const pickCv = (file: File | undefined) => {
    if (!file) return;
    if (!CV_TYPES[file.type]) { toast.error("Send your CV as a PDF, Word file or a photo"); return; }
    if (file.size > MAX_CV_MB * 1024 * 1024) { toast.error(`That file is too big — up to ${MAX_CV_MB} MB`); return; }
    setCv(file);
  };

  const submit = (form: HTMLFormElement) => start(async () => {
    const fd = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const anyRole = jobId === ANY_ROLE;
    if (anyRole && !wanted.trim()) { toast.error("Say what kind of work you'd like"); return; }
    try {
      let cv_path: string | undefined;
      if (cv) {
        setStep("Uploading your CV…");
        const slot = await createCvUpload({ type: cv.type, size: cv.size });
        if (slot.error || !slot.token || !slot.uploadPath || !slot.path) { toast.error(slot.error ?? "Couldn't start the upload — try again"); return; }
        const { error } = await createClient().storage.from("cvs").uploadToSignedUrl(slot.uploadPath, slot.token, cv, { contentType: cv.type });
        if (error) { toast.error("Your CV didn't upload — check the connection and try again"); return; }
        cv_path = slot.path;
      }
      setStep("Sending…");
      const r = await applyForJob({
        ...fd, listing_id: anyRole ? undefined : jobId, position: anyRole ? wanted : undefined,
        cv_path, cv_name: cv?.name.slice(0, 120),
      });
      if (r?.error) { toast.error(r.error); return; }
      setSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setStep(null);
    }
  });

  if (sent) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <CheckCircle2 size={48} className="mx-auto text-brand-green" />
        <h2 className="mt-3 font-display text-2xl font-bold text-brand-brown dark:text-orange-50">Thank you — we&apos;ve got it</h2>
        <p className="mt-2 text-stone-600 dark:text-stone-300">We read every application. If it&apos;s a fit, we&apos;ll call you on the number you gave.</p>
        <Link href="/" className="btn-primary mt-6">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Open jobs */}
      <section aria-labelledby="open-jobs">
        <h2 id="open-jobs" className="mb-4 font-display text-2xl font-bold text-brand-brown dark:text-orange-50">
          {listings.length ? `Open jobs (${listings.length})` : text.noneTitle}
        </h2>
        {listings.length === 0 ? (
          <div className="card border-l-4 border-l-brand-orange p-5">
            <p className="text-stone-700 dark:text-stone-300">{text.noneText}</p>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {listings.map((j) => (
              <li key={j.id} className="card flex flex-col p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-brand-orange dark:bg-orange-500/15 dark:text-orange-300">{JOB_TYPES[j.job_type]}</span>
                  {j.openings > 1 && <span className="text-xs font-bold text-stone-500 dark:text-stone-400">{j.openings} people needed</span>}
                </div>
                <h3 className="mt-2 font-display text-xl font-bold text-brand-brown dark:text-orange-50">{j.title}</h3>
                {j.pay && <p className="mt-0.5 text-sm font-bold text-stone-700 dark:text-stone-200">{j.pay}</p>}
                {j.description && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-600 dark:text-stone-300">{j.description}</p>}
                {lines(j.requirements).length > 0 && (
                  <ul className="mt-3 space-y-1.5 text-sm text-stone-600 dark:text-stone-300">
                    {lines(j.requirements).map((l) => (
                      <li key={l} className="flex gap-2.5"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" />{l}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                  <span className="text-xs text-stone-400">{j.closes_on ? `Apply by ${npDate(`${j.closes_on}T12:00:00+05:45`)}` : ""}</span>
                  <button type="button" onClick={() => applyFor(j.id)} className="btn-primary !px-5 !py-2.5 text-sm">Apply for this job</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The form */}
      <section aria-labelledby="apply" className="scroll-mt-24">
        <form ref={formRef} className="card mx-auto max-w-3xl scroll-mt-24 space-y-6 p-5 sm:p-8" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }}>
          <div>
            <h2 id="apply" className="font-display text-2xl font-bold text-brand-brown dark:text-orange-50">{text.formTitle}</h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Fields with <span className="text-brand-red">*</span> are needed. Takes two minutes.</p>
          </div>

          <fieldset>
            <legend className="label">Which job? <span className="text-brand-red">*</span></legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {listings.map((j) => (
                <button key={j.id} type="button" aria-pressed={jobId === j.id} onClick={() => setJobId(j.id)} className={cn(chip(jobId === j.id), "flex items-center gap-1.5")}>
                  <Briefcase size={14} aria-hidden /> {j.title}
                </button>
              ))}
              <button type="button" aria-pressed={jobId === ANY_ROLE} onClick={() => setJobId(ANY_ROLE)} className={chip(jobId === ANY_ROLE)}>
                {listings.length ? "Something else — keep my CV" : "Any job — keep my CV"}
              </button>
            </div>
            {jobId === ANY_ROLE && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {ROLE_IDEAS.map((r) => (
                    <button key={r} type="button" aria-pressed={wanted === r} onClick={() => setWanted(wanted === r ? "" : r)} className={chip(wanted === r)}>{r}</button>
                  ))}
                </div>
                <input value={wanted} onChange={(e) => setWanted(e.target.value)} maxLength={80} className="input"
                  placeholder="Or type the kind of work you'd like" aria-label="The kind of work you'd like" />
              </div>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Your full name <span className="text-brand-red">*</span></span>
              <input name="name" required minLength={2} maxLength={80} autoComplete="name" className="input" />
            </label>
            <label className="block">
              <span className="label">Mobile number <span className="text-brand-red">*</span></span>
              <input name="phone" required type="tel" inputMode="tel" autoComplete="tel" maxLength={16} placeholder="98XXXXXXXX" className="input" />
            </label>
            <label className="block">
              <span className="label">Email <span className="font-normal text-stone-400">(optional)</span></span>
              <input name="email" type="email" inputMode="email" autoComplete="email" maxLength={120} className="input" />
            </label>
            <label className="block">
              <span className="label">Experience</span>
              <select name="experience" defaultValue="" className="input">
                <option value="">Choose…</option>
                {EXPERIENCE.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="label">When can you work?</span>
              <select name="availability" defaultValue="" className="input">
                <option value="">Choose…</option>
                {AVAILABILITY.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="label">About you <span className="font-normal text-stone-400">(optional)</span></span>
            <textarea name="message" rows={4} maxLength={2000} className="input"
              placeholder="Where you've worked, what you're good at, anything we should know" />
          </label>

          {/* CV — optional, so nobody is turned away for not having one */}
          <div>
            <span className="label">Your CV <span className="font-normal text-stone-400">(optional — PDF, Word or a photo, up to {MAX_CV_MB} MB)</span></span>
            {cv ? (
              <div className="flex items-center gap-3 rounded-xl bg-stone-50 px-3 py-2.5 dark:bg-stone-800/60">
                <FileText size={18} className="shrink-0 text-brand-orange" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-stone-700 dark:text-stone-200">{cv.name}</span>
                <span className="shrink-0 text-xs text-stone-400">{(cv.size / 1024 / 1024).toFixed(1)} MB</span>
                <button type="button" onClick={() => setCv(null)} aria-label="Remove the CV" className="rounded-full p-1 text-stone-400 hover:text-brand-red"><X size={16} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 px-4 py-4 text-sm font-bold text-stone-600 transition hover:border-brand-orange hover:text-brand-orange dark:border-stone-700 dark:text-stone-300">
                <Paperclip size={16} aria-hidden /> Attach your CV
              </button>
            )}
            <input ref={fileRef} type="file" className="hidden" accept={Object.keys(CV_TYPES).join(",")}
              onChange={(e) => { pickCv(e.target.files?.[0]); e.target.value = ""; }} />
          </div>

          {/* Honeypot: hidden from people, irresistible to bots */}
          <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

          <div>
            <button disabled={pending} className="btn-primary w-full text-lg">
              <Send size={18} aria-hidden /> {step ?? (pending ? "Sending…" : "Send application")}
            </button>
            <p className="mt-2 text-center text-xs text-stone-400">{text.privacy}</p>
          </div>
        </form>
      </section>
    </div>
  );
}
