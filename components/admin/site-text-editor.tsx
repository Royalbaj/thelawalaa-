"use client";
import { useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ExternalLink, RotateCcw, Save } from "lucide-react";
import { saveSiteText } from "@/app/actions/site-content";
import VideoUpload from "@/components/admin/video-upload";
import { cn } from "@/lib/utils";

type Field = { key: string; label: string; default: string; max: number; multiline?: boolean; hint?: string; ne?: string; neMax?: number };
type Section = { id: string; title: string; where: string; fields: readonly Field[] };
type Input = { key: string; default: string; max: number; multiline?: boolean };

// A field's Nepali version (the /ne homepage) is saved as "ne.<key>" — see lib/site-content.ts.
const neInput = (f: Field): Input => ({ key: `ne.${f.key}`, default: f.ne ?? "", max: f.neMax ?? f.max, multiline: f.multiline });

/** Admin → Website text: every editable bit of wording, grouped the way it appears on the site. */
export default function SiteTextEditor({ sections, saved }: { sections: readonly Section[]; saved: Record<string, string> }) {
  const inputs = useMemo(() => sections.flatMap((s) => s.fields.flatMap((f): Input[] => f.ne != null ? [f, neInput(f)] : [f])), [sections]);
  const initial = useMemo(() => Object.fromEntries(inputs.map((f) => [f.key, saved[f.key] ?? f.default])), [inputs, saved]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [base, setBase] = useState<Record<string, string>>(initial);
  const [pending, start] = useTransition();

  const dirty = inputs.filter((f) => values[f.key] !== base[f.key]).length;
  const set = (key: string, v: string) => setValues((cur) => ({ ...cur, [key]: v }));

  const save = () => start(async () => {
    const r = await saveSiteText(values);
    if (r?.error) { toast.error(r.error); return; }
    setBase(values);
    toast.success("Saved — the website shows it now");
  });

  const box = (f: Input, id: string, label: React.ReactNode, hint?: string, nepali = false) => {
    const value = values[f.key] ?? "";
    const isDefault = value.trim() === f.default;
    const Tag = f.multiline ? "textarea" : "input";
    return (
      <div className={cn(nepali && "mt-2 border-l-2 border-orange-200 pl-3")}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor={id} className={cn("text-sm font-bold", nepali ? "text-stone-500" : "text-stone-700")}>{label}</label>
          {!isDefault && (
            <span className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-brand-orange">Changed</span>
              <button type="button" onClick={() => set(f.key, f.default)} className="flex items-center gap-1 text-xs font-bold text-stone-500 hover:text-brand-orange">
                <RotateCcw size={12} /> Reset
              </button>
            </span>
          )}
        </div>
        <Tag
          id={id}
          lang={nepali ? "ne" : undefined}
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(f.key, e.target.value)}
          maxLength={f.max}
          rows={f.multiline ? Math.min(5, Math.max(2, Math.ceil(f.default.length / 60))) : undefined}
          inputMode={f.key === "contact.whatsapp" ? "numeric" : undefined}
          placeholder={f.default}
          className={cn("input", !isDefault && "border-brand-orange/60")}
        />
        <div className="mt-1 flex justify-between gap-3 text-[11px] text-stone-400">
          <span>{hint}</span>
          {f.max > 60 && <span className="shrink-0 tabular-nums">{value.length}/{f.max}</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-24">
      <div className="card p-4 text-sm text-stone-600">
        Change any wording on the website here, then press <b>Save</b>. Each field starts with what the site says today;
        <b> Reset</b> puts the original back. Menu items, prices and FAQs have their own pages.
        <span className="mt-2 block">
          Homepage lines also have a <b>Nepali</b> box — that&apos;s what the Nepali homepage (thelawalaa.com/ne) shows.
          If you change the English, change the Nepali too.
        </span>
      </div>

      {/* Jump to a section */}
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {sections.map((s) => (
          <a key={s.id} href={`#text-${s.id}`} className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-stone-600 ring-1 ring-stone-200 hover:bg-orange-50">
            {s.title}
          </a>
        ))}
      </div>

      {sections.map((s) => (
        <section key={s.id} id={`text-${s.id}`} className="card scroll-mt-20 space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-brand-brown">{s.title}</h2>
            <span className="flex shrink-0 items-center gap-3">
              {s.fields.some((f) => f.ne != null) && s.where.startsWith("/#") && (
                <a href={`/ne${s.where.slice(1)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-bold text-brand-orange">
                  Nepali page <ExternalLink size={12} />
                </a>
              )}
              <a href={s.where} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-bold text-brand-orange">
                See it on the site <ExternalLink size={12} />
              </a>
            </span>
          </div>
          {s.fields.map((f) => (
            <div key={f.key}>
              {box(f, f.key, f.label, f.hint)}
              {f.ne != null && box(neInput(f), `ne.${f.key}`, "Nepali", undefined, true)}
              {f.key === "order.video" && (
                <VideoUpload onUploaded={(video, poster) => { set("order.video", video); set("order.video_poster", poster); }} />
              )}
            </div>
          ))}
        </section>
      ))}

      {/* Save bar — above the phone tab bar */}
      <div className={cn("fixed inset-x-3 bottom-28 z-30 transition lg:bottom-6 lg:left-auto lg:right-8 lg:w-auto",
        dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0")}>
        <div className="flex items-center gap-3 rounded-2xl bg-brand-dark p-2 pl-4 text-sm text-white shadow-2xl">
          <span className="flex-1 font-bold">{dirty} unsaved {dirty === 1 ? "change" : "changes"}</span>
          <button type="button" onClick={() => setValues(base)} disabled={pending} className="rounded-xl px-3 py-2 font-bold text-white/70 hover:text-white">Undo</button>
          <button type="button" onClick={save} disabled={pending} className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2 font-bold disabled:opacity-60">
            <Save size={15} /> {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
