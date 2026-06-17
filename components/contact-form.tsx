"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { submitContact } from "@/app/actions/contact";

export default function ContactForm() {
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const fd = new FormData(e.currentTarget);
        const res = await submitContact(Object.fromEntries(fd));
        setBusy(false);
        if (res?.error) toast.error(res.error);
        else {
          toast.success("Message sent — we'll reply soon!");
          (e.target as HTMLFormElement).reset();
        }
      }}
    >
      {/* honeypot — hidden from humans, bots fill it */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="c-name">Name</label><input id="c-name" name="name" required maxLength={100} className="input" /></div>
        <div><label className="label" htmlFor="c-email">Email</label><input id="c-email" name="email" type="email" required className="input" /></div>
      </div>
      <div><label className="label" htmlFor="c-phone">Phone (optional)</label><input id="c-phone" name="phone" className="input" /></div>
      <div><label className="label" htmlFor="c-msg">Message</label><textarea id="c-msg" name="message" required minLength={5} maxLength={2000} rows={4} className="input" /></div>
      <button disabled={busy} className="btn-primary">{busy ? "Sending…" : "Send message"}</button>
    </form>
  );
}
