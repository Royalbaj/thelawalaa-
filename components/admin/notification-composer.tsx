"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Send, Users, Bike, Trash2 } from "lucide-react";
import { sendNotification, deleteNotification } from "@/app/actions/notifications";
import { cn } from "@/lib/utils";

export function NotificationComposer({ joinedCount, driverCount }: { joinedCount: number; driverCount: number }) {
  const router = useRouter();
  const [audience, setAudience] = useState<"customers" | "drivers">("customers");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [email, setEmail] = useState(true);
  const [push, setPush] = useState(true);
  const [pending, start] = useTransition();
  const reach = audience === "customers" ? joinedCount : driverCount;

  const send = () => {
    const who = audience === "customers" ? `${joinedCount} customer${joinedCount === 1 ? "" : "s"} who joined offers` : `${driverCount} rider${driverCount === 1 ? "" : "s"}`;
    if (!confirm(`Send “${title}” to ${who}?${audience === "customers" && email ? " They'll also get it by email." : ""}`)) return;
    start(async () => {
      const r = await sendNotification({ audience, title, body, link_url: link, email: audience === "customers" && email, push: audience === "drivers" && push });
      if ("error" in r && r.error) { toast.error(r.error); return; }
      const ok = r as { emailed: number; pushed: number; emailProblem: string | null };
      toast.success(audience === "customers"
        ? `Sent — in their inbox${email ? `, emailed to ${ok.emailed}` : ""}`
        : `Sent — in their Updates${push ? `, alert to ${ok.pushed} phone${ok.pushed === 1 ? "" : "s"}` : ""}`);
      if (ok.emailProblem) toast.error(`Email problem: ${ok.emailProblem}`, { duration: 8000 });
      setTitle(""); setBody(""); setLink("");
      router.refresh();
    });
  };

  return (
    <div className="card space-y-4 p-5">
      <h2 className="font-display text-lg font-bold text-brand-brown">New message</h2>
      <div className="grid grid-cols-2 gap-2">
        {([["customers", "Customers", Users, `${joinedCount} joined offers`], ["drivers", "Delivery riders", Bike, `${driverCount} active`]] as const).map(([key, label, Icon, sub]) => (
          <button key={key} type="button" onClick={() => setAudience(key)}
            className={cn("rounded-2xl p-3 text-left ring-1 transition", audience === key ? "bg-orange-50 ring-2 ring-brand-orange" : "bg-white ring-stone-200 hover:bg-stone-50")}>
            <Icon size={18} className={audience === key ? "text-brand-orange" : "text-stone-400"} />
            <p className="mt-1 text-sm font-bold text-brand-brown">{label}</p>
            <p className="text-xs text-stone-500">{sub}</p>
          </button>
        ))}
      </div>
      {audience === "customers" && (
        <p className="rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">Only customers who chose to join offers get these — nobody is added automatically. Each email has an unsubscribe link.</p>
      )}
      <div>
        <label className="label" htmlFor="n-title">Title</label>
        <input id="n-title" className="input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder={audience === "customers" ? "Weekend deal: 2 momo plates for Rs 199" : "Shop closes early today"} />
      </div>
      <div>
        <label className="label" htmlFor="n-body">Message</label>
        <textarea id="n-body" className="input" rows={4} maxLength={500} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={audience === "customers" ? "Saturday and Sunday only, while stocks last." : "Last deliveries at 7:30 pm."} />
        <p className="mt-1 text-right text-[11px] text-stone-400">{body.length}/500</p>
      </div>
      <div>
        <label className="label" htmlFor="n-link">Link <span className="font-normal text-stone-400">(optional — e.g. /order)</span></label>
        <input id="n-link" className="input" maxLength={300} value={link} onChange={(e) => setLink(e.target.value)} placeholder="/order" />
      </div>
      {audience === "customers" ? (
        <label className="flex items-center gap-3 text-sm text-stone-700"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="h-5 w-5 accent-brand-orange" /> Also send it by email</label>
      ) : (
        <label className="flex items-center gap-3 text-sm text-stone-700"><input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} className="h-5 w-5 accent-brand-orange" /> Also send a phone alert (riders who turned alerts on)</label>
      )}
      <button onClick={send} disabled={pending || title.trim().length < 2 || body.trim().length < 2 || reach === 0} className="btn-primary w-full">
        <Send size={16} /> {pending ? "Sending…" : reach === 0 ? (audience === "customers" ? "Nobody has joined offers yet" : "No riders yet") : `Send to ${reach}`}
      </button>
    </div>
  );
}

export function DeleteNotification({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} aria-label="Remove this message"
      onClick={() => { if (confirm("Remove this message from their inbox? (Emails already sent can't be unsent.)")) start(async () => { await deleteNotification(id); router.refresh(); }); }}
      className="rounded-full p-1.5 text-stone-300 transition hover:bg-red-50 hover:text-brand-red"><Trash2 size={15} /></button>
  );
}
