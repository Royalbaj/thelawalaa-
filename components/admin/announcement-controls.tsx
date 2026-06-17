"use client";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { createAnnouncement, setAnnouncementActive } from "@/app/actions/admin-crud";

export function AnnouncementForm() {
  const [pending, start] = useTransition();
  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = Object.fromEntries(new FormData(form));
        start(async () => {
          const r = await createAnnouncement({ message: fd.message, link_url: fd.link_url, ends_at: fd.ends_at });
          if (r?.error) toast.error(r.error); else { toast.success("Announcement live"); form.reset(); }
        });
      }}
    >
      <h3 className="font-display font-bold text-brand-brown">New announcement</h3>
      <input name="message" required placeholder="🛵 Home delivery in 5km — Nrs 20" className="input" maxLength={200} />
      <input name="link_url" type="url" placeholder="Link (optional)" className="input" />
      <label className="label">Ends at (optional)
        <input name="ends_at" type="datetime-local" className="input mt-1" />
      </label>
      <button disabled={pending} className="btn-primary">{pending ? "Publishing…" : "Publish"}</button>
    </form>
  );
}

export function AnnouncementToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => {
        const r = await setAnnouncementActive(id, !active);
        r?.error ? toast.error(r.error) : toast.success(active ? "Hidden" : "Now showing");
      })}
      className={active ? "badge bg-green-100 text-green-800" : "badge bg-stone-200 text-stone-600"}
    >
      {active ? "Active" : "Inactive"}
    </button>
  );
}
