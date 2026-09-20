"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { passwordSchema } from "@/lib/validations/auth";
import { ROLE_HOME } from "@/lib/role-home";

// Staff land here from the Supabase invite email (already session'd via token).
export default function InvitePage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    if (fd.password !== fd.confirm) return toast.error("Passwords don't match");
    const parsed = passwordSchema.safeParse(fd.password);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    if (error) { setBusy(false); return toast.error("Invite link expired — ask your admin to resend"); }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ invite_accepted_at: new Date().toISOString() }).eq("id", user.id);
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      router.push((p?.role && ROLE_HOME[p.role]) || "/account");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-center font-display text-2xl font-bold">Welcome to the team</h1>
        <p className="mt-2 text-center text-sm text-stone-600">Set a password to activate your staff account.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div><label className="label" htmlFor="password">New password</label><input id="password" name="password" type="password" required className="input" /></div>
          <div><label className="label" htmlFor="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" required className="input" /></div>
          <button disabled={busy} className="btn-primary w-full">{busy ? "Saving…" : "Activate account"}</button>
        </form>
      </div>
    </div>
  );
}
