"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, Plus, Send, UserRound, Users, X } from "lucide-react";
import { previewCompanyEmail, sendCompanyEmail } from "@/app/actions/company-email";
import { BLANK, MAX_RECIPIENTS, STARTERS, type EmailDraft } from "@/lib/company-email-templates";
import { cn } from "@/lib/utils";

export type Recipient = { email: string; name: string | null };
export type RecipientGroup = { id: string; label: string; hint: string; people: Recipient[] };
/** Answering an email from the Inbox. */
export type ReplyTo = { inboxId: string; to: Recipient; subject: string; quote: string; when: string };

const reSubject = (s: string) => (/^re:/i.test(s.trim()) ? s.trim() : `Re: ${s.trim() || "your email"}`).slice(0, 150);
/** The heading inside a reply: their subject without the "Re: Fwd:" in front. */
const replyHeading = (s: string) => s.replace(/^\s*((re|fwd?|aw)\s*:\s*)+/i, "").trim().slice(0, 120);

const EMAIL = /^[^\s@<>(),;]+@[^\s@<>(),;]+\.[^\s@<>(),;]+$/;

/** "Sita <sita@x.com>, ram@y.com; …" → people (name when given). Anything that isn't an address is returned too. */
function parseAddresses(text: string) {
  const found: Recipient[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)) {
    const m = /^(.*?)\s*<([^>]+)>$/.exec(raw);
    const email = (m ? m[2] : raw).trim().toLowerCase();
    const name = m ? m[1].replace(/^"|"$/g, "").trim() || null : null;
    if (EMAIL.test(email)) found.push({ email, name }); else bad.push(raw);
  }
  return { found, bad };
}

/**
 * Admin → Email: write once in the Thelawalaa layout, see it exactly as it
 * will arrive, test it on yourself, then send — everyone gets their own copy.
 */
export default function EmailComposer({ groups, me, reply, initialTo, initialStarter }: {
  groups: RecipientGroup[]; me: { name: string; email: string }; reply?: ReplyTo | null;
  /** Opened from Sent → "Write to them again" (with a starter, e.g. "again"). */
  initialTo?: Recipient[]; initialStarter?: string;
}) {
  const router = useRouter();
  const opening = STARTERS.find((s) => s.id === initialStarter);
  const [draft, setDraft] = useState<EmailDraft>(() => reply
    ? { ...BLANK, subject: reSubject(reply.subject), heading: replyHeading(reply.subject), signoff: "personal" }
    : opening?.draft ?? BLANK);
  const [starter, setStarter] = useState(opening?.id ?? "blank");
  const [to, setTo] = useState<Recipient[]>(reply ? [reply.to] : (initialTo ?? []).slice(0, MAX_RECIPIENTS));
  const [typing, setTyping] = useState("");
  const [replyTo, setReplyTo] = useState(me.email);
  const [html, setHtml] = useState("");
  const [showPreview, setShowPreview] = useState(false); // phones: preview on demand
  const [sending, startSend] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = <K extends keyof EmailDraft>(k: K, v: EmailDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(STARTERS.find((s) => s.id === starter)?.draft ?? BLANK);

  // Live preview (rendered by the server with the real layout), a moment after typing stops.
  const previewName = to[0]?.name ?? null;
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await previewCompanyEmail({ draft, name: previewName }).catch(() => null);
      if (r && "html" in r && r.html) setHtml(r.html);
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [draft, previewName]);

  const addPeople = (people: Recipient[]) => setTo((cur) => {
    const have = new Set(cur.map((r) => r.email));
    const next = [...cur];
    for (const p of people) if (!have.has(p.email)) { have.add(p.email); next.push(p); }
    if (next.length > MAX_RECIPIENTS) toast.error(`Up to ${MAX_RECIPIENTS} people at a time`);
    return next.slice(0, MAX_RECIPIENTS);
  });
  const commitTyping = () => {
    if (!typing.trim()) return;
    const { found, bad } = parseAddresses(typing);
    addPeople(found);
    setTyping(bad.join(", "));
    if (bad.length) toast.error(`Not an email address: ${bad.join(", ")}`);
  };

  const pickStarter = (id: string) => {
    if (dirty && !confirm("Replace what you've written with this template?")) return;
    setStarter(id);
    const picked = STARTERS.find((s) => s.id === id)?.draft ?? BLANK;
    // A reply keeps its "Re: …" subject so it stays in the same conversation.
    setDraft(reply ? { ...picked, subject: reSubject(reply.subject), heading: picked.heading || replyHeading(reply.subject) } : picked);
  };

  const send = (test: boolean) => {
    const pending = typing.trim() ? parseAddresses(typing) : null;
    const people = pending ? [...to, ...pending.found.filter((f) => !to.some((t) => t.email === f.email))] : to;
    if (!test) {
      if (pending?.bad.length) { toast.error(`Fix or remove: ${pending.bad.join(", ")}`); return; }
      if (!people.length) { toast.error("Add at least one email address"); return; }
      if (!confirm(`Send "${draft.subject || "(no subject)"}" to ${people.length} ${people.length === 1 ? "person" : "people"}?`)) return;
    }
    startSend(async () => {
      const r = await sendCompanyEmail({ draft, recipients: people, replyTo, test, inboxId: reply?.inboxId ?? null });
      if (r?.error) { toast.error(r.error); return; }
      if (test) { toast.success(`Test sent to ${me.email}`); return; }
      toast.success(`Sent to ${r.sent} ${r.sent === 1 ? "person" : "people"}${r.failed ? ` — ${r.failed} not sent` : ""}`);
      if (reply) { router.replace("/admin/email"); return; }
      setTo([]); setTyping(""); setDraft(BLANK); setStarter("blank");
      router.refresh();
    });
  };

  const field = "input text-sm";
  const counts = useMemo(() => groups.map((g) => ({ ...g, fresh: g.people.filter((p) => !to.some((t) => t.email === p.email)).length })), [groups, to]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ── Compose ── */}
      <div className="space-y-4">
        {reply && (
          <section className="card border-l-4 border-l-brand-orange p-4 sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-bold text-stone-900">Replying to {reply.to.name ?? reply.to.email}</p>
              <a href="/admin/email?tab=write" className="text-xs font-bold text-stone-400 hover:text-brand-red">Cancel reply</a>
            </div>
            <p className="text-xs text-stone-400">{reply.when}</p>
            {reply.quote && <p className="mt-2 line-clamp-6 whitespace-pre-line rounded-xl bg-stone-50 p-3 text-sm text-stone-600">{reply.quote}</p>}
          </section>
        )}
        <section className="card p-4 sm:p-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">Start from</p>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button key={s.id} type="button" onClick={() => pickStarter(s.id)} aria-pressed={starter === s.id}
                className={cn("rounded-full px-3.5 py-1.5 text-sm font-bold transition",
                  starter === s.id ? "bg-brand-orange text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200")}>
                {s.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="to" className="text-sm font-bold text-stone-700">To</label>
            <span className="text-xs text-stone-400">{to.length ? `${to.length} · each gets their own email` : `Up to ${MAX_RECIPIENTS} people`}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-stone-300 bg-white p-2 focus-within:border-brand-orange focus-within:ring-2 focus-within:ring-brand-orange/30">
            {to.map((r) => (
              <span key={r.email} className="flex max-w-full items-center gap-1 rounded-full bg-orange-50 py-1 pl-2.5 pr-1 text-xs font-bold text-brand-brown ring-1 ring-orange-100">
                <span className="truncate">{r.name ? `${r.name} · ${r.email}` : r.email}</span>
                <button type="button" onClick={() => setTo((cur) => cur.filter((x) => x.email !== r.email))} aria-label={`Remove ${r.email}`}
                  className="rounded-full p-0.5 text-stone-400 hover:bg-white hover:text-brand-red"><X size={13} /></button>
              </span>
            ))}
            <input id="to" value={typing} onChange={(e) => setTyping(e.target.value)} onBlur={commitTyping}
              onKeyDown={(e) => { if (["Enter", ",", ";"].includes(e.key)) { e.preventDefault(); commitTyping(); } else if (e.key === "Backspace" && !typing && to.length) setTo((cur) => cur.slice(0, -1)); }}
              onPaste={(e) => { const t = e.clipboardData.getData("text"); if (/[,;\n]/.test(t)) { e.preventDefault(); const { found, bad } = parseAddresses(t); addPeople(found); setTyping(bad.join(", ")); } }}
              type="email" inputMode="email" autoComplete="off" placeholder={to.length ? "Add another…" : "name@example.com — press Enter"}
              className="min-w-[12rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none" />
          </div>
          {counts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {counts.map((g) => (
                <button key={g.id} type="button" disabled={!g.fresh} onClick={() => addPeople(g.people)} title={g.hint}
                  className="flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700 transition hover:bg-stone-200 disabled:opacity-40">
                  {g.people.length === 1 ? <UserRound size={13} /> : <Users size={13} />} <Plus size={12} /> {g.label} ({g.people.length})
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card space-y-3 p-4 sm:p-5">
          <label className="block">
            <span className="label">Subject</span>
            <input value={draft.subject} onChange={(e) => set("subject", e.target.value)} maxLength={150} className={field} placeholder="What the email is about" />
          </label>
          <label className="block">
            <span className="label">Heading in the email <span className="font-normal text-stone-400">(optional — the subject if left empty)</span></span>
            <input value={draft.heading} onChange={(e) => set("heading", e.target.value)} maxLength={120} className={field} placeholder={draft.subject || "e.g. Thank you!"} />
          </label>
          <label className="block">
            <span className="label">Message</span>
            <textarea value={draft.body} onChange={(e) => set("body", e.target.value)} rows={8} maxLength={5000} className={field}
              placeholder="Write as you'd say it. A blank line starts a new paragraph." />
            <span className="mt-1 block text-[11px] text-stone-400">Blank line = new paragraph · lines starting with &ldquo;- &rdquo; = a bulleted list · links become clickable.</span>
          </label>
          <label className="block">
            <span className="label">Highlighted note <span className="font-normal text-stone-400">(optional — shown in a cream box)</span></span>
            <textarea value={draft.note} onChange={(e) => set("note", e.target.value)} rows={2} maxLength={600} className={field} placeholder="e.g. Show this email at the counter for a free Coca-Cola" />
          </label>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <label className="block">
              <span className="label">Button text <span className="font-normal text-stone-400">(optional)</span></span>
              <input value={draft.buttonLabel} onChange={(e) => set("buttonLabel", e.target.value)} maxLength={40} className={field} placeholder="e.g. Order now" />
            </label>
            <label className="block">
              <span className="label">Button link</span>
              <input value={draft.buttonUrl} onChange={(e) => set("buttonUrl", e.target.value)} maxLength={500} inputMode="url" className={field} placeholder="https://www.thelawalaa.com/order" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-bold text-stone-700">
              <input type="checkbox" checked={draft.greeting} onChange={(e) => set("greeting", e.target.checked)} className="h-4 w-4 accent-[#f97316]" />
              Start with &ldquo;Hi {to[0]?.name?.split(" ")[0] ?? "<first name>"},&rdquo;
            </label>
            <div className="flex flex-wrap items-center gap-1 text-sm">
              <span className="mr-1 font-bold text-stone-700">Sign off</span>
              {([["team", "Team Thelawalaa"], ["personal", `Kind regards, ${me.name.split(" ")[0]}`]] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => set("signoff", k)} aria-pressed={draft.signoff === k}
                  className={cn("rounded-full px-3 py-1 text-xs font-bold", draft.signoff === k ? "bg-brand-brown text-white" : "bg-stone-100 text-stone-600")}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="label">Replies go to</span>
            <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} type="email" inputMode="email" className={field} placeholder={me.email} />
            <span className="mt-1 block text-[11px] text-stone-400">Sent from hello@thelawalaa.com. Replies come back to this address — anything sent to an @thelawalaa.com address shows in the Inbox.</span>
          </label>
        </section>

        {/* Above the admin's floating phone tab bar (84px + the home-bar inset); one line even at 375px. */}
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-10 flex items-center gap-1 rounded-2xl bg-brand-dark p-2 shadow-2xl lg:bottom-4 sm:gap-2">
          <button type="button" onClick={() => setShowPreview((v) => !v)} className="flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-bold text-white/80 hover:text-white sm:px-3 xl:hidden">
            <Eye size={15} /> {showPreview ? "Hide" : "Preview"}
          </button>
          <button type="button" disabled={sending} onClick={() => send(true)} className="shrink-0 rounded-xl px-2.5 py-2 text-sm font-bold text-white/80 hover:text-white disabled:opacity-50 sm:px-3">
            <span className="sm:hidden">Send test</span><span className="hidden sm:inline">Send me a test</span>
          </button>
          <button type="button" disabled={sending} onClick={() => send(false)}
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            <Send size={15} /> {sending ? "Sending…" : `Send${to.length ? ` to ${to.length}` : ""}`}
          </button>
        </div>
      </div>

      {/* ── Preview: exactly what arrives ── */}
      <div className={cn("xl:block", showPreview ? "block" : "hidden")}>
        <div className="card sticky top-20 overflow-hidden">
          <div className="border-b border-stone-100 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Preview</p>
            <p className="mt-0.5 truncate text-sm"><b className="text-stone-900">{draft.subject || "(no subject yet)"}</b>
              <span className="text-stone-400"> · from Thelawalaa &lt;hello@thelawalaa.com&gt;</span></p>
          </div>
          {/* sandbox: the email's own HTML, no scripts, can't touch this page */}
          <iframe title="Email preview" sandbox="" srcDoc={html} className="block h-[70vh] min-h-[480px] w-full bg-[#FFFBEB]" />
        </div>
      </div>
    </div>
  );
}
