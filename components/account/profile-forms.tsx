"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { passwordSchema } from "@/lib/validations/auth";
import { updateMyProfile } from "@/app/actions/customer";
import PasswordInput from "@/components/auth/password-input";

export function DetailsForm({ fullName, phone }: { fullName: string; phone: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.currentTarget));
      start(async () => {
        const r = await updateMyProfile(fd);
        if (r?.error) toast.error(r.error); else { toast.success("Saved"); router.refresh(); }
      });
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="full_name">Full name</label><input id="full_name" name="full_name" defaultValue={fullName} required maxLength={100} autoComplete="name" className="input" /></div>
        <div><label className="label" htmlFor="phone">Mobile number</label><input id="phone" name="phone" defaultValue={phone} required placeholder="98XXXXXXXX" autoComplete="tel" inputMode="tel" className="input" /></div>
      </div>
      <button disabled={pending} className="btn-primary !py-2.5 text-sm">{pending ? "Saving…" : "Save changes"}</button>
    </form>
  );
}

/** Asks for the current password first — like any serious app — then sets the new one. */
export function PasswordForm({ email }: { email: string }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = Object.fromEntries(new FormData(form));
      if (fd.next !== fd.confirm) return toast.error("The new passwords don't match");
      const parsed = passwordSchema.safeParse(fd.next);
      if (!parsed.success) return toast.error(parsed.error.issues[0].message);
      setBusy(true);
      const supabase = createClient();
      const { error: wrong } = await supabase.auth.signInWithPassword({ email, password: String(fd.current) });
      if (wrong) { setBusy(false); return toast.error("Your current password is wrong"); }
      const { error } = await supabase.auth.updateUser({ password: parsed.data });
      setBusy(false);
      if (error) return toast.error(/different from the old/i.test(error.message) ? "Choose a password you haven't used before" : "Couldn't change it — try again");
      toast.success("Password changed");
      form.reset(); setPw("");
    }}>
      <PasswordInput id="current" name="current" label="Current password" />
      <div className="grid gap-4 sm:grid-cols-2">
        <PasswordInput id="next" name="next" label="New password" value={pw} onChange={setPw} showRules autoComplete="new-password" />
        <PasswordInput id="confirm" name="confirm" label="Confirm new password" autoComplete="new-password" />
      </div>
      <button disabled={busy} className="btn-primary !py-2.5 text-sm">{busy ? "Saving…" : "Change password"}</button>
    </form>
  );
}
