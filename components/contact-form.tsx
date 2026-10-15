"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { submitContact } from "@/app/actions/contact";
import { UI, type SiteLang } from "@/lib/site-lang";

export default function ContactForm({ lang = "en" }: { lang?: SiteLang }) {
  const [busy, setBusy] = useState(false);
  const L = UI[lang].form;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const fd = new FormData(e.currentTarget);
        const res = await submitContact(Object.fromEntries(fd));
        setBusy(false);
        if (res?.error) toast.error(res.error);
        else {
          toast.success(L.sent);
          (e.target as HTMLFormElement).reset();
        }
      }}
    >
      {/* honeypot — hidden from humans, bots fill it */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="c-name">{L.name}</label><input id="c-name" name="name" required maxLength={100} autoComplete="name" className="input" /></div>
        <div><label className="label" htmlFor="c-email">{L.email}</label><input id="c-email" name="email" type="email" inputMode="email" required autoComplete="email" className="input" /></div>
      </div>
      <div><label className="label" htmlFor="c-phone">{L.phone}</label><input id="c-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} className="input" /></div>
      <div><label className="label" htmlFor="c-msg">{L.message}</label><textarea id="c-msg" name="message" required minLength={5} maxLength={2000} rows={4} className="input" /></div>
      <button disabled={busy} className="btn-primary w-full sm:w-auto">{busy ? L.sending : L.send}</button>
    </form>
  );
}
